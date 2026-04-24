/**
 * @fileoverview Master orchestrator — computeAll() and helper functions
 * that compose all scoring modules into a single DeterministicResult.
 * This is the only file external callers need to import directly
 * (or use the barrel re-export in deterministic-engine.ts).
 */

import { CALIBRATION, normalize, matchSkillToKG, buildKGSkillIndex } from "./det-utils.ts";
import { getIndustryAutomationFloor, isEssentialRole } from "./det-industry.ts";
import { calculateDeterminismIndex, calculateMoatScore, calculateUrgencyScore, calculateScoreVariability } from "./det-scoring.ts";
import { calculateObsolescenceTimeline, calculateSalaryBleed, calculateSurvivability } from "./det-lifecycle.ts";
import type {
  ProfileInput, SkillRiskRow, JobSkillMapRow, JobTaxonomyRow,
  MarketSignalRow, ReplacingTool, DataQuality, ScoreBreakdown,
  DeterministicResult, KGSkillIndex, CohortBenchmark,
} from "./det-types.ts";
import { filterImplausiblePairings } from "./tool-task-capability-map.ts";

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

  // Hallucination guard: drop tool/task pairings that are obviously implausible
  // (e.g. "Playwright automates M&A modeling"). Conservative — unknown tools pass through.
  return filterImplausiblePairings(tools, "extractReplacingTools").slice(0, 10);
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

