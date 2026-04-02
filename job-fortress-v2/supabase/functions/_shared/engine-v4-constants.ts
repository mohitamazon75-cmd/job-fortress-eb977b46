// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — Constants & Lookup Tables
// ═══════════════════════════════════════════════════════════════════════════

import {
  EvidenceLevel, CityTier, DietType, Season, Gender,
  ActionPriority, InterventionTier
} from "./engine-v4-types.ts";

// ─── Reliability Weights (Section 2, Algorithm 14) ───────────────────────

export const DOMAIN_RELIABILITY_WEIGHTS = {
  physical: 0.92,
  cognitive: 0.88,
  dietary: 0.71,
  psychosocial: 0.68,
} as const;

export const INCOMPLETE_RELIABILITY_PENALTY = 0.5;

// ─── Sleep Proxy Loading Coefficients (Algorithm 18) ─────────────────────

export const SLEEP_PROXY_LOADINGS = {
  reactionTime: -0.72,
  endurance: 0.61,
  emotional: 0.58,
  attention: 0.67,
} as const;

export const SLEEP_INADEQUACY_THRESHOLD = 45;

// ─── Anomaly Velocity Thresholds (Algorithm 16) ─────────────────────────

export const ANOMALY_VELOCITY_Z_THRESHOLD = 2.5;

// ─── Resilience-Risk Ratio Thresholds (Algorithm 19) ────────────────────

export const RESILIENCE_HIGH_THRESHOLD = 1.5;
export const RESILIENCE_VULNERABILITY_THRESHOLD = 0.7;

// ─── Compensatory Pattern Thresholds (Algorithm 20) ─────────────────────

export const COMPENSATORY_HIGH_THRESHOLD = 25;
export const COMPENSATORY_LOW_THRESHOLD = -20;

// ─── Bioavailability Correction Factors (Algorithm 17) ──────────────────

export const BIOAVAILABILITY_CORRECTIONS = {
  phytateIronInhibition: { min: 0.35, max: 0.60 },
  oxalateCalciumInhibition: 0.40,
  vitCIronEnhancement: 2.5,
  vitDCalciumAbsorption: {
    low: 1.0,
    medium: 1.4,
    high: 1.8,
  },
} as const;

// Sun exposure proxy by city tier + season
export const SUN_EXPOSURE_PROXY: Record<CityTier, Record<Season, "low" | "medium" | "high">> = {
  [CityTier.T1]: { summer: "medium", monsoon: "low", winter: "medium" },
  [CityTier.T2]: { summer: "high", monsoon: "low", winter: "medium" },
  [CityTier.T3]: { summer: "high", monsoon: "medium", winter: "high" },
};

// ─── T2-A: Age-Stratified KG Pathway Weights (Lozoff 2006, Innis 2008) ──
// Multiplier applied to causal pathway coefficients by critical developmental window

export type PathwayAgeGroup = "5-8" | "9-12" | "13-17";

export const AGE_STRATIFIED_PATHWAY_WEIGHTS: Record<string, Record<PathwayAgeGroup, number>> = {
  "iron→cognition":   { "5-8": 2.8, "9-12": 1.6, "13-17": 1.0 },  // Lozoff 2006 — critical neuroplasticity window
  "omega3→neural":    { "5-8": 2.2, "9-12": 1.5, "13-17": 1.0 },  // Innis 2008 — DHA-dependent myelination
  "calcium→bone":     { "5-8": 1.2, "9-12": 2.4, "13-17": 1.8 },  // Peak bone accrual age 9-12 (Weaver 2000)
  "protein→muscle":   { "5-8": 1.3, "9-12": 1.5, "13-17": 2.0 },  // Puberty-driven anabolic window
  "b12→cognition":    { "5-8": 2.0, "9-12": 1.5, "13-17": 1.0 },  // B12 myelination — highest in early school years
  "folate→cognition": { "5-8": 1.8, "9-12": 1.4, "13-17": 1.0 },  // Neural tube / myelination support
};

export function getPathwayAgeGroup(ageYears: number): PathwayAgeGroup {
  if (ageYears <= 8) return "5-8";
  if (ageYears <= 12) return "9-12";
  return "13-17";
}

export function getPathwayMultiplier(pathway: string, ageYears: number): number {
  const ageGroup = getPathwayAgeGroup(ageYears);
  return AGE_STRATIFIED_PATHWAY_WEIGHTS[pathway]?.[ageGroup] ?? 1.0;
}

// ─── T2-B: Nutrient Interaction Matrix (Algorithm 7 extended) ───────────
// Expanded with Folate and Omega-3 (EFSA 2012, ICMR-NIN 2020)

