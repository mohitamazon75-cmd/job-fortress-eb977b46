// ═══════════════════════════════════════════════════════════════
// Career Pivot Engine — Types
// ═══════════════════════════════════════════════════════════════

export type DifficultyLabel = 'Easy' | 'Medium' | 'Hard';
export type RoleType = 'adjacent' | 'stretch';
export type FeedbackType = 'helpful' | 'not_helpful' | 'applied' | 'irrelevant';

export interface SkillGap {
  skill_name: string;
  importance: 'core' | 'optional';
  proficiency_needed: string;
  proof_suggestion: string;
}

export interface SalaryBand {
  min_lpa: number;
  max_lpa: number;
  median_lpa: number;
  confidence: 'high' | 'medium' | 'low';
  currency: string;
}

export interface ReadinessEstimate {
  light_weeks: number;   // 4 hrs/week
  steady_weeks: number;  // 7 hrs/week
  aggressive_weeks: number; // 12 hrs/week
}

export interface PivotScores {
  transferability: number;  // 0-1
  safety: number;           // 0-1
  demand: number;           // 0-1
  salary: number;           // 0-1
  feasibility: number;      // 0-1
  overall: number;          // 0-1
}

export interface PivotRecommendation {
  target_role: string;
  role_type: RoleType;
  difficulty: DifficultyLabel;
  scores: PivotScores;
  skill_match_pct: number;
  skill_gaps: SkillGap[];
  salary_band: SalaryBand;
  readiness: ReadinessEstimate;
  why_it_fits: string[];
  why_its_safer: string[];
  transition_plan: string[];
  sample_companies: string[];
  demand_trend: 'growing' | 'stable' | 'declining';
}

export interface PivotEngineOutput {
  adjacent_roles: PivotRecommendation[];
  stretch_role: PivotRecommendation | null;
  current_role_summary: {
    title: string;
    safety_score: number;
    routine_intensity: number;
  };
  analysis_quality: 'high' | 'medium' | 'low';
  disclaimer: string;
}
