import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const SECONDARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const MAX_RETRIES = 3;
const AI_TIMEOUT_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { analysis_id, user_id: requestedUserId, resume_filename, poll } = body;

    if (!analysis_id) {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id is required" }),
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

    // ─── Resolve scan + owner up front so published/test flows don't fail on missing client auth ───
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

    const resolvedUserId =
      typeof requestedUserId === "string" && requestedUserId.trim().length > 0
        ? requestedUserId
        : scan.user_id;

    if (!resolvedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not resolve analysis owner" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // ─── If polling, check if processing is in progress ───
    if (poll) {
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
      return new Response(
        JSON.stringify({ success: true, status: "not_started" }),
        { headers: jsonHeaders }
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
        user_id: resolvedUserId,
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
      supabase, LOVABLE_API_KEY, analysis_id, resolvedUserId,
      resume_filename, resumeText
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
): Promise<any> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(resumeText);

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
        temperature: 0.25,
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
  return `You are JobBachao's Psychology-Driven Career Intelligence Engine — combining 20 years of Indian hiring expertise with deep knowledge of behavioral psychology, loss aversion, and dark persuasion patterns.

YOUR DUAL ROLE:
1. ANALYST: Extract every quantifiable achievement, skill signal, and career pattern from the resume
2. PSYCHOLOGIST: Weaponize every insight using specific psychological triggers to MOVE the user to action

═══ PSYCHOLOGICAL FRAMEWORK (Apply to EVERY card) ═══

Each card must follow the FEAR → TOUGH LOVE → HOPE emotional arc:

CARD 1 (Risk Mirror) — PRIMARY TRIGGER: LOSS AVERSION
- Make them FEEL what they're losing by doing nothing
- Calculate exact ₹ cost of inaction (salary gap × months)
- Use peer pressure: "X% of people at your level have already..."
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
- Be BRUTALLY honest. No sugarcoating.
- "Here's what's actually holding you back, and you probably know it"
- Severity levels: Mark each gap as CRITICAL / SERIOUS / MODERATE
- Include: "X% of candidates at your level have this. You don't."

CARD 7 (Human Advantage) — PRIMARY TRIGGER: HOPE ANCHORING + IDENTITY REINFORCEMENT
- After the tough love, deliver powerful hope
- "Here's why YOU specifically will survive what AI cannot touch"
- End with a 24-hour mission — one specific action for TODAY

═══ EMOTIONAL STRUCTURE (Required in EVERY card) ═══

Replace generic "emotion_message" with this 3-part structure:
- fear_hook: The uncomfortable truth they need to hear (2 sentences, specific to their resume)
- tough_love: Direct, no-BS one-liner assessment 
- hope_bridge: Their specific advantage that creates hope (1 sentence)

Also include:
- confrontation: One sentence that directly challenges them based on resume evidence
  Example: "You've managed ₹2Cr budgets but never owned a P&L. That's the gap that keeps you at Manager level."

═══ SCORING FRAMEWORK ═══
- risk_score: Automation exposure (40%) + market demand trajectory (25%) + skill moat depth (20%) + seniority protection (15%)
- shield_score: AI-proof skills + leadership evidence + cross-functional scope + domain expertise
- ats_avg: Simulate keyword matching against 3 real senior India B2B SaaS job descriptions
- jobbachao_score: 100 - (risk_score × (1 - shield_score/200))

═══ EVIDENCE RULES ═══
- Every claim must trace to a specific resume line or quantified achievement
- Salary figures always in ₹ LPA format
- Job matches must use real Indian companies with realistic current openings
- Interview answers must use STAR framework with the candidate's actual metrics
- Never use phrases like "your resume shows" — state evidence directly

═══ LIVE LINKS ═══
For every ATS score entry, job match, and pivot role, include a "search_url" field:
https://www.naukri.com/jobs-in-{city-lowercase}?k={role-keywords-plus-separated}&experience={years}
Examples:
- https://www.naukri.com/jobs-in-bangalore?k=head+demand+generation&experience=10
- https://www.naukri.com/jobs-in-mumbai?k=marketing+director+saas&experience=12
Do NOT use role slugs in the path. Use ONLY /jobs-in-{city}?k={keywords} format.

OUTPUT: Return ONLY a valid JSON object. No markdown fences. Start with {`;
}

// ═══════════════════════════════════════════════════════════════
// USER PROMPT — Full Schema with Psychology Fields
// ═══════════════════════════════════════════════════════════════
function buildUserPrompt(resumeText: string): string {
  return `Analyse this resume for the Indian job market in April 2026. Apply the FULL psychological framework.

RESUME:
${resumeText}

INDIA MARKET CONTEXT (cite specific numbers in your analysis):
- India B2B SaaS market: $16.5B (2026), growing 26% CAGR
- AI automation risk average for Indian professionals: 61%
- Average CPL India B2B: ₹800–₹2,000. Sub-₹100 CPL is exceptional (80x+ efficient)
- Salary bands India 2026: Marketing Manager (10+ yrs) ₹18-28 LPA, Head of Demand Gen ₹22-35 LPA, VP Marketing ₹30-50 LPA, CMO ₹45-80 LPA
- Top hiring B2B SaaS India 2026: Freshworks (Bangalore), Chargebee (Bangalore), Zoho (Chennai/Remote), BrowserStack (Mumbai), Sarvam AI (Bangalore), Postman (Bangalore), Razorpay (Bangalore)
- WEF: 63 of every 100 Indian workers need retraining by 2030
- LinkedIn India: 45% increase in "AI + Marketing" job postings YoY
- Average Indian professional checks career tools after a bad performance review or layoff news

PSYCHOLOGICAL CALIBRATION:
- This person is likely feeling anxious about AI disruption — validate that anxiety, then channel it into action
- Use loss aversion: frame everything as "what you lose" not "what you gain"
- Be specific with confrontations — generic advice ("upskill") is useless and patronizing
- The tone should feel like a brutally honest senior mentor who genuinely cares — not a corporate HR bot

Return a JSON object with EXACTLY these top-level keys:
user, risk_score, shield_score, ats_avg, jobbachao_score, card1_risk, card2_market, card3_shield, card4_pivot, card5_jobs, card6_blindspots, card7_human

user: { name: string, current_title: string, years_experience: string, location: string, availability: string, education: string, companies: string[] }

risk_score: integer 0-100
shield_score: integer 0-100
ats_avg: integer 0-100
jobbachao_score: integer 0-100

card1_risk: {
  headline: string (max 8 words — personalised, provocative),
  subline: string (reference a specific credential),
  fear_hook: string (2 sentences — the uncomfortable truth about their position, using specific data),
  tough_love: string (1 brutal honest sentence — their biggest career weakness),
  hope_bridge: string (1 sentence — their specific advantage that others don't have),
  confrontation: string (1 sentence directly challenging them based on resume evidence),
  emotion_message: string (combine fear_hook + hope_bridge for backward compatibility),
  risk_score: integer,
  india_average: 61,
  disruption_year: string,
  protective_skills_count: integer,
  cost_of_inaction: {
    monthly_loss_lpa: string (₹ LPA they're leaving on table),
    six_month_loss: string (₹ amount),
    peer_gap_pct: string (e.g. "42% of peers have already upskilled"),
    decay_narrative: string (2 sentences — what happens to their score in 6 months if they do nothing)
  },
  tasks_at_risk: string[] (exactly 5),
  tasks_safe: string[] (exactly 5),
  ats_scores: [
    { company: string, role: string, score: integer 40-95, color: "green"|"amber"|"red", city: string, search_url: string },
    { company: string, role: string, score: integer, color: string, city: string, search_url: string },
    { company: string, role: string, score: integer, color: string, city: string, search_url: string }
  ],
  ats_missing_keywords: string[] (exactly 5),
  india_data_insight: string (3 sentences using WEF + their situation)
}

card2_market: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string, confrontation: string,
  emotion_message: string,
  salary_bands: [
    { role: string, range: string (₹ LPA), color: "navy"|"green"|"amber"|"red", bar_pct: integer 20-100 }
  ] (exactly 6 — include their current role, show aspirational roles FIRST to anchor high),
  key_insight: string (3-4 sentences using their achievements to justify positioning),
  market_quote: string, market_quote_source: string
}

card3_shield: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string, confrontation: string,
  emotion_message: string,
  shield_score: integer, green_arc_pct: integer, amber_arc_pct: integer,
  badge_text: string,
  shield_body: string (2 sentences with evidence),
  skills: [ { name: string, level: "best-in-class"|"strong"|"buildable"|"critical-gap", note: string } ] (8-12 skills),
  upgrade_path: string (2 sentences — specific recommendation)
}

card4_pivot: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string, confrontation: string,
  emotion_message: string,
  current_band: string, pivot_year1: string, director_band: string,
  pivots: [
    { role: string, salary: string, match_pct: integer, why_fit: string, color: "green"|"navy"|"teal", match_label: string, location: string, search_url: string,
      fomo_signal: string (e.g. "3 people from your network moved here last quarter") }
  ] (exactly 4),
  negotiation: {
    intro: string,
    open_with: string, accept: string, walk_away: string, best_case: string,
    pivot_phrase: string (one-liner referencing their metrics)
  }
}

card5_jobs: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string,
  emotion_message: string,
  active_count: integer, senior_count: integer, strong_match_count: integer,
  job_matches: [
    {
      company: string, role: string, salary: string, location: string,
      match_color: "green"|"navy"|"amber", match_label: string, why_fit: string,
      tags: string[], days_posted: integer 1-14, applicant_count: integer,
      is_urgent: boolean, apply_evidence: string,
      company_context: string,
      urgency_narrative: string (2 sentences — why they must act NOW, referencing applicant count + their edge),
      search_url: string
    }
  ] (exactly 5)
}

card6_blindspots: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string, confrontation: string,
  emotion_message: string,
  blind_spots: [
    { 
      number: integer, title: string, body: string, fix: string,
      severity: "CRITICAL"|"SERIOUS"|"MODERATE",
      peer_benchmark: string (e.g. "78% of Senior Managers have this skill. You don't."),
      resource_url: string
    }
  ] (exactly 4),
  interview_prep: [
    { 
      question: string, framework: string,
      answer: string (STAR format with their actual metrics, 4-5 sentences),
      star_labels: string[],
      psychological_hook: string (1 sentence — why interviewers ask this and how to psychologically frame the answer)
    }
  ] (exactly 5)
}

card7_human: {
  headline: string, subline: string,
  fear_hook: string, tough_love: string, hope_bridge: string,
  emotion_message: string,
  advantages: [
    { title: string, body: string, proof_label: string, icon_type: "revenue"|"people"|"globe"|"shield", score: integer 60-98 }
  ] (exactly 5),
  insights: string[] (exactly 5 — daily human-edge insights, personal to their career),
  score_tags: string[] (4 tags),
  manifesto: string (3 powerful sentences — why THIS person matters, reference their specific achievements),
  twenty_four_hour_mission: {
    action: string (ONE specific action for TODAY — tied to their #1 advantage),
    why: string (1 sentence — why this specific action matters NOW),
    expected_result: string (what they'll gain from doing this)
  },
  whatsapp_message: string,
  score_card_text: string
}`;
}
