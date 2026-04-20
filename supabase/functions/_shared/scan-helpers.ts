// ═══════════════════════════════════════════════════════════════
// SCAN HELPERS — extracted from process-scan monolith
// ═══════════════════════════════════════════════════════════════

import type { ProfileInput, DeterministicResult, SkillRiskRow } from "./deterministic-engine.ts";

// ═══════════════════════════════════════════════════════════════
// LINKEDIN URL INFERENCE
// ═══════════════════════════════════════════════════════════════

export type LinkedInInference = {
  inferredName: string | null;
  inferredIndustry: string | null;
  inferredRoleHint: string | null;
  confidence: number;
};

const URL_SIGNAL_MAP: Array<{ keywords: string[]; industry: string; role: string }> = [
  // CXO/Founder signals — check FIRST (highest priority)
  { keywords: ["founder", "cofounder", "co-founder", "ceo", "cto", "cfo", "coo", "cmo", "cpo", "owner", "chairman", "president", "managing-director", "md"], industry: "IT & Software", role: "Founder & CEO" },
  { keywords: ["consultant", "consulting", "advisory", "advisor", "strategist", "strategy"], industry: "IT & Software", role: "Strategy Consultant" },
  { keywords: ["marketing", "growth", "brand", "seo", "content", "socialmedia", "digital-marketing", "dm"], industry: "Marketing & Advertising", role: "Digital Marketing Manager" },
  { keywords: ["finance", "banking", "fintech", "analyst", "accounts", "ca", "chartered"], industry: "Finance & Banking", role: "Financial Analyst" },
  { keywords: ["health", "healthcare", "doctor", "nurse", "clinical", "medical", "pharma"], industry: "Healthcare", role: "Healthcare Professional" },
  { keywords: ["teacher", "educator", "professor", "training", "learning", "education"], industry: "Education", role: "Educator" },
  { keywords: ["design", "creative", "ux", "ui", "visual", "illustration", "graphic"], industry: "Creative & Design", role: "Visual Designer" },
  { keywords: ["manufacturing", "operations", "supply", "plant", "quality", "production"], industry: "Manufacturing", role: "Operations Manager" },
  { keywords: ["developer", "engineer", "software", "it", "devops", "data", "programmer", "fullstack", "backend", "frontend"], industry: "IT & Software", role: "Software Engineer" },
  { keywords: ["hr", "human-resources", "talent", "recruiting", "recruitment", "people-ops"], industry: "IT & Software", role: "HR Manager" },
  { keywords: ["sales", "business-development", "bd", "account-executive", "revenue"], industry: "Finance & Banking", role: "Sales Manager" },
  { keywords: ["product", "product-manager", "pm", "product-management"], industry: "IT & Software", role: "Product Manager" },
];

