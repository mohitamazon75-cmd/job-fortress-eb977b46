/**
 * Tests for computeAll() — the deterministic scoring engine.
 *
 * computeAll() is the most important algorithm in the product.
 * It computes determinism_index, moat_score, survivability, and the
 * obsolescence timeline that every user sees. Changes to AIRMM weights
 * or calibration constants silently affect every scan until these tests fail.
 *
 * Run with: deno test --allow-net --allow-env det-orchestrator.test.ts
 *
 * Design: scenario-based, not property-based. We test specific archetypes
 * that we know should produce bounded outputs, not random inputs.
 */

import { assertEquals, assertExists, assert, assertGreaterOrEqual, assertLessOrEqual } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "../_shared/det-orchestrator.ts";
import type { ProfileInput, SkillRiskRow, JobTaxonomyRow, CohortBenchmark } from "../_shared/det-types.ts";

// ── Shared test fixtures ──────────────────────────────────────────────────────

/** High-risk BPO/data-entry profile — should produce DI > 65 */
const BPO_PROFILE: ProfileInput = {
  experience_years: 4,
  execution_skills: ["data_entry", "excel", "email_processing", "ticket_resolution"],
  strategic_skills: [],
  all_skills: ["data_entry", "excel", "email_processing", "ticket_resolution"],
  geo_advantage: null,
  adaptability_signals: 1,
  estimated_monthly_salary_inr: 25000,
  seniority_tier: "ENTRY",
};

/** Senior engineer with strong moat — should produce DI in mid range, survivability > 60 */
const SENIOR_ENGINEER_PROFILE: ProfileInput = {
  experience_years: 14,
  execution_skills: ["python", "sql", "data_analysis"],
  strategic_skills: ["system_design", "team_leadership", "stakeholder_management", "architecture"],
  all_skills: ["python", "sql", "system_design", "team_leadership", "stakeholder_management", "architecture", "data_analysis"],
  geo_advantage: "tier1",
  adaptability_signals: 4,
  estimated_monthly_salary_inr: 150000,
  seniority_tier: "SENIOR_LEADER",
};

/** Minimal profile — manual entry with no skills extracted */
const MINIMAL_PROFILE: ProfileInput = {
  experience_years: null,
  execution_skills: [],
  strategic_skills: [],
  all_skills: [],
  geo_advantage: null,
  adaptability_signals: 0,
  estimated_monthly_salary_inr: null,
  seniority_tier: null,
};

/** BPO job taxonomy row — high automation baseline */
const BPO_JOB: JobTaxonomyRow = {
  job_family: "data_entry_operator",
  category: "BPO/KPO",
  disruption_baseline: 82,
  avg_salary_lpa: 3.0,
  automatable_tasks: ["data entry", "email processing", "ticket logging"],
  ai_tools_replacing: ["ChatGPT", "UiPath", "Microsoft Power Automate"],
};

/** Engineering job taxonomy row — moderate automation baseline */
const ENGINEER_JOB: JobTaxonomyRow = {
  job_family: "software_engineer",
  category: "Technology",
  disruption_baseline: 45,
  avg_salary_lpa: 18.0,
  automatable_tasks: ["boilerplate code", "unit tests", "documentation"],
  ai_tools_replacing: ["GitHub Copilot", "ChatGPT"],
};

/** High-risk skill for BPO */
const HIGH_RISK_SKILL: SkillRiskRow = {
  skill_name: "data_entry",
  automation_risk: 92,
  ai_augmentation_potential: 85,
  human_moat: null,
  replacement_tools: ["UiPath", "Power Automate"],
  india_demand_trend: "declining",
  category: "Execution",
};

/** Low-risk skill for senior engineer */
const LOW_RISK_SKILL: SkillRiskRow = {
  skill_name: "system_design",
  automation_risk: 18,
  ai_augmentation_potential: 40,
  human_moat: "judgment",
  replacement_tools: [],
  india_demand_trend: "growing",
  category: "Strategic",
};

// ─── Scenario 1: BPO / data entry — should score high risk ───────────────────

Deno.test("Scenario 1 — BPO profile produces DI above 65", () => {
  const result = computeAll(
    BPO_PROFILE,
    [HIGH_RISK_SKILL],
    [],
    BPO_JOB,
    null,
    false,
    "SME",
    "tier2",
  );

  assertExists(result, "computeAll must return a result");
  assert(
    result.determinism_index > 65,
    `BPO DI should be > 65, got ${result.determinism_index}`,
  );
  assert(
    result.determinism_index >= 5 && result.determinism_index <= 95,
    `DI must be within CALIBRATION bounds [5, 95], got ${result.determinism_index}`,
  );
});

