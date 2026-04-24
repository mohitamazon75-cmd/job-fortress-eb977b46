/**
 * Regression check for the 3 fixes shipped on 2026-04-24:
 *   1. BD industry mapping
 *   2. Tool-task hallucination guard
 *   3. Executive salary anchor
 *
 * Replays 5 representative profiles through the deterministic kernel
 * + URL inference and prints a side-by-side comparison.
 */

import { computeAll } from "../_shared/det-orchestrator.ts";
import { calculateSalaryBleed } from "../_shared/det-lifecycle.ts";
import { inferFromLinkedinUrl, applyFunctionalIndustryOverride } from "../_shared/scan-helpers.ts";
import { isPlausibleToolTaskPair, filterImplausiblePairings } from "../_shared/tool-task-capability-map.ts";
import type { ProfileInput, SkillRiskRow, JobTaxonomyRow, MarketSignalRow } from "../_shared/det-types.ts";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const MS_DECLINING: MarketSignalRow = {
  posting_change_pct: -22, avg_salary_change_pct: -8,
  ai_job_mentions_pct: 38, market_health: "declining",
};

const SKILL_DATA_ENTRY: SkillRiskRow = {
  skill_name: "data_entry", automation_risk: 92, ai_augmentation_potential: 85,
  human_moat: null, replacement_tools: ["UiPath", "Power Automate"],
  india_demand_trend: "declining", category: "Execution",
};
const SKILL_PYTHON: SkillRiskRow = {
  skill_name: "python", automation_risk: 38, ai_augmentation_potential: 70,
  human_moat: null, replacement_tools: ["GitHub Copilot", "ChatGPT"],
  india_demand_trend: "growing", category: "Execution",
};
const SKILL_SYSTEM_DESIGN: SkillRiskRow = {
  skill_name: "system_design", automation_risk: 18, ai_augmentation_potential: 40,
  human_moat: "judgment", replacement_tools: [], india_demand_trend: "growing", category: "Strategic",
};
const SKILL_NEGOTIATION: SkillRiskRow = {
  skill_name: "enterprise_negotiation", automation_risk: 12, ai_augmentation_potential: 35,
  human_moat: "trust", replacement_tools: [], india_demand_trend: "growing", category: "Strategic",
};
const SKILL_BD: SkillRiskRow = {
  skill_name: "business_development", automation_risk: 28, ai_augmentation_potential: 55,
  human_moat: "relationships", replacement_tools: ["Apollo", "Outreach"],
  india_demand_trend: "stable", category: "Strategic",
};
const SKILL_COPYWRITING: SkillRiskRow = {
  skill_name: "copywriting", automation_risk: 76, ai_augmentation_potential: 80,
  human_moat: null, replacement_tools: ["ChatGPT", "Jasper", "Copy.ai"],
  india_demand_trend: "declining", category: "Execution",
};

const JOB_BPO: JobTaxonomyRow = {
  job_family: "data_entry_operator", category: "BPO/KPO", disruption_baseline: 82,
  avg_salary_lpa: 3, automatable_tasks: ["data entry"], ai_tools_replacing: ["UiPath"],
};
const JOB_ENGINEER: JobTaxonomyRow = {
  job_family: "software_engineer", category: "Technology", disruption_baseline: 45,
  avg_salary_lpa: 18, automatable_tasks: ["boilerplate code", "unit tests"],
  ai_tools_replacing: ["GitHub Copilot"],
};
const JOB_BD: JobTaxonomyRow = {
  job_family: "business_development", category: "Sales", disruption_baseline: 38,
  avg_salary_lpa: 14, automatable_tasks: ["lead qualification", "email drafts"],
  ai_tools_replacing: ["Apollo", "ChatGPT"],
};
const JOB_FOUNDER: JobTaxonomyRow = {
  job_family: "founder_ceo", category: "Executive", disruption_baseline: 22,
  avg_salary_lpa: 60, automatable_tasks: ["scheduling", "email"],
  ai_tools_replacing: ["ChatGPT"],
};
const JOB_COPYWRITER: JobTaxonomyRow = {
  job_family: "copywriter", category: "Marketing", disruption_baseline: 72,
  avg_salary_lpa: 7, automatable_tasks: ["blog drafts", "ad copy"],
  ai_tools_replacing: ["ChatGPT", "Jasper", "Copy.ai"],
};

// ── 5 profiles ──────────────────────────────────────────────────────────────

