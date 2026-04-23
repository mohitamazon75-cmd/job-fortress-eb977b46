/**
 * @fileoverview Core scoring functions: Moat Score, Urgency Score,
 * Determinism Index calculation, and Score Variability.
 */

import { CALIBRATION, normalize, matchSkillToKG } from "./det-utils.ts";
import { getIndustryAutomationFloor, getIndustrySkillModifier } from "./det-industry.ts";
import { calculateObsolescenceTimeline, calculateSalaryBleed } from "./det-lifecycle.ts";
import type {
  ProfileInput, SkillRiskRow, JobSkillMapRow, MarketSignalRow,
  SkillAdjustment, ScoreVariability, KGSkillIndex,
} from "./det-types.ts";

// ═══════════════════════════════════════════════════════════════
// MOAT SCORE — Standalone metric measuring irreplaceable value
// ═══════════════════════════════════════════════════════════════

export function calculateMoatScore(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  matchedSkillCount: number
): number {
  const tier = profile.seniority_tier || 'PROFESSIONAL';
  const years = profile.experience_years || 0;
  const impact = profile.executive_impact;

  const rawStrategic = profile.strategic_skills?.length || 0;
  const strategicSkillDepth = Math.min(100, rawStrategic <= 0 ? 0 : rawStrategic === 1 ? 25 : rawStrategic === 2 ? 45 : rawStrategic === 3 ? 60 : 70 + rawStrategic * 5);
  const rawAdapt = profile.adaptability_signals || 0;
  const adaptability = Math.min(100, rawAdapt * 25);
  const experienceDepth = Math.min(100, Math.round(Math.log(years + 1) * 40));
  const domainTenure = impact?.domain_tenure_years || 0;
  const domainSpecialization = years > 0 ? Math.min(100, Math.round((domainTenure / years) * 100)) : 0;
  const skillCoverage = Math.min(100, matchedSkillCount <= 0 ? 10 : matchedSkillCount === 1 ? 30 : matchedSkillCount === 2 ? 50 : matchedSkillCount === 3 ? 65 : 70 + matchedSkillCount * 4);

  const lowRiskSkills = skillRiskData.filter(s =>
    (profile.strategic_skills || []).some(ps =>
      ps.toLowerCase().includes(s.skill_name.toLowerCase()) || s.skill_name.toLowerCase().includes(ps.toLowerCase())
    ) && s.automation_risk < 40
  ).length;
  const lowRiskRatio = rawStrategic > 0 ? Math.min(100, Math.round((lowRiskSkills / Math.max(1, rawStrategic)) * 100)) : 30;

  let moat: number;

  switch (tier) {
    case 'ENTRY': {
      moat = skillCoverage * 0.3 + adaptability * 0.2 + strategicSkillDepth * 0.3 + lowRiskRatio * 0.2;
      break;
    }
    case 'PROFESSIONAL': {
      moat = experienceDepth * 0.2 + skillCoverage * 0.2 + strategicSkillDepth * 0.3 + lowRiskRatio * 0.15 + adaptability * 0.15;
      break;
    }
    case 'MANAGER': {
      const teamScale = impact?.team_size_direct
        ? Math.min(100, Math.round(Math.log10(Math.max(1, impact.team_size_direct)) * 50))
        : years >= 8 ? 50 : 25;
      const budgetScope = impact?.budget_authority_usd
        ? Math.min(100, Math.round(Math.log10(Math.max(1, impact.budget_authority_usd / 100_000)) * 40))
        : 35;
      moat = teamScale * 0.2 + budgetScope * 0.2 + strategicSkillDepth * 0.3 + domainSpecialization * 0.3;
      break;
    }
    case 'SENIOR_LEADER':
    case 'EXECUTIVE': {
      let scaleMoat = 40;
      if (impact?.revenue_scope_usd && impact.revenue_scope_usd > 0) {
        scaleMoat = Math.min(100, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 30 + 30));
      } else if (impact?.team_size_org && impact.team_size_org > 0) {
        scaleMoat = Math.min(100, Math.round(Math.log10(Math.max(1, impact.team_size_org)) * 25 + 30));
      }
      let regulatoryMoat = 20;
      if (impact?.regulatory_domains?.length) {
        regulatoryMoat = Math.min(100, 20 + impact.regulatory_domains.length * 20);
      }
      let relationshipCapital = 20;
      if (impact?.board_exposure) relationshipCapital += 20;
      if (impact?.investor_facing) relationshipCapital += 15;
      if (impact?.cross_industry_pivots) relationshipCapital += Math.min(20, impact.cross_industry_pivots * 8);
      if ((impact?.geographic_scope?.length ?? 0) > 1) relationshipCapital += Math.min(15, (impact!.geographic_scope!.length) * 6);
      relationshipCapital = Math.min(100, relationshipCapital);
      const domainDepth = Math.min(100, domainSpecialization * 0.6 + experienceDepth * 0.4);
      moat = scaleMoat * 0.25 + regulatoryMoat * 0.25 + relationshipCapital * 0.25 + domainDepth * 0.25;
      break;
    }
    default:
      moat = strategicSkillDepth * 0.3 + adaptability * 0.2 + experienceDepth * 0.25 + lowRiskRatio * 0.25;
  }

  return Math.min(95, Math.max(5, Math.round(moat)));
}

