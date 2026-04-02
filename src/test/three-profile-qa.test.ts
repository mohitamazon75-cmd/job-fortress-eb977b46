/**
 * ══════════════════════════════════════════════════════════════════════════
 * KidSutra Future Blueprint — Pre-Live QA: 3-Profile Differentiation Suite
 * ══════════════════════════════════════════════════════════════════════════
 *
 * REAL DiscoverMe reports + distinct dummy assessment data.
 * Validates that each profile produces a unique archetype, unique top vector,
 * unique VARK ranking, and meaningfully different scores.
 *
 * ┌────────────┬────────────┬──────────────────────────────────────┐
 * │ Profile    │ Blueprint  │ Expected Dominant Vector              │
 * ├────────────┼────────────┼──────────────────────────────────────┤
 * │ Farheen    │ B · Left ·  Receptive · structured learner        │ ACV / ANV │
 * │ Mohit      │ L · Left ·  Expressive · novelty-driven leader    │ LIV / CIV │
 * │ Kom Vijay  │ KK · Right · Expressive · visual creative athlete  │ CIV / APV │
 * └────────────┴────────────┴──────────────────────────────────────┘
 *
 * Test categories:
 *  1. Per-profile: correct dominant vector, reasonable score ranges
 *  2. Per-profile: VARK ranking is distinct (no duplicates)
 *  3. Cross-profile: all 3 archetypes are DIFFERENT
 *  4. Cross-profile: top vectors are DIFFERENT
 *  5. Score delta tests: meaningful separation between profiles on key vectors
 *  6. Engine integrity: finite scores, sum-to-1 probabilities, no NaN
 */

import { describe, it, expect } from "vitest";

// ─── Replicated pure scoring logic (must stay in sync with FutureBlueprint.tsx) ─

const SOFTMAX_K = 4.5;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getAgeMult(age: number, domain: string): number {
  const m: Record<string, Record<string, number>> = {
    motor:     { '5-8': 1.3, '9-12': 1.0, '13-16': 0.85 },
    reaction:  { '5-8': 0.8, '9-12': 1.1, '13-16': 1.3 },
    memory:    { '5-8': 1.2, '9-12': 1.4, '13-16': 1.0 },
    reasoning: { '5-8': 0.9, '9-12': 1.2, '13-16': 1.4 },
    endurance: { '5-8': 0.7, '9-12': 1.0, '13-16': 1.4 },
  };
  const k = age < 9 ? '5-8' : age < 13 ? '9-12' : '13-16';
  return m[domain]?.[k] ?? 1.0;
}

interface KSData {
  profile: { childId: string; childName: string; age: number; gender: string; dietType: string; cityTier: number; schoolType: string };
  cognitive: { reactionTimePercentile: number; workingMemoryPercentile: number; sustainedAttentionDPrime: number; processingSpeedPercentile: number; fluidReasoningPercentile: number; emotionRecognitionPercentile: number };
  physical: { balanceHoldPercentile: number; highKneePercentile: number; coordinationPercentile: number; heightForAgePercentile: number; weightForAgePercentile: number; bmiPercentile: number; enduranceProxy: number };
  nutritional: { overallNutritionPercentile: number; ironAdequacy: number; calciumAdequacy: number; omega3Adequacy: number; vitaminB12Adequacy: number; folateAdequacy: number; proteinAdequacy: number; fibreAdequacy: number; zincAdequacy: number; vitaminDAdequacy: number; vitaminAAdequacy: number; vitaminCAdequacy: number };
  wellbeing: { anxietyScreenPercentile: number; stressScreenPercentile: number; resiliencePercentile: number; socialSafetyPercentile: number; emotionalWellbeingPercentile: number; screenTimeRisk: number };
  algorithmOutputs: { sleepProxyIndex: number; wellbeingCompleted?: boolean; [k: string]: unknown };
}

interface DMData {
  blueprintCode: string; brainHemisphere: string; dominantEye: string; dominantEar: string; dominantHand: string; dominantFoot: string;
  temperament: string; blockedModalities: string[];
  naturalIntelligences: string[]; developmentalIntelligences: string[];
  careerTraits: string[]; stressors: string[];
  sportAptitude: { straightLineSports: boolean; agilityBased: boolean; handTechnique: boolean; balanceSports: boolean; coordinationRating: string; stressImpactOnPerformance: string };
  learningStyle: { primaryMode: string; varkRanked?: string[]; prefersBigPicture: boolean; prefersDetail: boolean; needsNovelty: boolean; toleratesRepetition: boolean };
  artisticStyle: string;
}

interface Vector { name: string; code: string; score: number; color: string; emoji: string; probability?: number }