function toTitleCase(token: string) {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function inferFromLinkedinUrl(linkedinUrl: string | null | undefined): LinkedInInference {
  if (!linkedinUrl) {
    return { inferredName: null, inferredIndustry: null, inferredRoleHint: null, confidence: 0 };
  }
  try {
    const url = new URL(linkedinUrl);
    const slug = decodeURIComponent(url.pathname.replace(/^\/in\//, "").replace(/\/$/, ""));
    const tokens = slug.split(/[-_\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length) return { inferredName: null, inferredIndustry: null, inferredRoleHint: null, confidence: 0 };

    const matchedSignal = URL_SIGNAL_MAP.find((signal) =>
      signal.keywords.some((keyword) => tokens.some((token) => token.includes(keyword)))
    );
    const inferredName = tokens.filter((t) => t.length > 1).slice(0, 3).map(toTitleCase).join(" ") || null;
    return {
      inferredName,
      inferredIndustry: matchedSignal?.industry || null,
      inferredRoleHint: matchedSignal?.role || null,
      confidence: matchedSignal ? 0.75 : 0.2,
    };
  } catch {
    return { inferredName: null, inferredIndustry: null, inferredRoleHint: null, confidence: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE PARSING
// ═══════════════════════════════════════════════════════════════

export function parseExperienceYears(value: string | null | undefined): number | null {
  if (!value) return null;
  if (value === "0-2") return 1;
  if (value === "3-5") return 4;
  if (value === "6-10") return 8;
  if (value === "10+") return 12;
  if (value === "15+") return 18;
  if (value === "20+") return 23;
  if (value === "25+") return 28;
  const rangeMatch = value.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return Number.isFinite(min) && Number.isFinite(max) ? Math.round((min + max) / 2) : null;
  }
  const num = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(num) && num > 0 && num < 60 ? num : null;
}

// ═══════════════════════════════════════════════════════════════
// INDUSTRY RESOLUTION
// ═══════════════════════════════════════════════════════════════

export function resolveIndustry(
  selectedIndustry: string | null | undefined,
  parsedIndustry: string | null | undefined,
  inferredIndustry: string | null | undefined,
  inferredConfidence: number
) {
  const selected = selectedIndustry || null;
  const parsed = parsedIndustry || null;
  const inferred = inferredIndustry || null;

  if (parsed) {
    if (selected && parsed !== selected) {
      return { industry: parsed, reason: `Profile evidence (${parsed}) overrode selected industry (${selected}).` };
    }
    return { industry: parsed, reason: "Profile evidence confirmed selected industry." };
  }
  if (inferred && inferredConfidence >= 0.7 && selected && inferred !== selected) {
    return { industry: inferred, reason: `LinkedIn URL signals (${inferred}) overrode selected industry (${selected}).` };
  }
  return {
    industry: selected || inferred || "Other",
    reason: selected ? "Using selected industry." : inferred ? "Using LinkedIn URL inferred industry." : "No reliable industry signal; using Other.",
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT 1 VALIDATION
// ═══════════════════════════════════════════════════════════════

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function validateAgent1Output(
  agent1: Record<string, unknown>,
  resolvedIndustry: string,
  allIndustryJobs: Record<string, unknown>[],
  allSkillRiskRows: SkillRiskRow[]
): { valid: boolean; warnings: string[]; corrections: Record<string, any> } {
  const warnings: string[] = [];
  const corrections: Record<string, any> = {};

  if (agent1.experience_years !== null && agent1.experience_years !== undefined) {
    if (agent1.experience_years < 0 || agent1.experience_years > 50) {
      warnings.push(`Implausible experience_years: ${agent1.experience_years}`);
      corrections.experience_years = Math.min(50, Math.max(0, agent1.experience_years));
    }
  }

  if (agent1.current_role) {
    const roleNorm = normalizeStr(agent1.current_role);
    let bestScore = 0;
    for (const job of allIndustryJobs) {
      const familyNorm = normalizeStr(job.job_family || "");
      if (familyNorm.includes(roleNorm) || roleNorm.includes(familyNorm)) {
        bestScore = 100;
        break;
      }
      const roleTokens = roleNorm.match(/.{2,}/g) || [];
      const familyTokens = familyNorm.match(/.{2,}/g) || [];
      let overlap = 0;
      for (const rt of roleTokens) {
        for (const ft of familyTokens) {
          if (rt.includes(ft) || ft.includes(rt)) overlap++;
        }
      }
      bestScore = Math.max(bestScore, overlap);
    }
    if (bestScore === 0) {
      warnings.push(`current_role "${agent1.current_role}" has no match in ${resolvedIndustry} job families`);
    }
  }

  // P0 fix (2026-04-17): NEVER inject synthetic skill names. The previous
  // "General Execution Tasks" fallback bled downstream into role titles
  // ("Senior General Execution Tasks Specialist") and polluted the cache for
  // every subsequent same-industry scan. Empty arrays force downstream callers
  // to either use real signals or fail loudly.
  if (!agent1.execution_skills || agent1.execution_skills.length === 0) {
    warnings.push("No execution skills extracted");
  }
  if (!agent1.strategic_skills || agent1.strategic_skills.length === 0) {
    warnings.push("No strategic skills extracted");
  }

  if (agent1.industry && normalizeStr(agent1.industry) !== normalizeStr(resolvedIndustry)) {
    const agentNorm = normalizeStr(agent1.industry);
    const resolvedNorm = normalizeStr(resolvedIndustry);
    if (!agentNorm.includes(resolvedNorm) && !resolvedNorm.includes(agentNorm)) {
      warnings.push(`Agent industry "${agent1.industry}" differs from resolved "${resolvedIndustry}"`);
    }
  }

  const codingSkills = ["javascript", "python", "react", "nodejs", "typescript", "java", "c++", "coding", "programming"];

  if (resolvedIndustry === "Marketing & Advertising") {
    const hasCodeSkills = (agent1.all_skills || []).some((s: string) =>
      codingSkills.some(cs => normalizeStr(s).includes(cs))
    );
    if (hasCodeSkills && !(agent1.current_role || "").toLowerCase().includes("tech")) {
      warnings.push("Coding skills detected for non-tech marketing role — may be misextracted");
    }
  }

  return { valid: warnings.length === 0, warnings, corrections };
}

// ═══════════════════════════════════════════════════════════════
// COMPOUND ROLE HANDLING
// ═══════════════════════════════════════════════════════════════

export function detectCompoundRole(role: string): string[] | null {
  const separators = /\s*(?:&|\/|\+|\band\b|,)\s*/i;
  const parts = role.split(separators).map(p => p.trim()).filter(p => p.length > 2);
  if (parts.length >= 2) return parts;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// COMPANY TIER INFERENCE
// ═══════════════════════════════════════════════════════════════

const KNOWN_FAANG = ["google", "meta", "apple", "amazon", "microsoft", "netflix", "alphabet", "openai", "anthropic", "deepmind"];
const KNOWN_UNICORNS = ["swiggy", "zomato", "razorpay", "cred", "meesho", "zerodha", "phonepe", "groww", "byju", "ola", "flipkart", "paytm", "freshworks", "dream11", "lenskart", "nykaa", "urban company", "unacademy", "slice", "jar", "bharatpe", "rapido", "udaan"];
const KNOWN_BIG_MNC = ["tcs", "infosys", "wipro", "hcl", "cognizant", "accenture", "deloitte", "mckinsey", "bcg", "bain", "pwc", "kpmg", "ey", "ernst", "ibm", "oracle", "sap", "salesforce", "adobe", "intel", "qualcomm", "samsung", "lg", "sony", "siemens", "bosch", "genpact", "capgemini", "tech mahindra", "l&t", "reliance", "tata", "mahindra", "godrej", "bajaj", "hdfc", "icici", "axis", "kotak"];

export function inferCompanyTier(companyName: string | null): string | null {
  if (!companyName) return null;
  const lower = companyName.toLowerCase().trim();
  if (KNOWN_FAANG.some(f => lower.includes(f))) return "FAANG";
  if (KNOWN_UNICORNS.some(u => lower.includes(u))) return "Unicorn";
  if (KNOWN_BIG_MNC.some(m => lower.includes(m))) return "MNC";
  if (/\b(global|international|worldwide)\b/i.test(lower)) return "MNC";
  return "Startup";
}

// ═══════════════════════════════════════════════════════════════
// TIER OUTPUT VALIDATION
// ═══════════════════════════════════════════════════════════════

export const TIER_NEVER_OUTPUT: Record<string, { patterns: RegExp[]; replacement: string }[]> = {
  'ENTRY': [
    { patterns: [/executive\s+presence/i, /advisory\s+board/i, /board\s+positioning/i], replacement: 'Build a portfolio project showcasing AI-augmented work' },
    { patterns: [/p&l\s+governance/i, /capital\s+allocation/i, /m&a/i], replacement: 'Get certified in a high-demand skill for your role' },
    { patterns: [/organizational\s+restructuring/i, /fractional\s+c.?suite/i], replacement: 'Contribute to open-source projects in your domain' },
    { patterns: [/regulatory\s+governance/i, /board.level/i], replacement: 'Build domain expertise through hands-on projects' },
  ],
  'PROFESSIONAL': [
    { patterns: [/board.level\s+strategy/i, /board\s+positioning/i], replacement: 'Lead a cross-functional team project' },
    { patterns: [/fractional\s+c.?suite/i, /advisory\s+board/i], replacement: 'Position for promotion to senior IC or team lead' },
    { patterns: [/p&l\s+governance/i, /capital\s+allocation/i], replacement: 'Deepen your technical specialization' },
  ],
  'MANAGER': [
    { patterns: [/learn\s+(basic\s+)?tools?\s+from\s+scratch/i, /take\s+a?\s*beginner/i], replacement: 'Implement AI-powered tools for your team' },
    { patterns: [/build\s+a\s+portfolio/i, /get\s+certified\s+in\s+basic/i], replacement: 'Lead an AI adoption initiative for your department' },
  ],
  'SENIOR_LEADER': [
    { patterns: [/learn\s+zapier/i, /learn\s+chatgpt/i, /take\s+a\s+coursera/i], replacement: 'Author an AI transformation strategy for your function' },
    { patterns: [/build\s+a\s+portfolio/i, /get\s+certified\s+in\s+basic/i], replacement: 'Position as the AI transformation leader for your division' },
  ],
  'EXECUTIVE': [
    { patterns: [/learn\s+zapier/i, /learn\s+chatgpt/i, /learn\s+cursor/i], replacement: 'Author an AI governance framework for your industry' },
    { patterns: [/take\s+a\s+coursera\s+course/i, /take\s+an?\s*online\s+course/i], replacement: 'Position for advisory boards in AI-disrupted industries' },
    { patterns: [/build\s+a\s+portfolio/i, /contribute\s+to\s+open.?source/i], replacement: 'Publish thought leadership on AI transformation at enterprise scale' },
    { patterns: [/get\s+certified\s+in/i, /complete\s+a\s+certification/i], replacement: 'Lead industry working groups on AI governance and ethics' },
  ],
};

export function validateOutputForTier(agent2Output: Record<string, unknown>, tier: string, name: string): Record<string, unknown> {
  if (!agent2Output || !tier) return agent2Output;
  
  const rules = TIER_NEVER_OUTPUT[tier];
  if (!rules) return agent2Output;

  const result = { ...agent2Output };
  const textFields = ['free_advice_1', 'free_advice_2', 'free_advice_3', 'dead_end_narrative', 'cognitive_moat', 'moat_narrative'];
  
  for (const field of textFields) {
    if (typeof result[field] !== 'string') continue;
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(result[field])) {
          console.log(`[TierValidation] ${tier}: Replacing "${field}" content matching ${pattern.source}`);
          result[field] = `${name}, ${rule.replacement.charAt(0).toLowerCase() + rule.replacement.slice(1)}.`;
          break;
        }
      }
    }
  }

  if (Array.isArray(result.weekly_action_plan)) {
    for (const week of result.weekly_action_plan) {
      for (const rule of rules) {
        for (const pattern of rule.patterns) {
          if (typeof week.action === 'string' && pattern.test(week.action)) {
            week.action = rule.replacement;
          }
          if (typeof week.theme === 'string' && pattern.test(week.theme)) {
            week.theme = rule.replacement;
          }
        }
      }
    }
  }

  if (Array.isArray(result.skill_gap_map)) {
    for (const gap of result.skill_gap_map) {
      for (const rule of rules) {
        for (const pattern of rule.patterns) {
          if (typeof gap.missing_skill === 'string' && pattern.test(gap.missing_skill)) {
            gap.missing_skill = rule.replacement;
          }
        }
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// ROLE MATCHING
// ═══════════════════════════════════════════════════════════════

export const ROLE_ALIASES: Record<string, string[]> = {
  "developer": ["software", "engineer", "full_stack", "frontend", "backend", "web"],
  "product": ["product_manager", "product_owner"],
  "analyst": ["data_analyst", "business_analyst", "financial"],
  "designer": ["ui_ux", "visual", "graphic"],
  "manager": ["project_manager", "operations"],
  "marketing": ["digital_marketing", "content", "seo"],
  "hr": ["human_resources", "recruiter", "talent"],
  "accountant": ["chartered_accountant", "finance"],
  "tester": ["qa_engineer", "quality"],
  "consultant": ["management_consultant", "strategy"],
  "data scientist": ["data_science", "ml_engineer"],
  "devops": ["devops_engineer", "cloud", "sre"],
  // Executive/Founder mappings — prevent misclassification
  "founder": ["management_consultant", "product_manager", "project_manager"],
  "co-founder": ["management_consultant", "product_manager", "project_manager"],
  "cofounder": ["management_consultant", "product_manager", "project_manager"],
  "ceo": ["management_consultant", "project_manager"],
  "cto": ["devops_engineer", "full_stack", "software"],
  "cfo": ["financial", "chartered_accountant"],
  "cpo": ["product_manager", "product_owner"],
  "coo": ["project_manager", "operations"],
  "cmo": ["digital_marketing", "content"],
  "head of product": ["product_manager", "product_owner"],
  "head of strategy": ["management_consultant", "strategy"],
  "head of sales": ["sales", "business_development"],
  "vp": ["management_consultant", "project_manager"],
  "director": ["management_consultant", "project_manager"],
  "president": ["management_consultant", "project_manager"],
  "owner": ["management_consultant", "project_manager"],
};

export function matchRoleToJobFamily(role: string, jobs: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!role || jobs.length === 0) return jobs[0] || null;
  const roleNorm = role.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const roleTokens = roleNorm.split(/\s+/);

  let bestMatch: Record<string, unknown> | null = null;
  let bestScore = -1;

  for (const job of jobs) {
    const familyNorm = (job.job_family || "").toLowerCase().replace(/_/g, " ");
    const familyTokens = familyNorm.split(/\s+/);
    let score = 0;

    if (familyNorm.includes(roleNorm) || roleNorm.includes(familyNorm)) {
      score += 100;
    }

    for (const rt of roleTokens) {
      if (rt.length < 3) continue;
      for (const ft of familyTokens) {
        if (rt === ft) score += 20;
        else if (rt.includes(ft) || ft.includes(rt)) score += 10;
      }
    }

    for (const [alias, targets] of Object.entries(ROLE_ALIASES)) {
      if (roleNorm.includes(alias)) {
        for (const target of targets) {
          if (familyNorm.includes(target.replace(/_/g, " "))) {
            score += 50;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = job;
    }
  }

  // Only return if we have a meaningful match (score > 0 means at least partial token overlap)
  return bestScore > 0 ? bestMatch : null;
}

// ═══════════════════════════════════════════════════════════════
// ML NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function titleCaseToken(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeMarketPositionModel(raw: Record<string, unknown> | null, det: DeterministicResult, industry: string): Record<string, unknown> {
  const percentileRaw = toFiniteNumber(raw?.market_percentile ?? raw?.gaussian_fit_percentile ?? raw?.marketPercentile);
  const fallbackPercentile = Math.max(5, Math.min(95, Math.round(100 - det.determinism_index)));
  const marketPercentile = Math.max(1, Math.min(99, Math.round(percentileRaw ?? fallbackPercentile)));

  const alignment = toFiniteNumber(raw?.industry_alignment_score);

  const competitiveTier = typeof raw?.competitive_tier === "string" && raw.competitive_tier.trim().length > 0
    ? raw.competitive_tier
    : typeof raw?.market_position === "string" && raw.market_position.trim().length > 0
      ? titleCaseToken(raw.market_position)
      : marketPercentile <= 15
        ? "Top-Tier Position"
        : marketPercentile <= 35
          ? "Strong Position"
          : marketPercentile <= 65
            ? "Competitive Middle"
            : "Crowded Segment";

  const leverageStatus = typeof raw?.leverage_status === "string" && raw.leverage_status.trim().length > 0
    ? raw.leverage_status
    : marketPercentile <= 20
      ? "High Leverage"
      : marketPercentile <= 45
        ? "Moderate Leverage"
        : "Low Leverage";

  const talentDensity = typeof raw?.talent_density === "string" && raw.talent_density.trim().length > 0
    ? raw.talent_density
    : alignment != null
      ? `${Math.round(alignment)}% industry alignment`
      : marketPercentile <= 30
        ? `Low supply in ${industry}`
        : marketPercentile <= 65
          ? `Balanced supply in ${industry}`
          : `High supply in ${industry}`;

  const demandTrend = typeof raw?.demand_trend === "string" && raw.demand_trend.trim().length > 0
    ? raw.demand_trend
    : marketPercentile <= 35
      ? "Rising demand"
      : marketPercentile <= 70
        ? "Stable demand"
        : "Demand pressure";

  return {
    market_percentile: marketPercentile,
    competitive_tier: competitiveTier,
    leverage_status: leverageStatus,
    talent_density: talentDensity,
    demand_trend: demandTrend,
  };
}

const INDUSTRY_HIRING_MAP: Record<string, string[]> = {
  "IT & Software": ["IT Services & Outsourcing", "SaaS Product Companies", "Cloud Consulting"],
  "Finance & Banking": ["FinTech Startups", "Insurance & Wealth Management", "Big 4 Consulting"],
  "Marketing & Advertising": ["Performance Marketing Agencies", "D2C Brands", "MarTech Platforms"],
  "Healthcare": ["HealthTech Startups", "Pharma Companies", "Hospital Chains"],
  "Manufacturing": ["Industrial Automation Firms", "EPC & Infrastructure", "Supply Chain Companies"],
  "Creative & Design": ["Digital Agencies", "Product Design Studios", "Media & Entertainment"],
  "Education": ["EdTech Companies", "Corporate L&D", "Assessment Platforms"],
  "Other": ["IT Services", "Consulting Firms", "Startups"],
};

export function buildDeterministicShock(
  det: DeterministicResult,
  role: string,
  industry: string,
  agent2: Record<string, unknown> | null,
  profile: ProfileInput,
  metroTier: string | null
): Record<string, unknown> {
  const di = det.determinism_index;
  const survScore = det.survivability?.score ?? 50;
  const expYears = profile.experience_years ?? 5;

  const baseRehireMonths = 2 + (di / 100) * 6;
  const expFactor = expYears > 10 ? 1.4 : expYears > 5 ? 1.1 : 0.9;
  const survFactor = survScore > 60 ? 0.85 : survScore > 40 ? 1.0 : 1.3;
  const geoFactor = metroTier === "tier2" ? 1.3 : 1.0;
  const rehireMonths = Math.round(baseRehireMonths * expFactor * survFactor * geoFactor * 10) / 10;

  const worstCase = Math.round(rehireMonths * 2.2);
  const runwayMonths = Math.round(worstCase * 1.3);

  const baseDrop = Math.round(di * 0.2 + 3);
  const salaryDrop = Math.min(30, Math.max(3, baseDrop));

  const seniorityPrefix = expYears >= 10 ? "Senior " : expYears >= 5 ? "" : "Associate ";
  const probableRole = agent2?.pivot_title 
    ? `${seniorityPrefix}${agent2.pivot_title}`
    : di > 60
      ? `${role} (reduced scope, execution-focused)`
      : `${seniorityPrefix}${role} with AI integration mandate`;

  const hiringIndustries = INDUSTRY_HIRING_MAP[industry] || INDUSTRY_HIRING_MAP["Other"];

  return {
    expected_time_to_rehire_months: rehireMonths,
    worst_case_scenario_months: worstCase,
    financial_runway_needed_in_months: runwayMonths,
    salary_drop_percentage: salaryDrop,
    most_probable_role_offered: probableRole,
    highest_probability_hiring_industries: hiringIndustries,
  };
}

export function normalizeCareerShockSimulator(
  raw: Record<string, unknown> | null,
  det: DeterministicResult,
  role: string,
  industry: string,
  agent2: Record<string, unknown> | null,
  profile: ProfileInput,
  metroTier: string | null
): Record<string, unknown> {
  const fallback = buildDeterministicShock(det, role, industry, agent2, profile, metroTier);

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const rehireRaw = toFiniteNumber(raw.expected_time_to_rehire_months ?? raw.estimated_job_search_months);
  const expectedRehire = Math.max(1, Math.round((rehireRaw ?? fallback.expected_time_to_rehire_months) * 10) / 10);

  const worstRaw = toFiniteNumber(raw.worst_case_scenario_months ?? raw.full_recovery_months);
  const worstCase = Math.max(expectedRehire, Math.round(worstRaw ?? expectedRehire * 2.2));

  const runwayRaw = toFiniteNumber(raw.financial_runway_needed_in_months);
  const runwayMonths = Math.max(3, Math.round(runwayRaw ?? worstCase * 1.3));

  const salaryDropRaw = toFiniteNumber(raw.salary_drop_percentage ?? raw.projected_salary_cut_percent);
  const salaryDrop = Math.min(40, Math.max(1, Math.round(salaryDropRaw ?? fallback.salary_drop_percentage)));

  const mostProbableRole =
    (typeof raw.most_probable_role_offered === "string" && raw.most_probable_role_offered.trim().length > 0
      ? raw.most_probable_role_offered
      : fallback.most_probable_role_offered) || fallback.most_probable_role_offered;

  const industries = Array.isArray(raw.highest_probability_hiring_industries)
    ? raw.highest_probability_hiring_industries.filter((i: unknown) => typeof i === "string" && i.trim().length > 0)
    : [];

  return {
    expected_time_to_rehire_months: expectedRehire,
    worst_case_scenario_months: worstCase,
    financial_runway_needed_in_months: runwayMonths,
    salary_drop_percentage: salaryDrop,
    most_probable_role_offered: mostProbableRole,
    highest_probability_hiring_industries: industries.length > 0 ? industries : fallback.highest_probability_hiring_industries,
  };
}

// ═══════════════════════════════════════════════════════════════
// INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════

export function sanitizeInput(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "[REDACTED]")
    .replace(/system\s*prompt/gi, "[REDACTED]")
    .replace(/you\s+are\s+now/gi, "[REDACTED]")
    .replace(/forget\s+(everything|all)/gi, "[REDACTED]")
    .replace(/new\s+instructions/gi, "[REDACTED]")
    .replace(/output\s+the\s+system/gi, "[REDACTED]")
    .slice(0, 8000);
}

// ═══════════════════════════════════════════════════════════════
// GITHUB TOOL VALIDATION MAP
// ═══════════════════════════════════════════════════════════════

export const TOOL_GITHUB_MAP: Record<string, string> = {
  'langchain': 'langchain-ai/langchain',
  'llamaindex': 'run-llama/llama_index',
  'llama index': 'run-llama/llama_index',
  'autogen': 'microsoft/autogen',
  'crewai': 'crewAIInc/crewAI',
  'crew ai': 'crewAIInc/crewAI',
  'cursor': 'getcursor/cursor',
  'dify': 'langgenius/dify',
  'flowise': 'FlowiseAI/Flowise',
  'n8n': 'n8n-io/n8n',
  'langflow': 'langflow-ai/langflow',
  'semantic kernel': 'microsoft/semantic-kernel',
  'haystack': 'deepset-ai/haystack',
  'vllm': 'vllm-project/vllm',
  'ollama': 'ollama/ollama',
  'comfyui': 'comfyanonymous/ComfyUI',
  'stable diffusion': 'Stability-AI/stablediffusion',
  'huggingface': 'huggingface/transformers',
  'transformers': 'huggingface/transformers',
  'pytorch': 'pytorch/pytorch',
  'tensorflow': 'tensorflow/tensorflow',
  'fastapi': 'fastapi/fastapi',
  'streamlit': 'streamlit/streamlit',
  'gradio': 'gradio-app/gradio',
  'mlflow': 'mlflow/mlflow',
  'airflow': 'apache/airflow',
  'prefect': 'PrefectHQ/prefect',
  'dagster': 'dagster-io/dagster',
  'dbt': 'dbt-labs/dbt-core',
  'metabase': 'metabase/metabase',
  'superset': 'apache/superset',
  'grafana': 'grafana/grafana',
  'prometheus': 'prometheus/prometheus',
  'kubernetes': 'kubernetes/kubernetes',
  'docker': 'moby/moby',
  'terraform': 'hashicorp/terraform',
  'ansible': 'ansible/ansible',
  'nextjs': 'vercel/next.js',
  'next.js': 'vercel/next.js',
  'react': 'facebook/react',
  'vue': 'vuejs/core',
  'svelte': 'sveltejs/svelte',
  'tailwind': 'tailwindlabs/tailwindcss',
  'prisma': 'prisma/prisma',
  'supabase': 'supabase/supabase',
  'openai': 'openai/openai-python',
  'anthropic': 'anthropics/anthropic-sdk-python',
  'litellm': 'BerriAI/litellm',
  'chainlit': 'Chainlit/chainlit',
  'mem0': 'mem0ai/mem0',
  'qdrant': 'qdrant/qdrant',
  'weaviate': 'weaviate/weaviate',
  'chromadb': 'chroma-core/chroma',
  'pinecone': 'pinecone-io/pinecone-python-client',
  'zapier': '',
  'notion': '',
  'chatgpt': '',
};
