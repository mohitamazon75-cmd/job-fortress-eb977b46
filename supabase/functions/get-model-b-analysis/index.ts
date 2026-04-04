import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "google/gemini-2.5-flash";
const MAX_RETRIES = 3;
const AI_TIMEOUT_MS = 90_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { analysis_id, user_id, resume_filename, poll } = body;

    if (!analysis_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id and user_id are required" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Check cache / completed results ───
    const { data: cached } = await supabase
      .from("model_b_results")
      .select("*")
      .eq("analysis_id", analysis_id)
      .not("card_data", "is", null)
      .maybeSingle();

    if (cached?.card_data && Object.keys(cached.card_data as object).length > 5) {
      console.log(`[model-b] Cache hit for ${analysis_id}`);
      return new Response(
        JSON.stringify({ success: true, data: cached }),
        { headers: jsonHeaders }
      );
    }

    // ─── If polling, check if processing is in progress ───
    if (poll) {
      // Check if there's a pending row (card_data is null = still processing)
      const { data: pending } = await supabase
        .from("model_b_results")
        .select("id, card_data")
        .eq("analysis_id", analysis_id)
        .maybeSingle();

      if (pending && !pending.card_data) {
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
      // No row exists yet — tell client to trigger the job
      return new Response(
        JSON.stringify({ success: true, status: "not_started" }),
        { headers: jsonHeaders }
      );
    }

    // ─── Get resume text from scans table ───
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("*")
      .eq("id", analysis_id)
      .maybeSingle();

    if (scanError || !scan) {
      return new Response(
        JSON.stringify({ success: false, error: "Analysis not found" }),
        { status: 404, headers: jsonHeaders }
      );
    }

    const resumeText = extractResumeText(scan);

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

    // ─── Create placeholder row to signal "processing" ───
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
      }, { onConflict: "analysis_id" })
      .select()
      .single();

    // ─── Launch background AI processing ───
    const processPromise = processAnalysis(
      supabase, LOVABLE_API_KEY, analysis_id, user_id,
      resume_filename, resumeText
    );

    // Use EdgeRuntime.waitUntil if available (keeps function alive after response)
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(processPromise);
      console.log(`[model-b] Background processing started for ${analysis_id}`);
      return new Response(
        JSON.stringify({ success: true, status: "processing", message: "Analysis started" }),
        { headers: jsonHeaders }
      );
    }

    // Fallback: wait synchronously (less ideal but still works)
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
// Background AI processing — runs after response is sent
// ═══════════════════════════════════════════════════════════════
async function processAnalysis(
  supabase: any,
  apiKey: string,
  analysisId: string,
  userId: string,
  resumeFilename: string,
  resumeText: string,
): Promise<any> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(resumeText);

  let cardData: Record<string, unknown> | null = null;
  let geminiRaw: unknown = null;
  let modelUsed = PRIMARY_MODEL;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const model = attempt < 2 ? PRIMARY_MODEL : FALLBACK_MODEL;
    modelUsed = model;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const aiResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.25,
          max_tokens: 10000,
          response_format: { type: "json_object" },
        }),
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

  // ─── Save completed results ───
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
    .select("*")
    .single();

  if (updateErr) {
    console.error("[model-b] Update error:", updateErr);
    // Try insert as fallback
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
  // Delete the placeholder so client knows it failed
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
// AI Response parsing with multiple fallback strategies
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
// System prompt
// ═══════════════════════════════════════════════════════════════
function buildSystemPrompt(): string {
  return `You are JobBachao's career intelligence engine — a senior career strategist with 20 years of experience in Indian B2B technology hiring, compensation benchmarking, and AI disruption forecasting.

ROLE: Produce a comprehensive, deeply personalised career analysis by extracting every quantifiable achievement, skill signal, and career pattern from the resume. Your output directly populates 7 interactive dashboard cards.

THINKING PROCESS (follow this order):
1. EXTRACT: Pull every number, metric, company, tool, certification, and time period from the resume
2. CALIBRATE: Benchmark against Indian market data for their specific role + seniority + industry
3. SCORE: Calculate risk and shield scores using the evidence framework below
4. PERSONALISE: Every field must reference specific data from THIS resume — zero generic copy

SCORING FRAMEWORK:
- risk_score: Weight automation exposure (40%) + market demand trajectory (25%) + skill moat depth (20%) + seniority protection (15%). India B2B marketing manager average is 61.
- shield_score: Count of demonstrably AI-proof skills + leadership evidence + cross-functional scope + unique domain expertise
- ats_avg: Simulate keyword matching against 3 real senior India B2B SaaS job descriptions
- jobbachao_score: Inverse of risk weighted by shield strength. Formula: 100 - (risk_score × (1 - shield_score/200))

EVIDENCE RULES:
- Every claim must trace to a specific resume line or quantified achievement
- Salary figures always in ₹ LPA format
- Job matches must use real Indian companies with realistic current openings
- Interview answers must use STAR framework with the candidate's actual metrics
- Never use phrases like "your resume shows" — state evidence directly

IMPORTANT — LIVE LINKS: For every ATS score entry and every job match, include a "search_url" field with a working Naukri search URL in this format:
https://www.naukri.com/{role-slug}-jobs-in-{city}?k={role}+{company}
Example: https://www.naukri.com/head-of-demand-gen-jobs-in-bangalore?k=Head+of+Demand+Gen+Freshworks

OUTPUT: Return ONLY a valid JSON object. No markdown fences, no commentary, no preamble. Start with {`;
}

// ═══════════════════════════════════════════════════════════════
// User prompt
// ═══════════════════════════════════════════════════════════════
function buildUserPrompt(resumeText: string): string {
  return `Analyse this resume for the Indian job market in April 2026.

RESUME:
${resumeText}

INDIA MARKET CONTEXT (embed these in your analysis — cite specific numbers):
- India B2B SaaS market: $16.5B (2026), growing 26% CAGR
- AI automation risk average for Indian B2B marketing managers: 61%
- Average CPL India B2B: ₹800–₹2,000. Sub-₹100 CPL is exceptional (80x+ efficient)
- Salary bands India 2026: Marketing Manager (10+ yrs) ₹18-28 LPA, Head of Demand Gen ₹22-35 LPA, VP Marketing ₹30-50 LPA, CMO ₹45-80 LPA
- Top hiring B2B SaaS India 2026: Freshworks (Bangalore, 16% YoY, IPO), Chargebee (Bangalore, Series G), Zoho (Chennai/Remote, 100M+ users), BrowserStack (Mumbai, $200M+ ARR), Sarvam AI (Bangalore, Series B), Postman (Bangalore, 30M+ devs), Razorpay (Bangalore, profitable)
- WEF: 63 of every 100 Indian workers need retraining by 2030
- Cloud9 Digital India 2026: 67% agencies hiring strategists over executors
- LinkedIn India: 45% increase in "AI + Marketing" job postings YoY

Return a JSON object with EXACTLY these top-level keys:
user, risk_score, shield_score, ats_avg, jobbachao_score, card1_risk, card2_market, card3_shield, card4_pivot, card5_jobs, card6_blindspots, card7_human

user: { name: string, current_title: string, years_experience: string, location: string, availability: string, education: string, companies: string[] }

risk_score: integer 0-100 (calibrate relative to India average of 61)
shield_score: integer 0-100
ats_avg: integer 0-100 (average ATS match against 3 senior India B2B SaaS JDs)
jobbachao_score: integer 0-100

card1_risk: {
  headline: string (personalised with their actual job title and seniority — max 8 words),
  subline: string (specific to their situation — reference a credential),
  emotion_message: string (2-3 sentences, warm, references their specific years + company + one metric),
  risk_score: integer,
  india_average: 61,
  disruption_year: string (e.g. "2027-28"),
  protective_skills_count: integer,
  tasks_at_risk: string[] (exactly 5 specific tasks from their resume that AI tools like Jasper/Copy.ai/Midjourney can already do),
  tasks_safe: string[] (exactly 5 specific tasks from their resume requiring human judgment, relationships, or strategic thinking),
  ats_scores: [
    { company: string (real Indian B2B SaaS), role: string (senior title matching their profile), score: integer 40-95, color: "green"|"amber"|"red", search_url: string (working Naukri search URL for this company+role+city) },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red", search_url: string },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red", search_url: string }
  ],
  ats_missing_keywords: string[] (exactly 5 high-value keywords missing from their resume — specific to their target roles),
  india_data_insight: string (3 sentences combining WEF data + Cloud9 survey + their specific situation)
}

card2_market: {
  headline: string, subline: string, emotion_message: string,
  salary_bands: [
    { role: string, range: string (₹ LPA format), color: "navy"|"green"|"amber"|"red", bar_pct: integer 20-100 }
  ] (exactly 6 roles from their current level through aspirational — include their exact current role),
  key_insight: string (3-4 sentences using their specific achievements to justify positioning),
  market_quote: string (industry insight), market_quote_source: string
}

card3_shield: {
  headline: string, subline: string, emotion_message: string,
  shield_score: integer, green_arc_pct: integer, amber_arc_pct: integer,
  badge_text: string (e.g. "Top 15% for role"),
  shield_body: string (2 sentences explaining their shield strength with evidence),
  skills: [ { name: string, level: "best-in-class"|"strong"|"buildable"|"critical-gap", note: string } ] (8-12 skills extracted from resume),
  upgrade_path: string (2 sentences — specific recommendation based on their actual skill gaps)
}

card4_pivot: {
  headline: string, subline: string, emotion_message: string,
  pivots: [
    { role: string, salary: string (₹ LPA), match_pct: integer 50-95, why_fit: string (reference their specific experience), search_url: string (working Naukri search URL) }
  ] (exactly 4 pivot roles with ascending salary),
  negotiation: {
    open_with: string (₹ LPA anchor), pivot_phrase: string (one-liner referencing their metrics), walk_away: string (₹ LPA floor)
  }
}

card5_jobs: {
  headline: string, subline: string, emotion_message: string,
  active_count: integer, senior_count: integer, strong_match_count: integer,
  job_matches: [
    {
      company: string (real Indian company), role: string, salary: string (₹ LPA), location: string,
      match_color: "green"|"navy"|"amber", match_label: string, why_fit: string,
      tags: string[] (3-4 relevant tags), days_posted: integer 1-14, applicant_count: integer,
      is_urgent: boolean, apply_evidence: string (2-3 bullet points from their resume proving fit),
      company_context: string (1 sentence about the company's current situation),
      search_url: string (working Naukri search URL for this role+company+city)
    }
  ] (exactly 5 job matches — use real Indian companies)
}

card6_blindspots: {
  headline: string, subline: string, emotion_message: string,
  blind_spots: [ { gap: string, fix: string, resource_url: string (link to a real course/article on Coursera/LinkedIn Learning/UpGrad) } ] (exactly 4),
  interview_prep: [ { question: string, star_answer: string (using their actual metrics in STAR format — 4-5 sentences) } ] (exactly 4)
}

card7_human: {
  headline: string, subline: string, emotion_message: string,
  advantages: [ { label: string, proof_label: string (specific evidence from resume), score: integer 60-98 } ] (exactly 5 — these are skills AI cannot replicate),
  manifesto: string (3 powerful sentences about why this person matters — reference their specific achievements, not generic)
}`;
}
