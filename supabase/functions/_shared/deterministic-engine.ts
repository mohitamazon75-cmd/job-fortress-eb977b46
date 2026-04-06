// ═══════════════════════════════════════════════════════════════
// JOBBACHAO DETERMINISTIC CALCULATION ENGINE v3.3
// ═══════════════════════════════════════════════════════════════
// All score formulas are deterministic and auditable: given the
// same inputs this engine produces the same outputs every time.
//
// IMPORTANT: inputs (automation_risk, moat_score, market_position,
// skill lists) are estimated by upstream LLM agents. The engine
// is deterministic; its inputs are not. Confidence in outputs is
// bounded by confidence in the upstream inference.
// ═══════════════════════════════════════════════════════════════

// ── CALIBRATION CONFIG ──
// All tunable constants in one place. Each documented with rationale.
export const CALIBRATION = {
  SALARY_BLEED_BASE_RATE: 0.35,        // Annual depreciation baseline; calibrated to Indian IT median attrition data
  SALARY_BLEED_CAP: 0.60,              // Maximum annual depreciation rate
  SALARY_BLEED_POWER: 1.2,             // Non-linear exponent for DI impact on salary bleed
  SALARY_BLEED_DI_NORM: 70,            // DI normalization divisor for salary bleed formula
  AI_PRESSURE_THRESHOLD: 30,           // ai_job_mentions_pct above which adds to depreciation
  AI_PRESSURE_DIVISOR: 200,            // Divisor for AI pressure contribution
  MARKET_AMPLIFIER_DIVISOR: 50,        // Divisor for negative salary change contribution
  EXPERIENCE_THRESHOLD_YEARS: 8,       // Years after which experience provides diminishing returns on risk reduction
  EXPERIENCE_REDUCTION_PER_YEAR: 0.8,  // Risk reduction per year over threshold
  EXPERIENCE_REDUCTION_CAP: 15,        // Maximum experience-based reduction (points)
  EXECUTIVE_EXPERIENCE_REDUCTION_CAP: 20, // Higher cap for EXECUTIVE tier
  EXECUTIVE_SURVIVABILITY_BONUS: 10,      // Additional survivability base bonus for executives
  SURVIVABILITY_BASE: 25,              // Baseline survivability before bonuses
  OBSOLESCENCE_POWER_CURVE: 1.3,       // Non-linear exponent; higher = steeper drop for high-risk roles
  OBSOLESCENCE_BASE_MONTHS: 60,        // Maximum months before obsolescence at 0 risk
  OBSOLESCENCE_RANGE: 50,              // How many months the power curve can subtract
  // ── Market-signal adjustments for obsolescence (evidence-backed) ──
  // Source: McKinsey 2024 — AI adoption doubling every ~18mo for GenAI use cases
  // Source: WEF Future of Jobs 2025 — 23% of jobs changing within 5 years
  // Source: Goldman Sachs 2024 — 300M jobs globally exposed within 3-5 years
  OBSOLESCENCE_AI_ACCELERATION_RATE: 0.12,   // 12% annual compression (conservative vs. McKinsey's observed doubling)
  OBSOLESCENCE_AI_BASELINE_YEAR: 2025,       // Year from which acceleration compounds
  OBSOLESCENCE_MARKET_DECLINE_WEIGHT: 0.15,  // Max 15% compression from declining job postings
  OBSOLESCENCE_AI_MENTIONS_WEIGHT: 0.10,     // Max 10% compression from high AI job mentions
  OBSOLESCENCE_ZONE_ORANGE_FACTOR: 0.35,     // Orange zone = yellow + (remaining * factor) — DI-relative, not fixed
  OBSOLESCENCE_ZONE_RED_FACTOR: 0.70,        // Red zone = yellow + (remaining * factor)
  MARKET_PRESSURE_SCALE: 10,           // Multiplier for AI job mentions impact on DI
  SENIORITY_BONUS_20YR: 6,             // Survivability bonus for 20+ years experience
  SENIORITY_BONUS_15YR: 3,             // Survivability bonus for 15+ years experience
  DI_PENALTY_THRESHOLD: 50,            // DI above this penalizes survivability
  DI_PENALTY_RATE: 0.2,                // Penalty multiplier per DI point above threshold
  CONFIDENCE_BASE_MARGIN: 15,          // Base +/- margin for DI confidence interval
  DI_CLAMP_MIN: 5,                     // Minimum possible DI score (no role is 100% safe)
  DI_CLAMP_MAX: 95,                    // Maximum possible DI score (no role is 100% doomed)
  SURVIVABILITY_CLAMP_MIN: 5,          // Minimum survivability score
  SURVIVABILITY_CLAMP_MAX: 95,         // Maximum survivability score

  // Essential role stability floors — these roles have structural demand
  // that AI cannot fully displace in the foreseeable future.
  // The DI score is capped at this value for these industries/categories.
  ESSENTIAL_ROLE_DI_CEILING: 70,       // Max DI for essential roles (prevents "your career is dying" for nurses/teachers)
  ESSENTIAL_ROLE_SURVIVABILITY_FLOOR: 30, // Min survivability for essential roles
} as const;

// ── INDUSTRY AUTOMATION FLOOR SCORES ──
// Research-backed minimum automation risk per industry when KG skill matching is sparse.
// Sources: McKinsey GenAI Impact Report 2024, Goldman Sachs 2024, WEF Future of Jobs 2025
// These prevent misleadingly low scores when only 0-2 skills match the KG.
const INDUSTRY_AUTOMATION_FLOORS: Record<string, number> = {
  "marketing & advertising": 58,   // McKinsey: 75% of marketing tasks AI-assistable; conservative floor
  "it & software": 48,             // High variance; coding copilots active but architecture/design protected
  "finance & banking": 52,         // Bloomberg Terminal AI, FinGPT; routine analysis highly automatable
  "creative & design": 45,         // Midjourney/DALL-E disrupting production; creative direction protected
  "healthcare": 30,                // Clinical judgment protected; admin/diagnostic imaging automatable
  "education": 35,                 // Teaching presence protected; content creation/grading automatable
  "manufacturing": 42,             // Robotics + predictive maintenance; shop-floor supervision protected
  "other": 45,                     // Conservative default
};

// ── SUB-SECTOR TAXONOMY ──
// Granular automation floors within broad industries. Sub-sectors have vastly different
// risk profiles — an IT Services body shop (outsourcing) has 2x the automation risk
// of a cybersecurity firm. Agent1 detects the sub-sector, which overrides the parent floor.
// Sources: Nasscom AI Impact 2024, McKinsey 2024, Gartner Hype Cycle 2025
const SUB_SECTOR_AUTOMATION_FLOORS: Record<string, Record<string, number>> = {
  "it & software": {
    "it services & outsourcing": 62,   // TCS/Infosys model: high % codifiable tasks, AI agents replacing L1/L2 support
    "it consulting": 55,               // Strategy consulting protected, implementation consulting not
    "saas product": 42,                // Product builders create AI, less disrupted by it
    "enterprise software": 44,         // Complex integrations protect; but maintenance automatable
    "cybersecurity": 35,               // Adversarial cat-and-mouse; AI is a tool, not a replacement
    "data engineering": 50,            // Pipeline automation rising fast; but architecture protected
    "data science & ml": 40,           // Practitioners build AI; AutoML raises floor for routine work
    "devops & cloud": 48,              // IaC + AI ops growing; but incident response needs humans
    "embedded systems": 38,            // Hardware-adjacent; low AI disruption
    "gaming": 42,                      // Creative + technical; AI assists but doesn't replace
    "fintech": 50,                     // Regulated + technical; compliance protects, automation threatens
    "healthtech": 38,                  // Regulatory + clinical domain knowledge = strong moat
    "edtech": 45,                      // Content generation automatable; pedagogy protected
    "ecommerce platform": 48,          // Operational automation high; strategic decisions protected
  },
  "finance & banking": {
    "investment banking": 48,          // Modeling automatable; relationship capital not
    "retail banking": 58,              // Branch operations + routine processing highly automatable
    "insurance": 55,                   // Claims processing + underwriting being automated
    "wealth management": 45,           // Robo-advisors growing but HNW clients want humans
    "fintech": 50,                     // Same as IT fintech
    "accounting & audit": 60,          // Routine bookkeeping/audit highly automatable
    "risk & compliance": 42,           // Regulatory judgment protected; monitoring automatable
  },
  "marketing & advertising": {
    "performance marketing": 65,       // Programmatic + AI optimization replacing media buyers
    "brand strategy": 42,              // Strategic thinking protected; execution automatable
    "content marketing": 62,           // AI content generation directly threatens
    "social media": 58,                // Scheduling + content creation automatable; community not
    "pr & communications": 48,         // Relationship-driven; AI assists but doesn't replace
    "market research": 55,             // Survey analysis automatable; insight generation less so
    "seo & sem": 60,                   // Technical SEO being automated; strategic SEO less so
  },
  "creative & design": {
    "graphic design": 55,              // Midjourney/DALL-E directly competing
    "ux/ui design": 40,               // User research + strategy protected; UI generation automatable
    "video production": 48,            // AI video tools emerging but craft still matters
    "copywriting": 65,                 // AI writing tools directly replace routine copy
    "creative direction": 30,          // Vision + judgment = strong human moat
    "animation & motion": 45,          // AI assists; high-end craft protected
  },
  "healthcare": {
    "clinical practice": 22,           // Patient care = irreplaceable human judgment
    "health administration": 48,       // Administrative tasks highly automatable
    "pharma & biotech": 35,            // R&D + regulatory = strong moat
    "medical devices": 38,             // Hardware + regulatory
    "telehealth": 42,                  // Platform operations automatable; clinical not
    "diagnostics & imaging": 40,       // AI-assisted but not AI-replaced (liability)
  },
  "education": {
    "k-12 teaching": 25,              // In-person teaching presence = irreplaceable
    "higher education": 35,            // Research + mentoring protected; lectures less so
    "corporate training": 50,          // Content delivery automatable; facilitation less so
    "edtech product": 45,              // Building tools, not being replaced by them
    "tutoring & coaching": 38,         // 1:1 human connection = moat
  },
  "manufacturing": {
    "production & assembly": 55,       // Robotics + automation directly replacing
    "quality engineering": 40,         // Judgment + physical inspection protected
    "supply chain": 48,                // Planning automatable; relationship management not
    "r&d & product design": 35,        // Innovation + physical prototyping protected
    "process engineering": 42,         // Optimization being AI-assisted
  },
};

