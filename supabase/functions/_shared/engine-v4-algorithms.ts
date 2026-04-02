// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — 24-Algorithm Suite
// ═══════════════════════════════════════════════════════════════════════════

import {
  RawAssessmentInput, DomainPercentiles, ReliabilityWeights,
  BayesianPosterior, MonteCarloResult, PageRankScores,
  SaturationProjection, NutrientInteraction, DevelopmentalAgeResult,
  VelocityResult, ConvergenceScore, PhenotypicProfile,
  LatentHealthScore, MediationResult, AnomalyVelocityAlert,
  SleepProxyScore, ResilienceRiskRatio, CompensatoryPattern,
  DBNBeliefState, CounterfactualRanking, ICD10Mapping,
  NeurodivergenceResult, AlgorithmOutputs, VelocityDirection,
  Gender, AssessmentSession, DietType,
} from "./engine-v4-types.ts";

import {
  DOMAIN_RELIABILITY_WEIGHTS, INCOMPLETE_RELIABILITY_PENALTY,
  SLEEP_PROXY_LOADINGS, SLEEP_INADEQUACY_THRESHOLD,
  ANOMALY_VELOCITY_Z_THRESHOLD, RESILIENCE_HIGH_THRESHOLD,
  RESILIENCE_VULNERABILITY_THRESHOLD, COMPENSATORY_HIGH_THRESHOLD,
  COMPENSATORY_LOW_THRESHOLD, BIOAVAILABILITY_CORRECTIONS,
  SUN_EXPOSURE_PROXY, NUTRIENT_INTERACTION_MATRIX,
  SATURATION_K_RATES, PHENOTYPE_PROFILES, BAYESIAN_PRIORS,
  BIOLOGICAL_PATHWAYS, getBenchmark, CITY_TIER_RISK_MODIFIERS,
  DIET_TYPE_MODIFIERS, ICD10_SYMPTOM_MAP,
  INTERVENTION_TEMPLATES, getPathwayMultiplier,
} from "./engine-v4-constants.ts";

// ─── Utility: Normal CDF (Abramowitz & Stegun polynomial approx) ────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

function rawToPercentile(value: number, mean: number, sd: number): number {
  const z = (value - mean) / sd;
  return Math.max(1, Math.min(99, Math.round(normalCDF(z) * 100)));
}

function invertedPercentile(value: number, mean: number, sd: number): number {
  return 100 - rawToPercentile(value, mean, sd);
}

// ─── Box-Muller Gaussian RNG ────────────────────────────────────────────

function gaussianRandom(mean: number, sd: number): number {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

// ─── Sigmoid ────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 1: Normal CDF Percentile Scoring
// ═══════════════════════════════════════════════════════════════════════════

export function computePercentiles(input: RawAssessmentInput): DomainPercentiles {
  const { profile, physical, cognitive, dietary, psychosocial } = input;
  const { ageYears, gender } = profile;

  const p = (metric: string, value: number, inverted = false) => {
    const bm = getBenchmark(metric, ageYears, gender);
    return inverted
      ? invertedPercentile(value, bm.mean, bm.sd)
      : rawToPercentile(value, bm.mean, bm.sd);
  };

  // Physical percentiles
  const physBalance = p("balanceHoldSeconds", physical.balanceHoldSeconds);
  const physCoord = p("coordinationScore", physical.coordinationScore);
  const physStrength = p("strengthProxy", physical.strengthProxy);
  const physEndurance = p("enduranceScore", physical.enduranceScore);
  const physFlex = p("flexibilityScore", physical.flexibilityScore);
  const physBmi = computeBMIPercentile(physical.weightKg, physical.heightCm, ageYears, gender);
  const physHeight = p("heightCm", physical.heightCm);
  const physComposite = Math.round(
    (physBalance + physCoord + physStrength + physEndurance + physFlex) / 5
  );

  // Cognitive percentiles (reaction time is inverted — lower is better)
  const cogRT = p("reactionTimeMs", cognitive.reactionTimeMs, true);
  const cogWM = p("workingMemoryScore", cognitive.workingMemoryScore);
  const cogFR = p("fluidReasoningScore", cognitive.fluidReasoningScore);
  const cogSA = rawToPercentile(cognitive.sustainedAttentionDPrime, 2.2 + (ageYears - 5) * 0.1, 0.8);
  const cogPS = p("processingSpeedScore", cognitive.processingSpeedScore);
  const cogER = p("emotionRecognitionScore", cognitive.emotionRecognitionScore);
  const cogComposite = Math.round((cogRT + cogWM + cogFR + cogSA + cogPS + cogER) / 6);

  // Dietary percentiles (T2-B: now includes folate and omega3)
  const dietIron = estimateNutrientPercentile(dietary, "iron", ageYears);
  const dietCa = estimateNutrientPercentile(dietary, "calcium", ageYears);
  const dietProtein = estimateNutrientPercentile(dietary, "protein", ageYears);
  const dietVitD = estimateNutrientPercentile(dietary, "vitaminD", ageYears);
  const dietFibre = estimateNutrientPercentile(dietary, "fibre", ageYears);
  const dietVitC = estimateNutrientPercentile(dietary, "vitaminC", ageYears);
  const dietZinc = estimateNutrientPercentile(dietary, "zinc", ageYears);
  const dietB12 = estimateNutrientPercentile(dietary, "b12", ageYears);
  const dietCalories = estimateNutrientPercentile(dietary, "calories", ageYears);
  const dietFolate = estimateNutrientPercentile(dietary, "folate", ageYears);
  const dietOmega3 = estimateNutrientPercentile(dietary, "omega3", ageYears);
  const dietComposite = Math.round(
    (dietIron + dietCa + dietProtein + dietVitD + dietFibre + dietVitC + dietZinc + dietB12 + dietCalories + dietFolate + dietOmega3) / 11
  );

  // Psychosocial (anxiety and stress are inverted — high raw = bad)
  const psyAnxiety = Math.max(1, Math.min(99, 100 - psychosocial.anxietyIndex));
  const psyStress = Math.max(1, Math.min(99, 100 - psychosocial.stressIndex));
  const psyEmotional = Math.max(1, Math.min(99, psychosocial.emotionalWellbeingScore));
  const psySocial = Math.max(1, Math.min(99, psychosocial.socialSafetyScore));
  const psyResilience = Math.max(1, Math.min(99, psychosocial.resilienceScore));
  // WHO-aligned sigmoid: <1hr ideal, 1-2hr acceptable, >2hr concern, >4hr high concern
  const psyScreen = Math.max(1, Math.min(99, Math.round(
    100 * (1 / (1 + Math.exp(1.5 * (psychosocial.screenTimeHoursPerDay - 2))))
  )));
  const psyComposite = Math.round(
    (psyAnxiety + psyStress + psyEmotional + psySocial + psyResilience + psyScreen) / 6
  );

  return {
    physical: {
      balance: physBalance, coordination: physCoord, strength: physStrength,
      endurance: physEndurance, flexibility: physFlex, bmi: physBmi,
      heightForAge: physHeight, composite: physComposite,
    },
    cognitive: {
      reactionTime: cogRT, workingMemory: cogWM, fluidReasoning: cogFR,
      sustainedAttention: cogSA, processingSpeed: cogPS,
      emotionRecognition: cogER, composite: cogComposite,
    },
    dietary: {
      iron: dietIron, calcium: dietCa, protein: dietProtein,
      vitaminD: dietVitD, fibre: dietFibre, vitaminC: dietVitC,
      zinc: dietZinc, b12: dietB12, calories: dietCalories,
      folate: dietFolate, omega3: dietOmega3, composite: dietComposite,
    },
    psychosocial: {
      anxiety: psyAnxiety, stress: psyStress, emotionalWellbeing: psyEmotional,
      socialSafety: psySocial, resilience: psyResilience,
      screenTime: psyScreen, composite: psyComposite,
    },
  };
}

function computeBMIPercentile(weightKg: number, heightCm: number, ageYears: number, gender: Gender): number {
  const bmi = weightKg / ((heightCm / 100) ** 2);
  // IAP 2015 age-sex specific BMI-for-age approximation
  // Expected median BMI for Indian children (NNMB)
  const expectedBMI = 13.8 + (ageYears - 5) * 0.42 + (gender === Gender.Female ? 0.3 : 0);
  const sd = 2.2;
  // Raw percentile: higher BMI → higher percentile (used directly as obesity indicator)
  // Callers that want "health" score should invert; the BMI percentile here mirrors
  // clinical BMI-for-age charts where >85th = overweight, >95th = obese
  const z = (bmi - expectedBMI) / sd;
  const normalCDF = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const approx = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * poly;
    return x >= 0 ? approx : 1 - approx;
  };
  return Math.max(1, Math.min(99, Math.round(normalCDF(z) * 100)));
}