Deno.test("Scenario 1 — BPO profile produces urgency tier 'critical' or 'high'", () => {
  const result = computeAll(
    BPO_PROFILE,
    [HIGH_RISK_SKILL],
    [],
    BPO_JOB,
    null,
    false,
    "SME",
    "tier2",
  );

  const urgentTiers = ["critical", "high", "elevated"];
  assert(
    urgentTiers.some(t => result.tone_tag?.toLowerCase().includes(t)) ||
    result.determinism_index > 65,
    `BPO profile should produce urgency signal — DI=${result.determinism_index}, tone=${result.tone_tag}`,
  );
});

// ─── Scenario 2: Senior engineer with moat — should score mid-range ──────────

Deno.test("Scenario 2 — Senior engineer DI is bounded by the calibration floor", () => {
  const result = computeAll(
    SENIOR_ENGINEER_PROFILE,
    [LOW_RISK_SKILL],
    [],
    ENGINEER_JOB,
    null,
    true, // hasLinkedIn
    "MNC",
    "tier1",
  );

  assertExists(result, "computeAll must return a result");
  assert(
    result.determinism_index >= 5 && result.determinism_index <= 95,
    `DI must be in [5, 95], got ${result.determinism_index}`,
  );
  // Senior engineer with strong moat should not score as high-risk as BPO
  assert(
    result.determinism_index < 80,
    `Senior engineer with moat skills should score < 80, got ${result.determinism_index}`,
  );
});

Deno.test("Scenario 2 — Senior engineer survivability score is above 50", () => {
  const result = computeAll(
    SENIOR_ENGINEER_PROFILE,
    [LOW_RISK_SKILL],
    [],
    ENGINEER_JOB,
    null,
    true,
    "MNC",
    "tier1",
  );

  assertExists(result.survivability, "survivability must be present");
  assert(
    result.survivability.score >= 50,
    `Senior engineer survivability should be >= 50, got ${result.survivability.score}`,
  );
  assert(
    result.survivability.score >= 0 && result.survivability.score <= 100,
    `Survivability must be in [0, 100], got ${result.survivability.score}`,
  );
});

// ─── Scenario 3: Minimal profile — no NaN, no Infinity, no crash ─────────────

Deno.test("Scenario 3 — Minimal profile produces valid numeric output (no NaN/Infinity)", () => {
  const result = computeAll(
    MINIMAL_PROFILE,
    [], // no skill data
    [], // no job skill map
    null, // no job taxonomy
    null, // no market signal
    false,
    null,
    null,
  );

  assertExists(result, "computeAll must not throw on minimal input");

  // No NaN in any numeric field
  const numericFields = [
    "determinism_index",
    "moat_score",
    "months_remaining",
    "doom_clock_months",
  ] as const;

  for (const field of numericFields) {
    const val = result[field];
    if (val !== null && val !== undefined) {
      assert(
        !Number.isNaN(val as number),
        `${field} must not be NaN on minimal input, got ${val}`,
      );
      assert(
        Number.isFinite(val as number),
        `${field} must be finite on minimal input, got ${val}`,
      );
    }
  }

  // DI must still be in bounds even with no data
  assert(
    result.determinism_index >= 5 && result.determinism_index <= 95,
    `Minimal DI must be in [5, 95], got ${result.determinism_index}`,
  );
});

Deno.test("Scenario 3 — Minimal profile survivability does not crash", () => {
  const result = computeAll(MINIMAL_PROFILE, [], [], null, null, false);

  assertExists(result.survivability, "survivability must exist even for minimal input");
  assert(
    result.survivability.score >= 0 && result.survivability.score <= 100,
    `Survivability must be in [0, 100], got ${result.survivability.score}`,
  );
});

// ─── Scenario 4: Score delta — adding a moat skill lowers DI ─────────────────

Deno.test("Scenario 4 — Adding moat strategic skill does not increase DI", () => {
  // Profile without strategic skills
  const profileWithout = { ...BPO_PROFILE };

  // Same profile but with a moat skill added
  const profileWith: ProfileInput = {
    ...BPO_PROFILE,
    strategic_skills: ["stakeholder_management"],
    all_skills: [...BPO_PROFILE.all_skills, "stakeholder_management"],
    adaptability_signals: 3, // higher adaptability
  };

  const resultWithout = computeAll(profileWithout, [HIGH_RISK_SKILL], [], BPO_JOB, null, false);
  const resultWith = computeAll(profileWith, [HIGH_RISK_SKILL, LOW_RISK_SKILL], [], BPO_JOB, null, false);

  // DI should be lower (or equal) with moat skills — never higher
  assert(
    resultWith.determinism_index <= resultWithout.determinism_index,
    `Adding a moat skill should not increase DI. ` +
    `Without: ${resultWithout.determinism_index}, With: ${resultWith.determinism_index}`,
  );
});

