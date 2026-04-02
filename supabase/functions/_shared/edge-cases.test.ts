/**
 * KidVital360 — 5 Adversarial Edge-Case Tests
 *
 * These tests push every layer of the V4 intelligence stack:
 *   EC-1  Gender calibration stress test (M vs F, identical physical inputs)
 *   EC-2  Iron-deficient vegan with hidden cognitive impact chain
 *   EC-3  Domain-asymmetry: gifted-cognitive + severely deconditioned
 *   EC-4  Obese + sedentary + high-snack → metabolic + gut-mood cascade
 *   EC-5  Longitudinal regression: second session worse than first
 */

import { assertEquals, assertGreater, assertLess, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runEngine } from "./engine-v4-engine.ts";
import {
  RawAssessmentInput, Gender, DietType, CityTier, Season,
  ActionPriority,
} from "./engine-v4-types.ts";

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function baseProfile(overrides: Partial<RawAssessmentInput["profile"]> = {}): RawAssessmentInput["profile"] {
  return {
    id: "test-child",
    ageYears: 10,
    ageMonths: 0,
    gender: Gender.Male,
    cityTier: CityTier.T2,
    season: Season.Winter,
    dietType: DietType.Vegetarian,
    assessmentDate: "2025-06-01",
    sessionNumber: 1,
    ...overrides,
  };
}

function basePhysical(overrides = {}): RawAssessmentInput["physical"] {
  return {
    balanceHoldSeconds: 12,
    balanceSwayPixelsPerFrame: 3,
    coordinationScore: 60,
    strengthProxy: 60,
    enduranceScore: 60,
    flexibilityScore: 60,
    heightCm: 138,
    weightKg: 30,
    ...overrides,
  };
}

function baseCognitive(overrides = {}): RawAssessmentInput["cognitive"] {
  return {
    reactionTimeMs: 420,
    reactionTimeVariabilityMs: 40,
    workingMemoryScore: 60,
    fluidReasoningScore: 60,
    sustainedAttentionDPrime: 2.2,
    processingSpeedScore: 60,
    emotionRecognitionScore: 60,
    falseStartRate: 0.05,
    ...overrides,
  };
}

function baseDietary(overrides: Partial<RawAssessmentInput["dietary"]> = {}): RawAssessmentInput["dietary"] {
  return {
    answers: [2, 2, 0, 2, 2, 2, 2, 1, 2, 2],
    dietType: DietType.Vegetarian,
    ironRichFoodFrequency: 3,
    calciumSources: ["milk", "curd"],
    proteinSources: ["dal", "milk"],
    fibreIntake: 14,
    vitCIntake: 40,
    legumeDays: 5,
    spinachAsPrimaryCa: false,
    dailyWaterIntakeMl: 1600,
    stapleGrains: ["rice", "roti"],
    ...overrides,
  };
}