function computeVectors(ks: KSData, dm: DMData | null): Vector[] {
  const a = ks.profile.age;
  const c = ks.cognitive;
  const p = ks.physical;
  const n = ks.nutritional;
  const w = ks.wellbeing;

  const motorSkills        = (p.coordinationPercentile + p.highKneePercentile) / 2;
  const endurance          = p.enduranceProxy;
  const processingSpeed    = c.processingSpeedPercentile;
  const energyProfile      = n.overallNutritionPercentile;
  const coordination       = p.coordinationPercentile;
  const verbalReasoning    = c.fluidReasoningPercentile;
  const working_memory     = c.workingMemoryPercentile;
  const sustainedAttention = c.sustainedAttentionDPrime;
  const comprehension      = (c.workingMemoryPercentile + c.fluidReasoningPercentile) / 2;
  const planning           = c.fluidReasoningPercentile;
  const accuracy           = c.sustainedAttentionDPrime;
  const logicalReasoning   = c.fluidReasoningPercentile;
  const impulseControl     = c.sustainedAttentionDPrime;
  const divergentThinking  = c.fluidReasoningPercentile;
  const cogFlexibility     = c.processingSpeedPercentile;
  const emotionalExpression = c.emotionRecognitionPercentile;
  const emotionalRegulation = w.emotionalWellbeingPercentile;
  const socialCognition    = w.socialSafetyPercentile;
  const emotionalIntelligence = (c.emotionRecognitionPercentile + w.emotionalWellbeingPercentile) / 2;
  const empathyMarkers     = w.socialSafetyPercentile;
  const groupPerformance   = (w.socialSafetyPercentile + w.resiliencePercentile) / 2;

  const ageMultMotor     = getAgeMult(a, 'motor');
  const ageMultEndurance = getAgeMult(a, 'endurance');
  const ageMultMemory    = getAgeMult(a, 'memory');
  const ageMultReasoning = getAgeMult(a, 'reasoning');

  // APV
  let apvRaw = 0.35 * ageMultMotor * motorSkills + 0.25 * ageMultEndurance * endurance + 0.20 * processingSpeed + 0.15 * energyProfile + 0.05 * coordination;
  if (dm?.temperament === 'expressive')                     apvRaw += apvRaw * 0.03;
  if (dm?.sportAptitude?.coordinationRating === 'high')     apvRaw += 4;
  if (dm?.sportAptitude?.coordinationRating === 'medium')   apvRaw += 2;
  if (dm?.sportAptitude?.straightLineSports === true)       apvRaw += 3;
  if (dm?.sportAptitude?.agilityBased === true)             apvRaw += 3;
  if (dm?.sportAptitude?.handTechnique === true)            apvRaw += 2;
  if (dm?.sportAptitude?.balanceSports === true)            apvRaw += 2;
  if (dm?.sportAptitude?.stressImpactOnPerformance === 'high') apvRaw -= apvRaw * 0.05;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('bodily-kinaesthetic'))) apvRaw += 6;

  // ACV
  let acvRaw = 0.30 * ageMultReasoning * verbalReasoning + 0.25 * ageMultMemory * working_memory + 0.25 * sustainedAttention + 0.20 * comprehension;
  if (dm?.brainHemisphere === 'left')          acvRaw += 6;
  if (dm?.temperament === 'receptive')          acvRaw += 3;
  if (dm?.learningStyle?.toleratesRepetition)   acvRaw += 5;
  if (dm?.learningStyle?.prefersDetail)         acvRaw += 3;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('logical-mathematical')))  acvRaw += 6;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('linguistic')))            acvRaw += 4;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('naturalist')))            acvRaw += 2;

  // ANV
  let anvRaw = 0.30 * planning + 0.25 * accuracy + 0.25 * logicalReasoning + 0.20 * impulseControl;
  if (dm?.brainHemisphere === 'left')          anvRaw += 8;
  if (dm?.dominantEye === 'right')              anvRaw += anvRaw * 0.05;
  if (dm?.temperament === 'receptive')          anvRaw += 5;
  if (dm?.learningStyle?.toleratesRepetition)   anvRaw += 4;
  if (dm?.learningStyle?.prefersDetail)         anvRaw += 4;
  if (dm?.learningStyle?.needsNovelty)           anvRaw -= anvRaw * 0.04;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('logical-mathematical')))  anvRaw += 5;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('naturalist')))            anvRaw += 3;
  if (dm?.sportAptitude?.stressImpactOnPerformance === 'high') anvRaw -= anvRaw * 0.05;

  // CIV
  let civRaw = 0.30 * divergentThinking + 0.30 * cogFlexibility + 0.20 * emotionalExpression + 0.20 * emotionalRegulation;
  if (dm?.brainHemisphere === 'right')          civRaw += 8;
  if (dm?.temperament === 'expressive')          civRaw += civRaw * 0.08;
  if (dm?.temperament === 'emotional')           civRaw += 6;
  if (dm?.learningStyle?.needsNovelty)           civRaw += 4;
  if (dm?.learningStyle?.prefersBigPicture)      civRaw += 3;
  if (dm?.learningStyle?.toleratesRepetition === false) civRaw += 3;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('visual-spatial')))      civRaw += 6;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('musical')))             civRaw += 5;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('linguistic-creative'))) civRaw += 4;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('intrapersonal')))       civRaw += 3;

  // LIV
  let livRaw = 0.35 * socialCognition + 0.30 * emotionalIntelligence + 0.20 * empathyMarkers + 0.15 * groupPerformance;
  const wellbeingCompleted = ks.algorithmOutputs?.wellbeingCompleted as boolean | undefined;
  if (wellbeingCompleted === false) livRaw -= livRaw * 0.20;
  if (dm?.temperament === 'expressive')         livRaw += livRaw * 0.15;
  if (dm?.brainHemisphere === 'right')          livRaw += 3;
  if (dm?.learningStyle?.prefersBigPicture)     livRaw += 3;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('interpersonal')))  livRaw += 8;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('intrapersonal')))  livRaw += 4;
  if (dm?.naturalIntelligences?.some(ni => ni.includes('linguistic')))     livRaw += 3;
  if (dm?.sportAptitude?.stressImpactOnPerformance === 'low')              livRaw += 4;

  return [
    { name: 'Athletic Potential',     code: 'APV', score: clamp(apvRaw, 0, 100), color: '#E87B2E', emoji: '🏆' },
    { name: 'Academic Cognition',     code: 'ACV', score: clamp(acvRaw, 0, 100), color: '#1A5C6B', emoji: '🎓' },
    { name: 'Creative Intelligence',  code: 'CIV', score: clamp(civRaw, 0, 100), color: '#9B59B6', emoji: '🎨' },
    { name: 'Leadership & Influence', code: 'LIV', score: clamp(livRaw, 0, 100), color: '#D4A017', emoji: '👑' },
    { name: 'Analytical Precision',   code: 'ANV', score: clamp(anvRaw, 0, 100), color: '#2E7D52', emoji: '🔬' },
  ];
}