interface Scenario {
  label: string;
  linkedinUrl: string;
  parsedIndustry: string;          // industry parsed from resume (employer-derived)
  jobTitle: string;
  profile: ProfileInput;
  skills: SkillRiskRow[];
  job: JobTaxonomyRow;
  marketSignal: MarketSignalRow | null;
}

const SCENARIOS: Scenario[] = [
  {
    label: "1. BPO data-entry, ENTRY tier (Tier-2)",
    linkedinUrl: "https://linkedin.com/in/raj-data-entry-operator",
    parsedIndustry: "BPO/KPO",
    jobTitle: "Data Entry Operator",
    profile: {
      experience_years: 4, execution_skills: ["data_entry", "excel"],
      strategic_skills: [], all_skills: ["data_entry", "excel"],
      geo_advantage: null, adaptability_signals: 1,
      estimated_monthly_salary_inr: 28000, seniority_tier: "ENTRY",
    },
    skills: [SKILL_DATA_ENTRY], job: JOB_BPO, marketSignal: MS_DECLINING,
  },
  {
    label: "2. Senior software engineer (Tier-1, FAANG)",
    linkedinUrl: "https://linkedin.com/in/priya-sharma-engineer",
    parsedIndustry: "IT & Software",
    jobTitle: "Senior Software Engineer",
    profile: {
      experience_years: 14,
      execution_skills: ["python", "sql"],
      strategic_skills: ["system_design", "team_leadership", "stakeholder_management"],
      all_skills: ["python", "sql", "system_design", "team_leadership", "stakeholder_management"],
      geo_advantage: "tier1", adaptability_signals: 4,
      estimated_monthly_salary_inr: 350000, seniority_tier: "SENIOR_LEADER",
    },
    skills: [SKILL_PYTHON, SKILL_SYSTEM_DESIGN], job: JOB_ENGINEER, marketSignal: null,
  },
  {
    label: "3. BD lead at SaaS (the audit case — was misclassified as Finance)",
    linkedinUrl: "https://linkedin.com/in/anita-business-development-lead",
    parsedIndustry: "IT & Software", // employer is a SaaS company → naive parser says IT
    jobTitle: "Head of Business Development",
    profile: {
      experience_years: 10,
      execution_skills: ["lead_generation", "email_outreach"],
      strategic_skills: ["enterprise_negotiation", "business_development", "stakeholder_management"],
      all_skills: ["lead_generation", "email_outreach", "enterprise_negotiation", "business_development", "stakeholder_management"],
      geo_advantage: "tier1", adaptability_signals: 3,
      estimated_monthly_salary_inr: 180000, seniority_tier: "MANAGER",
    },
    skills: [SKILL_BD, SKILL_NEGOTIATION], job: JOB_BD, marketSignal: null,
  },
  {
    label: "4. Founder/CEO of growth-stage startup (the audit case — junk salary bleed)",
    linkedinUrl: "https://linkedin.com/in/vikram-founder-ceo",
    parsedIndustry: "IT & Software",
    jobTitle: "Founder & CEO",
    profile: {
      experience_years: 18,
      execution_skills: ["pitching", "fundraising"],
      strategic_skills: ["strategy", "team_leadership", "stakeholder_management", "investor_relations"],
      all_skills: ["pitching", "fundraising", "strategy", "team_leadership", "stakeholder_management", "investor_relations"],
      geo_advantage: "tier1", adaptability_signals: 5,
      estimated_monthly_salary_inr: 800000, seniority_tier: "EXECUTIVE",
    },
    skills: [SKILL_NEGOTIATION], job: JOB_FOUNDER, marketSignal: null,
  },
  {
    label: "5. Mid-level copywriter (high-risk skill)",
    linkedinUrl: "https://linkedin.com/in/sneha-copywriter-content",
    parsedIndustry: "Marketing & Advertising",
    jobTitle: "Senior Copywriter",
    profile: {
      experience_years: 7,
      execution_skills: ["copywriting", "blog_writing", "ad_copy"],
      strategic_skills: ["brand_strategy"],
      all_skills: ["copywriting", "blog_writing", "ad_copy", "brand_strategy"],
      geo_advantage: null, adaptability_signals: 2,
      estimated_monthly_salary_inr: 70000, seniority_tier: "PROFESSIONAL",
    },
    skills: [SKILL_COPYWRITING], job: JOB_COPYWRITER, marketSignal: MS_DECLINING,
  },
];

