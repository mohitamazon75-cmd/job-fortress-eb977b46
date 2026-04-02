// KidVital360 — NeuroNest Research Data Layer
// Integrated from NeuroNest v2.0/v2.1 (superior research foundations)
// Research Base: CNNS 2016-18, ICMR-NIN 2020, WHO Growth Reference 5-19,
//   IAP 2015, 25+ peer-reviewed studies including 2023-2025 meta-analyses
// ============================================================================

// =============================================================================
// SECTION 1: IAP 2015 GROWTH REFERENCE DATA (Indian-specific)
// Source: Khadilkar et al., Indian Pediatrics 2015;52:47-55
// Data from 87,022 Indian children across 14 cities, all 5 zones.
// =============================================================================

export const IAP_2015_HEIGHT_P50: Record<string, Record<number, number>> = {
  M: {
    6: 114.4, 7: 119.9, 8: 125.2, 9: 130.0, 10: 134.6,
    11: 139.5, 12: 145.0, 13: 151.5, 14: 159.0, 15: 164.5,
    16: 168.5, 17: 170.5, 18: 171.5,
  },
  F: {
    6: 113.2, 7: 118.8, 8: 124.3, 9: 129.8, 10: 135.5,
    11: 141.5, 12: 147.0, 13: 151.0, 14: 154.0, 15: 155.8,
    16: 156.8, 17: 157.3, 18: 157.8,
  },
};

export const IAP_2015_WEIGHT_P50: Record<string, Record<number, number>> = {
  M: {
    6: 18.5, 7: 20.7, 8: 23.0, 9: 25.4, 10: 27.9,
    11: 30.8, 12: 34.2, 13: 38.5, 14: 44.0, 15: 49.5,
    16: 54.0, 17: 57.0, 18: 58.5,
  },
  F: {
    6: 17.5, 7: 19.8, 8: 22.2, 9: 25.0, 10: 28.2,
    11: 31.8, 12: 36.0, 13: 39.5, 14: 42.5, 15: 45.0,
    16: 47.0, 17: 48.5, 18: 49.5,
  },
};

/**
 * IAP 2015 BMI Percentile Cutoffs (IOTF Asian-adjusted)
 * Uses adult-equivalent BMI 23 for overweight and 27 for obesity
 * reflecting higher cardiometabolic risk in Asian populations at lower BMI thresholds.
 */
export const IAP_2015_BMI_CUTOFFS: Record<string, Record<number, { p3: number; p50: number; ow23: number; ob27: number }>> = {
  M: {
    6:  { p3: 12.5, p50: 14.8, ow23: 16.5, ob27: 18.2 },
    7:  { p3: 12.7, p50: 15.0, ow23: 17.0, ob27: 19.0 },
    8:  { p3: 12.8, p50: 15.2, ow23: 17.5, ob27: 19.8 },
    9:  { p3: 13.0, p50: 15.5, ow23: 18.0, ob27: 20.7 },
    10: { p3: 13.2, p50: 15.8, ow23: 18.5, ob27: 21.5 },
    11: { p3: 13.5, p50: 16.2, ow23: 19.0, ob27: 22.2 },
    12: { p3: 13.8, p50: 16.7, ow23: 19.5, ob27: 22.8 },
    13: { p3: 14.2, p50: 17.3, ow23: 20.0, ob27: 23.3 },
    14: { p3: 14.8, p50: 18.0, ow23: 20.5, ob27: 23.8 },
    15: { p3: 15.3, p50: 18.7, ow23: 21.0, ob27: 24.2 },
    16: { p3: 15.8, p50: 19.3, ow23: 21.5, ob27: 24.5 },
    17: { p3: 16.2, p50: 19.8, ow23: 22.0, ob27: 25.0 },
    18: { p3: 16.5, p50: 20.2, ow23: 23.0, ob27: 27.0 },
  },
  F: {
    6:  { p3: 12.3, p50: 14.5, ow23: 16.5, ob27: 18.5 },
    7:  { p3: 12.4, p50: 14.7, ow23: 17.0, ob27: 19.2 },
    8:  { p3: 12.5, p50: 15.0, ow23: 17.5, ob27: 20.0 },
    9:  { p3: 12.7, p50: 15.3, ow23: 18.0, ob27: 20.8 },
    10: { p3: 13.0, p50: 15.7, ow23: 18.5, ob27: 21.5 },
    11: { p3: 13.3, p50: 16.2, ow23: 19.0, ob27: 22.2 },
    12: { p3: 13.7, p50: 16.8, ow23: 19.5, ob27: 22.8 },
    13: { p3: 14.2, p50: 17.5, ow23: 20.2, ob27: 23.3 },
    14: { p3: 14.8, p50: 18.2, ow23: 20.8, ob27: 23.8 },
    15: { p3: 15.2, p50: 18.8, ow23: 21.2, ob27: 24.2 },
    16: { p3: 15.5, p50: 19.2, ow23: 21.5, ob27: 24.5 },
    17: { p3: 15.8, p50: 19.5, ow23: 22.0, ob27: 25.0 },
    18: { p3: 16.0, p50: 19.8, ow23: 23.0, ob27: 27.0 },
  },
};

