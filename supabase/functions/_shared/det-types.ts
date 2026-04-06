/**
 * @fileoverview Type definitions for the deterministic scoring engine.
 * All interfaces used across det-industry, det-scoring, det-lifecycle,
 * and det-orchestrator are defined here to prevent circular imports.
 */

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

/** Pre-built hashmap index for O(1) KG skill lookups. */
export interface KGSkillIndex {
  /** exact normalized name → SkillRiskRow */
  exact: Map<string, SkillRiskRow>;
  /** all normalized names for substring fallback */
  entries: Array<{ norm: string; row: SkillRiskRow }>;
}
