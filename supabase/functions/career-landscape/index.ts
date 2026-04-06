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
      console.error("[career-landscape] LOVABLE_API_KEY not set");
      return json({ error: "AI not configured" }, 500);
    }

    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
    if (jwtBlocked) return jwtBlocked;

    const { role, industry, skills, currentDI, country } = await req.json();
    if (!role || !industry) return json({ error: "role and industry required" }, 400);

    // Spending guard
    const spendCheck = await checkDailySpending("career-landscape");
    if (!spendCheck.allowed) return buildSpendingBlockedResponse(cors, spendCheck);

    const topSkills = (skills || []).slice(0, 8).join(", ");
    const geo = country || "India";

    // Parallel Tavily searches for real market intelligence
    const searches = [
      {
        query: `best career transitions from ${role} ${industry} 2025 lateral moves`,
        maxResults: 5,
        searchDepth: "basic" as const,
        days: 90,
      },
      {
        query: `${role} transferable skills highest demand roles ${geo} 2025`,
        maxResults: 5,
        searchDepth: "basic" as const,
        days: 90,
      },
    ];

    const [transitionResults, demandResults] = await tavilySearchParallel(searches, 15000);
    const transitionCtx = transitionResults ? buildSearchContext(transitionResults.results, 5) : "";
    const demandCtx = demandResults ? buildSearchContext(demandResults.results, 5) : "";
    const citations = [
      ...extractCitations(transitionResults?.results || []),
      ...extractCitations(demandResults?.results || []),
    ].slice(0, 6);

    // AI synthesis with Gemini
    const prompt = `You are a career transition strategist. Analyze lateral move opportunities for this professional.

CURRENT PROFILE:
- Role: ${role}
- Industry: ${industry}
- Key Skills: ${topSkills}
- Current AI Disruption Index: ${currentDI}% (higher = more at risk)
- Location: ${geo}

LIVE MARKET INTELLIGENCE:
${transitionCtx}

${demandCtx}

CRITICAL RULES:
1. ONLY suggest roles that are a REALISTIC lateral move — someone with these specific skills could transition within 3-6 months
2. NEVER suggest roles that are a DEMOTION (e.g., don't suggest "Analyst" to a Director, or "Coordinator" to a Manager)
3. NEVER suggest completely unrelated fields (e.g., don't suggest "Doctor" to a Software Engineer)
4. Each role MUST share at least 40% skill overlap with the current role
5. Include the user's CURRENT role as the first entry for comparison
6. Roles must exist in the ${geo} job market with real demand
7. Sort by "transition feasibility" — easiest transitions first

Return EXACTLY this JSON (no markdown, no explanation):
{
  "transitions": [
    {
      "role": "string — the role title",
      "is_current": false,
      "skill_overlap_pct": 75,
      "demand_trend": "booming|growing|stable|declining",
      "risk_level": "HIGH" | "MEDIUM" | "LOW",
      "transition_difficulty": "easy|moderate|hard",
      "why_viable": "1 sentence — what specific skills transfer and why this works",
      "salary_delta": "+15%",
      "time_to_transition": "2-4 months"
    }
  ],
  "strategy_insight": "1-2 sentence strategic recommendation for this specific person"
}

Return 6-8 transitions including the current role. Be brutally realistic — no aspirational nonsense.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const aiResp = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      console.error("[career-landscape] AI error:", aiResp.status, errBody.slice(0, 500));
      return json({ error: "AI synthesis failed", status: aiResp.status }, 502);
    }

    const aiData = await aiResp.json();
    logTokenUsage("career-landscape", null, "google/gemini-3-pro-preview", aiData);
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ error: "Failed to parse AI response" }, 500);

    const parsed = JSON.parse(jsonMatch[0]);

    return json({
      ...parsed,
      citations,
      source: "gemini-3-pro + tavily",
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[career-landscape] error:", e.message);
    return json({ error: "Internal error" }, 500);
  }
});