// =============================================================================
// SECTION 2: CNNS 2016-18 NATIONAL PREVALENCE DATA
// Source: MoHFW/UNICEF/Population Council, 2019.
// 112,316 children and adolescents; 51,029 biochemical samples.
// =============================================================================

export const CNNS_PREVALENCE = {
  anthropometric: {
    stunting:   { age_5_9: 21.8, age_10_19: 23.0 },
    thinness:   { age_5_9: 23.0, age_10_19: 24.0 },
    overweight: { age_5_9: 4.9,  age_10_19: 4.8  },
    obesity:    { age_5_9: 1.3,  age_10_19: 1.5  },
  },
  micronutrient: {
    iron_deficiency:      { age_5_9: 33.5, age_10_19: 28.4 },
    anemia:               { age_5_9: 23.5, age_10_19_boys: 17.3, age_10_19_girls: 39.7 },
    vitamin_d_deficiency: { age_5_9: 40.5, age_10_19: 24.0 },
    zinc_deficiency:      { age_5_9: 18.2, age_10_19: 32.0 },
    vitamin_b12_deficiency: { age_5_9: 14.2, age_10_19: 31.0 },
    folate_deficiency:    { age_5_9: 10.3, age_10_19: 14.5 },
    vitamin_a_deficiency: { age_5_9: 22.0, age_10_19: 15.8 },
  },
  urban_iron_def_multiplier: 1.35,
  ncd_risk: {
    prediabetes: 4.6,
    high_total_cholesterol: 5.1,
    high_ldl: 3.2,
    low_hdl: 27.2,
  },
};

// =============================================================================
// SECTION 3: ICMR-NIN 2020 DETAILED RDA (2-year age bands, 11 nutrients)
// Full granularity replacing coarser 5-year bands
// =============================================================================

export const ICMR_RDA_DETAILED: Record<string, {
  energy: number; protein: number; iron: number; calcium: number;
  zinc: number; vitA: number; vitC: number; vitD: number;
  vitB12: number; folate: number; fiber: number;
}> = {
  // Boys
  'M_6_7':   { energy: 1470, protein: 20.1, iron: 15, calcium: 800,  zinc: 5.9,  vitA: 490, vitC: 40, vitD: 10, vitB12: 1.0, folate: 120, fiber: 22 },
  'M_8_9':   { energy: 1850, protein: 29.5, iron: 15, calcium: 800,  zinc: 5.9,  vitA: 490, vitC: 40, vitD: 10, vitB12: 1.0, folate: 120, fiber: 28 },
  'M_10_11': { energy: 2190, protein: 39.9, iron: 16, calcium: 850,  zinc: 8.5,  vitA: 600, vitC: 40, vitD: 10, vitB12: 2.0, folate: 140, fiber: 33 },
  'M_12_13': { energy: 2480, protein: 49.6, iron: 22, calcium: 1000, zinc: 14.3, vitA: 600, vitC: 40, vitD: 10, vitB12: 2.0, folate: 140, fiber: 37 },
  'M_14_15': { energy: 2750, protein: 54.3, iron: 22, calcium: 1000, zinc: 14.3, vitA: 600, vitC: 50, vitD: 10, vitB12: 2.0, folate: 160, fiber: 41 },
  'M_16_18': { energy: 3020, protein: 61.5, iron: 26, calcium: 1050, zinc: 17.6, vitA: 600, vitC: 50, vitD: 10, vitB12: 2.0, folate: 160, fiber: 45 },
  // Girls
  'F_6_7':   { energy: 1330, protein: 20.1, iron: 15, calcium: 800,  zinc: 5.9,  vitA: 490, vitC: 40, vitD: 10, vitB12: 1.0, folate: 120, fiber: 20 },
  'F_8_9':   { energy: 1700, protein: 29.5, iron: 15, calcium: 800,  zinc: 5.9,  vitA: 490, vitC: 40, vitD: 10, vitB12: 1.0, folate: 120, fiber: 26 },
  'F_10_11': { energy: 2010, protein: 40.4, iron: 28, calcium: 850,  zinc: 8.5,  vitA: 600, vitC: 40, vitD: 10, vitB12: 2.0, folate: 140, fiber: 30 },
  'F_12_13': { energy: 2170, protein: 46.2, iron: 30, calcium: 1000, zinc: 12.8, vitA: 600, vitC: 40, vitD: 10, vitB12: 2.0, folate: 140, fiber: 33 },
  'F_14_15': { energy: 2330, protein: 51.9, iron: 30, calcium: 1000, zinc: 12.8, vitA: 600, vitC: 50, vitD: 10, vitB12: 2.0, folate: 160, fiber: 35 },
  'F_16_18': { energy: 2440, protein: 55.5, iron: 32, calcium: 1050, zinc: 14.2, vitA: 600, vitC: 50, vitD: 10, vitB12: 2.0, folate: 160, fiber: 37 },
};