// ── INDUSTRY-SPECIFIC SKILL RISK MODIFIERS (sub-sector aware) ──
const SUB_SECTOR_SKILL_MODIFIERS: Record<string, Record<string, Record<string, number>>> = {
  "it & software": {
    "it services & outsourcing": { "default": 8, "testing": 12, "support": 15, "documentation": 10, "project_management": 5 },
    "cybersecurity": { "default": -8, "threat_analysis": -12, "incident_response": -15, "compliance": -10 },
    "saas product": { "default": -3, "product_management": -8, "architecture": -10, "coding": 3 },
    "data science & ml": { "default": -5, "machine_learning": -10, "statistics": -8, "data_analysis": 5 },
  },
  "finance & banking": {
    "accounting & audit": { "default": 8, "bookkeeping": 15, "tax_preparation": 12, "audit_planning": -5 },
    "risk & compliance": { "default": -8, "regulatory_analysis": -12, "compliance": -10 },
  },
  "marketing & advertising": {
    "performance marketing": { "default": 5, "media_buying": 12, "analytics": 8, "strategy": -5 },
    "content marketing": { "default": 8, "copywriting": 15, "content_strategy": -3, "seo": 10 },
  },
};

function getIndustryAutomationFloor(industry: string | null, subSector?: string | null): number {
  if (!industry) return 45;
  const key = industry.toLowerCase().trim();

  // Try sub-sector first (most specific)
  if (subSector) {
    const subKey = subSector.toLowerCase().trim();
    const sectorMap = SUB_SECTOR_AUTOMATION_FLOORS[key];
    if (sectorMap) {
      // Direct match
      if (sectorMap[subKey] !== undefined) return sectorMap[subKey];
      // Partial match
      for (const [k, v] of Object.entries(sectorMap)) {
        if (subKey.includes(k) || k.includes(subKey)) return v;
      }
    }
    // Also try sub-sector across all parent industries (in case industry resolution is imperfect)
    for (const [, sMap] of Object.entries(SUB_SECTOR_AUTOMATION_FLOORS)) {
      if (sMap[subKey] !== undefined) return sMap[subKey];
      for (const [k, v] of Object.entries(sMap)) {
        if (subKey.includes(k) || k.includes(subKey)) return v;
      }
    }
  }

  // Fall back to parent industry
  if (INDUSTRY_AUTOMATION_FLOORS[key] !== undefined) return INDUSTRY_AUTOMATION_FLOORS[key];
  for (const [k, v] of Object.entries(INDUSTRY_AUTOMATION_FLOORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return 45;
}

// ── INDUSTRY-SPECIFIC SKILL RISK MODIFIERS ──
// Same skill has different automation risk depending on industry context.
// Delta applied to base automation_risk from KG (clamped 5-95).
// Sources: McKinsey 2024, WEF Future of Jobs 2025, domain expertise.
const INDUSTRY_SKILL_MODIFIERS: Record<string, Record<string, number>> = {
  "it & software": { "default": 0 },  // baseline — KG data is IT-centric
  "healthcare": { "default": -12, "data_analysis": -8, "documentation": 5, "compliance": -15, "patient_care": -20 },
  "finance & banking": { "default": 5, "data_analysis": 10, "compliance": -15, "risk_management": -10, "financial_modeling": 8 },
  "creative & design": { "default": -5, "content_creation": 15, "visual_design": 10, "copywriting": 18, "ux_design": -5 },
  "marketing & advertising": { "default": 8, "content_creation": 15, "copywriting": 20, "seo": 12, "data_analysis": 5 },
  "manufacturing": { "default": -8, "quality_control": -10, "process_automation": 10, "supply_chain": -5, "safety_management": -15 },
  "education": { "default": -10, "content_creation": 8, "assessment": 12, "curriculum_design": -8, "student_engagement": -18 },
};

function getIndustrySkillModifier(industry: string | null, skillName: string, subSector?: string | null): number {
  if (!industry) return 0;
  const indKey = industry.toLowerCase().trim();
  const skillKey = skillName.toLowerCase().replace(/[\s\-]+/g, '_');

  // Try sub-sector skill modifiers first (most specific)
  if (subSector) {
    const subKey = subSector.toLowerCase().trim();
    const sectorModifiers = SUB_SECTOR_SKILL_MODIFIERS[indKey];
    if (sectorModifiers) {
      const subModifiers = sectorModifiers[subKey];
      if (subModifiers) {
        if (subModifiers[skillKey] !== undefined) return subModifiers[skillKey];
        for (const [k, v] of Object.entries(subModifiers)) {
          if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
        }
        if (subModifiers["default"] !== undefined) return subModifiers["default"];
      }
      // Partial sub-sector match
      for (const [sk, sm] of Object.entries(sectorModifiers)) {
        if (subKey.includes(sk) || sk.includes(subKey)) {
          if (sm[skillKey] !== undefined) return sm[skillKey];
          for (const [k, v] of Object.entries(sm)) {
            if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
          }
          if (sm["default"] !== undefined) return sm["default"];
        }
      }
    }
  }

  // Fall back to parent industry modifiers
  let modifiers: Record<string, number> | undefined;
  modifiers = INDUSTRY_SKILL_MODIFIERS[indKey];
  if (!modifiers) {
    for (const [k, v] of Object.entries(INDUSTRY_SKILL_MODIFIERS)) {
      if (indKey.includes(k) || k.includes(indKey)) { modifiers = v; break; }
    }
  }
  if (!modifiers) return 0;
  if (modifiers[skillKey] !== undefined) return modifiers[skillKey];
  for (const [k, v] of Object.entries(modifiers)) {
    if (k !== 'default' && (skillKey.includes(k) || k.includes(skillKey))) return v;
  }
  return modifiers["default"] ?? 0;
}

// Industries/categories considered "essential" — structural societal demand
const ESSENTIAL_INDUSTRIES = new Set([
  "healthcare",
  "education",
  "public safety",
  "emergency services",
  "social work",
  "nursing",
  "medicine",
  "teaching",
]);

// Job families considered essential regardless of industry
const ESSENTIAL_JOB_FAMILIES = new Set([
  "nurse",
  "doctor",
  "physician",
  "surgeon",
  "teacher",
  "professor",
  "educator",
  "social_worker",
  "paramedic",
  "firefighter",
  "police",
  "therapist",
  "counselor",
  "clinical",
  "pharmacist",
]);

export function isEssentialRole(industry: string | null, jobFamily: string | null): boolean {
  const industryLower = (industry || "").toLowerCase().trim();
  const familyLower = (jobFamily || "").toLowerCase().replace(/_/g, " ").trim();

  if (ESSENTIAL_INDUSTRIES.has(industryLower)) return true;

  for (const essential of ESSENTIAL_JOB_FAMILIES) {
    if (familyLower.includes(essential)) return true;
  }
  return false;
}

// ── KG Row Types (match Supabase schema) ──

export interface SkillRiskRow {
  skill_name: string;
  automation_risk: number;
  ai_augmentation_potential: number;
  human_moat: string | null;
  replacement_tools: string[];
  india_demand_trend: string;
  category: string;
}

export interface JobTaxonomyRow {
  job_family: string;
  category: string;
  disruption_baseline: number;
  avg_salary_lpa: number | null;
  automatable_tasks: any;
  ai_tools_replacing: any;
}

export interface MarketSignalRow {
  posting_change_pct: number | null;
  avg_salary_change_pct: number | null;
  ai_job_mentions_pct: number | null;
  market_health: string;
}

export interface JobSkillMapRow {
  skill_name: string;
  importance: number;
  frequency: string;
}

// ── Profile Input (from Agent 1 or inference) ──

export interface ExecutiveImpactSignals {
  revenue_scope_usd: number | null;
  team_size_direct: number | null;
  team_size_org: number | null;
  budget_authority_usd: number | null;
  regulatory_domains: string[];
  geographic_scope: string[];
  board_exposure: boolean;
  investor_facing: boolean;
  domain_tenure_years: number | null;
  cross_industry_pivots: number;
  moat_type: 'REGULATORY' | 'SCALE' | 'RELATIONSHIP' | 'DOMAIN' | 'HYBRID' | null;
  moat_evidence: string | null;
}

export interface ProfileInput {
  experience_years: number | null;
  execution_skills: string[];
  strategic_skills: string[];
  all_skills: string[];
  geo_advantage: string | null;
  adaptability_signals: number;
  estimated_monthly_salary_inr: number | null;
  seniority_tier?: 'EXECUTIVE' | 'SENIOR_LEADER' | 'MANAGER' | 'PROFESSIONAL' | 'ENTRY' | null;
  executive_impact?: ExecutiveImpactSignals | null;
}

// ── Output Types ──

export interface ObsolescenceTimeline {
  purple_zone_months: number;
  yellow_zone_months: number;
  orange_zone_months: number;
  red_zone_months: number;
  already_in_warning: boolean;
}

export interface SurvivabilityBreakdown {
  experience_bonus: number;
  strategic_bonus: number;
  geo_bonus: number;
  adaptability_bonus: number;
}

export interface SurvivabilityResult {
  score: number;
  breakdown: SurvivabilityBreakdown;
  primary_vulnerability: string;
  peer_percentile_estimate: string;
}

export interface ReplacingTool {
  tool_name: string;
  automates_task: string;
  adoption_stage: string;
}

export interface DataQuality {
  profile_completeness: number;
  kg_coverage: number;
  overall: "HIGH" | "MEDIUM" | "LOW";
  unmatched_skills_count?: number;
  profile_completeness_pct?: number;
  profile_gaps?: string[];
}

// ── Task 1: Score Breakdown ──

export interface SkillAdjustment {
  skill_name: string;
  automation_risk: number;
  weight: number;
  contribution: number;
}

export interface ScoreBreakdown {
  base_score: number;
  skill_adjustments: SkillAdjustment[];
  weighted_skill_average: number | null;
  market_pressure: number;
  experience_reduction: number;
  pre_clamp_score: number;
  final_clamped: number;
  company_health_modifier: number;
  company_health_score: number | null;
  salary_bleed_breakdown: {
    depreciation_rate: number;
    market_amplifier: number;
    ai_pressure_add: number;
    final_rate: number;
  };
  survivability_breakdown: {
    base: number;
    experience_bonus: number;
    strategic_bonus: number;
    geo_bonus: number;
    adaptability_bonus: number;
    seniority_bonus: number;
    di_penalty: number;
    final: number;
  };
}

// ── Task 2: Score Variability ──

export interface ScoreVariability {
  di_range: { low: number; high: number };
  months_range: { low: number; high: number };
  salary_bleed_range: { low: number; high: number };
}

export interface DeterministicResult {
  determinism_index: number;
  determinism_confidence: "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";
  matched_skill_count: number;
  months_remaining: number;
  salary_bleed_monthly: number;
  total_5yr_loss_inr: number;
  obsolescence_timeline: ObsolescenceTimeline;
  survivability: SurvivabilityResult;
  tone_tag: "CRITICAL" | "WARNING" | "MODERATE" | "STABLE";
  replacing_tools: ReplacingTool[];
  execution_skills_dead: string[];
  data_quality: DataQuality;
  score_breakdown: ScoreBreakdown;
  score_variability: ScoreVariability;
  moat_score: number;
  urgency_score: number;
}

// ═══════════════════════════════════════════════════════════════
// MOAT SCORE — Standalone metric measuring irreplaceable value
// Computed deterministically from profile signals, NOT from LLM.
// Tier-calibrated: different factors matter at different career stages.
// ═══════════════════════════════════════════════════════════════

export function calculateMoatScore(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  matchedSkillCount: number
): number {
  const tier = profile.seniority_tier || 'PROFESSIONAL';
  const years = profile.experience_years || 0;
  const impact = profile.executive_impact;

  // ── Normalize all components to 0-100 BEFORE weighting ──
  // Strategic skill depth: 0 skills → 0, 1 → 25, 2 → 45, 3 → 60, 4+ → 75-100
  const rawStrategic = profile.strategic_skills?.length || 0;
  const strategicSkillDepth = Math.min(100, rawStrategic <= 0 ? 0 : rawStrategic === 1 ? 25 : rawStrategic === 2 ? 45 : rawStrategic === 3 ? 60 : 70 + rawStrategic * 5);

  // Adaptability: signals count → 0-100
  const rawAdapt = profile.adaptability_signals || 0;
  const adaptability = Math.min(100, rawAdapt * 25);

  // Experience depth: log-scaled years → 0-100
  const experienceDepth = Math.min(100, Math.round(Math.log(years + 1) * 40));

  // Domain specialization: tenure ratio → 0-100
  const domainTenure = impact?.domain_tenure_years || 0;
  const domainSpecialization = years > 0
    ? Math.min(100, Math.round((domainTenure / years) * 100))
    : 0;

  // KG skill coverage: how many of user's skills matched in Knowledge Graph → 0-100
  const skillCoverage = Math.min(100, matchedSkillCount <= 0 ? 10 : matchedSkillCount === 1 ? 30 : matchedSkillCount === 2 ? 50 : matchedSkillCount === 3 ? 65 : 70 + matchedSkillCount * 4);

  // Low-risk skill ratio: % of matched skills with < 40% automation risk
  const lowRiskSkills = skillRiskData.filter(s =>
    (profile.strategic_skills || []).some(ps =>
      ps.toLowerCase().includes(s.skill_name.toLowerCase()) || s.skill_name.toLowerCase().includes(ps.toLowerCase())
    ) && s.automation_risk < 40
  ).length;
  const lowRiskRatio = rawStrategic > 0 ? Math.min(100, Math.round((lowRiskSkills / Math.max(1, rawStrategic)) * 100)) : 30;

  let moat: number;

  switch (tier) {
    case 'ENTRY': {
      // Fresh tech stack, certifications, niche domains, adaptability
      const techFreshness = skillCoverage;
      const certSignal = adaptability;
      const nicheDomain = strategicSkillDepth;
      moat = techFreshness * 0.3 + certSignal * 0.2 + nicheDomain * 0.3 + lowRiskRatio * 0.2;
      break;
    }
    case 'PROFESSIONAL': {
      // Specialization depth, project ownership, strategic skills, adaptability
      moat = experienceDepth * 0.2 + skillCoverage * 0.2 + strategicSkillDepth * 0.3 + lowRiskRatio * 0.15 + adaptability * 0.15;
      break;
    }
    case 'MANAGER': {
      const teamScale = impact?.team_size_direct
        ? Math.min(100, Math.round(Math.log10(Math.max(1, impact.team_size_direct)) * 50))
        : years >= 8 ? 50 : 25;
      const budgetScope = impact?.budget_authority_usd
        ? Math.min(100, Math.round(Math.log10(Math.max(1, impact.budget_authority_usd / 100_000)) * 40))
        : 35;
      moat = teamScale * 0.2 + budgetScope * 0.2 + strategicSkillDepth * 0.3 + domainSpecialization * 0.3;
      break;
    }
    case 'SENIOR_LEADER':
    case 'EXECUTIVE': {
      let scaleMoat = 40; // base for executives
      if (impact?.revenue_scope_usd && impact.revenue_scope_usd > 0) {
        scaleMoat = Math.min(100, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 30 + 30));
      } else if (impact?.team_size_org && impact.team_size_org > 0) {
        scaleMoat = Math.min(100, Math.round(Math.log10(Math.max(1, impact.team_size_org)) * 25 + 30));
      }

      let regulatoryMoat = 20;
      if (impact?.regulatory_domains?.length) {
        regulatoryMoat = Math.min(100, 20 + impact.regulatory_domains.length * 20);
      }

      let relationshipCapital = 20;
      if (impact?.board_exposure) relationshipCapital += 20;
      if (impact?.investor_facing) relationshipCapital += 15;
      if (impact?.cross_industry_pivots) relationshipCapital += Math.min(20, impact.cross_industry_pivots * 8);
      if ((impact?.geographic_scope?.length ?? 0) > 1) relationshipCapital += Math.min(15, (impact!.geographic_scope!.length) * 6);
      relationshipCapital = Math.min(100, relationshipCapital);

      const domainDepth = Math.min(100, domainSpecialization * 0.6 + experienceDepth * 0.4);

      moat = scaleMoat * 0.25 + regulatoryMoat * 0.25 + relationshipCapital * 0.25 + domainDepth * 0.25;
      break;
    }
    default:
      moat = strategicSkillDepth * 0.3 + adaptability * 0.2 + experienceDepth * 0.25 + lowRiskRatio * 0.25;
  }

  return Math.min(95, Math.max(5, Math.round(moat)));
}

// ═══════════════════════════════════════════════════════════════
// URGENCY SCORE — How immediately this person's role is disrupted
// Tier-calibrated: juniors feel disruption first (not hired), 
// executives feel it last (organizational inertia).
// ═══════════════════════════════════════════════════════════════

const URGENCY_TIER_WEIGHT: Record<string, number> = {
  'ENTRY': 0.85,
  'PROFESSIONAL': 0.6,
  'MANAGER': 0.5,
  'SENIOR_LEADER': 0.4,
  'EXECUTIVE': 0.3,
};

export function calculateUrgencyScore(
  profile: ProfileInput,
  determinismIndex: number,
  marketSignal: MarketSignalRow | null
): number {
  const tier = profile.seniority_tier || 'PROFESSIONAL';
  const tierWeight = URGENCY_TIER_WEIGHT[tier] || 0.6;

  // DI contribution (primary driver)
  const diContribution = determinismIndex * tierWeight;

  // Market decline signal
  let marketDecline = 0;
  if (marketSignal?.posting_change_pct !== null && marketSignal?.posting_change_pct !== undefined && marketSignal.posting_change_pct < 0) {
    marketDecline = Math.min(20, Math.abs(marketSignal.posting_change_pct) * 0.4);
  }

  // Industry disruption velocity (from AI job mentions)
  let disruptionVelocity = 0;
  if (marketSignal?.ai_job_mentions_pct !== null && marketSignal?.ai_job_mentions_pct !== undefined && marketSignal.ai_job_mentions_pct > 10) {
    disruptionVelocity = Math.min(20, (marketSignal.ai_job_mentions_pct - 10) * 0.5);
  }

  const urgency = diContribution + marketDecline * 0.2 + disruptionVelocity * 0.2;

  return Math.min(95, Math.max(5, Math.round(urgency)));
}

// ═══════════════════════════════════════════════════════════════
// CORE CALCULATION: Determinism Index
// ═══════════════════════════════════════════════════════════════

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}