export const NUTRIENT_INTERACTION_MATRIX: Record<string, Record<string, number>> = {
  iron:     { iron: 1.0, calcium: -0.55, vitC: 2.5, vitD: 0.1, zinc: -0.35, protein: -0.20, fibre: -0.15, b12: 0.1,  folate: 0.10, omega3: -0.10 },
  calcium:  { iron: -0.55, calcium: 1.0, vitC: 0.1, vitD: 1.8, zinc: -0.10, protein: 0.15, fibre: 0.05, b12: 0.0,   folate: 0.05, omega3: 0.0  },
  vitC:     { iron: 2.5, calcium: 0.1, vitC: 1.0, vitD: 0.05, zinc: 0.10, protein: 0.0, fibre: 0.0, b12: 0.05,      folate: 0.15, omega3: 0.0  },
  vitD:     { iron: 0.1, calcium: 1.8, vitC: 0.05, vitD: 1.0, zinc: 0.0, protein: 0.0, fibre: 0.0, b12: 0.0,        folate: 0.0,  omega3: 0.05 },
  zinc:     { iron: -0.35, calcium: -0.10, vitC: 0.10, vitD: 0.0, zinc: 1.0, protein: 0.20, fibre: -0.10, b12: 0.0, folate: 0.0,  omega3: 0.0  },
  protein:  { iron: -0.20, calcium: 0.15, vitC: 0.0, vitD: 0.0, zinc: 0.20, protein: 1.0, fibre: 0.0, b12: 0.15,    folate: 0.10, omega3: 0.20 },
  fibre:    { iron: -0.15, calcium: 0.05, vitC: 0.0, vitD: 0.0, zinc: -0.10, protein: 0.0, fibre: 1.0, b12: 0.0,    folate: 0.10, omega3: 0.0  },
  b12:      { iron: 0.1, calcium: 0.0, vitC: 0.05, vitD: 0.0, zinc: 0.0, protein: 0.15, fibre: 0.0, b12: 1.0,       folate: 0.65, omega3: 0.05 },
  // T2-B: New rows for folate and omega3
  folate:   { iron: 0.10, calcium: 0.05, vitC: 0.15, vitD: 0.0, zinc: 0.0, protein: 0.10, fibre: 0.10, b12: 0.65,   folate: 1.0,  omega3: 0.10 },
  omega3:   { iron: -0.10, calcium: 0.0, vitC: 0.0, vitD: 0.05, zinc: 0.0, protein: 0.20, fibre: 0.0, b12: 0.05,    folate: 0.10, omega3: 1.0  },
};

// ─── Exponential Saturation k-rates (Algorithm 6) ──────────────────────

export const SATURATION_K_RATES: Record<string, number> = {
  balance: 0.12,
  coordination: 0.10,
  strength: 0.08,
  endurance: 0.09,
  flexibility: 0.14,
  reactionTime: 0.11,
  workingMemory: 0.07,
  fluidReasoning: 0.06,
  sustainedAttention: 0.10,
  processingSpeed: 0.08,
  iron: 0.13,
  calcium: 0.06,
  protein: 0.15,
  vitaminD: 0.05,
  fibre: 0.18,
  anxiety: 0.07,
  emotionalWellbeing: 0.09,
  socialSafety: 0.06,
  resilience: 0.08,
};

// ─── 9 Phenotypic Profiles (Algorithm 13) ───────────────────────────────

export interface PhenotypeProfileDef {
  id: string;
  name: string;
  signaturePattern: string;
  primaryRisk: string;
  centroid: number[];       // 12-dimensional percentile space
  riskPatterns: string[];
  interventionResponseRates: Record<string, number>;
}

export const PHENOTYPE_PROFILES: PhenotypeProfileDef[] = [
  {
    id: "P01",
    name: "Iron-Depleted Achiever",
    signaturePattern: "High cognitive / Low iron / Low endurance",
    primaryRisk: "Burnout trajectory, anemia",
    centroid: [45, 50, 40, 35, 50, 80, 75, 70, 30, 40, 55, 60],
    riskPatterns: ["iron_cognition_attention", "endurance_iron_proxy", "compensatory_collapse"],
    interventionResponseRates: { ironDiet: 0.82, vitCPairing: 0.78, enduranceDrills: 0.65 },
  },
  {
    id: "P02",
    name: "Sedentary Screen Child",
    signaturePattern: "Low physical + endurance / High screen / Avg diet",
    primaryRisk: "Obesity, attention dysregulation",
    centroid: [30, 35, 40, 30, 35, 55, 50, 45, 50, 50, 35, 40],
    riskPatterns: ["screen_sedentary_cascade", "screen_addiction_inflection"],
    interventionResponseRates: { outdoorPlay: 0.75, screenTaper: 0.60, coordinationDrills: 0.70 },
  },
  {
    id: "P03",
    name: "Nutritionally Masked",
    signaturePattern: "Normal weight / Low micronutrient / Low energy",
    primaryRisk: "Subclinical deficiency cascade",
    centroid: [50, 50, 45, 40, 50, 55, 50, 45, 35, 35, 55, 50],
    riskPatterns: ["dual_deficiency_masquerade", "phytate_lock", "calcium_oxalate_trap"],
    interventionResponseRates: { fortifiedFoods: 0.80, bioavailabilityFix: 0.85, supplementation: 0.72 },
  },
  {
    id: "P04",
    name: "Anxious High Performer",
    signaturePattern: "High cognitive / High anxiety / Low social safety",
    primaryRisk: "Burnout, somatisation",
    centroid: [50, 55, 50, 45, 55, 85, 80, 75, 50, 55, 30, 35],
    riskPatterns: ["anxious_achiever", "sleep_debt_accumulator", "covert_stress_appetite"],
    interventionResponseRates: { mindfulness: 0.72, socialSkills: 0.65, sleepHygiene: 0.68 },
  },
  {
    id: "P05",
    name: "Rural Stunting Risk",
    signaturePattern: "Low height-for-age / Low protein / Low calcium",
    primaryRisk: "Stunting, osteoporosis risk",
    centroid: [30, 35, 30, 30, 35, 45, 40, 40, 30, 35, 50, 45],
    riskPatterns: ["stunting_cascade", "nfhs5_iron_amplifier", "regional_food_gap"],
    interventionResponseRates: { proteinSupp: 0.78, calciumRagi: 0.80, growthMonitoring: 0.85 },
  },
  {
    id: "P06",
    name: "Vegetarian Iron-D Dual Gap",
    signaturePattern: "Vegetarian / Low iron + Vit D / Urban T2",
    primaryRisk: "Dual deficiency anaemia",
    centroid: [50, 50, 45, 45, 50, 60, 55, 50, 30, 50, 55, 50],
    riskPatterns: ["dual_deficiency_masquerade", "urban_vitD_paradox", "phytate_lock"],
    interventionResponseRates: { fortifiedFoods: 0.82, sunExposure: 0.70, vitCPairing: 0.78 },
  },
  {
    id: "P07",
    name: "Coordinated Balanced",
    signaturePattern: "All domains 50th–75th / No flags",
    primaryRisk: "Low risk — maintenance plan",
    centroid: [60, 62, 58, 60, 62, 65, 63, 60, 58, 60, 62, 65],
    riskPatterns: [],
    interventionResponseRates: { enrichment: 0.90, maintenance: 0.95 },
  },
  {
    id: "P08",
    name: "Gifted Outlier",
    signaturePattern: "Cognitive >90th / Physical avg / Social isolation risk",
    primaryRisk: "Neurodivergence stress",
    centroid: [50, 52, 48, 50, 50, 92, 90, 85, 55, 50, 40, 45],
    riskPatterns: ["gifted_isolation", "anxious_achiever", "compensatory_collapse"],
    interventionResponseRates: { peerProgram: 0.65, enrichment: 0.85, socialSkills: 0.60 },
  },
  {
    id: "P09",
    name: "Resilient Multi-Domain Low",
    signaturePattern: "All domains <40th / High resilience score",
    primaryRisk: "Compound delay, needs holistic support",
    centroid: [35, 33, 35, 30, 32, 38, 35, 34, 35, 30, 40, 70],
    riskPatterns: ["compound_vulnerability", "developmental_age_lag"],
    interventionResponseRates: { holisticPlan: 0.70, familyEngagement: 0.75, multiDomain: 0.65 },
  },
];

