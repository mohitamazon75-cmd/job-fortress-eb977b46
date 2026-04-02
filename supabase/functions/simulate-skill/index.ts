import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeAll,
  matchSkillToKG,
  type ProfileInput,
  type SkillRiskRow,
  type JobSkillMapRow,
  type JobTaxonomyRow,
  type MarketSignalRow,
} from "../_shared/deterministic-engine.ts";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { scanId, newSkill } = await req.json();

    if (!scanId || !newSkill) {
      return new Response(
        JSON.stringify({ error: "scanId and newSkill are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Input validation: reject non-professional skill terms ──
    const trimmedSkill = newSkill.trim();
    const skillLower = trimmedSkill.toLowerCase();

    // Must be 2-60 chars, primarily letters/spaces/hyphens
    if (trimmedSkill.length < 2 || trimmedSkill.length > 60) {
      return new Response(
        JSON.stringify({ error: "Skill name must be 2-60 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must contain at least 2 alphabetic characters
    const alphaCount = (trimmedSkill.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount < 2) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid professional skill" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Blocklist of obviously non-professional terms
    const BLOCKED_TERMS = new Set([
      "sex", "porn", "fuck", "shit", "ass", "dick", "boob", "nude", "naked",
      "kill", "murder", "drug", "cocaine", "weed", "marijuana", "heroin",
      "racist", "racism", "nazi", "terrorist", "bomb", "hack", "steal",
      "gambling", "betting", "alcohol", "beer", "wine", "whiskey", "vodka",
      "dating", "tinder", "hookup", "onlyfans", "xxx", "fetish", "kink",
      "abuse", "violence", "gun", "weapon", "suicide", "self-harm",
      "test", "asdf", "qwerty", "hello", "hi", "lol", "lmao", "bruh",
      "nothing", "idk", "whatever", "blah", "foo", "bar", "baz",
    ]);

    // Check each word against blocklist
    const words = skillLower.split(/[\s\-_.,]+/).filter(Boolean);
    for (const word of words) {
      if (BLOCKED_TERMS.has(word)) {
        return new Response(
          JSON.stringify({ error: "Please enter a valid professional or technical skill (e.g., 'Machine Learning', 'Cloud Architecture')" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Must look like a professional skill: at least one word with 3+ chars
    const hasSubstantiveWord = words.some(w => w.length >= 3);
    if (!hasSubstantiveWord) {
      return new Response(
        JSON.stringify({ error: "Please enter a specific professional skill" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the scan's final report to reconstruct profile
    const { data: scan, error: scanErr } = await supabase
      .from("scans")
      .select("final_json_report, industry, metro_tier")
      .eq("id", scanId)
      .single();

    if (scanErr || !scan?.final_json_report) {
      return new Response(
        JSON.stringify({ error: "Scan not found or incomplete" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const report = scan.final_json_report as any;

    // Reconstruct profile from report using the CORRECT fields
    // (previously used execution_skills_dead and moat_skills which are derived/output fields)
    const currentProfile: ProfileInput = {
      experience_years: report.score_breakdown?.experience_reduction
        ? Math.round(report.score_breakdown.experience_reduction / 0.8 + 8) // reverse the reduction formula
        : null,
      execution_skills: report.execution_skills || report.execution_skills_dead || [],
      strategic_skills: report.strategic_skills || report.moat_skills || [],
      all_skills: report.all_skills || [],
      geo_advantage: null,
      adaptability_signals: 1,
      estimated_monthly_salary_inr: null,
      seniority_tier: report.seniority_tier || null,
    };

    // Use all_skills from report if available, otherwise reconstruct
    if (currentProfile.all_skills.length === 0) {
      const allSkills = new Set<string>([
        ...currentProfile.execution_skills,
        ...currentProfile.strategic_skills,
      ]);
      currentProfile.all_skills = [...allSkills];
    }

    // Fetch KG data
    const role = report.role || "Unknown";
    const industry = report.industry || scan.industry || "Other";

    const { data: industryJobs } = await supabase
      .from("job_taxonomy")
      .select("*")
      .eq("category", industry)
      .limit(20);

    const allJobs = industryJobs || [];
    const primaryJob: JobTaxonomyRow | null = allJobs[0] || null;
    const targetFamily = primaryJob?.job_family || "full_stack_developer";

    const { data: skillMaps } = await supabase
      .from("job_skill_map")
      .select("skill_name, importance, frequency")
      .eq("job_family", targetFamily)
      .order("importance", { ascending: false })
      .limit(15);

    const skillMapRows: JobSkillMapRow[] = (skillMaps || []).map((s: any) => ({
      skill_name: s.skill_name,
      importance: s.importance,
      frequency: s.frequency || "common",
    }));

    const { data: allSkillRisk } = await supabase
      .from("skill_risk_matrix")
      .select("*")
      .limit(1000);

    const allSkillRiskRows: SkillRiskRow[] = (allSkillRisk || []).map((s: any) => ({
      skill_name: s.skill_name,
      automation_risk: s.automation_risk,
      ai_augmentation_potential: s.ai_augmentation_potential,
      human_moat: s.human_moat,
      replacement_tools: s.replacement_tools || [],
      india_demand_trend: s.india_demand_trend,
      category: s.category,
    }));

    let marketSignal: MarketSignalRow | null = null;
    const { data: marketSignals } = await supabase
      .from("market_signals")
      .select("*")
      .eq("job_family", targetFamily)
      .eq("metro_tier", scan.metro_tier || "tier1")
      .limit(1);

    if (marketSignals?.[0]) {
      const ms = marketSignals[0];
      marketSignal = {
        posting_change_pct: ms.posting_change_pct,
        avg_salary_change_pct: ms.avg_salary_change_pct,
        ai_job_mentions_pct: ms.ai_job_mentions_pct,
        market_health: ms.market_health,
      };
    }

    // Check if the new skill exists in KG
    const kgMatch = matchSkillToKG(trimmedSkill, allSkillRiskRows);
    const skillInKG = !!kgMatch;
    const skillRisk = kgMatch?.automation_risk ?? null;

    // Build modified profile with meaningful impact:
    // 1. Add to strategic_skills (boosts survivability strategic_bonus)
    // 2. Add to all_skills (affects DI calculation)
    // 3. Boost adaptability_signals (learning = adapting)
    const modifiedProfile: ProfileInput = {
      ...currentProfile,
      strategic_skills: [...currentProfile.strategic_skills, trimmedSkill],
      all_skills: [...currentProfile.all_skills, trimmedSkill],
      adaptability_signals: Math.min((currentProfile.adaptability_signals || 1) + 1, 3),
    };

    // If skill is NOT in KG, inject a synthetic low-risk entry
    // so the engine can actually factor it into the DI calculation.
    // Strategic/emerging skills typically have low automation risk.
    let simulationSkillRiskRows = allSkillRiskRows;
    let simulationSkillMapRows = skillMapRows;

    if (!skillInKG) {
      // For skills NOT in our Knowledge Graph, use a moderate risk estimate
      // instead of always-low (15%), to avoid unrealistic improvements for unknown terms.
      // Automation risk of 40 = neutral (won't dramatically shift scores either way)
      const syntheticRisk: SkillRiskRow = {
        skill_name: trimmedSkill,
        automation_risk: 40, // Neutral — unknown skills shouldn't dramatically improve scores
        ai_augmentation_potential: 50,
        human_moat: "Unverified skill — impact estimated conservatively",
        replacement_tools: [],
        india_demand_trend: "Stable",
        category: "hybrid",
      };
      simulationSkillRiskRows = [...allSkillRiskRows, syntheticRisk];

      // Add to skill map with moderate importance (not high) — unverified skills
      // shouldn't have outsized weight in the calculation
      const syntheticMap: JobSkillMapRow = {
        skill_name: trimmedSkill,
        importance: 4, // Moderate, not high — prevents inflated impact
        frequency: "emerging",
      };
      simulationSkillMapRows = [...skillMapRows, syntheticMap];
    }

    // Run engine with current profile
    const currentResult = computeAll(currentProfile, allSkillRiskRows, skillMapRows, primaryJob, marketSignal, false);
    // Run engine with modified profile + potentially expanded KG
    const modifiedResult = computeAll(modifiedProfile, simulationSkillRiskRows, simulationSkillMapRows, primaryJob, marketSignal, false);

    // Calculate precise (decimal) deltas
    const diDelta = +(modifiedResult.determinism_index - currentResult.determinism_index).toFixed(1);
    const survDelta = +(modifiedResult.survivability.score - currentResult.survivability.score).toFixed(1);
    const monthsDelta = modifiedResult.months_remaining - currentResult.months_remaining;

    // Generate insight text
    let insight = "";
    if (diDelta < -5) {
      insight = `Learning ${trimmedSkill} significantly reduces your automation risk. This is a high-impact skill investment.`;
    } else if (diDelta < 0) {
      insight = `Adding ${trimmedSkill} lowers your risk profile. Combined with your existing skills, it strengthens your position.`;
    } else if (survDelta > 0) {
      insight = `While automation risk stays similar, ${trimmedSkill} boosts your overall resilience through strategic diversification.`;
    } else if (skillInKG && skillRisk !== null && skillRisk > 50) {
      insight = `${trimmedSkill} itself has high automation risk (${skillRisk}%). Consider pairing it with a lower-risk strategic skill.`;
    } else if (!skillInKG) {
      insight = `${trimmedSkill} is not in our Knowledge Graph — impact is estimated conservatively. Try a recognized technical skill for more precise results.`;
    } else {
      insight = `${trimmedSkill} adds marginal direct impact. Look for skills that directly counter your top automation threats.`;
    }

    return new Response(
      JSON.stringify({
        skill: trimmedSkill,
        skill_in_kg: skillInKG,
        skill_automation_risk: skillRisk,
        current_di: currentResult.determinism_index,
        new_di: modifiedResult.determinism_index,
        di_delta: diDelta,
        current_survivability: currentResult.survivability.score,
        new_survivability: modifiedResult.survivability.score,
        survivability_delta: survDelta,
        current_months: currentResult.months_remaining,
        new_months: modifiedResult.months_remaining,
        months_delta: monthsDelta,
        insight,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[simulate-skill] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
