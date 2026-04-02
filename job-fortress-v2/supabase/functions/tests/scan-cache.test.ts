import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCacheCompatible } from "../_shared/scan-cache.ts";

// ── isCacheCompatible tests ───────────────────────────────────

Deno.test("Cache — null/undefined returns false", () => {
  assertEquals(isCacheCompatible(null), false);
  assertEquals(isCacheCompatible(undefined), false);
  assertEquals(isCacheCompatible("string"), false);
  assertEquals(isCacheCompatible(42), false);
});

Deno.test("Cache — empty object returns false (missing weekly_survival_diet)", () => {
  assertEquals(isCacheCompatible({}), false);
});

Deno.test("Cache — missing skill signal returns false", () => {
  assertEquals(isCacheCompatible({
    weekly_survival_diet: { items: [] },
    _engine_version: 5,
    moat_score: 50,
  }), false);
});

Deno.test("Cache — valid report with all_skills passes", () => {
  const report = {
    weekly_survival_diet: { items: [] },
    all_skills: ["Python", "SQL"],
    moat_score: 50,
    _engine_version: 5,
  };
  assertEquals(isCacheCompatible(report), true);
});

Deno.test("Cache — valid report with execution_skills_dead passes", () => {
  const report = {
    weekly_survival_diet: {},
    execution_skills_dead: ["Data Entry"],
    moat_score: 60,
    _engine_version: 5,
  };
  assertEquals(isCacheCompatible(report), true);
});

Deno.test("Cache — valid report with score_breakdown.skill_adjustments passes", () => {
  const report = {
    weekly_survival_diet: {},
    score_breakdown: { skill_adjustments: [{ skill: "Excel", delta: -5 }] },
    moat_score: 40,
    _engine_version: 5,
  };
  assertEquals(isCacheCompatible(report), true);
});

Deno.test("Cache — incompatible market_position_model fails", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: 50,
    _engine_version: 5,
    market_position_model: { wrong_field: true },
  };
  assertEquals(isCacheCompatible(report), false);
});

Deno.test("Cache — compatible market_position_model with gaussian_fit_percentile passes", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: 50,
    _engine_version: 5,
    market_position_model: { gaussian_fit_percentile: 45 },
  };
  assertEquals(isCacheCompatible(report), true);
});

Deno.test("Cache — incompatible career_shock_simulator fails", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: 50,
    _engine_version: 5,
    career_shock_simulator: { wrong_field: true },
  };
  assertEquals(isCacheCompatible(report), false);
});

Deno.test("Cache — career_shock_simulator with estimated_job_search_months passes", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: 50,
    _engine_version: 5,
    career_shock_simulator: { estimated_job_search_months: 6 },
  };
  assertEquals(isCacheCompatible(report), true);
});

Deno.test("Cache — engine_version < 5 fails hasTier", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: 50,
    _engine_version: 4,
  };
  assertEquals(isCacheCompatible(report), false);
});

Deno.test("Cache — null moat_score fails hasTier", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    moat_score: null,
    _engine_version: 5,
  };
  assertEquals(isCacheCompatible(report), false);
});

Deno.test("Cache — missing moat_score fails hasTier", () => {
  const report = {
    weekly_survival_diet: {},
    all_skills: ["Python"],
    _engine_version: 5,
  };
  assertEquals(isCacheCompatible(report), false);
});