// ─── NFHS-5 Bayesian Priors ─────────────────────────────────────────────

export interface BayesianPriorDef {
  condition: string;
  basePrior: number;
  sensitivityRange: [number, number];
  specificityRange: [number, number];
  genderModifier: Record<string, number>;
  cityTierModifier: Record<CityTier, number>;
  ageGroupModifier: Record<string, number>;  // "5-10", "11-14", "15-17"
}

export const BAYESIAN_PRIORS: BayesianPriorDef[] = [
  {
    condition: "iron_deficiency",
    basePrior: 0.53,
    sensitivityRange: [0.75, 0.90],
    specificityRange: [0.70, 0.85],
    genderModifier: { male: 0.9, female: 1.35, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 0.85, T2: 1.0, T3: 1.20 },
    ageGroupModifier: { "5-10": 1.10, "11-14": 1.0, "15-17": 0.95 },
  },
  {
    condition: "vitamin_d_deficiency",
    basePrior: 0.68,
    sensitivityRange: [0.70, 0.85],
    specificityRange: [0.65, 0.80],
    genderModifier: { male: 1.0, female: 1.05, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 1.25, T2: 1.10, T3: 0.85 },
    ageGroupModifier: { "5-10": 1.0, "11-14": 1.05, "15-17": 1.0 },
  },
  {
    condition: "calcium_deficiency",
    basePrior: 0.45,
    sensitivityRange: [0.72, 0.88],
    specificityRange: [0.68, 0.82],
    genderModifier: { male: 0.95, female: 1.10, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 0.90, T2: 1.0, T3: 1.15 },
    ageGroupModifier: { "5-10": 1.05, "11-14": 1.0, "15-17": 0.95 },
  },
  {
    condition: "protein_deficiency",
    basePrior: 0.35,
    sensitivityRange: [0.78, 0.92],
    specificityRange: [0.72, 0.86],
    genderModifier: { male: 0.95, female: 1.05, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 0.80, T2: 1.0, T3: 1.25 },
    ageGroupModifier: { "5-10": 1.10, "11-14": 1.0, "15-17": 0.90 },
  },
  {
    condition: "stunting_risk",
    basePrior: 0.35,
    sensitivityRange: [0.80, 0.92],
    specificityRange: [0.75, 0.88],
    genderModifier: { male: 1.05, female: 0.95, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 0.70, T2: 0.90, T3: 1.40 },
    ageGroupModifier: { "5-10": 1.30, "11-14": 1.0, "15-17": 0.70 },
  },
  {
    condition: "obesity_risk",
    basePrior: 0.12,
    sensitivityRange: [0.85, 0.95],
    specificityRange: [0.80, 0.90],
    genderModifier: { male: 1.10, female: 0.95, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 1.40, T2: 1.10, T3: 0.75 },
    ageGroupModifier: { "5-10": 1.0, "11-14": 1.10, "15-17": 1.05 },
  },
  {
    condition: "adhd_pattern",
    basePrior: 0.08,
    sensitivityRange: [0.70, 0.85],
    specificityRange: [0.75, 0.90],
    genderModifier: { male: 1.30, female: 0.80, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 1.10, T2: 1.0, T3: 0.90 },
    ageGroupModifier: { "5-10": 1.20, "11-14": 1.0, "15-17": 0.85 },
  },
  {
    condition: "anxiety_disorder",
    basePrior: 0.12,
    sensitivityRange: [0.65, 0.82],
    specificityRange: [0.70, 0.85],
    genderModifier: { male: 0.85, female: 1.20, non_binary: 1.0, prefer_not_to_say: 1.0 },
    cityTierModifier: { T1: 1.15, T2: 1.0, T3: 0.90 },
    ageGroupModifier: { "5-10": 0.85, "11-14": 1.10, "15-17": 1.25 },
  },
];

// ─── 19 Biological Pathways ─────────────────────────────────────────────

export interface BiologicalPathway {
  id: string;
  name: string;
  causalChain: string[];
  timeLagWeeks: [number, number];
  evidenceLevel: EvidenceLevel;
  sourceNode: string;
  targetNode: string;
  mediators: string[];
}