export function getDetailedRDAKey(gender: string, age: number): string {
  const g = gender === 'female' ? 'F' : 'M';
  if (age < 8)  return `${g}_6_7`;
  if (age < 10) return `${g}_8_9`;
  if (age < 12) return `${g}_10_11`;
  if (age < 14) return `${g}_12_13`;
  if (age < 16) return `${g}_14_15`;
  return `${g}_16_18`;
}

// =============================================================================
// SECTION 4: BIOMARKER CLINICAL THRESHOLDS (WHO 2011 + IAP standards)
// =============================================================================

export const BIOMARKER_THRESHOLDS = {
  hemoglobin: {
    // g/dL — WHO 2011 age/gender specific thresholds
    severe_anemia:   { age_6_11: 8.0,  age_12_14: 8.0,  age_15_plus_M: 8.0,  age_15_plus_F: 8.0  },
    moderate_anemia: { age_6_11: 10.0, age_12_14: 10.0, age_15_plus_M: 11.0, age_15_plus_F: 10.0 },
    mild_anemia:     { age_6_11: 11.5, age_12_14: 12.0, age_15_plus_M: 13.0, age_15_plus_F: 12.0 },
  },
  ferritin: {
    depleted:  15,  // ng/mL — iron stores exhausted
    low:       30,  // ng/mL — suboptimal, cognitive impact starts
    adequate:  50,
  },
  vitaminD_25OH: {
    severe_deficiency: 10, // ng/mL
    deficiency:        20,
    insufficiency:     30,
    adequate:          40,
  },
  vitaminB12: {
    deficiency: 200, // pg/mL
    borderline: 300,
    adequate:   400,
  },
  zinc: {
    deficiency_M: 66, // µg/dL
    deficiency_F: 65,
  },
  hba1c: {
    prediabetic: 5.7, // %
    diabetic:    6.5,
  },
  thyroidTSH: {
    low:  0.4, // mIU/L
    high: 4.5,
  },
};

// =============================================================================
// SECTION 5: FITNESS REFERENCE NORMS (Indian-adapted)
// =============================================================================

export const FITNESS_NORMS_INDIA = {
  /** VO2max (mL/kg/min) — Healthy Fitness Zone boundaries (FITNESSGRAM adapted for India) */
  vo2max_healthy_zone: {
    'M_6_9':   [37, 52], 'F_6_9':   [35, 48],
    'M_10_12': [40, 55], 'F_10_12': [35, 48],
    'M_13_15': [42, 58], 'F_13_15': [35, 48],
    'M_16_18': [44, 60], 'F_16_18': [35, 48],
  },
  /** Handgrip strength (kg) — 50th percentile Indian reference */
  handgrip_p50: {
    'M_6_9':   12.5, 'F_6_9':   10.5,
    'M_10_12': 18.0, 'F_10_12': 15.5,
    'M_13_15': 28.0, 'F_13_15': 22.0,
    'M_16_18': 38.0, 'F_16_18': 24.0,
  },
  /** MVPA recommended minutes/day (WHO 2020) */
  mvpa_recommended: 60,
  /** Sleep recommended hours (NSF / AAP) */
  sleep_recommended: {
    age_6_13:  [9, 12] as [number, number],
    age_14_17: [8, 10] as [number, number],
  },
};

// =============================================================================
// SECTION 6: REGIONAL DIET PROFILES (India-specific)
// =============================================================================

export type IndiaRegion = 'north' | 'south' | 'east' | 'west' | 'central' | 'northeast';

export interface RegionalDietProfile {
  region: IndiaRegion;
  states: string[];
  dominantStaple: string;
  typicalProteinSources: string[];
  commonDeficiencyRisks: string[];
  strengthFoods: string[];
  recommendations: string[];
}

