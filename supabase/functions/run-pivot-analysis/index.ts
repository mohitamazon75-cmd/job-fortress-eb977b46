import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const ADJACENT_WEIGHTS = { T: 0.32, S: 0.22, D: 0.18, F: 0.14, W: 0.14 };
const STRETCH_WEIGHTS  = { T: 0.22, S: 0.24, D: 0.20, F: 0.12, W: 0.22 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await anonSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    // Spending guard
    const spending = await checkDailySpending("run-pivot-analysis");
    if (!spending.allowed) return buildSpendingBlockedResponse(cors, spending);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 503);

    const body = await req.json();
    const { role, industry, skills, country, yearsExperience, metroTier, determinismIndex, moatSkills } = body;

    if (!role || !industry) return json({ error: "role and industry are required" }, 400);

    // ── Load Knowledge Graph data ──
    const [taxonomyRes, skillMatrixRes, marketRes] = await Promise.all([
      sb.from("job_taxonomy").select("job_family, category, disruption_baseline, automatable_tasks, ai_tools_replacing, avg_salary_lpa"),
      sb.from("skill_risk_matrix").select("skill_name, automation_risk, ai_augmentation_potential, category, india_demand_trend, human_moat"),
      sb.from("market_signals").select("job_family, market_health, posting_change_pct, ai_job_mentions_pct, avg_salary_change_pct").eq("metro_tier", metroTier || "tier1"),
    ]);

    const allJobs = taxonomyRes.data || [];
    const allSkillsDb = skillMatrixRes.data || [];
    const marketData = marketRes.data || [];

    // Build context for AI
    const jobFamilies = allJobs.map(j => j.job_family).join(", ");
    const userSkillsList = (skills || []).join(", ");
    const moatsList = (moatSkills || []).join(", ");
    const marketContext = marketData.slice(0, 15).map(m =>
      `${m.job_family}: ${m.market_health}, postings ${m.posting_change_pct > 0 ? '+' : ''}${m.posting_change_pct}%`
    ).join("; ");

    // ── AI Analysis ──
    const model = spending.degraded ? "google/gemini-2.5-flash-lite" : "google/gemini-3-flash-preview";

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a career transition analyst. Given a user's current role, skills, and market data, recommend exactly 3 adjacent career pivots and 1 stretch role.

CRITICAL RULES:
1. NEVER say "AI-proof" or "guaranteed safe". Always say "safer relative to current role based on market and skill signals."
2. All scores must be between 0.0 and 1.0
3. Skill gaps must be specific and actionable
4. Salary estimates must be realistic for the user's country and experience level
5. Transition plans must be concrete (not generic advice)
6. Evidence-based reasoning only — cite skill overlap, market trends, task composition

AVAILABLE JOB FAMILIES IN OUR DATABASE: ${jobFamilies}

MARKET SIGNALS: ${marketContext}

Return ONLY valid JSON matching this exact structure:
{
  "adjacent_roles": [
    {
      "target_role": "string (specific job title)",
      "scores": { "transferability": 0.0-1.0, "safety": 0.0-1.0, "demand": 0.0-1.0, "salary": 0.0-1.0, "feasibility": 0.0-1.0 },
      "skill_match_pct": 0-100,
      "skill_gaps": [{ "skill_name": "string", "importance": "core|optional", "proficiency_needed": "string", "proof_suggestion": "string" }],
      "salary_band": { "min_lpa": number, "max_lpa": number, "median_lpa": number, "confidence": "high|medium|low", "currency": "${country === 'US' ? 'USD' : country === 'AE' ? 'AED' : 'INR'}" },
      "readiness": { "light_weeks": number, "steady_weeks": number, "aggressive_weeks": number },
      "why_it_fits": ["string", "string"],
      "why_its_safer": ["string", "string"],
      "transition_plan": ["Step 1...", "Step 2...", "Step 3..."],
      "sample_companies": ["Company1", "Company2", "Company3"],
      "demand_trend": "growing|stable|declining"
    }
  ],
  "stretch_role": { ...same structure as above },
  "current_role_summary": { "title": "string", "safety_score": 0.0-1.0, "routine_intensity": 0.0-1.0 }
}

No markdown, no explanation, only JSON.`,
          },
          {
            role: "user",
            content: `Analyze career pivots for:
Role: ${role}
Industry: ${industry}
Experience: ${yearsExperience || 'not specified'}
Location: ${country || 'IN'}, Metro: ${metroTier || 'tier1'}
Skills: ${userSkillsList || 'not specified'}
Human Moat Skills: ${moatsList || 'none identified'}
Current Disruption Index: ${determinismIndex || 'unknown'}/100

