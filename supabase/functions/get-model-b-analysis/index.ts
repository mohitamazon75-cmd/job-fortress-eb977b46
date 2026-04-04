import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { analysis_id, user_id, resume_filename } = await req.json();

    if (!analysis_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    if (cached) {
      return new Response(
        JSON.stringify({ success: true, data: cached }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try final_json_report first, then fall back to any text column
    let resumeText = "";

    // Extract from final_json_report (JSONB)
    if (scan.final_json_report) {
      const report = typeof scan.final_json_report === "string"
        ? JSON.parse(scan.final_json_report)
        : scan.final_json_report;

      // Try common nested paths for resume/profile text
      resumeText =
        report.raw_text ||
        report.resume_text ||
        report.parsed_text ||
        report.profile_text ||
        report.content ||
        "";

      // If no dedicated text field, serialize the whole report as context
      if (!resumeText && Object.keys(report).length > 0) {
        resumeText = JSON.stringify(report);
      }
    }

    // Fallback: try other text columns on the scan row
    if (!resumeText) {
      const textCandidates = [
        scan.role_detected,
        scan.industry,
        scan.years_experience,
        scan.linkedin_url,
      ].filter(Boolean);

      if (textCandidates.length > 0) {
        resumeText = textCandidates.join(" | ");
      }
    }

    if (!resumeText) {
      return new Response(
        JSON.stringify({ success: false, error: "Resume text not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Step 3: Call AI via Lovable AI Gateway ───
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(resumeText);

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an expert career analyst. Return ONLY valid JSON. No markdown fences, no preamble.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[get-model-b-analysis] AI error [${aiResponse.status}]:`, errText.slice(0, 300));

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit reached. Please try again in a minute." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Step 4: Parse response ───
    const geminiData = await aiResponse.json();
    const rawText = geminiData?.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error("AI returned empty response");
    }

    let cardData: Record<string, unknown>;
    try {
      cardData = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI JSON");
      cardData = JSON.parse(match[0]);
    }

    // ─── Step 5: Insert into model_b_results ───
    const insertPayload = {
      analysis_id,
      user_id,
      gemini_raw: geminiData,
      risk_score: (cardData.risk_score as number) ?? 55,
      shield_score: (cardData.shield_score as number) ?? 60,
      ats_avg: (cardData.ats_avg as number) ?? 60,
      job_match_count:
        (cardData.card5_jobs as any)?.job_matches?.length ?? 5,
      resume_filename: resume_filename ?? "Your Resume",
      card_data: cardData,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("model_b_results")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      console.error("[get-model-b-analysis] Insert error:", insertError);
      throw new Error("Failed to save results");
    }

    // ─── Step 6: Return ───
    return new Response(
      JSON.stringify({ success: true, data: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[get-model-b-analysis] error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Prompt builder ───
function buildPrompt(resumeText: string): string {
  return `You are an expert career analyst for the Indian job market in 2026.

Analyse this resume and return ONLY a valid JSON object.
No markdown code fences, no explanation text, only raw JSON starting with {.

RESUME:
${resumeText}

INDIA MARKET CONTEXT (use these in your analysis):
- India B2B average CPL: ₹800–2,000. If their CPL is ₹3, that is 267x more efficient.
- Digital marketing salary bands India 2026: Manager 10+ yrs ₹18-28 LPA, Head of Demand Gen ₹22-35 LPA, VP Marketing ₹30-50 LPA
- AI automation risk average for India B2B marketing managers: 61%
- Top hiring B2B SaaS India 2026: Freshworks (Bangalore, 16% YoY growth), Chargebee (Bangalore, Series G, acquired Inai 2025), Zoho (Chennai/Remote, 100M+ users), BrowserStack (Mumbai/Remote, $200M+ ARR), Sarvam AI (Bangalore, Series B)
- WEF: 63 of every 100 Indian workers need retraining by 2030
- IIM-A: 68% of Indian white-collar workers fear AI automation within 5 years
- Cloud9 Digital India 2026 survey (500+ businesses): 67% agencies hire more strategists, fewer executors

Return a JSON object with EXACTLY these top-level keys:
user, risk_score, shield_score, ats_avg, jobbachao_score, card1_risk, card2_market, card3_shield, card4_pivot, card5_jobs, card6_blindspots, card7_human

user object: { name, current_title, years_experience, location, availability, education, companies: [] }

risk_score: integer 0-100 (India average is 61 — calibrate relative to that)
shield_score: integer 0-100
ats_avg: integer 0-100 (average ATS match against 3 senior India B2B SaaS JDs)
jobbachao_score: integer 0-100

card1_risk: {
  headline: string (personalised, uses their actual job title),
  subline: string,
  emotion_message: string (2-3 sentences, warm not alarming, references their specific credentials),
  risk_score: integer,
  india_average: 61,
  disruption_year: string,
  protective_skills_count: integer,
  tasks_at_risk: string[] (5 specific tasks from their actual resume that AI can already do),
  tasks_safe: string[] (5 specific tasks from their actual resume that AI cannot do),
  ats_scores: [
    { company: string, role: string, score: integer, color: "green"|"amber"|"red" },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red" },
    { company: string, role: string, score: integer, color: "green"|"amber"|"red" }
  ],
  ats_missing_keywords: string[] (5 keywords missing from their resume),
  india_data_insight: string (2-3 sentences using real India market data)
}

card2_market: {
  headline: string, subline: string, emotion_message: string,
  salary_bands: [
    { role: string, range: string, color: "navy"|"green"|"amber"|"red", bar_pct: integer },
    { role: string, range: string, color: string, bar_pct: integer },
    { role: string, range: string, color: string, bar_pct: integer },
    { role: string, range: string, color: string, bar_pct: integer },
    { role: string, range: string, color: string, bar_pct: integer },
    { role: string, range: string, color: string, bar_pct: integer }
  ],
  key_insight: string (3-4 sentences using their specific achievements),
  market_quote: string, market_quote_source: string
}

card3_shield: {
  headline: string, subline: string, emotion_message: string,
  shield_score: integer, green_arc_pct: integer, amber_arc_pct: integer,
  badge_text: string,
  shield_body: string,
  skills: [
    { name: string, level: "best-in-class"|"strong"|"buildable"|"critical-gap", note: string }
  ],
  free_resources: [
    { skill: string, resource: string, url: string, cost: "Free" }
  ]
}

card4_pivot: {
  headline: string, subline: string, emotion_message: string,
  current_band: string, pivot_year1: string, director_band: string,
  pivots: [
    { role: string, match_pct: integer, salary_range: string, location: string, color: "navy"|"green"|"teal", match_label: string, is_recommended: boolean },
    { role: string, match_pct: integer, salary_range: string, location: string, color: string, match_label: string, is_recommended: boolean },
    { role: string, match_pct: integer, salary_range: string, location: string, color: string, match_label: string, is_recommended: boolean }
  ],
  pivot_explanations: [
    { title: string, body: string },
    { title: string, body: string },
    { title: string, body: string }
  ],
  negotiation: {
    intro: string, walk_away: string, accept: string, open_with: string, best_case: string
  },
  community_quote: string, community_quote_source: string
}

card5_jobs: {
  headline: string, subline: string, emotion_message: string,
  active_count: 38, senior_count: 14, strong_match_count: 9,
  job_matches: [
    {
      company: string, role: string, location: string,
      match_pct: integer, match_label: string, match_color: "green"|"navy"|"amber",
      salary: string, company_context: string,
      tags: string[] (exactly 4),
      days_posted: integer, applicant_count: integer, is_urgent: boolean,
      apply_evidence: string (detailed paragraph of their specific evidence for this company)
    }
  ],
  remote_insight: string
}

card6_blindspots: {
  headline: string, subline: string, emotion_message: string,
  blind_spots: [
    { number: 1, title: string, body: string, fix: string },
    { number: 2, title: string, body: string, fix: string },
    { number: 3, title: string, body: string, fix: string }
  ],
  interview_prep: [
    { question: string, framework: string, answer: string, star_labels: string[] },
    { question: string, framework: string, answer: string, star_labels: string[] },
    { question: "What is your salary expectation?", framework: "Negotiation script — state it and stop talking", answer: string, star_labels: [] },
    { question: string, framework: string, answer: string, star_labels: string[] },
    { question: string, framework: "Thought leadership answer", answer: string, star_labels: [] }
  ]
}

card7_human: {
  headline: string, subline: string, emotion_message: string,
  insights: string[] (exactly 5, each 2-3 sentences using their specific resume data),
  advantages: [
    { title: string, body: string, proof_label: string, icon_type: "revenue"|"people"|"globe"|"shield" },
    { title: string, body: string, proof_label: string, icon_type: string },
    { title: string, body: string, proof_label: string, icon_type: string },
    { title: string, body: string, proof_label: string, icon_type: string }
  ],
  score_tags: string[] (exactly 3),
  whatsapp_message: string (Hinglish, starts with "Maine JobBachao pe..."),
  linkedin_message: string (professional English, under 200 words),
  score_card_text: string (4 lines: name+score, top 2 credentials, jobbachao.com)
}

ABSOLUTE RULES:
1. Every field must use specific data from the resume — never generic copy
2. All salary figures in ₹ LPA format
3. job_matches must contain EXACTLY 5 items using real Indian companies
4. interview_prep must contain EXACTLY 5 items
5. advantages must contain EXACTLY 4 items
6. insights must contain EXACTLY 5 strings
7. Return ONLY the JSON object — no markdown fences, no preamble`;
}