export const BIOLOGICAL_PATHWAYS: BiologicalPathway[] = [
  { id: "BP01", name: "Iron-Dopamine-Cognition", causalChain: ["iron_deficiency", "low_dopamine", "low_pfc_function", "low_attention"], timeLagWeeks: [8, 12], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "iron", targetNode: "attention", mediators: ["dopamine_synthesis"] },
  { id: "BP02", name: "Fibre-Gut-Serotonin-Mood", causalChain: ["low_fibre", "low_microbiome_diversity", "low_serotonin", "high_anxiety"], timeLagWeeks: [4, 8], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "fibre", targetNode: "anxiety", mediators: ["gut_microbiome", "serotonin"] },
  { id: "BP03", name: "Calcium-Vestibular-Balance", causalChain: ["low_calcium", "low_endolymph_ca", "vestibular_hypofunction", "low_balance"], timeLagWeeks: [12, 24], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "calcium", targetNode: "balance", mediators: ["vestibular_signalling"] },
  { id: "BP04", name: "VitaminD-Calcium-Bone-Strength", causalChain: ["low_vitD", "low_ca_absorption", "low_bone_mineral", "low_strength"], timeLagWeeks: [16, 24], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "vitaminD", targetNode: "strength", mediators: ["calcium_absorption", "bone_mineralisation"] },
  { id: "BP05", name: "Cortisol-Appetite-Nutrition", causalChain: ["chronic_stress", "high_cortisol", "appetite_dysreg", "low_caloric_intake"], timeLagWeeks: [2, 6], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "stress", targetNode: "calories", mediators: ["cortisol", "appetite"] },
  { id: "BP06", name: "Screen-Dopamine-Reward", causalChain: ["excess_screen", "phasic_dopamine", "reward_dysreg", "low_motivation"], timeLagWeeks: [4, 12], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "screenTime", targetNode: "motivation", mediators: ["dopamine_reward"] },
  { id: "BP07", name: "Protein-mTOR-Muscle", causalChain: ["low_protein", "low_mtor", "low_muscle_synthesis", "low_strength"], timeLagWeeks: [4, 8], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "protein", targetNode: "strength", mediators: ["mtor_signalling"] },
  { id: "BP08", name: "Iron-Haemoglobin-Endurance", causalChain: ["iron_deficiency", "low_hb", "low_o2", "low_endurance"], timeLagWeeks: [6, 10], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "iron", targetNode: "endurance", mediators: ["haemoglobin", "o2_delivery"] },
  { id: "BP09", name: "Zinc-Immune-Infection-Appetite", causalChain: ["low_zinc", "high_infection", "high_inflammation", "low_appetite"], timeLagWeeks: [2, 12], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "zinc", targetNode: "appetite", mediators: ["immune_function", "cytokines"] },
  { id: "BP10", name: "Omega3-Inflammation-Cognition", causalChain: ["low_omega3", "neuroinflammation", "low_neuroplasticity", "low_processing_speed"], timeLagWeeks: [8, 16], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "omega3", targetNode: "processingSpeed", mediators: ["neuroinflammation"] },
  { id: "BP11", name: "Sleep-Cortisol-GH-Growth", causalChain: ["sleep_insufficient", "high_cortisol", "low_gh", "low_growth"], timeLagWeeks: [0, 52], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "sleep", targetNode: "growth", mediators: ["cortisol", "growth_hormone"] },
  { id: "BP12", name: "PhysicalActivity-BDNF-Learning", causalChain: ["exercise", "high_bdnf", "hippocampal_neurogenesis", "improved_memory"], timeLagWeeks: [2, 6], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "physicalActivity", targetNode: "memory", mediators: ["bdnf", "hippocampus"] },
  { id: "BP13", name: "Dehydration-Cognition", causalChain: ["low_water", "low_plasma_volume", "low_cerebral_perfusion", "low_attention"], timeLagWeeks: [0, 0.14], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "hydration", targetNode: "attention", mediators: ["plasma_volume", "cerebral_perfusion"] },
  { id: "BP14", name: "B12-Myelin-ProcessingSpeed", causalChain: ["low_b12", "low_myelin", "high_conduction_time", "low_processing_speed"], timeLagWeeks: [12, 20], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "b12", targetNode: "processingSpeed", mediators: ["myelin_synthesis"] },
  { id: "BP15", name: "Magnesium-Sleep-Anxiety", causalChain: ["low_mg", "low_gaba", "high_anxiety", "low_sleep_quality"], timeLagWeeks: [4, 8], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "magnesium", targetNode: "anxiety", mediators: ["gaba_activity"] },
  { id: "BP16", name: "Phytate-Iron-Inhibition-Loop", causalChain: ["high_phytate", "low_vitc", "low_iron_absorption", "persistent_iron_deficiency"], timeLagWeeks: [0, 52], evidenceLevel: EvidenceLevel.L1_RCT, sourceNode: "phytate", targetNode: "iron", mediators: ["non_haem_absorption"] },
  { id: "BP17", name: "Stress-Gut-Permeability", causalChain: ["chronic_stress", "high_gut_permeability", "systemic_inflammation", "high_anxiety"], timeLagWeeks: [4, 8], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "stress", targetNode: "anxiety", mediators: ["gut_permeability", "inflammation"] },
  { id: "BP18", name: "Obesity-Inflammatory-Cognitive", causalChain: ["excess_adiposity", "high_il6_tnfa", "neuroinflammation", "low_executive_function"], timeLagWeeks: [8, 52], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "obesity", targetNode: "executiveFunction", mediators: ["inflammatory_cytokines"] },
  { id: "BP19", name: "Sunlight-VitD-Mood-Immunity", causalChain: ["low_sun", "low_vitd", "low_serotonin_precursor", "high_depression_risk"], timeLagWeeks: [8, 16], evidenceLevel: EvidenceLevel.L2_Cohort, sourceNode: "sunExposure", targetNode: "mood", mediators: ["vitaminD", "serotonin_precursor"] },
];

// ─── T2-C: Indian Normative Cognitive Benchmarks ────────────────────────
// Sources: AIIMS Delhi (2019), NIMHANS Bangalore (2021), ICMR Neurodevelopment Survey (2020)

type CogAgeGroup = "5-7" | "8-11" | "12-14" | "15-17";

interface CogNorm { mean: number; sd: number; }

