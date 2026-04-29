import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearchParallel, buildSearchContext, extractCitations } from "../_shared/tavily-search.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!LOVABLE_API_KEY) {
      console.error("[market-radar] LOVABLE_API_KEY not set");
      return json({ error: "AI not configured" }, 500);
    }

    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
    if (jwtBlocked) return jwtBlocked;

    const { role, industry, skills, country } = await req.json();
    if (!role) return json({ error: "role is required" }, 400);

    // Spending guard
    const spendCheck = await checkDailySpending("market-radar");
    if (!spendCheck.allowed) return buildSpendingBlockedResponse(cors, spendCheck);

    const topSkills = (skills || []).slice(0, 8).join(", ");
    const region = country || "India";
    const today = new Date().toISOString().split("T")[0];

    // ═══ Parallel Tavily searches for REAL market intelligence ═══
    const searches = [
      {
        query: `${role} ${industry || "technology"} hiring layoffs news ${region} 2025 2026`,
        maxResults: 5,
        searchDepth: "basic" as const,
        days: 30,
        topic: "news" as const,
      },
      {
        query: `${role} salary trends AI tools automation ${region} 2025 2026`,
        maxResults: 5,
        searchDepth: "basic" as const,
        days: 60,
      },
      {
        query: `most in-demand skills ${role} ${industry || "technology"} ${region} 2026`,
        maxResults: 5,
        searchDepth: "basic" as const,
        days: 60,
      },
    ];

    const [newsResults, salaryResults, skillResults] = await tavilySearchParallel(searches, 15000);
    const newsCtx = newsResults ? buildSearchContext(newsResults.results, 5) : "";
    const salaryCtx = salaryResults ? buildSearchContext(salaryResults.results, 5) : "";
    const skillCtx = skillResults ? buildSearchContext(skillResults.results, 5) : "";
    const citations = [
      ...extractCitations(newsResults?.results || []),
      ...extractCitations(salaryResults?.results || []),
      ...extractCitations(skillResults?.results || []),
    ].slice(0, 8);

    const hasSearchData = !!(newsCtx || salaryCtx || skillCtx);

    const systemPrompt = `You are the world's most elite career intelligence analyst — a personal Bloomberg Terminal for careers.
Today is ${today}. You synthesize REAL market data provided below into actionable career intelligence.

TONE: Confident, urgent but empowering. Like a trusted mentor who reads every tech newsletter so you don't have to. Never alarmist — always pair threats with opportunity.

CRITICAL ACCURACY RULES:
- ONLY reference tools, companies, events, and trends that appear in the LIVE MARKET DATA provided below
- If the search data mentions a specific company, tool, or event — you may reference it with the source
- NEVER invent funding amounts, hiring numbers, or statistics
- NEVER fabricate percentage changes (use directional language: "Rising fast", "Growing", "Stable", "Declining")
- For companies hiring: ONLY list companies found in the search results. If none found, say "Check Naukri and LinkedIn for latest openings"
- ${region}-specific data only — do not default to Bangalore or any other city unless search results mention it

ZERO-HALLUCINATION SALARY POLICY (HARD RULE — non-negotiable):
- NEVER write specific rupee amounts, lakh figures, or salary deltas (e.g. "₹8L", "₹8-12L on the table", "₹35-60L roles", "earning ₹X less", "leaving ₹Y on the table") UNLESS that exact figure appears verbatim in the SALARY & AI DISRUPTION search context above with a named source.
- If you have NO sourced ₹ figure: use directional, source-free language only — "compensation trending up for senior roles", "level-matched roles command a meaningful premium", "negotiation room exists at this seniority". Never invent the number.
- If you DO cite a sourced figure: include the source name in the body (e.g. "per Mercer 2026 India Compensation Report").
- Banned phrases (these always indicate a fabrication): "leaving ₹X on the table", "you're earning ₹X less", "₹X-Y as [role title]", "₹X premium for [skill]" — unless the bracketed figure is sourced.
- This rule overrides any other instruction. When in doubt, omit the number.`;

    const userPrompt = `Generate a personalized career intelligence briefing for:
- Role: ${role}
- Industry: ${industry || "Technology"}  
- Key Skills: ${topSkills}
- Region: ${region}

${hasSearchData ? `LIVE MARKET DATA (from web search — use these as your ONLY source of facts):

=== INDUSTRY NEWS & HIRING ===
${newsCtx || "No recent news found."}

=== SALARY & AI DISRUPTION ===
${salaryCtx || "No recent salary data found."}

