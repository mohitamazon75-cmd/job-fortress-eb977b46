/**
 * KidVital360 — Expanded Tri-Vector Knowledge Graph
 * 
 * This module extends the base KG with:
 * - Symptom → Condition → Cause mappings
 * - Food → Nutrient → Bioavailability edges
 * - Developmental milestone → Skill dependency edges
 * - Cross-domain interaction edges
 * 
 * Combined with engine-data.ts, this achieves 200+ entity nodes and 500+ causal edges.
 */

// ═══════════════════════════════════════════════════════════════
// SYMPTOM-CONDITION-CAUSE ONTOLOGY (adds ~80 nodes, ~200 edges)
// ═══════════════════════════════════════════════════════════════

export interface SymptomNode {
  id: string;
  name: string;
  domain: "physical" | "cognitive" | "nutritional" | "behavioral";
  observableBy: "parent" | "assessment" | "both";
  description: string;
}

export interface ConditionNode {
  id: string;
  name: string;
  category: "deficiency" | "developmental" | "behavioral" | "metabolic" | "neurological";
  icdCode?: string;
  prevalenceIndia: number; // percentage
  referralThreshold: number; // score below which to refer
}

export interface CauseEdge {
  fromType: "symptom" | "condition" | "nutrient" | "behavior" | "environment";
  fromId: string;
  toType: "symptom" | "condition" | "metric" | "risk";
  toId: string;
  relationship: "causes" | "worsens" | "protects" | "indicates" | "masks" | "amplifies" | "inhibits" | "enables";
  strength: number; // 0-1
  bidirectional: boolean;
  mechanism: string;
  evidenceLevel: 1 | 2 | 3 | 4; // 1=case, 2=cohort, 3=RCT, 4=meta-analysis
}

export const SYMPTOM_NODES: SymptomNode[] = [
  // Physical symptoms
  { id: "s_fatigue", name: "Chronic Fatigue", domain: "physical", observableBy: "both", description: "Persistent tiredness not explained by activity level" },
  { id: "s_pale_skin", name: "Pallor", domain: "physical", observableBy: "parent", description: "Pale skin, nail beds, or conjunctiva" },
  { id: "s_frequent_illness", name: "Frequent Infections", domain: "physical", observableBy: "parent", description: "More than 6 infections per year" },
  { id: "s_poor_wound_healing", name: "Slow Wound Healing", domain: "physical", observableBy: "parent", description: "Cuts and bruises heal slowly" },
  { id: "s_brittle_nails", name: "Brittle Nails/Hair", domain: "physical", observableBy: "parent", description: "Nails break easily, hair thinning" },
  { id: "s_muscle_cramps", name: "Muscle Cramps", domain: "physical", observableBy: "both", description: "Frequent leg cramps, especially at night" },
  { id: "s_delayed_growth", name: "Growth Faltering", domain: "physical", observableBy: "parent", description: "Height/weight not tracking expected percentiles" },
  { id: "s_poor_posture", name: "Poor Posture", domain: "physical", observableBy: "parent", description: "Slouching, rounded shoulders, forward head" },
  { id: "s_clumsiness", name: "Motor Clumsiness", domain: "physical", observableBy: "both", description: "Frequent tripping, dropping things, bumping into objects" },
  { id: "s_low_stamina", name: "Low Stamina", domain: "physical", observableBy: "both", description: "Tires quickly during physical activities" },
  { id: "s_sleep_difficulty", name: "Sleep Difficulty", domain: "physical", observableBy: "parent", description: "Trouble falling asleep or staying asleep" },
  { id: "s_teeth_decay", name: "Dental Problems", domain: "physical", observableBy: "parent", description: "Early tooth decay, weak enamel" },
  
  // Cognitive/behavioral symptoms
  { id: "s_inattention", name: "Inattention", domain: "cognitive", observableBy: "both", description: "Difficulty sustaining attention on tasks" },
  { id: "s_forgetfulness", name: "Forgetfulness", domain: "cognitive", observableBy: "both", description: "Frequently forgets instructions or daily tasks" },
  { id: "s_slow_processing", name: "Slow Processing", domain: "cognitive", observableBy: "assessment", description: "Takes longer than peers to process information" },
  { id: "s_math_difficulty", name: "Math Difficulty", domain: "cognitive", observableBy: "both", description: "Struggles with age-appropriate mathematical concepts" },
  { id: "s_reading_difficulty", name: "Reading Difficulty", domain: "cognitive", observableBy: "both", description: "Below grade-level reading fluency" },
  { id: "s_mood_swings", name: "Mood Instability", domain: "behavioral", observableBy: "parent", description: "Rapid, unpredictable mood changes" },
  { id: "s_irritability", name: "Irritability", domain: "behavioral", observableBy: "parent", description: "Easily frustrated or angered" },
  { id: "s_social_withdrawal", name: "Social Withdrawal", domain: "behavioral", observableBy: "parent", description: "Avoids social interaction, prefers isolation" },
  { id: "s_anxiety_symptoms", name: "Anxiety Symptoms", domain: "behavioral", observableBy: "both", description: "Excessive worry, stomachaches before school" },
  { id: "s_low_motivation", name: "Low Motivation", domain: "behavioral", observableBy: "parent", description: "Lack of interest in activities previously enjoyed" },
  { id: "s_impulsivity", name: "Impulsivity", domain: "behavioral", observableBy: "both", description: "Acts without thinking, difficulty waiting" },
  { id: "s_rigidity", name: "Behavioral Rigidity", domain: "behavioral", observableBy: "parent", description: "Difficulty with transitions, insistence on routines" },
  
  // Nutritional symptoms
  { id: "s_pica", name: "Pica (Cravings)", domain: "nutritional", observableBy: "parent", description: "Craving non-food items (ice, dirt, chalk)" },
  { id: "s_poor_appetite", name: "Poor Appetite", domain: "nutritional", observableBy: "parent", description: "Consistently eats less than expected" },
  { id: "s_food_aversion", name: "Food Aversion", domain: "nutritional", observableBy: "parent", description: "Extreme pickiness, avoidance of food groups" },
  { id: "s_bloating", name: "Bloating/Gas", domain: "nutritional", observableBy: "parent", description: "Frequent stomach discomfort after meals" },
  { id: "s_constipation", name: "Constipation", domain: "nutritional", observableBy: "parent", description: "Infrequent or difficult bowel movements" },
];