const INDIAN_COGNITIVE_NORMS: Record<string, Record<CogAgeGroup, CogNorm>> = {
  reactionTimeMs: {
    "5-7":   { mean: 680, sd: 110 },  // AIIMS Delhi 2019 — significantly slower than global estimates
    "8-11":  { mean: 540, sd: 95  },
    "12-14": { mean: 440, sd: 85  },
    "15-17": { mean: 370, sd: 75  },
  },
  workingMemoryScore: {
    "5-7":   { mean: 42, sd: 16 },  // NIMHANS Bangalore 2021
    "8-11":  { mean: 48, sd: 17 },
    "12-14": { mean: 56, sd: 16 },
    "15-17": { mean: 63, sd: 15 },
  },
  processingSpeedScore: {
    "5-7":   { mean: 38, sd: 14 },  // ICMR Neurodevelopment Survey 2020
    "8-11":  { mean: 46, sd: 15 },
    "12-14": { mean: 54, sd: 15 },
    "15-17": { mean: 61, sd: 14 },
  },
};

function getCogAgeGroup(ageYears: number): CogAgeGroup {
  if (ageYears <= 7) return "5-7";
  if (ageYears <= 11) return "8-11";
  if (ageYears <= 14) return "12-14";
  return "15-17";
}

// ─── T2-E: Puberty Inflection Multiplier ────────────────────────────────
// Girls: onset ~10.5yr → endurance -8%, flexibility +15%, height SD widens
// Boys: onset ~12yr → endurance +20%, strength +25%, height SD widens
// Sources: WHO growth charts, Tanner staging studies

export function pubertyInflectionMultiplier(
  metric: string,
  ageYears: number,
  gender: Gender
): { meanMult: number; sdMult: number } {
  const none = { meanMult: 1.0, sdMult: 1.0 };

  if (ageYears < 9 || ageYears > 17) return none;

  const isFemale = gender === Gender.Female;
  const isMale = gender === Gender.Male;

  // Girls: puberty peak ~10.5-13
  if (isFemale) {
    const inPubertyWindow = ageYears >= 10.5 && ageYears <= 14;
    if (!inPubertyWindow && ageYears < 10.5) return none;
    const intensity = Math.min(1.0, inPubertyWindow ? (ageYears - 10) / 2.5 : 1.0);
    switch (metric) {
      case "enduranceScore":   return { meanMult: 1.0 - 0.08 * intensity, sdMult: 1.1 };
      case "flexibilityScore": return { meanMult: 1.0 + 0.15 * intensity, sdMult: 1.0 };
      case "heightCm":         return { meanMult: 1.0, sdMult: 1.0 + 0.25 * intensity }; // wider SD
      default: return none;
    }
  }

  // Boys: puberty peak ~12-15
  if (isMale) {
    const inPubertyWindow = ageYears >= 12 && ageYears <= 16;
    if (!inPubertyWindow && ageYears < 12) return none;
    const intensity = Math.min(1.0, inPubertyWindow ? (ageYears - 11) / 3.0 : 1.0);
    switch (metric) {
      case "enduranceScore":  return { meanMult: 1.0 + 0.20 * intensity, sdMult: 1.1 };
      case "strengthProxy":   return { meanMult: 1.0 + 0.25 * intensity, sdMult: 1.1 };
      case "heightCm":        return { meanMult: 1.0, sdMult: 1.0 + 0.30 * intensity }; // wider SD
      default: return none;
    }
  }

  return none;
}

// ─── Indian Age/Gender Benchmarks (Normal CDF references) ───────────────

export interface BenchmarkRange {
  low: number;
  high: number;
  mean: number;
  sd: number;
}

