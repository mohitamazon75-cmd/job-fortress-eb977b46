import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { role, industry, skills, country } = await req.json();
    if (!role) {
      return new Response(JSON.stringify({ error: "role is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const topSkills = (skills || []).slice(0, 8).join(", ");
    const region = country || "India";
    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are the world's most elite career intelligence analyst — a personal Bloomberg Terminal for careers.
Today is ${today}. You have access to the latest AI tool releases, funding rounds, layoffs, hiring freezes, salary benchmarks, and skill demand data from the past 7-30 days.

Your mission: Deliver a career intelligence briefing so specific, so timely, and so personally relevant that the reader thinks "How does this tool know exactly what I need to hear right now?"

TONE: Confident, urgent but empowering. Like a trusted mentor who reads every tech newsletter so you don't have to. Never alarmist — always pair threats with opportunity.

ACCURACY RULES:
- Only reference tools, companies, and trends you are confident exist as of early 2026
- If referencing a specific announcement, include approximate timing
- Never invent funding amounts, percentages, or statistics — use directional language if uncertain
- For ${region}-specific data, prioritize local sources (Naukri, Economic Times, MCA filings) over global ones`;

    const userPrompt = `Generate a personalized career intelligence briefing for:
- Role: ${role}
- Industry: ${industry || "Technology"}  
- Key Skills: ${topSkills}
- Region: ${region}

This is the FINAL card in a comprehensive career analysis. The user has just spent 10+ minutes going through their risk score, skill gaps, pivot paths, and defense plans. This card must:
1. Validate the journey they just took ("you now know more about your career trajectory than 99% of professionals")
2. Give them FRESH, CURRENT intel they can act on THIS WEEK
3. End with something so valuable they want to share this tool with colleagues

Return a JSON object with this EXACT structure:
{
  "briefing_date": "${today}",
  "threat_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "threat_level_reason": "One punchy line. Reference a specific tool, company, or trend. Make it feel like inside knowledge.",
  "signals": [
    {
      "category": "AI_TOOL" | "INDUSTRY_NEWS" | "SALARY_SHIFT" | "SKILL_TREND" | "LAYOFF_ALERT" | "OPPORTUNITY",
      "urgency": "HIGH" | "MEDIUM" | "LOW",
      "headline": "Specific, scroll-stopping headline (max 80 chars). Name the tool/company.",
      "body": "2-3 sentences. Include specific names, dates, numbers where confident. End with direct impact on THIS ${role} in ${region}.",
      "source_hint": "Publication or data source with approximate date",
      "action_item": "One specific, doable-today action. Start with a verb. Be concrete enough that they can do it in 15 minutes.",
      "relevance_score": 85-100
    }
  ],
  "hot_skill_of_the_week": {
    "skill": "Specific skill name trending RIGHT NOW for this role",
    "why_now": "What happened in the past 2 weeks that made this skill suddenly critical",
    "demand_change": "+XX% in 30 days (use directional estimate)",
    "learn_signal": "One specific free resource with platform name. Must be a real course/tutorial."
  },
  "market_pulse": {
    "hiring_sentiment": "Expanding" | "Stable" | "Contracting" | "Mixed",
    "avg_salary_trend": "Up X%" | "Flat" | "Down X%",
    "top_hiring_companies": ["Company1", "Company2", "Company3"],
    "emerging_role": "A specific new role title that didn't exist 12 months ago, relevant to this user's skills"
  },
  "closing_verdict": {
    "status": "AHEAD" | "ON_TRACK" | "AT_RISK",
    "message": "A 2-sentence personalized verdict. First sentence: where they stand relative to the market. Second sentence: the ONE thing that will make the biggest difference in the next 90 days. Make it feel like a personal advisor speaking directly to them.",
    "share_hook": "A compelling reason to share this with a colleague (e.g., 'Your team lead needs to see the [specific signal] — it affects their role even more than yours')"
  },
  "one_liner": "A memorable, shareable career fortune cookie. Witty, specific to ${role}. The kind of line someone screenshots and posts on LinkedIn."
}

RULES:
- Generate exactly 5 signals, covering at least 4 different categories
- Signal #1 MUST be the single most impactful development for THIS specific role in the past 7 days
- Every signal MUST reference real, verifiable tools/companies/trends from 2025-2026
- Sort signals: HIGH urgency first, then by relevance_score descending
- Action items must be completable in under 15 minutes
- The closing_verdict.message should feel like it was written by someone who just reviewed their entire career profile
- The share_hook should create genuine FOMO for colleagues who haven't used this tool
- one_liner should be screenshot-worthy`;

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("[market-radar] AI error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("[market-radar] Failed to parse AI response:", raw.slice(0, 500));
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[market-radar] Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