// ═══════════════════════════════════════════════════════════════
// URGENCY SCORE
// ═══════════════════════════════════════════════════════════════

const URGENCY_TIER_WEIGHT: Record<string, number> = {
  'ENTRY': 0.85, 'PROFESSIONAL': 0.6, 'MANAGER': 0.5,
  'SENIOR_LEADER': 0.4, 'EXECUTIVE': 0.3,
};

export function calculateUrgencyScore(
  profile: ProfileInput,
  determinismIndex: number,
  marketSignal: MarketSignalRow | null
): number {
  const tier = profile.seniority_tier || 'PROFESSIONAL';
  const tierWeight = URGENCY_TIER_WEIGHT[tier] || 0.6;
  const diContribution = determinismIndex * tierWeight;

  let marketDecline = 0;
  if (marketSignal?.posting_change_pct !== null && marketSignal?.posting_change_pct !== undefined && marketSignal.posting_change_pct < 0) {
    marketDecline = Math.min(20, Math.abs(marketSignal.posting_change_pct) * 0.4);
  }
  let disruptionVelocity = 0;
  if (marketSignal?.ai_job_mentions_pct !== null && marketSignal?.ai_job_mentions_pct !== undefined && marketSignal.ai_job_mentions_pct > 10) {
    disruptionVelocity = Math.min(20, (marketSignal.ai_job_mentions_pct - 10) * 0.5);
  }

  const urgency = diContribution + marketDecline * 0.2 + disruptionVelocity * 0.2;
  return Math.min(95, Math.max(5, Math.round(urgency)));
}

// ═══════════════════════════════════════════════════════════════
// CORE: Determinism Index
// ═══════════════════════════════════════════════════════════════

export interface DIResult {
  index: number;
  confidence: "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";
  matchedCount: number;
  baseScore: number;
  skillAdjustments: SkillAdjustment[];
  weightedSkillAverage: number | null;
  marketPressure: number;
  experienceReduction: number;
  preClampScore: number;
}

