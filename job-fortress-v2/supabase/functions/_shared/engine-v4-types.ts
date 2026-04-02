// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ─── Enums ────────────────────────────────────────────────────────────────

export enum DietType {
  Vegetarian = "vegetarian",
  Vegan = "vegan",
  Jain = "jain",
  Omnivore = "omnivore",
  Eggetarian = "eggetarian",
}

export enum CityTier {
  T1 = "T1",
  T2 = "T2",
  T3 = "T3",
}

export enum Season {
  Summer = "summer",
  Monsoon = "monsoon",
  Winter = "winter",
}

export enum Gender {
  Male = "male",
  Female = "female",
  NonBinary = "non_binary",
  PreferNotToSay = "prefer_not_to_say",
}

export enum ActionPriority {
  Immediate = "immediate",
  High = "high",
  Medium = "medium",
  Low = "low",
  Maintenance = "maintenance",
}

export enum InterventionTier {
  Tier0_Alert = 0,
  Tier1_Critical = 1,
  Tier2_Core = 2,
  Tier3_Enrichment = 3,
  Tier4_Maintenance = 4,
}

export enum EvidenceLevel {
  L1_RCT = "L1",
  L2_Cohort = "L2",
  L3_CrossSectional = "L3",
  L4_Mechanistic = "L4",
}

export enum VelocityDirection {
  Improving = "improving",
  Stable = "stable",
  Declining = "declining",
}

export enum InterventionOutcome {
  Effective = "effective",
  Partial = "partial",
  NonResponse = "non_response",
  Adverse = "adverse",
}

export enum EdgeType {
  Causes = "causes",
  Mediates = "mediates",
  Modulates = "modulates",
  Temporal = "temporal",
  Bidirectional = "bidirectional",
}

// ─── Layer 1: Raw Signal Inputs ──────────────────────────────────────────

export interface PhysicalCVMetrics {
  balanceHoldSeconds: number;
  balanceSwayPixelsPerFrame: number;
  coordinationScore: number;       // 0-100
  strengthProxy: number;           // 0-100
  enduranceScore: number;          // 0-100
  flexibilityScore: number;        // 0-100
  heightCm: number;
  weightKg: number;
  highKneeCount?: number;
  singleLegStanceMs?: number;
}

export interface CognitiveBatteryScores {
  reactionTimeMs: number;
  reactionTimeVariabilityMs: number;
  workingMemoryScore: number;      // 0-100
  fluidReasoningScore: number;     // 0-100
  sustainedAttentionDPrime: number;
  processingSpeedScore: number;    // 0-100
  emotionRecognitionScore: number; // 0-100
  falseStartRate: number;          // 0-1
  typedAnswerLatencyMs?: number;
}

export interface DietaryAssessment {
  answers: number[];               // 10 ICMR questionnaire answers
  dietType: DietType;
  ironRichFoodFrequency: number;   // servings/week
  calciumSources: string[];
  proteinSources: string[];
  fibreIntake: number;             // estimated g/day
  vitCIntake: number;              // estimated mg/day
  legumeDays: number;              // days/week with legume-heavy meals
  spinachAsPrimaryCa: boolean;
  dailyWaterIntakeMl: number;
  stapleGrains: string[];          // e.g. ["bajra", "jowar", "rice"]
}

export interface PsychosocialScreener {
  answers: number[];               // 12 screener answers (0-4 Likert)
  anxietyIndex: number;            // 0-100
  stressIndex: number;             // 0-100
  emotionalWellbeingScore: number; // 0-100
  socialSafetyScore: number;       // 0-100
  resilienceScore: number;         // 0-100
  screenTimeHoursPerDay: number;
}

export interface ChildProfile {
  id: string;
  ageYears: number;
  ageMonths: number;
  gender: Gender;
  cityTier: CityTier;
  season: Season;
  dietType: DietType;
  assessmentDate: string;          // ISO date
  sessionNumber: number;           // 1 for first, 2+ for follow-ups
}

export interface RawAssessmentInput {
  profile: ChildProfile;
  physical: PhysicalCVMetrics;
  cognitive: CognitiveBatteryScores;
  dietary: DietaryAssessment;
  psychosocial: PsychosocialScreener;
  previousSessions?: AssessmentSession[];
}

// ─── Layer 2: Percentile Scores ──────────────────────────────────────────

