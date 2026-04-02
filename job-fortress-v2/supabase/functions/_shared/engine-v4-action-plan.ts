// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — Precision Action Plan Synthesiser
// Layer 5: Converts algorithm outputs + hidden patterns into personalised
// 24-week intervention plan with parent-facing communication
// ═══════════════════════════════════════════════════════════════════════════

import {
  AlgorithmOutputs, RawAssessmentInput, PatternActivationVector,
  ActionPlan, WeeklyPlan, InterventionItem, ParentReport,
  InterventionTier, ActionPriority, InterventionTrackingResult,
  InterventionOutcome, AssessmentSession,
} from "./engine-v4-types.ts";

import { INTERVENTION_TEMPLATES, PHENOTYPE_PROFILES } from "./engine-v4-constants.ts";

// ═══════════════════════════════════════════════════════════════════════════
// 5.1 — TIER 0 ALERT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

function detectTier0Alerts(
  patterns: PatternActivationVector,
  alg: AlgorithmOutputs
): string[] {
  const alerts: string[] = [];

  // Subclinical depression → professional referral
  const depressionPattern = patterns.patterns.find(p => p.patternId === "HP15");
  if (depressionPattern) {
    alerts.push("We recommend a routine check-up with your paediatrician to discuss what we found in the wellbeing screener.");
  }

  // Milestone regression → neurological concern
  const milestoneRegression = patterns.patterns.find(p => p.patternId === "HP20");
  if (milestoneRegression) {
    alerts.push("We noticed some changes in developmental milestones that would benefit from a paediatrician's assessment.");
  }

  // Stunting cascade → urgent nutrition
  const stunting = patterns.patterns.find(p => p.patternId === "HP22");
  if (stunting) {
    alerts.push("Our assessment suggests your child's growth would benefit from a nutritional review with your paediatrician.");
  }

  // Compound vulnerability → holistic support
  const compound = patterns.patterns.find(p => p.patternId === "HP28");
  if (compound) {
    alerts.push("We recommend a comprehensive developmental check-up to support your child's overall wellbeing.");
  }

  // Endurance-iron proxy → likely anaemia
  const anaemia = patterns.patterns.find(p => p.patternId === "HP09");
  if (anaemia) {
    alerts.push("We noticed signs that suggest a routine blood test (haemoglobin) with your GP would be beneficial.");
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5.2 — INTERVENTION SELECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function selectInterventions(
  alg: AlgorithmOutputs,
  patterns: PatternActivationVector,
  input: RawAssessmentInput
): InterventionItem[] {
  const { counterfactualRankings, phenotypicProfile, pageRankScores, percentiles } = alg;
  const profileDef = PHENOTYPE_PROFILES.find(p => p.id === phenotypicProfile.profileId);

  // Collect all candidate interventions with their rankings
  const candidates: InterventionItem[] = [];

  for (const ranking of counterfactualRankings) {
    const template = INTERVENTION_TEMPLATES.find(t => t.id === ranking.intervention);
    if (!template) continue;

    // Step 1: Check EU threshold
    if (ranking.expectedUtility < 2) continue;

    // Step 2: PageRank leverage filter (≥ 0.005 normalized)
    const leverage = pageRankScores[template.pageRankTarget] || 0;

    // Step 3: Feasibility check
    let feasibility = ranking.feasibilityScore;

    // Diet type conflict check
    if (template.domain === "dietary" && template.indianFoodAlternatives) {
      // No conflict — Indian food alternatives are culturally appropriate
      feasibility *= 1.0;
    }

    // Step 4: Phenotypic response rate
    const responseRate = profileDef?.interventionResponseRates[template.id] || 0.70;

    // Step 5: Composite score
    const compositeScore = ranking.expectedUtility * Math.max(0.1, leverage * 100) * feasibility * responseRate;

    // Map activated patterns to this intervention
    const linkedPatterns = patterns.patterns
      .filter(p => p.activated && p.recommendedActions.some(a =>
        a.toLowerCase().includes(template.pageRankTarget.toLowerCase()) ||
        template.targetNodes.some(tn => a.toLowerCase().includes(tn.toLowerCase()))
      ))
      .map(p => p.patternId);

    candidates.push({
      id: template.id,
      domain: template.domain,
      title: template.title,
      description: template.description,
      frequency: template.frequency,
      durationMinutes: template.durationMinutes,
      tier: template.tier,
      expectedUtility: ranking.expectedUtility,
      pageRankLeverage: Math.round(leverage * 10000) / 10000,
      feasibility: Math.round(feasibility * 100) / 100,
      compositeScore: Math.round(compositeScore * 100) / 100,
      linkedPatterns,
      indianFoodAlternatives: template.indianFoodAlternatives,
      effortLevel: template.effortLevel,
    });
  }

  // Sort by composite score
  candidates.sort((a, b) => b.compositeScore - a.compositeScore);

  // Select top-5 per domain, max 12 total
  const selected: InterventionItem[] = [];
  const domainCounts: Record<string, number> = {};

  for (const candidate of candidates) {
    if (selected.length >= 12) break;
    const domain = candidate.domain;
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    if (domainCounts[domain] > 5) continue;
    selected.push(candidate);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5.3 — 24-WEEK PLAN STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

function buildWeeklyPlans(
  interventions: InterventionItem[],
  alg: AlgorithmOutputs
): WeeklyPlan[] {
  const tier1 = interventions.filter(i => i.tier === InterventionTier.Tier1_Critical);
  const tier2 = interventions.filter(i => i.tier === InterventionTier.Tier2_Core);
  const tier3 = interventions.filter(i => i.tier === InterventionTier.Tier3_Enrichment);

  const byDomain = (items: InterventionItem[], domain: string) =>
    items.filter(i => i.domain === domain);

  const plans: WeeklyPlan[] = [
    // Phase 1: Weeks 1-4 — Critical interventions
    {
      weekRange: "1–4",
      phase: "Foundation",
      physical: byDomain(tier1, "physical"),
      cognitive: byDomain(tier1, "cognitive"),
      dietary: byDomain(tier1, "dietary"),
      psychosocial: byDomain(tier1, "psychosocial"),
      trackingMetrics: ["Endurance + balance score", "Iron proxy (energy levels)", "Sleep quality", "Mood check-in"],
    },
    // Phase 2: Weeks 5-8 — Add core habits
    {
      weekRange: "5–8",
      phase: "Building Habits",
      physical: [...byDomain(tier1, "physical"), ...byDomain(tier2, "physical")],
      cognitive: [...byDomain(tier1, "cognitive"), ...byDomain(tier2, "cognitive")],
      dietary: [...byDomain(tier1, "dietary"), ...byDomain(tier2, "dietary")],
      psychosocial: [...byDomain(tier1, "psychosocial"), ...byDomain(tier2, "psychosocial")],
      trackingMetrics: ["Balance hold duration", "Attention d-prime", "Dietary compliance", "Emotional check-in"],
    },
    // Phase 3: Weeks 9-12 — Intensify + expand
    {
      weekRange: "9–12",
      phase: "Intensification",
      physical: [...byDomain(tier1, "physical"), ...byDomain(tier2, "physical")],
      cognitive: byDomain(tier2, "cognitive"),
      dietary: [...byDomain(tier1, "dietary"), ...byDomain(tier2, "dietary")],
      psychosocial: byDomain(tier2, "psychosocial"),
      trackingMetrics: ["Strength score", "Emotional wellbeing composite", "Nutrient intake adherence"],
    },
    // Phase 4: Weeks 13-18 — Enrichment
    {
      weekRange: "13–18",
      phase: "Enrichment",
      physical: [...byDomain(tier2, "physical"), ...byDomain(tier3, "physical")],
      cognitive: byDomain(tier3, "cognitive"),
      dietary: byDomain(tier3, "dietary"),
      psychosocial: [...byDomain(tier2, "psychosocial"), ...byDomain(tier3, "psychosocial")],
      trackingMetrics: ["Convergence score", "Resilience index", "Social engagement frequency"],
    },
    // Phase 5: Weeks 19-24 — Maintenance + consolidation
    {
      weekRange: "19–24",
      phase: "Consolidation",
      physical: byDomain(tier3, "physical"),
      cognitive: byDomain(tier3, "cognitive"),
      dietary: [],
      psychosocial: byDomain(tier3, "psychosocial"),
      trackingMetrics: ["LHS trend", "Velocity direction", "Overall wellbeing check"],
    },
  ];

  return plans;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5.4 — PARENT COMMUNICATION LAYER
// ═══════════════════════════════════════════════════════════════════════════

function generateParentReport(
  alg: AlgorithmOutputs,
  patterns: PatternActivationVector,
  interventions: InterventionItem[],
  tier0Alerts: string[],
  input: RawAssessmentInput
): ParentReport {
  const p = alg.percentiles;

  // Identify strengths (domains > 60th percentile)
  const strengths: string[] = [];
  if (p.physical.composite > 60) strengths.push("Your child shows great physical fitness and coordination");
  if (p.cognitive.composite > 60) strengths.push("Strong cognitive abilities, especially in problem-solving and focus");
  if (p.dietary.composite > 60) strengths.push("Good dietary habits supporting overall nutrition");
  if (p.psychosocial.composite > 60) strengths.push("Healthy emotional wellbeing and social confidence");
  if (strengths.length === 0) strengths.push("Your child shows determination and effort across all areas");

  // Areas for growth (domains < 45th percentile)
  const areas: string[] = [];
  if (p.physical.composite < 45) areas.push("We noticed opportunities to build physical stamina and balance through fun daily activities");
  if (p.cognitive.composite < 45) areas.push("Focus and processing speed can be strengthened with short daily brain games");
  if (p.dietary.composite < 45) areas.push("A few small food swaps can make a big difference in energy and growth");
  if (p.psychosocial.composite < 45) areas.push("Building emotional confidence through structured social time and relaxation");

  // Quick wins
  const quickWins = interventions
    .filter(i => i.effortLevel === "quick_win")
    .map(i => i.title);

  // Core habits
  const coreHabits = interventions
    .filter(i => i.effortLevel === "core_habit")
    .map(i => i.title);

  // Lifestyle shifts
  const lifestyleShifts = interventions
    .filter(i => i.effortLevel === "lifestyle_shift")
    .map(i => i.title);

  // Expected outcomes using saturation model
  const outcomes: string[] = [];
  for (const proj of alg.saturationProjections.slice(0, 3)) {
    outcomes.push(
      `Children in a similar profile typically see a ${proj.expectedGainPercent}% improvement in ${proj.domain} within 8–12 weeks with these activities.`
    );
  }

  // Summary — non-alarmist, actionable
  const lhs = alg.latentHealthScore.lhs;
  let summaryTone = "";
  if (lhs >= 65) {
    summaryTone = "Your child is doing well overall! Here are some enrichment suggestions to help them thrive even more.";
  } else if (lhs >= 45) {
    summaryTone = "Your child has wonderful strengths, and we've identified a few areas where small changes can make a real difference.";
  } else {
    summaryTone = "We've put together a supportive plan to help your child build strength across several areas. Small steps, done consistently, lead to big results.";
  }

  return {
    summary: summaryTone,
    strengths,
    areasForGrowth: areas,
    quickWins,
    coreHabits,
    lifestyleShifts,
    referralRecommendations: tier0Alerts,
    expectedOutcomes: outcomes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5.5 — INTERVENTION OUTCOME TRACKING
// ═══════════════════════════════════════════════════════════════════════════

export function trackInterventionOutcomes(
  currentPercentiles: AlgorithmOutputs["percentiles"],
  previousSession: AssessmentSession,
  previousPlan: ActionPlan
): InterventionTrackingResult[] {
  const results: InterventionTrackingResult[] = [];
  const prevP = previousSession.percentiles;

  for (const intervention of previousPlan.topPriorityInterventions) {
    const template = INTERVENTION_TEMPLATES.find(t => t.id === intervention.id);

    // Compute actual delta — use template's pageRankTarget if available,
    // otherwise fall back to domain-composite score for the intervention's domain
    let currentScore: number;
    let previousScore: number;

    if (template) {
      currentScore  = getScoreForTarget(currentPercentiles, template.pageRankTarget);
      previousScore = getScoreForTarget(prevP, template.pageRankTarget);
    } else {
      // Domain-level fallback: compare composite score of the intervention domain
      const domainFallback: Record<string, number> = {
        physical:    currentPercentiles.physical.composite,
        cognitive:   currentPercentiles.cognitive.composite,
        dietary:     currentPercentiles.dietary.composite,
        psychosocial: currentPercentiles.psychosocial.composite,
        nutrition:   currentPercentiles.dietary.composite,
      };
      const prevDomainFallback: Record<string, number> = {
        physical:    prevP.physical.composite,
        cognitive:   prevP.cognitive.composite,
        dietary:     prevP.dietary.composite,
        psychosocial: prevP.psychosocial.composite,
        nutrition:   prevP.dietary.composite,
      };
      currentScore  = domainFallback[intervention.domain]  ?? 50;
      previousScore = prevDomainFallback[intervention.domain] ?? 50;
    }

    const actualDelta = currentScore - previousScore;

    // Expected delta from counterfactual ranker
    const expectedDelta = intervention.expectedUtility;

    // Classify outcome
    const ratio = expectedDelta > 0 ? actualDelta / expectedDelta : 0;
    let outcome: InterventionOutcome;
    let recommendation: string;

    if (actualDelta < 0) {
      outcome = InterventionOutcome.Adverse;
      recommendation = "Immediate plan revision required. Check for adverse factors or measurement issues.";
    } else if (ratio >= 0.80) {
      outcome = InterventionOutcome.Effective;
      recommendation = "Continue + add enrichment layer for this domain.";
    } else if (ratio >= 0.40) {
      outcome = InterventionOutcome.Partial;
      recommendation = "Investigate mediating barriers: adherence, bioavailability, sleep quality.";
    } else {
      outcome = InterventionOutcome.NonResponse;
      recommendation = "Plan revision needed. Run root-cause analysis: adherence vs. biological block.";
    }

    results.push({
      interventionId: intervention.id,
      actualDelta: Math.round(actualDelta * 10) / 10,
      expectedDelta: Math.round(expectedDelta * 10) / 10,
      outcome,
      recommendation,
    });
  }

  return results;
}

function getScoreForTarget(p: AlgorithmOutputs["percentiles"], target: string): number {
  const lookup: Record<string, number> = {
    balance: p.physical.balance, coordination: p.physical.coordination,
    strength: p.physical.strength, endurance: p.physical.endurance,
    flexibility: p.physical.flexibility,
    workingMemory: p.cognitive.workingMemory, attention: p.cognitive.sustainedAttention,
    processingSpeed: p.cognitive.processingSpeed,
    iron: p.dietary.iron, calcium: p.dietary.calcium, protein: p.dietary.protein,
    vitaminD: p.dietary.vitaminD, fibre: p.dietary.fibre,
    anxiety: p.psychosocial.anxiety, emotionalWellbeing: p.psychosocial.emotionalWellbeing,
    socialSafety: p.psychosocial.socialSafety, resilience: p.psychosocial.resilience,
    screenTime: p.psychosocial.screenTime,
    sleep: (p.psychosocial.stress + p.psychosocial.emotionalWellbeing) / 2,
  };
  return lookup[target] ?? 50;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ACTION PLAN SYNTHESISER
// ═══════════════════════════════════════════════════════════════════════════

export function synthesiseActionPlan(
  input: RawAssessmentInput,
  algorithmOutputs: AlgorithmOutputs,
  patternActivations: PatternActivationVector
): ActionPlan {
  // Step 1: Detect Tier 0 alerts
  const tier0Alerts = detectTier0Alerts(patternActivations, algorithmOutputs);

  // Step 2: Select interventions using counterfactual ranking + filters
  const interventions = selectInterventions(algorithmOutputs, patternActivations, input);

  // Step 3: Build 24-week phased plan
  const weeklyPlans = buildWeeklyPlans(interventions, algorithmOutputs);

  // Step 4: Generate parent communication
  const parentCommunication = generateParentReport(
    algorithmOutputs, patternActivations, interventions, tier0Alerts, input
  );

  // Top priority interventions (for tracking)
  const topPriority = interventions.slice(0, 5);

  return {
    childId: input.profile.id,
    generatedAt: new Date().toISOString(),
    phenotypicProfile: algorithmOutputs.phenotypicProfile.name,
    tier0Alerts,
    weeklyPlans,
    totalInterventions: interventions.length,
    topPriorityInterventions: topPriority,
    parentCommunication,
  };
}