// ─── NNMB/CNNS Indian Median Intake Distributions ───────────────────────
// Mean daily intake (mg/day or kcal/day) and SD per age group
// Sources: CNNS 2016-18, NNMB 2017, ICMR-NIN 2020

type AgeGroup = "5-7" | "8-11" | "12-14" | "15-17";

interface MedianDist { mean: number; sd: number; }

const NUTRIENT_INDIAN_MEDIANS: Record<string, Record<AgeGroup, MedianDist>> = {
  iron: {
    "5-7":   { mean: 7.2,  sd: 3.1  },  // mg/day
    "8-11":  { mean: 9.5,  sd: 3.8  },
    "12-14": { mean: 11.8, sd: 4.5  },
    "15-17": { mean: 13.2, sd: 5.1  },
  },
  calcium: {
    "5-7":   { mean: 320,  sd: 140  },  // mg/day
    "8-11":  { mean: 390,  sd: 165  },
    "12-14": { mean: 440,  sd: 190  },
    "15-17": { mean: 480,  sd: 210  },
  },
  protein: {
    "5-7":   { mean: 28,   sd: 10   },  // g/day
    "8-11":  { mean: 36,   sd: 13   },
    "12-14": { mean: 44,   sd: 15   },
    "15-17": { mean: 52,   sd: 18   },
  },
  vitaminD: {
    "5-7":   { mean: 3.2,  sd: 2.0  },  // µg/day (dietary, not sun)
    "8-11":  { mean: 3.5,  sd: 2.2  },
    "12-14": { mean: 4.0,  sd: 2.5  },
    "15-17": { mean: 4.2,  sd: 2.7  },
  },
  fibre: {
    "5-7":   { mean: 10.5, sd: 4.2  },  // g/day
    "8-11":  { mean: 13.0, sd: 5.0  },
    "12-14": { mean: 15.5, sd: 5.8  },
    "15-17": { mean: 17.0, sd: 6.5  },
  },
  vitaminC: {
    "5-7":   { mean: 38,   sd: 20   },  // mg/day
    "8-11":  { mean: 42,   sd: 22   },
    "12-14": { mean: 45,   sd: 24   },
    "15-17": { mean: 48,   sd: 26   },
  },
  zinc: {
    "5-7":   { mean: 4.8,  sd: 1.9  },  // mg/day
    "8-11":  { mean: 6.2,  sd: 2.4  },
    "12-14": { mean: 7.8,  sd: 3.0  },
    "15-17": { mean: 9.0,  sd: 3.5  },
  },
  b12: {
    "5-7":   { mean: 0.9,  sd: 0.45 },  // µg/day
    "8-11":  { mean: 1.1,  sd: 0.55 },
    "12-14": { mean: 1.4,  sd: 0.65 },
    "15-17": { mean: 1.8,  sd: 0.80 },
  },
  // T2-B: Add NNMB Indian median distributions for folate and omega3
  folate: {
    "5-7":   { mean: 80,  sd: 35  },  // µg/day — NNMB 2017; vegetarian Indian children markedly low
    "8-11":  { mean: 100, sd: 42  },
    "12-14": { mean: 125, sd: 50  },
    "15-17": { mean: 145, sd: 58  },
  },
  omega3: {
    "5-7":   { mean: 0.55, sd: 0.25 },  // g/day ALA+EPA+DHA equivalent; very low in Indian vegetarian diet
    "8-11":  { mean: 0.70, sd: 0.30 },
    "12-14": { mean: 0.85, sd: 0.35 },
    "15-17": { mean: 1.00, sd: 0.40 },
  },
  calories: {
    "5-7":   { mean: 1280, sd: 310  },  // kcal/day
    "8-11":  { mean: 1520, sd: 350  },
    "12-14": { mean: 1820, sd: 400  },
    "15-17": { mean: 2100, sd: 450  },
  },
};

function getAgeGroup(ageYears: number): AgeGroup {
  if (ageYears <= 7)  return "5-7";
  if (ageYears <= 11) return "8-11";
  if (ageYears <= 14) return "12-14";
  return "15-17";
}

// Map dietary questionnaire answers to estimated daily intake values
function getEstimatedIntake(dietary: RawAssessmentInput["dietary"], nutrient: string, ageYears: number): number {
  const answers = dietary.answers ?? [];
  const avgAnswer = answers.length > 0 ? answers.reduce((s: number, v: number) => s + v, 0) / answers.length : 1.5;
  // answers[0]=milk/curd, [1]=dal/legumes, [2]=eggs, [3]=greens, [4]=fruits,
  // [5]=water, [6]=millets, [7]=packaged(inverted), [8]=sunlight, [9]=nuts
  const milkScore    = answers[0] ?? 1.5;
  const dalScore     = answers[1] ?? 1.5;
  const eggScore     = answers[2] ?? 0;
  const greenScore   = answers[3] ?? 1.0;
  const fruitScore   = answers[4] ?? 1.0;
  const waterScore   = answers[5] ?? 1.5;
  const milletScore  = answers[6] ?? 0.5;
  const snackScore   = answers[7] ?? 1.0;  // higher = more processed (negative)
  const sunScore     = answers[8] ?? 1.0;
  const nutScore     = answers[9] ?? 0.5;

  const isOmnivore   = dietary.dietType === "omnivore";
  const isEggetarian = dietary.dietType === "eggetarian";

  switch (nutrient) {
    case "iron": {
      // ICMR: spinach 3.9mg/100g, ragi 3.9mg, lentils 7.6mg, meat ~3mg
      const base = dalScore * 1.8 + greenScore * 1.5 + milletScore * 1.2;
      const meatBoost = isOmnivore ? (dietary.ironRichFoodFrequency ?? 1) * 1.5 : 0;
      const phytateAdj = dietary.spinachAsPrimaryCa ? 0.85 : 1.0;
      const vitCBoost  = fruitScore * 0.3;  // Vit C enhances non-heme absorption
      return (base + meatBoost + vitCBoost) * phytateAdj;
    }
    case "calcium": {
      // ICMR: milk 120mg/100ml, curd 150mg, ragi 344mg/100g, sesame 975mg
      const dairyBase = milkScore * 110 + (dietary.calciumSources?.length ?? 1) * 30;
      const milletBoost = milletScore * 80;
      const spinachAdj = dietary.spinachAsPrimaryCa ? 0.40 : 1.0; // oxalate inhibition
      return (dairyBase + milletBoost) * spinachAdj;
    }
    case "protein": {
      // ICMR: dal 22g/100g, egg 13g, milk 3.4g/100ml
      const plantBase = dalScore * 6 + milkScore * 3.5 + milletScore * 1.5;
      const animalBoost = isOmnivore ? 12 : isEggetarian ? (eggScore * 3) : 0;
      return plantBase + animalBoost + (dietary.proteinSources?.length ?? 1) * 2;
    }
    case "vitaminD": {
      // Dietary vitD very low in Indian diets; sun exposure is primary source
      // Sun score 0=rarely → low synthesis, 3=daily → adequate
      const sunSynthProxy = sunScore * 1.5;  // µg/day equivalent
      const dietaryD = milkScore * 0.4 + (isOmnivore ? 1.5 : 0);
      return sunSynthProxy + dietaryD;
    }
    case "fibre": {
      return dalScore * 2.5 + milletScore * 2.0 + fruitScore * 1.5 + greenScore * 1.2
        - (snackScore > 2 ? 1.5 : 0);  // processed snacks displace fibre
    }
    case "vitaminC": {
      // ICMR: amla 600mg, guava 212mg, orange 63mg
      return fruitScore * 18 + greenScore * 8;
    }
    case "zinc": {
      // Zinc: sesame 7.8mg, pumpkin 7.8mg, meat 4.8mg, lentils 3.3mg
      const base = dalScore * 1.2 + nutScore * 1.5 + milletScore * 0.8;
      const meatBoost = isOmnivore ? 2.5 : 0;
      return base + meatBoost;
    }
    case "b12": {
      // B12 almost exclusively animal-sourced; dairy provides small amounts
      if (isOmnivore)   return 0.5 + eggScore * 0.5 + milkScore * 0.3 + 0.8;
      if (isEggetarian) return eggScore * 0.5 + milkScore * 0.3;
      return milkScore * 0.3;  // vegetarian/vegan — only dairy
    }
    // T2-B: Folate — leafy greens, dal, fruits; ICMR data
    case "folate": {
      // µg/day: spinach 194µg/100g, dal 180µg/100g, orange 30µg
      const base = greenScore * 22 + dalScore * 18 + fruitScore * 8;
      return base + (isOmnivore ? 10 : 0);  // liver adds folate but rare in India
    }
    // T2-B: Omega-3 — primary sources: walnuts, flaxseed, fatty fish, mustard oil
    case "omega3": {
      // g/day estimate: mustard oil (ALA 11%), walnuts 2.5g/28g, flaxseed 6.4g/10g
      const baseALA = nutScore * 0.15 + milletScore * 0.05;  // walnuts + fortified sources
      const fishBoost = isOmnivore ? 0.20 : 0;              // small fish (mackerel, sardine)
      const eggBoost = (isOmnivore || isEggetarian) ? eggScore * 0.03 : 0;
      return baseALA + fishBoost + eggBoost;
    }
    case "calories": {
      // Rough kcal estimate from meal frequency/portion signals
      // NNMB medians are typically ~80% of ICMR RDA for Indian children
      // Scale: 0 answers → 45% of median, 3 answers → 115% of median (above-avg eater)
      const ageGroup = getAgeGroup(ageYears);
      const medianKcal = { "5-7": 1280, "8-11": 1520, "12-14": 1820, "15-17": 2100 }[ageGroup];
      const adequacy = 0.45 + avgAnswer * 0.233;  // 0→45%, 1.5→80% (median), 3→115% of median
      return medianKcal * adequacy;
    }
    default:
      return 50;  // fallback
  }
}