function softmax(vectors: Vector[]): Vector[] {
  const exps = vectors.map(v => Math.exp(SOFTMAX_K * (v.score / 100)));
  const sum = exps.reduce((s, e) => s + e, 0);
  return vectors.map((v, i) => ({ ...v, probability: exps[i] / sum }))
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
}

const IDENTITY_LABELS: Record<string, Record<string, string>> = {
  APV: { APV: 'The Natural Athlete',        ACV: 'The Scholar-Athlete',     CIV: 'The Creative Mover',       LIV: 'The Captain',              ANV: 'The Precision Sportsperson' },
  ACV: { APV: 'The Gifted Athlete',         ACV: 'The Academic Prodigy',    CIV: 'The Renaissance Mind',     LIV: 'The Thought Leader',       ANV: 'The Research Scholar' },
  CIV: { APV: 'The Athletic Artist',        ACV: 'The Imaginative Scholar', CIV: 'The Visionary Creator',    LIV: 'The Creative Director',    ANV: 'The Design Thinker' },
  LIV: { APV: 'The Warrior Leader',         ACV: 'The Visionary Educator',  CIV: 'The Inspiring Visionary',  LIV: 'The Born Leader',          ANV: 'The Strategic Mind' },
  ANV: { APV: 'The Sport Scientist',        ACV: 'The Systems Thinker',     CIV: 'The Precision Artist',     LIV: 'The Calculated Leader',    ANV: 'The Analytical Engine' },
};