/**
 * Pre-built hashmap index for O(1) KG skill lookups.
 * Build once per computeAll call, reuse for all matchSkillToKG calls.
 */
export interface KGSkillIndex {
  /** exact normalized name → SkillRiskRow */
  exact: Map<string, SkillRiskRow>;
  /** all normalized names for substring fallback */
  entries: Array<{ norm: string; row: SkillRiskRow }>;
}

export function buildKGSkillIndex(skillRiskData: SkillRiskRow[]): KGSkillIndex {
  const exact = new Map<string, SkillRiskRow>();
  const entries: Array<{ norm: string; row: SkillRiskRow }> = [];
  for (const row of skillRiskData) {
    const norm = normalize(row.skill_name);
    if (norm) {
      exact.set(norm, row);
      entries.push({ norm, row });
    }
  }
  return { exact, entries };
}

export function matchSkillToKG(
  userSkill: string,
  skillRiskData: SkillRiskRow[],
  index?: KGSkillIndex
): SkillRiskRow | null {
  const normSkill = normalize(userSkill);
  if (!normSkill) return null;

  // Fast path: use pre-built index if available
  if (index) {
    // O(1) exact match
    const exactMatch = index.exact.get(normSkill);
    if (exactMatch) return exactMatch;

    // O(n) substring check (still faster than Levenshtein)
    for (const { norm, row } of index.entries) {
      if (normSkill.includes(norm) || norm.includes(normSkill)) return row;
    }

    // O(n) Levenshtein fallback — only for unmatched skills
    for (const { norm, row } of index.entries) {
      if (levenshteinSimilarity(normSkill, norm) > 0.7) return row;
    }
    return null;
  }

  // Legacy path: no index (backward compatible)
  for (const dbSkill of skillRiskData) {
    const normDb = normalize(dbSkill.skill_name);
    if (
      normSkill.includes(normDb) ||
      normDb.includes(normSkill) ||
      levenshteinSimilarity(normSkill, normDb) > 0.7
    ) {
      return dbSkill;
    }
  }
  return null;
}

