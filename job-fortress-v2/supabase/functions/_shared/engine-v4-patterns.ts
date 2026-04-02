// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — Hidden Pattern Detection Engine
// 31 Multi-Signal Clinical Patterns
// ═══════════════════════════════════════════════════════════════════════════

import {
  AlgorithmOutputs, RawAssessmentInput,
  HiddenPatternActivation, PatternActivationVector,
  ActionPriority, DomainPercentiles, VelocityDirection,
} from "./engine-v4-types.ts";

// ─── Pattern Evaluation Context ─────────────────────────────────────────

interface PatternContext {
  input: RawAssessmentInput;
  alg: AlgorithmOutputs;
  p: DomainPercentiles;
}

type PatternRule = (ctx: PatternContext) => HiddenPatternActivation | null;

// ─── Phase 4: Strength-Weighted Confidence Scaling ──────────────────────
// Scales pattern confidence based on posterior probability strength.
// Higher posteriors → higher confidence multiplier → higher urgency tier.

type UrgencyTier = "IMMEDIATE" | "HIGH" | "MONITOR" | "LOW";

interface PosteriorSignal {
  signal: string;
  value: number;
}

function scaleConfidenceByPosterior(
  baseConfidence: number,
  posteriors?: PosteriorSignal[]
): { scaledConfidence: number; signalStrength: number; urgencyTier: UrgencyTier } {
  if (!posteriors || posteriors.length === 0) {
    return {
      scaledConfidence: baseConfidence,
      signalStrength: 1.0,
      urgencyTier: baseConfidence >= 0.80 ? "HIGH" : baseConfidence >= 0.60 ? "MONITOR" : "LOW",
    };
  }

  // Use the maximum posterior value for strength determination
  const maxPosterior = Math.max(...posteriors.map(p => p.value));

  let signalStrength: number;
  let urgencyTier: UrgencyTier;

  if (maxPosterior >= 0.80) {
    signalStrength = 1.2;
    urgencyTier = "IMMEDIATE";
  } else if (maxPosterior >= 0.60) {
    signalStrength = 1.0;
    urgencyTier = "HIGH";
  } else if (maxPosterior >= 0.50) {
    signalStrength = 0.8;
    urgencyTier = "MONITOR";
  } else {
    signalStrength = 0.6;
    urgencyTier = "LOW";
  }

  const scaledConfidence = Math.min(0.95, Math.round(baseConfidence * signalStrength * 100) / 100);

  return { scaledConfidence, signalStrength, urgencyTier };
}

// Urgency tier sort order for ranking patterns
const URGENCY_ORDER: Record<UrgencyTier, number> = {
  IMMEDIATE: 0,
  HIGH: 1,
  MONITOR: 2,
  LOW: 3,
};

// ─── Helper: Create Pattern Activation ──────────────────────────────────