export interface DomainPercentiles {
  physical: {
    balance: number;
    coordination: number;
    strength: number;
    endurance: number;
    flexibility: number;
    bmi: number;
    heightForAge: number;
    composite: number;
  };
  cognitive: {
    reactionTime: number;
    workingMemory: number;
    fluidReasoning: number;
    sustainedAttention: number;
    processingSpeed: number;
    emotionRecognition: number;
    composite: number;
  };
  dietary: {
    iron: number;
    calcium: number;
    protein: number;
    vitaminD: number;
    fibre: number;
    vitaminC: number;
    zinc: number;
    b12: number;
    calories: number;
    composite: number;
  };
  psychosocial: {
    anxiety: number;          // INVERTED: 100 = no anxiety
    stress: number;           // INVERTED: 100 = no stress
    emotionalWellbeing: number;
    socialSafety: number;
    resilience: number;
    screenTime: number;       // INVERTED: 100 = minimal screen
    composite: number;
  };
}

export interface ReliabilityWeights {
  physical: number;
  cognitive: number;
  dietary: number;
  psychosocial: number;
}

// ─── Layer 3: Algorithm Outputs ──────────────────────────────────────────

export interface BayesianPosterior {
  condition: string;
  prior: number;
  posterior: number;
  evidenceStrength: number;
}

export interface MonteCarloResult {
  metric: string;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  robustnessScore: number;
}

export interface PageRankScores {
  [nodeId: string]: number;
}

export interface SaturationProjection {
  domain: string;
  intervention: string;
  weeklyProjection: number[];    // 24 values
  expectedGainPercent: number;
  kRate: number;
}

export interface NutrientInteraction {
  nutrientPair: [string, string];
  interactionType: "synergy" | "antagonism";
  coefficient: number;
  adjustedEfficacy: number;
}

export interface DevelopmentalAgeResult {
  domain: string;
  developmentalAgeMonths: number;
  chronologicalAgeMonths: number;
  deltaMonths: number;
}

export interface VelocityResult {
  metric: string;
  direction: VelocityDirection;
  magnitude: number;
  confidence: number;
}

export interface ConvergenceScore {
  score: number;              // 0-100
  physicalContribution: number;
  cognitiveContribution: number;
  nutritionContribution: number;
  crossDomainCorrelation: number;
}

export interface PhenotypicProfile {
  profileId: string;          // P01-P09
  name: string;
  confidence: number;
  signaturePattern: string;
  primaryRisk: string;
}

export interface LatentHealthScore {
  lhs: number;
  domainContributions: Record<string, number>;
  reliabilityWeights: ReliabilityWeights;
}

export interface MediationResult {
  pathId: string;
  xVariable: string;
  yVariable: string;
  mediator: string;
  directEffect: number;
  indirectEffect: number;
  totalEffect: number;
  mediationRatio: number;
}

export interface AnomalyVelocityAlert {
  metric: string;
  zVelocity: number;
  type: "rapid_improvement" | "rapid_decline";
  reviewRequired: boolean;
}

export interface SleepProxyScore {
  score: number;             // 0-100
  isSleepInadequate: boolean;
  componentScores: {
    reactionTime: number;
    endurance: number;
    emotional: number;
    attention: number;
  };
}

export interface ResilienceRiskRatio {
  ri: number;
  protectiveScore: number;
  riskScore: number;
  classification: "high_resilience" | "moderate" | "vulnerability_amplification";
}

export interface CompensatoryPattern {
  detected: boolean;
  strongDomain: string;
  strongScore: number;
  weakDomain: string;
  weakScore: number;
  deviationSpread: number;
}

export interface DBNBeliefState {
  conditions: Record<string, number>;
  sessionNumber: number;
  priorSource: "population" | "accumulated";
}

export interface CounterfactualRanking {
  intervention: string;
  domain: string;
  expectedUtility: number;
  scoreWithIntervention: number;
  scoreWithoutIntervention: number;
  feasibilityScore: number;
  compositeRank: number;
}

export interface ICD10Mapping {
  code: string;
  description: string;
  probability: number;
  concernLevel: "high" | "moderate" | "low";
  sourceAlgorithm: string;
}

export interface NeurodivergenceResult {
  adhdInattentiveProbability: number;
  asdProbability: number;
  giftedTwiceExceptionalProbability: number;
  anyFlagged: boolean;
  adjustedThresholds: boolean;
}