=== SKILL DEMAND TRENDS ===
${skillCtx || "No recent skill trends found."}` : "NOTE: Web search data unavailable. Use only information you are highly confident about from your training data. Mark all claims as 'Based on industry analysis' rather than citing specific sources."}

Return a JSON object with this EXACT structure:
{
  "briefing_date": "${today}",
  "threat_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "threat_level_reason": "One punchy line referencing a specific finding from the search data above.",
  "signals": [
    {
      "category": "AI_TOOL" | "INDUSTRY_NEWS" | "SALARY_SHIFT" | "SKILL_TREND" | "LAYOFF_ALERT" | "OPPORTUNITY",
      "urgency": "HIGH" | "MEDIUM" | "LOW",
      "headline": "Specific, scroll-stopping headline (max 80 chars). Must reference something from the search data.",
      "body": "2-3 sentences. Reference specific names/events from the search data. End with direct impact on THIS ${role} in ${region}.",
      "source": "The publication or website name from the search results (e.g., 'Economic Times, March 2026'). If no specific source, say 'Industry analysis'.",
      "action_item": "One specific, doable-today action. Start with a verb. Be concrete enough that they can do it in 15 minutes.",
      "urgency_reason": "Why this urgency level — one line."
    }
  ],
  "hot_skill_of_the_week": {
    "skill": "Specific skill name trending for this role — from search data",
    "why_now": "What happened recently that made this skill critical — reference search data",
    "demand_change": "Rising fast" | "Growing" | "Stable" | "Declining",
    "learn_signal": "One specific free resource with platform name. Must be a real course/tutorial that exists."
  },
  "market_pulse": {
    "hiring_sentiment": "Expanding" | "Stable" | "Contracting" | "Mixed",
    "avg_salary_trend": "Trending up" | "Flat" | "Trending down" | "Mixed signals",
    "top_hiring_companies": ["Only companies found in search results"],
    "emerging_role": "A specific role title relevant to this user's skills — must be grounded in search data"
  },
  "closing_verdict": {
    "status": "AHEAD" | "ON_TRACK" | "AT_RISK",
    "message": "A 2-sentence personalized verdict. First: where they stand. Second: the ONE thing to focus on next 90 days.",
    "share_hook": "A compelling reason to share this with a colleague"
  },
  "one_liner": "A memorable, shareable career insight specific to ${role}. Screenshot-worthy."
}

RULES:
- Generate exactly 5 signals, covering at least 4 different categories
- Signal #1 MUST be the single most impactful finding from the search data
- EVERY signal must be grounded in the search data provided. If search data is sparse, generate fewer signals (minimum 3) rather than fabricating.
- Sort signals: HIGH urgency first
- Action items must be completable in under 15 minutes
- DO NOT include relevance_score or any fabricated percentages
- top_hiring_companies: ONLY from search results. If none found, return ["Check Naukri", "Check LinkedIn"]
- demand_change: ONLY use the 4 allowed directional values, NEVER percentages`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const aiResp = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResp.ok) {
      const status = aiResp.status;
      const errBody = await aiResp.text();
      console.error("[market-radar] AI error:", status, errBody.slice(0, 500));
      if (status === 429) return json({ error: "Rate limited, please try again later." }, 429);
      if (status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI synthesis failed", status }, 502);
    }

    const aiData = await aiResp.json();
    logTokenUsage("market-radar", null, "google/gemini-2.5-pro", aiData);
    const raw = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    // Try multiple extraction strategies
    const strategies = [
      () => { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return m ? JSON.parse(m[1].trim()) : null; },
      () => { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; },
      () => JSON.parse(raw.trim()),
    ];
    for (const strategy of strategies) {
      try { parsed = strategy(); if (parsed) break; } catch { /* try next */ }
    }
    if (!parsed) {
      console.error("[market-radar] Failed to parse AI response:", raw.slice(0, 500));
      return json({ error: "Failed to parse AI response" }, 500);
    }

    // ── ZERO-HALLUCINATION SALARY GUARD ────────────────────────────────────
    // Even with the prompt rule, Gemini occasionally writes phrases like
    // "₹8L–12L on the table as RevOps Architect". This is a credibility-killer
    // because the figure is fabricated — we have no source for it. Strip any
    // sentence that contains a ₹/lakh/L figure UNLESS the body also names a
    // source. We replace, not redact, so the signal still reads naturally.
    const hasSourceCitation = (text: string): boolean => {
      const t = text.toLowerCase();
      // Source markers: "per X", "according to", "X report", "(source)", named outlets
      return /\b(per |according to |as per |source: |sources?:|report\b|study\b|survey\b|index\b)/i.test(text)
        || /\b(mercer|aon|deloitte|naukri|linkedin|economic times|et\b|business standard|mint\b|nasscom|aim\b|inc42|moneycontrol|reuters|bloomberg|forbes|techcrunch)\b/i.test(t);
    };
    const stripFabricatedRupeeFigures = (text: string | undefined): string => {
      if (!text || typeof text !== "string") return text || "";
      // Split into sentences, drop ones with un-sourced ₹/lakh/L figures.
      const sentences = text.split(/(?<=[.!?])\s+/);
      const kept = sentences.filter((s) => {
        const hasRupeeFigure = /(₹\s*\d|\d+\s*(?:L|lakh|lakhs|cr|crore|crores)\b)/i.test(s);
        if (!hasRupeeFigure) return true;
        return hasSourceCitation(s);
      });
      // If everything was stripped, return a safe directional fallback rather than empty.
      if (kept.length === 0) {
        return "Compensation signals are mixed at this seniority; check the Negotiation Anchors in your action plan for level-matched ranges.";
      }
      return kept.join(" ").trim();
    };

    if (Array.isArray(parsed.signals)) {
      parsed.signals = parsed.signals.map((sig: Record<string, unknown>) => {
        const cleaned = { ...sig };
        if (typeof cleaned.body === "string") cleaned.body = stripFabricatedRupeeFigures(cleaned.body);
        if (typeof cleaned.headline === "string") cleaned.headline = stripFabricatedRupeeFigures(cleaned.headline);
        if (typeof cleaned.action_item === "string") cleaned.action_item = stripFabricatedRupeeFigures(cleaned.action_item);
        return cleaned;
      });
    }
    if (parsed.closing_verdict?.message) {
      parsed.closing_verdict.message = stripFabricatedRupeeFigures(parsed.closing_verdict.message);
    }
    if (typeof parsed.one_liner === "string") {
      parsed.one_liner = stripFabricatedRupeeFigures(parsed.one_liner);
    }

    return json({
      ...parsed,
      citations,
      source: "gemini-2.5-pro + tavily",
      generated_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    console.error("[market-radar] Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
