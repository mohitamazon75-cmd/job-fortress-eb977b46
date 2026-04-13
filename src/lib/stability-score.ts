import { type ScanReport } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';

// ═══════════════════════════════════════════════════════════════
// HYPER-REALISTIC DETERMINISTIC SCORING ENGINE v2.0
// 
// Design principles:
// 1. KG-anchored: AI agent scores are bounded by Knowledge Graph
//    baselines. An agent cannot claim a role is "safe" when the
//    KG says otherwise.
// 2. Conservative calibration: A skepticism discount ensures
//    scores reflect real-world displacement risk honestly.
// 3. Evidence-gated: High scores require verified evidence
//    (moat skills, cohort data). Unverified optimism is capped.
// 4. Deterministic: Same inputs always produce same output.
//    No randomness, no LLM-dependent scoring paths.
//
// Formula: score = clamp(5, 95, round(calibrate(weighted_sum)))
// Where calibrate(x) = x * SKEPTICISM_FACTOR + FLOOR_OFFSET
// ═══════════════════════════════════════════════════════════════

// ── Tuning constants (named, documented, no magic numbers) ──

/** How much weight each factor gets in the final score */
const W_AI_RESISTANCE    = 0.30;  // Biggest driver: how automatable is this role?
const W_MARKET_POSITION  = 0.25;  // Job market health for this role
const W_HUMAN_EDGE       = 0.20;  // Moat skills that AI can't replicate
const W_INCOME_STABILITY = 0.15;  // Salary disruption risk
const W_SENIORITY_SHIELD = 0.10;  // Experience-based protection

/** Skepticism multiplier — compresses inflated scores toward reality */
const SKEPTICISM_FACTOR = 0.82;

/** Floor offset — prevents mathematically impossible sub-10 scores */
const FLOOR_OFFSET = 9;

/** Max optimism credit: AI agent can deviate at most this many points
 *  below the KG baseline before being snapped back.
 *  Reduced from 15→5 after finding server DI=22 for Marketing (KG=65%). */
const MAX_AI_OPTIMISM_DEVIATION = 5;

/** Moat score cap when fewer than MIN_VERIFIED_MOAT_SKILLS are present */
const UNVERIFIED_MOAT_CAP = 55;
const MIN_VERIFIED_MOAT_SKILLS = 4;

/** Market percentile cap when no real cohort data backs the value */
const UNVERIFIED_MARKET_CAP = 55;

/** Seniority baseline — floor only. CareerCapital adds dynamic components on top.
 *  Floor set to match old SENIORITY_PROTECTION for industry-only (sparse) scans,
 *  so existing users without LinkedIn data don't see a sudden score drop. */
const SENIORITY_PROTECTION_FLOOR: Record<string, number> = {
  EXECUTIVE: 72, SENIOR_LEADER: 58, MANAGER: 44, PROFESSIONAL: 30, ENTRY: 18,
};

/**
 * STEP 5 (BUG-4 fix): Dynamic CareerCapital score.
 *
 * Replaces the static SENIORITY_PROTECTION lookup which was frozen per-tier and
 * could never improve through any user action.
 *
 * CareerCapital = moat_depth + experience_log + adaptability_depth + cohort_bonus
 *
 * Every component is improvable:
 * - moat_depth: build more verified moat skills (actions user takes between scans)
 * - experience_log: grows with career tenure (background signal, stable)
 * - adaptability_depth: certifications, cross-role signals from Agent 1
 * - cohort_bonus: added when real peer data validates position
 *
 * Output: 0–100, higher = more career capital / harder to displace
 * Seniority floor ensures the score never drops below the old SENIORITY_PROTECTION
 * value for backward compatibility with scans that have no moat_skills data.
 */