interface DIResult {
  index: number;
  confidence: "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";
  matchedCount: number;
  // Task 1: breakdown intermediates
  baseScore: number;
  skillAdjustments: SkillAdjustment[];
  weightedSkillAverage: number | null;
  marketPressure: number;
  experienceReduction: number;
  preClampScore: number;
}

export function calculateDeterminismIndex(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobSkillMap: JobSkillMapRow[],
  jobBaseline: number,
  marketSignal: MarketSignalRow | null,
  industry?: string | null,
  subSector?: string | null,
  kgIndex?: KGSkillIndex
): DIResult {
  const isExec = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const isManager = profile.seniority_tier === 'MANAGER';
  
  const allUserSkills = [
    ...profile.execution_skills,
    ...profile.all_skills,
  ];
  const seen = new Set<string>();
  const uniqueSkills = allUserSkills.filter((s) => {
    const n = normalize(s);
    if (seen.has(n) || !n) return false;
    seen.add(n);
    return true;
  });

  // Commodity skills that should be filtered out for MANAGER+ tiers
  // These are trivial tasks that look unprofessional as "exposure points"
  const COMMODITY_SKILL_RE = /^(email|calendar|scheduling|filing|data_entry|typing|note_taking|phone|travel|expense|report_writing|powerpoint|spreadsheet|word_processing|basic_copywriting|copywriting|internet_research|meeting_coordination|meeting)/i;
  const filterCommodity = isExec || isManager;

  const matchedRisks: { risk: number; weight: number }[] = [];
  const skillAdjustments: SkillAdjustment[] = [];
  const matchedKGNames = new Set<string>(); // Deduplicate by KG skill name

  for (const userSkill of uniqueSkills) {
    const matched = matchSkillToKG(userSkill, skillRiskData, kgIndex);
    if (matched) {
      const normMatchedName = normalize(matched.skill_name);
      // Skip duplicates (multiple user skills matching same KG entry)
      if (matchedKGNames.has(normMatchedName)) continue;
      matchedKGNames.add(normMatchedName);

      // Skip commodity skills for senior tiers
      if (filterCommodity && COMMODITY_SKILL_RE.test(matched.skill_name.replace(/[\s\-]+/g, '_'))) continue;

      const mapEntry = jobSkillMap.find(
        (m) => normalize(m.skill_name) === normMatchedName
      );
      const weight = mapEntry?.importance || 5;
      // Apply industry-specific modifier to automation risk
      const industryDelta = getIndustrySkillModifier(industry || null, matched.skill_name, subSector);
      const adjustedRisk = Math.min(95, Math.max(5, matched.automation_risk + industryDelta));
      matchedRisks.push({ risk: adjustedRisk, weight });
      skillAdjustments.push({
        skill_name: matched.skill_name,
        automation_risk: adjustedRisk,
        weight,
        contribution: 0, // filled below
      });
    }
  }

  let index: number;
  let confidence: "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";
  let weightedSkillAverage: number | null = null;

  if (matchedRisks.length === 0) {
    // When no skills match KG, use the HIGHER of job baseline or industry-specific floor
    // This prevents misleadingly low scores for high-disruption industries like Marketing
    const industryFloor = getIndustryAutomationFloor(industry || null, subSector);
    index = Math.max(jobBaseline, industryFloor);
    confidence = "LOW";

    for (const execSkill of profile.execution_skills) {
      const estimatedRisk = Math.min(95, index + 5 + (normalize(execSkill).length % 10));
      skillAdjustments.push({
        skill_name: execSkill,
        automation_risk: estimatedRisk,
        weight: 7,
        contribution: estimatedRisk * 0.1,
      });
    }
    for (const stratSkill of profile.strategic_skills) {
      const estimatedRisk = Math.max(5, Math.min(35, jobBaseline - 30 + (normalize(stratSkill).length % 10)));
      skillAdjustments.push({
        skill_name: stratSkill,
        automation_risk: estimatedRisk,
        weight: 5,
        contribution: estimatedRisk * 0.05,
      });
    }
    const coveredSkills = new Set([
      ...profile.execution_skills.map(s => normalize(s)),
      ...profile.strategic_skills.map(s => normalize(s)),
    ]);
    for (const skill of profile.all_skills.slice(0, 8)) {
      const n = normalize(skill);
      if (coveredSkills.has(n) || !n) continue;
      coveredSkills.add(n);
      const estimatedRisk = Math.min(85, Math.max(15, jobBaseline - 5 + (n.length % 15)));
      skillAdjustments.push({
        skill_name: skill,
        automation_risk: estimatedRisk,
        weight: 4,
        contribution: estimatedRisk * 0.04,
      });
    }
  } else {
    const totalWeight = matchedRisks.reduce((sum, m) => sum + m.weight, 0);
    const weightedSum = matchedRisks.reduce(
      (sum, m) => sum + m.risk * m.weight,
      0
    );
    index = Math.round(weightedSum / totalWeight);
    weightedSkillAverage = index;

    // When very few skills match (1-2), blend with industry floor to avoid misleading scores
    // A profile with only 2 matched skills is not representative enough to override industry research
    if (matchedRisks.length <= 2) {
      const industryFloor = getIndustryAutomationFloor(industry || null, subSector);
      // Blend: 40% KG match + 60% industry floor when only 1 skill, 60/40 when 2 skills
      const kgWeight = matchedRisks.length === 1 ? 0.4 : 0.6;
      index = Math.round(index * kgWeight + industryFloor * (1 - kgWeight));
    }

    for (const adj of skillAdjustments) {
      adj.contribution = Math.round((adj.automation_risk * adj.weight) / totalWeight * 10) / 10;
    }

    confidence =
      matchedRisks.length >= 5
        ? "VERY HIGH"
        : matchedRisks.length >= 3
        ? "HIGH"
        : "MEDIUM";
  }

  const baseScore = index;

  // ════════════════════════════════════════════════════════════
  // EXECUTIVE MOAT REDUCTION — Scale, Regulatory, Relationship
  // For EXECUTIVE/SENIOR_LEADER, the DI is NOT just about task
  // automation. It must account for organizational leverage that
  // AI fundamentally cannot replicate.
  // ════════════════════════════════════════════════════════════
  let scaleMoatReduction = 0;
  let regulatoryMoatReduction = 0;
  let relationshipMoatReduction = 0;

  if ((isExec || isManager) && profile.executive_impact) {
    const impact = profile.executive_impact;

    // Scale Moat: log10(revenue / 1M) * 5, capped at 15
    if (impact.revenue_scope_usd && impact.revenue_scope_usd > 0) {
      scaleMoatReduction = Math.min(15, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 5));
    }
    // Team size as secondary scale signal (if no revenue data)
    if (scaleMoatReduction === 0 && impact.team_size_org && impact.team_size_org > 0) {
      scaleMoatReduction = Math.min(10, Math.round(Math.log10(Math.max(1, impact.team_size_org)) * 4));
    }

    // Regulatory Moat: 4 points per domain, capped at 12
    if (impact.regulatory_domains?.length > 0) {
      regulatoryMoatReduction = Math.min(12, impact.regulatory_domains.length * 4);
    }

    // Relationship Capital: board + investor + domain tenure
    relationshipMoatReduction = 0;
    if (impact.board_exposure) relationshipMoatReduction += 3;
    if (impact.investor_facing) relationshipMoatReduction += 2;
    if (impact.domain_tenure_years) {
      relationshipMoatReduction += Math.min(5, Math.round(impact.domain_tenure_years / 3));
    }
    if (impact.cross_industry_pivots > 0) {
      relationshipMoatReduction += Math.min(3, impact.cross_industry_pivots);
    }
    relationshipMoatReduction = Math.min(13, relationshipMoatReduction);

    // For executives, reweight the DI formula:
    // DI = 0.3 * task_risk + 0.2 * market_pressure_effect - moats
    if (isExec) {
      index = Math.round(index * 0.4); // Reduce task-risk weight to 40% for executives
    } else if (isManager) {
      index = Math.round(index * 0.7); // 70% task-risk for managers
    }

    index = Math.round(index - scaleMoatReduction - regulatoryMoatReduction - relationshipMoatReduction);
  }

  // ENTRY-tier amplification: juniors face sharpest displacement
  const isEntry = profile.seniority_tier === 'ENTRY';
  if (isEntry && !(profile.executive_impact)) {
    index = Math.round(index * 1.15);
  }

  // Market signal modifier
  let marketPressure = 0;
  if (marketSignal?.ai_job_mentions_pct) {
    const aiPressure = marketSignal.ai_job_mentions_pct / 100;
    // Executives feel market pressure differently — structural, not task-level
    const pressureScale = isExec ? CALIBRATION.MARKET_PRESSURE_SCALE * 0.5 : CALIBRATION.MARKET_PRESSURE_SCALE;
    marketPressure = Math.round(aiPressure * pressureScale);
    index = Math.round(index + marketPressure);
  }

  // Experience modifier (seniority-aware cap)
  let experienceReduction = 0;
  if (profile.experience_years && profile.experience_years > CALIBRATION.EXPERIENCE_THRESHOLD_YEARS) {
    const yearsOver = profile.experience_years - CALIBRATION.EXPERIENCE_THRESHOLD_YEARS;
    const cap = isExec ? CALIBRATION.EXECUTIVE_EXPERIENCE_REDUCTION_CAP : CALIBRATION.EXPERIENCE_REDUCTION_CAP;
    // Logarithmic scaling for very senior profiles (30yr vs 20yr has diminishing marginal return)
    const rawReduction = yearsOver <= 12
      ? yearsOver * CALIBRATION.EXPERIENCE_REDUCTION_PER_YEAR
      : 12 * CALIBRATION.EXPERIENCE_REDUCTION_PER_YEAR + Math.log(yearsOver - 11) * 3;
    experienceReduction = Math.round(Math.min(rawReduction, cap) * 10) / 10;
    index = Math.round(index - experienceReduction);
  }

  const preClampScore = index;
  const finalIndex = Math.min(CALIBRATION.DI_CLAMP_MAX, Math.max(CALIBRATION.DI_CLAMP_MIN, index));

  return {
    index: finalIndex,
    confidence,
    matchedCount: matchedRisks.length,
    baseScore,
    skillAdjustments,
    weightedSkillAverage,
    marketPressure,
    experienceReduction,
    preClampScore,
  };
}

