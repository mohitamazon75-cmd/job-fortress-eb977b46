// ═══════════════════════════════════════════════════════════════
// Skill Arbitrage Engine — finds the highest-ROI skill to learn
// based on exact profile + live market demand + salary uplift.
// Returns a structured 90-day learning plan.
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { callAgent, AI_URL, PRO_MODEL, FLASH_MODEL } from "../_shared/ai-agent-caller.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";

const SYSTEM_PROMPT = `You are the SKILL ARBITRAGE ENGINE — a surgical career intelligence system that identifies the single highest-ROI skill investment for a professional based on their exact profile, market conditions, and salary uplift potential.

You must return ONLY valid JSON matching this schema:

{
  "top_skill": {
    "name": "string — the specific skill to learn",
    "category": "string — Technical | Strategic | Creative | Leadership",
    "why_this_skill": "string — 2-3 sentences explaining why THIS skill specifically for THIS person",
    "roi_score": number (0-100, how high the return on time investment),
    "current_gap_severity": "CRITICAL | HIGH | MODERATE | LOW",
    "salary_uplift_pct": number (estimated % salary increase),
    "salary_uplift_range": "string — e.g. '₹3-8L additional CTC'",
    "demand_trend": "SURGING | GROWING | STABLE | DECLINING",
    "time_to_competency_weeks": number,
    "market_evidence": "string — specific data point from live market research"
  },
  "runner_ups": [
    {
      "name": "string",
      "roi_score": number,
      "salary_uplift_pct": number,
      "one_liner": "string — why it's #2 or #3"
    }
  ],
  "learning_plan": {
    "phase_1": {
      "title": "string — Week 1-2 focus",
      "actions": ["string — specific daily action"],
      "resources": [{"name": "string", "type": "Course | Book | Project | Community", "url_hint": "string — platform name", "cost": "Free | ₹X"}],
      "milestone": "string — what you can demonstrate after this phase"
    },
    "phase_2": {
      "title": "string — Week 3-6 focus",
      "actions": ["string"],
      "resources": [{"name": "string", "type": "string", "url_hint": "string", "cost": "string"}],
      "milestone": "string"
    },
    "phase_3": {
      "title": "string — Week 7-12 focus",
      "actions": ["string"],
      "resources": [{"name": "string", "type": "string", "url_hint": "string", "cost": "string"}],
      "milestone": "string"
    }
  },
  "arbitrage_insight": "string — the non-obvious market inefficiency this skill exploits",
  "anti_skills": ["string — skills NOT to invest time in right now and why (max 3)"]
}

RULES:
- Be specific to THIS person's role, seniority, industry, and geography.
- Use 2025-2026 market context. Reference specific tools, frameworks, certifications.
- The top skill must create ASYMMETRIC returns — low learning cost, high market value.
- Salary uplift must be grounded in Indian market data (tier-adjusted).
- Resources must be real platforms: Scaler, UpGrad, Coursera, GitHub, etc.
- Anti-skills: identify time-wasters that SEEM valuable but aren't for this profile.
- No filler. No "Great question." Pure intelligence.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
  if (jwtBlocked) return jwtBlocked;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { report } = body;
  if (!report) {
    return new Response(JSON.stringify({ error: "Missing report" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const role = report.current_role || report.role_detected || report.role || "Professional";
  const industry = report.industry || "Technology";
  const seniority = report.seniority_tier || "PROFESSIONAL";
  const metro = report.metro_tier || "tier1";
  const moatSkills = (report.moat_skills || []).join(", ");
  const deadSkills = (report.execution_skills_dead || []).join(", ");
  const allSkills = (report.all_skills || []).join(", ");
  const gaps = (report.skill_gap_map || []).map((g: any) => `${g.skill}: ${g.gap_level}`).join(", ");
  const pivots = (report.pivot_roles || []).map((p: any) => typeof p === "string" ? p : p.role).join(", ");
  const di = report.determinism_index ?? 50;

  console.log(`[SkillArbitrage] Starting for ${role} in ${industry}, user ${userId}`);

  try {
    // Parallel: live market search + AI analysis
    const [marketData, salaryData] = await Promise.all([
      tavilySearch({
        query: `${role} ${industry} most in-demand skills 2025 2026 India salary`,
        searchDepth: "advanced",
        maxResults: 5,
        days: 60,
        topic: "news",
      }),
      tavilySearch({
        query: `${role} highest paying skills India salary hike upskilling 2025 2026`,
        searchDepth: "basic",
        maxResults: 3,
        days: 90,
        topic: "general",
      }),
    ]);

    const marketContext = [
      ...(marketData?.results || []).map((r: any) => `[MARKET] ${r.title}: ${r.content?.slice(0, 200)}`),
      ...(salaryData?.results || []).map((r: any) => `[SALARY] ${r.title}: ${r.content?.slice(0, 200)}`),
    ].join("\n\n");

    const userPrompt = `
═══ CAREER PROFILE ═══
Role: ${role}
Industry: ${industry}
Seniority: ${seniority}
Metro Tier: ${metro}
Determinism Index: ${di}/100 (higher = more automatable)

Current Skills: ${allSkills || "Not specified"}
Human Moat Skills: ${moatSkills || "None identified"}
At-Risk/Dead Skills: ${deadSkills || "None flagged"}
Identified Skill Gaps: ${gaps || "None mapped"}
Suggested Pivot Roles: ${pivots || "None"}

═══ LIVE MARKET INTELLIGENCE ═══
${marketContext || "No live data available — use your training data for 2025-2026 India market."}

Find the single highest-ROI skill this person should invest in RIGHT NOW. Consider:
1. Their current skill gaps vs market demand
2. Salary uplift potential specific to ${metro === 'tier1' ? 'Tier 1 metro (Bangalore/Mumbai/Delhi)' : 'Tier 2 city'}
3. How this skill compounds with their existing moat skills
4. Time-to-competency vs market window of opportunity
`;

    const result = await callAgent(
      apiKey,
      "SkillArbitrage",
      SYSTEM_PROMPT,
      userPrompt,
      "google/gemini-3.1-pro-preview",
      0.4,
      55_000,
    );

    if (!result) {
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attach market sources for provenance
    result._market_sources = (marketData?.results || []).slice(0, 3).map((r: any) => ({
      title: r.title,
      url: r.url,
    }));

    console.log(`[SkillArbitrage] Complete for ${role}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[SkillArbitrage] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
