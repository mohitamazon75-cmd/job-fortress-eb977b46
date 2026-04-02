import { type ScanReport } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';

// ═══════════════════════════════════════════════════════════════
// SHARED: Career Position Score — unified formula used by
// JobDangerMeterCard, ManagerConfidenceCard, and InsightCards.
// Higher = better career position. Both cards MUST agree.
// ═══════════════════════════════════════════════════════════════

const SENIORITY_PROTECTION: Record<string, number> = {
  EXECUTIVE: 85, SENIOR_LEADER: 70, MANAGER: 55, PROFESSIONAL: 40, ENTRY: 25,
};

export function computeStabilityScore(report: ScanReport) {
  const breakdown = computeScoreBreakdown(report);
  const raw = (
    breakdown.rawAiResistance * 0.30 +
    breakdown.rawMarketPosition * 0.25 +
    breakdown.rawHumanEdge * 0.20 +
    breakdown.rawIncomeStability * 0.15 +
    breakdown.rawSeniorityShield * 0.10
  );

  return Math.max(5, Math.min(95, Math.round(raw)));
}

// ═══════════════════════════════════════════════════════════════
// Score Decomposition — returns the contribution of each factor
// relative to a neutral baseline of 50, so users see what helped
// and what hurt their score.
// ═══════════════════════════════════════════════════════════════

export interface ScoreDecomposition {
  aiResistance: number;     // weighted contribution relative to neutral
  marketPosition: number;
  humanEdge: number;
  incomeStability: number;
  seniorityShield: number;
  // Raw 0-100 values (pre-weighting)
  rawAiResistance: number;
  rawMarketPosition: number;
  rawHumanEdge: number;
  rawIncomeStability: number;
  rawSeniorityShield: number;
}

export function computeScoreBreakdown(report: ScanReport): ScoreDecomposition {
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const marketPercentile = report.market_position_model?.market_percentile ?? 50;
  const moatScore = report.moat_score ?? 30;
  const salaryDropPct = report.career_shock_simulator?.salary_drop_percentage ?? 20;
  const tier = inferSeniorityTier(report.seniority_tier);
  const seniorityProtection = SENIORITY_PROTECTION[tier] ?? 40;

  const rawAiResistance = Math.max(0, Math.min(100, 100 - automationRisk));
  const rawMarketPosition = Math.max(0, Math.min(100, marketPercentile));
  const rawHumanEdge = Math.max(0, Math.min(100, moatScore));
  const rawIncomeStability = Math.max(0, Math.min(100, 100 - salaryDropPct));
  const rawSeniorityShield = seniorityProtection;

  // Contribution = (raw - 50) * weight → positive means "helped", negative means "hurt"
  const neutral = 50;
  return {
    aiResistance: (rawAiResistance - neutral) * 0.30,
    marketPosition: (rawMarketPosition - neutral) * 0.25,
    humanEdge: (rawHumanEdge - neutral) * 0.20,
    incomeStability: (rawIncomeStability - neutral) * 0.15,
    seniorityShield: (rawSeniorityShield - neutral) * 0.10,
    rawAiResistance,
    rawMarketPosition,
    rawHumanEdge,
    rawIncomeStability,
    rawSeniorityShield,
  };
}