// ═══════════════════════════════════════════════════════════════
// OBSOLESCENCE TIMELINE v2 — Market-signal-adjusted + AI acceleration
// ═══════════════════════════════════════════════════════════════
// Evidence basis:
//   - WEF Future of Jobs 2025: 23% of jobs changing within 60 months
//   - McKinsey 2024: GenAI adoption doubling every ~18 months
//   - Goldman Sachs 2024: 300M jobs globally exposed, 3-5yr partial automation
//   - O*NET automation probability data calibrated to Indian market
//
// The formula:
//   1. Base months from DI power curve (same as v1)
//   2. AI acceleration factor compounds annually from 2025 baseline
//   3. Market signal compression: declining postings + high AI mentions shorten window
//   4. Zone offsets are DI-relative (high DI = tighter zones, faster collapse)
// ═══════════════════════════════════════════════════════════════

export function calculateObsolescenceTimeline(
  determinismIndex: number,
  marketSignal?: MarketSignalRow | null,
  seniorityTier?: string | null
): ObsolescenceTimeline {
  // Step 1: Base months from power curve (unchanged from v1)
  const baseFactor = Math.pow(determinismIndex / 100, CALIBRATION.OBSOLESCENCE_POWER_CURVE);
  let baseMonths = CALIBRATION.OBSOLESCENCE_BASE_MONTHS - baseFactor * CALIBRATION.OBSOLESCENCE_RANGE;

  // Step 1b: Seniority elongation — executive roles take longer to automate
  // CXO roles involve organizational judgment, board relationships, and regulatory navigation
  // that require structural changes, not just tool adoption
  if (seniorityTier === 'EXECUTIVE') {
    baseMonths *= 1.35; // 35% longer horizon for C-suite
  } else if (seniorityTier === 'SENIOR_LEADER') {
    baseMonths *= 1.20; // 20% longer for Directors
  } else if (seniorityTier === 'MANAGER') {
    baseMonths *= 1.10; // 10% longer for managers
  }

  // Step 2: AI acceleration factor — compounding annually from baseline year
  // Each year from 2025, AI adoption accelerates, compressing the window
  const currentYear = new Date().getFullYear();
  const yearsDelta = Math.max(0, currentYear - CALIBRATION.OBSOLESCENCE_AI_BASELINE_YEAR);
  const accelerationMultiplier = Math.pow(1 - CALIBRATION.OBSOLESCENCE_AI_ACCELERATION_RATE, yearsDelta);
  // In 2025: 1.0x (no change). In 2026: 0.88x. In 2027: 0.77x. In 2028: 0.68x.
  baseMonths *= accelerationMultiplier;

  // Step 3: Market signal compression
  // If job postings are declining, compress proportionally (max 15%)
  if (marketSignal) {
    let marketCompression = 1.0;

    // Declining job postings compress the timeline
    if (marketSignal.posting_change_pct !== null && marketSignal.posting_change_pct < 0) {
      // e.g. -30% posting decline → 0.15 * min(1, 30/50) = 9% compression
      const declineIntensity = Math.min(1, Math.abs(marketSignal.posting_change_pct) / 50);
      marketCompression -= CALIBRATION.OBSOLESCENCE_MARKET_DECLINE_WEIGHT * declineIntensity;
    }

    // High AI job mentions → the role is being actively disrupted
    if (marketSignal.ai_job_mentions_pct !== null && marketSignal.ai_job_mentions_pct > 10) {
      // e.g. 40% AI mentions → 0.10 * min(1, (40-10)/50) = 6% compression
      const aiPressure = Math.min(1, (marketSignal.ai_job_mentions_pct - 10) / 50);
      marketCompression -= CALIBRATION.OBSOLESCENCE_AI_MENTIONS_WEIGHT * aiPressure;
    }

    baseMonths *= marketCompression;
  }

  // Final clamping
  const yellow = Math.max(6, Math.min(60, Math.floor(baseMonths)));
  const purple = Math.max(0, yellow - 6);

  // Step 4: DI-relative zone offsets (not fixed)
  // High DI → tighter zones (collapse happens faster after initial window)
  // Low DI → wider zones (more buffer time)
  const remainingAfterYellow = Math.max(6, 60 - yellow);
  const orange = yellow + Math.round(remainingAfterYellow * CALIBRATION.OBSOLESCENCE_ZONE_ORANGE_FACTOR);
  const red = yellow + Math.round(remainingAfterYellow * CALIBRATION.OBSOLESCENCE_ZONE_RED_FACTOR);

  return {
    purple_zone_months: purple,
    yellow_zone_months: yellow,
    orange_zone_months: orange,
    red_zone_months: red,
    already_in_warning: yellow <= 12,
  };
}

