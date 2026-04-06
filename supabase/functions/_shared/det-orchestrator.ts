/**
 * @fileoverview Master orchestrator — computeAll() and helper functions
 * that compose all scoring modules into a single DeterministicResult.
 * This is the only file external callers need to import directly
 * (or use the barrel re-export in deterministic-engine.ts).
 */

import { CALIBRATION, normalize, matchSkillToKG, buildKGSkillIndex } from "./det-utils.ts";
import { isEssentialRole } from "./det-industry.ts";
import { calculateDeterminismIndex, calculateMoatScore, calculateUrgencyScore, calculateScoreVariability } from "./det-scoring.ts";
import { calculateObsolescenceTimeline, calculateSalaryBleed, calculateSurvivability } from "./det-lifecycle.ts";
import type {
  ProfileInput, SkillRiskRow, JobSkillMapRow, JobTaxonomyRow,
  MarketSignalRow, ReplacingTool, DataQuality, ScoreBreakdown,
  DeterministicResult, KGSkillIndex,
} from "./det-types.ts";

// ═══════════════════════════════════════════════════════════════
// TONE TAG (deterministic)
// ═══════════════════════════════════════════════════════════════

export function deriveToneTag(
  determinismIndex: number
): "CRITICAL" | "WARNING" | "MODERATE" | "STABLE" {
  if (determinismIndex > 80) return "CRITICAL";
  if (determinismIndex > 60) return "WARNING";
  if (determinismIndex > 40) return "MODERATE";
  return "STABLE";
}

// ═══════════════════════════════════════════════════════════════
// REPLACING TOOLS (from KG, not hallucinated)
// ═══════════════════════════════════════════════════════════════