export const REGIONAL_DIET_PROFILES: Record<IndiaRegion, RegionalDietProfile> = {
  north: {
    region: 'north',
    states: ['Punjab', 'Haryana', 'UP', 'Rajasthan', 'HP', 'J&K', 'Delhi', 'Uttarakhand'],
    dominantStaple: 'Wheat (roti/paratha)',
    typicalProteinSources: ['Dairy (paneer, curd, lassi)', 'Pulses (rajma, chole)', 'Occasional meat'],
    commonDeficiencyRisks: ['Iron (tea with meals inhibits absorption)', 'Vitamin D (indoor lifestyles)', 'Fiber (refined maida overuse)'],
    strengthFoods: ['Dairy is excellent and abundant', 'Mustard oil provides omega-3', 'Seasonal fruits accessible'],
    recommendations: [
      'Switch to whole wheat atta from maida in all preparations',
      'Add ragi/bajra rotis 2-3 times/week for iron and calcium',
      'Drink tea/chai at least 1 hour away from meals to protect iron absorption',
      'Leverage the dairy tradition: ensure 2 glasses milk or 1 bowl curd daily',
    ],
  },
  south: {
    region: 'south',
    states: ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana'],
    dominantStaple: 'Rice (white rice predominant)',
    typicalProteinSources: ['Dal/sambar', 'Fish (coastal)', 'Coconut', 'Eggs'],
    commonDeficiencyRisks: ['B12 (strict vegetarian belts)', 'Zinc (phytate-heavy rice-dal diet)', 'Calcium (low dairy in some communities)'],
    strengthFoods: ['Fish and seafood (coastal)', 'Ragi is calcium powerhouse (344mg/100g)', 'Drumstick/moringa leaves highly nutritious'],
    recommendations: [
      'Increase ragi use: ragi dosa, ragi mudde, ragi porridge — richest plant calcium source',
      'Replace some white rice with brown/hand-pounded rice or millets',
      'Fish 2-3x/week for omega-3 and B12 (sardines, mackerel are affordable and nutrient-dense)',
      'Add drumstick leaves (moringa) to sambar/dal — exceptionally rich in iron and calcium',
    ],
  },
  east: {
    region: 'east',
    states: ['West Bengal', 'Bihar', 'Jharkhand', 'Odisha', 'Assam'],
    dominantStaple: 'Rice',
    typicalProteinSources: ['Fish (especially Bengal)', 'Lentils (masoor)', 'Eggs'],
    commonDeficiencyRisks: ['Iron (rice-heavy, low absorption)', 'Vitamin D (limited outdoor exposure)', 'Protein gap in Bihar/Jharkhand'],
    strengthFoods: ['Fish tradition (WB, Odisha)', 'Sattu (roasted gram flour — excellent protein)', 'Small fish with bones for calcium'],
    recommendations: [
      'Sattu drinks and rotis are excellent protein-rich additions',
      'Fish at least 3x/week — small fish with bones (anchovy, hilsa) for calcium',
      'Add lime/lemon to rice-dal meals for better iron absorption',
      'Reduce sweet consumption frequency; Bengali sweets are very sugar-dense',
    ],
  },
  west: {
    region: 'west',
    states: ['Maharashtra', 'Gujarat', 'Goa'],
    dominantStaple: 'Jowar/bajra (Maharashtra), wheat/rice (Gujarat)',
    typicalProteinSources: ['Pulses (tur, moong)', 'Peanuts', 'Dairy', 'Fish (Goa/coastal Maharashtra)'],
    commonDeficiencyRisks: ['B12 (Jain/strict vegetarian communities)', 'Iron in girls', 'Excess sugar (sweets, farsans)'],
    strengthFoods: ['Millet tradition (jowar, bajra) — iron, calcium, fiber', 'Peanuts — protein, zinc', 'Kokum — vitamin C'],
    recommendations: [
      'Preserve and increase millet intake: jowar bhakri, bajra roti — nutritional gold',
      'For vegetarian families: B12 supplement is essential, not optional',
      'Peanut chutney and groundnut preparations — excellent zinc and protein source',
      'Kokum sherbet instead of sugary drinks — provides vitamin C and aids iron absorption',
    ],
  },
  central: {
    region: 'central',
    states: ['MP', 'Chhattisgarh'],
    dominantStaple: 'Wheat and rice (mixed)',
    typicalProteinSources: ['Pulses (chana, tur)', 'Soy (MP has strong soy production)'],
    commonDeficiencyRisks: ['Overall dietary diversity (limited rural)', 'Protein quality (cereal-dominated)', 'Iron and zinc'],
    strengthFoods: ['Soy products (readily available in MP)', 'Local greens (bathua, chaulai)', 'Linseed/flaxseed'],
    recommendations: [
      'Soy chunks/granules are affordable complete protein — add to any vegetable curry',
      'Forage greens (bathua, chaulai) are highly nutritious — encourage traditional use',
      'Dal with rice at every main meal, minimum 1 katori dal per meal',
      'Flaxseed (alsi) chutney for omega-3 — traditional and excellent',
    ],
  },
  northeast: {
    region: 'northeast',
    states: ['Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Arunachal', 'Sikkim'],
    dominantStaple: 'Rice (sticky rice in some areas)',
    typicalProteinSources: ['Pork', 'Fish', 'Fermented foods (akhuni, bamboo shoot)', 'Soy'],
    commonDeficiencyRisks: ['Calcium (very low dairy intake)', 'Vitamin D (hilly, cloudy regions)', 'Iodine (goitre belt)'],
    strengthFoods: ['Fermented foods provide B vitamins and probiotics', 'Meat covers B12', 'Wild greens are nutrient-dense'],
    recommendations: [
      'Continue traditional fermented foods — they improve nutrient absorption',
      'Prioritize small fish with bones for calcium since dairy is limited',
      'Ensure iodized salt use — NE is a goitre endemic belt',
      'Consider vitamin D supplementation — cloudy hilly weather limits sun exposure',
    ],
  },
};

