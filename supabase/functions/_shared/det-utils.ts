/**
 * @fileoverview Calibration constants and foundational utility functions
 * for the deterministic scoring engine. No dependencies on other det-* files
 * except det-types.ts — this is the base layer.
 */

import type { SkillRiskRow, KGSkillIndex } from "./det-types.ts";

// ── CALIBRATION CONFIG ──
// All tunable constants in one place. Each documented with rationale.
export const CALIBRATION = {
  SALARY_BLEED_BASE_RATE: 0.35,
  SALARY_BLEED_CAP: 0.60,
  SALARY_BLEED_POWER: 1.2,
  SALARY_BLEED_DI_NORM: 70,
  AI_PRESSURE_THRESHOLD: 30,
  AI_PRESSURE_DIVISOR: 200,
  MARKET_AMPLIFIER_DIVISOR: 50,
  EXPERIENCE_THRESHOLD_YEARS: 8,
  EXPERIENCE_REDUCTION_PER_YEAR: 0.8,
  EXPERIENCE_REDUCTION_CAP: 15,
  EXECUTIVE_EXPERIENCE_REDUCTION_CAP: 20,
  EXECUTIVE_SURVIVABILITY_BONUS: 10,
  SURVIVABILITY_BASE: 25,
  OBSOLESCENCE_POWER_CURVE: 1.3,
  OBSOLESCENCE_BASE_MONTHS: 60,
  OBSOLESCENCE_RANGE: 50,
  OBSOLESCENCE_AI_ACCELERATION_RATE: 0.12,
  OBSOLESCENCE_AI_BASELINE_YEAR: 2025,
  OBSOLESCENCE_MARKET_DECLINE_WEIGHT: 0.15,
  OBSOLESCENCE_AI_MENTIONS_WEIGHT: 0.10,
  OBSOLESCENCE_ZONE_ORANGE_FACTOR: 0.35,
  OBSOLESCENCE_ZONE_RED_FACTOR: 0.70,
  MARKET_PRESSURE_SCALE: 10,
  SENIORITY_BONUS_20YR: 6,
  SENIORITY_BONUS_15YR: 3,
  DI_PENALTY_THRESHOLD: 50,
  DI_PENALTY_RATE: 0.2,
  CONFIDENCE_BASE_MARGIN: 15,
  DI_CLAMP_MIN: 5,
  DI_CLAMP_MAX: 95,
  SURVIVABILITY_CLAMP_MIN: 5,
  SURVIVABILITY_CLAMP_MAX: 95,
  ESSENTIAL_ROLE_DI_CEILING: 70,
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
      if (normSkill.includes(norm) || norm.includes(normSkill)) return row;
    }
    for (const { norm, row } of index.entries) {
      if (levenshteinSimilarity(normSkill, norm) > 0.7) return row;
    }
    return null;
  }

  // Legacy path: no index
  for (const dbSkill of skillRiskData) {
    const normDb = normalize(dbSkill.skill_name);
    if (normSkill.includes(normDb) || normDb.includes(normSkill) || levenshteinSimilarity(normSkill, normDb) > 0.7) {
      return dbSkill;
    }
  }
  return null;
}