// ═══════════════════════════════════════════════════════════════
// SALARY BLEED CALCULATION v3.2
// ═══════════════════════════════════════════════════════════════

export function calculateSalaryBleed(
  determinismIndex: number,
  monthlySalary: number,
  marketSignal: MarketSignalRow | null
): { monthly: number; total5yr: number; depreciationRate: number; marketAmplifier: number; aiPressureAdd: number; finalRate: number } {
  let depreciationRate = CALIBRATION.SALARY_BLEED_BASE_RATE * Math.pow(determinismIndex / CALIBRATION.SALARY_BLEED_DI_NORM, CALIBRATION.SALARY_BLEED_POWER);

  let marketAmplifier = 0;
  if (marketSignal?.avg_salary_change_pct && marketSignal.avg_salary_change_pct < 0) {
    marketAmplifier = Math.abs(marketSignal.avg_salary_change_pct) / CALIBRATION.MARKET_AMPLIFIER_DIVISOR;
    depreciationRate += marketAmplifier;
  }

  let aiPressureAdd = 0;
  if (marketSignal?.ai_job_mentions_pct && marketSignal.ai_job_mentions_pct > CALIBRATION.AI_PRESSURE_THRESHOLD) {
    aiPressureAdd = (marketSignal.ai_job_mentions_pct - CALIBRATION.AI_PRESSURE_THRESHOLD) / CALIBRATION.AI_PRESSURE_DIVISOR;
    depreciationRate += aiPressureAdd;
  }

  const finalRate = Math.min(depreciationRate, CALIBRATION.SALARY_BLEED_CAP);
  const monthlyBleed = Math.floor(monthlySalary * finalRate / 12);
  const total5yr = monthlyBleed * 60;

  return { monthly: monthlyBleed, total5yr, depreciationRate: CALIBRATION.SALARY_BLEED_BASE_RATE * Math.pow(determinismIndex / CALIBRATION.SALARY_BLEED_DI_NORM, CALIBRATION.SALARY_BLEED_POWER), marketAmplifier, aiPressureAdd, finalRate };
}

// ═══════════════════════════════════════════════════════════════
// SURVIVABILITY SCORE v3.2
// ═══════════════════════════════════════════════════════════════

const GEO_SCORES: Record<string, number> = {
  "us citizen/gc": 100,
  "h1b holder": 70,
  "indian oci": 65,
  "eu passport": 60,
  "remote only": 55,
  "willing to relocate": 40,
};

function getGeoScore(geoAdvantage: string | null): number {
  if (!geoAdvantage) return 0;
  const key = geoAdvantage.toLowerCase().trim();
  return GEO_SCORES[key] || 0;
}

export function calculateSurvivability(
  profile: ProfileInput,
  determinismIndex: number
): SurvivabilityResult {
  const isExec = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const base = CALIBRATION.SURVIVABILITY_BASE + (isExec ? CALIBRATION.EXECUTIVE_SURVIVABILITY_BONUS : 0);
  const years = profile.experience_years || 0;

  // Experience bonus: logarithmic scaling
  const experience_bonus = years <= 5
    ? Math.min(Math.floor(years * 1.5), 8)
    : years <= 10
      ? Math.min(8 + Math.floor((years - 5) * 1.0), 13)
      : Math.min(13 + Math.floor(Math.log(years - 9) * 4.0), 22);

  // Strategic bonus: increased cap for executives (their moat IS strategy)
  const strategicCap = isExec ? 25 : 14;
  const strategicMultiplier = isExec ? 5 : 7; // More skills count for execs
  const strategic_bonus = Math.min((profile.strategic_skills?.length || 0) * strategicMultiplier, strategicCap);

  // Geo bonus: seniority-adjusted
  const geoBase = getGeoScore(profile.geo_advantage);
  const geoMultiplier = isExec ? 0.16 : 0.12;
  const geo_bonus = Math.round(geoBase * geoMultiplier);

  // Adaptability: seniority-aware floor
  const baseAdaptability = profile.adaptability_signals || 0;
  const seniorityAdaptFloor = years >= 20 ? 2 : years >= 15 ? 1 : 0;
  const effectiveAdaptability = Math.max(baseAdaptability, seniorityAdaptFloor);
  const adaptability_bonus = Math.min(effectiveAdaptability * 4, 12);

  const seniority_bonus = years >= 20 ? CALIBRATION.SENIORITY_BONUS_20YR : years >= 15 ? CALIBRATION.SENIORITY_BONUS_15YR : 0;

  // ── NEW: Executive Impact Bonus ──
  // Scale, regulatory, and relationship capital directly increase survivability
  let impact_bonus = 0;
  if (profile.executive_impact) {
    const impact = profile.executive_impact;
    // Revenue scale: log-scaled, max 8 pts
    if (impact.revenue_scope_usd && impact.revenue_scope_usd > 0) {
      impact_bonus += Math.min(8, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 3));
    }
    // Regulatory domains: 2pts each, max 6
    if (impact.regulatory_domains?.length > 0) {
      impact_bonus += Math.min(6, impact.regulatory_domains.length * 2);
    }
    // Board/investor exposure: 3pts
    if (impact.board_exposure) impact_bonus += 2;
    if (impact.investor_facing) impact_bonus += 1;
    // Geographic scope: multi-geo leaders are harder to replace
    if (impact.geographic_scope?.length > 1) {
      impact_bonus += Math.min(3, impact.geographic_scope.length);
    }
    // Cross-industry pivots prove adaptability at scale
    if (impact.cross_industry_pivots > 0) {
      impact_bonus += Math.min(3, impact.cross_industry_pivots);
    }
    impact_bonus = Math.min(20, impact_bonus); // Hard cap
  }

  // DI penalty: non-linear
  let di_penalty = 0;
  if (determinismIndex > CALIBRATION.DI_PENALTY_THRESHOLD) {
    const excess = determinismIndex - CALIBRATION.DI_PENALTY_THRESHOLD;
    di_penalty = Math.round(excess * CALIBRATION.DI_PENALTY_RATE * (1 + excess / 100));
  }

  const rawScore = base + experience_bonus + strategic_bonus + geo_bonus + adaptability_bonus + seniority_bonus + impact_bonus - di_penalty;
  const score = Math.min(CALIBRATION.SURVIVABILITY_CLAMP_MAX, Math.max(CALIBRATION.SURVIVABILITY_CLAMP_MIN, rawScore));

  // Primary vulnerability: seniority-calibrated language
  let primary_vulnerability: string;
  if (determinismIndex > 75) {
    primary_vulnerability = isExec
      ? "Organizational restructuring risk — your function may be consolidated under AI-augmented leadership"
      : "Core role tasks are highly automatable — pivot urgently needed";
  } else if (experience_bonus < 5) {
    primary_vulnerability = "Limited experience reduces resilience to market shifts";
  } else if (strategic_bonus < 7) {
    primary_vulnerability = isExec
      ? "Strategic differentiation needs strengthening — AI governance or transformation leadership would build your moat"
      : "Few identifiable strategic skills — high reliance on execution tasks";
  } else if (geo_bonus < 5) {
    primary_vulnerability = isExec
      ? "Advisory and board opportunities expand with cross-border positioning"
      : "Limited geographic mobility reduces arbitrage options";
  } else if (adaptability_bonus < 4) {
    primary_vulnerability = "Low adaptability signals — few career pivots or certifications detected";
  } else {
    primary_vulnerability = isExec
      ? "Strong position — maintain through AI transformation leadership and industry visibility"
      : "Maintaining competitive edge requires continuous skill investment";
  }

  // Peer percentile: cohort-based estimation
  const normalizedScore = (score - 30) / 50;
  const sigmoidPercentile = Math.round(100 / (1 + Math.exp(-3 * normalizedScore)));
  const peer_percentile_estimate = `~${Math.min(95, Math.max(5, sigmoidPercentile))}th percentile in your ${isExec ? 'leadership' : 'professional'} cohort`;

  return {
    score,
    breakdown: { experience_bonus, strategic_bonus, geo_bonus, adaptability_bonus },
    primary_vulnerability,
    peer_percentile_estimate,
  };
}

// ═══════════════════════════════════════════════════════════════
// GEO-ARBITRAGE CALCULATION
// ═══════════════════════════════════════════════════════════════

const GEO_PROBABILITY: Record<string, number> = {
  "us citizen/gc": 0.85,
  "h1b holder": 0.70,
  "indian oci": 0.65,
  "eu passport": 0.60,
  "remote only": 0.55,
  "willing to relocate": 0.40,
};