// Simplified benchmark structure — expandable per metric/age/gender
export function getBenchmark(
  metric: string,
  ageYears: number,
  gender: Gender
): BenchmarkRange {
  // T2-C: Use Indian cognitive norms where available; fall back to global estimates
  const cogAgeGroup = getCogAgeGroup(ageYears);
  const indianCogNorm = INDIAN_COGNITIVE_NORMS[metric]?.[cogAgeGroup];

  // Defaults (global estimates for non-cognitive, Indian norms for cognitive)
  const defaults: Record<string, BenchmarkRange> = {
    balanceHoldSeconds: { low: 5, high: 60, mean: 25, sd: 12 },
    balanceSwayPixelsPerFrame: { low: 0.5, high: 8.0, mean: 3.0, sd: 1.5 },
    coordinationScore: { low: 10, high: 95, mean: 55, sd: 18 },
    strengthProxy: { low: 10, high: 95, mean: 50, sd: 20 },
    enduranceScore: { low: 10, high: 95, mean: 50, sd: 20 },
    flexibilityScore: { low: 10, high: 95, mean: 55, sd: 18 },
    heightCm: { low: 95, high: 175, mean: 120 + (ageYears - 5) * 5.5, sd: 8 },
    weightKg: { low: 15, high: 75, mean: 20 + (ageYears - 5) * 3.5, sd: 6 },
    // T2-C: Indian norms replace global developer estimates
    reactionTimeMs: indianCogNorm && metric === "reactionTimeMs"
      ? { low: 180, high: 900, mean: indianCogNorm.mean, sd: indianCogNorm.sd }
      : { low: 180, high: 800, mean: 450 - (ageYears - 5) * 15, sd: 80 },
    workingMemoryScore: indianCogNorm && metric === "workingMemoryScore"
      ? { low: 10, high: 95, mean: indianCogNorm.mean, sd: indianCogNorm.sd }
      : { low: 10, high: 95, mean: 50 + (ageYears - 5) * 1.5, sd: 18 },
    fluidReasoningScore: { low: 10, high: 95, mean: 50 + (ageYears - 5) * 1.2, sd: 17 },
    sustainedAttentionDPrime: { low: 0.5, high: 4.5, mean: 2.2 + (ageYears - 5) * 0.1, sd: 0.8 },
    processingSpeedScore: indianCogNorm && metric === "processingSpeedScore"
      ? { low: 10, high: 95, mean: indianCogNorm.mean, sd: indianCogNorm.sd }
      : { low: 10, high: 95, mean: 50 + (ageYears - 5) * 1.0, sd: 16 },
    emotionRecognitionScore: { low: 10, high: 95, mean: 55, sd: 18 },
  };

  // T2-E: Apply puberty inflection for physical benchmarks
  const pubertyAffectedMetrics = ["enduranceScore", "flexibilityScore", "strengthProxy", "heightCm"];
  if (pubertyAffectedMetrics.includes(metric) && ageYears >= 9) {
    const base = defaults[metric] || { low: 0, high: 100, mean: 50, sd: 20 };
    const { meanMult, sdMult } = pubertyInflectionMultiplier(metric, ageYears, gender);
    if (meanMult !== 1.0 || sdMult !== 1.0) {
      return { ...base, mean: base.mean * meanMult, sd: base.sd * sdMult };
    }
  }

  // ── Metric-specific gender adjustments (WHO/IAP calibrated) ────────────
  // Key: metric name → { female: meanMultiplier, male: meanMultiplier }
  // Cognitive metrics retain near-neutral (±2%) — WHO shows minimal gender gap pre-adolescence
  // Physical metrics use 8–15% spread from WHO/IAP growth charts
  const GENDER_METRIC_ADJUSTMENTS: Record<string, { female: number; male: number; sdF?: number; sdM?: number }> = {
    flexibilityScore:   { female: 1.12, male: 0.95 },   // Girls significantly more flexible
    enduranceScore:     { female: 0.97, male: 1.08 },   // Boys higher aerobic endurance
    coordinationScore:  { female: 1.05, male: 0.98 },   // Girls slightly better fine coordination
    strengthProxy:      { female: 0.92, male: 1.10 },   // Boys higher gross motor strength
    balanceHoldSeconds: { female: 1.06, male: 0.97 },   // Girls better static balance
    // Height/weight: preserve age-linear formula with mild gender offset
    heightCm:           { female: 0.98, male: 1.02 },
    weightKg:           { female: 0.97, male: 1.03 },
    // Cognitive — near-neutral (±2%)
    workingMemoryScore:         { female: 1.02, male: 0.98 },
    fluidReasoningScore:        { female: 1.01, male: 0.99 },
    processingSpeedScore:       { female: 1.02, male: 0.98 },
    emotionRecognitionScore:    { female: 1.02, male: 0.98 },
    reactionTimeMs:             { female: 1.01, male: 0.99 },
    sustainedAttentionDPrime:   { female: 1.02, male: 0.98 },
  };

  const base = defaults[metric] || { low: 0, high: 100, mean: 50, sd: 20 };

  if (gender === Gender.Female || gender === Gender.Male) {
    const adj = GENDER_METRIC_ADJUSTMENTS[metric];
    if (adj) {
      // The multiplier represents how the *population benchmark mean* differs by gender.
      // e.g. female flexibility benchmark mean is 12% HIGHER than male.
      // A higher benchmark mean means the child must score MORE to reach the same percentile,
      // which would LOWER a female's flexibility percentile — the opposite of biological reality.
      //
      // Correct approach: adjust the benchmark mean in the OPPOSITE direction so that
      // comparing a child's raw score against the gender-appropriate mean produces the
      // correct percentile. Female benchmark mean for flexibility should be LOWER (easier
      // to exceed), Male benchmark mean should be HIGHER (harder to exceed).
      //
      // Formula: genderMean = base.mean / multiplier
      // Female flexibility: 50 / 1.12 = 44.6  → female scoring 60 is well above → high pct ✅
      // Male   flexibility: 50 / 0.95 = 52.6  → male scoring 60 is moderate above → lower pct ✅
      const multiplier = gender === Gender.Female ? adj.female : adj.male;
      return { ...base, mean: base.mean / multiplier };
    }
  }

  // Neutral for non-binary / prefer not to say — or unrecognised metric
  return base;
}

// ─── Environmental Context Modifiers (Algorithm 11) ─────────────────────

export const CITY_TIER_RISK_MODIFIERS: Record<CityTier, Record<string, number>> = {
  [CityTier.T1]: { ironDeficiency: 0.85, vitDDeficiency: 1.25, obesity: 1.40, screenTime: 1.20 },
  [CityTier.T2]: { ironDeficiency: 1.0, vitDDeficiency: 1.10, obesity: 1.10, screenTime: 1.0 },
  [CityTier.T3]: { ironDeficiency: 1.20, vitDDeficiency: 0.85, obesity: 0.75, screenTime: 0.85 },
};

export const DIET_TYPE_MODIFIERS: Record<DietType, Record<string, number>> = {
  [DietType.Vegetarian]: { ironDeficiency: 1.25, b12Deficiency: 1.40, proteinDeficiency: 1.10 },
  [DietType.Vegan]: { ironDeficiency: 1.35, b12Deficiency: 1.80, calciumDeficiency: 1.30, proteinDeficiency: 1.25 },
  [DietType.Jain]: { ironDeficiency: 1.40, b12Deficiency: 1.90, proteinDeficiency: 1.20 },
  [DietType.Omnivore]: { ironDeficiency: 0.85, b12Deficiency: 0.70, proteinDeficiency: 0.80 },
  [DietType.Eggetarian]: { ironDeficiency: 1.10, b12Deficiency: 1.10, proteinDeficiency: 0.95 },
};

// ─── ICD-10 Symptom Mappings (Algorithm 23) ─────────────────────────────

export interface ICD10SymptomDef {
  code: string;
  description: string;
  linkedConditions: string[];
  knowledgeGraphNodes: string[];
}