// ── Run ─────────────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("  REGRESSION REPLAY — 5 PROFILES × 3 FIXES (2026-04-24)");
console.log("═══════════════════════════════════════════════════════════════════\n");

for (const s of SCENARIOS) {
  console.log(`── ${s.label} ───────────────────────────────`);

  // Fix 1: industry resolution
  const inferred = inferFromLinkedinUrl(s.linkedinUrl);
  const overridden = applyFunctionalIndustryOverride(s.jobTitle, s.parsedIndustry);
  console.log(`  Industry chain:`);
  console.log(`    LinkedIn URL inference  → ${inferred.inferredIndustry ?? "(none)"}`);
  console.log(`    Parsed from resume       → ${s.parsedIndustry}`);
  console.log(`    After functional override → ${overridden}`);

  // Run scoring
  const result = computeAll(
    s.profile, s.skills, [], s.job, s.marketSignal,
    false, "SME", "tier1", null,
    overridden, "IN", null, null, 80, [], null,
  );

  console.log(`  Scoring:`);
  console.log(`    Determinism Index   = ${result.determinism_index}`);
  console.log(`    Survivability       = ${result.survivability.score}`);
  console.log(`    Tone tag            = ${result.tone_tag}`);

  // Fix 2: tool/task pairings — show what survived the guard
  console.log(`  Replacing tools (${result.replacing_tools.length} after guard):`);
  for (const t of result.replacing_tools.slice(0, 3)) {
    console.log(`    • ${t.tool_name} ← "${t.automates_task}"`);
  }

  // Fix 3: salary bleed — old vs new
  const monthly = s.profile.estimated_monthly_salary_inr ?? 0;
  const oldBleed = calculateSalaryBleed(result.determinism_index, monthly, s.marketSignal); // no tier
  const newBleed = calculateSalaryBleed(result.determinism_index, monthly, s.marketSignal, s.profile.seniority_tier);
  const bleedPctOld = monthly ? ((oldBleed.monthly * 12) / (monthly * 12) * 100) : 0;
  const bleedPctNew = monthly ? ((newBleed.monthly * 12) / (monthly * 12) * 100) : 0;
  console.log(`  Salary bleed (tier=${s.profile.seniority_tier}):`);
  console.log(`    OLD (no tier anchor) → ${fmtINR(oldBleed.monthly)}/mo  (${bleedPctOld.toFixed(1)}% of pkg)`);
  console.log(`    NEW (tier-aware)     → ${fmtINR(newBleed.monthly)}/mo  (${bleedPctNew.toFixed(1)}% of pkg)`);
  const delta = oldBleed.monthly - newBleed.monthly;
  if (delta !== 0) {
    const dir = delta > 0 ? "↓" : "↑";
    console.log(`    Δ ${dir} ${fmtINR(Math.abs(delta))}/mo (${(((newBleed.monthly - oldBleed.monthly) / Math.max(1, oldBleed.monthly)) * 100).toFixed(1)}%)`);
  }
  console.log("");
}

// ── Standalone tool-task guard probes ───────────────────────────────────────
console.log("── Tool-task hallucination guard probes ─────────────────────────");
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
let passed = 0;
for (const [tool, task, expected] of probes) {
  const got = isPlausibleToolTaskPair(tool, task);
  const ok = got === expected;
  if (ok) passed++;
  console.log(`  ${ok ? "✓" : "✗"}  ${tool.padEnd(18)} × ${task.padEnd(28)}  expected=${expected}  got=${got}`);
}
console.log(`\n  Guard probe result: ${passed}/${probes.length} correct`);

// ── Filter demo on a polluted list ───────────────────────────────────────────
console.log("\n── Pairing filter demo (polluted input) ──────────────────────────");
const polluted = [
  { tool_name: "Playwright", automates_task: "M&A modeling" },          // drop
  { tool_name: "GitHub Copilot", automates_task: "boilerplate code" },  // keep
  { tool_name: "Figma", automates_task: "SQL queries" },                // drop
  { tool_name: "ChatGPT", automates_task: "research" },                 // keep
  { tool_name: "UiPath", automates_task: "data entry" },                // keep
];
const filtered = filterImplausiblePairings(polluted, "demo");
console.log(`  Input:  ${polluted.length} pairings`);
console.log(`  Output: ${filtered.length} pairings (kept)`);
console.log(`  Kept:`);
for (const p of filtered) console.log(`    • ${p.tool_name} × ${p.automates_task}`);

console.log("\n═══════════════════════════════════════════════════════════════════\n");
