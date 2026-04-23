/**
 * @fileoverview Lifecycle calculations: obsolescence timeline,
 * salary bleed, survivability, and geo-arbitrage.
 */

import { CALIBRATION } from "./det-utils.ts";
import type { ProfileInput, MarketSignalRow, ObsolescenceTimeline, SurvivabilityResult, CohortBenchmark } from "./det-types.ts";

// ═══════════════════════════════════════════════════════════════
// OBSOLESCENCE TIMELINE v2
// ═══════════════════════════════════════════════════════════════

export function calculateObsolescenceTimeline(
  determinismIndex: number,
  marketSignal?: MarketSignalRow | null,
  seniorityTier?: string | null
): ObsolescenceTimeline {
  const baseFactor = Math.pow(determinismIndex / 100, CALIBRATION.OBSOLESCENCE_POWER_CURVE);
  let baseMonths = CALIBRATION.OBSOLESCENCE_BASE_MONTHS - baseFactor * CALIBRATION.OBSOLESCENCE_RANGE;

  if (seniorityTier === 'EXECUTIVE') baseMonths *= 1.35;
  else if (seniorityTier === 'SENIOR_LEADER') baseMonths *= 1.20;
  else if (seniorityTier === 'MANAGER') baseMonths *= 1.10;

  const currentYear = new Date().getFullYear();
  const yearsDelta = Math.max(0, currentYear - CALIBRATION.OBSOLESCENCE_AI_BASELINE_YEAR);
  const accelerationMultiplier = Math.pow(1 - CALIBRATION.OBSOLESCENCE_AI_ACCELERATION_RATE, yearsDelta);
  baseMonths *= accelerationMultiplier;

  if (marketSignal) {
    let marketCompression = 1.0;
    if (marketSignal.posting_change_pct !== null && marketSignal.posting_change_pct < 0) {
      const declineIntensity = Math.min(1, Math.abs(marketSignal.posting_change_pct) / 50);
      marketCompression -= CALIBRATION.OBSOLESCENCE_MARKET_DECLINE_WEIGHT * declineIntensity;
    }
    if (marketSignal.ai_job_mentions_pct !== null && marketSignal.ai_job_mentions_pct > 10) {
      const aiPressure = Math.min(1, (marketSignal.ai_job_mentions_pct - 10) / 50);
      marketCompression -= CALIBRATION.OBSOLESCENCE_AI_MENTIONS_WEIGHT * aiPressure;
    }
    baseMonths *= marketCompression;
  }

  const yellow = Math.max(6, Math.min(60, Math.floor(baseMonths)));
  const purple = Math.max(0, yellow - 6);
  const remainingAfterYellow = Math.max(6, 60 - yellow);
  const orange = yellow + Math.round(remainingAfterYellow * CALIBRATION.OBSOLESCENCE_ZONE_ORANGE_FACTOR);
  const red = yellow + Math.round(remainingAfterYellow * CALIBRATION.OBSOLESCENCE_ZONE_RED_FACTOR);

  return { purple_zone_months: purple, yellow_zone_months: yellow, orange_zone_months: orange, red_zone_months: red, already_in_warning: yellow <= 12 };
}

// ═══════════════════════════════════════════════════════════════
// SALARY BLEED v3.2
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
// SURVIVABILITY v3.2
// ═══════════════════════════════════════════════════════════════

const GEO_SCORES: Record<string, number> = {
  "us citizen/gc": 100, "h1b holder": 70, "indian oci": 65,
  "eu passport": 60, "remote only": 55, "willing to relocate": 40,
  // Domestic India mobility — meaningful resilience signal for tier-2 professionals
  "willing to relocate within india": 30, "relocate to bangalore": 32,
  "relocate to bangalore/hyderabad": 32, "relocate to mumbai": 28,
  "relocate to pune": 25, "relocate to delhi": 24,
  "remote india": 22, "open to relocation": 20,
};

function getGeoScore(geoAdvantage: string | null): number {
  if (!geoAdvantage) return 0;
  return GEO_SCORES[geoAdvantage.toLowerCase().trim()] || 0;
}

