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

    const systemPrompt = `You are a hyper-current career intelligence analyst. Today is ${today}. 
You track AI tool releases, industry disruptions, hiring trends, and skill demand shifts in REAL-TIME.
Your intel must be SPECIFIC (actual tool names, company names, dates) — never generic.
Always ground responses in the latest developments from the past 7–30 days.`;

    const userPrompt = `Generate a personalized daily career intelligence briefing for:
- Role: ${role}
- Industry: ${industry || "Technology"}
- Key Skills: ${topSkills}
- Region: ${region}

Return a JSON object with this EXACT structure:
{
  "briefing_date": "${today}",
  "threat_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "threat_level_reason": "One-line explanation of current threat level",
  "signals": [
    {
      "category": "AI_TOOL" | "INDUSTRY_NEWS" | "SALARY_SHIFT" | "SKILL_TREND" | "LAYOFF_ALERT" | "OPPORTUNITY",
      "urgency": "HIGH" | "MEDIUM" | "LOW",
      "headline": "Specific, attention-grabbing headline (max 80 chars)",
      "body": "2-3 sentence analysis with specific names, dates, numbers. How it impacts THIS role specifically.",
      "source_hint": "Where this info comes from (e.g., 'TechCrunch, March 2026')",
      "action_item": "One specific thing the user should do TODAY in response",
      "relevance_score": 85-100
    }
  ],
  "hot_skill_of_the_week": {
    "skill": "Specific skill name",
    "why_now": "Why this skill is surging right now",
    "demand_change": "+XX% in 30 days",
    "learn_signal": "Specific resource or approach"
  },
  "market_pulse": {
    "hiring_sentiment": "Expanding" | "Stable" | "Contracting" | "Mixed",
    "avg_salary_trend": "Up X%" | "Flat" | "Down X%",
    "top_hiring_companies": ["Company1", "Company2", "Company3"],
    "emerging_role": "A new/growing role title related to user's skills"
  },
  "one_liner": "A sharp, motivating one-liner for the day (like a fortune cookie for careers)"
}

RULES:
- Generate exactly 5 signals, covering at least 3 different categories
- Every signal MUST reference real tools, companies, or trends from 2025-2026
- Relevance scores must reflect actual impact on the specific role
- Sort signals by urgency (HIGH first)
- Make action items concrete and doable TODAY
- The one_liner should be witty and role-specific`;

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
    });

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

    // Extract JSON from potential markdown code blocks
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