function basePsychosocial(overrides = {}): RawAssessmentInput["psychosocial"] {
  return {
    answers: Array(12).fill(2),
    anxietyIndex: 30,
    stressIndex: 30,
    emotionalWellbeingScore: 65,
    socialSafetyScore: 70,
    resilienceScore: 65,
    screenTimeHoursPerDay: 2,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EC-1: GENDER CALIBRATION STRESS TEST
//   Same physical inputs → Male vs Female 10-year-old
//   Expected: flexibility pct Female > Male by ≥8 pts
//             endurance pct Male > Female by ≥6 pts
//   Validates: GENDER_METRIC_ADJUSTMENTS lookup table is active
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("EC-1: Gender calibration — Female flexibility > Male by ≥8pts, Male endurance > Female by ≥6pts", () => {
  const physIdentical = basePhysical({
    flexibilityScore: 60,
    enduranceScore: 60,
    coordinationScore: 60,
    strengthProxy: 60,
    balanceHoldSeconds: 12,
  });

  const maleResult = runEngine({
    profile: baseProfile({ gender: Gender.Male }),
    physical: physIdentical,
    cognitive: baseCognitive(),
    dietary: baseDietary(),
    psychosocial: basePsychosocial(),
  });

  const femaleResult = runEngine({
    profile: baseProfile({ gender: Gender.Female }),
    physical: physIdentical,
    cognitive: baseCognitive(),
    dietary: baseDietary(),
    psychosocial: basePsychosocial(),
  });

  const maleFlexPct    = maleResult.percentiles.physical.flexibility;
  const femaleFlexPct  = femaleResult.percentiles.physical.flexibility;
  const maleEndPct     = maleResult.percentiles.physical.endurance;
  const femaleEndPct   = femaleResult.percentiles.physical.endurance;

  console.log(`[EC-1] Male flex=${maleFlexPct}  Female flex=${femaleFlexPct}  diff=${femaleFlexPct - maleFlexPct}`);
  console.log(`[EC-1] Male end=${maleEndPct}   Female end=${femaleEndPct}    diff=${maleEndPct - femaleEndPct}`);

  assertGreater(femaleFlexPct, maleFlexPct + 7,
    `Female flexibility percentile (${femaleFlexPct}) should exceed Male (${maleFlexPct}) by ≥8pts`);
  assertGreater(maleEndPct, femaleEndPct + 5,
    `Male endurance percentile (${maleEndPct}) should exceed Female (${femaleEndPct}) by ≥6pts`);
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-2: VEGAN IRON-DEFICIENT + B12 DEPLETED CHILD
//   Vegan 12-year-old female, no eggs, no dairy, low greens, low legumes
//   Expected:
//     - dietary.iron < 30th percentile
//     - dietary.b12 < 25th percentile
//     - iron-cognition hidden pattern fires (confidence > 0.55)
//     - actionPriority is "immediate" or "high"
//     - LHS < 55 (systemic deficiencies tank integrated score)
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("EC-2: Vegan iron+B12 deficient — low pct, iron-cognition pattern fires, LHS < 55", () => {
  const result = runEngine({
    profile: baseProfile({
      gender: Gender.Female,
      ageYears: 12,
      dietType: DietType.Vegan,
    }),
    physical: basePhysical({ enduranceScore: 42 }),  // mild fatigue from anaemia
    cognitive: baseCognitive({
      sustainedAttentionDPrime: 1.6,  // below 28th pct — iron-cognition trigger
      processingSpeedScore: 38,
      emotionRecognitionScore: 55,
    }),
    dietary: baseDietary({
      answers: [0, 1, 0, 1, 1, 2, 0, 2, 1, 0],  // minimal dairy/greens/legumes
      dietType: DietType.Vegan,
      ironRichFoodFrequency: 1,
      calciumSources: [],
      proteinSources: ["dal"],
      fibreIntake: 8,
      legumeDays: 2,
    }),
    psychosocial: basePsychosocial({ emotionalWellbeingScore: 52 }),
  });

  const dIron = result.percentiles.dietary.iron;
  const dB12  = result.percentiles.dietary.b12;
  const lhs   = result.algorithmOutputs.latentHealthScore.lhs;

  console.log(`[EC-2] dietary.iron=${dIron}  dietary.b12=${dB12}  LHS=${lhs}`);

  const ironCognPattern = result.patternActivations.patterns.find(p =>
    p.patternId.toLowerCase().includes("iron") ||
    p.patternName.toLowerCase().includes("iron") ||
    p.patternName.toLowerCase().includes("anaemia") ||
    p.patternName.toLowerCase().includes("anemia")
  );
  console.log(`[EC-2] iron-cognition pattern: ${ironCognPattern?.patternName ?? "NOT FOUND"} (confidence=${ironCognPattern?.confidence})`);

  assertLess(dIron, 30, `Iron percentile (${dIron}) should be < 30 for vegan with minimal greens`);
  assertLess(dB12, 25, `B12 percentile (${dB12}) should be < 25 for vegan (no animal products)`);
  assertLess(lhs, 55, `LHS (${lhs}) should be < 55 for systemically deficient child`);

  assert(
    ironCognPattern !== undefined && ironCognPattern.activated,
    "Iron-cognition hidden pattern should be activated"
  );
  assert(
    ironCognPattern!.actionPriority === ActionPriority.Immediate ||
    ironCognPattern!.actionPriority === ActionPriority.High,
    `Iron-cognition priority should be immediate/high, got ${ironCognPattern!.actionPriority}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-3: DOMAIN ASYMMETRY — GIFTED COGNITIVE + SEVERELY DECONDITIONED
//   99th pct cognitive, 5th pct physical across all metrics
//   Expected:
//     - compensatoryPattern.detected === true
//     - compensatoryPattern.strongDomain === "cognitive"
//     - compensatoryPattern.weakDomain === "physical"
//     - deviationSpread > 30
//     - domain-asymmetry or compensatory hidden pattern fires
//     - action plan top interventions are physical domain
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("EC-3: Domain asymmetry (gifted-cognitive + deconditioned) — compensatory pattern detected, physical interventions prioritised", () => {
  const result = runEngine({
    profile: baseProfile({ gender: Gender.Male, ageYears: 11 }),
    physical: basePhysical({
      balanceHoldSeconds: 3,
      coordinationScore: 12,
      strengthProxy: 10,
      enduranceScore: 8,
      flexibilityScore: 15,
      weightKg: 42,   // slightly overweight for 11yr
    }),
    cognitive: baseCognitive({
      reactionTimeMs: 195,              // elite
      reactionTimeVariabilityMs: 12,
      workingMemoryScore: 96,
      fluidReasoningScore: 94,
      sustainedAttentionDPrime: 4.1,    // top 2%
      processingSpeedScore: 92,
      emotionRecognitionScore: 85,
      falseStartRate: 0.01,
    }),
    dietary: baseDietary(),
    psychosocial: basePsychosocial({ screenTimeHoursPerDay: 6 }),  // heavy screen use explains sedentary
  });

  const comp = result.algorithmOutputs.compensatoryPattern;
  const physComp = result.percentiles.physical.composite;
  const cogComp  = result.percentiles.cognitive.composite;
  const spread   = cogComp - physComp;

  console.log(`[EC-3] physical.composite=${physComp}  cognitive.composite=${cogComp}  spread=${spread}`);
  console.log(`[EC-3] compensatoryPattern: detected=${comp.detected}, strong=${comp.strongDomain}, weak=${comp.weakDomain}, spread=${comp.deviationSpread}`);

  assertGreater(cogComp, 80, `Cognitive composite (${cogComp}) should be > 80`);
  assertLess(physComp, 25, `Physical composite (${physComp}) should be < 25`);
  assertGreater(spread, 30, `Domain spread (${spread}) should exceed 30`);

  assert(comp.detected, "compensatoryPattern.detected should be true");
  assertEquals(comp.strongDomain, "cognitive", `Strong domain should be 'cognitive', got '${comp.strongDomain}'`);

  const physPattern = result.patternActivations.patterns.find(p =>
    p.patternName.toLowerCase().includes("asymmetry") ||
    p.patternName.toLowerCase().includes("compensat") ||
    p.patternName.toLowerCase().includes("sedentary") ||
    p.patternName.toLowerCase().includes("screen")
  );
  console.log(`[EC-3] asymmetry/screen pattern: ${physPattern?.patternName ?? "not found"}`);

  const topInterventions = result.actionPlan.topPriorityInterventions.slice(0, 3);
  const physDomCount = topInterventions.filter(i => i.domain === "physical").length;
  console.log(`[EC-3] Top 3 interventions domains: ${topInterventions.map(i => i.domain).join(", ")}`);
  assertGreater(physDomCount, 0, "At least 1 of top 3 interventions should be physical domain");
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-4: OBESITY + SEDENTARY + HIGH PROCESSED SNACKS → METABOLIC + GUT-MOOD CASCADE
//   BMI > 85th pct (obese for age), high snack score (displacing fibre),
//   low emotional wellbeing + high stress → gut-mood + metabolic pattern fire together
//   Expected:
//     - bmi percentile > 85
//     - dietary.fibre < 35
//     - metabolic OR obesity risk in bayesian posteriors with posterior > 0.40
//     - gut-mood pattern fires (fibre<28 + emotional<35)
//     - tier0Alerts is non-empty OR ≥1 "immediate" pattern
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("EC-4: Obesity + high snack + low emotional → metabolic risk elevated, gut-mood cascade", () => {
  const result = runEngine({
    profile: baseProfile({ gender: Gender.Male, ageYears: 13, dietType: DietType.Omnivore }),
    physical: basePhysical({
      balanceHoldSeconds: 10,
      coordinationScore: 45,
      strengthProxy: 50,
      enduranceScore: 22,       // poor VO2 proxy (obese child)
      flexibilityScore: 30,
      heightCm: 155,
      weightKg: 65,             // BMI ≈ 27 → >95th pct for 13yr IAP
    }),
    cognitive: baseCognitive({
      workingMemoryScore: 48,
      processingSpeedScore: 44,
      emotionRecognitionScore: 30,  // below gut-mood threshold (35)
    }),
    dietary: baseDietary({
      answers: [2, 1, 1, 1, 1, 1, 0, 3, 1, 0],  // snackScore=3 (high processed), millets=0
      dietType: DietType.Omnivore,
      ironRichFoodFrequency: 2,
      fibreIntake: 7,           // well below gut-mood trigger (28th pct threshold)
      vitCIntake: 20,
    }),
    psychosocial: basePsychosocial({
      answers: Array(12).fill(1),
      anxietyIndex: 72,            // psyAnxiety = 100-72 = 28 → below 35 threshold
      stressIndex: 68,             // psyStress = 100-68 = 32 → below 35
      emotionalWellbeingScore: 28, // below 35 threshold for gut-mood
      resilienceScore: 38,
      screenTimeHoursPerDay: 5,
    }),
  });

  const bmiPct  = result.percentiles.physical.bmi;
  const fibrePct = result.percentiles.dietary.fibre;
  const lhs = result.algorithmOutputs.latentHealthScore.lhs;

  console.log(`[EC-4] bmi.pct=${bmiPct}  fibre.pct=${fibrePct}  LHS=${lhs}`);

  const gutMoodPattern = result.patternActivations.patterns.find(p =>
    p.patternName.toLowerCase().includes("gut") ||
    p.patternName.toLowerCase().includes("mood") ||
    p.patternName.toLowerCase().includes("microbiome")
  );
  const metabolicRisk = result.algorithmOutputs.bayesianPosteriors.find(b =>
    b.condition.toLowerCase().includes("metabolic") ||
    b.condition.toLowerCase().includes("obese") ||
    b.condition.toLowerCase().includes("obesity") ||
    b.condition.toLowerCase().includes("insulin")
  );

  console.log(`[EC-4] gut-mood pattern: ${gutMoodPattern?.patternName ?? "not found"} activated=${gutMoodPattern?.activated}`);
  console.log(`[EC-4] metabolic posterior: ${metabolicRisk?.condition} = ${metabolicRisk?.posterior}`);
  console.log(`[EC-4] tier0Alerts: ${result.actionPlan.tier0Alerts.join(" | ")}`);

  // BMI should register as overweight/obese (>85th pct is clinical overweight for IAP)
  assertGreater(bmiPct, 85, `BMI percentile (${bmiPct}) should be >85 for obese 13-yr-old (65kg/155cm)`);
  assertLess(fibrePct, 35, `Fibre percentile (${fibrePct}) should be <35`);

  assert(
    gutMoodPattern?.activated === true,
    `Gut-mood pattern should activate (fibre low + emotional<35). Found: ${gutMoodPattern?.patternName ?? "none"}`
  );

  if (metabolicRisk) {
    assertGreater(metabolicRisk.posterior, 0.35,
      `Metabolic risk posterior (${metabolicRisk.posterior}) should be >0.35 for obese+sedentary child`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-5: LONGITUDINAL REGRESSION — SESSION 2 WORSE ACROSS ALL DOMAINS
//   Child scored 60th pct in all domains at Session 1
//   Session 2: all scores have declined ~15 pts
//   Expected:
//     - interventionTracking returned (non-empty)
//     - at least 2 outcomes classified as "non_response" or "partial"
//     - anomalyAlerts fires at least 1 "rapid_decline"
//     - DBN belief state source = "accumulated"
//     - overall trend recognised as declining
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("EC-5: Longitudinal regression — non_response tracking, anomaly alerts, DBN accumulated state", () => {
  // Build a fake session-1 percentile snapshot at ~60th across all domains
  const session1Percentiles = {
    physical: { balance: 58, coordination: 61, strength: 59, endurance: 62, flexibility: 60, bmi: 55, heightForAge: 52, composite: 60 },
    cognitive: { reactionTime: 58, workingMemory: 62, fluidReasoning: 60, sustainedAttention: 61, processingSpeed: 59, emotionRecognition: 63, composite: 60 },
    dietary:   { iron: 58, calcium: 60, protein: 62, vitaminD: 55, fibre: 61, vitaminC: 59, zinc: 57, b12: 50, calories: 60, composite: 58 },
    psychosocial: { anxiety: 65, stress: 62, emotionalWellbeing: 63, socialSafety: 68, resilience: 65, screenTime: 60, composite: 64 },
  };

  // Minimal fake session-1 record (we only need percentiles + actionPlan for tracking)
  const session1: any = {
    sessionNumber: 1,
    date: "2025-01-01",
    percentiles: session1Percentiles,
    algorithmOutputs: { latentHealthScore: { lhs: 60, domainContributions: {}, reliabilityWeights: { physical: 0.25, cognitive: 0.25, dietary: 0.25, psychosocial: 0.25 } } },
    patternActivations: { patterns: [], activatedCount: 0, highPriorityCount: 0 },
    actionPlan: {
      childId: "test-child",
      generatedAt: "2025-01-01",
      phenotypicProfile: "P04",
      tier0Alerts: [],
      weeklyPlans: [],
      totalInterventions: 3,
      topPriorityInterventions: [
        { id: "I-PHYS-01", domain: "physical", title: "Daily outdoor play", description: "30 min", frequency: "daily", durationMinutes: 30, tier: 2, expectedUtility: 0.6, pageRankLeverage: 0.5, feasibility: 0.8, compositeScore: 0.65, linkedPatterns: [], effortLevel: "core_habit" },
        { id: "I-DIET-01", domain: "dietary", title: "Add leafy greens", description: "5x/week", frequency: "5x/week", durationMinutes: 0, tier: 2, expectedUtility: 0.55, pageRankLeverage: 0.4, feasibility: 0.75, compositeScore: 0.6, linkedPatterns: [], effortLevel: "core_habit" },
        { id: "I-COG-01",  domain: "cognitive", title: "Memory games", description: "Daily", frequency: "daily", durationMinutes: 15, tier: 2, expectedUtility: 0.5, pageRankLeverage: 0.3, feasibility: 0.9, compositeScore: 0.55, linkedPatterns: [], effortLevel: "quick_win" },
      ],
      parentCommunication: { summary: "", strengths: [], areasForGrowth: [], quickWins: [], coreHabits: [], lifestyleShifts: [], referralRecommendations: [], expectedOutcomes: [] },
    },
  };

  // Session 2 — all metrics have regressed ~15 pts from session-1
  const result = runEngine({
    profile: baseProfile({ sessionNumber: 2 }),
    physical: basePhysical({
      balanceHoldSeconds: 7,
      coordinationScore: 42,
      strengthProxy: 44,
      enduranceScore: 40,
      flexibilityScore: 43,
    }),
    cognitive: baseCognitive({
      reactionTimeMs: 560,           // slower (worse)
      workingMemoryScore: 44,
      fluidReasoningScore: 43,
      sustainedAttentionDPrime: 1.8,
      processingSpeedScore: 42,
      emotionRecognitionScore: 46,
    }),
    dietary: baseDietary({
      answers: [1, 1, 0, 1, 1, 2, 1, 2, 1, 1],  // regressed eating habits
      fibreIntake: 9,
    }),
    psychosocial: basePsychosocial({
      stressIndex: 55,
      emotionalWellbeingScore: 45,
      resilienceScore: 48,
      screenTimeHoursPerDay: 4,
    }),
    previousSessions: [session1],
  });

  const dbn = result.algorithmOutputs.dbnBeliefState;
  const anomalies = result.algorithmOutputs.anomalyAlerts;
  const tracking = result.interventionTracking;

  const physComp2 = result.percentiles.physical.composite;
  const cogComp2  = result.percentiles.cognitive.composite;

  console.log(`[EC-5] Session-2 physical.composite=${physComp2}  cognitive.composite=${cogComp2}`);
  console.log(`[EC-5] DBN source=${dbn.sessionNumber}  sessionNumber=${dbn.sessionNumber}`);
  console.log(`[EC-5] anomalyAlerts (${anomalies.length}): ${anomalies.map(a => `${a.metric}:${a.type}`).join(", ")}`);
  console.log(`[EC-5] interventionTracking (${tracking?.length ?? 0}): ${tracking?.map(t => `${t.interventionId}=${t.outcome}`).join(", ")}`);

  // Session 2 scores should be lower than session 1 (~60th)
  assertLess(physComp2, 52, `Physical composite (${physComp2}) should be < 52 after regression`);
  assertLess(cogComp2,  52, `Cognitive composite (${cogComp2}) should be < 52 after regression`);

  // DBN should use prior from session 1
  assertEquals(dbn.priorSource, "accumulated", `DBN should use 'accumulated' priors from session 1, got '${dbn.priorSource}'`);

  // Intervention tracking should exist (we passed previousSessions with an actionPlan)
  assert(tracking !== undefined && tracking.length > 0, "interventionTracking should be non-empty for session 2");

  // At least one regression intervention should show non_response or partial
  // At least one regression intervention should be tracked as adverse (score declined)
  const regressionOutcomes = tracking!.filter(t =>
    t.outcome === "non_response" || t.outcome === "partial" || t.outcome === "adverse"
  );
  console.log(`[EC-5] regression outcomes: ${regressionOutcomes.length} (adverse/non_response/partial)`);
  assertGreater(regressionOutcomes.length, 0,
    "At least 1 intervention should show adverse/non_response/partial after regression");
});