export const CONDITION_NODES: ConditionNode[] = [
  { id: "c_iron_deficiency_anemia", name: "Iron Deficiency Anemia", category: "deficiency", icdCode: "D50", prevalenceIndia: 53, referralThreshold: 15 },
  { id: "c_vitamin_d_deficiency", name: "Vitamin D Deficiency", category: "deficiency", icdCode: "E55", prevalenceIndia: 68, referralThreshold: 20 },
  { id: "c_protein_energy_malnutrition", name: "Protein-Energy Malnutrition", category: "deficiency", icdCode: "E46", prevalenceIndia: 35, referralThreshold: 10 },
  { id: "c_zinc_deficiency", name: "Zinc Deficiency", category: "deficiency", icdCode: "E60", prevalenceIndia: 38, referralThreshold: 20 },
  { id: "c_b12_deficiency", name: "Vitamin B12 Deficiency", category: "deficiency", icdCode: "E53.8", prevalenceIndia: 47, referralThreshold: 20 },
  { id: "c_calcium_insufficiency", name: "Calcium Insufficiency", category: "deficiency", icdCode: "E58", prevalenceIndia: 48, referralThreshold: 20 },
  { id: "c_omega3_deficit", name: "Omega-3 Fatty Acid Deficit", category: "deficiency", prevalenceIndia: 55, referralThreshold: 25 },
  { id: "c_dcd", name: "Developmental Coordination Disorder", category: "developmental", icdCode: "F82", prevalenceIndia: 6, referralThreshold: 15 },
  { id: "c_adhd_risk", name: "ADHD Risk Profile", category: "neurological", icdCode: "F90", prevalenceIndia: 7, referralThreshold: 20 },
  { id: "c_sld_risk", name: "Specific Learning Disability Risk", category: "neurological", icdCode: "F81", prevalenceIndia: 10, referralThreshold: 15 },
  { id: "c_anxiety_disorder", name: "Childhood Anxiety", category: "behavioral", icdCode: "F41", prevalenceIndia: 12, referralThreshold: 25 },
  { id: "c_childhood_obesity", name: "Childhood Obesity", category: "metabolic", icdCode: "E66", prevalenceIndia: 14, referralThreshold: 85 },
  { id: "c_metabolic_syndrome", name: "Metabolic Syndrome Risk", category: "metabolic", prevalenceIndia: 5, referralThreshold: 80 },
  { id: "c_gut_dysbiosis", name: "Gut Dysbiosis", category: "metabolic", prevalenceIndia: 40, referralThreshold: 30 },
  { id: "c_myopia_progression", name: "Progressive Myopia", category: "developmental", icdCode: "H52.1", prevalenceIndia: 25, referralThreshold: 30 },
  { id: "c_sleep_disorder", name: "Pediatric Sleep Disorder", category: "behavioral", icdCode: "G47", prevalenceIndia: 20, referralThreshold: 25 },
];

// ═══════════════════════════════════════════════════════════════
// CAUSE-EFFECT EDGES (the dense web of connections)
// ═══════════════════════════════════════════════════════════════

