/**
 * Regression replay test suite.
 *
 * Replays the audit's known scoring/KG edge cases through the post-fix
 * deterministic kernel and pins the verdict outputs (DI, survivability, tone,
 * replacing-tool count, salary-bleed direction) so any future regression in
 * det-scoring / det-utils / det-orchestrator / det-lifecycle is caught loudly.
 *
 * Golden values were captured on 2026-04-26 after the P0/P1 audit fixes:
 *   - P0 string-length pseudo-risk removed
 *   - P0 experience reverse-engineering removed
 *   - P0 kg_disruption_baseline surfaced server-side
 *   - P1 moat reductions applied BEFORE executive multiplier
 *   - P1 short-tech allowlist in safeContainment
 *   - 2026-04-24 BD industry override / tool-task guard / executive salary anchor
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "../_shared/det-orchestrator.ts";
import { calculateSalaryBleed } from "../_shared/det-lifecycle.ts";
import { applyFunctionalIndustryOverride } from "../_shared/scan-helpers.ts";
import { isPlausibleToolTaskPair } from "../_shared/tool-task-capability-map.ts";
import type {
  ProfileInput,
  SkillRiskRow,
  JobTaxonomyRow,
  MarketSignalRow,
} from "../_shared/det-types.ts";

// ── Fixtures (mirror regression-replay.ts) ──────────────────────────────────

const MS_DECLINING: MarketSignalRow = {
  posting_change_pct: -22,
  avg_salary_change_pct: -8,
  ai_job_mentions_pct: 38,
  market_health: "declining",
};

const SKILL = {
  data_entry: {
    skill_name: "data_entry", automation_risk: 92, ai_augmentation_potential: 85,
    human_moat: null, replacement_tools: ["UiPath", "Power Automate"],
    india_demand_trend: "declining", category: "Execution",
  } as SkillRiskRow,
  python: {
    skill_name: "python", automation_risk: 38, ai_augmentation_potential: 70,
    human_moat: null, replacement_tools: ["GitHub Copilot", "ChatGPT"],
    india_demand_trend: "growing", category: "Execution",
  } as SkillRiskRow,
  system_design: {
    skill_name: "system_design", automation_risk: 18, ai_augmentation_potential: 40,
    human_moat: "judgment", replacement_tools: [],
    india_demand_trend: "growing", category: "Strategic",
  } as SkillRiskRow,
  negotiation: {
    skill_name: "enterprise_negotiation", automation_risk: 12, ai_augmentation_potential: 35,
    human_moat: "trust", replacement_tools: [],
    india_demand_trend: "growing", category: "Strategic",
  } as SkillRiskRow,
  bd: {
    skill_name: "business_development", automation_risk: 28, ai_augmentation_potential: 55,
    human_moat: "relationships", replacement_tools: ["Apollo", "Outreach"],
    india_demand_trend: "stable", category: "Strategic",
  } as SkillRiskRow,
  copywriting: {
    skill_name: "copywriting", automation_risk: 76, ai_augmentation_potential: 80,
    human_moat: null, replacement_tools: ["ChatGPT", "Jasper", "Copy.ai"],
    india_demand_trend: "declining", category: "Execution",
  } as SkillRiskRow,
};

const JOB = {
  bpo: {
    job_family: "data_entry_operator", category: "BPO/KPO", disruption_baseline: 82,
    avg_salary_lpa: 3, automatable_tasks: ["data entry"], ai_tools_replacing: ["UiPath"],
  } as JobTaxonomyRow,
  engineer: {
    job_family: "software_engineer", category: "Technology", disruption_baseline: 45,
    avg_salary_lpa: 18, automatable_tasks: ["boilerplate code", "unit tests"],
    ai_tools_replacing: ["GitHub Copilot"],
  } as JobTaxonomyRow,
  bd: {
    job_family: "business_development", category: "Sales", disruption_baseline: 38,
    avg_salary_lpa: 14, automatable_tasks: ["lead qualification", "email drafts"],
    ai_tools_replacing: ["Apollo", "ChatGPT"],
  } as JobTaxonomyRow,
  founder: {
    job_family: "founder_ceo", category: "Executive", disruption_baseline: 22,
    avg_salary_lpa: 60, automatable_tasks: ["scheduling", "email"],
    ai_tools_replacing: ["ChatGPT"],
  } as JobTaxonomyRow,
  copywriter: {
    job_family: "copywriter", category: "Marketing", disruption_baseline: 72,
    avg_salary_lpa: 7, automatable_tasks: ["blog drafts", "ad copy"],
    ai_tools_replacing: ["ChatGPT", "Jasper", "Copy.ai"],
  } as JobTaxonomyRow,
};

// ── Golden expectations (captured 2026-04-26 post-fix) ──────────────────────

interface Golden {
  label: string;
  profile: ProfileInput;
  skills: SkillRiskRow[];
  job: JobTaxonomyRow;
  marketSignal: MarketSignalRow | null;
  industry: string;
  parsedIndustry: string;
  jobTitle: string;
  expectedIndustryOverridden: boolean;
  expected: {
    determinism_index: number;
    survivability: number;
    tone_tag: string;
    replacing_tools_count: number;
    // Salary bleed: NEW (tier-aware) monthly INR — exact post-fix value
    bleed_monthly_new: number;
    // True iff tier-aware bleed is strictly less than the no-tier baseline
    tier_anchor_reduces_bleed: boolean;
  };
}

const GOLDEN: Golden[] = [
  {
    label: "BPO data-entry, ENTRY tier",
    profile: {
      experience_years: 4, execution_skills: ["data_entry", "excel"],
      strategic_skills: [], all_skills: ["data_entry", "excel"],
      geo_advantage: null, adaptability_signals: 1,
      estimated_monthly_salary_inr: 28000, seniority_tier: "ENTRY",
    },
    skills: [SKILL.data_entry], job: JOB.bpo, marketSignal: MS_DECLINING,
    industry: "BPO/KPO", parsedIndustry: "BPO/KPO", jobTitle: "Data Entry Operator",
    expectedIndustryOverridden: false,
    expected: {
      determinism_index: 78, survivability: 28, tone_tag: "WARNING",
      replacing_tools_count: 2, bleed_monthly_new: 1357,
      tier_anchor_reduces_bleed: false, // ENTRY: anchor == baseline
    },
  },
  {
    label: "Senior software engineer, Tier-1",
    profile: {
      experience_years: 14,
      execution_skills: ["python", "sql"],
      strategic_skills: ["system_design", "team_leadership", "stakeholder_management"],
      all_skills: ["python", "sql", "system_design", "team_leadership", "stakeholder_management"],
      geo_advantage: "tier1", adaptability_signals: 4,
      estimated_monthly_salary_inr: 350000, seniority_tier: "SENIOR_LEADER",
    },
    skills: [SKILL.python, SKILL.system_design], job: JOB.engineer, marketSignal: null,
    industry: "IT & Software", parsedIndustry: "IT & Software", jobTitle: "Senior Software Engineer",
    expectedIndustryOverridden: false,
    expected: {
      determinism_index: 33, survivability: 81, tone_tag: "STABLE",
      replacing_tools_count: 2, bleed_monthly_new: 2277,
      tier_anchor_reduces_bleed: true,
    },
  },
  {
    label: "BD lead at SaaS (audit case: industry override)",
    profile: {
      experience_years: 10,
      execution_skills: ["lead_generation", "email_outreach"],
      strategic_skills: ["enterprise_negotiation", "business_development", "stakeholder_management"],
      all_skills: ["lead_generation", "email_outreach", "enterprise_negotiation", "business_development", "stakeholder_management"],
      geo_advantage: "tier1", adaptability_signals: 3,
      estimated_monthly_salary_inr: 180000, seniority_tier: "MANAGER",
    },
    skills: [SKILL.bd, SKILL.negotiation], job: JOB.bd, marketSignal: null,
    industry: "Sales & Business Development",
    parsedIndustry: "IT & Software", jobTitle: "Head of Business Development",
    expectedIndustryOverridden: true,
    expected: {
      determinism_index: 35, survivability: 64, tone_tag: "STABLE",
      replacing_tools_count: 2, bleed_monthly_new: 1828,
      tier_anchor_reduces_bleed: true,
    },
  },
  {
    label: "Founder/CEO (audit case: salary anchor)",
    profile: {
      experience_years: 18,
      execution_skills: ["pitching", "fundraising"],
      strategic_skills: ["strategy", "team_leadership", "stakeholder_management", "investor_relations"],
      all_skills: ["pitching", "fundraising", "strategy", "team_leadership", "stakeholder_management", "investor_relations"],
      geo_advantage: "tier1", adaptability_signals: 5,
      estimated_monthly_salary_inr: 800000, seniority_tier: "EXECUTIVE",
    },
    skills: [SKILL.negotiation], job: JOB.founder, marketSignal: null,
    industry: "IT & Software", parsedIndustry: "IT & Software", jobTitle: "Founder & CEO",
    expectedIndustryOverridden: false,
    expected: {
      determinism_index: 40, survivability: 91, tone_tag: "STABLE",
      replacing_tools_count: 0, // ChatGPT × pitching dropped by guard
      bleed_monthly_new: 4172,
      tier_anchor_reduces_bleed: true,
    },
  },
  {
    label: "Mid-level copywriter (high-risk skill)",
    profile: {
      experience_years: 7,
      execution_skills: ["copywriting", "blog_writing", "ad_copy"],
      strategic_skills: ["brand_strategy"],
      all_skills: ["copywriting", "blog_writing", "ad_copy", "brand_strategy"],
      geo_advantage: null, adaptability_signals: 2,
      estimated_monthly_salary_inr: 70000, seniority_tier: "PROFESSIONAL",
    },
    skills: [SKILL.copywriting], job: JOB.copywriter, marketSignal: MS_DECLINING,
    industry: "Marketing & Advertising",
    parsedIndustry: "Marketing & Advertising", jobTitle: "Senior Copywriter",
    expectedIndustryOverridden: false,
    expected: {
      determinism_index: 77, survivability: 43, tone_tag: "WARNING",
      replacing_tools_count: 3, bleed_monthly_new: 3375,
      tier_anchor_reduces_bleed: false, // PROFESSIONAL: anchor == baseline
    },
  },
];

// ── Verdict golden tests ────────────────────────────────────────────────────

for (const g of GOLDEN) {
  Deno.test(`replay verdict — ${g.label}`, () => {
    // Industry override invariant
    const ov = applyFunctionalIndustryOverride(g.parsedIndustry, g.jobTitle);
    assertEquals(ov.overridden, g.expectedIndustryOverridden,
      `industry override flag mismatch for "${g.label}"`);
    assertEquals(ov.industry, g.industry,
      `resolved industry mismatch for "${g.label}"`);

    const result = computeAll(
      g.profile, g.skills, [], g.job, g.marketSignal,
      false, "SME", g.profile.geo_advantage ?? "tier1", null,
      g.industry, "IN", null, null, 80, [], null,
    );

    assertEquals(result.determinism_index, g.expected.determinism_index,
      `DI drift on "${g.label}"`);
    assertEquals(result.survivability.score, g.expected.survivability,
      `survivability drift on "${g.label}"`);
    assertEquals(result.tone_tag, g.expected.tone_tag,
      `tone_tag drift on "${g.label}"`);
    assertEquals(result.replacing_tools.length, g.expected.replacing_tools_count,
      `replacing-tools count drift on "${g.label}"`);

    // Salary bleed: tier-aware vs no-tier baseline
    const monthly = g.profile.estimated_monthly_salary_inr ?? 0;
    const baseline = calculateSalaryBleed(result.determinism_index, monthly, g.marketSignal);
    const tierAware = calculateSalaryBleed(
      result.determinism_index, monthly, g.marketSignal, g.profile.seniority_tier,
    );
    assertEquals(tierAware.monthly, g.expected.bleed_monthly_new,
      `tier-aware bleed drift on "${g.label}"`);
    if (g.expected.tier_anchor_reduces_bleed) {
      assert(tierAware.monthly < baseline.monthly,
        `expected tier anchor to REDUCE bleed on "${g.label}" (got ${tierAware.monthly} vs ${baseline.monthly})`);
    } else {
      assertEquals(tierAware.monthly, baseline.monthly,
        `expected tier anchor neutral on "${g.label}"`);
    }
  });
}

// ── Tool-task hallucination guard probes ────────────────────────────────────

Deno.test("replay — tool-task guard probes", () => {
  const probes: Array<[string, string, boolean]> = [
    ["Playwright", "M&A modeling", false],
    ["Playwright", "unit testing", true],
    ["Figma", "SQL queries", false],
    ["Figma", "ui design mockup", true],
    ["GitHub Copilot", "boilerplate code", true],
    ["ChatGPT", "blog writing", true],
    ["UiPath", "data entry", true],
    ["Midjourney", "financial reporting", false],
    ["UnknownToolXYZ", "something obscure", true], // unknown → conservative pass
  ];
  for (const [tool, task, expected] of probes) {
    assertEquals(isPlausibleToolTaskPair(tool, task), expected,
      `guard mismatch for ${tool} × ${task}`);
  }
});

// ── KG baseline surfacing invariant (P0 from latest audit) ──────────────────

Deno.test("replay — kg_disruption_baseline surfaced for every scenario", () => {
  for (const g of GOLDEN) {
    const result = computeAll(
      g.profile, g.skills, [], g.job, g.marketSignal,
      false, "SME", g.profile.geo_advantage ?? "tier1", null,
      g.industry, "IN", null, null, 80, [], null,
    );
    assertEquals(result.kg_disruption_baseline, g.job.disruption_baseline,
      `kg_disruption_baseline must echo job taxonomy for "${g.label}"`);
    assert(
      result.structural_floor >= g.job.disruption_baseline - 5,
      `structural_floor (${result.structural_floor}) must be near job baseline (${g.job.disruption_baseline}) for "${g.label}"`,
    );
  }
});