export function calculateGeoArbitrage(
  currentMonthlySalary: number,
  geoAdvantage: string | null,
  targetMultiplier: number = 3.0
): {
  target_market: string;
  raw_delta_inr_monthly: number;
  probability_adjusted_delta_inr: number;
  geo_probability_pct: number;
  expected_value_12mo_inr: number;
  fastest_path_weeks: number;
} | null {
  const key = (geoAdvantage || "").toLowerCase().trim();
  const probability = GEO_PROBABILITY[key] || 0.25;

  const targetSalary = Math.round(currentMonthlySalary * targetMultiplier);
  const rawDelta = targetSalary - currentMonthlySalary;

  if (rawDelta <= 0) return null;

  const probAdjusted = Math.round(rawDelta * probability);
  const ev12mo = probAdjusted * 12;

  const fastestWeeks = probability >= 0.7 ? 6 : probability >= 0.5 ? 10 : 16;

  const marketLabel =
    key.includes("us") || key.includes("gc")
      ? "US Direct"
      : key.includes("h1b")
      ? "US H1B Transfer"
      : key.includes("remote")
      ? "US/EU Remote"
      : key.includes("eu")
      ? "EU Market"
      : "Global Remote";

  return {
    target_market: marketLabel,
    raw_delta_inr_monthly: rawDelta,
    probability_adjusted_delta_inr: probAdjusted,
    geo_probability_pct: Math.round(probability * 100),
    expected_value_12mo_inr: ev12mo,
    fastest_path_weeks: fastestWeeks,
  };
}

// ═══════════════════════════════════════════════════════════════
// TONE TAG (deterministic)
// ═══════════════════════════════════════════════════════════════

export function deriveToneTag(
  determinismIndex: number
): "CRITICAL" | "WARNING" | "MODERATE" | "STABLE" {
  if (determinismIndex > 80) return "CRITICAL";
  if (determinismIndex > 60) return "WARNING";
  if (determinismIndex > 40) return "MODERATE";
  return "STABLE";
}

// ═══════════════════════════════════════════════════════════════
// REPLACING TOOLS (from KG, not hallucinated)
// ═══════════════════════════════════════════════════════════════

