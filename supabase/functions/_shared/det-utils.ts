/**
 * @fileoverview Calibration constants and foundational utility functions
 * for the deterministic scoring engine. No dependencies on other det-* files
 * except det-types.ts — this is the base layer.
 */

import type { SkillRiskRow, KGSkillIndex } from "./det-types.ts";

// ── CALIBRATION CONFIG ──
// All tunable constants in one place. Each documented with rationale.
// Last calibrated: 2026-04 (hand-tuned baselines — to be validated against real career outcome data)
export const CALIBRATION = {
  // Monthly salary depreciation rate when DI=50 (baseline midpoint)
  // Hand-tuned from Indian IT market 2023-2024 salary compression trends
  // TODO: validate against real longitudinal salary data when available
  SALARY_BLEED_BASE_RATE: 0.35,

  // Maximum salary bleed cap — even fully automatable roles retain 40% value floor
  SALARY_BLEED_CAP: 0.60,

  // Power curve exponent for salary bleed scaling — >1 means accelerating loss at higher DI
  SALARY_BLEED_POWER: 1.2,

  // DI normalization point for salary bleed calculation (DI/70 = 1.0x multiplier)
  SALARY_BLEED_DI_NORM: 70,

  // AI pressure kicks in above this DI threshold (below = minimal AI impact on salary)
  AI_PRESSURE_THRESHOLD: 30,

  // Divisor for AI pressure contribution to bleed (higher = less impact per DI point)
  AI_PRESSURE_DIVISOR: 200,

  // Divisor for market health amplification of salary bleed
  MARKET_AMPLIFIER_DIVISOR: 50,

  // Experience years threshold before seniority reduction applies
  EXPERIENCE_THRESHOLD_YEARS: 8,

  // Percentage reduction per year of experience above threshold (0.8 = 0.8% per year)
  EXPERIENCE_REDUCTION_PER_YEAR: 0.8,

  // Max experience-based DI reduction for non-executives (percentage points)
  EXPERIENCE_REDUCTION_CAP: 15,

  // Max experience-based DI reduction for executives (higher due to institutional knowledge moat)
  EXECUTIVE_EXPERIENCE_REDUCTION_CAP: 20,

  // Flat survivability bonus for EXECUTIVE tier (organizational judgment moat)
  EXECUTIVE_SURVIVABILITY_BONUS: 10,

  // Base survivability score before skill/market adjustments (floor for all profiles)
  SURVIVABILITY_BASE: 25,

  // Power curve for obsolescence timeline — >1 means low-DI roles get disproportionately more months
  OBSOLESCENCE_POWER_CURVE: 1.3,

  // Base months for obsolescence calculation (anchor point = 5 years)
  OBSOLESCENCE_BASE_MONTHS: 60,

  // Range in months added/subtracted from base based on DI (total swing = 2x this value)
  OBSOLESCENCE_RANGE: 50,

  // Annual AI capability acceleration rate (12% per year compounding from baseline year)
  // Source: estimated from AI benchmark improvement rates 2022-2025
  OBSOLESCENCE_AI_ACCELERATION_RATE: 0.12,

  // Baseline year for AI acceleration calculation
  OBSOLESCENCE_AI_BASELINE_YEAR: 2025,

  // Weight of market decline signal on obsolescence timeline reduction
  OBSOLESCENCE_MARKET_DECLINE_WEIGHT: 0.15,

  // Weight of AI job mentions signal on obsolescence timeline reduction
  OBSOLESCENCE_AI_MENTIONS_WEIGHT: 0.10,

  // Obsolescence reduction factor for ORANGE risk zone (moderate acceleration)
  OBSOLESCENCE_ZONE_ORANGE_FACTOR: 0.35,

  // Obsolescence reduction factor for RED risk zone (severe acceleration)
  OBSOLESCENCE_ZONE_RED_FACTOR: 0.70,

  // Scaling factor for market pressure contribution to DI
  MARKET_PRESSURE_SCALE: 10,

  // DI bonus for 20+ year veterans (institutional knowledge moat)
  SENIORITY_BONUS_20YR: 6,

  // DI bonus for 15+ year veterans
  SENIORITY_BONUS_15YR: 3,

  // DI threshold above which penalty scaling applies to survivability
  DI_PENALTY_THRESHOLD: 50,

  // Rate at which DI above threshold reduces survivability (0.2 = 0.2 points per DI point)
  DI_PENALTY_RATE: 0.2,

  // Base confidence margin (±) for score ranges shown to users
  CONFIDENCE_BASE_MARGIN: 15,

  // Minimum DI score — prevents false certainty of 0% automation risk
  DI_CLAMP_MIN: 5,

  // Maximum DI score — even the most automatable role retains some human oversight component
  DI_CLAMP_MAX: 95,

  // Minimum survivability — even highest-risk profiles have some transition runway
  SURVIVABILITY_CLAMP_MIN: 5,

  // Maximum survivability — no role is 100% immune to AI disruption
  SURVIVABILITY_CLAMP_MAX: 95,

  // DI ceiling for roles flagged as essential (healthcare, emergency services, etc.)
  ESSENTIAL_ROLE_DI_CEILING: 70,

  // Survivability floor for essential roles — society needs these regardless of AI capability
  ESSENTIAL_ROLE_SURVIVABILITY_FLOOR: 30,
} as const;

// ── String utilities ──

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}

// ── KG Skill Matching ──

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

// Substring containment is only safe when the shorter side is long enough that
// it represents a real concept, not a 2-3 letter fragment. Without this guard,
// "sql" matches "graphql", "ai" matches "email", "r" matches every skill, etc.
// India launch fix: false skill matches were inflating/deflating risk scores.
const MIN_CONTAINMENT_LEN = 5;

function safeContainment(a: string, b: string): boolean {
  // Require the SHORTER string to be at least MIN_CONTAINMENT_LEN chars,
  // and require the longer string to not be massively longer (prevents
  // "sql" -> "postgresqldba" type false positives).
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < MIN_CONTAINMENT_LEN) return false;
  if (longer.length > shorter.length * 2.5) return false;
  return longer.includes(shorter);
}

export function matchSkillToKG(
  userSkill: string,
  skillRiskData: SkillRiskRow[],
  index?: KGSkillIndex
): SkillRiskRow | null {
  const normSkill = normalize(userSkill);
  if (!normSkill) return null;

  if (index) {
    const exactMatch = index.exact.get(normSkill);
    if (exactMatch) return exactMatch;
    for (const { norm, row } of index.entries) {
      if (safeContainment(normSkill, norm)) return row;
    }
    for (const { norm, row } of index.entries) {
      if (levenshteinSimilarity(normSkill, norm) > 0.85) return row;
    }
    return null;
  }

  // Legacy path: no index
  for (const dbSkill of skillRiskData) {
    const normDb = normalize(dbSkill.skill_name);
    if (safeContainment(normSkill, normDb) || levenshteinSimilarity(normSkill, normDb) > 0.85) {
      return dbSkill;
    }
  }
  return null;
}
