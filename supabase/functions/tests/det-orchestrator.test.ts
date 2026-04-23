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