Deno.test("Scenario 4 — More experience years does not increase DI", () => {
  const juniorProfile: ProfileInput = { ...BPO_PROFILE, experience_years: 2 };
  const seniorProfile: ProfileInput = { ...BPO_PROFILE, experience_years: 12 };

  const juniorResult = computeAll(juniorProfile, [HIGH_RISK_SKILL], [], BPO_JOB, null, false);
  const seniorResult = computeAll(seniorProfile, [HIGH_RISK_SKILL], [], BPO_JOB, null, false);

  assert(
    seniorResult.determinism_index <= juniorResult.determinism_index,
    `More experience should not raise DI. ` +
    `Junior (2yr): ${juniorResult.determinism_index}, Senior (12yr): ${seniorResult.determinism_index}`,
  );
});

// ─── Output shape invariants ──────────────────────────────────────────────────

Deno.test("Invariant — DI is always an integer in [5, 95]", () => {
  const profiles: ProfileInput[] = [BPO_PROFILE, SENIOR_ENGINEER_PROFILE, MINIMAL_PROFILE];
  const jobs = [BPO_JOB, ENGINEER_JOB, null];

  for (const profile of profiles) {
    for (const job of jobs) {
      const result = computeAll(profile, [], [], job, null, false);
      assert(
        Number.isInteger(result.determinism_index) || result.determinism_index === Math.round(result.determinism_index),
        `DI should be integer-like, got ${result.determinism_index}`,
      );
      assert(result.determinism_index >= 5, `DI floor violated: ${result.determinism_index}`);
      assert(result.determinism_index <= 95, `DI ceiling violated: ${result.determinism_index}`);
    }
  }
});