export const ICD10_SYMPTOM_MAP: ICD10SymptomDef[] = [
  { code: "D50.9", description: "Iron deficiency anaemia, unspecified", linkedConditions: ["iron_deficiency"], knowledgeGraphNodes: ["iron", "haemoglobin", "endurance"] },
  { code: "E55.9", description: "Vitamin D deficiency, unspecified", linkedConditions: ["vitamin_d_deficiency"], knowledgeGraphNodes: ["vitaminD", "calcium", "bone"] },
  { code: "E58", description: "Dietary calcium deficiency", linkedConditions: ["calcium_deficiency"], knowledgeGraphNodes: ["calcium", "bone", "balance"] },
  { code: "E46", description: "Unspecified protein-calorie malnutrition", linkedConditions: ["protein_deficiency"], knowledgeGraphNodes: ["protein", "strength", "growth"] },
  { code: "E45", description: "Retarded development following PEM", linkedConditions: ["stunting_risk"], knowledgeGraphNodes: ["height", "protein", "calcium"] },
  { code: "E66.9", description: "Obesity, unspecified", linkedConditions: ["obesity_risk"], knowledgeGraphNodes: ["bmi", "adiposity", "inflammation"] },
  { code: "F90.0", description: "ADHD, predominantly inattentive type", linkedConditions: ["adhd_pattern"], knowledgeGraphNodes: ["attention", "reactionTime", "dopamine"] },
  { code: "F41.1", description: "Generalized anxiety disorder", linkedConditions: ["anxiety_disorder"], knowledgeGraphNodes: ["anxiety", "stress", "cortisol"] },
  { code: "F84.0", description: "Childhood autism / ASD", linkedConditions: ["asd_pattern"], knowledgeGraphNodes: ["socialSafety", "emotionRecognition", "rigidity"] },
  { code: "G47.9", description: "Sleep disorder, unspecified", linkedConditions: ["sleep_disorder"], knowledgeGraphNodes: ["sleep", "reactionTime", "cortisol"] },
  { code: "F32.9", description: "Depressive episode, unspecified", linkedConditions: ["depression_proxy"], knowledgeGraphNodes: ["emotionalWellbeing", "stress", "resilience"] },
  { code: "E61.1", description: "Iron deficiency (without anaemia)", linkedConditions: ["iron_deficiency_subclinical"], knowledgeGraphNodes: ["iron", "fatigue", "attention"] },
];

// ─── Intervention Templates ─────────────────────────────────────────────

export interface InterventionTemplate {
  id: string;
  domain: string;
  title: string;
  description: string;
  frequency: string;
  durationMinutes: number;
  tier: InterventionTier;
  effortLevel: "quick_win" | "core_habit" | "lifestyle_shift";
  targetNodes: string[];
  indianFoodAlternatives?: string[];
  feasibilityBase: number;
  effectivenessBase: number;
  pageRankTarget: string;
}

