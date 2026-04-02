// ═══════════════════════════════════════════════════════════════
// RiskIQ Advanced Beta — Shared Types
// ═══════════════════════════════════════════════════════════════

export interface RiskIQForm {
  role: string;
  industry: string;
  experience: string;
  city: string;
  education: string;
}

export interface RiskIQResult {
  risk_score: number;
  risk_tier: string;
  accent_color: string;
  headline: string;
  summary: string;
  confidence: number;
  dimensions: DimensionScore[];
  timeline: TimelineData;
  threats: ThreatItem[];
  strengths: StrengthItem[];
  peer_comparison: PeerComparison;
  secret_weapon: string;
  survival_plan: SurvivalPhase[];
  pivot_roles: PivotRole[];
  viral: ViralMetrics;
  extracted_skills: string[];
  data_sources: string[];
  live_signals?: LiveSignals | null;
  engine_version?: string;
  computed_at?: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  weighted_contribution: number;
  explanation: string;
}

export interface ThreatItem {
  name: string;
  severity: number;
  eta: string;
  detail: string;
  ai_tools: string[];
}

export interface StrengthItem {
  title: string;
  detail: string;
  durability: string;
}

export interface PivotRole {
  role: string;
  fit_score: number;
  why: string;
  salary_shift: string;
  risk_score_of_pivot: number;
  time_to_transition: string;
}

export interface SurvivalPhase {
  label: string;
  timeframe: string;
  actions: string[];
  focus_skills: string[];
}

export interface PeerComparison {
  percentile: number;
  city_rank: string;
  industry_rank: string;
  global_rank: string;
}

export interface ViralMetrics {
  doomsday_date: string;
  doomsday_days: number;
  survival_rating: string;
  industry_extinction_pct: number;
  last_human_standing_rank: number;
  share_headline: string;
}

export interface TimelineData {
  partial: string;
  significant: string;
  critical: string;
  partial_date: string;
  significant_date: string;
  critical_date: string;
  partial_years: number;
  significant_years: number;
  critical_years: number;
}

export interface LiveSignals {
  market_trend?: string;
  salary_trend?: string;
  ai_adoption_rate?: string;
  recent_layoffs?: string;
  top_emerging_roles?: string[];
  citations?: string[];
  raw?: string;
}

// Config
export const INDUSTRIES = [
  "Finance & Banking", "Accounting", "Legal", "Software Engineering", "Data Science",
  "Marketing", "Sales", "Customer Service", "Healthcare", "Education",
  "Manufacturing", "Logistics & Supply Chain", "HR & Recruiting", "Journalism & Media",
  "Graphic Design", "Architecture", "Research", "Consulting", "Retail", "Real Estate",
];

export const ROLES = [
  "CEO / Founder", "CTO / VP Engineering", "Product Manager", "Software Engineer",
  "Data Scientist", "ML Engineer", "Data Analyst", "Business Analyst", "Financial Analyst",
  "Accountant / Auditor", "Lawyer / Paralegal", "HR Manager", "Recruiter", "Sales Rep",
  "Marketing Manager", "Content Writer", "Graphic Designer", "UX Designer",
  "Customer Support", "Operations Manager", "Project Manager", "Teacher / Professor",
  "Doctor / Nurse", "Researcher", "Consultant",
];

export const CITIES = [
  "San Francisco", "New York", "London", "Singapore", "Seattle", "Austin", "Boston",
  "Toronto", "Berlin", "Sydney", "Mumbai", "Bangalore", "Dubai", "Chicago",
  "Los Angeles", "Paris", "Amsterdam",
];

export const EXPERIENCE_OPTIONS = [
  "Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10–15 years", "15+ years",
];

export const EDUCATION_OPTIONS = [
  "High School", "Some College", "Bachelor's Degree", "Master's Degree",
  "PhD", "MBA", "Bootcamp / Certification",
];

// Tier helpers
export function getTierColor(tier: string): string {
  if (tier === "Critical" || tier === "High") return "text-destructive";
  if (tier === "Moderate") return "text-prophet-gold";
  return "text-prophet-green";
}

export function getTierBg(tier: string): string {
  if (tier === "Critical" || tier === "High") return "bg-destructive/10 border-destructive/20";
  if (tier === "Moderate") return "bg-prophet-gold/10 border-prophet-gold/20";
  return "bg-prophet-green/10 border-prophet-green/20";
}

export function getTierHsl(tier: string): string {
  if (tier === "Critical" || tier === "High") return "var(--destructive)";
  if (tier === "Moderate") return "var(--prophet-gold)";
  return "var(--prophet-green)";
}