/**
 * computeAll — Master deterministic scoring function.
 *
 * @param profile - Parsed user profile with skills, experience, geo data
 * @param skillRiskData - Skill risk matrix rows from DB
 * @param jobSkillMap - Job-skill mapping rows from DB
 * @param jobData - Matched job taxonomy row (nullable)
 * @param marketSignal - Latest market signal for the job family (nullable)
 * @param hasLinkedIn - Whether LinkedIn data was provided
 * @returns Complete deterministic result: DI, moat, urgency, survivability, timeline, salary bleed
 * @notes Does NOT call any AI models — purely deterministic from DB data + profile.
 */
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
  profileGaps?: string[],
  cohortBenchmark?: CohortBenchmark | null,
): DeterministicResult {
  const jobBaseline = jobData?.disruption_baseline || 60;
  const industryFloor = getIndustryAutomationFloor(industry || jobData?.category || null, subSector);
  const structuralFloor = Math.max(jobBaseline, industryFloor);
  const kgIndex = buildKGSkillIndex(skillRiskData);

  // 1. Determinism Index
  const diResult = calculateDeterminismIndex(profile, skillRiskData, jobSkillMap, jobBaseline, marketSignal, industry, subSector, kgIndex, metroTier);
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

  // Structural floor enforcement
  // Use the stronger of role baseline and industry/sub-sector floor so high-risk
  // categories like performance marketing cannot score artificially "safe"
  // just because the matched job family baseline is too generic.
  const isExecOrSeniorForFloor = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const isManagerForFloor = profile.seniority_tier === 'MANAGER';
  const kgFloorTolerance = isExecOrSeniorForFloor ? 15 : isManagerForFloor ? 10 : 5;
  const kgMinDI = Math.max(CALIBRATION.DI_CLAMP_MIN, structuralFloor - kgFloorTolerance);
  if (determinismIndex < kgMinDI) {
    console.log(`[DeterministicEngine] Structural floor enforcement: DI=${determinismIndex} < floor=${kgMinDI} (jobBaseline=${jobBaseline}, industryFloor=${industryFloor}, tolerance=${kgFloorTolerance}). Snapping up.`);
    determinismIndex = kgMinDI;
  }

  // 2. Monthly Salary
  const monthlySalary = estimateMonthlySalary(profile.estimated_monthly_salary_inr, jobData, profile.experience_years, companyTier, metroTier, specialization, country);

  // 3. Obsolescence Timeline
  // AUDIT FIX: When the matched job node has KG-derived partial_displacement_years,
  // blend it with the deterministic timeline instead of using the generic power curve alone.
  // The KG data (sourced from Frey & Osborne, WEF FoJ 2025, NASSCOM) is more role-specific
  // than the generic DI power curve, which gives the same months to a content writer and
  // a solutions architect even though their real displacement timelines differ by 3+ years.
  const baseTimeline = calculateObsolescenceTimeline(determinismIndex, marketSignal, profile.seniority_tier);
  let timeline = baseTimeline;
  if (jobData && typeof (jobData as any).partial_displacement_years === 'number') {
    const kgPartialYears = (jobData as any).partial_displacement_years as number;
    const kgMonths = Math.round(kgPartialYears * 12);
    // Only use KG anchor when confidence is HIGH or VERY HIGH (≥3 matched skills)
    // to avoid anchoring on a potentially mismatched job family
    if (diResult.matchedCount >= 3 && kgMonths > 0) {
      // Blend: 60% KG role anchor + 40% DI-derived timeline
      // This preserves the personalised DI signal while grounding it in role reality
      const blendedMonths = Math.round(kgMonths * 0.6 + baseTimeline.yellow_zone_months * 0.4);
      const clampedMonths = Math.max(6, Math.min(60, blendedMonths));
      timeline = {
        ...baseTimeline,
        yellow_zone_months: clampedMonths,
        already_in_warning: clampedMonths <= 12,
      };
    }
  }

  // 4. Salary Bleed (seniority-tier aware so executives don't get junior-tier numbers)
  const salaryBleed = calculateSalaryBleed(determinismIndex, monthlySalary, marketSignal, profile.seniority_tier);

  // 5. Survivability
  const survivability = calculateSurvivability(profile, determinismIndex, cohortBenchmark ?? null);
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
  // Score Variability — pass the stronger structural floor so asymmetric CI
  // respects both job-family baselines and high-risk industry/sub-sector anchors.
  const score_variability = calculateScoreVariability(determinismIndex, diResult.matchedCount, monthlySalary, marketSignal, structuralFloor);

  // Moat & Urgency — moat now returns IC leverage bonus separately for audit (#4)
  const moatResult = calculateMoatScore(profile, skillRiskData, diResult.matchedCount);
  const moat_score = moatResult.score;
  const urgency_score = calculateUrgencyScore(profile, determinismIndex, marketSignal);

  // ── AUDIT (#4): Attach IC leverage bonus to score_breakdown for transparency ──
  score_breakdown.ic_leverage_bonus = moatResult.ic_leverage_bonus;

  // ── AUDIT (#2): Salary bleed grounding flag ──
  // True only when we had a real agent estimate or a KG-derived avg_salary_lpa to anchor on.
  // If both inputs were null and the engine fell back to a default of 10 LPA, the bleed is
  // mathematically real but semantically fabricated — UI must suppress it.
  const salary_bleed_grounded = !!(profile.estimated_monthly_salary_inr && profile.estimated_monthly_salary_inr > 10000)
    || !!(jobData?.avg_salary_lpa && jobData.avg_salary_lpa > 0);
  score_breakdown.salary_bleed_grounded = salary_bleed_grounded;

  // ── AUDIT (#1, #8, #9): Headline contradiction guard ──
  // Engine refuses to label a profile "STABLE" when its own internals contradict.
  // Inputs we trust: timeline.already_in_warning, executionSkillsDead ratio, monthsRemaining.
  let finalToneTag = toneTag;
  let headline_capped = false;
  let headline_cap_reason: 'already_in_warning' | 'majority_skills_dead' | 'months_remaining_critical' | null = null;

  const totalExecSkills = profile.execution_skills.length;
  const deadRatio = totalExecSkills > 0 ? executionSkillsDead.length / totalExecSkills : 0;
  const isExecOrSeniorTone = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';

  // Senior leaders/execs frame as restructuring risk (not personal displacement) so the
  // contradiction threshold is gentler — we still cap STABLE→MODERATE but not all the way to CRITICAL.
  if (timeline.already_in_warning && (toneTag === 'STABLE' || toneTag === 'MODERATE')) {
    finalToneTag = isExecOrSeniorTone ? 'MODERATE' : 'WARNING';
    headline_capped = true;
    headline_cap_reason = 'already_in_warning';
  } else if (deadRatio >= 0.5 && toneTag === 'STABLE') {
    finalToneTag = 'MODERATE';
    headline_capped = true;
    headline_cap_reason = 'majority_skills_dead';
  } else if (monthsRemaining <= 12 && toneTag === 'STABLE') {
    finalToneTag = isExecOrSeniorTone ? 'MODERATE' : 'WARNING';
    headline_capped = true;
    headline_cap_reason = 'months_remaining_critical';
  }
  if (headline_capped) {
    console.warn(`[DeterministicEngine] Headline cap fired: tone ${toneTag}→${finalToneTag} (reason=${headline_cap_reason}, dead_ratio=${deadRatio.toFixed(2)}, months=${monthsRemaining})`);
  }
  score_breakdown.headline_cap_reason = headline_cap_reason;

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
    survivability, tone_tag: finalToneTag,
    replacing_tools: replacingTools,
    execution_skills_dead: executionSkillsDead,
    data_quality: dataQuality,
    score_breakdown, score_variability,
    moat_score, urgency_score,
    salary_bleed_grounded,
    headline_capped,
  };
}
