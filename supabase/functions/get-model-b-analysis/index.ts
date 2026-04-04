import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-3-flash-preview";
const LAST_RESORT_MODEL = "google/gemini-2.5-pro";
const MAX_RETRIES = 3;
const AI_TIMEOUT_MS = 55_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { analysis_id, user_id, resume_filename } = body;

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

    // ─── Step 1: Check cache ───
    const { data: cached } = await supabase
      .from("model_b_results")
      .select("*")
      .eq("analysis_id", analysis_id)
      .not("card_data", "is", null)
      .maybeSingle();

    if (cached?.card_data && Object.keys(cached.card_data as object).length > 5) {
      console.log(`[model-b] Cache hit for ${analysis_id} (${Date.now() - startTime}ms)`);
      return new Response(
        JSON.stringify({ success: true, data: cached }),
        { headers: jsonHeaders }
      );
    }

    // ─── Step 2: Get resume text from scans table ───
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

    // ─── Step 3: Call AI with retry + fallback ───
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 503, headers: jsonHeaders }
      );
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(resumeText);

    let cardData: Record<string, unknown> | null = null;
    let geminiRaw: unknown = null;
    let modelUsed = PRIMARY_MODEL;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const model = attempt === 0 ? PRIMARY_MODEL : attempt === 1 ? FALLBACK_MODEL : LAST_RESORT_MODEL;
      modelUsed = model;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        const aiResponse = await fetch(AI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit reached. Please try again in a minute." }),
            { status: 429, headers: jsonHeaders }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ success: false, error: "AI credits exhausted. Please try again later." }),
            { status: 402, headers: jsonHeaders }
          );
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

        // Validate critical fields
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
      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed after retries. Please try again." }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // ─── Step 4: Insert into model_b_results ───
    const insertPayload = {
      analysis_id,
      user_id,
      gemini_raw: geminiRaw,
      risk_score: (cardData.risk_score as number) ?? 55,
      shield_score: (cardData.shield_score as number) ?? 60,
      ats_avg: (cardData.ats_avg as number) ?? 60,
      job_match_count: (cardData.card5_jobs as any)?.job_matches?.length ?? 5,
      resume_filename: resume_filename ?? "Your Resume",
      card_data: cardData,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("model_b_results")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      console.error("[model-b] Insert error:", insertError);
      // Return data even if DB save fails
      return new Response(
        JSON.stringify({ success: true, data: { ...insertPayload, id: crypto.randomUUID() } }),
        { headers: jsonHeaders }
      );
    }

    console.log(`[model-b] Complete: ${analysis_id} model=${modelUsed} time=${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ success: true, data: inserted }),
      { headers: jsonHeaders }
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
  // Strategy 1: Direct parse
  try { return JSON.parse(rawText); } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  const stripped = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
  try { return JSON.parse(stripped); } catch { /* continue */ }

  // Strategy 3: Extract first complete JSON object
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }
  }

  throw new Error("Could not parse AI response as JSON");
}

// ═══════════════════════════════════════════════════════════════
// Output validation — ensures critical card data is present
// ═══════════════════════════════════════════════════════════════
function validateCardData(data: Record<string, unknown>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const requiredKeys = ["card1_risk", "card2_market", "card3_shield", "card4_pivot", "card5_jobs", "card6_blindspots", "card7_human"];
  for (const key of requiredKeys) {
    if (!data[key]) issues.push(`Missing ${key}`);
  }

  // Validate card5 has job_matches array
  const c5 = data.card5_jobs as any;
  if (c5 && (!Array.isArray(c5.job_matches) || c5.job_matches.length < 3)) {
    issues.push("card5_jobs.job_matches must have at least 3 items");
  }

  // Validate card6 has interview_prep
  const c6 = data.card6_blindspots as any;
  if (c6 && (!Array.isArray(c6.interview_prep) || c6.interview_prep.length < 3)) {
    issues.push("card6_blindspots.interview_prep must have at least 3 items");
  }

  // Validate card7 has advantages
  const c7 = data.card7_human as any;
  if (c7 && (!Array.isArray(c7.advantages) || c7.advantages.length < 3)) {
    issues.push("card7_human.advantages must have at least 3 items");
  }

  // Validate scores are reasonable numbers
  const riskScore = Number(data.risk_score);
  if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
    issues.push(`Invalid risk_score: ${data.risk_score}`);
  }

  return { valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════
// System prompt — expert-grade persona with guardrails
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

OUTPUT: Return ONLY a valid JSON object. No markdown fences, no commentary, no preamble. Start with {`;
}

