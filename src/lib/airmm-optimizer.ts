// ═══════════════════════════════════════════════════════════════
// AIRMM Multi-Pivot Optimizer — Client-Side Facade
// Core scoring logic has been moved server-side for IP protection.
// This module provides types and builder functions only.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { ScanReport } from './scan-engine';
import { computeScoreBreakdown } from './stability-score';
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

export interface HumanCapital {
  skillScore: number;
  adaptability: number;
}

export interface MarketFactors {
  demandMultiplier: number;
  automationPressure: number;
  contractionRate: number;
}

export interface NetworkCapital {
  strength: number;
}

export interface FinancialState {
  monthlyBurn: number;
  liquidSavings: number;
}

export interface Constraints {
  availableHoursPerWeek: number;
  mobilityRestricted: boolean;
  riskTolerance: RiskTolerance;
}

export interface Geography {
  accessibility: number;
}

export interface AIRMMState {
  currentIncome: number;
  humanCapital: HumanCapital;
  market: MarketFactors;
  network: NetworkCapital;
  financial: FinancialState;
  constraints: Constraints;
  geography: Geography;
}

export interface PivotOption {
  id: string;
  label: string;
  targetIncome: number;
  skillMatch: number;
  learningMonths: number;
  learningHoursTotal: number;
  hiringBarrier: number;
  credentialBarrier: number;
  relocationRequired: boolean;
}

export interface RankedPivot {
  pivot: PivotOption;
  score: number;
  expectedValue: number;
  downsideRisk: number;
  successProbability: number;
  feasible: boolean;
}

export interface OptimizationResult {
  bestPivot: PivotOption | null;
  expectedValue: number;
  downsideRisk: number;
  successProbability: number;
  ranked: RankedPivot[];
}

/* ================= Clamp helper ================= */
const clamp = (x: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, x));

/* ================= Server-side optimizer call ================= */
export async function optimizePivotsRemote(
  state: AIRMMState,
  pivots: PivotOption[],
  horizonMonths = 60
): Promise<OptimizationResult> {
  const { data, error } = await supabase.functions.invoke('optimize-pivots', {
    body: { state, pivots, horizonMonths },
  });

  if (error || !data || data.error) {
    console.error('[AIRMM] Server-side optimization failed, using fallback', error || data?.error);
    // Fallback: simple sorting by skill match (no proprietary logic exposed)
    const ranked: RankedPivot[] = pivots.map(p => ({
      pivot: p,
      score: p.skillMatch * 100,
      expectedValue: 0,
      downsideRisk: 0.5,
      successProbability: p.skillMatch * 0.8,
      feasible: true,
    }));
    ranked.sort((a, b) => b.score - a.score);
    return {
      bestPivot: ranked[0]?.pivot ?? null,
      expectedValue: 0,
      downsideRisk: 0.5,
      successProbability: ranked[0]?.successProbability ?? 0,
      ranked,
    };
  }

  return data as OptimizationResult;
}

/* ================= Builder: ScanReport → AIRMMState ================= */

export function buildAIRMMState(report: ScanReport): AIRMMState {
  const survivability = report.survivability?.score ?? 50;
  // Use KG-corrected risk from the unified score engine
  const breakdown = computeScoreBreakdown(report);
  const di = breakdown.effectiveAutomationRisk;
  // Direct salary estimate — avoids circular back-calculation from DI
  const monthlySalary = (report as any).estimated_monthly_salary_inr
    ?? (report.survivability?.breakdown?.experience_bonus
      ? Math.round(50000 + report.survivability.breakdown.experience_bonus * 5000)
      : 80000);

  return {
    currentIncome: monthlySalary,
    humanCapital: {
      skillScore: clamp(survivability / 100),
      adaptability: clamp((report.moat_skills?.length || 0) * 0.25, 0, 1),
    },
    market: {
      demandMultiplier: di < 40 ? 1.2 : di < 60 ? 1.0 : 0.8,
      automationPressure: clamp(di / 100),
      contractionRate: di > 70 ? -0.15 : di > 50 ? -0.05 : 0.05,
    },
    network: {
      strength: report.linkedin_name ? 0.5 : 0.3,
    },
    financial: {
      monthlyBurn: Math.round(monthlySalary * 0.7),
      liquidSavings: monthlySalary * 6,
    },
    constraints: {
      availableHoursPerWeek: 10,
      mobilityRestricted: false,
      riskTolerance: di > 70 ? "HIGH" : di > 40 ? "MEDIUM" : "LOW",
    },
    geography: {
      accessibility: report.geo_arbitrage ? clamp(report.geo_arbitrage.geo_probability_pct / 100) : 0.5,
    },
  };
}
export function buildPivotOptions(report: ScanReport): PivotOption[] {
  // Direct salary estimate — same logic as buildAIRMMState
  const monthlySalary = (report as any).estimated_monthly_salary_inr
    ?? (report.survivability?.breakdown?.experience_bonus
      ? Math.round(50000 + report.survivability.breakdown.experience_bonus * 5000)
      : 80000);

  const pivots: PivotOption[] = [];

  if (report.arbitrage_role) {
    pivots.push({
      id: 'pivot-recommended',
      label: report.arbitrage_role,
      targetIncome: Math.round(monthlySalary * 1.4),
      skillMatch: 0.65,
      learningMonths: 3,
      learningHoursTotal: 120,
      hiringBarrier: 0.4,
      credentialBarrier: 0.3,
      relocationRequired: false,
    });
  }

  pivots.push({
    id: 'pivot-augmented',
    label: `AI-Augmented ${report.role}`,
    targetIncome: Math.round(monthlySalary * 1.2),
    skillMatch: 0.85,
    learningMonths: 2,
    learningHoursTotal: 60,
    hiringBarrier: 0.2,
    credentialBarrier: 0.1,
    relocationRequired: false,
  });

  if (report.skill_gap_map?.length) {
    const gap = report.skill_gap_map[0];
    pivots.push({
      id: 'pivot-upskill',
      label: `${gap.missing_skill} Specialist`,
      targetIncome: Math.round(monthlySalary + (gap.salary_unlock_inr_monthly || monthlySalary * 0.3)),
      skillMatch: 0.45,
      learningMonths: gap.weeks_to_proficiency ? Math.ceil(gap.weeks_to_proficiency / 4) : 4,
      learningHoursTotal: (gap.weeks_to_proficiency || 16) * 8,
      hiringBarrier: 0.5,
      credentialBarrier: 0.4,
      relocationRequired: false,
    });
  }

  if (report.geo_arbitrage) {
    pivots.push({
      id: 'pivot-geo',
      label: `Remote ${report.role} (${report.geo_arbitrage.target_market})`,
      targetIncome: Math.round(monthlySalary + report.geo_arbitrage.probability_adjusted_delta_inr),
      skillMatch: 0.75,
      learningMonths: 1,
      learningHoursTotal: 20,
      hiringBarrier: 0.6,
      credentialBarrier: 0.2,
      relocationRequired: false,
    });
  }

  pivots.push({
    id: 'pivot-lateral',
    label: `${report.role} → Adjacent Industry`,
    targetIncome: Math.round(monthlySalary * 1.1),
    skillMatch: 0.6,
    learningMonths: 2,
    learningHoursTotal: 40,
    hiringBarrier: 0.45,
    credentialBarrier: 0.35,
    relocationRequired: false,
  });

  return pivots;
}