function estimateNutrientPercentile(dietary: RawAssessmentInput["dietary"], nutrient: string, ageYears: number): number {
  const ageGroup = getAgeGroup(ageYears);
  const medians = NUTRIENT_INDIAN_MEDIANS[nutrient];
  if (!medians) return 50;
  const { mean, sd } = medians[ageGroup];
  const estimated = getEstimatedIntake(dietary, nutrient, ageYears);
  return rawToPercentile(estimated, mean, sd);
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 2: Multi-Factor Sigmoid Risk Score
// ═══════════════════════════════════════════════════════════════════════════

export function computeRiskScores(percentiles: DomainPercentiles): Record<string, number> {
  const risks: Record<string, number> = {};

  // T3-D helper: clamp before logit to prevent distortion at extremes
  const safeLogit = (pct: number) => {
    const c = Math.max(1, Math.min(99, pct));
    return Math.log((101 - c) / (c + 1));
  };

  // Physical risk
  const physWeights = { balance: 0.2, coordination: 0.2, strength: 0.2, endurance: 0.25, flexibility: 0.15 };
  const physLogit = Object.entries(physWeights).reduce(
    (sum, [key, w]) => sum + w * safeLogit((percentiles.physical as any)[key]),
    0
  );
  risks["physical_risk"] = Math.round(sigmoid(physLogit) * 100);

  // Cognitive risk
  const cogWeights = { reactionTime: 0.15, workingMemory: 0.2, fluidReasoning: 0.15, sustainedAttention: 0.2, processingSpeed: 0.15, emotionRecognition: 0.15 };
  const cogLogit = Object.entries(cogWeights).reduce(
    (sum, [key, w]) => sum + w * safeLogit((percentiles.cognitive as any)[key]),
    0
  );
  risks["cognitive_risk"] = Math.round(sigmoid(cogLogit) * 100);

  // Nutritional risk — T3-A: added folate (0.08) and omega3 (0.07), weights rebalanced proportionally
  // T3-D: clamp percentile to [1,99] before logit to prevent edge-case distortion
  const nutWeights = { iron: 0.17, calcium: 0.13, protein: 0.17, vitaminD: 0.13, fibre: 0.09, vitaminC: 0.09, zinc: 0.04, b12: 0.04, folate: 0.08, omega3: 0.06 };
  const nutLogit = Object.entries(nutWeights).reduce(
    (sum, [key, w]) => {
      const pct = Math.max(1, Math.min(99, (percentiles.dietary as any)[key] ?? 50));
      return sum + w * Math.log((101 - pct) / (pct + 1));
    },
    0
  );
  risks["nutritional_risk"] = Math.round(sigmoid(nutLogit) * 100);

  // Psychosocial risk (T3-D: safeLogit applied)
  const psyWeights = { anxiety: 0.2, stress: 0.2, emotionalWellbeing: 0.2, socialSafety: 0.15, resilience: 0.15, screenTime: 0.1 };
  const psyLogit = Object.entries(psyWeights).reduce(
    (sum, [key, w]) => sum + w * safeLogit((percentiles.psychosocial as any)[key]),
    0
  );
  risks["psychosocial_risk"] = Math.round(sigmoid(psyLogit) * 100);

  // Overall risk
  risks["overall_risk"] = Math.round(
    (risks["physical_risk"] * 0.25 + risks["cognitive_risk"] * 0.25 +
     risks["nutritional_risk"] * 0.30 + risks["psychosocial_risk"] * 0.20)
  );

  return risks;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 3: Bayesian Posterior Inference (Sequential Bayes)
// ═══════════════════════════════════════════════════════════════════════════

export function computeBayesianPosteriors(
  input: RawAssessmentInput,
  percentiles: DomainPercentiles,
  environmentalMods: Record<string, number>
): BayesianPosterior[] {
  const { profile } = input;
  const ageGroup = profile.ageYears <= 10 ? "5-10" : profile.ageYears <= 14 ? "11-14" : "15-17";

  return BAYESIAN_PRIORS.map(priorDef => {
    let prior = priorDef.basePrior;

    // Apply modifiers
    prior *= priorDef.genderModifier[profile.gender];
    prior *= priorDef.cityTierModifier[profile.cityTier];
    prior *= priorDef.ageGroupModifier[ageGroup];

    // Apply environmental context modifiers
    const envKey = priorDef.condition.replace("_", "");
    if (environmentalMods[envKey]) {
      prior *= environmentalMods[envKey];
    }

    // T2-A: Apply age-stratified critical-window multiplier to iron_deficiency and b12/cognition priors
    if (priorDef.condition === "iron_deficiency") {
      const critWindowMultiplier = getPathwayMultiplier("iron→cognition", profile.ageYears);
      prior = Math.min(0.95, prior * Math.min(1.5, (critWindowMultiplier - 1.0) * 0.3 + 1.0));
    }

    prior = Math.min(0.95, Math.max(0.01, prior));

    // Compute evidence from percentile scores
    const evidence = computeEvidenceForCondition(priorDef.condition, percentiles, input);
    const sensitivity = (priorDef.sensitivityRange[0] + priorDef.sensitivityRange[1]) / 2;
    const specificity = (priorDef.specificityRange[0] + priorDef.specificityRange[1]) / 2;

    // Sequential Bayes: P(D|E) = P(E|D) * P(D) / P(E)
    const pEgivenD = evidence ? sensitivity : (1 - sensitivity);
    const pEgivenNotD = evidence ? (1 - specificity) : specificity;
    const pE = pEgivenD * prior + pEgivenNotD * (1 - prior);
    const posterior = (pEgivenD * prior) / pE;

    return {
      condition: priorDef.condition,
      prior: Math.round(prior * 100) / 100,
      posterior: Math.round(posterior * 100) / 100,
      evidenceStrength: Math.round(Math.abs(posterior - prior) * 100) / 100,
    };
  });
}

function computeEvidenceForCondition(
  condition: string,
  percentiles: DomainPercentiles,
  input: RawAssessmentInput
): boolean {
  switch (condition) {
    case "iron_deficiency":
      return percentiles.dietary.iron < 45 || percentiles.physical.endurance < 40;
    case "vitamin_d_deficiency":
      return percentiles.dietary.vitaminD < 45;
    case "calcium_deficiency":
      return percentiles.dietary.calcium < 45;
    case "protein_deficiency":
      return percentiles.dietary.protein < 40;
    case "stunting_risk":
      return percentiles.physical.heightForAge < 15 && percentiles.dietary.protein < 40;
    case "obesity_risk":
      return percentiles.physical.bmi > 85; // IAP: >85th pct = overweight, triggers metabolic risk
    case "adhd_pattern":
      return percentiles.cognitive.sustainedAttention < 35 && percentiles.cognitive.reactionTime < 40;
    case "anxiety_disorder":
      return percentiles.psychosocial.anxiety < 35 && percentiles.psychosocial.stress < 40;
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 4: Monte Carlo Confidence Estimation
// ═══════════════════════════════════════════════════════════════════════════

// Domain-specific sigma values based on assessment modality reliability
const DOMAIN_SIGMA: Record<string, number> = {
  physical: 8.7,    // CV-based, high reliability
  cognitive: 9.1,   // game-based, moderate noise
  dietary: 11.3,    // self-report, higher noise
  psychosocial: 11.8, // self-report, highest noise
};

function getSigmaForMetric(metric: string): number {
  const prefix = metric.split("_")[0];
  return DOMAIN_SIGMA[prefix] ?? 8;
}

export function computeMonteCarloConfidence(
  percentiles: DomainPercentiles,
  iterations: number = 500,
): MonteCarloResult[] {
  const results: MonteCarloResult[] = [];
  const allMetrics = extractAllMetrics(percentiles);

  for (const [metric, baseValue] of Object.entries(allMetrics)) {
    const sigma = getSigmaForMetric(metric);
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      samples.push(Math.max(1, Math.min(99, gaussianRandom(baseValue, sigma))));
    }
    samples.sort((a, b) => a - b);

    results.push({
      metric,
      p5: Math.round(samples[Math.floor(iterations * 0.05)]),
      p25: Math.round(samples[Math.floor(iterations * 0.25)]),
      p75: Math.round(samples[Math.floor(iterations * 0.75)]),
      p95: Math.round(samples[Math.floor(iterations * 0.95)]),
      robustnessScore: Math.round((1 - (samples[Math.floor(iterations * 0.95)] - samples[Math.floor(iterations * 0.05)]) / 100) * 100),
    });
  }

  return results;
}

function extractAllMetrics(p: DomainPercentiles): Record<string, number> {
  return {
    ...Object.fromEntries(Object.entries(p.physical).map(([k, v]) => [`physical_${k}`, v])),
    ...Object.fromEntries(Object.entries(p.cognitive).map(([k, v]) => [`cognitive_${k}`, v])),
    ...Object.fromEntries(Object.entries(p.dietary).map(([k, v]) => [`dietary_${k}`, v])),
    ...Object.fromEntries(Object.entries(p.psychosocial).map(([k, v]) => [`psychosocial_${k}`, v])),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 5: PageRank Leverage Scoring
// ═══════════════════════════════════════════════════════════════════════════

// T3-C: evidence level → edge weight mapping
const EVIDENCE_WEIGHTS: Record<string, number> = {
  L1: 1.0,   // L1_RCT
  L2: 0.7,   // L2_Cohort
  L3: 0.4,   // L3_CrossSectional / L3_Expert
  L4: 0.25,  // L4_Mechanistic
};

// T3-C: 20 iterations for convergence; weight edges by evidenceLevel
export function computePageRankScores(iterations: number = 20): PageRankScores {
  // Build adjacency matrix from biological pathways
  const nodes = new Set<string>();
  const edges: Array<{ source: string; target: string; weight: number }> = [];

  for (const pathway of BIOLOGICAL_PATHWAYS) {
    // T3-C: derive edge weight from pathway evidenceLevel
    const evidenceCode = (pathway.evidenceLevel as string)?.split("_")[0] ?? "L3";
    const edgeWeight = EVIDENCE_WEIGHTS[evidenceCode] ?? 0.4;

    const chain = [pathway.sourceNode, ...pathway.mediators, pathway.targetNode];
    for (let i = 0; i < chain.length - 1; i++) {
      nodes.add(chain[i]);
      nodes.add(chain[i + 1]);
      edges.push({ source: chain[i], target: chain[i + 1], weight: edgeWeight });
    }
  }

  // Add intervention template targets
  for (const tmpl of INTERVENTION_TEMPLATES) {
    for (const target of tmpl.targetNodes) {
      nodes.add(target);
    }
  }

  const nodeList = Array.from(nodes);
  const n = nodeList.length;
  const nodeIndex: Record<string, number> = {};
  nodeList.forEach((node, i) => { nodeIndex[node] = i; });

  // Initialize PageRank
  const damping = 0.85;
  let rank = new Array(n).fill(1 / n);
  // T3-C: weighted out-strength (sum of edge weights per source node)
  const outStrength = new Array(n).fill(0);

  for (const edge of edges) {
    const srcIdx = nodeIndex[edge.source];
    if (srcIdx !== undefined) outStrength[srcIdx] += edge.weight;
  }

  // Power iteration — T3-C: 20 iterations; weight edges by evidence level
  for (let iter = 0; iter < iterations; iter++) {
    const newRank = new Array(n).fill((1 - damping) / n);
    for (const edge of edges) {
      const srcIdx = nodeIndex[edge.source];
      const tgtIdx = nodeIndex[edge.target];
      if (srcIdx !== undefined && tgtIdx !== undefined && outStrength[srcIdx] > 0) {
        newRank[tgtIdx] += damping * rank[srcIdx] * (edge.weight / outStrength[srcIdx]);
      }
    }
    rank = newRank;
  }

  const scores: PageRankScores = {};
  nodeList.forEach((node, i) => {
    scores[node] = Math.round(rank[i] * 10000) / 10000;
  });

  return scores;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 6: Exponential Saturation Model
// ═══════════════════════════════════════════════════════════════════════════

export function computeSaturationProjections(
  percentiles: DomainPercentiles,
  interventions: string[]
): SaturationProjection[] {
  const projections: SaturationProjection[] = [];

  for (const intervention of interventions) {
    const template = INTERVENTION_TEMPLATES.find(t => t.id === intervention);
    if (!template) continue;

    const targetNode = template.pageRankTarget;
    const k = SATURATION_K_RATES[targetNode] || 0.10;
    const baseScore = getPercentileForNode(percentiles, targetNode);
    const maxGain = Math.min(40, 95 - baseScore); // Asymptotic ceiling
    const A = maxGain;

    const weekly: number[] = [];
    for (let w = 1; w <= 24; w++) {
      weekly.push(Math.round(baseScore + A * (1 - Math.exp(-k * w))));
    }

    projections.push({
      domain: template.domain,
      intervention: template.title,
      weeklyProjection: weekly,
      expectedGainPercent: Math.round(A * (1 - Math.exp(-k * 24))),
      kRate: k,
    });
  }

  return projections;
}

function getPercentileForNode(p: DomainPercentiles, node: string): number {
  const allMetrics: Record<string, number> = {
    balance: p.physical.balance, coordination: p.physical.coordination,
    strength: p.physical.strength, endurance: p.physical.endurance,
    flexibility: p.physical.flexibility,
    reactionTime: p.cognitive.reactionTime, workingMemory: p.cognitive.workingMemory,
    fluidReasoning: p.cognitive.fluidReasoning, sustainedAttention: p.cognitive.sustainedAttention,
    processingSpeed: p.cognitive.processingSpeed, emotionRecognition: p.cognitive.emotionRecognition,
    iron: p.dietary.iron, calcium: p.dietary.calcium, protein: p.dietary.protein,
    vitaminD: p.dietary.vitaminD, fibre: p.dietary.fibre, vitaminC: p.dietary.vitaminC,
    zinc: p.dietary.zinc, b12: p.dietary.b12,
    anxiety: p.psychosocial.anxiety, stress: p.psychosocial.stress,
    emotionalWellbeing: p.psychosocial.emotionalWellbeing,
    socialSafety: p.psychosocial.socialSafety, resilience: p.psychosocial.resilience,
    screenTime: p.psychosocial.screenTime,
    sleep: (p.psychosocial.stress + p.psychosocial.emotionalWellbeing) / 2,
  };
  return allMetrics[node] ?? 50;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 7: Nutrient Interaction Matrix
// ═══════════════════════════════════════════════════════════════════════════

export function computeNutrientInteractions(
  percentiles: DomainPercentiles
): NutrientInteraction[] {
  const interactions: NutrientInteraction[] = [];
  // T2-B: Include folate and omega3 in the interaction matrix
  const nutrients = ["iron", "calcium", "vitC", "vitD", "zinc", "protein", "fibre", "b12", "folate", "omega3"];
  const nutPercentiles: Record<string, number> = {
    iron: percentiles.dietary.iron, calcium: percentiles.dietary.calcium,
    vitC: percentiles.dietary.vitaminC, vitD: percentiles.dietary.vitaminD,
    zinc: percentiles.dietary.zinc, protein: percentiles.dietary.protein,
    fibre: percentiles.dietary.fibre, b12: percentiles.dietary.b12,
    folate: (percentiles.dietary as any).folate ?? 50,
    omega3: (percentiles.dietary as any).omega3 ?? 50,
  };

  for (let i = 0; i < nutrients.length; i++) {
    for (let j = i + 1; j < nutrients.length; j++) {
      const n1 = nutrients[i], n2 = nutrients[j];
      const coeff = NUTRIENT_INTERACTION_MATRIX[n1]?.[n2] || 0;
      if (Math.abs(coeff) > 0.05) {
        const baseEfficacy = (nutPercentiles[n1] + nutPercentiles[n2]) / 2;
        interactions.push({
          nutrientPair: [n1, n2],
          interactionType: coeff > 0 ? "synergy" : "antagonism",
          coefficient: coeff,
          adjustedEfficacy: Math.round(baseEfficacy * (1 + coeff * 0.1)),
        });
      }
    }
  }

  return interactions;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 8: Developmental Age Algorithm
// ═══════════════════════════════════════════════════════════════════════════

export function computeDevelopmentalAge(
  percentiles: DomainPercentiles,
  profile: RawAssessmentInput["profile"]
): DevelopmentalAgeResult[] {
  const chronoMonths = profile.ageYears * 12 + profile.ageMonths;
  const domains = [
    { name: "physical", composite: percentiles.physical.composite },
    { name: "cognitive", composite: percentiles.cognitive.composite },
    { name: "nutritional_growth", composite: (percentiles.physical.heightForAge + percentiles.dietary.composite) / 2 },
    { name: "psychosocial", composite: percentiles.psychosocial.composite },
  ];

  return domains.map(d => {
    // Developmental age approximation: chronological age adjusted by percentile deviation
    const deviation = (d.composite - 50) / 50;  // -1 to +1
    const devAgeMonths = Math.round(chronoMonths * (1 + deviation * 0.15));
    return {
      domain: d.name,
      developmentalAgeMonths: devAgeMonths,
      chronologicalAgeMonths: chronoMonths,
      deltaMonths: devAgeMonths - chronoMonths,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 9: Developmental Velocity
// ═══════════════════════════════════════════════════════════════════════════

export function computeDevelopmentalVelocity(
  currentPercentiles: DomainPercentiles,
  previousSessions: AssessmentSession[]
): VelocityResult[] {
  if (!previousSessions.length) return [];

  const lastSession = previousSessions[previousSessions.length - 1];
  const lastP = lastSession.percentiles;

  const metrics = [
    { name: "physical_composite", current: currentPercentiles.physical.composite, previous: lastP.physical.composite },
    { name: "cognitive_composite", current: currentPercentiles.cognitive.composite, previous: lastP.cognitive.composite },
    { name: "dietary_composite", current: currentPercentiles.dietary.composite, previous: lastP.dietary.composite },
    { name: "psychosocial_composite", current: currentPercentiles.psychosocial.composite, previous: lastP.psychosocial.composite },
    { name: "balance", current: currentPercentiles.physical.balance, previous: lastP.physical.balance },
    { name: "endurance", current: currentPercentiles.physical.endurance, previous: lastP.physical.endurance },
    { name: "attention", current: currentPercentiles.cognitive.sustainedAttention, previous: lastP.cognitive.sustainedAttention },
    { name: "iron", current: currentPercentiles.dietary.iron, previous: lastP.dietary.iron },
    { name: "emotionalWellbeing", current: currentPercentiles.psychosocial.emotionalWellbeing, previous: lastP.psychosocial.emotionalWellbeing },
  ];

  return metrics.map(m => {
    const delta = m.current - m.previous;
    const direction: VelocityDirection =
      delta > 5 ? VelocityDirection.Improving :
      delta < -5 ? VelocityDirection.Declining :
      VelocityDirection.Stable;

    return {
      metric: m.name,
      direction,
      magnitude: Math.abs(delta),
      confidence: Math.min(1, Math.abs(delta) / 20),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 10: Tri-Vector Convergence
// ═══════════════════════════════════════════════════════════════════════════

export function computeConvergenceScore(percentiles: DomainPercentiles): ConvergenceScore {
  const phys = percentiles.physical.composite;
  const cog = percentiles.cognitive.composite;
  const nut = percentiles.dietary.composite;

  // Weighted geometric mean
  const weights = { physical: 0.30, cognitive: 0.35, nutrition: 0.35 };
  const geometricMean = Math.pow(
    Math.pow(Math.max(1, phys), weights.physical) *
    Math.pow(Math.max(1, cog), weights.cognitive) *
    Math.pow(Math.max(1, nut), weights.nutrition),
    1 / (weights.physical + weights.cognitive + weights.nutrition)
  );

  // Cross-domain correlation (simplified: measure dispersion)
  const mean = (phys + cog + nut) / 3;
  const variance = ((phys - mean) ** 2 + (cog - mean) ** 2 + (nut - mean) ** 2) / 3;
  const correlation = Math.max(0, 1 - Math.sqrt(variance) / 30);

  const score = Math.round(geometricMean * 0.7 + correlation * 30);

  return {
    score: Math.min(100, Math.max(0, score)),
    physicalContribution: phys,
    cognitiveContribution: cog,
    nutritionContribution: nut,
    crossDomainCorrelation: Math.round(correlation * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 11: Environmental Context Modifiers
// ═══════════════════════════════════════════════════════════════════════════

export function computeEnvironmentalModifiers(
  input: RawAssessmentInput
): Record<string, number> {
  const { profile, dietary } = input;
  const modifiers: Record<string, number> = {};

  // City tier modifiers
  const tierMods = CITY_TIER_RISK_MODIFIERS[profile.cityTier];
  Object.entries(tierMods).forEach(([k, v]) => { modifiers[k] = v; });

  // Diet type modifiers
  const dietMods = DIET_TYPE_MODIFIERS[dietary.dietType] || {};
  Object.entries(dietMods).forEach(([k, v]) => {
    modifiers[k] = (modifiers[k] || 1.0) * v;
  });

  // Season modifier for Vitamin D
  const sunExposure = SUN_EXPOSURE_PROXY[profile.cityTier]?.[profile.season] || "medium";
  modifiers["vitDSunFactor"] = sunExposure === "high" ? 0.80 : sunExposure === "low" ? 1.30 : 1.0;

  return modifiers;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 12: Longitudinal Trend Analysis
// ═══════════════════════════════════════════════════════════════════════════

export function computeLongitudinalTrends(
  previousSessions: AssessmentSession[]
): VelocityResult[] {
  if (previousSessions.length < 2) return [];

  const metrics = ["physical_composite", "cognitive_composite", "dietary_composite", "psychosocial_composite"];
  const results: VelocityResult[] = [];

  for (const metric of metrics) {
    const values = previousSessions.map((s, i) => {
      const p = s.percentiles;
      switch (metric) {
        case "physical_composite": return p.physical.composite;
        case "cognitive_composite": return p.cognitive.composite;
        case "dietary_composite": return p.dietary.composite;
        case "psychosocial_composite": return p.psychosocial.composite;
        default: return 50;
      }
    });

    // Linear regression
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let ssxy = 0, ssxx = 0;
    for (let i = 0; i < n; i++) {
      ssxy += (i - xMean) * (values[i] - yMean);
      ssxx += (i - xMean) ** 2;
    }
    const slope = ssxx > 0 ? ssxy / ssxx : 0;
    const yPred = values.map((_, i) => yMean + slope * (i - xMean));
    const ssTot = values.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const ssRes = values.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    results.push({
      metric,
      direction: slope > 2 ? VelocityDirection.Improving : slope < -2 ? VelocityDirection.Declining : VelocityDirection.Stable,
      magnitude: Math.round(Math.abs(slope) * 10) / 10,
      confidence: Math.round(r2 * 100) / 100,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 13: Phenotypic Cluster Classifier (KNN)
// ═══════════════════════════════════════════════════════════════════════════

export function classifyPhenotype(percentiles: DomainPercentiles): PhenotypicProfile {
  // Build 12-dimensional vector from percentile space
  const vector = [
    percentiles.physical.balance, percentiles.physical.coordination,
    percentiles.physical.strength, percentiles.physical.endurance,
    percentiles.physical.flexibility,
    percentiles.cognitive.composite, percentiles.cognitive.workingMemory,
    percentiles.cognitive.fluidReasoning,
    percentiles.dietary.iron, percentiles.dietary.calcium,
    percentiles.psychosocial.anxiety, percentiles.psychosocial.resilience,
  ];

  // KNN: compute Euclidean distance to each profile centroid
  let bestProfile = PHENOTYPE_PROFILES[0];
  let bestDist = Infinity;

  for (const profile of PHENOTYPE_PROFILES) {
    const dist = Math.sqrt(
      profile.centroid.reduce((sum, c, i) => sum + (c - vector[i]) ** 2, 0)
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestProfile = profile;
    }
  }

  // Confidence based on distance (closer = more confident)
  const maxDist = Math.sqrt(12 * 100 ** 2); // max possible distance
  const confidence = Math.round((1 - bestDist / maxDist) * 100) / 100;

  return {
    profileId: bestProfile.id,
    name: bestProfile.name,
    confidence,
    signaturePattern: bestProfile.signaturePattern,
    primaryRisk: bestProfile.primaryRisk,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 14: Reliability-Weighted Fusion (Latent Health Score)
// ═══════════════════════════════════════════════════════════════════════════

export function computeLatentHealthScore(
  percentiles: DomainPercentiles,
  completionRates: Record<string, number> = { physical: 1, cognitive: 1, dietary: 1, psychosocial: 1 }
): LatentHealthScore {
  const weights: ReliabilityWeights = {
    physical: DOMAIN_RELIABILITY_WEIGHTS.physical * (completionRates.physical < 1 ? INCOMPLETE_RELIABILITY_PENALTY : 1),
    cognitive: DOMAIN_RELIABILITY_WEIGHTS.cognitive * (completionRates.cognitive < 1 ? INCOMPLETE_RELIABILITY_PENALTY : 1),
    dietary: DOMAIN_RELIABILITY_WEIGHTS.dietary * (completionRates.dietary < 1 ? INCOMPLETE_RELIABILITY_PENALTY : 1),
    psychosocial: DOMAIN_RELIABILITY_WEIGHTS.psychosocial * (completionRates.psychosocial < 1 ? INCOMPLETE_RELIABILITY_PENALTY : 1),
  };

  const totalWeight = weights.physical + weights.cognitive + weights.dietary + weights.psychosocial;
  const lhs = Math.round(
    (weights.physical * percentiles.physical.composite +
     weights.cognitive * percentiles.cognitive.composite +
     weights.dietary * percentiles.dietary.composite +
     weights.psychosocial * percentiles.psychosocial.composite) / totalWeight
  );

  return {
    lhs,
    domainContributions: {
      physical: Math.round(weights.physical * percentiles.physical.composite / totalWeight),
      cognitive: Math.round(weights.cognitive * percentiles.cognitive.composite / totalWeight),
      dietary: Math.round(weights.dietary * percentiles.dietary.composite / totalWeight),
      psychosocial: Math.round(weights.psychosocial * percentiles.psychosocial.composite / totalWeight),
    },
    reliabilityWeights: weights,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 15: Causal Mediation Decomposition
// ═══════════════════════════════════════════════════════════════════════════

export function computeCausalMediation(
  percentiles: DomainPercentiles,
  bayesianPosteriors: BayesianPosterior[],
  ageYears: number = 8
): MediationResult[] {
  const results: MediationResult[] = [];

  // ── pathway key → AGE_STRATIFIED_PATHWAY_WEIGHTS key ────────────────────
  const PATHWAY_AGE_KEYS: Record<string, string> = {
    BP01: "iron→cognition",   // Iron-Dopamine-Cognition
    BP08: "iron→cognition",   // Iron-Haemoglobin-Endurance (iron critical window applies)
    BP10: "omega3→neural",    // Omega3-Inflammation-Cognition
    BP03: "calcium→bone",     // Calcium-Vestibular-Balance
    BP04: "calcium→bone",     // VitaminD-Calcium-Bone-Strength
    BP07: "protein→muscle",   // Protein-mTOR-Muscle
    BP14: "b12→cognition",    // B12-Myelin-ProcessingSpeed
  };

  // Evaluate each biological pathway for mediation
  for (const pathway of BIOLOGICAL_PATHWAYS) {
    const sourceScore = getPercentileForNode(percentiles, pathway.sourceNode);

    // Only analyze if source is deficient
    if (sourceScore >= 50) continue;

    // Simplified linear mediation: IE = a × b
    const a = (50 - sourceScore) / 50;  // Source deficit magnitude (0-1)

    // T2-A: Apply age-stratified multiplier to pathway coefficient b
    const pathwayKey = PATHWAY_AGE_KEYS[pathway.id];
    const ageMultiplier = pathwayKey ? getPathwayMultiplier(pathwayKey, ageYears) : 1.0;
    const b = (0.5 + (50 - sourceScore) / 100 * 0.3) * ageMultiplier; // Baron & Kenny × critical-window

    const directEffect = a * 0.3;
    const indirectEffect = a * b;
    const totalEffect = directEffect + indirectEffect;
    const mediationRatio = totalEffect > 0 ? indirectEffect / totalEffect : 0;

    results.push({
      pathId: pathway.id,
      xVariable: pathway.sourceNode,
      yVariable: pathway.targetNode,
      mediator: pathway.mediators.join(" → "),
      directEffect: Math.round(directEffect * 100) / 100,
      indirectEffect: Math.round(indirectEffect * 100) / 100,
      totalEffect: Math.round(totalEffect * 100) / 100,
      mediationRatio: Math.round(mediationRatio * 100) / 100,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 16: Anomaly Velocity Detector
// ═══════════════════════════════════════════════════════════════════════════

export function detectAnomalyVelocity(
  currentPercentiles: DomainPercentiles,
  previousSessions: AssessmentSession[]
): AnomalyVelocityAlert[] {
  if (previousSessions.length < 1) return [];

  const alerts: AnomalyVelocityAlert[] = [];
  const lastP = previousSessions[previousSessions.length - 1].percentiles;

  const metricsToCheck = [
    { name: "physical_composite", current: currentPercentiles.physical.composite, previous: lastP.physical.composite },
    { name: "cognitive_composite", current: currentPercentiles.cognitive.composite, previous: lastP.cognitive.composite },
    { name: "dietary_composite", current: currentPercentiles.dietary.composite, previous: lastP.dietary.composite },
    { name: "psychosocial_composite", current: currentPercentiles.psychosocial.composite, previous: lastP.psychosocial.composite },
  ];

  // Cohort mean/SD of change (default estimates)
  const cohortMeanDelta = 3;
  const cohortSDDelta = 6;

  for (const m of metricsToCheck) {
    const delta = m.current - m.previous;
    const zVel = (delta - cohortMeanDelta) / cohortSDDelta;

    if (Math.abs(zVel) > ANOMALY_VELOCITY_Z_THRESHOLD) {
      alerts.push({
        metric: m.name,
        zVelocity: Math.round(zVel * 100) / 100,
        type: zVel > 0 ? "rapid_improvement" : "rapid_decline",
        reviewRequired: true,
      });
    }
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 17: Bioavailability-Corrected Nutrient Score
// ═══════════════════════════════════════════════════════════════════════════

export function computeBioavailabilityScores(
  input: RawAssessmentInput,
  rawPercentiles: DomainPercentiles
): Record<string, number> {
  const { dietary, profile } = input;
  const corrected: Record<string, number> = {};

  // Iron: phytate inhibition for vegetarian/vegan/jain
  let ironCorrection = 1.0;
  if ([DietType.Vegetarian, DietType.Vegan, DietType.Jain].includes(dietary.dietType)) {
    const phytateFactor = BIOAVAILABILITY_CORRECTIONS.phytateIronInhibition;
    ironCorrection = phytateFactor.min + (phytateFactor.max - phytateFactor.min) *
      (dietary.legumeDays / 7);
  }
  // Vit C enhancement
  const vitCEnhance = dietary.vitCIntake > 50 ? BIOAVAILABILITY_CORRECTIONS.vitCIronEnhancement : 1.0;
  corrected["iron"] = Math.round(rawPercentiles.dietary.iron * ironCorrection * Math.min(vitCEnhance, 1.5));

  // Calcium: oxalate inhibition for spinach-primary sources
  let caCorrection = 1.0;
  if (dietary.spinachAsPrimaryCa) {
    caCorrection = BIOAVAILABILITY_CORRECTIONS.oxalateCalciumInhibition;
  }
  // Vit D cofactor for calcium
  const sunProxy = SUN_EXPOSURE_PROXY[profile.cityTier]?.[profile.season] || "medium";
  const vitDFactor = BIOAVAILABILITY_CORRECTIONS.vitDCalciumAbsorption[sunProxy];
  corrected["calcium"] = Math.round(rawPercentiles.dietary.calcium * caCorrection * Math.min(vitDFactor, 1.4));

  // Other nutrients pass through with minor adjustments
  corrected["protein"] = rawPercentiles.dietary.protein;
  corrected["vitaminD"] = Math.round(rawPercentiles.dietary.vitaminD * (sunProxy === "low" ? 0.7 : sunProxy === "high" ? 1.2 : 1.0));
  corrected["fibre"] = rawPercentiles.dietary.fibre;
  corrected["vitaminC"] = rawPercentiles.dietary.vitaminC;
  corrected["zinc"] = rawPercentiles.dietary.zinc;

  // T3-B: B12 bioavailability — vegetarian/vegan absorb B12 only from dairy (intrinsic factor limit)
  // B12 from dairy has ~50% lower bioavailability than animal-source B12 (Watanabe 2007)
  {
    const isVegetarianOrVegan = [DietType.Vegetarian, DietType.Vegan, DietType.Jain].includes(dietary.dietType);
    const b12BioCorrection = isVegetarianOrVegan ? 0.55 : 1.0;
    corrected["b12"] = Math.round(rawPercentiles.dietary.b12 * b12BioCorrection);
  }

  // T3-B: Folate — heat/cooking destroys ~25% of folate in Indian cooking (boiling, pressure-cooking)
  // ICMR: leafy greens lose 20-40% folate on cooking; dal retains ~75%. Apply 0.75 correction.
  {
    const folateBioCorrection = 0.75;
    const rawFolate = (rawPercentiles.dietary as any).folate ?? 50;
    corrected["folate"] = Math.round(rawFolate * folateBioCorrection);
  }

  // T3-B: Omega-3 — ALA→EPA/DHA conversion efficiency in children is only 5–15%
  // (Innis 2008; EFSA 2012): dietary ALA percentile overstates functional omega-3 availability
  // Apply 0.10 conversion factor (conservative midpoint). Pre-formed EPA/DHA (fish) is 1.0.
  {
    const rawOmega3 = (rawPercentiles.dietary as any).omega3 ?? 50;
    const isOmnivore = dietary.dietType === DietType.Omnivore;
    // Omnivores: ~30% of their omega-3 comes from pre-formed EPA/DHA; rest is ALA
    const conversionFactor = isOmnivore ? (0.30 * 1.0 + 0.70 * 0.10) : 0.10;
    corrected["omega3"] = Math.round(rawOmega3 * conversionFactor);
  }

  return corrected;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 18: Sleep Deprivation Proxy Index
// ═══════════════════════════════════════════════════════════════════════════

export function computeSleepProxy(
  percentiles: DomainPercentiles,
  cognitive: RawAssessmentInput["cognitive"]
): SleepProxyScore {
  const rtScore = (100 - percentiles.cognitive.reactionTime) / 100; // Higher RT = worse
  const enduranceScore = percentiles.physical.endurance / 100;
  const emotionalScore = percentiles.psychosocial.emotionalWellbeing / 100;
  const attentionScore = percentiles.cognitive.sustainedAttention / 100;

  const sleepScore = Math.round(
    (SLEEP_PROXY_LOADINGS.reactionTime * rtScore +
     SLEEP_PROXY_LOADINGS.endurance * enduranceScore +
     SLEEP_PROXY_LOADINGS.emotional * emotionalScore +
     SLEEP_PROXY_LOADINGS.attention * attentionScore + 1) * 50
  );

  const clamped = Math.max(0, Math.min(100, sleepScore));

  return {
    score: clamped,
    isSleepInadequate: clamped < SLEEP_INADEQUACY_THRESHOLD,
    componentScores: {
      reactionTime: Math.round(rtScore * 100),
      endurance: Math.round(enduranceScore * 100),
      emotional: Math.round(emotionalScore * 100),
      attention: Math.round(attentionScore * 100),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 19: Resilience-to-Risk Ratio
// ═══════════════════════════════════════════════════════════════════════════

export function computeResilienceRiskRatio(
  percentiles: DomainPercentiles,
  psychosocial: RawAssessmentInput["psychosocial"]
): ResilienceRiskRatio {
  const protectiveFactors = [
    { value: percentiles.psychosocial.socialSafety, weight: 0.3 },
    { value: percentiles.psychosocial.resilience, weight: 0.3 },
    { value: percentiles.physical.composite, weight: 0.2 },
    { value: Math.min(100, 100 - psychosocial.screenTimeHoursPerDay * 10), weight: 0.2 },
  ];

  const riskFactors = [
    { value: 100 - percentiles.psychosocial.anxiety, weight: 0.3 },
    { value: 100 - percentiles.psychosocial.socialSafety, weight: 0.2 },
    { value: psychosocial.screenTimeHoursPerDay * 15, weight: 0.25 },
    { value: Math.max(0, 100 - percentiles.dietary.composite), weight: 0.25 },
  ];

  const protectiveScore = protectiveFactors.reduce((s, f) => s + f.value * f.weight, 0);
  const riskScore = Math.max(1, riskFactors.reduce((s, f) => s + f.value * f.weight, 0));
  const ri = Math.round((protectiveScore / riskScore) * 100) / 100;

  return {
    ri,
    protectiveScore: Math.round(protectiveScore),
    riskScore: Math.round(riskScore),
    classification: ri > RESILIENCE_HIGH_THRESHOLD ? "high_resilience" :
      ri < RESILIENCE_VULNERABILITY_THRESHOLD ? "vulnerability_amplification" : "moderate",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 20: Compensatory Performance Detector
// ═══════════════════════════════════════════════════════════════════════════

export function detectCompensatoryPattern(
  percentiles: DomainPercentiles,
  lhs: number
): CompensatoryPattern {
  const domains = [
    { name: "physical", score: percentiles.physical.composite },
    { name: "cognitive", score: percentiles.cognitive.composite },
    { name: "dietary", score: percentiles.dietary.composite },
    { name: "psychosocial", score: percentiles.psychosocial.composite },
  ];

  const deviations = domains.map(d => ({
    ...d,
    deviation: d.score - lhs,
  }));

  const maxDev = deviations.reduce((best, d) => d.deviation > best.deviation ? d : best, deviations[0]);
  const minDev = deviations.reduce((worst, d) => d.deviation < worst.deviation ? d : worst, deviations[0]);

  const detected = maxDev.deviation > COMPENSATORY_HIGH_THRESHOLD && minDev.deviation < COMPENSATORY_LOW_THRESHOLD;

  return {
    detected,
    strongDomain: maxDev.name,
    strongScore: maxDev.score,
    weakDomain: minDev.name,
    weakScore: minDev.score,
    deviationSpread: Math.round(maxDev.deviation - minDev.deviation),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 21: Dynamic Bayesian Network Belief Propagation
// ═══════════════════════════════════════════════════════════════════════════

export function propagateDBNBeliefs(
  currentPosteriors: BayesianPosterior[],
  previousSessions: AssessmentSession[],
  sessionNumber: number
): DBNBeliefState {
  if (previousSessions.length === 0 || sessionNumber <= 1) {
    // First session — use population priors
    const conditions: Record<string, number> = {};
    for (const p of currentPosteriors) {
      conditions[p.condition] = p.posterior;
    }
    return { conditions, sessionNumber, priorSource: "population" };
  }

  // Propagate: use previous session's posteriors as new priors
  const lastSession = previousSessions[previousSessions.length - 1];
  const previousBeliefs = lastSession.algorithmOutputs?.dbnBeliefState?.conditions || {};

  const conditions: Record<string, number> = {};
  for (const p of currentPosteriors) {
    const previousBelief = previousBeliefs[p.condition];
    if (previousBelief !== undefined) {
      // Weighted combination: 60% new evidence + 40% accumulated belief
      const transitionDrift = 0.02; // natural drift toward population mean
      const accumulated = previousBelief * (1 - transitionDrift) + p.prior * transitionDrift;
      conditions[p.condition] = Math.round((0.6 * p.posterior + 0.4 * accumulated) * 100) / 100;
    } else {
      conditions[p.condition] = p.posterior;
    }
  }

  return { conditions, sessionNumber, priorSource: "accumulated" };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 22: Counterfactual Intervention Ranker
// ═══════════════════════════════════════════════════════════════════════════

export function rankInterventions(
  percentiles: DomainPercentiles,
  phenotype: PhenotypicProfile,
  pageRankScores: PageRankScores,
  input: RawAssessmentInput
): CounterfactualRanking[] {
  const rankings: CounterfactualRanking[] = [];

  for (const tmpl of INTERVENTION_TEMPLATES) {
    const targetScore = getPercentileForNode(percentiles, tmpl.pageRankTarget);
    const k = SATURATION_K_RATES[tmpl.pageRankTarget] || 0.10;
    const maxGain = Math.min(40, 95 - targetScore);

    // Counterfactual: score WITH intervention at 12 weeks
    const scoreWith = targetScore + maxGain * (1 - Math.exp(-k * 12));

    // Counterfactual: score WITHOUT intervention (natural drift: +2 percentile points)
    const scoreWithout = targetScore + 2;

    const expectedUtility = scoreWith - scoreWithout;

    // Feasibility modulation
    let feasibility = tmpl.feasibilityBase;
    // Phenotypic response rate adjustment
    const profileDef = PHENOTYPE_PROFILES.find(p => p.id === phenotype.profileId);
    const responseRate = profileDef?.interventionResponseRates[tmpl.id] || 0.70;
    feasibility *= responseRate;

    // PageRank leverage
    const leverage = pageRankScores[tmpl.pageRankTarget] || 0.01;
    const normalizedLeverage = Math.min(1, leverage * 100);

    const compositeRank = expectedUtility * normalizedLeverage * feasibility;

    rankings.push({
      intervention: tmpl.id,
      domain: tmpl.domain,
      expectedUtility: Math.round(expectedUtility * 100) / 100,
      scoreWithIntervention: Math.round(scoreWith),
      scoreWithoutIntervention: Math.round(scoreWithout),
      feasibilityScore: Math.round(feasibility * 100) / 100,
      compositeRank: Math.round(compositeRank * 100) / 100,
    });
  }

  // Sort by composite rank descending
  rankings.sort((a, b) => b.compositeRank - a.compositeRank);
  return rankings;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 23: ICD-10 Symptom Probability Mapper
// ═══════════════════════════════════════════════════════════════════════════

export function mapICD10Symptoms(
  bayesianPosteriors: BayesianPosterior[],
  dbnBeliefs: DBNBeliefState
): ICD10Mapping[] {
  const mappings: ICD10Mapping[] = [];

  for (const symptom of ICD10_SYMPTOM_MAP) {
    let maxProbability = 0;
    let sourceAlgorithm = "Bayesian";

    for (const linkedCondition of symptom.linkedConditions) {
      // Check Bayesian posteriors
      const posterior = bayesianPosteriors.find(p => p.condition === linkedCondition);
      if (posterior && posterior.posterior > maxProbability) {
        maxProbability = posterior.posterior;
      }

      // Check DBN beliefs (may be more accurate for multi-session)
      const dbnBelief = dbnBeliefs.conditions[linkedCondition];
      if (dbnBelief !== undefined && dbnBelief > maxProbability) {
        maxProbability = dbnBelief;
        sourceAlgorithm = "DBN";
      }
    }

    if (maxProbability > 0.20) {
      mappings.push({
        code: symptom.code,
        description: symptom.description,
        probability: Math.round(maxProbability * 100) / 100,
        concernLevel: maxProbability > 0.70 ? "high" : maxProbability > 0.45 ? "moderate" : "low",
        sourceAlgorithm,
      });
    }
  }

  return mappings.sort((a, b) => b.probability - a.probability);
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHM 24: Neurodivergence Pattern Classifier
// ═══════════════════════════════════════════════════════════════════════════

export function classifyNeurodivergence(
  cognitive: RawAssessmentInput["cognitive"],
  percentiles: DomainPercentiles
): NeurodivergenceResult {
  // ADHD-Inattentive: High RT variability + low sustained attention + high false start rate
  const rtVarZ = (cognitive.reactionTimeVariabilityMs - 80) / 30;
  const adhdProb = sigmoid(
    rtVarZ * 0.4 +
    (35 - percentiles.cognitive.sustainedAttention) / 30 * 0.3 +
    (cognitive.falseStartRate - 0.15) / 0.1 * 0.3
  ) * 0.5; // scale to max 0.5

  // ASD: Low emotion recognition + low social safety + rigid performance
  const asdProb = sigmoid(
    (40 - percentiles.cognitive.emotionRecognition) / 30 * 0.4 +
    (40 - percentiles.psychosocial.socialSafety) / 30 * 0.35 +
    (cognitive.reactionTimeVariabilityMs < 40 ? 0.25 : 0)
  ) * 0.4;

  // Gifted-Twice-Exceptional: High fluid reasoning + high WM + low emotional wellbeing
  const giftedProb = sigmoid(
    (percentiles.cognitive.fluidReasoning - 85) / 15 * 0.35 +
    (percentiles.cognitive.workingMemory - 80) / 20 * 0.35 +
    (40 - percentiles.psychosocial.emotionalWellbeing) / 30 * 0.3
  ) * 0.4;

  const anyFlagged = adhdProb > 0.25 || asdProb > 0.20 || giftedProb > 0.25;

  return {
    adhdInattentiveProbability: Math.round(Math.max(0, adhdProb) * 100) / 100,
    asdProbability: Math.round(Math.max(0, asdProb) * 100) / 100,
    giftedTwiceExceptionalProbability: Math.round(Math.max(0, giftedProb) * 100) / 100,
    anyFlagged,
    adjustedThresholds: anyFlagged,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER ALGORITHM RUNNER
// ═══════════════════════════════════════════════════════════════════════════

export function runAllAlgorithms(input: RawAssessmentInput): AlgorithmOutputs {
  const previousSessions = input.previousSessions || [];

  // Layer 2: Percentile computation
  const percentiles = computePercentiles(input);

  // Algorithm 11: Environmental modifiers (needed for Bayesian)
  const environmentalModifiers = computeEnvironmentalModifiers(input);

  // Algorithm 2: Risk scores
  const riskScores = computeRiskScores(percentiles);

  // Algorithm 3: Bayesian posteriors
  const bayesianPosteriors = computeBayesianPosteriors(input, percentiles, environmentalModifiers);

  // Algorithm 4: Monte Carlo confidence
  const monteCarloResults = computeMonteCarloConfidence(percentiles);

  // Algorithm 5: PageRank leverage
  const pageRankScores = computePageRankScores();

  // Algorithm 7: Nutrient interactions
  const nutrientInteractions = computeNutrientInteractions(percentiles);

  // Algorithm 8: Developmental age
  const developmentalAge = computeDevelopmentalAge(percentiles, input.profile);

  // Algorithm 9: Developmental velocity
  const velocityResults = computeDevelopmentalVelocity(percentiles, previousSessions);

  // Algorithm 10: Tri-Vector convergence
  const convergenceScore = computeConvergenceScore(percentiles);

  // Algorithm 12: Longitudinal trends
  const longitudinalTrends = computeLongitudinalTrends(previousSessions);

  // Algorithm 13: Phenotypic classification
  const phenotypicProfile = classifyPhenotype(percentiles);

  // Algorithm 14: Latent Health Score
  const latentHealthScore = computeLatentHealthScore(percentiles);

  // Algorithm 15: Causal mediation (T2-A: pass ageYears for age-stratified pathway weights)
  const mediationResults = computeCausalMediation(percentiles, bayesianPosteriors, input.profile.ageYears);

  // Algorithm 16: Anomaly velocity
  const anomalyAlerts = detectAnomalyVelocity(percentiles, previousSessions);

  // Algorithm 17: Bioavailability corrections
  const bioavailabilityScores = computeBioavailabilityScores(input, percentiles);

  // Algorithm 18: Sleep proxy
  const sleepProxy = computeSleepProxy(percentiles, input.cognitive);

  // Algorithm 19: Resilience-risk ratio
  const resilienceRiskRatio = computeResilienceRiskRatio(percentiles, input.psychosocial);

  // Algorithm 20: Compensatory pattern
  const compensatoryPattern = detectCompensatoryPattern(percentiles, latentHealthScore.lhs);

  // Algorithm 21: Dynamic Bayesian Network
  const dbnBeliefState = propagateDBNBeliefs(bayesianPosteriors, previousSessions, input.profile.sessionNumber);

  // Algorithm 22: Counterfactual ranker
  const counterfactualRankings = rankInterventions(percentiles, phenotypicProfile, pageRankScores, input);

  // Algorithm 23: ICD-10 mapping
  const icd10Mappings = mapICD10Symptoms(bayesianPosteriors, dbnBeliefState);

  // Algorithm 24: Neurodivergence
  const neurodivergenceResult = classifyNeurodivergence(input.cognitive, percentiles);

  // Algorithm 6: Saturation projections (using top interventions)
  const topInterventions = counterfactualRankings.slice(0, 12).map(r => r.intervention);
  const saturationProjections = computeSaturationProjections(percentiles, topInterventions);

  return {
    percentiles,
    riskScores,
    bayesianPosteriors,
    monteCarloResults,
    pageRankScores,
    saturationProjections,
    nutrientInteractions,
    developmentalAge,
    velocityResults,
    convergenceScore,
    environmentalModifiers,
    longitudinalTrends,
    phenotypicProfile,
    latentHealthScore,
    mediationResults,
    anomalyAlerts,
    bioavailabilityScores,
    sleepProxy,
    resilienceRiskRatio,
    compensatoryPattern,
    dbnBeliefState,
    counterfactualRankings,
    icd10Mappings,
    neurodivergenceResult,
  };
}