// ═══════════════════════════════════════════════════════════════
// User prompt — structured analysis request with schema
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
    { company: string (real Indian B2B SaaS), role: string (senior title matching their profile), score: integer 40-95, color: "green"|"amber"|"red" },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red" },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red" }
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
  free_resources: [ { skill: string, resource: string, url: string, cost: "Free" } ] (3-5 India-accessible resources for their gaps)
}

card4_pivot: {
  headline: string, subline: string, emotion_message: string,
  current_band: string (₹ LPA), pivot_year1: string (₹ LPA), director_band: string (₹ LPA),
  pivots: [
    { role: string, match_pct: integer, salary_range: string, location: string, color: "navy"|"green"|"teal", match_label: string (e.g. "92% match"), is_recommended: boolean }
  ] (exactly 3 pivot roles with realistic skill overlap),
  pivot_explanations: [ { title: string, body: string (3-4 sentences with evidence) } ] (exactly 3 — one per pivot),
  negotiation: {
    intro: string (personalised to their profile),
    walk_away: string (₹ LPA), accept: string (₹ LPA), open_with: string (₹ LPA), best_case: string (₹ LPA)
  },
  community_quote: string (relevant industry wisdom), community_quote_source: string
}

card5_jobs: {
  headline: string, subline: string, emotion_message: string,
  active_count: integer (realistic number 20-80), senior_count: integer, strong_match_count: integer,
  job_matches: [
    {
      company: string (real Indian company actively hiring), role: string, location: string,
      match_pct: integer 60-95, match_label: string (e.g. "Strong match"), match_color: "green"|"navy"|"amber",
      salary: string (₹ LPA), company_context: string (1 sentence — why this company is relevant to their profile),
      tags: string[] (exactly 4 skill/industry tags),
      days_posted: integer 1-14, applicant_count: integer 20-200, is_urgent: boolean,
      why_fit: string (1 sentence — why their specific experience makes them a strong candidate),
      apply_evidence: string (detailed paragraph using their specific metrics and achievements that they should lead with in an application to this company)
    }
  ] (EXACTLY 5 items using real Indian B2B SaaS or tech companies currently hiring),
  remote_insight: string
}

card6_blindspots: {
  headline: string, subline: string, emotion_message: string,
  blind_spots: [
    { number: 1, title: string, body: string (specific to their resume — what's missing and why it matters), fix: string (actionable fix in under 10 words) },
    { number: 2, title: string, body: string, fix: string },
    { number: 3, title: string, body: string, fix: string }
  ],
  interview_prep: [
    { question: string (role-specific behavioral question), framework: string (e.g. "STAR Method"), answer: string (full answer using their actual resume achievements — 150+ words), star_labels: string[] (4 labels: Situation, Task, Action, Result) },
    { question: string, framework: string, answer: string, star_labels: string[] },
    { question: "What is your salary expectation?", framework: "Negotiation script — state it and stop talking", answer: string (using their calculated salary anchor), star_labels: [] },
    { question: string, framework: string, answer: string, star_labels: string[] },
    { question: string, framework: "Thought leadership answer", answer: string (demonstrating industry expertise), star_labels: [] }
  ] (EXACTLY 5 items)
}

card7_human: {
  headline: string, subline: string, emotion_message: string,
  insights: string[] (EXACTLY 5 strings, each 2-3 sentences using specific resume data — not generic career advice),
  advantages: [
    { title: string, body: string (2-3 sentences with specific evidence), proof_label: string (one-line credential e.g. "₹3 CPL across 50L+ spend"), icon_type: "revenue"|"people"|"globe"|"shield" },
    { title: string, body: string, proof_label: string, icon_type: string },
    { title: string, body: string, proof_label: string, icon_type: string },
    { title: string, body: string, proof_label: string, icon_type: string }
  ] (EXACTLY 4 items — each must reference a quantified achievement from the resume),
  score_tags: string[] (EXACTLY 3 short tags summarising their strengths),
  whatsapp_message: string (Hinglish, starts with "Maine JobBachao pe apna career check kiya..."),
  linkedin_message: string (professional English, under 200 words, references their top 2 credentials),
  score_card_text: string (4 lines: name + score, top 2 credentials, jobbachao.com)
}

ABSOLUTE RULES:
1. Every field must use specific data from the resume — NEVER generic copy. If the resume says "reduced CPL to ₹3", use "₹3 CPL" in multiple cards.
2. All salary figures in ₹ LPA format
3. job_matches must contain EXACTLY 5 items using real Indian companies
4. interview_prep must contain EXACTLY 5 items
5. advantages must contain EXACTLY 4 items
6. insights must contain EXACTLY 5 strings
7. Return ONLY the JSON object — start with { and end with }
8. Score calibration: risk_score should be relative to 61 (India average). A senior strategist with proven metrics should be 45-55. An execution-heavy role should be 65-75.
9. The why_fit field in job_matches is REQUIRED — it powers the clickable job links`;
}
