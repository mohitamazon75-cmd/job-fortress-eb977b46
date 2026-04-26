/**
 * AUDIT P0/P1 fix regression tests.
 * Covers:
 *   - P0: No more (skill.length % 10) pseudo-variance — same-tier skills get same risk
 *   - P0: kg_disruption_baseline + structural_floor are surfaced on the result
 *   - P1: Modifier stacking — exec multiplier applied AFTER reductions, never negative pre-clamp
 *   - P1: safeContainment now matches short technical skills (sql, aws) without false positives
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "../_shared/det-orchestrator.ts";
import { matchSkillToKG, buildKGSkillIndex } from "../_shared/det-utils.ts";
import type { ProfileInput, SkillRiskRow, JobTaxonomyRow } from "../_shared/det-types.ts";

const baseProfile: ProfileInput = {
  experience_years: 4,
  execution_skills: ["A", "ABCDEFGHIJ", "longer_skill_name_here"],
  strategic_skills: ["S1", "S2_with_more_chars"],
  all_skills: ["A", "ABCDEFGHIJ", "longer_skill_name_here", "S1", "S2_with_more_chars"],
  geo_advantage: null,
  adaptability_signals: 1,
  estimated_monthly_salary_inr: 50000,
  seniority_tier: "PROFESSIONAL",
};

const job: JobTaxonomyRow = {
  job_family: "generic_role",
  category: "general",
  disruption_baseline: 60,
  avg_salary_lpa: 10,
  automatable_tasks: [],
  ai_tools_replacing: [],
};

Deno.test("P0: unmatched skills no longer use string-length-mod pseudo-variance", () => {
  // With ZERO matched skills, every execution skill should get the SAME risk
  // (previously they varied by skill_name.length % 10).
  const result = computeAll(baseProfile, [], [], job, null, false);
  const execAdjustments = (result.score_breakdown.skill_adjustments || [])
    .filter(a => baseProfile.execution_skills.includes(a.skill_name));
  assert(execAdjustments.length === baseProfile.execution_skills.length, "all exec skills should appear");
  const risks = new Set(execAdjustments.map(a => a.automation_risk));
  assertEquals(risks.size, 1, `expected all exec-skill risks identical, got ${[...risks].join(",")}`);
});

Deno.test("P0: kg_disruption_baseline and structural_floor are surfaced on result", () => {
  const result = computeAll(baseProfile, [], [], job, null, false, null, "tier1", null, "general", "IN");
  assertEquals(typeof result.kg_disruption_baseline, "number");
  assertEquals(result.kg_disruption_baseline, 60);
  assert(result.structural_floor >= 60, `structural floor must be >= jobBaseline, got ${result.structural_floor}`);
});

Deno.test("P1: executive moat reductions applied BEFORE multiplier (no hidden negative pre-clamp)", () => {
  const execProfile: ProfileInput = {
    ...baseProfile,
    seniority_tier: "EXECUTIVE",
    experience_years: 18,
    executive_impact: {
      revenue_scope_usd: 50_000_000,
      team_size_org: 200,
      regulatory_domains: ["RBI", "SEBI"],
      board_exposure: true,
      investor_facing: true,
      domain_tenure_years: 12,
      cross_industry_pivots: 2,
    } as any,
  };
  const result = computeAll(execProfile, [], [], { ...job, disruption_baseline: 70 }, null, false);
  // Pre-clamp should be a sane positive number — the old order could push it negative
  // (e.g. round(70*0.4) - 30 reductions = -2). New order: round((70-30)*0.4) = 16.
  assert(result.score_breakdown.pre_clamp_score >= 0,
    `pre-clamp must not be negative under new order, got ${result.score_breakdown.pre_clamp_score}`);
  // Final DI should still be within clamp range
  assert(result.determinism_index >= 5 && result.determinism_index <= 95);
});

Deno.test("P1: safeContainment matches short technical skills via allowlist", () => {
  const skills: SkillRiskRow[] = [
    { skill_name: "SQL", automation_risk: 60, ai_augmentation_potential: 70, human_moat: null, replacement_tools: [], india_demand_trend: "stable", category: "tech" },
    { skill_name: "AWS", automation_risk: 40, ai_augmentation_potential: 50, human_moat: null, replacement_tools: [], india_demand_trend: "growing", category: "tech" },
    { skill_name: "Email Marketing", automation_risk: 75, ai_augmentation_potential: 80, human_moat: null, replacement_tools: [], india_demand_trend: "stable", category: "marketing" },
  ];
  const idx = buildKGSkillIndex(skills);
  // Exact match still works
  assertEquals(matchSkillToKG("SQL", skills, idx)?.skill_name, "SQL");
  assertEquals(matchSkillToKG("aws", skills, idx)?.skill_name, "AWS");
  // Containment still safe: "ai" should NOT match "Email Marketing" (length ratio cap protects)
  assertEquals(matchSkillToKG("ai", skills, idx), null);
  // SQL inside a slightly longer phrase should match (ratio: 6/3 = 2.0, under 2.5 cap... actually 1.6 for short-tech)
  // "TSQL" -> shorter is "sql"(3), longer is "tsql"(4), ratio 1.33 <= 1.6 → match
  assertEquals(matchSkillToKG("TSQL", skills, idx)?.skill_name, "SQL");
});