// Full algorithm outputs container
export interface AlgorithmOutputs {
  percentiles: DomainPercentiles;
  riskScores: Record<string, number>;
  bayesianPosteriors: BayesianPosterior[];
  monteCarloResults: MonteCarloResult[];
  pageRankScores: PageRankScores;
  saturationProjections: SaturationProjection[];
  nutrientInteractions: NutrientInteraction[];
  developmentalAge: DevelopmentalAgeResult[];
  velocityResults: VelocityResult[];
  convergenceScore: ConvergenceScore;
  environmentalModifiers: Record<string, number>;
  longitudinalTrends: VelocityResult[];
  // V4 new algorithms
  phenotypicProfile: PhenotypicProfile;
  latentHealthScore: LatentHealthScore;
  mediationResults: MediationResult[];
  anomalyAlerts: AnomalyVelocityAlert[];
  bioavailabilityScores: Record<string, number>;
  sleepProxy: SleepProxyScore;
  resilienceRiskRatio: ResilienceRiskRatio;
  compensatoryPattern: CompensatoryPattern;
  dbnBeliefState: DBNBeliefState;
  counterfactualRankings: CounterfactualRanking[];
  icd10Mappings: ICD10Mapping[];
  neurodivergenceResult: NeurodivergenceResult;
}

// ─── Layer 4: Hidden Pattern Outputs ─────────────────────────────────────

export interface HiddenPatternActivation {
  patternId: string;
  patternName: string;
  category: string;
  activated: boolean;
  confidence: number;
  clinicalRisk: string;
  actionPriority: ActionPriority;
  signalInputs: string;
  detectionMethod: string;
  recommendedActions: string[];
  // Phase 4: strength-weighted fields
  signalStrength?: number;
  urgencyTier?: "IMMEDIATE" | "HIGH" | "MONITOR" | "LOW";
}

export interface PatternActivationVector {
  patterns: HiddenPatternActivation[];
  activatedCount: number;
  highPriorityCount: number;
}

// ─── Layer 5: Action Plan ────────────────────────────────────────────────

export interface InterventionItem {
  id: string;
  domain: string;
  title: string;
  description: string;
  frequency: string;
  durationMinutes: number;
  tier: InterventionTier;
  expectedUtility: number;
  pageRankLeverage: number;
  feasibility: number;
  compositeScore: number;
  linkedPatterns: string[];
  indianFoodAlternatives?: string[];
  effortLevel: "quick_win" | "core_habit" | "lifestyle_shift";
}

export interface WeeklyPlan {
  weekRange: string;
  phase: string;
  physical: InterventionItem[];
  cognitive: InterventionItem[];
  dietary: InterventionItem[];
  psychosocial: InterventionItem[];
  trackingMetrics: string[];
}

export interface ActionPlan {
  childId: string;
  generatedAt: string;
  phenotypicProfile: string;
  tier0Alerts: string[];
  weeklyPlans: WeeklyPlan[];
  totalInterventions: number;
  topPriorityInterventions: InterventionItem[];
  parentCommunication: ParentReport;
}

export interface ParentReport {
  summary: string;
  strengths: string[];
  areasForGrowth: string[];
  quickWins: string[];
  coreHabits: string[];
  lifestyleShifts: string[];
  referralRecommendations: string[];
  expectedOutcomes: string[];
}

// ─── Longitudinal / Session Data ─────────────────────────────────────────

export interface AssessmentSession {
  sessionNumber: number;
  date: string;
  percentiles: DomainPercentiles;
  algorithmOutputs: AlgorithmOutputs;
  patternActivations: PatternActivationVector;
  actionPlan: ActionPlan;
}

export interface InterventionTrackingResult {
  interventionId: string;
  actualDelta: number;
  expectedDelta: number;
  outcome: InterventionOutcome;
  recommendation: string;
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────

export interface KGNode {
  id: string;
  label: string;
  type: "condition" | "nutrient" | "symptom" | "pathway" | "intervention"
    | "food" | "milestone" | "temporal_transition" | "icd10";
  domain: string;
  metadata: Record<string, any>;
}

export interface KGEdge {
  source: string;
  target: string;
  type: EdgeType;
  effectDirection: "positive" | "negative";
  effectMagnitude: number;
  evidenceLevel: EvidenceLevel;
  timeLagWeeks?: number;
  modulationFactor?: number;
}

// ─── Engine Output ───────────────────────────────────────────────────────

export interface EngineResult {
  childProfile: ChildProfile;
  percentiles: DomainPercentiles;
  algorithmOutputs: AlgorithmOutputs;
  patternActivations: PatternActivationVector;
  actionPlan: ActionPlan;
  interventionTracking?: InterventionTrackingResult[];
  metadata: {
    engineVersion: string;
    computeTimeMs: number;
    algorithmsExecuted: number;
    patternsEvaluated: number;
    patternsActivated: number;
  };
}