export function calculateDeterminismIndex(
  profile: ProfileInput,
  skillRiskData: SkillRiskRow[],
  jobSkillMap: JobSkillMapRow[],
  jobBaseline: number,
  marketSignal: MarketSignalRow | null,
  industry?: string | null,
  subSector?: string | null,
  kgIndex?: KGSkillIndex,
  metroTier?: string | null
): DIResult {
  const isExec = profile.seniority_tier === 'EXECUTIVE' || profile.seniority_tier === 'SENIOR_LEADER';
  const isManager = profile.seniority_tier === 'MANAGER';

  const allUserSkills = [...profile.execution_skills, ...profile.all_skills];
  const seen = new Set<string>();
  const uniqueSkills = allUserSkills.filter((s) => {
    const n = normalize(s);
    if (seen.has(n) || !n) return false;
    seen.add(n);
    return true;
  });

  const COMMODITY_SKILL_RE = /^(email|calendar|scheduling|filing|data_entry|typing|note_taking|phone|travel|expense|report_writing|powerpoint|spreadsheet|word_processing|basic_copywriting|copywriting|internet_research|meeting_coordination|meeting)/i;
  const filterCommodity = isExec || isManager;

  const matchedRisks: { risk: number; weight: number }[] = [];
  const skillAdjustments: SkillAdjustment[] = [];
  const matchedKGNames = new Set<string>();

  for (const userSkill of uniqueSkills) {
    const matched = matchSkillToKG(userSkill, skillRiskData, kgIndex);
    if (matched) {
      const normMatchedName = normalize(matched.skill_name);
      if (matchedKGNames.has(normMatchedName)) continue;
      matchedKGNames.add(normMatchedName);
      if (filterCommodity && COMMODITY_SKILL_RE.test(matched.skill_name.replace(/[\s\-]+/g, '_'))) continue;

      const mapEntry = jobSkillMap.find((m) => normalize(m.skill_name) === normMatchedName);
      const weight = mapEntry?.importance || 5;
      const industryDelta = getIndustrySkillModifier(industry || null, matched.skill_name, subSector);
      const adjustedRisk = Math.min(95, Math.max(5, matched.automation_risk + industryDelta));
      matchedRisks.push({ risk: adjustedRisk, weight });
      skillAdjustments.push({ skill_name: matched.skill_name, automation_risk: adjustedRisk, weight, contribution: 0 });
    }
  }

  let index: number;
  let confidence: "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";
  let weightedSkillAverage: number | null = null;

  if (matchedRisks.length === 0) {
    const industryFloor = getIndustryAutomationFloor(industry || null, subSector);
    index = Math.max(jobBaseline, industryFloor);
    confidence = "LOW";

    for (const execSkill of profile.execution_skills) {
      const estimatedRisk = Math.min(95, index + 5 + (normalize(execSkill).length % 10));
      skillAdjustments.push({ skill_name: execSkill, automation_risk: estimatedRisk, weight: 7, contribution: estimatedRisk * 0.1 });
    }
    for (const stratSkill of profile.strategic_skills) {
      const estimatedRisk = Math.max(5, Math.min(35, jobBaseline - 30 + (normalize(stratSkill).length % 10)));
      skillAdjustments.push({ skill_name: stratSkill, automation_risk: estimatedRisk, weight: 5, contribution: estimatedRisk * 0.05 });
    }
    const coveredSkills = new Set([
      ...profile.execution_skills.map(s => normalize(s)),
      ...profile.strategic_skills.map(s => normalize(s)),
    ]);
    for (const skill of profile.all_skills.slice(0, 8)) {
      const n = normalize(skill);
      if (coveredSkills.has(n) || !n) continue;
      coveredSkills.add(n);
      const estimatedRisk = Math.min(85, Math.max(15, jobBaseline - 5 + (n.length % 15)));
      skillAdjustments.push({ skill_name: skill, automation_risk: estimatedRisk, weight: 4, contribution: estimatedRisk * 0.04 });
    }
  } else {
    const totalWeight = matchedRisks.reduce((sum, m) => sum + m.weight, 0);
    const weightedSum = matchedRisks.reduce((sum, m) => sum + m.risk * m.weight, 0);
    index = Math.round(weightedSum / totalWeight);
    weightedSkillAverage = index;

    if (matchedRisks.length <= 2) {
      const industryFloor = getIndustryAutomationFloor(industry || null, subSector);
      const kgWeight = matchedRisks.length === 1 ? 0.4 : 0.6;
      index = Math.round(index * kgWeight + industryFloor * (1 - kgWeight));
    }

    for (const adj of skillAdjustments) {
      adj.contribution = Math.round((adj.automation_risk * adj.weight) / totalWeight * 10) / 10;
    }

    confidence = matchedRisks.length >= 5 ? "VERY HIGH" : matchedRisks.length >= 3 ? "HIGH" : "MEDIUM";
  }

  const baseScore = index;

  // Executive moat reductions
  if ((isExec || isManager) && profile.executive_impact) {
    const impact = profile.executive_impact;
    let scaleMoatReduction = 0;
    if (impact.revenue_scope_usd && impact.revenue_scope_usd > 0) {
      scaleMoatReduction = Math.min(15, Math.round(Math.log10(Math.max(1, impact.revenue_scope_usd / 1_000_000)) * 5));
    }
    if (scaleMoatReduction === 0 && impact.team_size_org && impact.team_size_org > 0) {
      scaleMoatReduction = Math.min(10, Math.round(Math.log10(Math.max(1, impact.team_size_org)) * 4));
    }
    let regulatoryMoatReduction = 0;
    if (impact.regulatory_domains?.length > 0) {
      regulatoryMoatReduction = Math.min(12, impact.regulatory_domains.length * 4);
    }
    let relationshipMoatReduction = 0;
    if (impact.board_exposure) relationshipMoatReduction += 3;
    if (impact.investor_facing) relationshipMoatReduction += 2;
    if (impact.domain_tenure_years) {
      relationshipMoatReduction += Math.min(5, Math.round(impact.domain_tenure_years / 3));
    }
    if (impact.cross_industry_pivots > 0) {
      relationshipMoatReduction += Math.min(3, impact.cross_industry_pivots);
    }
    relationshipMoatReduction = Math.min(13, relationshipMoatReduction);

    if (isExec) { index = Math.round(index * 0.4); }
    else if (isManager) { index = Math.round(index * 0.7); }
    index = Math.round(index - scaleMoatReduction - regulatoryMoatReduction - relationshipMoatReduction);
  }

  // ENTRY-tier amplification
  if (profile.seniority_tier === 'ENTRY' && !profile.executive_impact) {
    index = Math.round(index * 1.15);
  }

  // Market signal modifier
  let marketPressure = 0;
  if (marketSignal?.ai_job_mentions_pct) {
    const aiPressure = marketSignal.ai_job_mentions_pct / 100;
    const pressureScale = isExec ? CALIBRATION.MARKET_PRESSURE_SCALE * 0.5 : CALIBRATION.MARKET_PRESSURE_SCALE;
    marketPressure = Math.round(aiPressure * pressureScale);
    index = Math.round(index + marketPressure);
  }

  // Experience modifier
  let experienceReduction = 0;
  if (profile.experience_years && profile.experience_years > CALIBRATION.EXPERIENCE_THRESHOLD_YEARS) {
    const yearsOver = profile.experience_years - CALIBRATION.EXPERIENCE_THRESHOLD_YEARS;
    const cap = isExec ? CALIBRATION.EXECUTIVE_EXPERIENCE_REDUCTION_CAP : CALIBRATION.EXPERIENCE_REDUCTION_CAP;
    const rawReduction = yearsOver <= 12
      ? yearsOver * CALIBRATION.EXPERIENCE_REDUCTION_PER_YEAR
      : 12 * CALIBRATION.EXPERIENCE_REDUCTION_PER_YEAR + Math.log(yearsOver - 11) * 3;
    experienceReduction = Math.round(Math.min(rawReduction, cap) * 10) / 10;
    index = Math.round(index - experienceReduction);
  }

  const preClampScore = index;
  const finalIndex = Math.min(CALIBRATION.DI_CLAMP_MAX, Math.max(CALIBRATION.DI_CLAMP_MIN, index));

  return {
    index: finalIndex, confidence, matchedCount: matchedRisks.length,
    baseScore, skillAdjustments, weightedSkillAverage, marketPressure, experienceReduction, preClampScore,
  };
}