function computeCareerCapital(report: ScanReport, tier: string): number {
  const floor = SENIORITY_PROTECTION_FLOOR[tier] ?? 18;

  // Component 1: Moat depth (0–45)
  // 4+ verified moat skills = full 45; <4 scales proportionally
  const moatCount = (report.moat_skills || []).length;
  const moatScore = report.moat_score ?? 0;
  // Blend skill count (signals breadth) with moat_score (signals quality)
  const moatBreadth = Math.min(45, moatCount * 9);          // 5 skills = 45 pts
  const moatQuality = Math.min(45, moatScore * 0.45);       // moat_score/100 × 45
  // Weight quality higher when we have enough skills, breadth when sparse
  const moatDepth = moatCount >= 4
    ? Math.round(moatQuality * 0.6 + moatBreadth * 0.4)
    : Math.round(moatBreadth * 0.7 + moatQuality * 0.3);

  // Component 2: Experience (0–25, log-scaled so 30yr != 3× better than 10yr)
  const experienceYears = report.score_breakdown?.survivability_breakdown?.experience_bonus
    ? (report.score_breakdown.survivability_breakdown.experience_bonus / 1.5)  // reverse-engineer approx years
    : 0;
  // Fallback: infer from seniority tier
  const fallbackYears: Record<string, number> = {
    EXECUTIVE: 20, SENIOR_LEADER: 14, MANAGER: 8, PROFESSIONAL: 4, ENTRY: 1,
  };
  const years = experienceYears > 0 ? experienceYears : (fallbackYears[tier] ?? 4);
  const experienceComponent = Math.min(25, Math.round(Math.log(years + 1) * 9));

  // Component 3: Adaptability (0–20)
  // Derived from survivability adaptability_bonus (already computed server-side)
  const adaptabilityBonus = report.score_breakdown?.survivability_breakdown?.adaptability_bonus ?? 0;
  const adaptabilityComponent = Math.min(20, Math.round(adaptabilityBonus * 1.67)); // 12 max bonus → 20

  // Component 4: Cohort validation bonus (0–10)
  // Only awarded when real peer data confirms the position
  const hasPeerData = typeof (report as any).cohort_size === 'number'
    ? (report as any).cohort_size > 10
    : !!report.survivability?.peer_percentile_estimate;
  const cohortBonus = hasPeerData ? 10 : 0;

  const raw = moatDepth + experienceComponent + adaptabilityComponent + cohortBonus;

  // Never go below the seniority floor (backward compat) or above 95
  return Math.max(floor, Math.min(95, Math.round(raw)));
}

// ── Known KG disruption baselines for common role families ──
// These are sourced from job_taxonomy.disruption_baseline and act
// as hard floors that AI agents cannot override.
const KG_DISRUPTION_BASELINES: Record<string, number> = {
  'data_entry': 95, 'bank_teller': 90, 'call_center': 88,
  'illustrat': 85, 'medical_cod': 85, 'content_writ': 82,
  'customer_support': 80, 'technical_writ': 80,
  'qa_test': 78, 'social_media': 78,
  'accountant': 75, 'it_support': 75, 'copywriter': 75,
  'loan_officer': 75, 'performance_market': 75,
  'data_analyst': 72, 'tax_consult': 68, 'media_plan': 68,
  'recruiter': 68, 'legal_associate': 65,
  'digital_market': 65, 'market_research': 65,
  'marketing': 65, 'advertising': 65,
  'graphic_design': 62, 'ui_design': 55, 'ux_design': 50,
  'web_develop': 55, 'frontend': 52, 'backend': 48,
  'fullstack': 50, 'software_engineer': 45, 'devops': 42,
  'product_manag': 38, 'project_manag': 35,
  'solutions_architect': 32, 'research_scientist': 28,
  'doctor': 15, 'nurse': 15, 'psychologist': 15,
  'chef': 15, 'film_director': 15, 'pilot': 10,
};

/**
 * Look up the KG disruption baseline for a role by fuzzy matching
 * against known role families.
 */