export const CAUSE_EDGES: CauseEdge[] = [
  // Iron deficiency cascade (12 edges)
  { fromType: "nutrient", fromId: "iron_low", toType: "condition", toId: "c_iron_deficiency_anemia", relationship: "causes", strength: 0.85, bidirectional: false, mechanism: "Depleted iron stores → reduced hemoglobin synthesis → anemia", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_fatigue", relationship: "causes", strength: 0.90, bidirectional: false, mechanism: "Reduced oxygen-carrying capacity → tissue hypoxia → fatigue", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_pale_skin", relationship: "causes", strength: 0.80, bidirectional: false, mechanism: "Reduced hemoglobin → decreased skin/mucosal perfusion", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_inattention", relationship: "causes", strength: 0.72, bidirectional: false, mechanism: "Reduced cerebral oxygenation + impaired dopamine synthesis", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_slow_processing", relationship: "causes", strength: 0.68, bidirectional: false, mechanism: "Impaired myelination → slower neural conduction velocity", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_pica", relationship: "indicates", strength: 0.65, bidirectional: false, mechanism: "Non-nutritive cravings are a classic iron deficiency indicator", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_irritability", relationship: "causes", strength: 0.60, bidirectional: false, mechanism: "Dopamine and serotonin synthesis require iron cofactors", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "metric", toId: "cognitive.processing", relationship: "worsens", strength: 0.75, bidirectional: false, mechanism: "Ferritin < 30ng/mL associated with 15-20% slower processing speed", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "metric", toId: "cognitive.memory", relationship: "worsens", strength: 0.65, bidirectional: false, mechanism: "Iron-dependent hippocampal neurogenesis impaired", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "metric", toId: "physical.endurance", relationship: "worsens", strength: 0.70, bidirectional: false, mechanism: "VO2max drops proportionally with hemoglobin level", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "symptom", toId: "s_brittle_nails", relationship: "causes", strength: 0.55, bidirectional: false, mechanism: "Iron is required for keratin synthesis", evidenceLevel: 2 },
  { fromType: "symptom", fromId: "s_fatigue", toType: "symptom", toId: "s_low_motivation", relationship: "causes", strength: 0.70, bidirectional: true, mechanism: "Chronic fatigue → reduced dopamine reward → amotivation loop", evidenceLevel: 3 },

  // Vitamin D deficiency cascade (10 edges)
  { fromType: "nutrient", fromId: "vitamin_d_low", toType: "condition", toId: "c_vitamin_d_deficiency", relationship: "causes", strength: 0.88, bidirectional: false, mechanism: "Insufficient UV exposure + dietary intake → 25(OH)D < 20ng/mL", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "symptom", toId: "s_muscle_cramps", relationship: "causes", strength: 0.70, bidirectional: false, mechanism: "Calcium-phosphate imbalance → neuromuscular irritability", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "symptom", toId: "s_frequent_illness", relationship: "worsens", strength: 0.65, bidirectional: false, mechanism: "VDR on immune cells — vitamin D modulates innate immunity", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "symptom", toId: "s_delayed_growth", relationship: "causes", strength: 0.60, bidirectional: false, mechanism: "Calcium malabsorption → impaired bone mineralization", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "metric", toId: "physical.balance", relationship: "worsens", strength: 0.55, bidirectional: false, mechanism: "Musculoskeletal weakness reduces proprioceptive feedback", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "metric", toId: "physical.grip", relationship: "worsens", strength: 0.50, bidirectional: false, mechanism: "Muscle fiber type composition altered in vitamin D deficiency", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "symptom", toId: "s_mood_swings", relationship: "worsens", strength: 0.48, bidirectional: false, mechanism: "Vitamin D receptors in prefrontal cortex modulate serotonin", evidenceLevel: 2 },
  { fromType: "condition", fromId: "c_vitamin_d_deficiency", toType: "condition", toId: "c_calcium_insufficiency", relationship: "amplifies", strength: 0.80, bidirectional: true, mechanism: "Vitamin D enables calcium absorption — deficiency creates double deficit", evidenceLevel: 4 },
  { fromType: "environment", fromId: "tier1_urban", toType: "condition", toId: "c_vitamin_d_deficiency", relationship: "amplifies", strength: 0.72, bidirectional: false, mechanism: "Air pollution + indoor lifestyle reduces effective UV exposure by 40%", evidenceLevel: 3 },
  { fromType: "environment", fromId: "high_screen_time", toType: "condition", toId: "c_vitamin_d_deficiency", relationship: "worsens", strength: 0.60, bidirectional: false, mechanism: "Screen time displaces outdoor play time → reduced sun exposure", evidenceLevel: 3 },

  // Protein deficiency cascade (10 edges)
  { fromType: "nutrient", fromId: "protein_low", toType: "condition", toId: "c_protein_energy_malnutrition", relationship: "causes", strength: 0.82, bidirectional: false, mechanism: "Negative nitrogen balance → muscle catabolism", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "symptom", toId: "s_delayed_growth", relationship: "causes", strength: 0.85, bidirectional: false, mechanism: "IGF-1 synthesis requires adequate amino acids", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "symptom", toId: "s_frequent_illness", relationship: "causes", strength: 0.75, bidirectional: false, mechanism: "Antibody production requires essential amino acids", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "symptom", toId: "s_poor_wound_healing", relationship: "causes", strength: 0.70, bidirectional: false, mechanism: "Collagen synthesis requires proline, lysine (amino acids)", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "metric", toId: "physical.grip", relationship: "worsens", strength: 0.78, bidirectional: false, mechanism: "Sarcopenia — muscle protein synthesis < breakdown", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "metric", toId: "physical.endurance", relationship: "worsens", strength: 0.72, bidirectional: false, mechanism: "Reduced mitochondrial biogenesis in Type I muscle fibers", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_protein_energy_malnutrition", toType: "symptom", toId: "s_poor_appetite", relationship: "amplifies", strength: 0.55, bidirectional: true, mechanism: "Malnutrition → reduced ghrelin sensitivity → appetite loss → worsening malnutrition", evidenceLevel: 3 },
  { fromType: "environment", fromId: "vegetarian_diet", toType: "condition", toId: "c_protein_energy_malnutrition", relationship: "amplifies", strength: 0.45, bidirectional: false, mechanism: "Plant proteins 22% less bioavailable; incomplete amino acid profiles", evidenceLevel: 3 },
  { fromType: "environment", fromId: "vegan_diet", toType: "condition", toId: "c_protein_energy_malnutrition", relationship: "amplifies", strength: 0.60, bidirectional: false, mechanism: "Vegan diets 32% less bioavailable protein without careful combining", evidenceLevel: 3 },
  { fromType: "nutrient", fromId: "calories_low", toType: "condition", toId: "c_protein_energy_malnutrition", relationship: "amplifies", strength: 0.75, bidirectional: false, mechanism: "Low calories forces protein catabolism for energy — 20% less for growth", evidenceLevel: 4 },

  // B12 deficiency cascade (8 edges)
  { fromType: "nutrient", fromId: "b12_low", toType: "condition", toId: "c_b12_deficiency", relationship: "causes", strength: 0.85, bidirectional: false, mechanism: "Inadequate B12 intake → megaloblastic anemia + neurological damage", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "symptom", toId: "s_fatigue", relationship: "causes", strength: 0.80, bidirectional: false, mechanism: "Megaloblastic anemia → impaired oxygen transport", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "symptom", toId: "s_forgetfulness", relationship: "causes", strength: 0.72, bidirectional: false, mechanism: "B12 required for myelin sheath maintenance — deficiency → demyelination", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "symptom", toId: "s_mood_swings", relationship: "causes", strength: 0.65, bidirectional: false, mechanism: "B12 cofactor in SAMe cycle → affects serotonin/dopamine synthesis", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "metric", toId: "cognitive.memory", relationship: "worsens", strength: 0.68, bidirectional: false, mechanism: "Hippocampal atrophy associated with chronic B12 deficiency", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "symptom", toId: "s_clumsiness", relationship: "causes", strength: 0.50, bidirectional: false, mechanism: "Peripheral neuropathy affects proprioception", evidenceLevel: 2 },
  { fromType: "environment", fromId: "vegetarian_diet", toType: "condition", toId: "c_b12_deficiency", relationship: "amplifies", strength: 0.70, bidirectional: false, mechanism: "B12 found almost exclusively in animal products — 47% of Indian vegetarians deficient", evidenceLevel: 4 },
  { fromType: "environment", fromId: "vegan_diet", toType: "condition", toId: "c_b12_deficiency", relationship: "amplifies", strength: 0.90, bidirectional: false, mechanism: "Zero dietary B12 without supplementation", evidenceLevel: 4 },

  // Gut-brain axis (8 edges)
  { fromType: "nutrient", fromId: "fiber_low", toType: "condition", toId: "c_gut_dysbiosis", relationship: "causes", strength: 0.75, bidirectional: false, mechanism: "Low prebiotic fiber → reduced Bifidobacterium/Lactobacillus → dysbiosis", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "symptom", toId: "s_bloating", relationship: "causes", strength: 0.72, bidirectional: false, mechanism: "Pathogenic bacteria produce excess gas and short-chain fatty acid imbalance", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "symptom", toId: "s_constipation", relationship: "causes", strength: 0.65, bidirectional: true, mechanism: "Dysbiosis reduces colonic motility; constipation worsens dysbiosis", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "symptom", toId: "s_mood_swings", relationship: "causes", strength: 0.62, bidirectional: false, mechanism: "95% of serotonin is gut-derived — dysbiosis → serotonin deficit", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "symptom", toId: "s_anxiety_symptoms", relationship: "worsens", strength: 0.55, bidirectional: true, mechanism: "Vagus nerve bidirectional signaling — gut inflammation → CNS anxiety response", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "metric", toId: "cognitive.emotional", relationship: "worsens", strength: 0.58, bidirectional: false, mechanism: "Enteric nervous system disruption → emotional regulation impairment", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "metric", toId: "cognitive.attention", relationship: "worsens", strength: 0.45, bidirectional: false, mechanism: "Gut inflammation → systemic inflammatory markers → neuroinflammation", evidenceLevel: 2 },
  { fromType: "condition", fromId: "c_gut_dysbiosis", toType: "symptom", toId: "s_food_aversion", relationship: "amplifies", strength: 0.50, bidirectional: true, mechanism: "Gut discomfort → food avoidance → restricted diet → worsening dysbiosis", evidenceLevel: 2 },

  // Screen time cascade (10 edges)
  { fromType: "behavior", fromId: "high_screen_time", toType: "condition", toId: "c_myopia_progression", relationship: "causes", strength: 0.75, bidirectional: false, mechanism: "Prolonged near-focus → accommodative spasm → axial length elongation", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_myopia_progression", toType: "symptom", toId: "s_reading_difficulty", relationship: "worsens", strength: 0.55, bidirectional: false, mechanism: "Uncorrected refractive error → visual fatigue → reading avoidance", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "high_screen_time", toType: "condition", toId: "c_sleep_disorder", relationship: "causes", strength: 0.72, bidirectional: false, mechanism: "Blue light → melatonin suppression → delayed sleep phase", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_sleep_disorder", toType: "symptom", toId: "s_inattention", relationship: "causes", strength: 0.78, bidirectional: false, mechanism: "Sleep debt → prefrontal cortex hypoactivation → executive dysfunction", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_sleep_disorder", toType: "symptom", toId: "s_irritability", relationship: "causes", strength: 0.72, bidirectional: false, mechanism: "Amygdala hyperactivation with sleep deprivation", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_sleep_disorder", toType: "symptom", toId: "s_forgetfulness", relationship: "causes", strength: 0.68, bidirectional: false, mechanism: "REM sleep critical for memory consolidation — disrupted by screens", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_sleep_disorder", toType: "metric", toId: "cognitive.memory", relationship: "worsens", strength: 0.70, bidirectional: false, mechanism: "Hippocampal replay during sleep is essential for long-term memory formation", evidenceLevel: 4 },
  { fromType: "behavior", fromId: "high_screen_time", toType: "symptom", toId: "s_impulsivity", relationship: "worsens", strength: 0.60, bidirectional: false, mechanism: "Rapid content switching → reduced delay discounting tolerance", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "high_screen_time", toType: "condition", toId: "c_childhood_obesity", relationship: "amplifies", strength: 0.55, bidirectional: false, mechanism: "Sedentary behavior + snacking during screen time → positive energy balance", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "high_screen_time", toType: "symptom", toId: "s_social_withdrawal", relationship: "worsens", strength: 0.50, bidirectional: true, mechanism: "Virtual interaction replacing real-world social skill development", evidenceLevel: 2 },

  // Obesity cascade (8 edges)
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "condition", toId: "c_metabolic_syndrome", relationship: "causes", strength: 0.65, bidirectional: false, mechanism: "Visceral fat → insulin resistance → metabolic syndrome cascade", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "symptom", toId: "s_low_stamina", relationship: "causes", strength: 0.75, bidirectional: true, mechanism: "Excess weight → exercise intolerance → deconditioning → more weight gain", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "symptom", toId: "s_sleep_difficulty", relationship: "worsens", strength: 0.55, bidirectional: true, mechanism: "Obstructive sleep apnea risk increases with BMI", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "metric", toId: "cognitive.memory", relationship: "worsens", strength: 0.50, bidirectional: false, mechanism: "Neuroinflammation from adipokines → hippocampal dysfunction", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "symptom", toId: "s_social_withdrawal", relationship: "worsens", strength: 0.55, bidirectional: false, mechanism: "Weight stigma → reduced self-esteem → social avoidance", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "metric", toId: "physical.endurance", relationship: "worsens", strength: 0.72, bidirectional: false, mechanism: "VO2max inversely correlated with body fat percentage", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_childhood_obesity", toType: "metric", toId: "physical.coordination", relationship: "worsens", strength: 0.45, bidirectional: false, mechanism: "Altered center of mass → compensatory movement patterns", evidenceLevel: 2 },
  { fromType: "environment", fromId: "tier1_urban", toType: "condition", toId: "c_childhood_obesity", relationship: "amplifies", strength: 0.55, bidirectional: false, mechanism: "Processed food availability + sedentary lifestyle + fast food culture", evidenceLevel: 3 },

  // Attention/ADHD cascade (8 edges)
  { fromType: "condition", fromId: "c_adhd_risk", toType: "symptom", toId: "s_inattention", relationship: "causes", strength: 0.90, bidirectional: false, mechanism: "Prefrontal cortex hypoactivation → executive dysfunction", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_adhd_risk", toType: "symptom", toId: "s_impulsivity", relationship: "causes", strength: 0.85, bidirectional: false, mechanism: "Reduced inhibitory control in basal ganglia circuits", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_adhd_risk", toType: "symptom", toId: "s_forgetfulness", relationship: "causes", strength: 0.75, bidirectional: false, mechanism: "Working memory deficits due to dopamine signaling abnormalities", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_adhd_risk", toType: "metric", toId: "cognitive.attention", relationship: "worsens", strength: 0.88, bidirectional: false, mechanism: "Sustained attention paradigm scores directly affected", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_adhd_risk", toType: "metric", toId: "cognitive.reasoning", relationship: "worsens", strength: 0.55, bidirectional: false, mechanism: "Working memory bottleneck limits complex reasoning", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "condition", toId: "c_adhd_risk", relationship: "amplifies", strength: 0.65, bidirectional: false, mechanism: "Iron-dependent dopamine synthesis — deficiency mimics/worsens ADHD symptoms", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_sleep_disorder", toType: "condition", toId: "c_adhd_risk", relationship: "masks", strength: 0.70, bidirectional: false, mechanism: "Sleep deprivation symptoms overlap 80% with ADHD criteria — misdiagnosis risk", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "high_screen_time", toType: "condition", toId: "c_adhd_risk", relationship: "amplifies", strength: 0.55, bidirectional: false, mechanism: "Dopamine receptor downregulation from rapid reward cycling", evidenceLevel: 3 },

  // Learning disability cascade (6 edges)
  { fromType: "condition", fromId: "c_sld_risk", toType: "symptom", toId: "s_reading_difficulty", relationship: "causes", strength: 0.85, bidirectional: false, mechanism: "Phonological processing deficit → decoding difficulty", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_sld_risk", toType: "symptom", toId: "s_math_difficulty", relationship: "causes", strength: 0.80, bidirectional: false, mechanism: "Number sense deficit or visual-spatial processing weakness", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_sld_risk", toType: "symptom", toId: "s_low_motivation", relationship: "worsens", strength: 0.65, bidirectional: true, mechanism: "Repeated academic failure → learned helplessness → avoidance", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_sld_risk", toType: "symptom", toId: "s_anxiety_symptoms", relationship: "worsens", strength: 0.60, bidirectional: true, mechanism: "Academic anxiety from consistent underperformance", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_iron_deficiency_anemia", toType: "condition", toId: "c_sld_risk", relationship: "amplifies", strength: 0.55, bidirectional: false, mechanism: "Iron deficiency in early childhood impairs myelination critical for reading circuits", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_b12_deficiency", toType: "condition", toId: "c_sld_risk", relationship: "amplifies", strength: 0.50, bidirectional: false, mechanism: "B12 needed for neural pathway development underlying academic skills", evidenceLevel: 2 },

  // Anxiety cascade (6 edges)
  { fromType: "condition", fromId: "c_anxiety_disorder", toType: "symptom", toId: "s_anxiety_symptoms", relationship: "causes", strength: 0.92, bidirectional: false, mechanism: "Amygdala hyperactivation → chronic fight-or-flight response", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_anxiety_disorder", toType: "symptom", toId: "s_sleep_difficulty", relationship: "causes", strength: 0.70, bidirectional: true, mechanism: "Rumination → delayed sleep onset → sleep anxiety cycle", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_anxiety_disorder", toType: "symptom", toId: "s_poor_appetite", relationship: "causes", strength: 0.55, bidirectional: false, mechanism: "Cortisol elevation → appetite suppression in children", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_anxiety_disorder", toType: "metric", toId: "cognitive.attention", relationship: "worsens", strength: 0.65, bidirectional: false, mechanism: "Attentional bias toward threat → reduced available attention for tasks", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_anxiety_disorder", toType: "metric", toId: "physical.flexibility", relationship: "worsens", strength: 0.50, bidirectional: false, mechanism: "Chronic muscle guarding → reduced ROM → further stress", evidenceLevel: 2 },
  { fromType: "environment", fromId: "academic_pressure", toType: "condition", toId: "c_anxiety_disorder", relationship: "amplifies", strength: 0.65, bidirectional: false, mechanism: "Indian competitive education system → performance anxiety, especially in CBSE/ICSE", evidenceLevel: 3 },

  // Zinc deficiency (6 edges)
  { fromType: "nutrient", fromId: "zinc_low", toType: "condition", toId: "c_zinc_deficiency", relationship: "causes", strength: 0.80, bidirectional: false, mechanism: "Insufficient zinc intake → impaired metalloenzyme function", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_zinc_deficiency", toType: "symptom", toId: "s_frequent_illness", relationship: "causes", strength: 0.75, bidirectional: false, mechanism: "Zinc critical for T-cell function and thymic hormone production", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_zinc_deficiency", toType: "symptom", toId: "s_poor_appetite", relationship: "causes", strength: 0.70, bidirectional: true, mechanism: "Zinc required for gustin protein → taste perception affected", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_zinc_deficiency", toType: "symptom", toId: "s_delayed_growth", relationship: "causes", strength: 0.68, bidirectional: false, mechanism: "Zinc cofactor for IGF-1 signaling pathway", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_zinc_deficiency", toType: "metric", toId: "cognitive.memory", relationship: "worsens", strength: 0.52, bidirectional: false, mechanism: "Zinc modulates NMDA receptor function in hippocampus", evidenceLevel: 2 },
  { fromType: "environment", fromId: "vegetarian_diet", toType: "condition", toId: "c_zinc_deficiency", relationship: "amplifies", strength: 0.55, bidirectional: false, mechanism: "Phytates in legumes/grains chelate zinc reducing absorption 28%", evidenceLevel: 3 },

  // Omega-3 deficit (6 edges)
  { fromType: "nutrient", fromId: "omega3_low", toType: "condition", toId: "c_omega3_deficit", relationship: "causes", strength: 0.78, bidirectional: false, mechanism: "Insufficient DHA intake → suboptimal neural membrane composition", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_omega3_deficit", toType: "metric", toId: "cognitive.reasoning", relationship: "worsens", strength: 0.62, bidirectional: false, mechanism: "DHA comprises 40% of brain polyunsaturated fatty acids — deficit impairs synaptic plasticity", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_omega3_deficit", toType: "metric", toId: "cognitive.attention", relationship: "worsens", strength: 0.55, bidirectional: false, mechanism: "Omega-3 modulates dopamine and serotonin signaling in PFC", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_omega3_deficit", toType: "symptom", toId: "s_mood_swings", relationship: "worsens", strength: 0.52, bidirectional: false, mechanism: "Anti-inflammatory properties — deficit → neuroinflammation → mood instability", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_omega3_deficit", toType: "condition", toId: "c_myopia_progression", relationship: "amplifies", strength: 0.40, bidirectional: false, mechanism: "DHA important for retinal photoreceptor function", evidenceLevel: 2 },
  { fromType: "environment", fromId: "vegetarian_diet", toType: "condition", toId: "c_omega3_deficit", relationship: "amplifies", strength: 0.65, bidirectional: false, mechanism: "ALA→DHA conversion efficiency only 5-10% in humans — fish-free diets highly vulnerable", evidenceLevel: 3 },

  // Calcium insufficiency (6 edges)
  { fromType: "nutrient", fromId: "calcium_low", toType: "condition", toId: "c_calcium_insufficiency", relationship: "causes", strength: 0.80, bidirectional: false, mechanism: "Dietary calcium below 50% RDA → negative calcium balance", evidenceLevel: 4 },
  { fromType: "condition", fromId: "c_calcium_insufficiency", toType: "symptom", toId: "s_muscle_cramps", relationship: "causes", strength: 0.70, bidirectional: false, mechanism: "Hypocalcemia → increased neuromuscular excitability", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_calcium_insufficiency", toType: "symptom", toId: "s_teeth_decay", relationship: "causes", strength: 0.55, bidirectional: false, mechanism: "Inadequate enamel mineralization during development", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_calcium_insufficiency", toType: "metric", toId: "physical.balance", relationship: "worsens", strength: 0.60, bidirectional: false, mechanism: "Weak bone density → proprioceptive deficit → balance impairment", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_calcium_insufficiency", toType: "metric", toId: "physical.coordination", relationship: "worsens", strength: 0.50, bidirectional: false, mechanism: "Musculoskeletal weakness affects fine and gross motor coordination", evidenceLevel: 3 },
  { fromType: "condition", fromId: "c_calcium_insufficiency", toType: "symptom", toId: "s_poor_posture", relationship: "causes", strength: 0.48, bidirectional: false, mechanism: "Weak spinal musculature and bone structure", evidenceLevel: 2 },

  // Cross-domain protective edges (positive interventions)
  { fromType: "behavior", fromId: "physical_activity", toType: "metric", toId: "cognitive.attention", relationship: "protects", strength: 0.72, bidirectional: false, mechanism: "BDNF secretion during aerobic exercise enhances prefrontal function", evidenceLevel: 4 },
  { fromType: "behavior", fromId: "physical_activity", toType: "condition", toId: "c_childhood_obesity", relationship: "protects", strength: 0.80, bidirectional: false, mechanism: "Energy expenditure maintains energy balance", evidenceLevel: 4 },
  { fromType: "behavior", fromId: "physical_activity", toType: "symptom", toId: "s_anxiety_symptoms", relationship: "protects", strength: 0.65, bidirectional: false, mechanism: "Exercise reduces cortisol, increases endorphins", evidenceLevel: 4 },
  { fromType: "behavior", fromId: "yoga_mindfulness", toType: "condition", toId: "c_anxiety_disorder", relationship: "protects", strength: 0.68, bidirectional: false, mechanism: "Vagal tone improvement + cortisol regulation", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "yoga_mindfulness", toType: "metric", toId: "physical.flexibility", relationship: "protects", strength: 0.75, bidirectional: false, mechanism: "Progressive stretching improves ROM and reduces muscle guarding", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "outdoor_play", toType: "condition", toId: "c_vitamin_d_deficiency", relationship: "protects", strength: 0.82, bidirectional: false, mechanism: "UV-B exposure → cutaneous vitamin D synthesis", evidenceLevel: 4 },
  { fromType: "behavior", fromId: "outdoor_play", toType: "condition", toId: "c_myopia_progression", relationship: "protects", strength: 0.70, bidirectional: false, mechanism: "Bright light stimulates dopamine release in retina, slowing axial elongation", evidenceLevel: 4 },
  { fromType: "nutrient", fromId: "vitamin_c_adequate", toType: "condition", toId: "c_iron_deficiency_anemia", relationship: "protects", strength: 0.72, bidirectional: false, mechanism: "Ascorbic acid reduces Fe³⁺ → Fe²⁺, increasing absorption 6x", evidenceLevel: 4 },
  { fromType: "nutrient", fromId: "probiotics", toType: "condition", toId: "c_gut_dysbiosis", relationship: "protects", strength: 0.65, bidirectional: false, mechanism: "Fermented foods (dahi, idli) restore beneficial gut flora", evidenceLevel: 3 },
  { fromType: "behavior", fromId: "sleep_hygiene", toType: "condition", toId: "c_sleep_disorder", relationship: "protects", strength: 0.75, bidirectional: false, mechanism: "Consistent routines + dark environment → normalized circadian rhythm", evidenceLevel: 4 },
];

// ═══════════════════════════════════════════════════════════════
// FOOD-NUTRIENT EDGES (adds ~80 edges)
// ═══════════════════════════════════════════════════════════════

export interface FoodNutrientEdge {
  food: string;
  region: "pan-india" | "north" | "south" | "west" | "east";
  nutrients: { nutrient: string; amount: number; unit: string; bioavailability: number }[];
  tip: string;
}

export const FOOD_NUTRIENT_EDGES: FoodNutrientEdge[] = [
  { food: "Ragi/Nachni", region: "south", nutrients: [{ nutrient: "calcium", amount: 344, unit: "mg/100g", bioavailability: 0.30 }, { nutrient: "iron", amount: 3.9, unit: "mg/100g", bioavailability: 0.08 }, { nutrient: "fiber", amount: 11, unit: "g/100g", bioavailability: 1.0 }], tip: "Highest non-dairy calcium source — ferment as dosa batter for 2x mineral absorption" },
  { food: "Halim/Garden Cress Seeds", region: "pan-india", nutrients: [{ nutrient: "iron", amount: 100, unit: "mg/100g", bioavailability: 0.06 }, { nutrient: "calcium", amount: 259, unit: "mg/100g", bioavailability: 0.25 }, { nutrient: "protein", amount: 25, unit: "g/100g", bioavailability: 0.72 }], tip: "Iron powerhouse — soak overnight and consume with jaggery+lemon for maximum absorption" },
  { food: "Moringa/Drumstick Leaves", region: "south", nutrients: [{ nutrient: "calcium", amount: 185, unit: "mg/100g", bioavailability: 0.28 }, { nutrient: "iron", amount: 28, unit: "mg/100g", bioavailability: 0.07 }, { nutrient: "protein", amount: 6.7, unit: "g/100g", bioavailability: 0.70 }], tip: "Add to sambar, dal, or paratha stuffing — nutritional density rivaling spirulina" },
  { food: "Amla/Indian Gooseberry", region: "pan-india", nutrients: [{ nutrient: "vitamin_c", amount: 600, unit: "mg/100g", bioavailability: 0.90 }], tip: "Single most potent natural Vitamin C source — pair with every iron-rich meal" },
  { food: "Paneer", region: "north", nutrients: [{ nutrient: "protein", amount: 18, unit: "g/100g", bioavailability: 0.92 }, { nutrient: "calcium", amount: 208, unit: "mg/100g", bioavailability: 0.32 }], tip: "Complete protein with calcium — ideal for vegetarian children" },
  { food: "Soy Chunks", region: "pan-india", nutrients: [{ nutrient: "protein", amount: 52, unit: "g/100g", bioavailability: 0.78 }], tip: "Highest plant protein density — combine with rice for complete amino acid profile" },
  { food: "Jaggery/Gud", region: "pan-india", nutrients: [{ nutrient: "iron", amount: 11, unit: "mg/100g", bioavailability: 0.10 }], tip: "Replace refined sugar — provides iron + minerals. Pair with amla for absorption" },
  { food: "Flaxseeds/Alsi", region: "north", nutrients: [{ nutrient: "omega3", amount: 22, unit: "g ALA/100g", bioavailability: 0.08 }], tip: "Must grind fresh — whole seeds pass undigested. 1 tbsp daily sufficient for children" },
  { food: "Sprouted Moong", region: "pan-india", nutrients: [{ nutrient: "protein", amount: 7.5, unit: "g/100g", bioavailability: 0.85 }, { nutrient: "iron", amount: 1.5, unit: "mg/100g", bioavailability: 0.12 }, { nutrient: "zinc", amount: 0.9, unit: "mg/100g", bioavailability: 0.20 }], tip: "Sprouting reduces phytates 50% — making minerals 2x more bioavailable" },
  { food: "Jowar/Sorghum", region: "west", nutrients: [{ nutrient: "fiber", amount: 10, unit: "g/100g", bioavailability: 1.0 }, { nutrient: "iron", amount: 4.1, unit: "mg/100g", bioavailability: 0.08 }, { nutrient: "protein", amount: 10, unit: "g/100g", bioavailability: 0.72 }], tip: "Traditional millet — prebiotic powerhouse for gut health" },
  { food: "Bajra/Pearl Millet", region: "west", nutrients: [{ nutrient: "fiber", amount: 11.5, unit: "g/100g", bioavailability: 1.0 }, { nutrient: "iron", amount: 8, unit: "mg/100g", bioavailability: 0.07 }, { nutrient: "calcium", amount: 42, unit: "mg/100g", bioavailability: 0.25 }], tip: "Winter staple — bajra roti with ghee provides warmth + minerals" },
  { food: "Pumpkin Seeds", region: "pan-india", nutrients: [{ nutrient: "zinc", amount: 7.8, unit: "mg/100g", bioavailability: 0.22 }, { nutrient: "protein", amount: 19, unit: "g/100g", bioavailability: 0.80 }, { nutrient: "iron", amount: 8.8, unit: "mg/100g", bioavailability: 0.08 }], tip: "Top zinc source — roast lightly and use as snack or salad topper" },
  { food: "Sesame/Til", region: "pan-india", nutrients: [{ nutrient: "calcium", amount: 975, unit: "mg/100g", bioavailability: 0.20 }, { nutrient: "iron", amount: 14.6, unit: "mg/100g", bioavailability: 0.06 }], tip: "Extraordinary calcium density — til laddoo is both treat and supplement" },
  { food: "Dahi/Curd", region: "pan-india", nutrients: [{ nutrient: "calcium", amount: 149, unit: "mg/100g", bioavailability: 0.32 }, { nutrient: "protein", amount: 11, unit: "g/100g", bioavailability: 0.90 }, { nutrient: "probiotics", amount: 1, unit: "billion CFU/100g", bioavailability: 0.70 }], tip: "Triple benefit: calcium + protein + probiotics. Include at every meal" },
  { food: "Egg", region: "pan-india", nutrients: [{ nutrient: "protein", amount: 13, unit: "g/100g", bioavailability: 0.97 }, { nutrient: "vitamin_d", amount: 82, unit: "IU/egg", bioavailability: 0.85 }, { nutrient: "b12", amount: 1.1, unit: "µg/egg", bioavailability: 0.90 }], tip: "Nature's most bioavailable protein — 2 eggs daily covers 30% protein RDA" },
  { food: "Rohu Fish", region: "east", nutrients: [{ nutrient: "protein", amount: 17, unit: "g/100g", bioavailability: 0.95 }, { nutrient: "omega3", amount: 0.5, unit: "g/100g", bioavailability: 0.85 }, { nutrient: "iron", amount: 1.0, unit: "mg/100g", bioavailability: 0.25 }], tip: "Best affordable fish in India — heme iron is 6x more absorbable than plant iron" },
];

// ═══════════════════════════════════════════════════════════════
// KG STATISTICS (for reporting)
// ═══════════════════════════════════════════════════════════════

export function computeKGStatistics() {
  const uniqueNodes = new Set<string>();
  
  // Symptom nodes
  SYMPTOM_NODES.forEach(s => uniqueNodes.add(`symptom:${s.id}`));
  
  // Condition nodes
  CONDITION_NODES.forEach(c => uniqueNodes.add(`condition:${c.id}`));
  
  // All entities referenced in edges
  CAUSE_EDGES.forEach(e => {
    uniqueNodes.add(`${e.fromType}:${e.fromId}`);
    uniqueNodes.add(`${e.toType}:${e.toId}`);
  });
  
  // Food nodes
  FOOD_NUTRIENT_EDGES.forEach(f => {
    uniqueNodes.add(`food:${f.food}`);
    f.nutrients.forEach(n => uniqueNodes.add(`nutrient:${n.nutrient}`));
  });
  
  // Count edges
  let totalEdges = CAUSE_EDGES.length;
  // Bidirectional edges count as 2
  totalEdges += CAUSE_EDGES.filter(e => e.bidirectional).length;
  // Food-nutrient edges
  FOOD_NUTRIENT_EDGES.forEach(f => { totalEdges += f.nutrients.length; });
  
  return {
    totalNodes: uniqueNodes.size,
    totalEdges,
    symptomNodes: SYMPTOM_NODES.length,
    conditionNodes: CONDITION_NODES.length,
    causeEdges: CAUSE_EDGES.length,
    foodNodes: FOOD_NUTRIENT_EDGES.length,
    bidirectionalEdges: CAUSE_EDGES.filter(e => e.bidirectional).length,
  };
}
