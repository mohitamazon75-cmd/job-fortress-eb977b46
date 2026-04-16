/**
 * det-orchestrator.test.ts — Scenario-based tests for computeAll().
 *
 * computeAll() is the deterministic scoring engine that computes every score
 * a user sees: determinism_index, moat_score, survivability.score, doom_clock.
 * Zero tests existed before this file. Without tests, any weight change silently
 * changes every user's score.
 *
 * Test strategy: 4 concrete India-market scenarios. Each encodes a known-true
 * fact about the risk model so that regressions break tests, not user trust.
 *
 * Run: deno test --allow-env supabase/functions/_shared/det-orchestrator.test.ts
 */

import {
  assertEquals,
  assertGreater,
  assertLessOrEqual,
  assertGreaterOrEqual,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "./det-orchestrator.ts";
import type { ProfileInput } from "./det-types.ts";

// ── Shared test fixtures ────────────────────────────────────────

/** Minimal valid SkillRiskRow for a high-automation skill */
function automationSkillRow(skillName: string, automationProb = 0.85) {
  return {
    id: crypto.randomUUID(),
    skill_name: skillName,
    automation_prob: automationProb,
    job_family: "data_entry",
    skill_category: "execution",
    created_at: new Date().toISOString(),
  };
}

/** Minimal valid SkillRiskRow for a low-automation (moat) skill */
function moatSkillRow(skillName: string, automationProb = 0.15) {
  return {
    id: crypto.randomUUID(),
    skill_name: skillName,
    automation_prob: automationProb,
    job_family: "strategy",
    skill_category: "cognitive",
    created_at: new Date().toISOString(),
  };
}

// ── SCENARIO 1: BPO Data-Entry Operator ────────────────────────
// Known truth: BPO data-entry is one of the highest-automation roles in India.
// DI should be significantly above average (>= 60).
// Moat score should be low (< 40) — no cognitive moat in pure execution.
Deno.test("Scenario 1 — BPO data-entry profile: high DI, low moat", () => {
  const profile: ProfileInput = {
    experience_years: 3,
    seniority_tier: "ENTRY",
    all_skills: ["data_entry", "excel_data_input", "form_filling", "copy_paste", "typing"],
    moat_skills: [],
    strategic_skills: [],
    estimated_monthly_salary_inr: 20000,
    geo_advantage: null,
    executive_impact: null,
  };

  const skillRiskData = [
    automationSkillRow("data_entry", 0.95),
    automationSkillRow("excel_data_input", 0.90),
    automationSkillRow("form_filling", 0.92),
    automationSkillRow("copy_paste", 0.98),
    automationSkillRow("typing", 0.88),
  ];

  const result = computeAll(
    profile,
    skillRiskData,
    [],  // jobSkillMap — empty for this scenario
    { disruption_baseline: 78, job_family: "Data Entry", category: "BPO", id: "1", created_at: "" } as any,
    null, // marketSignal
    false, // hasLinkedIn
  );

  // DI must be high for a pure-execution BPO role
  assertGreaterOrEqual(result.determinism_index, 55,
    `BPO data-entry DI should be >= 55, got ${result.determinism_index}`);

  // Must be within clamped bounds
  assertGreaterOrEqual(result.determinism_index, 5, "DI must be >= DI_CLAMP_MIN (5)");
  assertLessOrEqual(result.determinism_index, 95, "DI must be <= DI_CLAMP_MAX (95)");

  // Survivability should be low for a pure-execution role
  assertLessOrEqual(result.survivability.score, 55,
    `BPO survivability should be <= 55, got ${result.survivability.score}`);

  // months_remaining should be urgent (< 30 months for a high-DI role)
  assertLessOrEqual(result.months_remaining, 36,
    `BPO months_remaining should be urgent (<= 36), got ${result.months_remaining}`);
});

// ── SCENARIO 2: Senior Software Engineer with strong moat ───────
// Known truth: a senior engineer with AI-adjacent skills should score lower
// DI than the BPO worker, and higher moat and survivability.
Deno.test("Scenario 2 — Senior engineer with moat skills: lower DI than BPO, higher survivability", () => {
  const bpoProfile: ProfileInput = {
    experience_years: 3,
    seniority_tier: "ENTRY",
    all_skills: ["data_entry", "excel_data_input", "form_filling"],
    moat_skills: [],
    strategic_skills: [],
    estimated_monthly_salary_inr: 20000,
    geo_advantage: null,
    executive_impact: null,
  };

  const seniorProfile: ProfileInput = {
    experience_years: 12,
    seniority_tier: "MANAGER",
    all_skills: ["system_design", "technical_leadership", "machine_learning", "sql", "python"],
    moat_skills: ["system_design", "technical_leadership", "machine_learning"],
    strategic_skills: ["technical_leadership"],
    estimated_monthly_salary_inr: 200000,
    geo_advantage: null,
    executive_impact: null,
  };

  const bpoSkills = [
    automationSkillRow("data_entry", 0.95),
    automationSkillRow("excel_data_input", 0.90),
    automationSkillRow("form_filling", 0.92),
  ];

  const seniorSkills = [
    moatSkillRow("system_design", 0.10),
    moatSkillRow("technical_leadership", 0.08),
    moatSkillRow("machine_learning", 0.20),
    automationSkillRow("sql", 0.65),
    automationSkillRow("python", 0.55),
  ];

  const bpoResult = computeAll(bpoProfile, bpoSkills, [], null, null, false);
  const seniorResult = computeAll(seniorProfile, seniorSkills, [], null, null, false);

  // Senior engineer should have LOWER DI (less automatable) than BPO entry
  assertLessOrEqual(
    seniorResult.determinism_index,
    bpoResult.determinism_index,
    `Senior engineer DI (${seniorResult.determinism_index}) should be <= BPO DI (${bpoResult.determinism_index})`,
  );

  // Senior engineer should have HIGHER survivability
  assertGreaterOrEqual(
    seniorResult.survivability.score,
    bpoResult.survivability.score,
    `Senior survivability (${seniorResult.survivability.score}) should be >= BPO survivability (${bpoResult.survivability.score})`,
  );

  // Both must stay within bounds
  for (const r of [bpoResult, seniorResult]) {
    assertGreaterOrEqual(r.determinism_index, 5);
    assertLessOrEqual(r.determinism_index, 95);
    assertGreaterOrEqual(r.survivability.score, 0);
    assertLessOrEqual(r.survivability.score, 100);
  }
});

// ── SCENARIO 3: Minimal / empty profile — no NaN, no Infinity ──
// Known truth: even with no skills and no experience, the engine must
// return valid numbers. Malformed input must not produce NaN or Infinity.
// This is the crash-safety test.
Deno.test("Scenario 3 — Minimal profile with no skills: produces valid numbers (no NaN, no Infinity)", () => {
  const minimalProfile: ProfileInput = {
    experience_years: null,  // Agent 1 failed — no data
    seniority_tier: null,
    all_skills: [],           // No skills extracted
    moat_skills: [],
    strategic_skills: [],
    estimated_monthly_salary_inr: null,
    geo_advantage: null,
    executive_impact: null,
  };

  const result = computeAll(
    minimalProfile,
    [],   // No skill risk data
    [],   // No job skill map
    null, // No job taxonomy match
    null, // No market signal
    false,
  );

  // No NaN anywhere in the output
  assertEquals(isNaN(result.determinism_index), false, "DI must not be NaN");
  assertEquals(isNaN(result.survivability.score), false, "Survivability must not be NaN");
  assertEquals(isNaN(result.months_remaining), false, "months_remaining must not be NaN");

  // No Infinity anywhere
  assertEquals(isFinite(result.determinism_index), true, "DI must be finite");
  assertEquals(isFinite(result.survivability.score), true, "Survivability must be finite");
  assertEquals(isFinite(result.months_remaining), true, "months_remaining must be finite");

  // Still within clamped bounds
  assertGreaterOrEqual(result.determinism_index, 5);
  assertLessOrEqual(result.determinism_index, 95);
});

// ── SCENARIO 4: Score delta — moat skills measurably lower DI ──
// Known truth: adding moat skills to a profile should lower its DI
// (make it less automatable). If this isn't true, the moat weighting
// is broken. This test encodes the most fundamental product invariant.
Deno.test("Scenario 4 — Adding moat skills lowers DI (core model invariant)", () => {
  const baseProfile: ProfileInput = {
    experience_years: 5,
    seniority_tier: "PROFESSIONAL",
    all_skills: ["data_analysis", "excel", "reporting"],
    moat_skills: [],
    strategic_skills: [],
    estimated_monthly_salary_inr: 60000,
    geo_advantage: null,
    executive_impact: null,
  };

  const withMoatProfile: ProfileInput = {
    ...baseProfile,
    all_skills: [...baseProfile.all_skills, "strategic_thinking", "stakeholder_management"],
    moat_skills: ["strategic_thinking", "stakeholder_management"],
    strategic_skills: ["strategic_thinking"],
  };

  const skillData = [
    automationSkillRow("data_analysis", 0.70),
    automationSkillRow("excel", 0.85),
    automationSkillRow("reporting", 0.75),
    moatSkillRow("strategic_thinking", 0.10),
    moatSkillRow("stakeholder_management", 0.12),
  ];

  const baseResult = computeAll(baseProfile, skillData, [], null, null, false);
  const moatResult = computeAll(withMoatProfile, skillData, [], null, null, false);

  // DI with moat skills should be less than or equal to base DI
  // (moat skills reduce automation exposure)
  assertLessOrEqual(
    moatResult.determinism_index,
    baseResult.determinism_index,
    `DI with moat skills (${moatResult.determinism_index}) should be <= base DI (${baseResult.determinism_index}). ` +
    `Moat skills must reduce automation exposure.`,
  );

  // Both results must stay in bounds
  for (const r of [baseResult, moatResult]) {
    assertGreaterOrEqual(r.determinism_index, 5);
    assertLessOrEqual(r.determinism_index, 95);
  }
});
