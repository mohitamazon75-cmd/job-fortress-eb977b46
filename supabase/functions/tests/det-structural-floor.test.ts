import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "../_shared/det-orchestrator.ts";
import type { ProfileInput, SkillRiskRow, JobTaxonomyRow } from "../_shared/det-types.ts";

const MARKETING_PROFILE: ProfileInput = {
  experience_years: 5,
  execution_skills: ["meta ads", "google ads", "seo"],
  strategic_skills: ["campaign strategy"],
  all_skills: ["meta ads", "google ads", "seo", "campaign strategy"],
  geo_advantage: null,
  adaptability_signals: 2,
  estimated_monthly_salary_inr: 80000,
  seniority_tier: "PROFESSIONAL",
};

const GENERIC_TECH_JOB: JobTaxonomyRow = {
  job_family: "marketing_manager",
  category: "it & software",
  disruption_baseline: 48,
  avg_salary_lpa: 12,
  automatable_tasks: [],
  ai_tools_replacing: [],
};

const MARKETING_SKILLS: SkillRiskRow[] = [
  {
    skill_name: "google ads", automation_risk: 78, ai_augmentation_potential: 70, human_moat: null, replacement_tools: [], india_demand_trend: "stable", category: "marketing"
  },
  {
    skill_name: "meta ads", automation_risk: 76, ai_augmentation_potential: 72, human_moat: null, replacement_tools: [], india_demand_trend: "stable", category: "marketing"
  },
  {
    skill_name: "seo", automation_risk: 72, ai_augmentation_potential: 68, human_moat: null, replacement_tools: [], india_demand_trend: "stable", category: "marketing"
  },
];

Deno.test("structural floor honors high-risk marketing sub-sector over generic job baseline", () => {
  const result = computeAll(
    MARKETING_PROFILE,
    MARKETING_SKILLS,
    [],
    GENERIC_TECH_JOB,
    null,
    false,
    null,
    "tier1",
    null,
    "marketing & advertising",
    "IN",
    null,
    "performance marketing",
  );

  assert(result.determinism_index >= 60, `expected performance marketing floor to keep DI elevated, got ${result.determinism_index}`);
  assert(result.score_variability.di_range.low >= 60, `expected confidence band low bound to respect structural floor, got ${result.score_variability.di_range.low}`);
});

Deno.test("matched high-risk skills still stay within bounds after structural floor enforcement", () => {
  const result = computeAll(
    MARKETING_PROFILE,
    MARKETING_SKILLS,
    [],
    GENERIC_TECH_JOB,
    null,
    false,
    null,
    "tier1",
    null,
    "marketing & advertising",
    "IN",
    null,
    "content marketing",
  );

  assert(result.determinism_index >= 5 && result.determinism_index <= 95);
  assertEquals(result.determinism_index, Math.round(result.determinism_index));
});
