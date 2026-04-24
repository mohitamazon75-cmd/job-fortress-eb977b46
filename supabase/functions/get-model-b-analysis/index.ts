import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { detectExecutiveTier, buildExecutiveModeBlock } from "../_shared/executive-mode.ts";
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";

// Module-level breaker — shared across invocations on the same isolate.
// 3 consecutive india-jobs failures → 60s cooldown using LLM fallback.
const indiaJobsBreaker = new CircuitBreaker("india-jobs", { threshold: 3, cooldownMs: 60_000 });



const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const SECONDARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const MAX_RETRIES = 3;
const AI_TIMEOUT_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const jsonHeaders = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { analysis_id, user_id, resume_filename, poll } = body;

    if (!analysis_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id and user_id are required" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabase = createAdminClient();

    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("id, user_id, final_json_report, role_detected, industry, years_experience, linkedin_url, scan_status, determinism_index")
      .eq("id", analysis_id)
      .maybeSingle();

    if (scanError || !scan) {
      return new Response(
        JSON.stringify({ success: false, error: "Analysis not found" }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // Ownership check.
    // - If user_id is missing from the request (anonymous viewer / no session),
    //   surface a clear AUTH_REQUIRED instead of a generic Forbidden so the
    //   frontend can prompt sign-in instead of treating it as a runtime error.
    // - If the scan is owned by a different user, return Forbidden.
    if (scan.user_id && !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Sign in to view this analysis", code: "AUTH_REQUIRED" }),
        { status: 401, headers: jsonHeaders }
      );
    }
    if (scan.user_id && user_id && scan.user_id !== user_id) {
      // Check if previous owner is an anonymous user (no email) — if so,
      // transfer ownership to the currently authenticated user. This handles
      // the common case where a user scanned anonymously then signed in,
      // creating a fresh auth user that doesn't match the original scan owner.
      let transferred = false;
      try {
        const { data: prevUser } = await supabase.auth.admin.getUserById(scan.user_id);
        const isAnon = !prevUser?.user?.email && (prevUser?.user?.is_anonymous ?? true);
        if (isAnon) {
          const { error: xferErr } = await supabase
            .from("scans")
            .update({ user_id })
            .eq("id", analysis_id);
          if (!xferErr) {
            scan.user_id = user_id;
            transferred = true;
            console.log(`[model-b] transferred scan ${analysis_id} from anon ${prevUser?.user?.id} to ${user_id}`);
          }
        }
      } catch (e) {
        console.warn("[model-b] ownership transfer check failed", e);
      }
      if (!transferred) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "This analysis belongs to a different account. Sign in with the original account or start a new scan.",
            code: "FORBIDDEN",
          }),
          { status: 403, headers: jsonHeaders }
        );
      }
    }
    if (!scan.user_id && user_id) {
      const { error: claimErr } = await supabase
        .from("scans")
        .update({ user_id })
        .eq("id", analysis_id)
        .is("user_id", null);
      if (claimErr) {
        console.warn("[model-b] failed to claim anonymous scan", claimErr);
      } else {
        scan.user_id = user_id;
      }
    }

    // Hard-stop if the underlying scan never produced a usable report.
    // Prevents model-b from spinning on failed/invalid_input scans and
    // tells the frontend to surface a "rescan" CTA instead of looping.
    if (
      (scan.scan_status === "invalid_input" || scan.scan_status === "failed")
      && !scan.final_json_report
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Original scan didn't complete. Please run a new scan.",
          code: "SCAN_NOT_READY",
          scan_status: scan.scan_status,
        }),
        { status: 409, headers: jsonHeaders }
      );
    }

    // ─── Check cache / completed results ───
    // TTL: card_data older than 2 hours is considered stale and will regenerate.
    // This ensures fresh analysis when users rescan with new resumes, and
    // eliminates the need to manually clear model_b_results between scans.
    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — aggressive TTL ensures fresh analysis
    const { data: cached } = await supabase
      .from("model_b_results")
      .select("*")
      .eq("analysis_id", analysis_id)
      .eq("user_id", user_id)
      .not("card_data", "is", null)
      .maybeSingle();

    const cacheAge = cached?.updated_at
      ? Date.now() - new Date(cached.updated_at as string).getTime()
      : Infinity;
    const cacheValid = cached?.card_data
      && Object.keys(cached.card_data as object).length > 5
      && cacheAge < CACHE_TTL_MS;

    if (cacheValid) {
      console.log(`[model-b] Cache hit for ${analysis_id} (age: ${Math.round(cacheAge / 60000)}min)`);
      return new Response(
        JSON.stringify({ success: true, data: cached }),
        { headers: jsonHeaders }
      );
    }

    // ─── Re-entrancy guard ───
    // If a placeholder row exists with null card_data and was created/updated in the last
    // 90 seconds, another invocation is already generating — do not re-trigger.
    // After 90s with no completion, treat as failed and allow regeneration.
    const PROCESSING_LOCK_MS = 90 * 1000;
    const cachedAgeMs = cached?.updated_at
      ? Date.now() - new Date(cached.updated_at as string).getTime()
      : Infinity;
    const isProcessingLocked = cached
      && !cached.card_data
      && cachedAgeMs < PROCESSING_LOCK_MS;

    if (isProcessingLocked) {
      console.log(`[model-b] Processing lock held for ${analysis_id} (age: ${Math.round(cachedAgeMs / 1000)}s) — returning processing`);
      return new Response(
        JSON.stringify({ success: true, status: "processing" }),
        { headers: jsonHeaders }
      );
    }

    // Stale or missing — clear and regenerate
    if (cached?.card_data && !cacheValid) {
      console.log(`[model-b] Cache STALE for ${analysis_id} (age: ${Math.round(cacheAge / 60000)}min) — regenerating`);
      await supabase.from("model_b_results")
        .update({ card_data: null, gemini_raw: null })
        .eq("analysis_id", analysis_id)
        .eq("user_id", user_id);
    }

    // ─── If polling, check if processing is in progress ───
    if (poll) {
      const { data: pending } = await supabase
        .from("model_b_results")
        .select("id, card_data, updated_at")
        .eq("analysis_id", analysis_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (pending && !pending.card_data) {
        const pendingAge = pending.updated_at
          ? Date.now() - new Date(pending.updated_at as string).getTime()
          : 0;
        // If pending older than 3 minutes, treat as failed
        if (pendingAge > 3 * 60 * 1000) {
          return new Response(
            JSON.stringify({ success: false, error: "Analysis timed out. Please retry." }),
            { status: 408, headers: jsonHeaders }
          );
        }
        return new Response(
          JSON.stringify({ success: true, status: "processing" }),
          { headers: jsonHeaders }
        );
      }
      if (pending?.card_data) {
        return new Response(
          JSON.stringify({ success: true, data: pending }),
          { headers: jsonHeaders }
        );
      }
      return new Response(
        JSON.stringify({ success: true, status: "not_started" }),
        { headers: jsonHeaders }
      );
    }

    const resumeText = extractResumeText(scan);
    const userCity = extractCity(scan);

    if (!resumeText || resumeText.length < 20) {
      return new Response(
        JSON.stringify({ success: false, error: "Resume text not available or too short" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 503, headers: jsonHeaders }
      );
    }

    // ─── P1: Per-user daily cap (cost guardrail) ───
    // Block if this user has triggered >5 fresh model-b generations in the last 24h.
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("model_b_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id)
        .gte("updated_at", since);
      if ((count ?? 0) > 5) {
        console.warn(`[model-b] Daily cap exceeded for user ${user_id}: ${count} runs in 24h`);
        return new Response(
          JSON.stringify({ success: false, error: "Daily analysis limit reached. Please try again tomorrow." }),
          { status: 429, headers: jsonHeaders }
        );
      }
    } catch (e) {
      console.warn("[model-b] daily-cap check failed (non-fatal):", e);
    }

    // ─── Create placeholder row to signal "processing" ───
    // Updated_at is bumped by upsert — this also resets the processing lock window.
    await supabase
      .from("model_b_results")
      .upsert({
        analysis_id,
        user_id,
        resume_filename: resume_filename ?? "Your Resume",
        card_data: null,
        risk_score: null,
        shield_score: null,
        ats_avg: null,
        job_match_count: null,
        gemini_raw: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "analysis_id" })
      .select("id")
      .single();

    // ─── Launch background AI processing ───
    const processPromise = processAnalysis(
      supabase, LOVABLE_API_KEY, analysis_id, user_id,
      resume_filename, resumeText, userCity,
      scan.role_detected || "", scan.industry || "",
      scan.years_experience || "",
      typeof scan.determinism_index === "number" ? scan.determinism_index : null,
    );

    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(processPromise);
      console.log(`[model-b] Background processing started for ${analysis_id}`);
      return new Response(
        JSON.stringify({ success: true, status: "processing", message: "Analysis started" }),
        { headers: jsonHeaders }
      );
    }

    const result = await processPromise;
    if (result) {
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "AI analysis failed after retries. Please try again." }),
      { status: 500, headers: jsonHeaders }
    );
  } catch (e) {
    console.error("[model-b] Unhandled error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Background AI processing
// ═══════════════════════════════════════════════════════════════
async function processAnalysis(
  supabase: any,
  apiKey: string,
  analysisId: string,
  userId: string,
  resumeFilename: string,
  resumeText: string,
  userCity: string,
  detectedRole = "",
  detectedIndustry = "",
  yearsExperience: string | number = "",
  detScoreAnchor: number | null = null,
): Promise<any> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt();

  // ── Issue 4-A: Fetch live India job listings before the LLM call ────────────
  // Call india-jobs to get real Tavily-powered listings for this role + city.
  // Inject as grounding context so the LLM formats real data instead of
  // hallucinating plausible-sounding but unverifiable job matches.
  // Timeout: 8s — if india-jobs is slow, we fall back to LLM generation.
  let liveJobsContext = "";
  if (!indiaJobsBreaker.canAttempt()) {
    console.log("[model-b] india-jobs circuit OPEN — skipping live fetch, using LLM fallback");
  } else try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract role hint from resume — prefer detected role (LLM-classified), fall back to regex
    const roleLine = resumeText.slice(0, 500).split("\n")
      .find(l => /engineer|manager|analyst|developer|director|lead|head|specialist|consultant|founder|ceo|cto|cfo|coo|president|partner|chief/i.test(l));
    const roleHint = (detectedRole && detectedRole.length > 2)
      ? detectedRole
      : (roleLine?.trim().slice(0, 80) || "Professional");

    const skillLine = resumeText.match(/\b(skills?|expertise|technologies)[:\-\s]([^\n]{20,300})/i);
    const topSkills: string[] = skillLine
      ? skillLine[2].split(/[,•|/]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30).slice(0, 5)
      : [];

    const execHint = detectExecutiveTier(resumeText, detectedRole, yearsExperience);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const jobsResp = await fetch(`${supabaseUrl}/functions/v1/india-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        role: roleHint,
        city: userCity === "India" ? "Bangalore" : userCity,
        skills: topSkills,
        experience: String(yearsExperience || ""),
        country: "IN",
        is_executive: execHint.isExecutive,
        executive_tier: execHint.tier || null,
        mode: "grounding_context",
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (jobsResp.ok) {
      const jobsData = await jobsResp.json();
      const listings = (jobsData.live_jobs || jobsData.jobs || []).slice(0, 6);
      if (listings.length > 0) {
        liveJobsContext = `\n\nLIVE JOB LISTINGS (fetched live ${execHint.isExecutive ? "from executive search channels" : "from Naukri/LinkedIn"} just now — base card5_jobs.job_matches on these EXACT entries; do NOT invent new ones):\n${
          listings.map((j: any, i: number) =>
            `${i + 1}. ${j.title || j.role} | Company: ${j.company || "Listed"} | ${j.location} | ${j.salary_range || "salary not listed"} | URL: ${j.url || j.search_url || ""}`
          ).join("\n")
        }\n\nSTRICT RULES for card5_jobs.job_matches:\n- Use EXACTLY the role title and URL from the listings above\n- Set "verified_live": true for each entry that comes from this list\n- The "search_url" field MUST be the URL from the listing above (do NOT construct your own)\n- If a listing has a real company name (not "Listed"), use it; otherwise set company="${execHint.isExecutive ? "Executive Search" : "Naukri Search"}"`;
        console.log(`[model-b] Injected ${listings.length} live job listings (exec=${execHint.isExecutive}) as grounding context`);
      } else {
        console.log("[model-b] india-jobs returned 0 listings; LLM will fabricate from market data");
      }
      indiaJobsBreaker.recordSuccess();
    } else {
      console.warn(`[model-b] india-jobs returned ${jobsResp.status} — recording failure`);
      indiaJobsBreaker.recordFailure();
    }
  } catch (jobErr) {
    // Non-fatal — LLM generates job matches as fallback
    console.warn("[model-b] Live jobs pre-fetch failed (non-fatal, using LLM fallback):", jobErr);
    indiaJobsBreaker.recordFailure();
  }

  // ── Executive Mode detection (CEO/Founder/CXO/VP+15yrs) ─────────────────
  // When detected, an override block is appended to the user prompt forcing
  // the model to use ₹Cr salary bands, board/PE/VC pivots, executive-search
  // channels and equity-tier negotiation. Without this, sitting CEOs receive
  // junior-tier output (e.g., "AI Strategy Lead, ₹90-140L on Naukri") which
  // is a 5/10 product experience for executive users.
  const execDetect = detectExecutiveTier(resumeText, detectedRole, yearsExperience);
  if (execDetect.isExecutive) {
    console.log(`[model-b] Executive Mode active: tier=${execDetect.tier} title="${execDetect.matchedTitle}" years=${execDetect.yearsHint}`);
  }
  const executiveBlock = buildExecutiveModeBlock(execDetect);

  const userPrompt = buildUserPrompt(resumeText, userCity, liveJobsContext, detectedRole, detectedIndustry) + executiveBlock;
  let cardData: Record<string, unknown> | null = null;
  let geminiRaw: unknown = null;
  let modelUsed = PRIMARY_MODEL;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const model = attempt === 0 ? PRIMARY_MODEL : attempt === 1 ? SECONDARY_MODEL : FALLBACK_MODEL;
    modelUsed = model;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const isGpt = model.includes("gpt-5");
      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.45, // Higher than 0.25 — psychological copy needs creative variation while JSON structure stays valid
        max_tokens: 12000,
      };

      if (isGpt) {
        delete requestBody.max_tokens;
        requestBody.max_completion_tokens = 12000;
        requestBody.temperature = 1;
      }
      requestBody.response_format = { type: "json_object" };

      const aiResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (aiResponse.status === 429 || aiResponse.status === 402) {
        console.error(`[model-b] Rate limit/payment error ${aiResponse.status}`);
        await updateError(supabase, analysisId, `Rate limited (${aiResponse.status})`);
        return null;
      }

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`[model-b] AI ${model} error [${aiResponse.status}] attempt ${attempt + 1}:`, errText.slice(0, 200));
        continue;
      }

      const data = await aiResponse.json();
      geminiRaw = data;
      const rawText = data?.choices?.[0]?.message?.content;

      if (!rawText) {
        console.error(`[model-b] Empty response from ${model} attempt ${attempt + 1}`);
        continue;
      }

      cardData = parseAIResponse(rawText);

      const validation = validateCardData(cardData);
      if (!validation.valid) {
        console.error(`[model-b] Validation failed (${model} attempt ${attempt + 1}): ${validation.issues.join(", ")}`);
        cardData = null;
        continue;
      }

      console.log(`[model-b] Success with ${model} attempt ${attempt + 1} (${Date.now() - startTime}ms)`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        console.error(`[model-b] Timeout (${AI_TIMEOUT_MS}ms) on ${model} attempt ${attempt + 1}`);
      } else {
        console.error(`[model-b] Error on ${model} attempt ${attempt + 1}:`, msg);
      }
    }
  }

  if (!cardData) {
    await updateError(supabase, analysisId, "AI analysis failed after retries");
    return null;
  }

  // ── Inject scan learning content into cardData ─────────────────────────────
  // The weekly_survival_diet (read/watch/listen plan) and judo_strategy
  // (specific AI tool to adopt) are generated by the main scan pipeline but
  // are not part of the Model B LLM output. Fetching them here and embedding
  // them in card_data means:
  //   1. They survive the cache — subsequent loads get them from model_b_results
  //   2. ResultsModelB can render them without a second DB query
  //   3. Users see the "live tools, YouTube, courses" content they expect
  try {
    const { data: scanRow } = await supabase
      .from("scans")
      .select("final_json_report")
      .eq("id", analysisId)
      .maybeSingle();
    if (scanRow?.final_json_report) {
      const r = typeof scanRow.final_json_report === "string"
        ? JSON.parse(scanRow.final_json_report)
        : scanRow.final_json_report;
      // Attach learning fields — only if they have meaningful content
      if (r.weekly_survival_diet?.theme) {
        (cardData as Record<string, unknown>).scan_weekly_diet = r.weekly_survival_diet;
      }
      if (r.judo_strategy?.recommended_tool) {
        (cardData as Record<string, unknown>).scan_judo = r.judo_strategy;
      }
      if (Array.isArray(r.skill_threat_intel) && r.skill_threat_intel.length > 0) {
        (cardData as Record<string, unknown>).scan_skill_threats = r.skill_threat_intel.slice(0, 5);
      }
    }
  } catch (e) {
    console.warn("[model-b] Could not inject scan learning data (non-fatal):", e);
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PROCESSING — TRUST GUARDRAILS (3 trust killers from audit)
  // 1. Anchor risk_score to deterministic engine (kills same-user variance)
  // 2. Whitelist quote sources (kills fabricated citations like "YPO Summit 2026")
  // 3. Normalize search_url to canonical Naukri directory (kills broken/empty links)
  // All operations fail OPEN on malformed input — we never strip data on edge cases.
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    applyTrustGuardrails(cardData, detScoreAnchor, userCity);
  } catch (gErr) {
    console.warn("[model-b] Trust guardrails failed (non-fatal, keeping LLM output):", gErr);
  }

  const insertPayload = {
    analysis_id: analysisId,
    user_id: userId,
    gemini_raw: geminiRaw,
    risk_score: (cardData.risk_score as number) ?? 55,
    shield_score: (cardData.shield_score as number) ?? 60,
    ats_avg: (cardData.ats_avg as number) ?? 60,
    job_match_count: (cardData.card5_jobs as any)?.job_matches?.length ?? 5,
    resume_filename: resumeFilename ?? "Your Resume",
    card_data: cardData,
  };

  const { data: updated, error: updateErr } = await supabase
    .from("model_b_results")
    .update({
      card_data: cardData,
      gemini_raw: geminiRaw,
      risk_score: insertPayload.risk_score,
      shield_score: insertPayload.shield_score,
      ats_avg: insertPayload.ats_avg,
      job_match_count: insertPayload.job_match_count,
    })
    .eq("analysis_id", analysisId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateErr) {
    console.error("[model-b] Update error:", updateErr);
    const { data: inserted } = await supabase
      .from("model_b_results")
      .insert(insertPayload)
      .select("*")
      .single();
    return inserted || { ...insertPayload, id: crypto.randomUUID() };
  }

  console.log(`[model-b] Complete: ${analysisId} model=${modelUsed} time=${Date.now() - startTime}ms`);
  return updated;
}

async function updateError(supabase: any, analysisId: string, error: string) {
  await supabase
    .from("model_b_results")
    .delete()
    .eq("analysis_id", analysisId)
    .is("card_data", null);
  console.error(`[model-b] ${error} for ${analysisId}`);
}

// ═══════════════════════════════════════════════════════════════
// Resume text extraction
// ═══════════════════════════════════════════════════════════════
function extractResumeText(scan: Record<string, unknown>): string {
  if (scan.final_json_report) {
    const report = typeof scan.final_json_report === "string"
      ? JSON.parse(scan.final_json_report as string)
      : scan.final_json_report;

    const textField = report.raw_text || report.resume_text || report.parsed_text
      || report.profile_text || report.content || "";

    if (textField && String(textField).length > 20) return String(textField);
    if (Object.keys(report).length > 0) return JSON.stringify(report);
  }

  const fallback = [scan.role_detected, scan.industry, scan.years_experience, scan.linkedin_url]
    .filter(Boolean)
    .join(" | ");

  return fallback;
}

// ═══════════════════════════════════════════════════════════════
// City extraction from scan data
// ═══════════════════════════════════════════════════════════════
function extractCity(scan: Record<string, unknown>): string {
  // Try metro_tier field first (sometimes contains city name)
  // Try final_json_report for location data
  if (scan.final_json_report) {
    const report = typeof scan.final_json_report === "string"
      ? JSON.parse(scan.final_json_report as string)
      : scan.final_json_report;
    
    // Check common location fields in the report
    const city = report.city || report.location || report.metro_city 
      || report.user_city || report.profile_city || "";
    if (city && String(city).length > 1) return String(city);
    
    // Check nested profile data
    if (report.profile?.city) return String(report.profile.city);
    if (report.profile?.location) return String(report.profile.location);
    
    // Try to find city in raw text
    const rawText = report.raw_text || report.resume_text || "";
    if (rawText) {
      const indianCities = ["Hyderabad", "Bangalore", "Bengaluru", "Mumbai", "Delhi", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Noida", "Gurugram", "Gurgaon", "Jaipur", "Kochi", "Chandigarh", "Indore", "Lucknow", "Coimbatore", "Trivandrum", "Thiruvananthapuram"];
      for (const c of indianCities) {
        if (String(rawText).toLowerCase().includes(c.toLowerCase())) return c;
      }
    }
  }
  
  return "India"; // Unknown — do NOT default to Bangalore
}

// ═══════════════════════════════════════════════════════════════
// AI Response parsing
// ═══════════════════════════════════════════════════════════════
function parseAIResponse(rawText: string): Record<string, unknown> {
  try { return JSON.parse(rawText); } catch { /* continue */ }
  const stripped = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }
  }
  throw new Error("Could not parse AI response as JSON");
}

// ═══════════════════════════════════════════════════════════════
// Output validation
// ═══════════════════════════════════════════════════════════════
function validateCardData(data: Record<string, unknown>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const requiredKeys = ["card1_risk", "card2_market", "card3_shield", "card4_pivot", "card5_jobs", "card6_blindspots", "card7_human"];
  for (const key of requiredKeys) {
    if (!data[key]) issues.push(`Missing ${key}`);
  }
  const c1 = data.card1_risk as any;
  if (c1 && !c1.fear_hook) issues.push("card1_risk missing fear_hook");
  if (c1 && !c1.confrontation) issues.push("card1_risk missing confrontation");
  if (c1 && !c1.cost_of_inaction) issues.push("card1_risk missing cost_of_inaction");
  
  const c5 = data.card5_jobs as any;
  if (c5 && (!Array.isArray(c5.job_matches) || c5.job_matches.length < 3)) {
    issues.push("card5_jobs.job_matches must have at least 3 items");
  }
  const c6 = data.card6_blindspots as any;
  if (c6 && (!Array.isArray(c6.interview_prep) || c6.interview_prep.length < 3)) {
    issues.push("card6_blindspots.interview_prep must have at least 3 items");
  }
  const c7 = data.card7_human as any;
  if (c7 && (!Array.isArray(c7.advantages) || c7.advantages.length < 3)) {
    issues.push("card7_human.advantages must have at least 3 items");
  }
  const riskScore = Number(data.risk_score);
  if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
    issues.push(`Invalid risk_score: ${data.risk_score}`);
  }
  return { valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Psychology-Driven Career Intelligence Engine
// ═══════════════════════════════════════════════════════════════
function buildSystemPrompt(): string {
  return `You are JobBachao's Psychology-Driven Career Intelligence Engine — combining 20 years of Indian hiring expertise with deep knowledge of behavioral psychology, loss aversion, and specific behavioral patterns and career intelligence.

ADDRESSATION RULE (CRITICAL — zero tolerance):
- NEVER use "this professional", "the candidate", "the user", or third-person constructions.
- Address the user as "you" throughout. If a name is extracted from the resume, use it.
- Use the company name directly, never "their company".

CITATION STANDARD (CRITICAL):
- Attach a bracket citation ONLY when the claim is directly traceable to a source explicitly provided in the "INDIA MARKET FACTS" section of this prompt (e.g. [WEF 2025], [NASSCOM 2026], [Deloitte India 2026]). Do NOT fabricate citation attributions for claims you generated yourself. When no explicit source exists, use qualitative language without brackets.
- If no source exists for a claim, use qualitative language. NEVER fabricate statistics.

VOICE GUIDE (MANDATORY — elder-brother mentor tone; OVERRIDES any conflicting directive below):
The user has asked for a specific voice: mentor who is like an elder brother — friendly, professional, direct, specific, never fake. This section overrides any tonal directive further down in the prompt.

1. SPECIFICITY RULE: Every claim must name a specific thing. Not "your skills" — the named skill from their resume. Not "the market" — the specific role/city/segment.

2. OBSERVATION OVER PREDICTION: Phrase claims as "what I see in your profile" rather than "what will happen." "Three tools replicate your billable skills" NOT "AI will replace you by 2027."

3. FORBIDDEN PHRASES (never emit):
   - "yaar", "dekho", "arre", "my friend", "listen to me", "beta"
   - "You've got this", "don't worry", "you're doing great", "believe in yourself"
   - "disruption", "game-changer", "paradigm shift", "transformation journey", "reinvent yourself"
   - "leverage synergies", "strategic alignment", corporate jargon
   - "In today's fast-paced world" or similar opening tropes
   - Absolute date predictions ("by 2027 your employer will know") — ground in current observation

4. EARN THE HARD LINE: Never open a card with the hardest truth. First acknowledge what the user built, THEN state what's at risk.

5. ACTIONS MUST BE TIME-BOXED: Every direct challenge names "this week / this month / this quarter" and fits that window.

6. AGE-ADAPTIVE TONE — detect from years_experience:
   - years <= 5: Forward-looking, trajectory framing. NEVER use "disruption/obsolescence."
   - years 6-15: Strategic capability-audit framing.
   - years 15+: Dignified peer-to-peer framing. NEVER suggest they need to "keep up with juniors."

7. HOPE POINTS TO A REAL ASSET: Never "You have potential." Always: "Your [specific named skill] is uncommon for [their tier]."

8. NEVER INFLATE OR DEFLATE: Match tone to the actual risk_score. Low score means reserved confidence; high score means clear concern without melodrama.

9. HINGLISH ONLY WHEN PRECISE: No decorative Hindi. Use English technical terms when English is more precise.

10. END WITH DIRECTION, NOT SUMMARY: Close each card with an action, not a recap.

YOUR DUAL ROLE:
1. ANALYST: Extract every quantifiable achievement, skill signal, and career pattern from the resume
2. PSYCHOLOGIST: Surface every insight with specificity and direction, respecting the reader's intelligence and experience

═══ PSYCHOLOGICAL FRAMEWORK (Apply to EVERY card) ═══

Each card must follow the ACKNOWLEDGE → OBSERVE → ACT emotional arc (acknowledge what they built, observe what's changed, name the action):

CARD 1 (Risk Mirror) — PRIMARY TRIGGER: LOSS AVERSION
- Make them FEEL what they're losing by doing nothing
- Calculate exact ₹ cost of inaction (salary gap × months)
- Use qualitative comparisons: "Most candidates at this level have…" or "A common gap at this tier is…" — never invent specific percentages.
- Confrontation: One brutal honest sentence about their biggest weakness

CARD 2 (Market Radar) — PRIMARY TRIGGER: SOCIAL COMPARISON + ANCHORING
- Show them where they sit vs peers who are WINNING
- Anchor high: show aspirational salaries FIRST, then their current position
- Make the gap feel personal and urgent

CARD 3 (Skill Shield) — PRIMARY TRIGGER: COMPETENCE AFFIRMATION + IDENTITY
- After scaring them in Cards 1-2, NOW affirm their unique strengths
- Make them feel: "I have rare abilities most people don't"
- But IMMEDIATELY follow with: "...and here's the gap that could destroy it all"

CARD 4 (Pivot Paths) — PRIMARY TRIGGER: FOMO + SCARCITY
- "These roles are hiring NOW — windows close fast in Indian market"
- Show salary jumps that create desire
- Make inaction feel expensive

CARD 5 (Jobs Tracker) — PRIMARY TRIGGER: URGENCY + SOCIAL PROOF
- "Posted 3 days ago, 200+ applicants already"
- "Your specific experience gives you an edge — but only if you act THIS WEEK"
- Every job must feel like a narrowing window

CARD 6 (Blind Spots) — PRIMARY TRIGGER: TOUGH LOVE + ACCOUNTABILITY
- Be direct and specific. Name gaps clearly. Acknowledge effort first.
- "Here's what's actually holding you back, and you probably know it"
- Severity levels: Mark each gap as CRITICAL / SERIOUS / MODERATE
- Use qualitative framing: "Many candidates at this level have developed this. Yours is a gap." Never invent specific percentages.

CARD 7 (Human Advantage) — PRIMARY TRIGGER: HOPE ANCHORING + IDENTITY REINFORCEMENT
- After the tough love, deliver powerful hope
- "Here's why YOU specifically will survive what AI cannot touch"
- End with a 24-hour mission — one specific action for TODAY

═══ EMOTIONAL STRUCTURE (Required in EVERY card) ═══

WRITING RULES — apply to ALL text fields:
- Short sentences. Never more than 12 words per sentence.
- Present tense. Not "will be" — "is being."
- ₹ amounts and months beat percentages.
- Name the skill. Not "execution tasks" — "copywriting."
- The reader should feel seen, not lectured.
- No MBA-speak: never use "depreciating", "AI-driven systems", "displacement susceptibility", "synthesize complex", "disruption", "transformation journey", "paradigm shift"
- No trailing questions. End with statements.

Replace generic "emotion_message" with this 3-part structure (GUIDANCE, not fixed templates — adapt language to the user; never copy these examples verbatim):
- fear_hook: 2 SHORT sentences, max 35 words total. Name 2-3 specific tools or market movements CURRENTLY doing the user's billable work. Present-tense observation only (e.g. "Three tools in your stack now handle first-pass architecture design"). NEVER use the phrase "your employer will know." NEVER use absolute-date predictions ("by 2027"). Voice Guide Rule 2.
- tough_love: 2 SHORT sentences, max 30 words total. First: ACKNOWLEDGE what the user has built (Voice Guide Rule 4). Second: name the shift their current work faces. NEVER use the template "the next {X} years will reward…" — that phrasing assumes future career duration and inflates. Match tone to risk_score (Voice Guide Rule 8).
- hope_bridge: 1-2 sentences, max 25 words total. Point to ONE specific asset from the user's resume (named skill, named pattern of decisions, named domain). Explain defensibility in evidence-based terms — NEVER "AI cannot replicate" absolutes. Prefer: "AI can't synthesize [specific thing the user has done repeatedly]." Voice Guide Rule 7.

Also include:
- confrontation: Directly challenge them. End with a specific action, not a question.
  Example: "You've managed ₹2Cr budgets but never owned a P&L. Fix that this week. One case study. One number. One outcome you own."

═══ SCORING FRAMEWORK ═══
- risk_score: Automation exposure (40%) + market demand trajectory (25%) + skill moat depth (20%) + seniority protection (15%)
- shield_score: AI-proof skills + leadership evidence + cross-functional scope + domain expertise
- ats_avg: Set to null. No real JD-matching corpus is available yet (Day 3 pipeline will populate this). Do NOT invent an ATS score.
- jobbachao_score: 100 - (risk_score × (1 - shield_score/200))

═══ EVIDENCE RULES ═══
- Every claim must trace to a specific resume line or quantified achievement
- Salary figures always in ₹ LPA format
- Job matches must use real Naukri search URLs — NEVER invent specific company names or job titles that may not exist
- Interview answers must use STAR framework with the candidate's actual metrics
- Never use phrases like "your resume shows" — state evidence directly
- NEVER default to Bangalore. Use the user's actual city from their resume. If no city is found, use "India" as location.
- NEVER fabricate statistics like peer percentages, applicant counts, or days-posted numbers. You have NO access to live job board data.
- For cost_of_inaction: use PERCENTAGE of package (e.g. "10-15%"), NOT absolute ₹ amounts. You do NOT know their salary.

═══ LIVE LINKS ═══
For every ATS score entry, job match, and pivot role, include a "search_url" field:
https://www.naukri.com/jobs-in-{city-lowercase}?k={role-keywords-plus-separated}&experience={years}
Examples:
- https://www.naukri.com/jobs-in-hyderabad?k=head+demand+generation&experience=10
- https://www.naukri.com/jobs-in-mumbai?k=marketing+director+saas&experience=12
Do NOT use role slugs in the path. Use ONLY /jobs-in-{city}?k={keywords} format.

CROSS-CARD NARRATIVE CONTINUITY (CRITICAL — makes the report feel coherent, not disconnected):
The 7 cards must form ONE story, not 7 separate reports. Apply these links:

1. The skill named as the biggest threat in card1_risk.fear_hook MUST appear in card3_shield.skills as "critical-gap" or "buildable"
2. The moat skill named in card1_risk.hope_bridge MUST appear in card3_shield.skills as "best-in-class" or "strong"
3. The #1 pivot in card4_pivot.pivots[0] MUST directly reference skills from card3_shield.skills that are "strong" or "best-in-class"
4. The job searches in card5_jobs MUST be in the same city/region as card2_market references
5. card6_blindspots.blind_spots[0] (the most critical) MUST be the logical consequence of the gap identified in card1_risk.confrontation
6. card7_human.advantages MUST reference the same specific skills as card3_shield.skills (level: best-in-class or strong)
7. card7_human.twenty_four_hour_mission.action MUST be the immediate first step toward card4_pivot.pivots[0]

The reader should feel: "everything I'm reading is about ME specifically" not "this could apply to any professional."

OUTPUT: Return ONLY a valid JSON object. No markdown fences. Start with {`;
}

// ═══════════════════════════════════════════════════════════════
// USER PROMPT — Full Schema with Psychology Fields
// ═══════════════════════════════════════════════════════════════
function buildUserPrompt(resumeText: string, userCity: string, liveJobsContext = "", detectedRole = "", detectedIndustry = ""): string {
  const cityInstruction = userCity === "India"
    ? "Location unknown. Use 'India' as location. Do not default to any specific city. Show companies from multiple Indian metros."
    : `The user is based in ${userCity}. Prioritize companies and job matches in ${userCity} and nearby metros. Only use Bangalore/Mumbai if the user is actually located there.`;

  const roleCtx = detectedRole ? `\nDETECTED ROLE: ${detectedRole}${detectedIndustry ? ` | INDUSTRY: ${detectedIndustry}` : ""}\nCalibrate ALL salary bands, skill threats, and pivot paths to this specific role. Do NOT use Marketing/generic bands unless this IS a marketing role.` : "";
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return `Analyse this resume for the Indian job market in ${monthYear}. Apply the FULL psychological framework.${roleCtx}

RESUME:
${resumeText}

USER LOCATION: ${userCity}
${cityInstruction}

INDIA MARKET CONTEXT — April 2026 (cite these specific numbers in your analysis):
MACRO (cite ONLY when claim is traceable to this block):
- [WEF Future of Jobs 2025]: 63 of every 100 Indian workers will need retraining by 2030; an additional 12 in 100 are unlikely to successfully upskill (70M+ workers).
- [NASSCOM-BCG 2024]: AI engineering roles in India grew 67% YoY; overall AI/ML jobs grew 15%+ in past twelve months. AI talent demand projected at 15% CAGR through 2027.
- [Deloitte State of AI in the Enterprise 2026]: 40% of Indian respondents report significant or full enterprise AI use, versus 28% globally — India ranks first among 15 countries surveyed.

SALARY BANDS BY ROLE — India 2026 (use the band matching the user's actual role):
Engineering roles: SWE L2 ₹12-22L | SWE L3 ₹20-38L | Staff/Principal ₹40-70L | EM ₹35-60L | VP Eng ₹60-110L
Product roles: APM ₹12-22L | PM ₹20-40L | Senior PM ₹35-60L | Director PM ₹55-90L | CPO ₹80-150L
Data roles: Data Analyst ₹8-18L | Senior DA ₹18-32L | Data Scientist ₹22-45L | ML Eng ₹30-60L | Head Data ₹55-90L
Marketing roles: Marketing Manager ₹12-22L | Head Demand Gen ₹22-35L | VP Marketing ₹35-60L | CMO ₹50-90L
Finance roles: CA/CFA ₹10-20L | Finance Manager ₹18-32L | CFO ₹50-100L
Design roles: UI/UX Designer ₹8-18L | Senior Designer ₹18-32L | Design Lead ₹28-50L
Operations/BPO: Ops Analyst ₹6-14L | Team Lead ₹12-22L | Ops Manager ₹18-32L
Sales roles: SDR ₹8-16L | Account Executive ₹16-30L | Enterprise AE ₹28-55L | Sales Director ₹45-80L

KEY INSIGHT: Use the band that matches the user's ACTUAL role extracted from their resume. Do NOT default to Marketing bands for non-marketing profiles.

HIRING SIGNALS — India April 2026:
- Naukri active job postings: 2.1M total, 340K+ tech roles
- LinkedIn India job postings: up 12% QoQ in tech, down 8% in traditional analyst roles
- Most in-demand: AI/ML (67% growth), Cloud Architecture (42% growth), Product Management (28% growth)
- Declining demand: Manual QA testing (-31%), Basic data entry (-45%), Traditional copywriting (-38%)

PSYCHOLOGICAL CALIBRATION:
- This person is likely feeling anxious about AI disruption — validate that anxiety, then channel it into action
- Use loss aversion: frame everything as "what you lose" not "what you gain"
- Be specific with confrontations — generic advice ("upskill") is useless and patronizing
- The tone should feel like a brutally honest senior mentor who genuinely cares — not a corporate HR bot

SENIORITY-CALIBRATED FEAR TRIGGERS (apply based on detected role seniority):
- ENTRY (0-3 yrs): Fear = "starting irrelevant" — "You haven't built a moat yet. That's fine. But the window is 18 months."
- PROFESSIONAL (3-7 yrs): Fear = "being leapfrogged" — "Juniors with AI tools are doing what took you 3 years to learn. Speed is now the moat."
- MANAGER (7-12 yrs): Fear = "becoming a middle-management cost centre" — "Your team size doesn't protect you. AI can manage a team of 5. What makes YOU the manager?"
- SENIOR_LEADER (12-20 yrs): Fear = "experience devaluing faster than expected" — "20 years of pattern recognition is your edge. But only if the patterns still apply."  
- EXECUTIVE (20+ yrs): Fear = "board-level irrelevance" — "Your network is your moat, not your title. AI will be in every boardroom by 2027."

CITY-SPECIFIC TONE (apply based on user's city):
- Bangalore: High-tech audience. They know the tools. Don't explain what GPT-4 is. Assume fluency.
- Mumbai: Finance/media/consumer. ₹ framing lands harder. Career capital and brand matter more.
- Delhi/NCR: Government/PSU/startup mix. Regulatory moat and stability framing resonates.
- Hyderabad: IT services heavy. "Your current employer will automate this role first" hits harder here.
- Pune: Manufacturing + IT services. Practical upskilling angle over status signalling.
- Tier-2 cities (Ahmedabad, Jaipur, Indore etc): Remote-first opportunity framing — "geography is no longer a ceiling."

Return a JSON object with EXACTLY these top-level keys:
user, risk_score, shield_score, ats_avg, jobbachao_score, card1_risk, card2_market, card3_shield, card4_pivot, card5_jobs, card6_blindspots, card7_human

user: { name: string, current_title: string, years_experience: string, location: string, availability: string, education: string, companies: string[] }

risk_score: integer 0-100
shield_score: integer 0-100
ats_avg: integer 0-100 OR null (set to null — no real JD corpus available yet; do NOT fabricate)
jobbachao_score: integer 0-100

card1_risk: {
  headline: string (max 8 words — personalised, provocative, present tense),
  subline: string (statement — acknowledge tenure, then observe current shift. Example: "15 years of enterprise consulting. The delivery layer of your work is shifting to AI-first." — NOT prediction-based),
  fear_hook: string (2 SHORT sentences, max 35 words total. First sentence names 2-3 specific tools or market movements CURRENTLY doing the user's billable work — present-tense observation only. No absolute-date predictions. No "your employer will know" phrasing. No jargon from the MBA-speak ban list above. See VOICE GUIDE Rule 2 + the guidance block above.),
  tough_love: string (2 SHORT sentences, max 30 words total. First: acknowledge what the user built over their years in the field. Second: name the current shift and how their billable work relates. NEVER assume a specific duration of future career (no "the next X years will reward…"). Match tone to risk_score. See VOICE GUIDE Rule 4 + Rule 8.),
  hope_bridge: string (1-2 sentences, max 25 words total. Point to ONE specific asset from the user's resume. Explain why it's defensible with evidence-based reasoning — NOT "AI cannot replicate" absolutes. Prefer: "AI can't synthesize [specific thing they have done repeatedly across years]." See VOICE GUIDE Rule 7.),
  confrontation: string (3 short sentences. End with a specific action: "Fix that this week. One case study. One number. One outcome you own." — never end with a question),
  emotion_message: string (combine fear_hook + hope_bridge for backward compatibility),
  risk_score: integer,
  india_average: integer OR null (ONLY populate if a real role-level benchmark value is provided in the INDIA MARKET FACTS context above; otherwise null. Do NOT invent or estimate.),
  disruption_year: string (e.g. "2027"),
  protective_skills_count: integer,
  cost_of_inaction: {
    annual_gap_pct: string (percentage of package left on table annually, e.g. "10-15% of package"),
    six_month_gap_pct: string (percentage earning power lost in 6 months, e.g. "5-8% earning power"),
    decay_narrative: string (2 SHORT sentences — what happens in 6 months. Use percentages not absolute ₹ amounts. You do NOT know their salary.)
  },
  tasks_at_risk: string[] (exactly 5),
  tasks_safe: string[] (exactly 5),
  ats_scores: null (set to literal JSON null — no real JD-matching corpus available; Day 3 pipeline will repopulate. Do NOT fabricate company names, role titles, city tags, search_urls, or percentage scores.),
  ats_missing_keywords: string[] (exactly 5 — keywords extracted from the USER'S actual resume vs. common senior role JDs in their function; these are allowed because they come from real resume content),
  india_data_insight: string (3 SHORT sentences using WEF + their situation, present tense)
}

card2_market: {
  headline: string (max 8 words — name the industry, present tense),
  subline: string (statement with ₹ amount or % change — "₹18-28L roles growing 23% in Bangalore"),
  fear_hook: string (2 SHORT sentences — name the city, the % direction, the ₹ impact),
  tough_love: string (1 sentence — name what they're missing in ₹ terms),
  hope_bridge: string (1 sentence — name their specific positioning advantage),
  confrontation: string (1 sentence — end with one action this week),
  emotion_message: string,
  salary_bands: [
    { role: string, range: string (₹ LPA — specific numbers like "₹18-28L"), color: "navy"|"green"|"amber"|"red", bar_pct: integer 20-100 }
  ] (exactly 6 — include their current role, show aspirational roles FIRST to anchor high),
  key_insight: string (3 SHORT sentences — name the city, the ₹ amount, their specific achievement. No "competitive" — use numbers),
  market_quote: string (short, punchy), market_quote_source: string
}

card3_shield: {
  headline: string (max 8 words — name their top protective skill),
  subline: string (statement — "[skill] keeps you employed. Here's how long."),
  fear_hook: string (2 SHORT sentences — name the gap skill, how long before it matters),
  tough_love: string (1 sentence — "Learn [skill] in 30 days. After that, it costs you ₹4L/year."),
  hope_bridge: string (1 sentence — "[skill name] is your shield. It protects you until [year]."),
  confrontation: string (1 sentence — "This week: [one specific action]. Not three. One."),
  emotion_message: string,
  shield_score: integer, green_arc_pct: integer, amber_arc_pct: integer,
  badge_text: string,
  shield_body: string (2 SHORT sentences — name skills by name, state protection years),
  skills: [ { name: string, level: "best-in-class"|"strong"|"buildable"|"critical-gap", note: string (max 8 words — "Protects until 2029" or "Learn in 30 days") } ] (8-12 skills),
  upgrade_path: string (2 SHORT sentences — "This week: [action]. Result: [outcome].")
}

card4_pivot: {
  headline: string (max 8 words — present tense, name the direction),
  subline: string (statement — "₹8L more per year. Here's the route."),
  fear_hook: string (2 SHORT sentences — timeline and ₹ cost of staying),
  tough_love: string (1 sentence — name the transferable skill),
  hope_bridge: string (1 sentence — "[Role] pays ₹X-XL in [City]. You're 3 months away."),
  confrontation: string (1 sentence — end with one action),
  emotion_message: string,
  current_band: string (₹ LPA), pivot_year1: string (₹ LPA), director_band: string (₹ LPA),
  pivots: [
    { role: string (CLEAN searchable job title — e.g. "Marketing Director SaaS", never include company name or region), salary: string (₹ LPA with city), salary_range: string, match_pct: integer, why_fit: string (1 SHORT sentence naming transferable skill), color: "green"|"navy"|"teal", match_label: string (time-to-offer: "3-6 months"), location: string (city name only), search_url: string,
      fomo_signal: string (specific with numbers) }
  ] (exactly 4),
  pivot_explanations: [ { title: string, body: string (2 SHORT sentences) } ] (exactly 4),
  negotiation: {
    intro: string (1 SHORT sentence),
    open_with: string (₹ amount), accept: string, walk_away: string, best_case: string,
    pivot_phrase: string (one-liner with their specific metric)
  },
  community_quote: string, community_quote_source: string
}

card5_jobs: {
  headline: string (max 8 words — present tense. Do NOT embed a numeric count in the headline; counts are unavailable until Day 3 pipeline),
  subline: string (statement — "Your [skill] matches 4 of these searches."),
  fear_hook: string (2 SHORT sentences — urgency with numbers),
  tough_love: string, hope_bridge: string (1 sentence — name their specific fit),
  emotion_message: string,
  active_count: integer OR null (set to null — we have no live Naukri API feed; do NOT estimate or fabricate counts),
  senior_count: integer OR null, strong_match_count: integer OR null (both null by default; Day 3 pipeline will populate),
  job_matches: [
    {
      role: string (descriptive search title — e.g. "Senior Marketing Manager roles in Hyderabad"; if a LIVE listing was provided above, use its EXACT title),
      company: string (if listing has a real company name use it; otherwise "Naukri Search" or "Executive Search" — never invent),
      salary: string (salary range from listing OR AmbitionBox data, e.g. "₹18-28L"; if unknown use "Market rate"),
      location: string (city name only),
      match_color: "green"|"navy"|"amber",
      match_label: string (e.g. "Verified live · Naukri" if from listing, else "~340 active listings"),
      match_pct: integer 0-100 (computed from skill overlap with this role),
      why_fit: string (1 SHORT sentence using their actual moat skill),
      tags: string[] (3 skill tags from the user's profile that match this search),
      apply_evidence: string (1 sentence — why this search/role is curated for them),
      company_context: string ("Verified live listing" if verified_live=true, else "Live Naukri search curated for your profile"),
      urgency_narrative: string (2 SHORT sentences — why act NOW),
      verified_live: boolean (true ONLY if this entry came from the LIVE JOB LISTINGS context above; false for AI-suggested searches),
      search_url: string (if verified_live=true MUST be the EXACT URL from the listings above; otherwise a real Naukri search URL: https://www.naukri.com/jobs-in-{city-lowercase}?k={role-keywords-plus-separated}&experience={years})
    }
  ] (exactly 5 — prefer verified_live entries first; remaining slots fill with curated SEARCH URLs that link to hundreds of real, current listings.)
}

card6_blindspots: {
  headline: string (max 8 words — direct),
  subline: string (statement — "3 gaps. All fixable. Start with #1."),
  fear_hook: string (2 SHORT sentences — name the gap costing them most in ₹),
  tough_love: string, hope_bridge: string, confrontation: string (end with one action),
  emotion_message: string,
  blind_spots: [
    { 
      number: integer, title: string (specific — "P&L ownership" not "leadership skills"),
      body: string (2 SHORT sentences — cost + who has it),
      fix: string (one action, one week),
      severity: "CRITICAL"|"SERIOUS"|"MODERATE",
      peer_benchmark: string (qualitative comparison only, e.g. "Common gap at Senior Manager tier" — NEVER include invented percentages),
      resource_url: string
    }
  ] (exactly 4),
  interview_prep: [
    { 
      question: string, framework: string,
      answer: string (STAR format, their actual metrics, 3-4 SHORT sentences, present tense),
      star_labels: string[],
      psychological_hook: string (1 SHORT sentence)
    }
  ] (exactly 5)
}

card7_human: {
  headline: string (max 8 words — name their edge),
  subline: string (statement — "AI does execution. You do [their thing]."),
  fear_hook: string (1 SHORT sentence — urgency),
  tough_love: string, hope_bridge: string (1 sentence — name their #1 irreplaceable skill),
  emotion_message: string,
  advantages: [
    { title: string, body: string (2 SHORT sentences — ₹ or months impact), proof_label: string, icon_type: "revenue"|"people"|"globe"|"shield", score: integer 60-98 }
  ] (exactly 5),
  insights: string[] (exactly 5 — SHORT, max 15 words each),
  score_tags: string[] (4 tags),
  manifesto: string (3 SHORT sentences — name achievements, present tense, end on next action),
  twenty_four_hour_mission: {
    action: string (ONE action — name the tool, skill, output),
    why: string (1 SHORT sentence — ₹ or timeline impact),
    expected_result: string (specific with ₹ number)
  },
  whatsapp_message: string,
  score_card_text: string
}
${liveJobsContext}`;
}