export const INTERVENTION_TEMPLATES: InterventionTemplate[] = [
  // Physical
  { id: "INT_BALANCE_DRILL", domain: "physical", title: "Balance drills (10 min)", description: "2× daily balance exercises — single leg stance, heel-to-toe walk", frequency: "2x daily", durationMinutes: 10, tier: InterventionTier.Tier1_Critical, effortLevel: "core_habit", targetNodes: ["balance", "proprioception"], feasibilityBase: 0.90, effectivenessBase: 0.75, pageRankTarget: "balance" },
  { id: "INT_OUTDOOR_PLAY", domain: "physical", title: "Structured outdoor play (45 min)", description: "Daily outdoor unstructured play — running, climbing, ball games", frequency: "daily", durationMinutes: 45, tier: InterventionTier.Tier1_Critical, effortLevel: "core_habit", targetNodes: ["endurance", "coordination", "vitaminD"], feasibilityBase: 0.80, effectivenessBase: 0.82, pageRankTarget: "endurance" },
  { id: "INT_COORDINATION", domain: "physical", title: "High Knee March + coordination drills", description: "Coordination-focused exercises 3×/week", frequency: "3x/week", durationMinutes: 15, tier: InterventionTier.Tier2_Core, effortLevel: "core_habit", targetNodes: ["coordination", "balance"], feasibilityBase: 0.85, effectivenessBase: 0.70, pageRankTarget: "coordination" },
  { id: "INT_YOGA", domain: "physical", title: "Yoga balance poses (20 min)", description: "Age-appropriate yoga 3×/week — tree pose, warrior, mountain", frequency: "3x/week", durationMinutes: 20, tier: InterventionTier.Tier2_Core, effortLevel: "core_habit", targetNodes: ["balance", "flexibility", "mindfulness"], feasibilityBase: 0.75, effectivenessBase: 0.72, pageRankTarget: "balance" },
  { id: "INT_STRENGTH_CIRCUIT", domain: "physical", title: "Bodyweight strength circuit", description: "2×/week simple strength circuit — squats, push-ups, planks", frequency: "2x/week", durationMinutes: 20, tier: InterventionTier.Tier2_Core, effortLevel: "core_habit", targetNodes: ["strength", "endurance"], feasibilityBase: 0.80, effectivenessBase: 0.68, pageRankTarget: "strength" },
  { id: "INT_SPORT", domain: "physical", title: "Sport-specific activity", description: "Swimming, cricket, dance, or martial arts 1×/week", frequency: "1x/week", durationMinutes: 60, tier: InterventionTier.Tier3_Enrichment, effortLevel: "lifestyle_shift", targetNodes: ["endurance", "coordination", "socialSafety"], feasibilityBase: 0.60, effectivenessBase: 0.78, pageRankTarget: "endurance" },

  // Dietary
  { id: "INT_IRON_DIET", domain: "dietary", title: "Daily iron-rich meal with Vit C pairing", description: "Ragi dosa/roti + amla/lemon; green leafy sabzi with tomato", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier1_Critical, effortLevel: "core_habit", targetNodes: ["iron", "vitC"], indianFoodAlternatives: ["ragi dosa with amla chutney", "palak dal with lemon", "bajra roti with green chutney", "dates + orange as snack"], feasibilityBase: 0.85, effectivenessBase: 0.80, pageRankTarget: "iron" },
  { id: "INT_CALCIUM_SWAP", domain: "dietary", title: "Calcium-rich alternatives to spinach", description: "Replace spinach as primary calcium source with ragi, sesame, dairy", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier1_Critical, effortLevel: "quick_win", targetNodes: ["calcium"], indianFoodAlternatives: ["ragi porridge", "sesame chutney", "curd/dahi", "paneer", "nachni ladoo"], feasibilityBase: 0.88, effectivenessBase: 0.78, pageRankTarget: "calcium" },
  { id: "INT_FORTIFIED", domain: "dietary", title: "Fortified food incorporation", description: "Add fortified cereals, milk, or oil to daily diet", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier1_Critical, effortLevel: "quick_win", targetNodes: ["iron", "vitaminD", "b12"], indianFoodAlternatives: ["fortified atta", "fortified milk", "fortified cooking oil"], feasibilityBase: 0.82, effectivenessBase: 0.72, pageRankTarget: "iron" },
  { id: "INT_SOAK_SPROUT", domain: "dietary", title: "Soaking/sprouting legumes for phytate reduction", description: "Soak dal/legumes overnight, sprout when possible to reduce phytate", frequency: "daily", durationMinutes: 5, tier: InterventionTier.Tier2_Core, effortLevel: "quick_win", targetNodes: ["iron", "zinc"], indianFoodAlternatives: ["sprouted moong salad", "soaked chana chaat", "fermented dosa batter"], feasibilityBase: 0.90, effectivenessBase: 0.65, pageRankTarget: "iron" },
  { id: "INT_PREBIOTIC_FIBRE", domain: "dietary", title: "Prebiotic fibre increase", description: "Add banana, oats, garlic, onion to daily meals", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier2_Core, effortLevel: "quick_win", targetNodes: ["fibre", "gutMicrobiome"], indianFoodAlternatives: ["banana with breakfast", "oats upma", "garlic raita"], feasibilityBase: 0.92, effectivenessBase: 0.68, pageRankTarget: "fibre" },
  { id: "INT_SUN_EXPOSURE", domain: "dietary", title: "Structured sun exposure (15–20 min)", description: "Morning sunlight exposure for Vitamin D synthesis", frequency: "daily", durationMinutes: 20, tier: InterventionTier.Tier1_Critical, effortLevel: "quick_win", targetNodes: ["vitaminD"], feasibilityBase: 0.85, effectivenessBase: 0.70, pageRankTarget: "vitaminD" },

  // Cognitive
  { id: "INT_SCREEN_TAPER", domain: "cognitive", title: "Screen time reduction protocol", description: "Gradual reduction: week 1 reduce 30 min, week 2 reduce 30 min more", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier1_Critical, effortLevel: "lifestyle_shift", targetNodes: ["screenTime", "attention", "socialSafety"], feasibilityBase: 0.55, effectivenessBase: 0.72, pageRankTarget: "screenTime" },
  { id: "INT_COG_GAME", domain: "cognitive", title: "Cognitive training game (15 min)", description: "Daily brain training: memory, attention, processing speed games", frequency: "daily", durationMinutes: 15, tier: InterventionTier.Tier2_Core, effortLevel: "core_habit", targetNodes: ["workingMemory", "attention", "processingSpeed"], feasibilityBase: 0.85, effectivenessBase: 0.65, pageRankTarget: "workingMemory" },
  { id: "INT_MINDFULNESS", domain: "cognitive", title: "Mindfulness practice (5 min)", description: "Guided breathing or body scan for children", frequency: "daily", durationMinutes: 5, tier: InterventionTier.Tier1_Critical, effortLevel: "quick_win", targetNodes: ["anxiety", "stress", "emotionalWellbeing"], feasibilityBase: 0.80, effectivenessBase: 0.68, pageRankTarget: "anxiety" },

  // Psychosocial
  { id: "INT_SOCIAL_SKILLS", domain: "psychosocial", title: "Structured social play (3×/week)", description: "Playdates, group activities, cooperative games with peers", frequency: "3x/week", durationMinutes: 45, tier: InterventionTier.Tier2_Core, effortLevel: "core_habit", targetNodes: ["socialSafety", "emotionRecognition", "resilience"], feasibilityBase: 0.70, effectivenessBase: 0.65, pageRankTarget: "socialSafety" },
  { id: "INT_SLEEP_HYGIENE", domain: "psychosocial", title: "Sleep hygiene protocol", description: "Fixed bedtime, no screens 1hr before bed, cool dark room", frequency: "daily", durationMinutes: 0, tier: InterventionTier.Tier1_Critical, effortLevel: "lifestyle_shift", targetNodes: ["sleep", "reactionTime", "emotionalWellbeing"], feasibilityBase: 0.65, effectivenessBase: 0.75, pageRankTarget: "sleep" },
  { id: "INT_JOURNALING", domain: "psychosocial", title: "Emotion journaling", description: "Daily 5-min journal: 'What made me happy/sad/worried today'", frequency: "daily", durationMinutes: 5, tier: InterventionTier.Tier2_Core, effortLevel: "quick_win", targetNodes: ["emotionalWellbeing", "resilience"], feasibilityBase: 0.75, effectivenessBase: 0.60, pageRankTarget: "emotionalWellbeing" },
  { id: "INT_PARENT_COACHING", domain: "psychosocial", title: "Parent coaching session", description: "Guided session with parent on supporting child's emotional development", frequency: "monthly", durationMinutes: 30, tier: InterventionTier.Tier2_Core, effortLevel: "lifestyle_shift", targetNodes: ["socialSafety", "resilience", "familyEngagement"], feasibilityBase: 0.55, effectivenessBase: 0.70, pageRankTarget: "socialSafety" },
];
