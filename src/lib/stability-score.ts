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
 *  below the KG baseline before being snapped back */
const MAX_AI_OPTIMISM_DEVIATION = 15;

/** Moat score cap when fewer than MIN_VERIFIED_MOAT_SKILLS are present */
const UNVERIFIED_MOAT_CAP = 55;
const MIN_VERIFIED_MOAT_SKILLS = 4;

/** Market percentile cap when no real cohort data backs the value */
const UNVERIFIED_MARKET_CAP = 55;

/** Seniority protection values — higher seniority = more runway */
const SENIORITY_PROTECTION: Record<string, number> = {
  EXECUTIVE: 85, SENIOR_LEADER: 70, MANAGER: 55, PROFESSIONAL: 40, ENTRY: 25,
};

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
  const seniorityProtection = SENIORITY_PROTECTION[tier] ?? 40;

  // ── Step 2: KG Floor Enforcement ──
  // The server's deterministic engine already applies industry floors,
  // sub-sector floors, and KG skill matching. When determinism_index
  // is present, it IS the KG-corrected value — don't re-apply floors.
  // Only apply client-side KG floors when using raw automation_risk
  // (i.e., the AI agent's unverified estimate, no server pass).
  let effectiveAutomationRisk = aiAutomationRisk;
  let kgOverrideApplied = false;

  const serverAlreadyCorrected = report.determinism_index != null;

  if (!serverAlreadyCorrected) {
    // Fallback: no server DI available, apply client-side KG floors
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
          `[ScoreEngine] KG override: AI said risk=${aiAutomationRisk}% for "${report.role}", ` +
          `but KG baseline=${kgBaseline}%. Snapped to ${effectiveAutomationRisk}%.`
        );
      }
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
  const hasCohortData = (report as any).cohort_size > 10
    || report.survivability?.peer_percentile_estimate;
  const effectiveMarketPercentile = hasCohortData
    ? aiMarketPercentile
    : Math.min(aiMarketPercentile, UNVERIFIED_MARKET_CAP);

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