export function calculateSurvivability(
  profile: ProfileInput,
  determinismIndex: number,
  cohortBenchmark?: CohortBenchmark | null,
): SurvivabilityResult {
  const isExec = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const base = CALIBRATION.SURVIVABILITY_BASE + (isExec ? CALIBRATION.EXECUTIVE_SURVIVABILITY_BONUS : 0);
  const years = profile.experience_years || 0;

  const experience_bonus = years <= 5
    ? Math.min(Math.floor(years * 1.5), 8)
    : years <= 10
      ? Math.min(8 + Math.floor((years - 5) * 1.0), 13)
      : Math.min(13 + Math.floor(Math.log(years - 9) * 4.0), 22);

  const strategicCap = isExec ? 25 : 14;
  const strategicMultiplier = isExec ? 5 : 7;
  const strategic_bonus = Math.min((profile.strategic_skills?.length || 0) * strategicMultiplier, strategicCap);

  const geoBase = getGeoScore(profile.geo_advantage);
  const geoMultiplier = isExec ? 0.16 : 0.12;
  const geo_bonus = Math.round(geoBase * geoMultiplier);

  const baseAdaptability = profile.adaptability_signals || 0;
  const seniorityAdaptFloor = years >= 20 ? 2 : years >= 15 ? 1 : 0;
  const effectiveAdaptability = Math.max(baseAdaptability, seniorityAdaptFloor);
  const adaptability_bonus = Math.min(effectiveAdaptability * 4, 12);

  const seniority_bonus = years >= 20 ? CALIBRATION.SENIORITY_BONUS_20YR : years >= 15 ? CALIBRATION.SENIORITY_BONUS_15YR : 0;

  let impact_bonus = 0;
  if (profile.executive_impact) {
    const impact = profile.executive_impact;
    if (impact.revenue_scope_usd && impact.revenue_scope_usd > 0) {
      impact_bonus += Math.min(8, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 3));
    }
    if (impact.regulatory_domains?.length > 0) {
      impact_bonus += Math.min(6, impact.regulatory_domains.length * 2);
    }
    if (impact.board_exposure) impact_bonus += 2;
    if (impact.investor_facing) impact_bonus += 1;
    if (impact.geographic_scope?.length > 1) {
      impact_bonus += Math.min(3, impact.geographic_scope.length);
    }
    if (impact.cross_industry_pivots > 0) {
      impact_bonus += Math.min(3, impact.cross_industry_pivots);
    }
    impact_bonus = Math.min(20, impact_bonus);
  }

  let di_penalty = 0;
  if (determinismIndex > CALIBRATION.DI_PENALTY_THRESHOLD) {
    const excess = determinismIndex - CALIBRATION.DI_PENALTY_THRESHOLD;
    di_penalty = Math.round(excess * CALIBRATION.DI_PENALTY_RATE * (1 + excess / 100));
  }

  const rawScore = base + experience_bonus + strategic_bonus + geo_bonus + adaptability_bonus + seniority_bonus + impact_bonus - di_penalty;
  const score = Math.min(CALIBRATION.SURVIVABILITY_CLAMP_MAX, Math.max(CALIBRATION.SURVIVABILITY_CLAMP_MIN, rawScore));

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

  // ── Peer percentile: prefer real cohort_percentiles data over sigmoid estimate ──
  // The DI is the threat axis used by cohort_percentiles seeds — compare DI to cohort breakpoints.
  // Lower DI = better (less automatable) = higher percentile in survivability terms.
  let peer_percentile_estimate: string;
  let peer_percentile_source: 'cohort_db' | 'estimated' = 'estimated';
  if (cohortBenchmark && cohortBenchmark.sample_size >= 100) {
    // DI percentile inverted: a user with DI < cohort.p25 sits in the top quartile of safety.
    let pct: number;
    if (determinismIndex <= cohortBenchmark.p25) pct = 90;
    else if (determinismIndex <= cohortBenchmark.p50) pct = 70;
    else if (determinismIndex <= cohortBenchmark.p75) pct = 45;
    else if (determinismIndex <= cohortBenchmark.p90) pct = 20;
    else pct = 8;
    peer_percentile_estimate = `~${pct}th percentile vs ${cohortBenchmark.sample_size.toLocaleString('en-IN')} ${cohortBenchmark.role_detected.replace(/_/g, ' ')}s${cohortBenchmark.metro_tier ? ` in ${cohortBenchmark.metro_tier}` : ''}`;
    peer_percentile_source = 'cohort_db';
  } else {
    const normalizedScore = (score - 30) / 50;
    const sigmoidPercentile = Math.round(100 / (1 + Math.exp(-3 * normalizedScore)));
    peer_percentile_estimate = `~${Math.min(95, Math.max(5, sigmoidPercentile))}th percentile in your ${isExec ? 'leadership' : 'professional'} cohort`;
  }

  return {
    score,
    breakdown: { experience_bonus, strategic_bonus, geo_bonus, adaptability_bonus },
    primary_vulnerability,
    peer_percentile_estimate,
    peer_percentile_source,
  };
}

