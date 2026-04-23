/**
 * det-orchestrator.test.ts — India-engine regression scenarios for computeAll().
 *
 * computeAll() is the single source of truth for every score the user sees
 * (determinism_index, moat_score, survivability, doom_clock, salary_bleed).
 *
 * Goal: encode the India-specific invariants we just shipped so that any
 * future weight tweak that breaks them fails loudly instead of silently
 * mis-scoring users.
 *
 * Run: deno test --allow-env supabase/functions/_shared/det-orchestrator.test.ts
 */

import {
  assertEquals,
  assertGreaterOrEqual,
  assertLessOrEqual,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "./det-orchestrator.ts";
import type { ProfileInput, SkillRiskRow, JobTaxonomyRow, CohortBenchmark } from "./det-types.ts";

// ── Shared fixtures ─────────────────────────────────────────────

function highRiskSkill(name: string, risk = 85, opts: Partial<SkillRiskRow> = {}): SkillRiskRow {
  return {
    skill_name: name,
    automation_risk: risk,
    ai_augmentation_potential: 70,
    human_moat: null,
    replacement_tools: [],
    india_demand_trend: "declining",
    category: "execution",
    ...opts,
  };
}

function moatSkill(name: string, risk = 18, opts: Partial<SkillRiskRow> = {}): SkillRiskRow {
  return {
    skill_name: name,
    automation_risk: risk,
    ai_augmentation_potential: 35,
    human_moat: "judgment",
    replacement_tools: [],
    india_demand_trend: "growing",
    category: "strategic",
    ...opts,
  };
}

const BPO_JOB: JobTaxonomyRow = {
  job_family: "data_entry_operator",
  category: "BPO/KPO",
  disruption_baseline: 80,
  avg_salary_lpa: 3.0,
  automatable_tasks: ["data entry", "ticket logging"],
  ai_tools_replacing: ["UiPath", "ChatGPT"],
};

// ── SCENARIO 1: BPO data-entry — high DI, low survivability ────
Deno.test("Scenario 1 — BPO data-entry: DI is high, survivability is low", () => {
  const profile: ProfileInput = {
    experience_years: 3,
    seniority_tier: "ENTRY",
    execution_skills: ["data_entry", "excel_data_input", "form_filling"],
    strategic_skills: [],
    all_skills: ["data_entry", "excel_data_input", "form_filling", "copy_paste", "typing"],
    geo_advantage: null,
    adaptability_signals: 1,
    estimated_monthly_salary_inr: 22000,
  };

  const skills = [
    highRiskSkill("data_entry", 92),
    highRiskSkill("excel_data_input", 88),
    highRiskSkill("form_filling", 90),
    highRiskSkill("typing", 85),
  ];

  const result = computeAll(profile, skills, [], BPO_JOB, null, false);

  assertGreaterOrEqual(result.determinism_index, 60, `BPO DI should be >= 60, got ${result.determinism_index}`);
  assertLessOrEqual(result.determinism_index, 95, "DI clamped at 95");
  assertLessOrEqual(result.survivability.score, 60, `BPO survivability should be <= 60, got ${result.survivability.score}`);
  assertLessOrEqual(result.months_remaining, 36, "BPO doom clock urgent");
});

// ── SCENARIO 2: Senior engineer with moat skills < BPO entry ────
Deno.test("Scenario 2 — Senior engineer DI < BPO DI; survivability higher", () => {
  const bpo: ProfileInput = {
    experience_years: 3,
    seniority_tier: "ENTRY",
    execution_skills: ["data_entry"],
    strategic_skills: [],
    all_skills: ["data_entry", "excel_data_input"],
    geo_advantage: null,
    adaptability_signals: 1,
    estimated_monthly_salary_inr: 22000,
  };
  const senior: ProfileInput = {
    experience_years: 12,
    seniority_tier: "MANAGER",
    execution_skills: ["python", "sql"],
    strategic_skills: ["system_design", "technical_leadership"],
    all_skills: ["python", "sql", "system_design", "technical_leadership", "machine_learning"],
    geo_advantage: null,
    adaptability_signals: 3,
    estimated_monthly_salary_inr: 200000,
  };

  const bpoSkills = [highRiskSkill("data_entry", 92), highRiskSkill("excel_data_input", 88)];
  const seniorSkills = [
    moatSkill("system_design", 15),
    moatSkill("technical_leadership", 10),
    moatSkill("machine_learning", 22),
    highRiskSkill("python", 55),
  ];

  const bpoResult = computeAll(bpo, bpoSkills, [], BPO_JOB, null, false);
  const seniorResult = computeAll(senior, seniorSkills, [], null, null, false);

  assertLessOrEqual(seniorResult.determinism_index, bpoResult.determinism_index,
    `Senior DI (${seniorResult.determinism_index}) must be <= BPO DI (${bpoResult.determinism_index})`);
  assertGreaterOrEqual(seniorResult.survivability.score, bpoResult.survivability.score,
    "Senior survivability must be >= BPO survivability");
});

// ── SCENARIO 3: Empty profile produces no NaN / Infinity ────────
Deno.test("Scenario 3 — Empty profile yields finite numbers within clamps", () => {
  const minimal: ProfileInput = {
    experience_years: null,
    seniority_tier: null,
    execution_skills: [],
    strategic_skills: [],
    all_skills: [],
    geo_advantage: null,
    adaptability_signals: 0,
    estimated_monthly_salary_inr: null,
  };
  const r = computeAll(minimal, [], [], null, null, false);
  for (const n of [r.determinism_index, r.survivability.score, r.months_remaining, r.salary_bleed_monthly]) {
    assertEquals(isNaN(n), false, "no NaN");
    assertEquals(isFinite(n), true, "finite");
  }
  assertGreaterOrEqual(r.determinism_index, 5);
  assertLessOrEqual(r.determinism_index, 95);
});

// ── SCENARIO 4: Adding moat skills lowers DI (core invariant) ──
Deno.test("Scenario 4 — Adding moat skills lowers DI (model invariant)", () => {
  const base: ProfileInput = {
    experience_years: 5,
    seniority_tier: "PROFESSIONAL",
    execution_skills: ["data_analysis", "excel"],
    strategic_skills: [],
    all_skills: ["data_analysis", "excel", "reporting"],
    geo_advantage: null,
    adaptability_signals: 1,
    estimated_monthly_salary_inr: 60000,
  };
  const withMoat: ProfileInput = {
    ...base,
    all_skills: [...base.all_skills, "strategic_thinking", "stakeholder_management"],
    strategic_skills: ["strategic_thinking", "stakeholder_management"],
  };
  const skills = [
    highRiskSkill("data_analysis", 70),
    highRiskSkill("excel", 85),
    highRiskSkill("reporting", 75),
    moatSkill("strategic_thinking", 12),
    moatSkill("stakeholder_management", 14),
  ];
  const a = computeAll(base, skills, [], null, null, false);
  const b = computeAll(withMoat, skills, [], null, null, false);
  assertLessOrEqual(b.determinism_index, a.determinism_index,
    `DI with moat (${b.determinism_index}) must be <= base (${a.determinism_index})`);
});

// ── SCENARIO 5 (NEW): AI-native tools lower DI for marketing role ─
// Encodes Gap 6 fix: a marketer using Surfer/Jasper/ChatGPT is materially safer
// than the same marketer doing manual SEO. If this test breaks, the AI-native
// discount in det-scoring.ts has been broken.
Deno.test("Scenario 5 — AI-native tool fluency lowers DI", () => {
  const profile: ProfileInput = {
    experience_years: 6,
    seniority_tier: "PROFESSIONAL",
    execution_skills: ["seo_optimization", "content_writing"],
    strategic_skills: [],
    all_skills: ["seo_optimization", "content_writing", "google_ads"],
    geo_advantage: null,
    adaptability_signals: 2,
    estimated_monthly_salary_inr: 70000,
  };
  const profileAi: ProfileInput = {
    ...profile,
    all_skills: [...profile.all_skills, "surfer_seo", "jasper_ai", "chatgpt_workflows"],
  };
  const baseSkills = [
    highRiskSkill("seo_optimization", 60),
    highRiskSkill("content_writing", 70),
    highRiskSkill("google_ads", 55),
  ];
  const aiSkills = [
    ...baseSkills,
    highRiskSkill("surfer_seo", 35, { ai_tool_native: true }),
    highRiskSkill("jasper_ai", 40, { ai_tool_native: true }),
    highRiskSkill("chatgpt_workflows", 30, { ai_tool_native: true }),
  ];
  const without = computeAll(profile, baseSkills, [], null, null, false);
  const withAi = computeAll(profileAi, aiSkills, [], null, null, false);
  assertLessOrEqual(withAi.determinism_index, without.determinism_index - 2,
    `AI-native fluency must materially reduce DI (got without=${without.determinism_index}, with=${withAi.determinism_index})`);
});

// ── SCENARIO 6 (NEW): BPO template work raises DI ─────────────────
Deno.test("Scenario 6 — BPO template-flagged skills raise DI", () => {
  const profile: ProfileInput = {
    experience_years: 4,
    seniority_tier: "PROFESSIONAL",
    execution_skills: ["sql", "manual_qa"],
    strategic_skills: [],
    all_skills: ["sql", "manual_qa", "ticket_triage", "regression_testing"],
    geo_advantage: null,
    adaptability_signals: 1,
    estimated_monthly_salary_inr: 55000,
  };
  const cleanSkills = [
    highRiskSkill("sql", 50),
    highRiskSkill("manual_qa", 70),
    highRiskSkill("ticket_triage", 75),
    highRiskSkill("regression_testing", 65),
  ];
  const bpoSkills = [
    highRiskSkill("sql", 50),
    highRiskSkill("manual_qa", 70, { bpo_template_flag: true }),
    highRiskSkill("ticket_triage", 75, { bpo_template_flag: true }),
    highRiskSkill("regression_testing", 65, { bpo_template_flag: true }),
  ];
  const a = computeAll(profile, cleanSkills, [], null, null, false);
  const b = computeAll(profile, bpoSkills, [], null, null, false);
  assertGreaterOrEqual(b.determinism_index, a.determinism_index + 2,
    `BPO template flag must raise DI (clean=${a.determinism_index}, bpo=${b.determinism_index})`);
});

// ── SCENARIO 7 (NEW): Real cohort benchmark replaces sigmoid ──────
Deno.test("Scenario 7 — cohort_percentiles benchmark sets percentile_source='cohort_db'", () => {
  const profile: ProfileInput = {
    experience_years: 7,
    seniority_tier: "PROFESSIONAL",
    execution_skills: ["seo", "content"],
    strategic_skills: ["brand_strategy"],
    all_skills: ["seo", "content", "brand_strategy"],
    geo_advantage: null,
    adaptability_signals: 2,
    estimated_monthly_salary_inr: 80000,
  };
  const cohort: CohortBenchmark = {
    role_detected: "digital_marketer",
    metro_tier: "tier1",
    sample_size: 850,
    p25: 52, p50: 64, p75: 74, p90: 82,
  };
  const r = computeAll(profile, [moatSkill("brand_strategy", 25)],
    [], null, null, false, null, "tier1", null, "marketing", "IN", null, null, undefined, undefined, cohort);
  assertEquals(r.survivability.peer_percentile_source, "cohort_db",
    "When cohort benchmark passed, percentile must be cohort_db sourced");
});

// ── SCENARIO 8 (NEW): IC managerial-leverage raises moat score ────
Deno.test("Scenario 8 — IC leverage signals raise moat for non-execs", () => {
  const base: ProfileInput = {
    experience_years: 6,
    seniority_tier: "PROFESSIONAL",
    execution_skills: ["python"],
    strategic_skills: ["system_design"],
    all_skills: ["python", "system_design"],
    geo_advantage: null,
    adaptability_signals: 2,
    estimated_monthly_salary_inr: 90000,
  };
  const withLeverage: ProfileInput = {
    ...base,
    ic_leverage: {
      owns_key_relationships: true,
      cross_team_dependence: true,
      niche_replacement_difficulty: true,
      vendor_displacement_history: false,
      tenure_in_function_years: 6,
    },
  };
  const skills = [moatSkill("system_design", 18), highRiskSkill("python", 50)];
  const a = computeAll(base, skills, [], null, null, false);
  const b = computeAll(withLeverage, skills, [], null, null, false);
  assertGreaterOrEqual(b.moat_score, a.moat_score + 3,
    `IC leverage must raise moat score (without=${a.moat_score}, with=${b.moat_score})`);
});