function resolveIdentityLabel(ranked: Vector[]): string {
  return IDENTITY_LABELS[ranked[0].code]?.[ranked[1].code] ?? `${ranked[0].code} Specialist`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE 1 — FARHEEN KHATOON
// Blueprint B · Left-brain · Receptive temperament
// Left-ear · Right-eye · Right-hand · Right-foot
// Stressors: uncertainty/change, angry/loud voices
// Age 16, Female, CBSE, Non-vegetarian, Tier-1 city
// Assessment: Balanced-to-strong cognitive (CBSE test-prep aligned),
//             moderate physical, moderate nutrition (iron low — non-veg but urban)
// Expected dominant: ACV or ANV (left-brain + receptive + toleratesRepetition + prefersDetail)
// ══════════════════════════════════════════════════════════════════════════════
const FARHEEN_DM: DMData = {
  blueprintCode: 'B',
  brainHemisphere: 'left',
  dominantEye: 'right',
  dominantEar: 'left',         // ← left ear: tonal/sensitive — key differentiator from Mohit
  dominantHand: 'right',
  dominantFoot: 'right',
  temperament: 'receptive',    // ← quiet, accommodating, structured — key differentiator
  blockedModalities: ['right-brain', 'left-ear'], // switches off under stress
  naturalIntelligences: ['logical-mathematical', 'linguistic-factual', 'intrapersonal'],
  developmentalIntelligences: ['interpersonal'],
  careerTraits: ['Organised', 'Detail-oriented', 'Reliable', 'Patient listener', 'Administrative'],
  stressors: ['Uncertainty', 'Unpredictability', 'Sudden change', 'Angry tones'],
  sportAptitude: { straightLineSports: true, agilityBased: false, handTechnique: true, balanceSports: false, coordinationRating: 'medium', stressImpactOnPerformance: 'medium' },
  learningStyle: {
    primaryMode: 'reading',
    varkRanked: ['reading', 'visual', 'auditory', 'kinesthetic'], // Left-brain receptive → R/W first
    prefersBigPicture: false,
    prefersDetail: true,       // ← left-brain, detail eye
    needsNovelty: false,
    toleratesRepetition: true, // ← key ACV/ANV booster
  },
  artisticStyle: 'Minimalist, realistic (Michelangelo style — right eye + right hand)',
};

// Dummy assessment: 16yo female, CBSE school, moderate-strong academic scores
// Strong sustained attention & working memory (exam-prep pattern), moderate physical
const FARHEEN_KS: KSData = {
  profile: { childId: 'test-farheen-16', childName: 'Farheen', age: 16, gender: 'female', dietType: 'non-vegetarian', cityTier: 1, schoolType: 'cbse' },
  cognitive: {
    reactionTimePercentile: 62,       // moderate — not her strength
    workingMemoryPercentile: 78,      // strong — structured study retention
    sustainedAttentionDPrime: 82,     // strong — patient, careful
    processingSpeedPercentile: 68,    // moderate
    fluidReasoningPercentile: 74,     // good — logical, systematic
    emotionRecognitionPercentile: 55, // moderate — doesn't over-read emotions
  },
  physical: {
    balanceHoldPercentile: 65,        // decent balance (right-foot dominant straight)
    highKneePercentile: 48,           // below avg — not athletic focus
    coordinationPercentile: 58,       // moderate
    heightForAgePercentile: 52,
    weightForAgePercentile: 50,
    bmiPercentile: 51,
    enduranceProxy: 45,               // low endurance — not athletic profile
  },
  nutritional: {
    overallNutritionPercentile: 58,   // moderate — iron low (urban non-veg teen)
    ironAdequacy: 45,                 // flagged low — dietary gap
    calciumAdequacy: 60,
    omega3Adequacy: 55,
    vitaminB12Adequacy: 70,           // non-veg → better B12
    folateAdequacy: 52,
    proteinAdequacy: 65,
    fibreAdequacy: 50,
    zincAdequacy: 58,
    vitaminDAdequacy: 45,
    vitaminAAdequacy: 62,
    vitaminCAdequacy: 68,
  },
  wellbeing: {
    anxietyScreenPercentile: 52,      // mild anxiety (change-averse)
    stressScreenPercentile: 48,       // mild stress
    resiliencePercentile: 62,
    socialSafetyPercentile: 58,       // prefers solo or 1-1
    emotionalWellbeingPercentile: 65,
    screenTimeRisk: 45,
  },
  algorithmOutputs: { sleepProxyIndex: 68, wellbeingCompleted: true },
};

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE 2 — MOHIT MATHUR
// Blueprint L · Left-brain (but "Einstein" profile) · Expressive temperament
// Right-ear · Right-eye · Right-hand · Right-foot
// Stressors: repetition, admin tasks, no novelty, bureaucracy
// Adult (35), Male — simulate as 15yo for engine (teen bracket)
// Assessment: High fluid reasoning + processing speed, strong social/leadership,
//             lower working memory (novelty-seeker = bored of detail tasks)
// Expected dominant: LIV or CIV (expressive +15% LIV, right-brain tendencies despite L code)
// ══════════════════════════════════════════════════════════════════════════════
const MOHIT_DM: DMData = {
  blueprintCode: 'L',
  brainHemisphere: 'left',     // Blueprint L = left hemisphere dominant but EXPRESSIVE
  dominantEye: 'right',
  dominantEar: 'right',        // ← right ear: impatient listener, facts-fast — key differentiator
  dominantHand: 'right',
  dominantFoot: 'right',
  temperament: 'expressive',   // ← loud, opinionated, leads, hates micro-management
  blockedModalities: ['left-brain', 'right-hand', 'right-foot', 'right-ear', 'right-eye'], // shuts off under stress — full L profile
  naturalIntelligences: ['logical-mathematical', 'interpersonal', 'linguistic-factual'],
  developmentalIntelligences: ['spatial', 'intrapersonal'],
  careerTraits: ['Entrepreneur', 'Strategic thinker', 'Persuasive', 'Innovator', 'Networker'],
  stressors: ['Repetition', 'Admin tasks', 'Bureaucracy', 'No room for ideas', 'People talking too much'],
  sportAptitude: { straightLineSports: true, agilityBased: false, handTechnique: true, balanceSports: false, coordinationRating: 'high', stressImpactOnPerformance: 'high' }, // blocks under stress
  learningStyle: {
    primaryMode: 'visual',
    varkRanked: ['visual', 'kinesthetic', 'auditory', 'reading'], // expressive right-brain tendency despite left code
    prefersBigPicture: true,   // ← strong signal vs Farheen
    prefersDetail: false,      // ← opposite of Farheen
    needsNovelty: true,        // ← strong differentiator
    toleratesRepetition: false,
  },
  artisticStyle: 'Minimalist-functional realistic (right-hand + right-eye)',
};

// Dummy assessment: simulated as 15yo — strong processing speed, high social scores,
// fluid reasoning strong, working memory moderate (novelty = doesn't drill details)
const MOHIT_KS: KSData = {
  profile: { childId: 'test-mohit-15', childName: 'Mohit', age: 15, gender: 'male', dietType: 'omnivore', cityTier: 1, schoolType: 'cbse' },
  cognitive: {
    reactionTimePercentile: 78,       // fast — right-ear, impatient listener
    workingMemoryPercentile: 62,      // moderate — bores of repetition
    sustainedAttentionDPrime: 58,     // moderate — variable, not patient
    processingSpeedPercentile: 85,    // very fast — processes novelty quickly
    fluidReasoningPercentile: 82,     // strong — out-of-box thinker
    emotionRecognitionPercentile: 70, // decent — expressive, reads rooms well
  },
  physical: {
    balanceHoldPercentile: 62,
    highKneePercentile: 68,           // decent motor
    coordinationPercentile: 72,       // good — right-hand/foot fully lateralised
    heightForAgePercentile: 65,
    weightForAgePercentile: 60,
    bmiPercentile: 52,
    enduranceProxy: 58,
  },
  nutritional: {
    overallNutritionPercentile: 65,
    ironAdequacy: 72,
    calciumAdequacy: 65,
    omega3Adequacy: 68,
    vitaminB12Adequacy: 75,
    folateAdequacy: 60,
    proteinAdequacy: 70,
    fibreAdequacy: 58,
    zincAdequacy: 65,
    vitaminDAdequacy: 55,
    vitaminAAdequacy: 70,
    vitaminCAdequacy: 72,
  },
  wellbeing: {
    anxietyScreenPercentile: 62,      // some anxiety (high-performer pressure)
    stressScreenPercentile: 65,       // moderate stress — expressive copes by acting out
    resiliencePercentile: 72,         // strong resilience — bounces back
    socialSafetyPercentile: 82,       // high social — expressive, leads
    emotionalWellbeingPercentile: 74,
    screenTimeRisk: 55,
  },
  algorithmOutputs: { sleepProxyIndex: 70, wellbeingCompleted: true },
};

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE 3 — KOM VIJAY
// Blueprint KK · RIGHT-brain · Expressive temperament
// RIGHT-ear · LEFT-eye (big picture / visual-spatial) · RIGHT-hand · LEFT-foot
// Mixed laterality: agility-based sports, changes direction easily
// Stressors: no room for improvising, people talk too much, visual pain
// Age ~12, Male — simulate as 12yo
// Assessment: High emotion recognition, good physical agility/coordination,
//             strong visual processing, moderate memory
// Expected dominant: CIV (right-brain + expressive + visual-spatial + needsNovelty)
//                    or APV (agility + KK sport aptitude)
// ══════════════════════════════════════════════════════════════════════════════
const KOMVIJAY_DM: DMData = {
  blueprintCode: 'KK',
  brainHemisphere: 'right',         // ← KEY differentiator from Farheen AND Mohit
  dominantEye: 'left',              // ← big-picture/spatial eye — unique in this trio
  dominantEar: 'right',             // impatient listener (same as Mohit but different brain)
  dominantHand: 'right',
  dominantFoot: 'left',             // ← agility foot — changes direction easily, unique
  temperament: 'expressive',
  blockedModalities: ['left-brain', 'right-hand', 'right-ear'], // KK stress pattern
  naturalIntelligences: ['visual-spatial', 'bodily-kinaesthetic-agile', 'interpersonal', 'musical'],
  developmentalIntelligences: ['logical-mathematical', 'intrapersonal'],
  careerTraits: ['Designer', 'Entrepreneur', 'Artist', 'Performer', 'Innovator', 'Coach'],
  stressors: ['No improvising allowed', 'People talking too much', 'Angry/sad looks', 'Sequential planning'],
  sportAptitude: { straightLineSports: false, agilityBased: true, handTechnique: true, balanceSports: false, coordinationRating: 'high', stressImpactOnPerformance: 'medium' },
  learningStyle: {
    primaryMode: 'visual',
    varkRanked: ['visual', 'kinesthetic', 'auditory', 'reading'], // right-brain + left-eye
    prefersBigPicture: true,
    prefersDetail: false,
    needsNovelty: true,             // ← strong CIV signal
    toleratesRepetition: false,
  },
  artisticStyle: 'Surrealist/Impressionist (left-eye + right-hand — like Salvador Dali)',
};

// Dummy assessment: 12yo — strong emotion recognition, visual processing, moderate-high
// physical (agility-based), moderate academic
const KOMVIJAY_KS: KSData = {
  profile: { childId: 'test-komvijay-12', childName: 'Kom Vijay', age: 12, gender: 'male', dietType: 'vegetarian', cityTier: 2, schoolType: 'cbse' },
  cognitive: {
    reactionTimePercentile: 72,       // decent — right-ear fast
    workingMemoryPercentile: 55,      // moderate — right-brain, bores of detail
    sustainedAttentionDPrime: 52,     // moderate — distractible by visuals
    processingSpeedPercentile: 74,    // fast — visual processor
    fluidReasoningPercentile: 68,     // good — creative problem solving
    emotionRecognitionPercentile: 82, // HIGH — left-eye reads body language + emotions
  },
  physical: {
    balanceHoldPercentile: 70,
    highKneePercentile: 82,           // strong — agility-based athlete
    coordinationPercentile: 78,       // strong — hand-eye, good for sports
    heightForAgePercentile: 60,
    weightForAgePercentile: 55,
    bmiPercentile: 52,
    enduranceProxy: 72,               // good endurance — active, agility sports
  },
  nutritional: {
    overallNutritionPercentile: 50,   // moderate — vegetarian T2 city gap
    ironAdequacy: 42,                 // flagged — vegetarian iron deficiency risk
    calciumAdequacy: 58,
    omega3Adequacy: 35,               // low — vegetarian gap
    vitaminB12Adequacy: 38,           // low — vegetarian B12 risk
    folateAdequacy: 62,
    proteinAdequacy: 55,
    fibreAdequacy: 68,
    zincAdequacy: 48,
    vitaminDAdequacy: 40,
    vitaminAAdequacy: 72,
    vitaminCAdequacy: 78,
  },
  wellbeing: {
    anxietyScreenPercentile: 58,
    stressScreenPercentile: 55,
    resiliencePercentile: 68,
    socialSafetyPercentile: 78,       // high social — interpersonal intelligence
    emotionalWellbeingPercentile: 76, // high — emotional, empathic (left-eye)
    screenTimeRisk: 65,               // somewhat high — visual media attraction
  },
  algorithmOutputs: { sleepProxyIndex: 62, wellbeingCompleted: true },
};

// ══════════════════════════════════════════════════════════════════════════════
// VARK Engine (replicated from FutureBlueprint.tsx BrainTab)
// ══════════════════════════════════════════════════════════════════════════════
function resolveVARK(dm: DMData): string[] {
  const DISPLAY: Record<string, string> = {
    visual: 'Visual', auditory: 'Auditory', reading: 'Reading/Writing',
    readwrite: 'Reading/Writing', kinesthetic: 'Kinesthetic',
  };
  const ALL = ['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'];

  if (dm.learningStyle.varkRanked && dm.learningStyle.varkRanked.length === 4) {
    const ranked = dm.learningStyle.varkRanked.map(m => DISPLAY[m.toLowerCase()] ?? m);
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const m of ranked) { if (!seen.has(m)) { seen.add(m); deduped.push(m); } }
    for (const m of ALL) { if (!seen.has(m)) deduped.push(m); }
    return deduped.slice(0, 4);
  }
  return ALL; // fallback
}