function getKGBaseline(role?: string | null, matchedFamily?: string | null): number | null {
  const candidates = [matchedFamily, role].filter(Boolean).map(s => s!.toLowerCase().replace(/[^a-z]/g, '_'));
  
  for (const candidate of candidates) {
    for (const [pattern, baseline] of Object.entries(KG_DISRUPTION_BASELINES)) {
      if (candidate.includes(pattern)) return baseline;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════

export function computeStabilityScore(report: ScanReport) {
  const breakdown = computeScoreBreakdown(report);
  
  // Weighted sum of all factors (each factor is 0-100)
  const weightedSum = (
    breakdown.rawAiResistance    * W_AI_RESISTANCE +
    breakdown.rawMarketPosition  * W_MARKET_POSITION +
    breakdown.rawHumanEdge       * W_HUMAN_EDGE +
    breakdown.rawIncomeStability * W_INCOME_STABILITY +
    breakdown.rawSeniorityShield * W_SENIORITY_SHIELD
  );

  // Conservative calibration: compress toward reality
  // This prevents the common failure mode where AI agents
  // give optimistic values across multiple factors, compounding
  // into an unrealistically high score.
  const calibrated = weightedSum * SKEPTICISM_FACTOR + FLOOR_OFFSET;

  return Math.max(5, Math.min(95, Math.round(calibrated)));
}

// ═══════════════════════════════════════════════════════════════
// Score Decomposition — returns the contribution of each factor
// relative to a neutral baseline of 50, so users see what helped
// and what hurt their score.
// ═══════════════════════════════════════════════════════════════

export interface ScoreDecomposition {
  aiResistance: number;
  marketPosition: number;
  humanEdge: number;
  incomeStability: number;
  seniorityShield: number;
  rawAiResistance: number;
  rawMarketPosition: number;
  rawHumanEdge: number;
  rawIncomeStability: number;
  rawSeniorityShield: number;
  /** True if KG baseline was used to override AI agent's optimism */
  kgOverrideApplied: boolean;
  /** The effective automation risk after KG floor enforcement */
  effectiveAutomationRisk: number;
}

export function computeScoreBreakdown(report: ScanReport): ScoreDecomposition {
  // ── Step 1: Get raw AI agent values ──
  const aiAutomationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const aiMarketPercentile = report.market_position_model?.market_percentile ?? 50;
  const aiMoatScore = report.moat_score ?? 30;
  const salaryDropPct = report.career_shock_simulator?.salary_drop_percentage ?? 20;
  const tier = inferSeniorityTier(report.seniority_tier);
  // STEP 5 (BUG-4 fix): Dynamic CareerCapital replaces frozen seniority lookup.
  // Improves as user builds moat skills, gains experience, and gets cohort validation.
  const seniorityProtection = computeCareerCapital(report, tier);

  // ── Step 2: KG Floor Enforcement ──
  // ALWAYS enforce KG disruption baselines as a hard floor, regardless
  // of whether determinism_index came from the server. The server's DI
  // can be unreliable (e.g., returning 22% for Marketing when KG says 65%).
  // The KG floor is the last line of defense against score inflation.
  let effectiveAutomationRisk = aiAutomationRisk;
  let kgOverrideApplied = false;

  const kgBaseline = getKGBaseline(
    report.role,
    report.matched_job_family ?? (report as any).matchedJobFamily
  );
  
  if (kgBaseline !== null) {
    const minAllowedRisk = Math.max(0, kgBaseline - MAX_AI_OPTIMISM_DEVIATION);
    if (aiAutomationRisk < minAllowedRisk) {
      effectiveAutomationRisk = minAllowedRisk;
      kgOverrideApplied = true;
      console.log(
        `[ScoreEngine] KG override: AI/server said risk=${aiAutomationRisk}% for "${report.role}", ` +
        `but KG baseline=${kgBaseline}%. Snapped to ${effectiveAutomationRisk}%.`
      );
    }
  }

  // ── Step 3: Evidence-gated moat score ──
  // A high moat score requires actual verified moat skills.
  // This is a presentation-layer guard on top of the server's
  // structural moat calculation — prevents inflated moat display
  // when the evidence is thin.
  const verifiedMoatCount = (report.moat_skills || []).length;
  const effectiveMoat = verifiedMoatCount >= MIN_VERIFIED_MOAT_SKILLS
    ? aiMoatScore
    : Math.min(aiMoatScore, UNVERIFIED_MOAT_CAP);

  // ── Step 4: Market percentile reality check ──
  // KG-linked cap: high-disruption roles shouldn't claim top-quartile market position.
  // Formula: kgMarketCap = 100 - kgBaseline, clamped to [20, 55].
  // Seniority modifier: senior leaders in high-risk fields can still have strong
  // individual market position even as junior roles erode.
  const seniorityMarketBonus = tier === 'EXECUTIVE' ? 15 : tier === 'SENIOR_LEADER' ? 10 : tier === 'MANAGER' ? 5 : 0;
  const kgMarketCap = kgBaseline !== null
    ? Math.max(20, Math.min(65, 100 - kgBaseline + seniorityMarketBonus))
    : UNVERIFIED_MARKET_CAP;
  const hasCohortData = (report as any).cohort_size > 10
    || report.survivability?.peer_percentile_estimate;
  const effectiveMarketPercentile = Math.min(
    aiMarketPercentile,
    hasCohortData ? kgMarketCap : Math.min(kgMarketCap, UNVERIFIED_MARKET_CAP)
  );

  // ── Step 5: Compute raw factor scores (0-100, higher = better) ──
  const rawAiResistance = Math.max(0, Math.min(100, 100 - effectiveAutomationRisk));
  const rawMarketPosition = Math.max(0, Math.min(100, effectiveMarketPercentile));
  const rawHumanEdge = Math.max(0, Math.min(100, effectiveMoat));
  const rawIncomeStability = Math.max(0, Math.min(100, 100 - salaryDropPct));
  const rawSeniorityShield = seniorityProtection;

  // ── Step 6: Compute decomposition for UI display ──
  const neutral = 50;
  return {
    aiResistance:    (rawAiResistance - neutral)    * W_AI_RESISTANCE,
    marketPosition:  (rawMarketPosition - neutral)  * W_MARKET_POSITION,
    humanEdge:       (rawHumanEdge - neutral)       * W_HUMAN_EDGE,
    incomeStability: (rawIncomeStability - neutral) * W_INCOME_STABILITY,
    seniorityShield: (rawSeniorityShield - neutral) * W_SENIORITY_SHIELD,
    rawAiResistance,
    rawMarketPosition,
    rawHumanEdge,
    rawIncomeStability,
    rawSeniorityShield,
    kgOverrideApplied,
    effectiveAutomationRisk,
  };
}