// ═══════════════════════════════════════════════════════════════
// SCORE VARIABILITY
// ═══════════════════════════════════════════════════════════════

export function calculateScoreVariability(
  determinismIndex: number,
  matchedCount: number,
  monthlySalary: number,
  marketSignal: MarketSignalRow | null,
  industryFloor?: number
): ScoreVariability {
  // STAT-2 fix: asymmetric confidence intervals that respect:
  //   1. The bounded nature of DI (cannot go below 0 or above 100)
  //   2. The industry floor (DI cannot meaningfully go below the structural floor)
  //   3. Empirical skew: high-DI roles have more downside certainty;
  //      low-DI roles have more upside uncertainty
  const diBaseMargin = CALIBRATION.CONFIDENCE_BASE_MARGIN;
  const diMargin = matchedCount > 0 ? Math.round(diBaseMargin / Math.sqrt(matchedCount)) : diBaseMargin;

  // Low bound: constrained by industry floor — even best-case can't go below the structural floor
  const floor = Math.max(1, industryFloor ?? 0);
  const diLow = Math.max(floor, determinismIndex - diMargin);

  // High bound: at DI > 70 (high disruption), upside risk is amplified (disruption accelerates)
  const amplifier = determinismIndex > 70 ? 1.3 : 1.0;
  const diHigh = Math.min(99, determinismIndex + Math.round(diMargin * amplifier));

  const timelineLow = calculateObsolescenceTimeline(diHigh, marketSignal);
  const timelineHigh = calculateObsolescenceTimeline(diLow, marketSignal);
  const salaryLow = calculateSalaryBleed(diLow, monthlySalary, marketSignal);
  const salaryHigh = calculateSalaryBleed(diHigh, monthlySalary, marketSignal);

  return {
    di_range: { low: diLow, high: diHigh },
    months_range: { low: timelineLow.yellow_zone_months, high: timelineHigh.yellow_zone_months },
    salary_bleed_range: { low: salaryLow.monthly, high: salaryHigh.monthly },
  };
}