// ═══════════════════════════════════════════════════════════════
// GEO-ARBITRAGE
// ═══════════════════════════════════════════════════════════════

const GEO_PROBABILITY: Record<string, number> = {
  "us citizen/gc": 0.85, "h1b holder": 0.70, "indian oci": 0.65,
  "eu passport": 0.60, "remote only": 0.55, "willing to relocate": 0.40,
  // AUDIT FIX: Domestic India relocation options — previously got 0 credit.
  // A tier-2 professional moving to Bangalore/Hyderabad can expect 1.4–1.8x salary uplift.
  // This is a real, achievable optionality for millions of Indian professionals.
  "willing to relocate within india": 0.60,
  "relocate to bangalore": 0.65, "relocate to bangalore/hyderabad": 0.65,
  "relocate to mumbai": 0.58, "relocate to pune": 0.55,
  "relocate to delhi": 0.52, "remote india": 0.50,
  "open to relocation": 0.45,
};

// Domestic India multiplier — much lower than international but real and achievable.
const DOMESTIC_INDIA_KEYS = new Set([
  "willing to relocate within india", "relocate to bangalore", "relocate to bangalore/hyderabad",
  "relocate to mumbai", "relocate to pune", "relocate to delhi", "remote india", "open to relocation",
]);

export function calculateGeoArbitrage(
  currentMonthlySalary: number,
  geoAdvantage: string | null,
  targetMultiplier: number = 3.0
): {
  target_market: string; raw_delta_inr_monthly: number;
  probability_adjusted_delta_inr: number; geo_probability_pct: number;
  expected_value_12mo_inr: number; fastest_path_weeks: number;
} | null {
  const key = (geoAdvantage || "").toLowerCase().trim();
  const probability = GEO_PROBABILITY[key] || 0.25;

  // Domestic India relocation: 1.5x multiplier (tier-2 → tier-1 salary uplift)
  // vs international 3.0x. More conservative but far more achievable.
  const isDomesticIndia = DOMESTIC_INDIA_KEYS.has(key) || key.includes("within india") || key.includes("relocate india");
  const effectiveMultiplier = isDomesticIndia ? 1.5 : targetMultiplier;

  const targetSalary = Math.round(currentMonthlySalary * effectiveMultiplier);
  const rawDelta = targetSalary - currentMonthlySalary;
  if (rawDelta <= 0) return null;

  // BUG-3 fix: Correct EV formula.
  // ev12mo = P(relocation succeeds) × annual_salary_gain
  const ev12mo = Math.round(probability * rawDelta * 12);
  const probAdjusted = Math.round(ev12mo / 12); // monthly average of annual EV
  const fastestWeeks = probability >= 0.7 ? 6 : probability >= 0.5 ? 10 : 16;

  const marketLabel = isDomesticIndia
    ? (key.includes("bangalore") ? "Bangalore (Domestic)" : key.includes("mumbai") ? "Mumbai (Domestic)" : "Tier-1 India City")
    : key.includes("us") || key.includes("gc") ? "US Direct"
    : key.includes("h1b") ? "US H1B Transfer"
    : key.includes("remote") ? "US/EU Remote"
    : key.includes("eu") ? "EU Market" : "Global Remote";

  return {
    target_market: marketLabel, raw_delta_inr_monthly: rawDelta,
    probability_adjusted_delta_inr: probAdjusted, geo_probability_pct: Math.round(probability * 100),
    expected_value_12mo_inr: ev12mo, fastest_path_weeks: fastestWeeks,
  };
}