export function getRegionForState(state: string): IndiaRegion {
  const map: Record<string, IndiaRegion> = {
    'Punjab': 'north', 'Haryana': 'north', 'UP': 'north', 'Rajasthan': 'north',
    'HP': 'north', 'J&K': 'north', 'Delhi': 'north', 'Uttarakhand': 'north',
    'Tamil Nadu': 'south', 'Karnataka': 'south', 'Kerala': 'south',
    'Andhra Pradesh': 'south', 'Telangana': 'south',
    'West Bengal': 'east', 'Bihar': 'east', 'Jharkhand': 'east', 'Odisha': 'east',
    'Maharashtra': 'west', 'Gujarat': 'west', 'Goa': 'west',
    'MP': 'central', 'Chhattisgarh': 'central',
    'Assam': 'northeast', 'Meghalaya': 'northeast', 'Manipur': 'northeast',
    'Mizoram': 'northeast', 'Nagaland': 'northeast', 'Tripura': 'northeast',
    'Arunachal': 'northeast', 'Sikkim': 'northeast',
  };
  return map[state] || 'north';
}

// =============================================================================
// SECTION 7: VEGETARIAN DIET RISK PROFILES (5-way classification)
// CNNS: 31% of adolescents B12 deficient, disproportionately vegetarian
// =============================================================================

export interface VegetarianRiskProfile {
  dietType: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  nutrientsAtRisk: string[];
  compensatoryFoods: string[];
  supplementsNeeded: string[];
  parentGuidance: string;
}

export function assessVegetarianRisk(dietType: string, age: number, gender: string): VegetarianRiskProfile {
  const isAdolescent = age >= 10;
  const isGirl = gender === 'female';

  switch (dietType) {
    case 'non-vegetarian':
    case 'non_veg':
      return {
        dietType,
        riskLevel: 'low',
        nutrientsAtRisk: isGirl && isAdolescent ? ['iron (post-menarche)'] : [],
        compensatoryFoods: [],
        supplementsNeeded: isGirl && isAdolescent ? ['Consider iron if heavy periods'] : [],
        parentGuidance: 'A balanced non-vegetarian diet with adequate variety meets most nutritional needs. Ensure red meat or liver at least once a week for iron and B12.',
      };

    case 'eggetarian':
    case 'egg_veg':
      return {
        dietType,
        riskLevel: 'moderate',
        nutrientsAtRisk: ['B12 (borderline from eggs alone)', 'Iron (no heme iron)', 'Zinc', 'Omega-3 DHA'],
        compensatoryFoods: [
          'Eggs daily (2/day) for B12 and protein',
          'Iron: green leafy vegetables + vitamin C at every meal',
          'Zinc: pumpkin seeds, sesame seeds, chickpeas',
        ],
        supplementsNeeded: ['B12 supplement if eggs <1/day', 'Algal DHA for omega-3'],
        parentGuidance: 'An egg-vegetarian diet can meet most needs. Eggs are excellent — 2 per day is ideal. Always pair iron-rich plant foods with vitamin C. B12 from eggs alone may be borderline in adolescents.',
      };

    case 'vegetarian':
    case 'lacto_veg':
      return {
        dietType,
        riskLevel: 'high',
        nutrientsAtRisk: ['B12 (dairy alone often insufficient)', 'Iron (no heme iron)', 'Zinc', 'Omega-3 DHA', 'Protein quality'],
        compensatoryFoods: [
          'B12: 2-3 glasses milk + curd daily, or fortified foods',
          'Iron: ragi, amaranth, spinach, jaggery — always with lemon/amla',
          'Protein: dal + cereal combination at every meal, soy products',
          'Zinc: paneer, sesame, pumpkin seeds',
          'Omega-3: flaxseed powder daily, walnuts',
        ],
        supplementsNeeded: [
          'B12 supplement strongly recommended (CNNS: 31% adolescents B12 deficient, largely vegetarian)',
          'Iron supplement for adolescent girls',
          'Algal DHA for omega-3',
        ],
        parentGuidance: 'A lacto-vegetarian diet requires deliberate planning. CNNS data shows 31% of adolescents are B12 deficient — rising to 40%+ in vegetarian populations. B12 supplementation is a necessity. Combine cereals with legumes at every meal. Add fermented foods (idli, dosa, curd) which improve mineral absorption.',
      };

    case 'vegan':
      return {
        dietType,
        riskLevel: 'critical',
        nutrientsAtRisk: ['B12 (no natural plant source)', 'Calcium (no dairy)', 'Iron', 'Zinc', 'Omega-3 DHA', 'Protein quality', 'Vitamin D'],
        compensatoryFoods: [
          'B12: NO plant source exists — supplementation is mandatory',
          'Calcium: ragi (344mg/100g), sesame seeds, fortified plant milk',
          'Protein: soy + cereal combinations, tofu, tempeh, legumes',
          'Iron: millets, green leafy vegetables, jaggery + vitamin C always',
        ],
        supplementsNeeded: [
          'B12 supplement MANDATORY',
          'Calcium + Vitamin D supplement',
          'Algal DHA supplement',
          'Iron supplement especially for girls',
          'Annual comprehensive blood panel essential',
        ],
        parentGuidance: 'A vegan diet for a growing child requires very careful supplementation and monitoring. Without dairy or eggs, several critical nutrients cannot be obtained from food alone. Please consult a pediatric nutritionist.',
      };

    case 'jain':
      return {
        dietType,
        riskLevel: 'high',
        nutrientsAtRisk: ['B12', 'Iron (no root vegetables)', 'Zinc', 'Protein variety', 'Omega-3'],
        compensatoryFoods: [
          'Dairy: maximize paneer, curd, buttermilk (minimum 3 servings/day)',
          'Protein: moong, masoor, chana dal, soy products',
          'Iron: bajra, jowar, ragi, green leafy vegetables',
          'Zinc: sesame seeds, dairy, lentils',
        ],
        supplementsNeeded: [
          'B12 supplement strongly recommended',
          'Iron supplement for adolescent girls',
        ],
        parentGuidance: 'Jain dietary restrictions create specific nutritional challenges. Dairy is the cornerstone — make it abundant. Millets are excellent for iron and calcium. B12 supplementation is very important.',
      };

    default:
      return {
        dietType,
        riskLevel: 'moderate',
        nutrientsAtRisk: ['B12', 'Iron'],
        compensatoryFoods: ['Vary food groups daily', 'Include dairy/eggs/legumes at every meal'],
        supplementsNeeded: ['Consider B12 if lacto-vegetarian'],
        parentGuidance: 'Ensure dietary variety and regular blood tests to catch deficiencies early.',
      };
  }
}

