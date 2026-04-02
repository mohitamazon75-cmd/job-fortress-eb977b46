// KidVital360 — Proprietary Knowledge Graph & Scientific Data Layer
// Gender-specific, age-specific benchmarks (Indian pediatric + WHO + ICMR)

export interface BenchmarkRange {
  [key: string]: [number, number];
}

export interface AgeGroupBenchmarks {
  [ageGroup: string]: BenchmarkRange;
}

export interface GenderBenchmarks {
  male: AgeGroupBenchmarks;
  female: AgeGroupBenchmarks;
}

export interface CausalChain {
  id: string;
  trigger: [string, string, string, number][];
  pathway: string;
  affects: [string, string][];
  severity: string;
  indiaPrevalence: number;
  researchBase: string;
  riskIn6Months: number;
  riskIn12Months: number;
  interventionWindow: string;
}

export interface FoodCategory {
  foods: string[];
  perServing: string;
  tip: string;
}

export const SCIENCE = {
  benchmarks: {
    physical: {
      male: {
        // COORDINATION CALIBRATION (2026-02 audit):
        // Metric = ball-catch score 0-100, where score = (catches out of 10) × 10.
        // Prior ranges [68,94] were grossly inflated — placing 55 raw (5.5 catches) at 0th pct.
        // Recalibrated to real Indian pediatric motor norms (Bruininks-Oseretsky, IAP motor studies):
        //   4-6yo: μ≈42 (4.2 catches typical)  → range [28, 57]
        //   7-9yo: μ≈57 (5.7 catches typical)  → range [40, 74]
        //   10-12yo: μ≈68 (6.8 catches typical) → range [52, 84]
        //   13-15yo: μ≈76 (7.6 catches typical) → range [60, 92]
        //   16-18yo: μ≈82 (8.2 catches typical) → range [67, 97]
        // Verification: 55 raw (7-9yo) → ~43rd percentile (correct — slightly below average)
        "4-6": { bmi: [13.8, 17.2], flexibility: [14, 28], balance: [7, 18], endurance: [3, 7], grip: [4.5, 10], coordination: [28, 57] },
        "7-9": { bmi: [14.2, 18.8], flexibility: [16, 32], balance: [10, 28], endurance: [5, 11], grip: [9, 19], coordination: [40, 74] },
        "10-12": { bmi: [15.2, 21.2], flexibility: [18, 36], balance: [14, 38], endurance: [7, 14], grip: [14, 27], coordination: [52, 84] },
        "13-15": { bmi: [16.5, 23.5], flexibility: [20, 38], balance: [16, 42], endurance: [8, 17], grip: [22, 40], coordination: [60, 92] },
        "16-18": { bmi: [17.8, 25.2], flexibility: [18, 36], balance: [18, 48], endurance: [10, 20], grip: [30, 50], coordination: [67, 97] },
      },
      female: {
        // Female coordination slightly higher than male at younger ages (better fine motor maturation)
        "4-6": { bmi: [13.2, 17.8], flexibility: [16, 32], balance: [8, 22], endurance: [3, 7], grip: [3.5, 8.5], coordination: [32, 62] },
        "7-9": { bmi: [13.8, 19.2], flexibility: [20, 38], balance: [12, 32], endurance: [4, 10], grip: [7, 16], coordination: [44, 78] },
        "10-12": { bmi: [14.8, 21.8], flexibility: [24, 44], balance: [16, 42], endurance: [6, 13], grip: [10, 22], coordination: [56, 86] },
        "13-15": { bmi: [15.8, 24.0], flexibility: [26, 46], balance: [18, 44], endurance: [7, 15], grip: [14, 28], coordination: [62, 92] },
        "16-18": { bmi: [16.5, 25.5], flexibility: [24, 44], balance: [20, 48], endurance: [8, 16], grip: [18, 32], coordination: [67, 97] },
      },
    } as GenderBenchmarks,
    // IMPORTANT: Cognitive inputs arrive as already-normalised percentiles (0-100) from scoreCognitiveGames().
    // Using [1, 99] as a passthrough range: μ=50, σ≈32.7 → input 50 → z=0 → 50th pct (correct).
    // Previous ranges like [50, 85] were raw game-score ranges causing severe double-conversion downshift.
    cognitive: {
      "4-6":   { attention: [1, 99], memory: [1, 99], processing: [1, 99], reasoning: [1, 99], emotional: [1, 99] },
      "7-9":   { attention: [1, 99], memory: [1, 99], processing: [1, 99], reasoning: [1, 99], emotional: [1, 99] },
      "10-12": { attention: [1, 99], memory: [1, 99], processing: [1, 99], reasoning: [1, 99], emotional: [1, 99] },
      "13-15": { attention: [1, 99], memory: [1, 99], processing: [1, 99], reasoning: [1, 99], emotional: [1, 99] },
      "16-18": { attention: [1, 99], memory: [1, 99], processing: [1, 99], reasoning: [1, 99], emotional: [1, 99] },
    } as AgeGroupBenchmarks,
    // NUTRITIONAL BENCHMARK CALIBRATION — NNMB 2011-12 / CNNS 2016-18 ANCHORED
    // ─────────────────────────────────────────────────────────────────────────────────
    // CRITICAL: Ranges are NOT set at RDA midpoint. They represent the ACTUAL DISTRIBUTION
    // of Indian children's intake from national dietary surveys (NNMB, CNNS, ICMR-NIN).
    //
    // The z-score engine models each range as [μ − 1.5σ, μ + 1.5σ], so:
    //   μ = (lo + hi) / 2   (should equal real Indian median intake)
    //   σ = (hi − lo) / 3   (should represent real population SD)
    //
    // A child eating exactly at the Indian median for their age → 50th percentile.
    // A child eating at the ICMR full RDA → ~75th–85th percentile (above average in India).
    //
    // DATA SOURCES:
    //   - Calories/Protein/Iron/Calcium: NNMB 2011-12, CNNS 2016-18, ICMR-NIN 2020
    //   - Fiber: estimated from NNMB cereal/vegetable data (~10–12g real median for 7-9yo)
    //   - Water: NNMB fluid intake survey data (~1.2–1.5L real median for school-age children)
    //
    // EXAMPLE (Iron, 7-9yo, male):
    //   Old range [10, 16]: μ=13mg, a child eating 10mg/day scored 7th pct (wrong — that IS average)
    //   New range [7, 13]:  μ=10mg, a child eating 10mg/day scores 50th pct (correct — near RDA)
    // ─────────────────────────────────────────────────────────────────────────────────
    nutritional: {
      male: {
        // 4-6yo: NNMB median ~1100kcal, protein ~22g, calcium ~350mg, iron ~7mg, fiber ~9g, water ~1.0L
        "4-6": { calories: [850, 1350], protein: [13, 23], calcium: [250, 550], iron: [5, 11], fiber: [7, 13], water: [0.9, 1.5] },
        // 7-9yo: NNMB median ~1350kcal, protein ~28g, calcium ~500mg, iron ~10mg, fiber ~12g, water ~1.3L
        "7-9": { calories: [1050, 1650], protein: [20, 36], calcium: [350, 700], iron: [7, 13], fiber: [9, 15], water: [1.0, 1.6] },
        // 10-12yo: NNMB median ~1600kcal, protein ~36g, calcium ~650mg, iron ~11mg, fiber ~16g, water ~1.6L
        "10-12": { calories: [1300, 1900], protein: [26, 46], calcium: [500, 900], iron: [8, 14], fiber: [13, 19], water: [1.3, 1.9] },
        // 13-15yo: NNMB median ~1900kcal, protein ~44g, calcium ~700mg, iron ~14mg, fiber ~18g, water ~1.9L
        "13-15": { calories: [1550, 2250], protein: [34, 54], calcium: [550, 950], iron: [10, 18], fiber: [15, 23], water: [1.6, 2.4] },
        // 16-18yo: NNMB median ~2100kcal, protein ~50g, calcium ~750mg, iron ~14mg, fiber ~20g, water ~2.1L
        "16-18": { calories: [1700, 2500], protein: [38, 62], calcium: [600, 1000], iron: [10, 18], fiber: [16, 26], water: [1.8, 2.6] },
      },
      female: {
        // 4-6yo: NNMB median ~1000kcal, protein ~20g, calcium ~320mg, iron ~7mg, fiber ~9g, water ~0.9L
        "4-6": { calories: [750, 1250], protein: [12, 22], calcium: [220, 520], iron: [5, 11], fiber: [7, 13], water: [0.8, 1.4] },
        // 7-9yo: NNMB median ~1250kcal, protein ~26g, calcium ~460mg, iron ~10mg, fiber ~11g, water ~1.2L
        "7-9": { calories: [950, 1550], protein: [18, 34], calcium: [310, 650], iron: [7, 13], fiber: [8, 14], water: [0.9, 1.5] },
        // 10-12yo: NNMB median ~1450kcal, protein ~32g, calcium ~600mg, iron ~13mg, fiber ~14g, water ~1.4L
        "10-12": { calories: [1150, 1750], protein: [24, 42], calcium: [460, 820], iron: [9, 17], fiber: [11, 17], water: [1.1, 1.7] },
        // 13-15yo: NNMB median ~1600kcal, protein ~38g, calcium ~650mg, iron ~18mg (post-menarche), fiber ~16g, water ~1.6L
        "13-15": { calories: [1300, 1900], protein: [30, 48], calcium: [500, 880], iron: [14, 24], fiber: [13, 19], water: [1.3, 1.9] },
        // 16-18yo: NNMB median ~1700kcal, protein ~40g, calcium ~680mg, iron ~20mg, fiber ~17g, water ~1.7L
        "16-18": { calories: [1400, 2000], protein: [32, 52], calcium: [540, 900], iron: [16, 26], fiber: [14, 20], water: [1.4, 2.0] },
      },
    } as GenderBenchmarks,
  },

  devMilestones: {
    physical: {
      // Coordination milestones recalibrated: score = catches/10 × 10. Average Indian child catches ~4/10 at 5yo,
      // ~6/10 at 9yo, ~7/10 at 13yo. Old values (82 at age 9) reflected elite performance, not typical milestones.
      5: { balance: 10, coordination: 40, flexibility: 18, endurance: 4 },
      7: { balance: 18, coordination: 52, flexibility: 22, endurance: 7 },
      9: { balance: 25, coordination: 60, flexibility: 28, endurance: 9 },
      11: { balance: 32, coordination: 68, flexibility: 34, endurance: 11 },
      13: { balance: 38, coordination: 74, flexibility: 36, endurance: 14 },
      15: { balance: 42, coordination: 80, flexibility: 38, endurance: 17 },
      17: { balance: 46, coordination: 85, flexibility: 36, endurance: 19 },
    } as Record<number, Record<string, number>>,
    cognitive: {
      5: { attention: 55, memory: 50, processing: 45, reasoning: 38, emotional: 42 },
      7: { attention: 65, memory: 60, processing: 55, reasoning: 48, emotional: 52 },
      9: { attention: 72, memory: 68, processing: 62, reasoning: 58, emotional: 62 },
      11: { attention: 78, memory: 74, processing: 72, reasoning: 68, emotional: 68 },
      13: { attention: 82, memory: 78, processing: 78, reasoning: 76, emotional: 74 },
      15: { attention: 88, memory: 84, processing: 84, reasoning: 84, emotional: 80 },
      17: { attention: 92, memory: 88, processing: 88, reasoning: 88, emotional: 85 },
    } as Record<number, Record<string, number>>,
  },

  indiaRiskFactors: {
    ironDeficiency: { prevalence: 0.53, cognitiveImpact: 0.72, physicalImpact: 0.45, description: "53% of Indian children aged 5-14 have iron deficiency anemia (NFHS-5, 2021)" },
    vitaminD: { prevalence: 0.68, cognitiveImpact: 0.35, physicalImpact: 0.55, description: "68% prevalence of Vitamin D deficiency in Indian urban children" },
    proteinGap: { prevalence: 0.42, cognitiveImpact: 0.28, physicalImpact: 0.65, description: "Indian vegetarian children average 42% below RDA protein (ICMR study)" },
    obesity: { prevalence: 0.14, cognitiveImpact: 0.22, physicalImpact: 0.58, description: "Urban childhood obesity has tripled in India over 10 years" },
    screenTime: { prevalence: 0.71, cognitiveImpact: 0.62, physicalImpact: 0.38, description: "71% of urban Indian children exceed WHO screen time guidelines" },
    physicalInactivity: { prevalence: 0.64, cognitiveImpact: 0.45, physicalImpact: 0.78, description: "Only 36% of Indian children meet WHO physical activity guidelines" },
    calciumDeficit: { prevalence: 0.48, cognitiveImpact: 0.15, physicalImpact: 0.52, description: "48% of Indian children receive less than 50% RDA calcium" },
    zincDeficiency: { prevalence: 0.38, cognitiveImpact: 0.42, physicalImpact: 0.35, description: "Zinc deficiency impairs both immune function and cognitive development" },
  },

  causalChains: [
    // CALIBRATION NOTE: Causal chain triggers use strict thresholds (≤30th pct) to ensure
    // only genuinely low-scoring children activate chains, not average children (40-60th pct).
    { id: "iron-cognition", trigger: [["nutritional", "iron", "<", 30]], pathway: "Low iron → Reduced hemoglobin → Decreased cerebral oxygen → Impaired myelination → Slower neural processing", affects: [["cognitive", "processing"], ["cognitive", "memory"], ["cognitive", "attention"]], severity: "critical", indiaPrevalence: 53, researchBase: "Lancet 2020: Iron deficiency in first 1000 days causes irreversible cognitive deficit. AIIMS Delhi study shows 2.3x higher learning disability risk.", riskIn6Months: 0.72, riskIn12Months: 0.88, interventionWindow: "Immediate — iron stores deplete within 3-4 months without intervention" },
    { id: "cardio-prefrontal", trigger: [["physical", "endurance", "<", 30]], pathway: "Low cardiorespiratory fitness → Reduced BDNF secretion → Decreased hippocampal volume → Impaired prefrontal cortex function", affects: [["cognitive", "attention"], ["cognitive", "reasoning"]], severity: "high", indiaPrevalence: 64, researchBase: "Hillman et al. (2019): Aerobic fitness explains 15-20% of variance in academic performance.", riskIn6Months: 0.45, riskIn12Months: 0.67, interventionWindow: "8-12 weeks of structured aerobic activity shows measurable cognitive improvement" },
    { id: "calcium-motor", trigger: [["nutritional", "calcium", "<", 30]], pathway: "Low calcium → Impaired bone mineralization → Reduced proprioceptive feedback → Compromised balance & motor coordination", affects: [["physical", "balance"], ["physical", "coordination"]], severity: "high", indiaPrevalence: 48, researchBase: "Indian Pediatrics Journal 2022: Calcium deficiency is primary cause of motor delay in 35% of referred children.", riskIn6Months: 0.52, riskIn12Months: 0.71, interventionWindow: "Bone density responds within 6 months; motor skills within 3-4 months with supplementation + exercise" },
    { id: "protein-muscle", trigger: [["nutritional", "protein", "<", 25]], pathway: "Inadequate protein → Negative nitrogen balance → Muscle wasting → Reduced grip strength & endurance → Chronic fatigue cycle", affects: [["physical", "grip"], ["physical", "endurance"]], severity: "high", indiaPrevalence: 42, researchBase: "ICMR 2023 guidelines: Indian vegetarian children require 20% more protein than current RDA.", riskIn6Months: 0.55, riskIn12Months: 0.78, interventionWindow: "Muscle protein synthesis responds within 2-4 weeks of adequate intake" },
    // screen-emotional: requires BOTH very low emotional regulation AND low attention — moderate scores alone don't trigger
    { id: "screen-emotional", trigger: [["cognitive", "emotional", "<", 28], ["cognitive", "attention", "<", 35]], pathway: "Screen overuse → Dopamine desensitization → Reduced emotional granularity → Impaired theory of mind → Social withdrawal", affects: [["cognitive", "attention"], ["cognitive", "emotional"]], severity: "high", indiaPrevalence: 71, researchBase: "JAMA Pediatrics 2023: >2hrs/day screen time associated with 47% higher emotional dysregulation.", riskIn6Months: 0.48, riskIn12Months: 0.65, interventionWindow: "Neuroplasticity allows recovery within 4-8 weeks of structured intervention" },
    // vitd-immune-physical: tightened both thresholds to 30 — 40th pct is normal fitness
    { id: "vitd-immune-physical", trigger: [["nutritional", "calcium", "<", 30], ["physical", "endurance", "<", 30]], pathway: "Low Vitamin D + Calcium → Musculoskeletal weakness → Exercise intolerance → Sedentary behavior reinforcement loop", affects: [["physical", "endurance"], ["physical", "grip"], ["physical", "balance"]], severity: "high", indiaPrevalence: 68, researchBase: "68% of Indian urban children are Vitamin D deficient due to indoor lifestyles and air pollution.", riskIn6Months: 0.62, riskIn12Months: 0.79, interventionWindow: "20 min morning sunlight + dietary Vitamin D. Serum levels normalize in 8-12 weeks" },
    { id: "flexibility-stress-cortisol", trigger: [["physical", "flexibility", "<", 25], ["cognitive", "emotional", "<", 30]], pathway: "Chronic muscle tension → Elevated cortisol → HPA axis dysregulation → Anxiety & emotional volatility → Further muscle guarding", affects: [["cognitive", "emotional"], ["cognitive", "attention"]], severity: "medium", indiaPrevalence: 35, researchBase: "Pediatric stress research shows bidirectional musculoskeletal-cortisol pathway.", riskIn6Months: 0.38, riskIn12Months: 0.55, interventionWindow: "Daily yoga/stretching shows cortisol reduction within 3-6 weeks" },
    { id: "coordination-spatial", trigger: [["physical", "coordination", "<", 30], ["cognitive", "reasoning", "<", 35]], pathway: "Poor bilateral coordination → Underdeveloped corpus callosum → Impaired spatial reasoning → Academic difficulty in math/science", affects: [["cognitive", "reasoning"], ["cognitive", "processing"]], severity: "medium", indiaPrevalence: 28, researchBase: "Diamond (2000): Motor-cognitive co-development. Cross-body exercises improve math scores by 15%.", riskIn6Months: 0.35, riskIn12Months: 0.52, interventionWindow: "Bilateral motor training: measurable cognitive gains in 6-10 weeks" },
    { id: "fiber-gut-brain", trigger: [["nutritional", "fiber", "<", 25]], pathway: "Low fiber → Gut dysbiosis → Reduced serotonin production (95% is gut-derived) → Mood instability → Attention deficit", affects: [["cognitive", "emotional"], ["cognitive", "attention"]], severity: "medium", indiaPrevalence: 40, researchBase: "Gut-brain axis research: 95% of serotonin is produced in the gut.", riskIn6Months: 0.32, riskIn12Months: 0.48, interventionWindow: "Gut microbiome shifts within 2-4 weeks of dietary fiber increase" },
    // zinc-immune-growth: fixed to use iron+protein proxy (zinc not directly measured), tightened to 30th pct
    { id: "zinc-immune-growth", trigger: [["nutritional", "iron", "<", 30], ["nutritional", "protein", "<", 35]], pathway: "Zinc & micronutrient deficit → Impaired immune function → Frequent illness → School absenteeism → Cognitive gaps + physical deconditioning", affects: [["cognitive", "memory"], ["physical", "endurance"]], severity: "medium", indiaPrevalence: 38, researchBase: "Zinc deficiency affects 38% of Indian children, causing 2-3 additional sick days per month.", riskIn6Months: 0.42, riskIn12Months: 0.58, interventionWindow: "Zinc supplementation reduces illness frequency within 4-6 weeks" },
    // bmi-metabolic-cognitive: raised threshold to 85th pct (clinical overweight) — 70th is healthy
    { id: "bmi-metabolic-cognitive", trigger: [["physical", "bmi", ">", 85]], pathway: "Elevated BMI → Insulin resistance → Neuroinflammation → Reduced hippocampal neurogenesis → Memory & learning impairment", affects: [["cognitive", "memory"], ["cognitive", "processing"]], severity: "high", indiaPrevalence: 14, researchBase: "Childhood obesity tripled in urban India. AIIMS study links BMI >85th percentile to 30% lower academic performance.", riskIn6Months: 0.35, riskIn12Months: 0.58, interventionWindow: "Metabolic markers improve within 8-12 weeks of lifestyle intervention" },
    { id: "balance-vestibular-reading", trigger: [["physical", "balance", "<", 25]], pathway: "Poor vestibular function → Impaired oculomotor control → Difficulty with visual tracking → Reading fluency deficit", affects: [["cognitive", "processing"], ["cognitive", "attention"]], severity: "medium", indiaPrevalence: 22, researchBase: "Balance training improves reading speed by 12-18% in children 6-10.", riskIn6Months: 0.28, riskIn12Months: 0.42, interventionWindow: "Vestibular training: 15 min/day for 6 weeks shows measurable reading improvement" },
    // omega3-neural-development: requires BOTH low fiber AND low reasoning — tightened from 35→28 and 40→32
    { id: "omega3-neural-development", trigger: [["nutritional", "fiber", "<", 28], ["cognitive", "reasoning", "<", 32]], pathway: "Low omega-3 DHA → Impaired synaptic plasticity → Reduced neural network efficiency → Poor executive function", affects: [["cognitive", "reasoning"], ["cognitive", "memory"]], severity: "high", indiaPrevalence: 55, researchBase: "55% of Indian children have suboptimal omega-3. ICMR recommends flaxseed, walnuts, and fish.", riskIn6Months: 0.45, riskIn12Months: 0.62, interventionWindow: "DHA incorporation into neural membranes: 8-12 weeks of supplementation" },
    { id: "underweight-malnutrition", trigger: [["physical", "bmi", "<", 15]], pathway: "Low BMI → Chronic energy deficit → Protein catabolism for energy → Muscle wasting → Immune suppression → Frequent illness → Growth stunting", affects: [["physical", "grip"], ["physical", "endurance"], ["cognitive", "memory"], ["cognitive", "processing"]], severity: "critical", indiaPrevalence: 35, researchBase: "NFHS-5: 35.5% of Indian children under 5 are underweight. Underweight children have 2.5x higher infection risk and 1.8x lower academic performance (AIIMS 2023).", riskIn6Months: 0.65, riskIn12Months: 0.82, interventionWindow: "Caloric and protein restoration shows measurable weight gain within 4-8 weeks. Growth catch-up possible if addressed before puberty." },
    { id: "underweight-immune-cognitive", trigger: [["physical", "bmi", "<", 20], ["nutritional", "protein", "<", 35]], pathway: "Underweight + protein deficit → Impaired antibody production → Recurrent infections → School absenteeism → Cognitive gaps → Further appetite loss", affects: [["cognitive", "memory"], ["cognitive", "attention"], ["physical", "endurance"]], severity: "high", indiaPrevalence: 28, researchBase: "Indian Pediatrics 2023: Underweight children miss 2.5x more school days. Cognitive recovery requires nutritional rehabilitation + targeted learning support.", riskIn6Months: 0.55, riskIn12Months: 0.72, interventionWindow: "Nutritional rehabilitation shows immune improvement within 6-8 weeks. Cognitive catch-up requires concurrent learning support." },
  ] as CausalChain[],

  indianFoods: {
    protein: { foods: ["Paneer", "Dal (Moong/Masoor/Toor)", "Chana", "Rajma", "Soybean chunks", "Sprouts", "Curd/Dahi", "Eggs", "Chicken breast", "Fish (Rohu/Surmai)"], perServing: "6-20g per serving", tip: "Combine dal + rice for complete amino acid profile" },
    calcium: { foods: ["Milk (300ml = 300mg Ca)", "Curd/Dahi", "Paneer", "Ragi/Nachni (344mg/100g)", "Sesame/Til (975mg/100g)", "Amaranth/Rajgira", "Moringa leaves (185mg/100g)"], perServing: "100-350mg per serving", tip: "Ragi is the richest non-dairy calcium source — ideal for lactose intolerant children" },
    iron: { foods: ["Spinach/Palak", "Beetroot", "Jaggery/Gud (11mg/100g)", "Dates/Khajur", "Pomegranate", "Watermelon seeds (7.3mg/100g)", "Black sesame", "Garden cress seeds/Halim (100mg/100g)"], perServing: "2-8mg per serving", tip: "ALWAYS pair iron foods with Vitamin C (amla, lemon) — increases absorption 6x" },
    fiber: { foods: ["Ragi (11g/100g)", "Jowar (10g/100g)", "Bajra (11.5g/100g)", "Oats", "Guava (5g/fruit)", "Apple with skin", "Carrots", "Sweet potato/Shakarkandi"], perServing: "2-6g per serving", tip: "Traditional Indian millets are prebiotic powerhouses — they feed beneficial gut bacteria" },
    omega3: { foods: ["Flaxseeds/Alsi (22g ALA/100g)", "Walnuts/Akhrot", "Chia seeds", "Fish (Rohu, Surmai, Bangda)", "Fish oil supplement"], perServing: "0.3-2g per serving", tip: "Grind flaxseeds fresh — whole seeds pass undigested. 1 tbsp daily is sufficient." },
    zinc: { foods: ["Pumpkin seeds (7.8mg/100g)", "Cashews/Kaju", "Chickpeas/Chana", "Yogurt/Dahi", "Chicken", "Lentils/Dal"], perServing: "1-4mg per serving", tip: "Soaking and sprouting legumes increases zinc bioavailability by 50%" },
    vitaminD: { foods: ["Morning sunlight (15-20 min)", "Egg yolks", "Fortified milk", "Mushrooms (sun-dried)", "Fish liver oil"], perServing: "40-200 IU per serving", tip: "Best source is 15-20 min of morning sun (before 10 AM) on arms and face without sunscreen" },
  } as Record<string, FoodCategory>,

  // ═══ ENVIRONMENTAL MODULATION TABLES ═══
  // Adjusts priors and benchmarks based on socioeconomic context
  environmentalModifiers: {
    cityTier: {
      tier1: { vitaminD: 1.15, physicalInactivity: 1.20, obesity: 1.35, screenTime: 1.25, ironDeficiency: 0.85, proteinGap: 0.80 },
      tier2: { vitaminD: 1.05, physicalInactivity: 1.05, obesity: 1.10, screenTime: 1.05, ironDeficiency: 1.0, proteinGap: 0.95 },
      tier3: { vitaminD: 0.80, physicalInactivity: 0.75, obesity: 0.65, screenTime: 0.70, ironDeficiency: 1.20, proteinGap: 1.25 },
    } as Record<string, Record<string, number>>,
    schoolType: {
      private: { physicalInactivity: 1.10, screenTime: 1.15, obesity: 1.15, proteinGap: 0.85 },
      government: { physicalInactivity: 0.90, screenTime: 0.80, obesity: 0.80, proteinGap: 1.20 },
      international: { physicalInactivity: 0.95, screenTime: 1.20, obesity: 1.10, proteinGap: 0.75 },
      homeschool: { physicalInactivity: 1.25, screenTime: 1.30, obesity: 1.05, proteinGap: 0.90 },
    } as Record<string, Record<string, number>>,
    dietType: {
      vegetarian: { proteinBioavailability: 0.78, ironBioavailability: 0.65, zincBioavailability: 0.72, b12Risk: 1.45, calciumBioavailability: 1.05 },
      vegan: { proteinBioavailability: 0.68, ironBioavailability: 0.55, zincBioavailability: 0.62, b12Risk: 2.20, calciumBioavailability: 0.85 },
      "non-vegetarian": { proteinBioavailability: 1.0, ironBioavailability: 1.0, zincBioavailability: 1.0, b12Risk: 0.85, calciumBioavailability: 1.0 },
      eggetarian: { proteinBioavailability: 0.88, ironBioavailability: 0.75, zincBioavailability: 0.82, b12Risk: 1.0, calciumBioavailability: 1.0 },
    } as Record<string, Record<string, number>>,
    screenTime: {
      "<1hr": { attentionModifier: 1.0, emotionalModifier: 1.0, physicalModifier: 1.0, sleepModifier: 1.0 },
      "1-2hr": { attentionModifier: 0.95, emotionalModifier: 0.97, physicalModifier: 0.95, sleepModifier: 0.97 },
      "2-4hr": { attentionModifier: 0.82, emotionalModifier: 0.85, physicalModifier: 0.85, sleepModifier: 0.88 },
      "4+hr": { attentionModifier: 0.65, emotionalModifier: 0.72, physicalModifier: 0.75, sleepModifier: 0.78 },
    } as Record<string, Record<string, number>>,
  },

  // ═══ SCREEN TIME CAUSAL CHAINS ═══
  screenTimeCausalChains: [
    { id: "screen-dopamine-attention", trigger: [["screen", "hours", ">", 2]], pathway: "Excessive screen → Dopamine receptor downregulation → Reduced baseline dopamine → Inability to sustain attention on non-screen tasks → Academic underperformance", affects: [["cognitive", "attention"], ["cognitive", "emotional"]], severity: "high", indiaPrevalence: 71, researchBase: "JAMA Pediatrics 2023: Each additional hour of screen time >2hr/day associated with 23% attention decline. NIMHANS 2024 Indian urban study confirms.", riskIn6Months: 0.52, riskIn12Months: 0.72, interventionWindow: "Neuroplasticity allows recovery within 4-8 weeks of reduced screen time" },
    { id: "screen-myopia-processing", trigger: [["screen", "hours", ">", 3]], pathway: "Prolonged near-focus → Ciliary muscle spasm → Accommodative dysfunction → Visual fatigue → Slower visual processing → Reduced reading speed", affects: [["cognitive", "processing"], ["cognitive", "attention"]], severity: "high", indiaPrevalence: 45, researchBase: "Lancet Digital Health 2023: Indian children spending >3hr/day on screens have 2.5x myopia progression rate.", riskIn6Months: 0.45, riskIn12Months: 0.68, interventionWindow: "20-20-20 rule + outdoor time. Myopia progression slows within 6 months of intervention" },
    { id: "screen-sleep-cortisol", trigger: [["screen", "hours", ">", 2]], pathway: "Blue light exposure → Melatonin suppression → Delayed sleep onset → Chronic sleep debt → Elevated cortisol → Impaired memory consolidation + emotional dysregulation", affects: [["cognitive", "memory"], ["cognitive", "emotional"]], severity: "high", indiaPrevalence: 58, researchBase: "Sleep Medicine Reviews 2023: Screen use within 1hr of bedtime reduces REM sleep by 22%, directly impairing memory consolidation.", riskIn6Months: 0.48, riskIn12Months: 0.65, interventionWindow: "No screens 1hr before bed. Sleep architecture normalizes within 2-3 weeks" },
    { id: "screen-sedentary-metabolic", trigger: [["screen", "hours", ">", 3]], pathway: "Screen sedentarism → Reduced NEAT (non-exercise activity thermogenesis) → Positive energy balance → Insulin resistance → Central adiposity → Chronic inflammation", affects: [["physical", "endurance"], ["physical", "bmi"]], severity: "high", indiaPrevalence: 42, researchBase: "Indian Pediatrics 2024: >3hr/day screen children have 1.8x higher BMI velocity than active peers.", riskIn6Months: 0.38, riskIn12Months: 0.58, interventionWindow: "Replace 30min screen with active play daily. Metabolic markers improve within 8-12 weeks" },
  ] as CausalChain[],
};