export function extractReplacingTools(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobData: JobTaxonomyRow | null,
  kgIndex?: KGSkillIndex
): ReplacingTool[] {
  const tools: ReplacingTool[] = [];
  const seenTools = new Set<string>();

  const allSkills = [...profile.execution_skills, ...profile.all_skills];
  const seen = new Set<string>();
  const uniqueSkills = allSkills.filter((s) => {
    const n = normalize(s);
    if (seen.has(n) || !n) return false;
    seen.add(n);
    return true;
  });

  for (const skill of uniqueSkills) {
    const matched = matchSkillToKG(skill, skillRiskData, kgIndex);
    if (matched && matched.replacement_tools?.length > 0) {
      for (const toolName of matched.replacement_tools) {
        const key = toolName.toLowerCase().trim();
        if (!seenTools.has(key)) {
          seenTools.add(key);
          tools.push({
            tool_name: toolName, automates_task: skill,
            adoption_stage: matched.automation_risk > 70 ? "Mainstream" : matched.automation_risk > 40 ? "Growing" : "Early",
          });
        }
      }
    }
  }

  if (tools.length === 0 && jobData?.ai_tools_replacing) {
    const jobTools = Array.isArray(jobData.ai_tools_replacing) ? jobData.ai_tools_replacing : [];
    const execSkills = profile.execution_skills.length > 0 ? profile.execution_skills : profile.all_skills.slice(0, 3);
    for (let i = 0; i < Math.min(jobTools.length, 5); i++) {
      const name = typeof jobTools[i] === "string" ? jobTools[i] : String(jobTools[i]);
      const taskName = execSkills[i % execSkills.length] || `${jobData?.job_family || 'role'} task automation`;
      tools.push({ tool_name: name, automates_task: taskName, adoption_stage: "Growing" });
    }
  }

  return tools.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// DATA QUALITY ASSESSMENT
// ═══════════════════════════════════════════════════════════════

export function assessDataQuality(
  profile: ProfileInput,
  matchedSkillCount: number,
  totalUserSkillCount: number,
  hasLinkedIn: boolean,
  hasJobData: boolean,
  hasMarketSignal: boolean
): DataQuality {
  let profilePoints = 0;
  if (profile.experience_years) profilePoints += 20;
  if (profile.execution_skills.length >= 3) profilePoints += 25;
  if (profile.strategic_skills.length >= 2) profilePoints += 20;
  if (profile.geo_advantage) profilePoints += 10;
  if (profile.estimated_monthly_salary_inr) profilePoints += 15;
  if (hasLinkedIn) profilePoints += 10;
  const profileCompleteness = Math.min(100, profilePoints);

  let kgPoints = 0;
  if (hasJobData) kgPoints += 30;
  if (hasMarketSignal) kgPoints += 25;
  kgPoints += Math.min(45, matchedSkillCount * 9);
  const kgCoverage = Math.min(100, kgPoints);

  const avgScore = (profileCompleteness + kgCoverage) / 2;
  const overall: "HIGH" | "MEDIUM" | "LOW" = avgScore >= 65 ? "HIGH" : avgScore >= 40 ? "MEDIUM" : "LOW";
  const unmatchedCount = Math.max(0, totalUserSkillCount - matchedSkillCount);
  return { profile_completeness: profileCompleteness, kg_coverage: kgCoverage, overall, unmatched_skills_count: unmatchedCount };
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY SALARY ESTIMATION v3.2
// ═══════════════════════════════════════════════════════════════

const COMPANY_TIER_MULTIPLIERS: Record<string, number> = {
  'FAANG': 2.5, 'Unicorn': 1.8, 'MNC': 1.4, 'Startup': 1.0, 'SME': 0.8,
};

export function estimateMonthlySalary(
  agentEstimate: number | null,
  jobData: JobTaxonomyRow | null,
  experienceYears: number | null,
  companyTier?: string | null,
  metroTier?: string | null,
  specialization?: string | null,
  country?: string | null
): number {
  if (agentEstimate && agentEstimate > 10000) {
    let adjusted = agentEstimate;
    if (metroTier === 'tier2') adjusted = Math.round(adjusted * 0.80);
    if (specialization === 'niche') adjusted = Math.round(adjusted * 1.2);
    return adjusted;
  }

  const baseSalaryUnit = jobData?.avg_salary_lpa || 10;
  let adjustedUnit = baseSalaryUnit;
  if (experienceYears) {
    if (experienceYears > 10) adjustedUnit *= 1.6;
    else if (experienceYears > 5) adjustedUnit *= 1.3;
    else if (experienceYears > 2) adjustedUnit *= 1.1;
  }

  const countryCode = (country || 'IN').toUpperCase();
  let monthly: number;
  if (countryCode === 'US' || countryCode === 'AE') {
    monthly = Math.round((adjustedUnit * 1000) / 12);
  } else {
    monthly = Math.round((adjustedUnit * 100000) / 12);
  }

  if (companyTier && COMPANY_TIER_MULTIPLIERS[companyTier]) {
    monthly = Math.round(monthly * COMPANY_TIER_MULTIPLIERS[companyTier]);
  }
  if (metroTier === 'tier2') monthly = Math.round(monthly * 0.75);
  if (specialization === 'niche') monthly = Math.round(monthly * 1.3);

  return monthly;
}

// ═══════════════════════════════════════════════════════════════
// MASTER CALCULATION — orchestrates all deterministic computations
// ═══════════════════════════════════════════════════════════════

export function computeAll(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobSkillMap: JobSkillMapRow[],
  jobData: JobTaxonomyRow | null,
  marketSignal: MarketSignalRow | null,
  hasLinkedIn: boolean,
  companyTier?: string | null,
  metroTier?: string | null,
  specialization?: string | null,
  industry?: string | null,
  country?: string | null,
  companyHealthScore?: number | null,
  subSector?: string | null,
  profileCompletenessPct?: number,
  profileGaps?: string[]
): DeterministicResult {
  const jobBaseline = jobData?.disruption_baseline || 60;
  const kgIndex = buildKGSkillIndex(skillRiskData);

  // 1. Determinism Index
  const diResult = calculateDeterminismIndex(profile, skillRiskData, jobSkillMap, jobBaseline, marketSignal, industry, subSector, kgIndex);
  let determinismIndex = diResult.index;

  // Essential role safeguard
  const essential = isEssentialRole(industry || jobData?.category || null, jobData?.job_family || null);
  if (essential) {
    determinismIndex = Math.min(determinismIndex, CALIBRATION.ESSENTIAL_ROLE_DI_CEILING);
  }

  // Company Health modifier
  let companyHealthModifier = 0;
  if (companyHealthScore != null) {
    if (companyHealthScore < 30) {
      companyHealthModifier = Math.ceil((30 - companyHealthScore) / 2);
    } else if (companyHealthScore > 70) {
      companyHealthModifier = -Math.ceil((companyHealthScore - 70) / 3);
    }
    determinismIndex = Math.min(CALIBRATION.DI_CLAMP_MAX, Math.max(CALIBRATION.DI_CLAMP_MIN, determinismIndex + companyHealthModifier));
    if (companyHealthModifier !== 0) {
      console.log(`[DeterministicEngine] Company health modifier: ${companyHealthModifier > 0 ? '+' : ''}${companyHealthModifier} (score: ${companyHealthScore})`);
    }
  }

  // KG Baseline Floor Enforcement
  const isExecOrSeniorForFloor = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const kgFloorTolerance = isExecOrSeniorForFloor ? 15 : 5;
  const kgMinDI = Math.max(CALIBRATION.DI_CLAMP_MIN, jobBaseline - kgFloorTolerance);
  if (determinismIndex < kgMinDI) {
    console.log(`[DeterministicEngine] KG floor enforcement: DI=${determinismIndex} < floor=${kgMinDI} (baseline=${jobBaseline}, tolerance=${kgFloorTolerance}). Snapping up.`);
    determinismIndex = kgMinDI;
  }

  // 2. Monthly Salary
  const monthlySalary = estimateMonthlySalary(profile.estimated_monthly_salary_inr, jobData, profile.experience_years, companyTier, metroTier, specialization, country);

  // 3. Obsolescence Timeline
  const timeline = calculateObsolescenceTimeline(determinismIndex, marketSignal, profile.seniority_tier);

  // 4. Salary Bleed
  const salaryBleed = calculateSalaryBleed(determinismIndex, monthlySalary, marketSignal);

  // 5. Survivability
  const survivability = calculateSurvivability(profile, determinismIndex);
  if (essential && survivability.score < CALIBRATION.ESSENTIAL_ROLE_SURVIVABILITY_FLOOR) {
    survivability.score = CALIBRATION.ESSENTIAL_ROLE_SURVIVABILITY_FLOOR;
  }
  const years = profile.experience_years || 0;
  const seniority_bonus = years >= 20 ? CALIBRATION.SENIORITY_BONUS_20YR : years >= 15 ? CALIBRATION.SENIORITY_BONUS_15YR : 0;
  const di_penalty = determinismIndex > CALIBRATION.DI_PENALTY_THRESHOLD ? Math.round((determinismIndex - CALIBRATION.DI_PENALTY_THRESHOLD) * CALIBRATION.DI_PENALTY_RATE) : 0;

  // 6. Tone Tag
  const toneTag = deriveToneTag(determinismIndex);

  // 7. Replacing Tools
  const replacingTools = extractReplacingTools(profile, skillRiskData, jobData, kgIndex);

  // 8. Execution Skills Dead
  const COMMODITY_SKILLS = new Set([
    'email_writing', 'email_management', 'emailwriting', 'email', 'emailing',
    'calendar_management', 'scheduling', 'meeting_scheduling',
    'basic_copywriting', 'copywriting', 'note_taking', 'notetaking',
    'filing', 'data_entry', 'dataentry', 'internet_research',
    'phone_calls', 'travel_booking', 'expense_reporting',
    'report_writing', 'reportwriting', 'typing', 'word_processing',
    'powerpoint', 'presentation_creation', 'spreadsheet_management',
  ]);

  const isExecOrSenior = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const executionSkillsDead: string[] = [];
  for (const execSkill of profile.execution_skills) {
    const normExec = execSkill.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (COMMODITY_SKILLS.has(normExec)) continue;
    if (isExecOrSenior) {
      const matched = matchSkillToKG(execSkill, skillRiskData, kgIndex);
      if (matched && ['communication', 'content', 'admin'].includes(matched.category || '') && matched.automation_risk > 50) continue;
    }
    const matched = matchSkillToKG(execSkill, skillRiskData, kgIndex);
    if (matched && matched.automation_risk > 50) {
      executionSkillsDead.push(execSkill);
    } else if (!matched && jobBaseline > 65) {
      executionSkillsDead.push(execSkill);
    }
  }
  const deadFallbackThreshold = isExecOrSenior ? 75 : 60;
  if (executionSkillsDead.length === 0 && determinismIndex > deadFallbackThreshold) {
    const fallbackSkills = profile.execution_skills.filter(s => {
      const norm = s.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
      return !COMMODITY_SKILLS.has(norm);
    });
    executionSkillsDead.push(...fallbackSkills.slice(0, 2));
  }

  // 9. Data Quality
  const totalUserSkills = new Set([...profile.execution_skills, ...profile.all_skills].map(s => s.toLowerCase().trim())).size;
  const dataQuality = assessDataQuality(profile, diResult.matchedCount, totalUserSkills, hasLinkedIn, !!jobData, !!marketSignal);

  // 10. Months remaining
  const monthsRemaining = timeline.yellow_zone_months;

  // Score Breakdown
  const score_breakdown: ScoreBreakdown = {
    base_score: diResult.baseScore,
    skill_adjustments: diResult.skillAdjustments,
    weighted_skill_average: diResult.weightedSkillAverage,
    market_pressure: diResult.marketPressure,
    experience_reduction: diResult.experienceReduction,
    pre_clamp_score: diResult.preClampScore,
    final_clamped: determinismIndex,
    company_health_modifier: companyHealthModifier,
    company_health_score: companyHealthScore ?? null,
    salary_bleed_breakdown: {
      depreciation_rate: salaryBleed.depreciationRate,
      market_amplifier: salaryBleed.marketAmplifier,
      ai_pressure_add: salaryBleed.aiPressureAdd,
      final_rate: salaryBleed.finalRate,
    },
    survivability_breakdown: {
      base: CALIBRATION.SURVIVABILITY_BASE,
      experience_bonus: survivability.breakdown.experience_bonus,
      strategic_bonus: survivability.breakdown.strategic_bonus,
      geo_bonus: survivability.breakdown.geo_bonus,
      adaptability_bonus: survivability.breakdown.adaptability_bonus,
      seniority_bonus, di_penalty,
      final: survivability.score,
    },
  };

  // Score Variability
  const score_variability = calculateScoreVariability(determinismIndex, diResult.matchedCount, monthlySalary, marketSignal);

  // Moat & Urgency
  const moat_score = calculateMoatScore(profile, skillRiskData, diResult.matchedCount);
  const urgency_score = calculateUrgencyScore(profile, determinismIndex, marketSignal);

  if (profileCompletenessPct !== undefined) dataQuality.profile_completeness_pct = profileCompletenessPct;
  if (profileGaps !== undefined) dataQuality.profile_gaps = profileGaps;

  return {
    determinism_index: determinismIndex,
    determinism_confidence: diResult.confidence,
    matched_skill_count: diResult.matchedCount,
    months_remaining: monthsRemaining,
    salary_bleed_monthly: salaryBleed.monthly,
    total_5yr_loss_inr: salaryBleed.total5yr,
    obsolescence_timeline: timeline,
    survivability, tone_tag: toneTag,
    replacing_tools: replacingTools,
    execution_skills_dead: executionSkillsDead,
    data_quality: dataQuality,
    score_breakdown, score_variability,
    moat_score, urgency_score,
  };
}