export function extractReplacingTools(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobData: JobTaxonomyRow | null
): ReplacingTool[] {
  const tools: ReplacingTool[] = [];
  const seenTools = new Set<string>();

  const allSkills = [
    ...profile.execution_skills,
    ...profile.all_skills,
  ];
  const seen = new Set<string>();
  const uniqueSkills = allSkills.filter((s) => {
    const n = normalize(s);
    if (seen.has(n) || !n) return false;
    seen.add(n);
    return true;
  });

  for (const skill of uniqueSkills) {
    const matched = matchSkillToKG(skill, skillRiskData, kgIndex);
    if (matched && matched.replacement_tools?.length > 0) {
      for (const toolName of matched.replacement_tools) {
        const key = toolName.toLowerCase().trim();
        if (!seenTools.has(key)) {
          seenTools.add(key);
          tools.push({
            tool_name: toolName,
            automates_task: skill,
            adoption_stage:
              matched.automation_risk > 70
                ? "Mainstream"
                : matched.automation_risk > 40
                ? "Growing"
                : "Early",
          });
        }
      }
    }
  }

  if (tools.length === 0 && jobData?.ai_tools_replacing) {
    const jobTools = Array.isArray(jobData.ai_tools_replacing)
      ? jobData.ai_tools_replacing
      : [];
    // Map each tool to a specific execution skill instead of generic "Various execution tasks"
    const execSkills = profile.execution_skills.length > 0
      ? profile.execution_skills
      : profile.all_skills.slice(0, 3);
    for (let i = 0; i < Math.min(jobTools.length, 5); i++) {
      const name = typeof jobTools[i] === "string" ? jobTools[i] : String(jobTools[i]);
      const taskName = execSkills[i % execSkills.length] || `${jobData?.job_family || 'role'} task automation`;
      tools.push({
        tool_name: name,
        automates_task: taskName,
        adoption_stage: "Growing",
      });
    }
  }

  return tools.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// DATA QUALITY ASSESSMENT
// ═══════════════════════════════════════════════════════════════

export function assessDataQuality(
  profile: ProfileInput,
  matchedSkillCount: number,
  totalUserSkillCount: number,
  hasLinkedIn: boolean,
  hasJobData: boolean,
  hasMarketSignal: boolean
): DataQuality {
  let profilePoints = 0;
  if (profile.experience_years) profilePoints += 20;
  if (profile.execution_skills.length >= 3) profilePoints += 25;
  if (profile.strategic_skills.length >= 2) profilePoints += 20;
  if (profile.geo_advantage) profilePoints += 10;
  if (profile.estimated_monthly_salary_inr) profilePoints += 15;
  if (hasLinkedIn) profilePoints += 10;
  const profileCompleteness = Math.min(100, profilePoints);

  let kgPoints = 0;
  if (hasJobData) kgPoints += 30;
  if (hasMarketSignal) kgPoints += 25;
  kgPoints += Math.min(45, matchedSkillCount * 9);
  const kgCoverage = Math.min(100, kgPoints);

  const avgScore = (profileCompleteness + kgCoverage) / 2;
  const overall: "HIGH" | "MEDIUM" | "LOW" =
    avgScore >= 65 ? "HIGH" : avgScore >= 40 ? "MEDIUM" : "LOW";

  const unmatchedCount = Math.max(0, totalUserSkillCount - matchedSkillCount);
  return { profile_completeness: profileCompleteness, kg_coverage: kgCoverage, overall, unmatched_skills_count: unmatchedCount };
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY SALARY ESTIMATION v3.2 (Task 6: company tier + location)
// ═══════════════════════════════════════════════════════════════

const COMPANY_TIER_MULTIPLIERS: Record<string, number> = {
  'FAANG': 2.5,
  'Unicorn': 1.8,
  'MNC': 1.4,
  'Startup': 1.0,
  'SME': 0.8,
};

export function estimateMonthlySalary(
  agentEstimate: number | null,
  jobData: JobTaxonomyRow | null,
  experienceYears: number | null,
  companyTier?: string | null,
  metroTier?: string | null,
  specialization?: string | null,
  country?: string | null
): number {
  if (agentEstimate && agentEstimate > 10000) {
    // Agent estimates already incorporate the company context.
    // Only apply metro tier adjustment (geographic cost of living is separate from company tier).
    // Do NOT re-apply company tier — the LLM already factors in FAANG/startup salary bands.
    let adjusted = agentEstimate;
    if (metroTier === 'tier2') adjusted = Math.round(adjusted * 0.80); // tier2 cost-of-living adjustment only
    if (specialization === 'niche') adjusted = Math.round(adjusted * 1.2);
    return adjusted;
  }

  const baseSalaryUnit = jobData?.avg_salary_lpa || 10;
  let adjustedUnit = baseSalaryUnit;

  if (experienceYears) {
    if (experienceYears > 10) adjustedUnit *= 1.6;
    else if (experienceYears > 5) adjustedUnit *= 1.3;
    else if (experienceYears > 2) adjustedUnit *= 1.1;
  }

  // Country-aware conversion: LPA for India, K/year for US/AE
  const countryCode = (country || 'IN').toUpperCase();
  let monthly: number;
  if (countryCode === 'US' || countryCode === 'AE') {
    // avg_salary_lpa stores K/year for US/AE markets
    monthly = Math.round((adjustedUnit * 1000) / 12);
  } else {
    // India: LPA to monthly INR
    monthly = Math.round((adjustedUnit * 100000) / 12);
  }

  // Task 6: Apply company tier multiplier
  if (companyTier && COMPANY_TIER_MULTIPLIERS[companyTier]) {
    monthly = Math.round(monthly * COMPANY_TIER_MULTIPLIERS[companyTier]);
  }
  // Task 6: Metro tier adjustment
  if (metroTier === 'tier2') {
    monthly = Math.round(monthly * 0.75);
  }
  // Task 6: Specialization premium
  if (specialization === 'niche') {
    monthly = Math.round(monthly * 1.3);
  }

  return monthly;
}

// ═══════════════════════════════════════════════════════════════
// Task 2: SCORE VARIABILITY
// ═══════════════════════════════════════════════════════════════

function calculateScoreVariability(
  determinismIndex: number,
  matchedCount: number,
  monthlySalary: number,
  marketSignal: MarketSignalRow | null
): ScoreVariability {
  const diBaseMargin = CALIBRATION.CONFIDENCE_BASE_MARGIN;
  const diMargin = matchedCount > 0 ? Math.round(diBaseMargin / Math.sqrt(matchedCount)) : diBaseMargin;

  const diLow = Math.max(1, determinismIndex - diMargin);
  const diHigh = Math.min(99, determinismIndex + diMargin);

  const timelineLow = calculateObsolescenceTimeline(diHigh, marketSignal); // higher DI = fewer months
  const timelineHigh = calculateObsolescenceTimeline(diLow, marketSignal);

  const salaryLow = calculateSalaryBleed(diLow, monthlySalary, marketSignal);
  const salaryHigh = calculateSalaryBleed(diHigh, monthlySalary, marketSignal);

  return {
    di_range: { low: diLow, high: diHigh },
    months_range: { low: timelineLow.yellow_zone_months, high: timelineHigh.yellow_zone_months },
    salary_bleed_range: { low: salaryLow.monthly, high: salaryHigh.monthly },
  };
}

// ═══════════════════════════════════════════════════════════════
// MASTER CALCULATION — orchestrates all deterministic computations
// ═══════════════════════════════════════════════════════════════

export function computeAll(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobSkillMap: JobSkillMapRow[],
  jobData: JobTaxonomyRow | null,
  marketSignal: MarketSignalRow | null,
  hasLinkedIn: boolean,
  companyTier?: string | null,
  metroTier?: string | null,
  specialization?: string | null,
  industry?: string | null,
  country?: string | null,
  companyHealthScore?: number | null,
  subSector?: string | null,
  profileCompletenessPct?: number,
  profileGaps?: string[]
): DeterministicResult {
  const jobBaseline = jobData?.disruption_baseline || 60;

  // Build KG skill index once — O(n) build, then O(1) lookups for all matchSkillToKG calls
  const kgIndex = buildKGSkillIndex(skillRiskData);

  // 1. Determinism Index (with breakdown)
  const diResult = calculateDeterminismIndex(profile, skillRiskData, jobSkillMap, jobBaseline, marketSignal, industry, subSector, kgIndex);
  let determinismIndex = diResult.index;

  // Essential role safeguard: cap DI for roles with structural societal demand
  const essential = isEssentialRole(industry || jobData?.category || null, jobData?.job_family || null);
  if (essential) {
    determinismIndex = Math.min(determinismIndex, CALIBRATION.ESSENTIAL_ROLE_DI_CEILING);
  }

  // Company Health modifier: live company intelligence adjusts DI ±15 points
  let companyHealthModifier = 0;
  if (companyHealthScore != null) {
    if (companyHealthScore < 30) {
      companyHealthModifier = Math.ceil((30 - companyHealthScore) / 2); // max +15
    } else if (companyHealthScore > 70) {
      companyHealthModifier = -Math.ceil((companyHealthScore - 70) / 3); // max -10
    }
    determinismIndex = Math.min(CALIBRATION.DI_CLAMP_MAX, Math.max(CALIBRATION.DI_CLAMP_MIN, determinismIndex + companyHealthModifier));
    if (companyHealthModifier !== 0) {
      console.log(`[DeterministicEngine] Company health modifier: ${companyHealthModifier > 0 ? '+' : ''}${companyHealthModifier} (score: ${companyHealthScore})`);
    }
  }

  // 2. Monthly Salary (Task 6: enhanced)
  const monthlySalary = estimateMonthlySalary(
    profile.estimated_monthly_salary_inr,
    jobData,
    profile.experience_years,
    companyTier,
    metroTier,
    specialization,
    country
  );

  // 3. Obsolescence Timeline (market-signal-adjusted + AI acceleration + seniority)
  const timeline = calculateObsolescenceTimeline(determinismIndex, marketSignal, profile.seniority_tier);

  // 4. Salary Bleed (with breakdown)
  const salaryBleed = calculateSalaryBleed(determinismIndex, monthlySalary, marketSignal);

  // 5. Survivability (with essential role floor)
  const survivability = calculateSurvivability(profile, determinismIndex);
  if (essential && survivability.score < CALIBRATION.ESSENTIAL_ROLE_SURVIVABILITY_FLOOR) {
    survivability.score = CALIBRATION.ESSENTIAL_ROLE_SURVIVABILITY_FLOOR;
  }
  const years = profile.experience_years || 0;
  const seniority_bonus = years >= 20 ? CALIBRATION.SENIORITY_BONUS_20YR : years >= 15 ? CALIBRATION.SENIORITY_BONUS_15YR : 0;
  const di_penalty = determinismIndex > CALIBRATION.DI_PENALTY_THRESHOLD ? Math.round((determinismIndex - CALIBRATION.DI_PENALTY_THRESHOLD) * CALIBRATION.DI_PENALTY_RATE) : 0;

  // 6. Tone Tag
  const toneTag = deriveToneTag(determinismIndex);

  // 7. Replacing Tools (from KG)
  const replacingTools = extractReplacingTools(profile, skillRiskData, jobData);

  // 8. Execution Skills Dead — actually analyze which execution skills have high automation risk
  //    NOT just a blind copy of the first 3 execution skills
  
  // Commodity skills that are trivially obvious and should NEVER appear as "exposure points"
  // especially for senior profiles — they add no analytical value
  const COMMODITY_SKILLS = new Set([
    'email_writing', 'email_management', 'emailwriting', 'email', 'emailing',
    'calendar_management', 'scheduling', 'meeting_scheduling',
    'basic_copywriting', 'copywriting', 'note_taking', 'notetaking',
    'filing', 'data_entry', 'dataentry', 'internet_research',
    'phone_calls', 'travel_booking', 'expense_reporting',
    'report_writing', 'reportwriting', 'typing', 'word_processing',
    'powerpoint', 'presentation_creation', 'spreadsheet_management',
  ]);
  
  const seniorityTierForFilter = profile.seniority_tier || null;
  const isExecOrSenior = seniorityTierForFilter === 'EXECUTIVE' || seniorityTierForFilter === 'SENIOR_LEADER';
  
  const executionSkillsDead: string[] = [];
  for (const execSkill of profile.execution_skills) {
    const normExec = execSkill.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    // Skip commodity skills — especially for executives, but filter for all tiers
    if (COMMODITY_SKILLS.has(normExec)) continue;
    
    // For executives, also skip any skill that matches trivially generic KG entries
    if (isExecOrSenior) {
      const matched = matchSkillToKG(execSkill, skillRiskData);
      // Skip if it's a generic commodity category (communication, content) with high automation
      // but low strategic relevance — executives have more important exposure vectors
      if (matched && ['communication', 'content', 'admin'].includes(matched.category || '') && matched.automation_risk > 50) {
        continue;
      }
    }
    
    const matched = matchSkillToKG(execSkill, skillRiskData);
    // Only mark as "dead" if KG confirms high automation risk (>50%)
    // or if no KG match but the job baseline suggests high risk
    if (matched && matched.automation_risk > 50) {
      executionSkillsDead.push(execSkill);
    } else if (!matched && jobBaseline > 65) {
      executionSkillsDead.push(execSkill);
    }
  }
  // Fallback: if no skills are marked dead but DI is high, mark the most automatable ones
  // For executives, use a higher DI threshold since their exposure is organizational, not task-level
  const deadFallbackThreshold = isExecOrSenior ? 75 : 60;
  if (executionSkillsDead.length === 0 && determinismIndex > deadFallbackThreshold) {
    // For executives, don't blindly grab first skills — only use non-commodity ones
    const fallbackSkills = profile.execution_skills.filter(s => {
      const norm = s.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
      return !COMMODITY_SKILLS.has(norm);
    });
    executionSkillsDead.push(...fallbackSkills.slice(0, 2));
  }

  // 9. Data Quality
  const totalUserSkills = new Set([...profile.execution_skills, ...profile.all_skills].map(s => s.toLowerCase().trim())).size;
  const dataQuality = assessDataQuality(
    profile,
    diResult.matchedCount,
    totalUserSkills,
    hasLinkedIn,
    !!jobData,
    !!marketSignal
  );

  // 10. Months remaining
  const monthsRemaining = timeline.yellow_zone_months;

  // Task 1: Score Breakdown
  const score_breakdown: ScoreBreakdown = {
    base_score: diResult.baseScore,
    skill_adjustments: diResult.skillAdjustments,
    weighted_skill_average: diResult.weightedSkillAverage,
    market_pressure: diResult.marketPressure,
    experience_reduction: diResult.experienceReduction,
    pre_clamp_score: diResult.preClampScore,
    final_clamped: determinismIndex,
    company_health_modifier: companyHealthModifier,
    company_health_score: companyHealthScore ?? null,
    salary_bleed_breakdown: {
      depreciation_rate: salaryBleed.depreciationRate,
      market_amplifier: salaryBleed.marketAmplifier,
      ai_pressure_add: salaryBleed.aiPressureAdd,
      final_rate: salaryBleed.finalRate,
    },
    survivability_breakdown: {
      base: CALIBRATION.SURVIVABILITY_BASE,
      experience_bonus: survivability.breakdown.experience_bonus,
      strategic_bonus: survivability.breakdown.strategic_bonus,
      geo_bonus: survivability.breakdown.geo_bonus,
      adaptability_bonus: survivability.breakdown.adaptability_bonus,
      seniority_bonus,
      di_penalty,
      final: survivability.score,
    },
  };

  // Task 2: Score Variability
  const score_variability = calculateScoreVariability(
    determinismIndex,
    diResult.matchedCount,
    monthlySalary,
    marketSignal
  );

  // Phase 2: Moat Score and Urgency Score
  const moat_score = calculateMoatScore(profile, skillRiskData, diResult.matchedCount);
  const urgency_score = calculateUrgencyScore(profile, determinismIndex, marketSignal);

  // Add profile completeness if provided
  if (profileCompletenessPct !== undefined) {
    dataQuality.profile_completeness_pct = profileCompletenessPct;
  }
  if (profileGaps !== undefined) {
    dataQuality.profile_gaps = profileGaps;
  }

  return {
    determinism_index: determinismIndex,
    determinism_confidence: diResult.confidence,
    matched_skill_count: diResult.matchedCount,
    months_remaining: monthsRemaining,
    salary_bleed_monthly: salaryBleed.monthly,
    total_5yr_loss_inr: salaryBleed.total5yr,
    obsolescence_timeline: timeline,
    survivability,
    tone_tag: toneTag,
    replacing_tools: replacingTools,
    execution_skills_dead: executionSkillsDead,
    data_quality: dataQuality,
    score_breakdown,
    score_variability,
    moat_score,
    urgency_score,
  };
}