// =============================================================================
// SECTION 8: PARENT-FRIENDLY INSIGHT TEMPLATES
// Dual-track clinical + parent language per NeuroNest model
// =============================================================================

export interface InsightTemplate {
  id: string;
  title: string;
  clinicalDescription: string;
  parentDescription: string;
  parentExplanation: string;
  evidenceLevel: 'A' | 'B' | 'C';
  sources: string[];
  urgency: 'critical' | 'high' | 'moderate' | 'low' | 'protective';
  thisWeekActions: string[];
  clinicalActions: string[];
  medicalTriggers: string[];
  biologicalMechanism: string;
}

export const INSIGHT_TEMPLATES: Record<string, InsightTemplate> = {
  'iron_cognition': {
    id: 'iron_cognition',
    title: 'Iron Deficiency with Cognitive Impact',
    clinicalDescription: 'Iron deficiency (ferritin <30ng/mL or Hb below age/gender threshold) with concurrent cognitive deficits. Iron is essential for myelination, dopamine synthesis, and hippocampal function. RCT evidence: iron repletion improved attention by 14% and memory by 11% over 6 months. The cognitive effects may persist even after correction if occurring during critical developmental windows (ages 6-12).',
    parentDescription: "Your child's iron levels are low, and this is likely affecting their ability to pay attention and remember things at school. Iron helps the brain make chemicals it needs for focus and learning.",
    parentExplanation: "Iron is brain fuel. It helps make dopamine — the chemical that powers attention and motivation. When iron is low, it's like the brain is running on a half-charged battery. Research shows that fixing iron levels can improve attention and memory noticeably within a few months.",
    evidenceLevel: 'A',
    sources: ['Iron_Biofortified_Millet_RCT_2020', 'Lancet_IDA_Cognitive_2007', 'CNNS_2016_18'],
    urgency: 'high',
    thisWeekActions: [
      'Iron-rich breakfast every day: ragi porridge, poha with peanuts, or sprouted moong',
      'Pair iron foods with lemon or amla (vitamin C doubles iron absorption)',
      'Avoid tea/coffee/milk with meals — they block iron absorption; give between meals',
      'Track school performance weekly — focus should improve in 4-8 weeks',
    ],
    clinicalActions: [
      'Confirm with CBC, peripheral smear, ferritin, serum iron, TIBC, reticulocyte count',
      'Elemental iron: 3-6mg/kg/day in divided doses with vitamin C',
      'Recheck Hb/ferritin at 4 weeks and 12 weeks',
      'Cognitive reassessment at 3 and 6 months post-correction',
    ],
    medicalTriggers: ['Blood tests needed to confirm — ask pediatrician for CBC + ferritin', 'If Hb <11.5 (child <12y) or <12 (adolescent): see doctor within 2 weeks'],
    biologicalMechanism: 'Iron cofactor for tyrosine hydroxylase → dopamine synthesis → attention and motivation circuits. Iron-dependent myelination → neural conduction velocity.',
  },

  'vitamin_d_deficiency': {
    id: 'vitamin_d_deficiency',
    title: 'Vitamin D Deficiency',
    clinicalDescription: '25(OH)D <20ng/mL. CNNS 2016-18: 40.5% of 5-9y and 24% of 10-19y Indian children are vitamin D deficient. Linked to impaired calcium absorption, poor bone mineralization, immune dysfunction, and emerging evidence for cognitive and mood effects.',
    parentDescription: "Your child's vitamin D is low. This is the 'sunshine vitamin' that helps build strong bones and keeps the immune system working. Even in sunny India, many children don't get enough because they spend more time indoors.",
    parentExplanation: "Vitamin D works like a key that unlocks calcium absorption. Without it, all the calcium your child eats just passes through without being used. Morning sun exposure and the right foods can fix this.",
    evidenceLevel: 'A',
    sources: ['CNNS_2016_18', 'ICMR_NIN_2020', 'Indian_Pediatrics_VitD_Review_2022'],
    urgency: 'high',
    thisWeekActions: [
      '15-20 minutes of direct sunlight on arms and face daily (morning 7-10am is best)',
      'Include vitamin D foods: eggs, fortified milk, mushrooms',
      'Give the prescribed vitamin D drops or tablets consistently',
      'Ensure enough calcium too — ragi, dairy, sesame seeds, green leafy vegetables',
    ],
    clinicalActions: [
      'Confirm 25(OH)D level, check calcium, phosphorus, alkaline phosphatase, PTH',
      'Supplementation: 1000-2000 IU cholecalciferol daily for 8-12 weeks, then maintenance 600-1000 IU',
      'If severe (<10ng/mL): loading dose 60,000 IU weekly x 6-8 weeks under supervision',
    ],
    medicalTriggers: ['If <10 ng/mL: pediatric consultation within 1 week', 'Check alkaline phosphatase for rickets signs'],
    biologicalMechanism: 'VDR-mediated calcium absorption in intestinal cells. Vitamin D also modulates immune function and serotonin synthesis.',
  },

  'multiple_micronutrient': {
    id: 'multiple_micronutrient',
    title: 'Multiple Micronutrient Deficiency',
    clinicalDescription: '2+ concurrent micronutrient deficiencies. CNNS data: 40.5% children have vitamin D deficiency, 18.2% zinc deficient, iron deficiency affects 40% of adolescent girls. Multiple simultaneous deficiencies have synergistic negative effects — worse than the sum of individual deficiencies.',
    parentDescription: 'Your child is running low on several important vitamins and minerals at the same time. When the body lacks multiple nutrients together, the effects multiply.',
    parentExplanation: "Vitamins and minerals are like a team — they work together. When several team members are missing, the whole team struggles. Blood tests will tell us exactly what your child needs.",
    evidenceLevel: 'A',
    sources: ['CNNS_2016_18', 'Micronutrients_Cognitive_PLOS_2020', 'NFHS_5_2021'],
    urgency: 'high',
    thisWeekActions: [
      'Add variety to every plate: aim for 5 different colored foods per day',
      'Include iron-rich foods with vitamin C sources (lemon, amla) at every meal',
      'Add a daily egg or paneer portion for B12 and zinc',
      'Get blood tests done to know exactly which nutrients are low',
    ],
    clinicalActions: [
      'Full biochemical panel: CBC, ferritin, serum iron, TIBC, 25(OH)D, B12, folate, zinc',
      'Targeted supplementation based on confirmed deficiencies',
      'Dietary diversity score assessment; refer to clinical nutritionist',
      'Recheck biomarkers at 8-12 weeks post-intervention',
    ],
    medicalTriggers: ['Comprehensive blood panel needed', 'Pediatric nutritionist referral recommended'],
    biologicalMechanism: 'Concurrent deficiencies impair multiple neurotransmitter systems simultaneously, creating compounded cognitive and physical deficits.',
  },

  'bone_health': {
    id: 'bone_health',
    title: 'Peak Bone Mass Risk',
    clinicalDescription: '90% of peak bone mass is acquired by age 18. Low calcium (<70% ICMR RDA), low vitamin D, and sedentary behavior compromise peak bone mass accrual. ICMR 2020 raised calcium RDA to 800-1050mg/day — most Indian children get <50% of this.',
    parentDescription: "Your child's bones are being built right now — like a savings account for the skeleton. They're not depositing enough calcium and vitamin D, which means weaker bones now and higher fracture risk later.",
    parentExplanation: "Think of bones as a bank account: your child is making deposits now that have to last their whole life. The 'window' for building maximum bone strength closes around age 18-20. Ragi, dairy, sesame seeds, and weight-bearing activities are the best bone-builders.",
    evidenceLevel: 'A',
    sources: ['ICMR_NIN_2020', 'IAP_Calcium_VitD_Guidelines_2022'],
    urgency: 'moderate',
    thisWeekActions: [
      'Ragi is India\'s calcium champion: 344mg per 100g — use in dosa, porridge, laddu',
      'Dairy goal: 2-3 servings daily (milk, curd, paneer)',
      'Sesame seeds (til): add to chutneys, sprinkle on foods — 975mg calcium per 100g',
      'Jumping activities build bone: skipping rope, basketball, running, dancing',
    ],
    clinicalActions: [
      'Serum calcium, phosphorus, alkaline phosphatase, 25(OH)D, PTH',
      'Calcium target per ICMR: 800mg (6-9y), 850mg (10-12y), 1000-1050mg (13-18y)',
      'Weight-bearing exercise: running, jumping, dancing (not swimming alone)',
    ],
    medicalTriggers: ['DXA bone density if stunted + low calcium + low vitamin D'],
    biologicalMechanism: 'Calcium deposition in hydroxyapatite crystals. Vitamin D enables intestinal calcium transport. Weight-bearing activates osteoblasts.',
  },
};