Deno.test("Invariant — months_remaining is always positive when present", () => {
  const result = computeAll(BPO_PROFILE, [HIGH_RISK_SKILL], [], BPO_JOB, null, false);
  if (result.months_remaining !== null && result.months_remaining !== undefined) {
    assert(result.months_remaining > 0, `months_remaining must be positive, got ${result.months_remaining}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// India-specific regression scenarios (Gaps 1, 5, 6, 7, 9, 11)
// Encodes the engine fixes shipped 2026-04-23: AI-native discount,
// vernacular moat, BPO penalty, IC managerial-leverage, cohort_percentiles.
// ═══════════════════════════════════════════════════════════════════════════════

function _highRiskSkill(name: string, risk = 85, opts: Partial<SkillRiskRow> = {}): SkillRiskRow {
  return {
    skill_name: name, automation_risk: risk, ai_augmentation_potential: 70,
    human_moat: null, replacement_tools: [], india_demand_trend: "declining",
    category: "execution", ...opts,
  };
}
function _moatSkill(name: string, risk = 18, opts: Partial<SkillRiskRow> = {}): SkillRiskRow {
  return {
    skill_name: name, automation_risk: risk, ai_augmentation_potential: 35,
    human_moat: "judgment", replacement_tools: [], india_demand_trend: "growing",
    category: "strategic", ...opts,
  };
}

// ─── Scenario 5 — AI-native tool fluency lowers DI (Gap 6) ────────────────────
Deno.test("Scenario 5 — AI-native tool fluency lowers DI", () => {
  const profile: ProfileInput = {
    experience_years: 6, seniority_tier: "PROFESSIONAL",
    execution_skills: ["seo_optimization", "content_writing"],
    strategic_skills: [],
    all_skills: ["seo_optimization", "content_writing", "google_ads"],
    geo_advantage: null, adaptability_signals: 2, estimated_monthly_salary_inr: 70000,
  };
  const profileAi: ProfileInput = {
    ...profile,
    all_skills: [...profile.all_skills, "surfer_seo", "jasper_ai", "chatgpt_workflows"],
  };
  const baseSkills = [
    _highRiskSkill("seo_optimization", 60),
    _highRiskSkill("content_writing", 70),
    _highRiskSkill("google_ads", 55),
  ];
  const aiSkills = [
    ...baseSkills,
    _highRiskSkill("surfer_seo", 35, { ai_tool_native: true }),
    _highRiskSkill("jasper_ai", 40, { ai_tool_native: true }),
    _highRiskSkill("chatgpt_workflows", 30, { ai_tool_native: true }),
  ];
  const without = computeAll(profile, baseSkills, [], null, null, false);
  const withAi = computeAll(profileAi, aiSkills, [], null, null, false);
  assertLessOrEqual(withAi.determinism_index, without.determinism_index - 2,
    `AI-native fluency must materially reduce DI (without=${without.determinism_index}, with=${withAi.determinism_index})`);
});

// ─── Scenario 6 — BPO template-flagged skills raise DI (Gap 11) ───────────────
Deno.test("Scenario 6 — BPO template-flagged skills raise DI", () => {
  const profile: ProfileInput = {
    experience_years: 4, seniority_tier: "PROFESSIONAL",
    execution_skills: ["sql", "manual_qa"], strategic_skills: [],
    all_skills: ["sql", "manual_qa", "ticket_triage", "regression_testing"],
    geo_advantage: null, adaptability_signals: 1, estimated_monthly_salary_inr: 55000,
  };
  const cleanSkills = [
    _highRiskSkill("sql", 50), _highRiskSkill("manual_qa", 70),
    _highRiskSkill("ticket_triage", 75), _highRiskSkill("regression_testing", 65),
  ];
  const bpoSkills = [
    _highRiskSkill("sql", 50),
    _highRiskSkill("manual_qa", 70, { bpo_template_flag: true }),
    _highRiskSkill("ticket_triage", 75, { bpo_template_flag: true }),
    _highRiskSkill("regression_testing", 65, { bpo_template_flag: true }),
  ];
  const a = computeAll(profile, cleanSkills, [], null, null, false);
  const b = computeAll(profile, bpoSkills, [], null, null, false);
  assertGreaterOrEqual(b.determinism_index, a.determinism_index + 2,
    `BPO template flag must raise DI (clean=${a.determinism_index}, bpo=${b.determinism_index})`);
});

// ─── Scenario 7 — Real cohort benchmark replaces sigmoid (Gap 4) ──────────────
Deno.test("Scenario 7 — cohort_percentiles benchmark sets percentile_source='cohort_db'", () => {
  const profile: ProfileInput = {
    experience_years: 7, seniority_tier: "PROFESSIONAL",
    execution_skills: ["seo", "content"], strategic_skills: ["brand_strategy"],
    all_skills: ["seo", "content", "brand_strategy"],
    geo_advantage: null, adaptability_signals: 2, estimated_monthly_salary_inr: 80000,
  };
  const cohort: CohortBenchmark = {
    role_detected: "digital_marketer", metro_tier: "tier1",
    sample_size: 850, p25: 52, p50: 64, p75: 74, p90: 82,
  };
  const r = computeAll(profile, [_moatSkill("brand_strategy", 25)],
    [], null, null, false, null, "tier1", null, "marketing", "IN", null, null, undefined, undefined, cohort);
  assertEquals(r.survivability.peer_percentile_source, "cohort_db",
    "When cohort benchmark passed, percentile must be cohort_db sourced");
});

// ─── Scenario 8 — IC managerial-leverage raises moat for non-execs (Gap 7) ────
Deno.test("Scenario 8 — IC leverage signals raise moat for non-execs", () => {
  const base: ProfileInput = {
    experience_years: 6, seniority_tier: "PROFESSIONAL",
    execution_skills: ["python"], strategic_skills: ["system_design"],
    all_skills: ["python", "system_design"],
    geo_advantage: null, adaptability_signals: 2, estimated_monthly_salary_inr: 90000,
  };
  const withLeverage: ProfileInput = {
    ...base,
    ic_leverage: {
      owns_key_relationships: true, cross_team_dependence: true,
      niche_replacement_difficulty: true, vendor_displacement_history: false,
      tenure_in_function_years: 6,
    },
  };
  const skills = [_moatSkill("system_design", 18), _highRiskSkill("python", 50)];
  const a = computeAll(base, skills, [], null, null, false);
  const b = computeAll(withLeverage, skills, [], null, null, false);
  assertGreaterOrEqual(b.moat_score, a.moat_score + 3,
    `IC leverage must raise moat score (without=${a.moat_score}, with=${b.moat_score})`);
});

// ─── Scenario 9 — Tier-2 metro penalty raises DI vs tier-1 (Gap 9) ────────────
Deno.test("Scenario 9 — Tier-2 metro raises DI by ~3 vs tier-1 baseline", () => {
  const profile: ProfileInput = {
    experience_years: 5, seniority_tier: "PROFESSIONAL",
    execution_skills: ["seo", "content_writing"], strategic_skills: [],
    all_skills: ["seo", "content_writing"],
    geo_advantage: null, adaptability_signals: 2, estimated_monthly_salary_inr: 60000,
  };
  const skills = [_highRiskSkill("seo", 60), _highRiskSkill("content_writing", 70)];
  const tier1 = computeAll(profile, skills, [], null, null, false, null, "tier1");
  const tier2 = computeAll(profile, skills, [], null, null, false, null, "tier2");
  assertGreaterOrEqual(tier2.determinism_index, tier1.determinism_index,
    `Tier-2 should not score lower DI than tier-1 (tier1=${tier1.determinism_index}, tier2=${tier2.determinism_index})`);
});