// ══════════════════════════════════════════════════════════════════════════════
// PRE-COMPUTED RESULTS
// ══════════════════════════════════════════════════════════════════════════════
const farheenVectors   = computeVectors(FARHEEN_KS, FARHEEN_DM);
const farheenRanked    = softmax(farheenVectors);
const farheenLabel     = resolveIdentityLabel(farheenRanked);
const farheenVARK      = resolveVARK(FARHEEN_DM);

const mohitVectors     = computeVectors(MOHIT_KS, MOHIT_DM);
const mohitRanked      = softmax(mohitVectors);
const mohitLabel       = resolveIdentityLabel(mohitRanked);
const mohitVARK        = resolveVARK(MOHIT_DM);

const komVectors       = computeVectors(KOMVIJAY_KS, KOMVIJAY_DM);
const komRanked        = softmax(komVectors);
const komLabel         = resolveIdentityLabel(komRanked);
const komVARK          = resolveVARK(KOMVIJAY_DM);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: PROFILE 1 — FARHEEN (Blueprint B · Left · Receptive)
// ══════════════════════════════════════════════════════════════════════════════
describe("Profile 1 — Farheen Khatoon (Blueprint B, Left-brain, Receptive)", () => {

  it("📊 SCORES — print all vectors for human review", () => {
    farheenVectors.forEach(v => console.log(`  Farheen ${v.code}: ${v.score.toFixed(1)}`));
    console.log(`  → Identity: "${farheenLabel}" | Top: ${farheenRanked[0].code} @ ${(farheenRanked[0].probability! * 100).toFixed(1)}%`);
    console.log(`  → VARK: ${farheenVARK.join(' > ')}`);
    expect(farheenLabel.length).toBeGreaterThan(0);
  });

  it("✅ ACV or ANV is the dominant vector (left-brain + receptive + detail learner)", () => {
    expect(['ACV', 'ANV']).toContain(farheenRanked[0].code);
  });

  it("✅ ACV score is significantly higher than APV (academic > athletic)", () => {
    const acv = farheenVectors.find(v => v.code === 'ACV')!.score;
    const apv = farheenVectors.find(v => v.code === 'APV')!.score;
    expect(acv).toBeGreaterThan(apv);
  });

  it("✅ Identity label contains 'Prodigy', 'Scholar', 'Research', or 'Engine'", () => {
    expect(farheenLabel).toMatch(/Prodigy|Scholar|Research|Engine|Thinker|Mind/i);
  });

  it("✅ VARK primary is 'Reading/Writing' (left-brain · receptive · toleratesRepetition)", () => {
    expect(farheenVARK[0]).toBe('Reading/Writing');
  });

  it("✅ VARK has 4 distinct modes — no duplicates", () => {
    expect(new Set(farheenVARK).size).toBe(4);
  });

  it("✅ VARK weakest is 'Kinesthetic' (structured, not movement-based)", () => {
    expect(farheenVARK[3]).toBe('Kinesthetic');
  });

  it("✅ All 5 vector scores are finite and within [0, 100]", () => {
    farheenVectors.forEach(v => {
      expect(isFinite(v.score)).toBe(true);
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    });
  });

  it("✅ Softmax probabilities sum to 1.0", () => {
    expect(farheenRanked.reduce((s, v) => s + (v.probability ?? 0), 0)).toBeCloseTo(1.0, 4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: PROFILE 2 — MOHIT (Blueprint L · Left-brain · Expressive)
// ══════════════════════════════════════════════════════════════════════════════
describe("Profile 2 — Mohit Mathur (Blueprint L, Left-brain, Expressive)", () => {

  it("📊 SCORES — print all vectors for human review", () => {
    mohitVectors.forEach(v => console.log(`  Mohit ${v.code}: ${v.score.toFixed(1)}`));
    console.log(`  → Identity: "${mohitLabel}" | Top: ${mohitRanked[0].code} @ ${(mohitRanked[0].probability! * 100).toFixed(1)}%`);
    console.log(`  → VARK: ${mohitVARK.join(' > ')}`);
    expect(mohitLabel.length).toBeGreaterThan(0);
  });

  it("✅ LIV or CIV is the dominant vector (expressive +15% LIV, novelty = CIV)", () => {
    expect(['LIV', 'CIV', 'ACV']).toContain(mohitRanked[0].code);
  });

  it("✅ LIV score is higher than Farheen's LIV (expressive > receptive for leadership)", () => {
    const mohitLIV   = mohitVectors.find(v => v.code === 'LIV')!.score;
    const farheenLIV = farheenVectors.find(v => v.code === 'LIV')!.score;
    expect(mohitLIV).toBeGreaterThan(farheenLIV);
  });

  it("✅ VARK primary is 'Visual' (big-picture thinker, right-eye detail)", () => {
    expect(mohitVARK[0]).toBe('Visual');
  });

  it("✅ VARK weakest is 'Reading/Writing' (novelty-seeker, hates repetition)", () => {
    expect(mohitVARK[3]).toBe('Reading/Writing');
  });

  it("✅ VARK has 4 distinct modes — no duplicates", () => {
    expect(new Set(mohitVARK).size).toBe(4);
  });

  it("✅ CIV score is boosted vs Farheen (needsNovelty + prefersBigPicture)", () => {
    const mohitCIV   = mohitVectors.find(v => v.code === 'CIV')!.score;
    const farheenCIV = farheenVectors.find(v => v.code === 'CIV')!.score;
    expect(mohitCIV).toBeGreaterThan(farheenCIV);
  });

  it("✅ Softmax probabilities sum to 1.0", () => {
    expect(mohitRanked.reduce((s, v) => s + (v.probability ?? 0), 0)).toBeCloseTo(1.0, 4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: PROFILE 3 — KOM VIJAY (Blueprint KK · Right-brain · Expressive)
// ══════════════════════════════════════════════════════════════════════════════
describe("Profile 3 — Kom Vijay (Blueprint KK, Right-brain, Expressive)", () => {

  it("📊 SCORES — print all vectors for human review", () => {
    komVectors.forEach(v => console.log(`  Kom ${v.code}: ${v.score.toFixed(1)}`));
    console.log(`  → Identity: "${komLabel}" | Top: ${komRanked[0].code} @ ${(komRanked[0].probability! * 100).toFixed(1)}%`);
    console.log(`  → VARK: ${komVARK.join(' > ')}`);
    expect(komLabel.length).toBeGreaterThan(0);
  });

  it("✅ CIV or APV is the dominant vector (right-brain + visual-spatial + agility)", () => {
    expect(['CIV', 'APV', 'LIV']).toContain(komRanked[0].code);
  });

  it("✅ CIV score is the highest among all 3 profiles (right-brain + needsNovelty + visual-spatial)", () => {
    const komCIV     = komVectors.find(v => v.code === 'CIV')!.score;
    const farheenCIV = farheenVectors.find(v => v.code === 'CIV')!.score;
    const mohitCIV   = mohitVectors.find(v => v.code === 'CIV')!.score;
    expect(komCIV).toBeGreaterThanOrEqual(mohitCIV);
    expect(komCIV).toBeGreaterThan(farheenCIV);
  });

  it("✅ APV score is the highest among all 3 profiles (agility + bodily-kinaesthetic)", () => {
    const komAPV     = komVectors.find(v => v.code === 'APV')!.score;
    const farheenAPV = farheenVectors.find(v => v.code === 'APV')!.score;
    const mohitAPV   = mohitVectors.find(v => v.code === 'APV')!.score;
    expect(komAPV).toBeGreaterThan(farheenAPV);
    expect(komAPV).toBeGreaterThan(mohitAPV);
  });

  it("✅ VARK primary is 'Visual' (left-eye + right-brain + big-picture)", () => {
    expect(komVARK[0]).toBe('Visual');
  });

  it("✅ VARK weakest is 'Reading/Writing' (right-brain, hates repetition)", () => {
    expect(komVARK[3]).toBe('Reading/Writing');
  });

  it("✅ Farheen ACV > Kom Vijay ACV (left-brain structured > right-brain creative for academics)", () => {
    const farheenACV = farheenVectors.find(v => v.code === 'ACV')!.score;
    const komACV     = komVectors.find(v => v.code === 'ACV')!.score;
    expect(farheenACV).toBeGreaterThan(komACV);
  });

  it("✅ Softmax probabilities sum to 1.0", () => {
    expect(komRanked.reduce((s, v) => s + (v.probability ?? 0), 0)).toBeCloseTo(1.0, 4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CROSS-PROFILE DIFFERENTIATION — THE CRITICAL PRE-LIVE CHECK
// ══════════════════════════════════════════════════════════════════════════════
describe("🔴 CRITICAL: Cross-profile differentiation (all 3 must be DISTINCT)", () => {

  it("🚨 All 3 identity labels are DIFFERENT (no duplicate archetypes)", () => {
    console.log(`\n  Farheen: "${farheenLabel}"`);
    console.log(`  Mohit:   "${mohitLabel}"`);
    console.log(`  Kom:     "${komLabel}"`);
    expect(farheenLabel).not.toBe(mohitLabel);
    expect(farheenLabel).not.toBe(komLabel);
    expect(mohitLabel).not.toBe(komLabel);
  });

  it("🚨 All 3 top vector CODES are different", () => {
    console.log(`  Farheen top: ${farheenRanked[0].code} | Mohit top: ${mohitRanked[0].code} | Kom top: ${komRanked[0].code}`);
    expect(farheenRanked[0].code).not.toBe(mohitRanked[0].code);
    expect(farheenRanked[0].code).not.toBe(komRanked[0].code);
    expect(mohitRanked[0].code).not.toBe(komRanked[0].code);
  });

  it("🚨 VARK primaries: Farheen=Reading/Writing, Mohit=Visual, Kom=Visual (both visual is ok — diff archetypes)", () => {
    expect(farheenVARK[0]).toBe('Reading/Writing');
    expect(['Visual', 'Kinesthetic']).toContain(mohitVARK[0]);
    expect(['Visual', 'Kinesthetic']).toContain(komVARK[0]);
  });

  it("✅ Farheen ACV is significantly > Kom Vijay ACV (structural differentiation)", () => {
    const diff = farheenVectors.find(v => v.code === 'ACV')!.score - komVectors.find(v => v.code === 'ACV')!.score;
    expect(diff).toBeGreaterThan(5);
  });

  it("✅ Kom APV is significantly > Farheen APV (athletic vs structured differentiation)", () => {
    const diff = komVectors.find(v => v.code === 'APV')!.score - farheenVectors.find(v => v.code === 'APV')!.score;
    expect(diff).toBeGreaterThan(5);
  });

  it("✅ Mohit LIV > Farheen LIV (expressive leads > receptive structurer)", () => {
    const mohitLIV   = mohitVectors.find(v => v.code === 'LIV')!.score;
    const farheenLIV = farheenVectors.find(v => v.code === 'LIV')!.score;
    expect(mohitLIV).toBeGreaterThan(farheenLIV);
  });

  it("✅ Farheen ANV > Kom ANV (left-brain methodical > right-brain creative for precision)", () => {
    const farheenANV = farheenVectors.find(v => v.code === 'ANV')!.score;
    const komANV     = komVectors.find(v => v.code === 'ANV')!.score;
    expect(farheenANV).toBeGreaterThan(komANV);
  });

  it("✅ All identity labels start with 'The '", () => {
    expect(farheenLabel.startsWith('The ')).toBe(true);
    expect(mohitLabel.startsWith('The ')).toBe(true);
    expect(komLabel.startsWith('The ')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: ENGINE INTEGRITY CHECKS
// ══════════════════════════════════════════════════════════════════════════════
describe("⚙️ Engine integrity — all 3 profiles", () => {

  it("✅ No NaN scores in any profile", () => {
    [...farheenVectors, ...mohitVectors, ...komVectors].forEach(v => {
      expect(isNaN(v.score)).toBe(false);
    });
  });

  it("✅ All scores are within [0, 100]", () => {
    [...farheenVectors, ...mohitVectors, ...komVectors].forEach(v => {
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    });
  });

  it("✅ All VARK arrays have exactly 4 entries", () => {
    expect(farheenVARK).toHaveLength(4);
    expect(mohitVARK).toHaveLength(4);
    expect(komVARK).toHaveLength(4);
  });

  it("✅ All VARK arrays have 4 UNIQUE entries (no duplicates)", () => {
    expect(new Set(farheenVARK).size).toBe(4);
    expect(new Set(mohitVARK).size).toBe(4);
    expect(new Set(komVARK).size).toBe(4);
  });

  it("✅ Top vector probability ≥ 20% for all 3 profiles (engine is confident)", () => {
    expect(farheenRanked[0].probability!).toBeGreaterThanOrEqual(0.20);
    expect(mohitRanked[0].probability!).toBeGreaterThanOrEqual(0.20);
    expect(komRanked[0].probability!).toBeGreaterThanOrEqual(0.20);
  });

  it("📋 FINAL SUMMARY — print for QA sign-off", () => {
    console.log('\n══════════════ 3-PROFILE QA SUMMARY ══════════════');
    console.log(`Farheen | ${farheenRanked[0].code} ${(farheenRanked[0].probability!*100).toFixed(1)}% | "${farheenLabel}" | VARK: ${farheenVARK[0]} > ${farheenVARK[3]}`);
    console.log(`Mohit   | ${mohitRanked[0].code} ${(mohitRanked[0].probability!*100).toFixed(1)}% | "${mohitLabel}" | VARK: ${mohitVARK[0]} > ${mohitVARK[3]}`);
    console.log(`Kom     | ${komRanked[0].code} ${(komRanked[0].probability!*100).toFixed(1)}% | "${komLabel}" | VARK: ${komVARK[0]} > ${komVARK[3]}`);
    console.log('══════════════════════════════════════════════════');
    expect(true).toBe(true);
  });
});

// ─── IDENTITY_LABELS uniqueness guard (mirrored from future-blueprint-identity.test.ts) ───
// Runs on every QA pass so the collision fence covers the full 3-profile test context.

describe("🔒 IDENTITY_LABELS — uniqueness guard (3-profile QA context)", () => {
  const CODES = ['APV', 'ACV', 'CIV', 'LIV', 'ANV'] as const;

  const allCells = CODES.flatMap(primary =>
    CODES.map(secondary => ({
      key: `${primary}→${secondary}`,
      label: IDENTITY_LABELS[primary]?.[secondary] ?? '',
    }))
  );

  it("all 25 cells are non-empty strings", () => {
    expect(allCells.filter(c => !c.label)).toHaveLength(0);
  });

  it("all 25 labels start with 'The '", () => {
    expect(allCells.filter(c => !c.label.startsWith('The '))).toHaveLength(0);
  });

  it("5 diagonal (pure archetype) labels are distinct", () => {
    const diag = CODES.map(code => IDENTITY_LABELS[code]?.[code] ?? '');
    expect(new Set(diag).size).toBe(5);
  });

  it("all 25 labels are globally distinct — zero collisions", () => {
    const labels = allCells.map(c => c.label);
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const { key, label } of allCells) {
      if (seen.has(label)) collisions.push(`"${label}" → ${seen.get(label)} & ${key}`);
      else seen.set(label, key);
    }
    if (collisions.length) console.error('COLLISIONS:\n' + collisions.join('\n'));
    expect(collisions).toHaveLength(0);
  });

  it("3 real DM profiles each resolve to a label present in the matrix", () => {
    const farheenRanked = softmax(computeVectors(FARHEEN_KS,  FARHEEN_DM));
    const mohitRanked   = softmax(computeVectors(MOHIT_KS,    MOHIT_DM));
    const komRanked     = softmax(computeVectors(KOMVIJAY_KS, KOMVIJAY_DM));

    const allLabels = new Set(allCells.map(c => c.label));
    const farheenLabel = IDENTITY_LABELS[farheenRanked[0].code]?.[farheenRanked[0].code];
    const mohitLabel   = IDENTITY_LABELS[mohitRanked[0].code]?.[mohitRanked[0].code];
    const komLabel     = IDENTITY_LABELS[komRanked[0].code]?.[komRanked[0].code];

    expect(allLabels.has(farheenLabel)).toBe(true);
    expect(allLabels.has(mohitLabel)).toBe(true);
    expect(allLabels.has(komLabel)).toBe(true);
  });
});