// =============================================================================
// SECTION 9: COGNITIVE ASSESSMENT NORMS (age-normed, for game scoring)
// =============================================================================

/** Working Memory span norms (Corsi Block Task equivalent) by age */
export const WORKING_MEMORY_NORMS: Record<number, { p25: number; p50: number; p75: number; p90: number }> = {
  6:  { p25: 3, p50: 4, p75: 5, p90: 6 },
  7:  { p25: 3, p50: 4, p75: 5, p90: 6 },
  8:  { p25: 4, p50: 5, p75: 6, p90: 7 },
  9:  { p25: 4, p50: 5, p75: 6, p90: 7 },
  10: { p25: 4, p50: 5, p75: 7, p90: 8 },
  11: { p25: 5, p50: 6, p75: 7, p90: 8 },
  12: { p25: 5, p50: 6, p75: 7, p90: 8 },
  13: { p25: 5, p50: 6, p75: 8, p90: 9 },
  14: { p25: 5, p50: 7, p75: 8, p90: 9 },
  15: { p25: 6, p50: 7, p75: 8, p90: 9 },
  16: { p25: 6, p50: 7, p75: 8, p90: 9 },
};

/** Reaction Time norms (ms) by age — for processing speed scoring */
export const REACTION_TIME_NORMS: Record<number, { p10: number; p25: number; p50: number; p75: number; p90: number }> = {
  6:  { p10: 650, p25: 550, p50: 480, p75: 400, p90: 350 }, // lower is better
  7:  { p10: 600, p25: 510, p50: 440, p75: 370, p90: 320 },
  8:  { p10: 560, p25: 470, p50: 400, p75: 340, p90: 290 },
  9:  { p10: 520, p25: 430, p50: 370, p75: 310, p90: 270 },
  10: { p10: 480, p25: 400, p50: 340, p75: 290, p90: 250 },
  11: { p10: 450, p25: 375, p50: 320, p75: 270, p90: 235 },
  12: { p10: 430, p25: 355, p50: 300, p75: 255, p90: 220 },
  13: { p10: 410, p25: 340, p50: 285, p75: 240, p90: 210 },
  14: { p10: 390, p25: 325, p50: 270, p75: 230, p90: 200 },
  15: { p10: 375, p25: 310, p50: 260, p75: 220, p90: 190 },
  16: { p10: 360, p25: 300, p50: 250, p75: 210, p90: 185 },
};

/**
 * Convert raw reaction time (ms) to 0-100 percentile
 * Lower RT = higher percentile
 */
export function rtToPercentile(rtMs: number, ageYears: number): number {
  const age = Math.max(6, Math.min(16, Math.round(ageYears)));
  const norms = REACTION_TIME_NORMS[age];
  if (!norms) return 50;
  if (rtMs <= norms.p90) return 90;
  if (rtMs <= norms.p75) return 75;
  if (rtMs <= norms.p50) return 50;
  if (rtMs <= norms.p25) return 25;
  return 10;
}

/**
 * Convert working memory span to 0-100 percentile
 */
export function wmSpanToPercentile(span: number, ageYears: number): number {
  const age = Math.max(6, Math.min(16, Math.round(ageYears)));
  const norms = WORKING_MEMORY_NORMS[age];
  if (!norms) return 50;
  if (span >= norms.p90) return Math.min(95, 90 + (span - norms.p90) * 5);
  if (span >= norms.p75) return 75;
  if (span >= norms.p50) return 50;
  if (span >= norms.p25) return 25;
  return 10;
}