function makePattern(
  id: string, name: string, category: string,
  confidence: number, clinicalRisk: string,
  priority: ActionPriority, signals: string,
  method: string, actions: string[],
  posteriors?: PosteriorSignal[]
): HiddenPatternActivation {
  const { scaledConfidence, signalStrength, urgencyTier } =
    scaleConfidenceByPosterior(confidence, posteriors);

  return {
    patternId: id, patternName: name, category,
    activated: true, confidence: scaledConfidence,
    clinicalRisk, actionPriority: priority,
    signalInputs: signals, detectionMethod: method,
    recommendedActions: actions,
    signalStrength,
    urgencyTier,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: Nutritional-Cognitive Cascade Patterns (HP01–HP06)
// ═══════════════════════════════════════════════════════════════════════════

const HP01_IronCognitionAttention: PatternRule = ({ alg, p }) => {
  const ironPost = alg.bayesianPosteriors.find(b => b.condition === "iron_deficiency");
  if (ironPost && ironPost.posterior > 0.60 && p.cognitive.sustainedAttention < 40 && p.physical.endurance < 45) {
    return makePattern("HP01", "Iron-Cognition-Attention Triangle",
      "nutritional_cognitive", 0.85, "HIGH — burnout/anaemia", ActionPriority.Immediate,
      "Iron posterior >60% + Attention <40th + Endurance <45th",
      "Causal mediation: iron→dopamine→attention",
      ["Immediate: iron-rich diet + Vit C pairing", "Ragi dosa + amla chutney daily", "GP referral for Hb test"],
      [{ signal: "iron_deficiency", value: ironPost.posterior }]);
  }
  return null;
};

const HP02_DualDeficiency: PatternRule = ({ alg, p, input }) => {
  const ironPost = alg.bayesianPosteriors.find(b => b.condition === "iron_deficiency");
  const vitDPost = alg.bayesianPosteriors.find(b => b.condition === "vitamin_d_deficiency");
  const isUrbanVeg = ["T1", "T2"].includes(input.profile.cityTier) &&
    ["vegetarian", "vegan", "jain"].includes(input.dietary.dietType);
  if (ironPost && ironPost.posterior > 0.50 && vitDPost && vitDPost.posterior > 0.55 && isUrbanVeg) {
    return makePattern("HP02", "Dual Deficiency Masquerade",
      "nutritional_cognitive", 0.80, "HIGH — compounded", ActionPriority.Immediate,
      "Iron posterior >50% + Vit D posterior >55% + Urban vegetarian",
      "Bayesian joint posterior P(Fe∩VitD)",
      ["Fortified foods daily", "Sun exposure protocol (15-20 min morning)", "Consider supplementation consult"],
      [{ signal: "iron_deficiency", value: ironPost.posterior }, { signal: "vitamin_d_deficiency", value: vitDPost.posterior }]);
  }
  return null;
};

const HP03_PhytateLock: PatternRule = ({ alg, p, input }) => {
  if (input.dietary.legumeDays >= 5 && p.dietary.iron < 45 && alg.bioavailabilityScores["iron"] < 35) {
    return makePattern("HP03", "Phytate Lock Pattern",
      "nutritional_cognitive", 0.72, "MED — covert deficiency", ActionPriority.High,
      "High legume intake + Low iron despite iron foods",
      "Bioavailability algorithm ratio <0.50",
      ["Soaking/sprouting legumes overnight", "Pair dal with Vit C (lemon, amla)", "Fermented dosa batter preferred"]);
  }
  return null;
};

const HP04_CalciumOxalateTrap: PatternRule = ({ p, input }) => {
  if (input.dietary.spinachAsPrimaryCa && p.dietary.calcium < 45) {
    return makePattern("HP04", "Calcium-Oxalate Trap",
      "nutritional_cognitive", 0.75, "MED — bone health risk", ActionPriority.High,
      "Spinach-primary Ca source + Ca percentile <45th",
      "Bioavailability correction <0.45 for oxalate",
      ["Sesame/ragi/dairy swap protocol", "Nachni ladoo as calcium snack", "Reduce spinach as primary Ca source"]);
  }
  return null;
};

const HP05_ProteinIronCompetition: PatternRule = ({ p }) => {
  if (p.dietary.protein >= 60 && p.dietary.iron < 40) {
    return makePattern("HP05", "Protein-Iron Competition",
      "nutritional_cognitive", 0.60, "LOW-MED — monitoring", ActionPriority.Medium,
      "High protein + Low iron", "Antagonism coefficient >0.55",
      ["Separate iron-rich and protein-rich meals", "Iron with Vit C at one meal, protein at another"]);
  }
  return null;
};

const HP06_FibreGutBrainGap: PatternRule = ({ p }) => {
  // Tightened: anxiety and emotional wellbeing thresholds reduced to < 35 (was 45)
  // to avoid flagging children who are just slightly below average on mood metrics.
  if (p.dietary.fibre < 35 && p.psychosocial.anxiety < 35 && p.psychosocial.emotionalWellbeing < 35) {
    return makePattern("HP06", "Fibre-Gut-Brain Axis Gap",
      "nutritional_cognitive", 0.68, "MED — mood dysregulation", ActionPriority.High,
      "Low fibre <35th + Anxiety high + Emotional wellbeing <35th",
      "KG pathway: fibre→gut microbiome→serotonin",
      ["Prebiotic fibre increase: banana, oats, garlic", "Fermented foods: dahi, idli, dosa", "Gut health assessment"]);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: Physical-Cognitive Coupling Patterns (HP07–HP11)
// ═══════════════════════════════════════════════════════════════════════════

const HP07_ScreenSedentaryCascade: PatternRule = ({ p }) => {
  // Tightened: motor thresholds to < 38 (was 45) — below-average is not the same as motor delay.
  // Requires genuinely low motor scores to avoid flagging most urban children.
  if (p.psychosocial.screenTime < 45 && p.physical.balance < 38 && p.physical.coordination < 38) {
    return makePattern("HP07", "Screen-Sedentary Cascade",
      "physical_cognitive", 0.74, "MED — motor delay", ActionPriority.High,
      "Screen >55th risk + Balance <38th + Coordination <38th",
      "KG: screen→sedentary→proprioception",
      ["Structured outdoor play 45 min/day", "Screen time taper protocol", "Coordination drills 3×/week"]);
  }
  return null;
};

const HP08_VestibularCalciumLink: PatternRule = ({ p }) => {
  // Tightened: calcium threshold to < 35 (was 45 — too broad, affects ~half the population).
  // Added coordination < 45 as a third confirmatory signal.
  if (p.physical.balance < 40 && p.dietary.calcium < 35 && p.physical.coordination < 45) {
    return makePattern("HP08", "Vestibular-Calcium Link",
      "physical_cognitive", 0.65, "MED — functional balance", ActionPriority.High,
      "Balance <40th + Calcium <35th + Coordination <45th", "KG: calcium→vestibular signalling",
      ["Calcium repletion: ragi, sesame, dairy", "Balance drills: single leg stance, heel walk", "Yoga tree pose 3×/week"]);
  }
  return null;
};

const HP09_EnduranceIronProxy: PatternRule = ({ alg, p }) => {
  const ironPost = alg.bayesianPosteriors.find(b => b.condition === "iron_deficiency");
  if (p.physical.endurance < 35 && ironPost && ironPost.posterior > 0.50) {
    return makePattern("HP09", "Endurance-Iron Proxy",
      "physical_cognitive", 0.82, "HIGH — likely undiagnosed anaemia", ActionPriority.Immediate,
      "Endurance <35th + Iron posterior >50%",
      "Mediation: iron→haemoglobin→O2→endurance",
      ["Urgent dietary iron + Vit C", "GP referral for Hb and ferritin test", "Ragi/dates/jaggery daily"]);
  }
  return null;
};

const HP10_ProprioceptionDeficit: PatternRule = ({ p, input }) => {
  if (p.physical.balance < 35 && input.physical.balanceSwayPixelsPerFrame > 5 && p.physical.strength >= 45) {
    return makePattern("HP10", "Proprioception Deficit Pattern",
      "physical_cognitive", 0.70, "MED — injury risk", ActionPriority.High,
      "Balance <35th + Sway >2SD + Strength ok",
      "CV: sway px/frame z-score >2.0",
      ["Proprioception drills: wobble board, eyes-closed balance", "Yoga balance poses", "Barefoot play on uneven surfaces"]);
  }
  return null;
};

const HP11_StrengthProteinDissociation: PatternRule = ({ p }) => {
  if (p.physical.strength < 40 && p.dietary.protein >= 60) {
    return makePattern("HP11", "Strength-Protein Dissociation",
      "physical_cognitive", 0.62, "MED — investigate absorption", ActionPriority.Medium,
      "Strength <40th + Protein ≥60th",
      "Bioavailability or absorption issue implied",
      ["Check protein quality: complete amino acids", "Assess Vit D + zinc status", "Strength training 2×/week"]);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: Psychosocial-Physiological Bridge Patterns (HP12–HP17)
// ═══════════════════════════════════════════════════════════════════════════

const HP12_AnxiousAchiever: PatternRule = ({ p }) => {
  if (p.cognitive.composite > 80 && (100 - p.psychosocial.anxiety) > 65 && p.psychosocial.socialSafety < 50) {
    return makePattern("HP12", "Anxious Achiever Syndrome",
      "psychosocial_physiological", 0.78, "HIGH — burnout trajectory", ActionPriority.Immediate,
      "Cognitive >80th + Anxiety index >65 + Social safety <50th",
      "Compensatory: cognitive comp for social stress",
      ["Structured stress management", "Social skills program", "Reduce academic pressure", "Mindfulness 5 min/day"]);
  }
  return null;
};

const HP13_CovertStressAppetite: PatternRule = ({ p, input }) => {
  // Tightened: calories and protein to < 38 (was 45) — below-average intake is not the same
  // as stress-suppressed appetite. Requires genuinely low intake alongside high stress.
  if (input.psychosocial.stressIndex > 60 && p.dietary.calories < 38 && p.dietary.protein < 38) {
    return makePattern("HP13", "Covert Stress-Appetite Loop",
      "psychosocial_physiological", 0.76, "HIGH — nutritional risk amplified by stress", ActionPriority.Immediate,
      "Stress >60 + Calories <38th + Protein <38th",
      "KG: stress→cortisol→appetite suppression",
      ["Mindfulness + breathing exercises", "Structured meal schedule", "Small frequent meals strategy", "Address stress source"]);
  }
  return null;
};

const HP14_SocialIsolation: PatternRule = ({ p, alg }) => {
  // Tightened: emotionRecognition to < 35 (was 45) to require genuinely poor social-emotional
  // skill, not just slightly below average. RI < 0.6 (was 0.7) for stronger specificity.
  if (p.psychosocial.socialSafety < 40 && p.cognitive.emotionRecognition < 35 && alg.resilienceRiskRatio.ri < 0.6) {
    return makePattern("HP14", "Social Isolation Marker",
      "psychosocial_physiological", 0.80, "HIGH — social-emotional development risk", ActionPriority.Immediate,
      "Social safety <40th + Emotion recognition <35th + RI <0.6",
      "ASD probability + resilience ratio <0.6",
      ["Social skills program", "Parent coaching on emotional support", "Structured peer interaction 3×/week"]);
  }
  return null;
};

const HP15_SubclinicalDepression: PatternRule = ({ p, input, alg }) => {
  const hasDecline = alg.velocityResults.some(
    v => v.metric.includes("psychosocial") && v.direction === VelocityDirection.Declining
  );
  if (input.psychosocial.stressIndex > 65 && p.psychosocial.emotionalWellbeing < 35 &&
      p.psychosocial.resilience < 40 && hasDecline) {
    return makePattern("HP15", "Subclinical Depression Proxy",
      "psychosocial_physiological", 0.85, "HIGH — clinical referral needed", ActionPriority.Immediate,
      "Stress >65 + Emotional <35th + Resilience <40th + Declining velocity",
      "DBN: 2-session decline + composite <threshold",
      ["Flag for professional mental health referral", "Gentle, non-alarmist parent communication",
       "Routine check-up with paediatrician recommended"]);
  }
  return null;
};

const HP16_GiftedIsolation: PatternRule = ({ p }) => {
  if (p.cognitive.composite > 90 && p.psychosocial.composite < 50 && p.physical.composite >= 40 && p.physical.composite <= 65) {
    return makePattern("HP16", "Gifted Isolation Pattern",
      "psychosocial_physiological", 0.70, "MED — social integration risk", ActionPriority.High,
      "Cognitive >90th + Psychosocial <50th + Physical avg",
      "Gifted-twice-exceptional pattern",
      ["Gifted peer program", "Enrichment activities", "Social skills support"]);
  }
  return null;
};

const HP17_SleepDebtAccumulator: PatternRule = ({ alg, p }) => {
  const cogDecline = alg.velocityResults.some(
    v => v.metric.includes("cognitive") && v.direction === VelocityDirection.Declining
  );
  if (alg.sleepProxy.isSleepInadequate && p.cognitive.reactionTime < 40 && cogDecline) {
    return makePattern("HP17", "Sleep Debt Accumulator",
      "psychosocial_physiological", 0.75, "MED-HIGH — cognitive erosion", ActionPriority.Immediate,
      "Sleep Proxy <45 + Slow RT + Declining cognitive velocity",
      "Algorithm 18 + DBN trend",
      ["Sleep hygiene protocol", "Screen curfew 1hr before bed", "Fixed bedtime routine", "Morning sunlight exposure"]);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: Developmental Trajectory Patterns (HP18–HP22)
// ═══════════════════════════════════════════════════════════════════════════

const HP18_DevAgeLag: PatternRule = ({ alg, p }) => {
  // Threshold: deltaMonths uses formula chronoMonths * 0.15 * deviation.
  // For a 10yr-old (120mo), max possible lag = 18mo. We require < -15mo (83% of max)
  // AND both domains must have genuinely low composites (< 35th percentile)
  // to ensure this only fires for children truly behind, not borderline averages.
  const lagDomains = alg.developmentalAge.filter(d => d.deltaMonths < -15);
  const lowDomains = [p.physical.composite, p.cognitive.composite, p.psychosocial.composite].filter(v => v < 35);
  if (lagDomains.length >= 2 && lowDomains.length >= 2) {
    return makePattern("HP18", "Developmental Age Lag (Multi-Domain)",
      "developmental", 0.88, "HIGH — early intervention critical", ActionPriority.Immediate,
      "Dev age >15mo behind in ≥2 domains with low composites", "Algorithm 8: dev_age_delta <-15 in 2+ domains + composite <35",
      ["Multi-domain specialist referral", "Holistic developmental support plan", "Family engagement program"]);
  }
  return null;
};

const HP19_VelocityDivergence: PatternRule = ({ alg }) => {
  const physVel = alg.velocityResults.find(v => v.metric === "physical_composite");
  const cogVel = alg.velocityResults.find(v => v.metric === "cognitive_composite");
  if (physVel && cogVel &&
      ((physVel.direction === VelocityDirection.Improving && cogVel.direction === VelocityDirection.Declining) ||
       (physVel.direction === VelocityDirection.Declining && cogVel.direction === VelocityDirection.Improving))) {
    return makePattern("HP19", "Velocity Divergence Pattern",
      "developmental", 0.68, "MED — imbalanced development", ActionPriority.High,
      "Physical ↑ + Cognitive ↓ (or vice versa)",
      "Opposite velocity Z-scores in 2 domains",
      ["Rebalance intervention prioritisation", "Investigate declining domain root cause"]);
  }
  return null;
};

const HP20_MilestoneRegression: PatternRule = ({ alg, input }) => {
  // Only fire if we have longitudinal data — a genuine decline from a previous session.
  // On first scan there's no baseline to regress from, so velocity direction is unreliable.
  const hasLongitudinalData = input.previousSessions && input.previousSessions.length > 0;
  if (!hasLongitudinalData) return null;

  const regressions = alg.developmentalAge.filter(d => d.deltaMonths < -10);
  const hasRegression = alg.velocityResults.some(
    v => v.direction === VelocityDirection.Declining && v.magnitude > 20
  );
  if (regressions.length > 0 && hasRegression) {
    return makePattern("HP20", "Milestone Regression Flag",
      "developmental", 0.90, "HIGH — possible neurological flag", ActionPriority.Immediate,
      "Previously achieved milestone lost",
      "Longitudinal milestone delta negative",
      ["Medical referral — paediatrician", "Neurological assessment recommended"]);
  }
  return null;
};

const HP21_RapidImprovementArtifact: PatternRule = ({ alg }) => {
  const rapidImprovement = alg.anomalyAlerts.find(a => a.type === "rapid_improvement");
  if (rapidImprovement) {
    return makePattern("HP21", "Rapid Improvement Artifact",
      "developmental", 0.55, "LOW — data validity check", ActionPriority.Low,
      "Score gain >25 pts in <8 weeks", "Algorithm 16: z_vel >2.5",
      ["Verify assessment consistency", "Re-test in controlled conditions"]);
  }
  return null;
};

const HP22_StuntingCascade: PatternRule = ({ p, alg, input }) => {
  const stuntPost = alg.bayesianPosteriors.find(b => b.condition === "stunting_risk");
  if (p.physical.heightForAge < 15 && p.dietary.protein < 40 && p.dietary.calcium < 40 &&
      input.profile.ageYears < 10 && stuntPost && stuntPost.posterior > 0.40) {
    return makePattern("HP22", "Stunting Cascade Risk",
      "developmental", 0.90, "HIGH — irreversible if untreated", ActionPriority.Immediate,
      "Height-for-age <15th + Protein <40th + Calcium <40th + Age <10",
      "Bayesian stunting prior × multi-nutrient deficit",
      ["Urgent nutritional intervention", "Growth monitoring every 4 weeks", "Protein-calcium rich diet plan",
       "GP referral for growth assessment"]);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: India-Specific Epidemiological Patterns (HP23–HP27)
// ═══════════════════════════════════════════════════════════════════════════

const HP23_UrbanVitDParadox: PatternRule = ({ alg, p, input }) => {
  const vitDPost = alg.bayesianPosteriors.find(b => b.condition === "vitamin_d_deficiency");
  const isUrban = ["T1", "T2"].includes(input.profile.cityTier);
  // Tightened: endurance to < 35 (was 45) — half of urban children have below-average endurance.
  // Posterior threshold raised to > 0.65 for higher specificity.
  if (isUrban && p.physical.endurance < 35 && vitDPost && vitDPost.posterior > 0.65) {
    return makePattern("HP23", "Urban Vitamin D Paradox",
      "india_specific", 0.82, "HIGH — 68% prevalence in urban India", ActionPriority.Immediate,
      "T1/T2 city + Endurance <35th + Vit D posterior >65%",
      "City-tier modulator × sedentary proxy",
      ["Supplementation consult", "Structured outdoor time 20 min/day", "Morning sun exposure protocol"]);
  }
  return null;
};

const HP24_JainVegDualGap: PatternRule = ({ p, input }) => {
  // Tightened: iron to < 35 (was 45) — Jain diet alone doesn't justify HIGH alarm
  // unless iron is genuinely in the lower tertile, not just slightly below average.
  if (input.dietary.dietType === "jain" && p.dietary.iron < 35) {
    return makePattern("HP24", "Jain/Strict-Veg Dual Gap",
      "india_specific", 0.85, "HIGH — requires supplementation", ActionPriority.Immediate,
      "Jain diet + Iron <35th + B12 proxy low",
      "Bioavailability × diet type intersection",
      ["Supervised supplementation protocol", "Fortified foods: atta, milk, oil", "Regular blood work monitoring"]);
  }
  return null;
};

const HP25_NFHS5IronAmplifier: PatternRule = ({ alg, p, input }) => {
  const ironPost = alg.bayesianPosteriors.find(b => b.condition === "iron_deficiency");
  // Tightened: posterior raised to > 0.55 (was 0.45 — lowest threshold in all patterns).
  // 0.45 would fire for almost every rural girl. Requires stronger Bayesian evidence.
  if (["T2", "T3"].includes(input.profile.cityTier) && input.profile.gender === "female" &&
      input.profile.ageYears <= 10 && ironPost && ironPost.posterior > 0.55) {
    return makePattern("HP25", "NFHS-5 Iron Prevalence Amplifier",
      "india_specific", 0.80, "HIGH — highest-risk demographic", ActionPriority.Immediate,
      "Rural/peri-urban + Female + Age 5–10 + Iron posterior >55%",
      "Prior 53% × female × rural multiplier 1.35",
      ["Iron-rich food intensive plan", "Weekly monitoring", "Jaggery/dates/ragi daily"]);
  }
  return null;
};

const HP26_ScreenAddictionInflection: PatternRule = ({ p, input }) => {
  // Tightened: socialSafety to < 40 (was 50 — below-median fired for half of all children).
  // All three signals must be genuinely low, not just slightly below average.
  if (p.psychosocial.screenTime < 45 && p.cognitive.sustainedAttention < 40 &&
      p.psychosocial.socialSafety < 40 && input.profile.ageYears < 12) {
    return makePattern("HP26", "Screen Addiction Inflection",
      "india_specific", 0.77, "HIGH — addiction trajectory", ActionPriority.Immediate,
      "Screen risk >55th + Attention <40th + Social safety <40th + Age <12",
      "NIMHANS 45% prevalence × 3-factor intersection",
      ["Digital detox program", "Parent coaching on screen limits", "Alternative engagement activities"]);
  }
  return null;
};

const HP27_RegionalFoodGap: PatternRule = ({ p, input }) => {
  const phytateStaples = ["bajra", "jowar", "ragi"];
  const hasPhytateStaple = input.dietary.stapleGrains.some(g => phytateStaples.includes(g.toLowerCase()));
  if (hasPhytateStaple && p.dietary.iron < 40 && p.dietary.vitaminC < 45) {
    return makePattern("HP27", "Regional Food Bioavailability Gap",
      "india_specific", 0.70, "MED — diet-culture specific", ActionPriority.High,
      "Phytate-heavy staple + Low iron + Low Vit C",
      "Regional food database + bioavailability correction",
      ["Vitamin C-rich accompaniments: amla, guava, lemon", "Soaking grains before cooking", "Fermentation where possible"]);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 6: Composite & Cross-Cutting Patterns (HP28–HP31 + extras)
// ═══════════════════════════════════════════════════════════════════════════

const HP28_CompoundVulnerability: PatternRule = ({ p, alg }) => {
  const belowCount = [
    p.physical.composite, p.cognitive.composite,
    p.dietary.composite, p.psychosocial.composite
  ].filter(v => v < 40).length;
  if (belowCount >= 3 && alg.resilienceRiskRatio.ri < 0.6 && alg.latentHealthScore.lhs < 38) {
    return makePattern("HP28", "Compound Vulnerability State",
      "composite", 0.88, "HIGH — requires holistic support", ActionPriority.Immediate,
      "≥3 domains below 40th + RI <0.6 + LHS <38",
      "Resilience-Risk ratio + LHS composite",
      ["Multi-domain coordinated plan", "Family engagement program", "Weekly progress tracking"]);
  }
  return null;
};

const HP29_CompensatoryCollapse: PatternRule = ({ alg }) => {
  if (alg.compensatoryPattern.detected && alg.compensatoryPattern.deviationSpread > 55) {
    return makePattern("HP29", "Compensatory Collapse Risk",
      "composite", 0.80, "HIGH — hidden fragility", ActionPriority.Immediate,
      "Max domain >85th + Min domain <30th",
      "Deviation vector |max-min| >55 pts",
      ["Address deficit domain urgently", "Prevent burnout in strong domain", "Balanced development plan"]);
  }
  return null;
};

const HP30_FalseResilience: PatternRule = ({ alg }) => {
  const hasDecliningTrend = alg.longitudinalTrends.some(
    t => t.direction === VelocityDirection.Declining
  );
  if (alg.resilienceRiskRatio.ri > 1.5 && hasDecliningTrend) {
    return makePattern("HP30", "False Resilience Signature",
      "composite", 0.72, "MED-HIGH — overconfidence in stability", ActionPriority.High,
      "RI >1.5 + Declining DBN trend",
      "Algorithm 19 × Algorithm 12 divergence",
      ["Proactive monitoring intensification", "Investigate root cause of declining trend"]);
  }
  return null;
};

const HP31_InterventionNonResponse: PatternRule = ({ alg }) => {
  // Check if any counterfactual expected utility gap is >15
  const nonResponse = alg.counterfactualRankings.some(
    r => r.expectedUtility < -15
  );
  if (nonResponse && alg.dbnBeliefState.priorSource === "accumulated") {
    return makePattern("HP31", "Intervention Non-Response",
      "composite", 0.70, "MED — plan revision needed", ActionPriority.High,
      "Expected improvement not realised (EU gap >15)",
      "Counterfactual ranker: actual vs expected delta",
      ["Root-cause analysis: adherence vs biological block", "Plan revision via Algorithm 22", "Consider specialist consult"]);
  }
  return null;
};

const HP32_OptimalDevelopment: PatternRule = ({ p, alg }) => {
  const allAbove55 = [p.physical.composite, p.cognitive.composite, p.dietary.composite, p.psychosocial.composite]
    .every(v => v >= 55);
  if (allAbove55 && alg.resilienceRiskRatio.ri > 1.4 && alg.convergenceScore.score > 72) {
    return makePattern("HP32", "Optimal Development Signal",
      "composite", 0.92, "LOW — thriving", ActionPriority.Maintenance,
      "All domains ≥55th + RI >1.4 + Positive velocity",
      "Convergence score >72 + no risk patterns",
      ["Maintenance + enrichment plan only", "Continue current healthy habits"]);
  }
  return null;
};

const HP33_PreAdolescentInflection: PatternRule = ({ input, alg }) => {
  if (input.profile.ageYears >= 10 && input.profile.ageYears <= 12) {
    // Tightened: require ≥2 declining longitudinal trends (was 1) to avoid flagging
    // any 10-12yr-old with normal puberty-related variance as HIGH risk.
    // Also requires longitudinal data to exist — first scan has no trend baseline.
    const hasLongitudinalData = input.previousSessions && input.previousSessions.length > 1;
    if (!hasLongitudinalData) return null;

    const decliningCount = alg.longitudinalTrends.filter(
      t => t.direction === VelocityDirection.Declining
    ).length;
    if (decliningCount >= 2) {
      return makePattern("HP33", "Pre-Adolescent Risk Inflection (Age 10-12)",
        "composite", 0.75, "HIGH — hormonal transition amplifies risk", ActionPriority.Immediate,
        "Age 10–12 + ≥2 declining longitudinal trends",
        "Age-gated amplification: priors × 1.25",
        ["Hormonal nutrition priming", "Psychosocial preparation", "Calcium + iron intensive", "Puberty education support"]);
    }
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN REGISTRY & EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════

const allPatternRules: PatternRule[] = [
  HP01_IronCognitionAttention, HP02_DualDeficiency, HP03_PhytateLock,
  HP04_CalciumOxalateTrap, HP05_ProteinIronCompetition, HP06_FibreGutBrainGap,
  HP07_ScreenSedentaryCascade, HP08_VestibularCalciumLink, HP09_EnduranceIronProxy,
  HP10_ProprioceptionDeficit, HP11_StrengthProteinDissociation,
  HP12_AnxiousAchiever, HP13_CovertStressAppetite, HP14_SocialIsolation,
  HP15_SubclinicalDepression, HP16_GiftedIsolation, HP17_SleepDebtAccumulator,
  HP18_DevAgeLag, HP19_VelocityDivergence, HP20_MilestoneRegression,
  HP21_RapidImprovementArtifact, HP22_StuntingCascade,
  HP23_UrbanVitDParadox, HP24_JainVegDualGap, HP25_NFHS5IronAmplifier,
  HP26_ScreenAddictionInflection, HP27_RegionalFoodGap,
  HP28_CompoundVulnerability, HP29_CompensatoryCollapse, HP30_FalseResilience,
  HP31_InterventionNonResponse, HP32_OptimalDevelopment, HP33_PreAdolescentInflection,
];

export function evaluateHiddenPatterns(
  input: RawAssessmentInput,
  algorithmOutputs: AlgorithmOutputs
): PatternActivationVector {
  const ctx: PatternContext = {
    input,
    alg: algorithmOutputs,
    p: algorithmOutputs.percentiles,
  };

  const activatedPatterns: HiddenPatternActivation[] = [];

  for (const rule of allPatternRules) {
    try {
      const result = rule(ctx);
      if (result) {
        activatedPatterns.push(result);
      }
    } catch (e) {
      // Silent fail on individual pattern evaluation — robustness
      console.warn(`Pattern evaluation error:`, e);
    }
  }

  // Phase 4: Sort by urgency tier (IMMEDIATE > HIGH > MONITOR > LOW) then by confidence descending
  activatedPatterns.sort((a, b) => {
    const tierA = URGENCY_ORDER[a.urgencyTier || "LOW"];
    const tierB = URGENCY_ORDER[b.urgencyTier || "LOW"];
    if (tierA !== tierB) return tierA - tierB;
    return b.confidence - a.confidence;
  });

  return {
    patterns: activatedPatterns,
    activatedCount: activatedPatterns.length,
    highPriorityCount: activatedPatterns.filter(
      p => p.actionPriority === ActionPriority.Immediate || p.actionPriority === ActionPriority.High
    ).length,
  };
}