Recommend 3 adjacent roles (easier transitions with high skill overlap) and 1 stretch role (higher upside, bolder move). For each, provide specific skill gaps, realistic salary ranges in ${country === 'US' ? 'USD (annual)' : country === 'AE' ? 'AED (annual)' : 'INR (LPA)'}, and concrete transition steps.`,
          },
        ],
        temperature: 0.3,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[run-pivot-analysis] AI error [${aiResp.status}]:`, errText.slice(0, 300));
      return json({ error: "AI analysis failed" }, 500);
    }

    const aiData = await aiResp.json();
    logTokenUsage("run-pivot-analysis", null, "google/gemini-3-pro-preview", aiData);
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ error: "No AI response" }, 500);

    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[run-pivot-analysis] JSON parse error:", e, jsonStr.slice(0, 200));
      return json({ error: "AI returned invalid data" }, 500);
    }

    // ── Validate & enrich with KG data ──
    const enrichRole = (r: any, type: 'adjacent' | 'stretch') => {
      const scores = r.scores || {};
      const T = clamp(scores.transferability || 0);
      const S = clamp(scores.safety || 0);
      const D = clamp(scores.demand || 0);
      const W = clamp(scores.salary || 0);
      const F = clamp(scores.feasibility || 0);
      const w = type === 'adjacent' ? ADJACENT_WEIGHTS : STRETCH_WEIGHTS;
      const overall = w.T * T + w.S * S + w.D * D + w.F * F + w.W * W;

      // Difficulty label
      const missingCore = (r.skill_gaps || []).filter((g: any) => g.importance === 'core').length;
      let difficulty: string;
      if (T >= 0.7 && missingCore <= 2) difficulty = 'Easy';
      else if (T >= 0.5 || missingCore <= 4) difficulty = 'Medium';
      else difficulty = 'Hard';

      // Cross-reference with market data
      const matchedMarket = marketData.find(m =>
        r.target_role?.toLowerCase().includes(m.job_family?.replace(/_/g, ' ').toLowerCase())
      );
      const demandTrend = matchedMarket?.market_health === 'booming' ? 'growing'
        : matchedMarket?.market_health === 'declining' ? 'declining' : (r.demand_trend || 'stable');

      return {
        target_role: r.target_role || 'Unknown Role',
        role_type: type,
        difficulty,
        scores: { transferability: T, safety: S, demand: D, salary: W, feasibility: F, overall: round2(overall) },
        skill_match_pct: Math.round(clamp(r.skill_match_pct / 100) * 100),
        skill_gaps: (r.skill_gaps || []).slice(0, 5).map((g: any) => ({
          skill_name: g.skill_name || 'Unknown',
          importance: g.importance === 'core' ? 'core' : 'optional',
          proficiency_needed: g.proficiency_needed || 'Intermediate',
          proof_suggestion: g.proof_suggestion || 'Build a portfolio project demonstrating this skill',
        })),
        salary_band: {
          min_lpa: r.salary_band?.min_lpa || 0,
          max_lpa: r.salary_band?.max_lpa || 0,
          median_lpa: r.salary_band?.median_lpa || 0,
          confidence: r.salary_band?.confidence || 'low',
          currency: r.salary_band?.currency || 'INR',
        },
        readiness: {
          light_weeks: r.readiness?.light_weeks || 24,
          steady_weeks: r.readiness?.steady_weeks || 14,
          aggressive_weeks: r.readiness?.aggressive_weeks || 8,
        },
        why_it_fits: (r.why_it_fits || []).slice(0, 2),
        why_its_safer: (r.why_its_safer || []).slice(0, 2),
        transition_plan: (r.transition_plan || []).slice(0, 4),
        sample_companies: (r.sample_companies || []).slice(0, 4),
        demand_trend: demandTrend,
      };
    };

    const adjacentRoles = (parsed.adjacent_roles || []).slice(0, 3).map((r: any) => enrichRole(r, 'adjacent'));
    const stretchRole = parsed.stretch_role ? enrichRole(parsed.stretch_role, 'stretch') : null;

    // Sort adjacent by overall score descending
    adjacentRoles.sort((a: any, b: any) => b.scores.overall - a.scores.overall);

    const result = {
      adjacent_roles: adjacentRoles,
      stretch_role: stretchRole,
      current_role_summary: {
        title: parsed.current_role_summary?.title || role,
        safety_score: clamp(parsed.current_role_summary?.safety_score || 0.5),
        routine_intensity: clamp(parsed.current_role_summary?.routine_intensity || 0.5),
      },
      analysis_quality: adjacentRoles.length >= 3 ? 'high' : adjacentRoles.length >= 1 ? 'medium' : 'low',
      disclaimer: "Safer relative to your current role based on market and skill signals. Not a guarantee of employment or income.",
    };

    // Track usage
    await sb.from("daily_usage_stats").upsert({
      function_name: "run-pivot-analysis",
      stat_date: new Date().toISOString().split("T")[0],
      call_count: 1,
    }, { onConflict: "function_name,stat_date", ignoreDuplicates: false });

    return json(result);
  } catch (error) {
    console.error("[run-pivot-analysis] error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }
function round2(v: number) { return Math.round(v * 100) / 100; }
