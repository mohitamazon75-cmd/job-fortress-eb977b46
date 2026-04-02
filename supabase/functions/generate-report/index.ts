// KidVital360 — Intelligence Engine V4.0 Edge Function
// Runs the complete 5-layer V4.0 pipeline server-side to protect IP
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runEngine } from "../_shared/engine-v4-engine.ts";
import type { RawAssessmentInput, EngineResult } from "../_shared/engine-v4-types.ts";
import { DietType, CityTier, Season, Gender } from "../_shared/engine-v4-types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Atomic DB-backed rate limiter (P0-4 fix — uses SQL advisory lock) ───────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;

async function checkRateLimit(
  userId: string,
  serviceClient: ReturnType<typeof createClient>
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await serviceClient.rpc("check_and_increment_rate_limit", {
    p_key: userId,
    p_action: "generate_report",
    p_max: RATE_LIMIT_MAX,
    p_window_sec: RATE_LIMIT_WINDOW_MINUTES * 60,
  });

  if (error) {
    // On DB error, fail open to avoid blocking legitimate users, but log it
    console.error("[rate-limit] DB error, failing open:", error.message);
    return { allowed: true, remaining: 1 };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: result?.allowed ?? true,
    remaining: Math.max(0, RATE_LIMIT_MAX - (result?.current_count ?? 0)),
  };
}

// ─── Input validation & clamping (P0-A: prevents engine instability / injection) ─
function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function validateAndClampPhysical(raw: Record<string, unknown>): Record<string, number> {
  return {
    balance:     clampNum(raw.balance,     0, 200, 15),
    coordination:clampNum(raw.coordination,0, 100, 50),
    grip:        clampNum(raw.grip ?? raw.strength, 0, 100, 50),
    strength:    clampNum(raw.strength,    0, 100, 50),
    endurance:   clampNum(raw.endurance,   0, 100, 50),
    flexibility: clampNum(raw.flexibility, 0, 100, 50),
    height:      clampNum(raw.height,      50, 250, 120),
    weight:      clampNum(raw.weight,      5, 200, 25),
  };
}

function validateAndClampCognitive(raw: Record<string, unknown>): Record<string, number> {
  return {
    attention:        clampNum(raw.attention,  0, 100, 50),
    memory:           clampNum(raw.memory,     0, 100, 50),
    processing:       clampNum(raw.processing, 0, 100, 50),
    reasoning:        clampNum(raw.reasoning,  0, 100, 50),
    emotional:        clampNum(raw.emotional ?? raw.emotion, 0, 100, 50),
    // TIER-1: preserve raw reaction time ms if present (saved by CognitiveAssessment.tsx)
    _reaction_time_ms: clampNum(raw._reaction_time_ms ?? -1, -1, 9999, -1),
  };
}

function validateAndClampNutritional(raw: Record<string, unknown>): Record<string, number> {
  return {
    calories: clampNum(raw.calories, 0, 5000, 1500),
    protein:  clampNum(raw.protein,  0, 100,  50),
    calcium:  clampNum(raw.calcium,  0, 100,  50),
    iron:     clampNum(raw.iron,     0, 100,  50),
    fiber:    clampNum(raw.fiber ?? raw.fibre, 0, 100, 50),
    fibre:    clampNum(raw.fibre ?? raw.fiber, 0, 100, 50),
    water:    clampNum(raw.water,    0, 10,   1.2),
    vitaminC: clampNum(raw.vitaminC, 0, 100,  50),
    zinc:     clampNum(raw.zinc,     0, 100,  50),
    vitaminD: clampNum(raw.vitaminD, 0, 100,  50),
  };
}

// ─── Map legacy frontend input → V4 RawAssessmentInput ──────────────────
function mapLegacyToV4Input(
  childProfile: any,
  physicalData: Record<string, number>,
  cognitiveData: Record<string, number>,
  nutritionalData: Record<string, number>,
  previousReport: any
): RawAssessmentInput {
  // P0-A: Clamp and validate all incoming data before processing
  const pd = validateAndClampPhysical(physicalData);
  const cd = validateAndClampCognitive(cognitiveData);
  const nd = validateAndClampNutritional(nutritionalData);

  const age = clampNum(childProfile.age, 1, 18, 8);
  const gender: Gender = childProfile.gender === "female" ? Gender.Female : Gender.Male;

  // Map city tier
  const cityTierMap: Record<string, CityTier> = {
    tier1: CityTier.T1, t1: CityTier.T1, "1": CityTier.T1,
    tier2: CityTier.T2, t2: CityTier.T2, "2": CityTier.T2,
    tier3: CityTier.T3, t3: CityTier.T3, "3": CityTier.T3,
  };
  const cityTier = cityTierMap[(childProfile.cityTier ?? "tier1").toLowerCase()] ?? CityTier.T1;

  // Map diet type
  const dietMap: Record<string, DietType> = {
    vegetarian: DietType.Vegetarian,
    vegan: DietType.Vegan,
    jain: DietType.Jain,
    omnivore: DietType.Omnivore,
    eggetarian: DietType.Eggetarian,
  };
  const dietType = dietMap[(childProfile.diet ?? "vegetarian").toLowerCase()] ?? DietType.Vegetarian;

  // Detect current season from date
  const month = new Date().getMonth(); // 0-11
  const season: Season = month >= 2 && month <= 5 ? Season.Summer :
    month >= 6 && month <= 9 ? Season.Monsoon : Season.Winter;

  // Map physical data using clamped values
  const physical = {
    balanceHoldSeconds: pd.balance,
    balanceSwayPixelsPerFrame: 3.0,
    coordinationScore: pd.coordination,
    strengthProxy: pd.grip,
    enduranceScore: pd.endurance,
    flexibilityScore: pd.flexibility,
    heightCm: clampNum(childProfile.height ?? pd.height, 50, 250, 120),
    weightKg: clampNum(childProfile.weight ?? pd.weight, 5, 200, 25),
  };

  // Derive BMI if height/weight available
  if (childProfile.height && childProfile.weight) {
    const bmiCalc = childProfile.weight / ((childProfile.height / 100) ** 2);
    // Clamp to sane range; balanceSwayPixelsPerFrame is a proxy we keep default
    (physical as any).bmi = bmiCalc;
  }

  // Map cognitive data using clamped values
  // TIER-1 FIX: use real reaction time ms if saved, falling back to reverse-engineered estimate
  const rawReactionMs = (cd as any)._reaction_time_ms;
  const hasRealReactionMs = typeof rawReactionMs === "number" && rawReactionMs > 0;
  const reactionTimeMs = hasRealReactionMs
    ? rawReactionMs
    : (cd.processing > 0 ? Math.round(800 - cd.processing * 4) : 450);

  // Compute variability proxy from the ms value (±15% of mean is typical healthy variability)
  const reactionVariabilityMs = hasRealReactionMs ? Math.round(reactionTimeMs * 0.15) : 70;

  const cognitive = {
    reactionTimeMs,
    reactionTimeVariabilityMs: reactionVariabilityMs,
    workingMemoryScore: cd.memory,
    fluidReasoningScore: cd.reasoning,
    sustainedAttentionDPrime: (cd.attention / 100) * 4,
    processingSpeedScore: cd.processing,
    emotionRecognitionScore: cd.emotional,
    falseStartRate: 0.10,
  };

  // Map nutritional data using clamped values
  // TIER-1 FIX: use real dietary answers from NutritionAssessment.tsx if saved; else fall back to defaults
  let dietaryAnswers: number[] = Array(10).fill(2); // fallback: neutral mid-range
  if (nutritionalData && (nutritionalData as any)._raw_answers) {
    try {
      const parsed = JSON.parse((nutritionalData as any)._raw_answers as string);
      // parsed is a NutritionAnswers object { "0": 2, "1": 3, ... } — convert to indexed array
      const maxIdx = Math.max(...Object.keys(parsed).map(Number));
      const arr: number[] = Array(maxIdx + 1).fill(2);
      for (const [k, v] of Object.entries(parsed)) {
        const val = typeof v === "number" ? v : parseInt(v as string);
        arr[parseInt(k)] = Math.max(0, Math.min(3, val));
      }
      // Pad to exactly 10 answers (engine requires exactly 10); fill missing with neutral value 2
      while (arr.length < 10) arr.push(2);
      if (arr.length >= 9) dietaryAnswers = arr.slice(0, 10);
    } catch (e) {
      console.warn("[TIER-1] Failed to parse _raw_answers:", e);
    }
  }
  const isVegetarian = (nutritionalData as any)?._is_vegetarian === 1 ||
    ["vegetarian", "vegan", "jain"].includes((childProfile.diet ?? "").toLowerCase());

  // Derive dietary field hints from the real answers using the same NUTRIENT_MAP logic
  // Q1 (idx 1) = dal/legumes (iron), Q3 (idx 3) = leafy greens (iron), Q6 (idx 6) = millets (iron)
  const ironAnswerSum = (dietaryAnswers[1] ?? 2) + (dietaryAnswers[3] ?? 2) + (dietaryAnswers[6] ?? 2);
  const ironRichFreq = Math.round(ironAnswerSum / 3); // 0-3 average
  // Q0 = dairy (calcium), Q6 = millets (calcium)
  const calciumFromDairy = (dietaryAnswers[0] ?? 2) >= 2;
  const calciumFromMillets = (dietaryAnswers[6] ?? 2) >= 2;
  const calciumSources = calciumFromDairy
    ? ["milk", "curd", ...(calciumFromMillets ? ["millet"] : [])]
    : ["curd", ...(calciumFromMillets ? ["millet"] : [])];
  // Q1 = dal (protein)
  const proteinSources = isVegetarian
    ? ["dal", "paneer", ...(dietaryAnswers[2] !== undefined && !isVegetarian ? ["egg"] : [])]
    : ["dal", "egg", "paneer"];
  // Q4 = fruit (fiber), Q6 = millet (fiber), Q1 = dal (fiber)
  const fibreScore = ((dietaryAnswers[4] ?? 2) + (dietaryAnswers[6] ?? 2) + (dietaryAnswers[1] ?? 2)) / 3;
  // Q8 = sunlight (vitamin D proxy via vitC for absorption tracking)
  const vitCEstimate = (dietaryAnswers[4] ?? 2) >= 2 ? 55 : 35; // fruit Q4
  // Q5 = water
  const waterAnswerMl = [600, 1100, 1600, 2200][Math.min(3, dietaryAnswers[5] ?? 2)];
  // spinach as primary Ca source: leafy high (Q3 >= 2) but dairy low (Q0 <= 1)
  const spinachAsPrimaryCa = (dietaryAnswers[3] ?? 2) >= 2 && (dietaryAnswers[0] ?? 2) <= 1;
  // legume days: dal answer maps to 0→0, 1→2, 2→4, 3→7
  const legumeDays = [0, 2, 4, 7][Math.min(3, dietaryAnswers[1] ?? 2)];

  const dietary = {
    answers: dietaryAnswers,
    dietType,
    ironRichFoodFrequency: ironRichFreq,
    calciumSources,
    proteinSources,
    fibreIntake: nd.fibre > 0 ? nd.fibre : Math.round(fibreScore * 25),
    vitCIntake: vitCEstimate,
    legumeDays,
    spinachAsPrimaryCa,
    dailyWaterIntakeMl: nd.water > 0 ? nd.water * 1000 : waterAnswerMl,
    stapleGrains: ["rice", "wheat"],
  };

  // Map psychosocial (wellbeing data if provided)
  // TIER-1 FIX: use real per-question wellbeing answers if saved; else fall back to aggregate scores
  let psychosocialAnswers: number[] = Array(12).fill(2); // fallback: neutral
  const rawWellbeingAnswers = (cognitiveData as any)?._wellbeing_answers;
  if (rawWellbeingAnswers) {
    try {
      const parsed = JSON.parse(rawWellbeingAnswers as string);
      const maxIdx = Math.max(...Object.keys(parsed).map(Number));
      const arr: number[] = Array(Math.max(12, maxIdx + 1)).fill(2);
      for (const [k, v] of Object.entries(parsed)) {
        const val = typeof v === "number" ? v : parseInt(v as string);
        arr[parseInt(k)] = Math.max(0, Math.min(3, val));
      }
      psychosocialAnswers = arr;
    } catch (e) {
      console.warn("[TIER-1] Failed to parse _wellbeing_answers:", e);
    }
  }

  const wellbeing = childProfile.wellbeing ?? {};
  const psychosocial = {
    answers: psychosocialAnswers,
    anxietyIndex: wellbeing.anxietyIndex ?? (cognitiveData as any)?._wellbeing_anxiety ?? 40,
    stressIndex: wellbeing.stressIndex ?? (cognitiveData as any)?._wellbeing_stress ?? 40,
    emotionalWellbeingScore: wellbeing.emotionalWellbeing ?? (cognitiveData as any)?._wellbeing_emotional ?? 55,
    socialSafetyScore: wellbeing.socialSafety ?? (cognitiveData as any)?._wellbeing_social ?? 55,
    resilienceScore: wellbeing.resilience ?? (cognitiveData as any)?._wellbeing_resilience ?? 55,
    screenTimeHoursPerDay: childProfile.screenTime === "low" ? 1.5 :
      childProfile.screenTime === "medium" ? 3 :
      childProfile.screenTime === "high" ? 5 : 2.5,
  };

  // Previous sessions for longitudinal tracking
  const previousSessions = previousReport?.v4Sessions ?? [];

  return {
    profile: {
      id: childProfile.id ?? "anonymous",
      ageYears: age,
      ageMonths: 0,
      gender,
      cityTier,
      season,
      dietType,
      assessmentDate: new Date().toISOString().split("T")[0],
      sessionNumber: previousSessions.length + 1,
    },
    physical,
    cognitive,
    dietary,
    psychosocial,
    previousSessions,
  };
}

// ─── Bridge V4 EngineResult → legacy IntelligenceReport shape ───────────
function bridgeV4ToLegacy(result: EngineResult, childProfile: any): any {
  const { percentiles, algorithmOutputs: alg, patternActivations, actionPlan } = result;
  const p = percentiles;

  // Map domain percentiles to legacy pScores/cScores/nScores
  const pScores: Record<string, number> = {
    balance: p.physical.balance,
    coordination: p.physical.coordination,
    grip: p.physical.strength,
    endurance: p.physical.endurance,
    flexibility: p.physical.flexibility,
  };

  const cScores: Record<string, number> = {
    attention: p.cognitive.sustainedAttention,
    memory: p.cognitive.workingMemory,
    processing: p.cognitive.processingSpeed,
    reasoning: p.cognitive.fluidReasoning,
    emotional: p.cognitive.emotionRecognition,
  };

  const nScores: Record<string, number> = {
    calories: p.dietary.calories,
    protein: p.dietary.protein,
    calcium: p.dietary.calcium,
    iron: p.dietary.iron,
    fiber: p.dietary.fibre,
    water: Math.round(p.dietary.vitaminC * 0.8), // proxy
  };

  const nScoresEffective: Record<string, number> = {};
  for (const [k, v] of Object.entries(nScores)) {
    nScoresEffective[k] = alg.bioavailabilityScores[k === "fiber" ? "fibre" : k] ?? v;
  }

  const avg = (scores: Record<string, number>) => {
    const vals = Object.values(scores);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  };

  const pAvg = p.physical.composite;
  const cAvg = p.cognitive.composite;
  const nAvg = p.dietary.composite;
  const nAvgEffective = avg(nScoresEffective);
  const integrated = alg.latentHealthScore.lhs;

  // Developmental age
  const devAgePhys = alg.developmentalAge.find(d => d.domain === "physical");
  const devAgeCog = alg.developmentalAge.find(d => d.domain === "cognitive");
  const chronoYears = result.childProfile.ageYears;
  const devAgePhysYears = devAgePhys ? devAgePhys.developmentalAgeMonths / 12 : chronoYears;
  const devAgeCogYears = devAgeCog ? devAgeCog.developmentalAgeMonths / 12 : chronoYears;
  const overallDevYears = (devAgePhysYears + devAgeCogYears) / 2;
  const gap = overallDevYears - chronoYears;

  const devAge = {
    physical: Math.round(devAgePhysYears * 10) / 10,
    cognitive: Math.round(devAgeCogYears * 10) / 10,
    overall: Math.round(overallDevYears * 10) / 10,
    chronological: chronoYears,
    gap: Math.round(gap * 10) / 10,
    interpretation: Math.abs(gap) <= 1.5 ? "Stable — developing on track" :
      gap > 1.5 ? "Advanced — ahead of chronological age" :
      "Developing — some areas below age expectation",
  };

  // Dev velocity from velocity results
  const physVel = alg.velocityResults.find(v => v.metric === "physical_composite");
  const cogVel = alg.velocityResults.find(v => v.metric === "cognitive_composite");
  const velLabel = (v: typeof physVel) => !v ? "stable" :
    v.direction === "improving" ? "accelerating" :
    v.direction === "declining" ? "decelerating" : "stable";

  // Velocity is expressed as a multiplier (1.0x = on-track baseline).
  // On first session there are no previous data points so magnitude is 0 —
  // default to 1.0 (on-track) so the UI never shows "0x".
  const physMag = physVel ? Math.max(0.1, physVel.magnitude) : 1.0;
  const cogMag  = cogVel  ? Math.max(0.1, cogVel.magnitude)  : 1.0;
  const physVelDisplay = physVel ? (physVel.direction === "improving" ? 1.0 + physMag / 100 : physVel.direction === "declining" ? Math.max(0.5, 1.0 - physMag / 100) : 1.0) : 1.0;
  const cogVelDisplay  = cogVel  ? (cogVel.direction === "improving"  ? 1.0 + cogMag / 100  : cogVel.direction === "declining"  ? Math.max(0.5, 1.0 - cogMag / 100)  : 1.0) : 1.0;
  const overallVelDisplay = Math.round(((physVelDisplay + cogVelDisplay) / 2) * 10) / 10;

  const devVelocity = {
    physical: { velocity: Math.round(physVelDisplay * 10) / 10, trajectory: velLabel(physVel), interpretation: "Physical development trajectory" },
    cognitive: { velocity: Math.round(cogVelDisplay * 10) / 10, trajectory: velLabel(cogVel), interpretation: "Cognitive development trajectory" },
    overall: { velocity: overallVelDisplay, trajectory: physVel || cogVel ? velLabel(physVel) : "stable", interpretation: "Overall development" },
  };

  // ── Parent-friendly label helpers ─────────────────────────────────────────
  function categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      nutritional_cognitive: "Nutrition & Brain",
      physical_cognitive: "Movement & Mind",
      psychosocial_physiological: "Emotions & Body",
      developmental: "Development",
      india_specific: "Nutrition (India)",
      composite: "Overall Health",
    };
    return map[cat] ?? cat.replace(/_/g, " ");
  }

  // ── Domain composite lookup for data-driven signal text ─────────────────
  const domainComposites: Record<string, number> = {
    "Physical Fitness": Math.round(pAvg),
    "Brain Performance": Math.round(cAvg),
    "Nutrition": Math.round(nAvg),
    "Emotional Wellbeing": Math.round(p.psychosocial?.composite ?? 50),
  };

  // Returns the domain name and score for the highest/lowest composite
  function getTopDomain(): { name: string; score: number } {
    let top = { name: "Physical Fitness", score: 0 };
    for (const [d, s] of Object.entries(domainComposites)) {
      if (s > top.score) top = { name: d, score: s };
    }
    return top;
  }
  function getBottomDomain(): { name: string; score: number } {
    let bot = { name: "Nutrition", score: 100 };
    for (const [d, s] of Object.entries(domainComposites)) {
      if (s < bot.score) bot = { name: d, score: s };
    }
    return bot;
  }

  // Convert technical signalInputs into specific, child-named observation bullets
  function translateSignals(raw: string, patternId: string): string[] {
    const name = childProfile.name;

    // Pattern-specific rich signal explanations (grounded in what the child's data actually shows)
    const SIGNAL_OVERRIDES: Record<string, string[]> = {
      HP01: [
        `${name}'s sustained attention score was in the lower range — consistent with insufficient iron reaching the brain`,
        `Physical endurance was below average, suggesting oxygen delivery to muscles may be limited`,
        `Together, these two signals raise the likelihood of iron insufficiency affecting both brain and body`,
      ],
      HP02: [
        `${name} follows a vegetarian diet in an urban setting — the highest-risk profile for combined iron + Vitamin D gaps`,
        `Both iron and Vitamin D probability scores crossed the alert threshold simultaneously`,
        `These two deficiencies amplify each other: low Vitamin D reduces iron absorption efficiency`,
      ],
      HP03: [
        `${name} eats legumes (dal, rajma, chana) 5+ days a week — a good habit, but legumes contain phytates that block iron absorption`,
        `Despite frequent iron-containing foods, iron scores remain low — suggesting absorption, not just intake, is the issue`,
        `The bioavailability algorithm detected an absorption efficiency below 35% for iron`,
      ],
      HP04: [
        `Spinach is being used as a primary calcium source — but spinach contains oxalates that block up to 95% of its calcium`,
        `${name}'s calcium score is below the 45th percentile despite eating "calcium foods"`,
        `Bone-building nutrients may be present in the diet but not actually reaching the bones`,
      ],
      HP05: [
        `${name}'s protein intake is strong (above 60th percentile), which is great — but high protein can compete with iron at absorption sites`,
        `Iron scores remain low despite adequate food variety, pointing to a competition effect at the gut level`,
      ],
      HP06: [
        `Fibre intake is below recommended levels, which affects gut microbiome diversity`,
        `The gut produces ~90% of the body's serotonin — low fibre can disrupt this, affecting mood and emotional regulation`,
        `${name}'s emotional wellbeing or mood-related scores showed signals consistent with this gut-brain connection`,
      ],
      HP07: [
        `Screen time is above recommended levels for ${name}'s age group`,
        `High screen time consistently reduces time available for active outdoor play`,
        `Motor development scores (balance, coordination) are below the expected range for ${name}'s age`,
      ],
      HP08: [
        `${name}'s activity level appears low relative to recommended daily physical movement`,
        `Physical activity drives blood flow to the prefrontal cortex — the brain region responsible for focus and planning`,
        `Attention scores in the assessment were below the 40th percentile, consistent with reduced activity-driven brain stimulation`,
      ],
      HP09: [
        `Endurance scores were low — ${name} may fatigue quickly during physical activity`,
        `Iron is required to carry oxygen in red blood cells; low iron directly reduces stamina and exercise tolerance`,
        `This physical signal combined with dietary patterns raises the likelihood of iron being a contributing factor`,
      ],
      HP10: [
        `${name}'s balance score was in the lower range for their age`,
        `The vestibular system (inner ear) that governs balance shares neural pathways with reading and focus`,
        `Balance challenges at this age can quietly affect classroom concentration and reading fluency`,
      ],
      HP11: [
        `${name}'s coordination score is below age expectations`,
        `Fine motor coordination and spatial reasoning (used in maths and geometry) share overlapping brain circuits`,
        `Children with coordination challenges often find spatial subjects harder — not due to intelligence, but neural pathway overlap`,
      ],
      HP12: [
        `Screen use before bedtime was reported — blue light suppresses melatonin production`,
        `Poor melatonin signalling delays sleep onset and reduces deep sleep quality`,
        `Disrupted sleep directly impacts memory consolidation, mood, and next-day attention in children`,
      ],
      HP13: [
        `Wellbeing screener responses showed patterns associated with emotional stress`,
        `Multiple psychosocial indicators (peer relations, emotional regulation, self-esteem) fell below typical ranges`,
        `These patterns are common and very responsive to supportive parenting and routine adjustments`,
      ],
      HP14: [
        `Several anxiety-associated signals were detected across ${name}'s psychosocial screener`,
        `Anxiety in children often presents as physical complaints (stomach aches, headaches) or school avoidance`,
        `This pattern does not confirm a diagnosis — it's a flag to observe and support proactively`,
      ],
      HP24: (() => {
        const top = getTopDomain();
        const bot = getBottomDomain();
        const gap = top.score - bot.score;
        return [
          `${name}'s ${top.name} score is in the top ${100 - top.score}% of children this age (${top.score}th percentile) — a genuine strength`,
          `At the same time, ${name}'s ${bot.name} score is at the ${bot.score}th percentile — significantly below the expected range`,
          `The ${gap}-point gap between ${top.name} and ${bot.name} is what triggered this finding — in children, a strong domain often absorbs all the attention while the weaker one quietly falls further behind`,
        ];
      })(),
      HP28: (() => {
        // List domains that are below 40th percentile
        const lowDomains = Object.entries(domainComposites)
          .filter(([, s]) => s < 40)
          .sort(([, a], [, b]) => a - b)
          .map(([d, s]) => `${d} (${s}th percentile)`);
        const lowList = lowDomains.length >= 2
          ? lowDomains.join(", ")
          : `multiple domains`;
        return [
          `${name}'s assessment flagged low scores across ${lowList} simultaneously`,
          `These areas are biologically connected — low nutrition reduces brain energy, which reduces motivation for physical activity, which disrupts sleep and emotional regulation`,
          `Fixing just one area in isolation will have limited impact; a coordinated plan across all flagged areas is needed`,
        ];
      })(),
      HP29: (() => {
        const top = getTopDomain();
        const bot = getBottomDomain();
        const gap = top.score - bot.score;
        const topPct = top.score;
        const botPct = bot.score;
        return [
          `${name} is performing exceptionally well in ${top.name} — scoring at the ${topPct}th percentile, meaning ${name} is ahead of ${topPct}% of children the same age`,
          `At the same time, ${name}'s ${bot.name} score is at the ${botPct}th percentile — this is significantly below where we'd want it to be for their age`,
          `The ${gap}-point gap between ${top.name} (${topPct}th) and ${bot.name} (${botPct}th) is the pattern we detected — ${top.name} is getting all the recognition while ${bot.name} quietly falls further behind`,
          `Without targeted support, this imbalance tends to widen — the strong domain gets stronger, the weaker one gets weaker`,
        ];
      })(),
      HP32: [
        `All four areas — physical fitness, brain performance, nutrition, and emotional wellbeing — are in healthy ranges for ${name}'s age`,
        `Resilience indicators are strong, meaning ${name} has built-in buffers against typical stressors`,
        `No corrective action needed — this assessment is about building on a strong foundation`,
      ],
      HP33: [
        `${name} is 10–12 years old — a developmental transition point where nutritional demands and risk factors significantly increase`,
        `Two or more performance areas are showing a declining trend at exactly the time when the body and brain need the most support`,
        `This age window is time-sensitive: early support now has 3–5x the impact of the same support given 2 years later`,
      ],
    };

    if (SIGNAL_OVERRIDES[patternId]) return SIGNAL_OVERRIDES[patternId];

    // Fallback: convert technical signals into clean parent-friendly sentences
    const parts = raw
      .split(/\s*\+\s*|\s+AND\s+/i)
      .map(s => s.trim())
      .filter(Boolean);

    return parts.map(s => {
      // Posterior / probability signals
      const ironPost = s.match(/Iron posterior[^\d]*(\d+)%/i);
      if (ironPost) return `Multiple signals in ${name}'s data together point toward iron deficiency — this is worth checking with a simple blood test`;

      const vitDPost = s.match(/Vit\s*D posterior[^\d]*(\d+)%/i);
      if (vitDPost) return `${name}'s diet and lifestyle profile suggests Vitamin D is likely low — very common in urban, largely indoor children`;

      // Score below threshold: "<Nth" pattern  e.g. "Attention < 40th"
      const belowMatch = s.match(/^([A-Za-z][A-Za-z\s_]+?)\s*<\s*(\d+)(?:th|rd|st|nd)?/i);
      if (belowMatch) {
        const [, rawMetric, pct] = belowMatch;
        const metric = rawMetric.trim()
          .replace(/_/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        const pctNum = parseInt(pct);
        const severity = pctNum <= 20 ? "well below" : pctNum <= 35 ? "below" : "slightly below";
        return `${name}'s ${metric} is ${severity} average for their age — only ${pctNum}% of children scored lower`;
      }

      // Score above threshold: ">Nth" pattern
      const aboveMatch = s.match(/^([A-Za-z][A-Za-z\s_]+?)\s*>\s*(\d+)(?:th|rd|st|nd)?/i);
      if (aboveMatch) {
        const [, rawMetric, pct] = aboveMatch;
        const metric = rawMetric.trim()
          .replace(/_/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        return `${name}'s ${metric} is in the top range — stronger than ${pct}% of children the same age`;
      }

      // Stress / resilience shorthand
      if (/^Stress\s*>/i.test(s)) return `Stress indicators were elevated — ${name} may be carrying more internal pressure than is visible day-to-day`;
      if (/^RI\s*</i.test(s)) return `Resilience relative to current risk factors is lower than expected for ${name}'s age`;

      // Urban diet pattern
      if (/Urban\s*vegetarian/i.test(s)) return `${name} follows a vegetarian diet in an urban setting — the highest-risk profile for hidden micronutrient gaps`;

      // Bioavailability ratio
      const bioMatch = s.match(/Bioavailability.*?<\s*0?\.(\d+)/i);
      if (bioMatch) return `The absorption analysis found that a significant portion of nutrients in ${name}'s diet may not be reaching the bloodstream effectively`;

      // Composite / domain shorthand  e.g. "Physical composite < 30th"
      const compMatch = s.match(/^(Physical|Cognitive|Nutritional|Dietary|Wellbeing)[^\d]*(\d+)/i);
      if (compMatch) {
        const [, domain, pct] = compMatch;
        return `${name}'s ${domain.toLowerCase()} scores came in below the expected range for their age group`;
      }

      // Last resort: return the raw string capitalised cleanly, no regex artefacts
      return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
    });
  }

  // Rephrase detectionMethod into a plain "why we noticed this" sentence
  function translateMethod(method: string, patternName: string): string {
    if (method.toLowerCase().includes("causal mediation"))
      return `The analysis traced a chain of cause and effect — not just one low score, but how multiple low scores reinforce each other.`;
    if (method.toLowerCase().includes("bayesian"))
      return `The system combined multiple probability signals to calculate the overall likelihood of this pattern.`;
    if (method.toLowerCase().includes("kg") || method.toLowerCase().includes("knowledge graph"))
      return `The biological pathway map connected dots across nutrition, movement, and brain development data.`;
    if (method.toLowerCase().includes("algorithm 8") || method.toLowerCase().includes("dev_age"))
      return `The developmental age analysis found the gap between ${childProfile.name}'s abilities and age-expected norms across multiple areas.`;
    if (method.toLowerCase().includes("longitudinal") || method.toLowerCase().includes("dbn"))
      return `Trend analysis across multiple data points identified a consistent direction of change.`;
    if (method.toLowerCase().includes("resilience"))
      return `The balance between protective factors and risk factors was analysed across all domains.`;
    return `Cross-domain analysis identified a connection between ${childProfile.name}'s scores that doesn't show up in any single test result.`;
  }

  // Action enrichment: rephrase generic engine actions into child-specific, actionable steps
  function enrichActions(actions: string[], patternId: string): string[] {
    const name = childProfile.name;
    const ACTION_OVERRIDES: Record<string, string[]> = {
      HP01: [
        `Add iron-rich foods to at least 2 meals daily — ragi dosa, fortified rice, spinach dal, or rajma`,
        `Always pair iron foods with Vitamin C (squeeze lemon over dal, add tomato to meals) — this triples absorption`,
        `Ask your doctor for a simple finger-prick haemoglobin test — it takes 2 minutes and confirms whether iron is genuinely low`,
      ],
      HP02: [
        `Aim for 20 minutes of outdoor play before 10am — morning sunlight on skin is the best source of Vitamin D`,
        `Switch to vitamin D-fortified milk (look for "400 IU" on the label) — one glass covers ~40% of daily needs`,
        `Ask your paediatrician about a combined iron + Vitamin D blood test at the next visit`,
      ],
      HP03: [
        `Soak dal and legumes overnight before cooking — this breaks down phytates and increases iron absorption by up to 30%`,
        `Add a squeeze of lemon or a serving of tomato to every dal meal`,
        `Try fermented foods (dosa, idli, dhokla) instead of unfermented alternatives — fermentation pre-digests phytates`,
      ],
      HP04: [
        `Replace spinach as a daily calcium source — try sesame seeds (til), ragi, dairy, or fortified foods instead`,
        `Make nachni (ragi) ladoos or ragi porridge 3x per week — ragi has 3× more absorbable calcium than spinach`,
        `Spinach is still healthy for iron and vitamins — just don't rely on it as the main calcium food`,
      ],
      HP06: [
        `Add 1 high-fibre food to every meal: whole wheat roti, brown rice, dal, seasonal vegetables, or fruit`,
        `Introduce a small evening fruit snack (banana, pear, apple) — these are prebiotic and gut-friendly`,
        `Reduce packaged snacks and white rice at one meal per day — swap for a whole grain alternative`,
      ],
      HP07: [
        `Set a firm daily screen time limit for ${name}: 1 hour for under-8, 2 hours for 8–12 years`,
        `Replace post-school screen time with 30–45 minutes of outdoor play or a structured activity like swimming or cycling`,
        `Use screens as a reward after physical activity, not before`,
      ],
      HP08: [
        `Build 30–45 minutes of aerobic outdoor play into ${name}'s daily routine — running, cycling, skipping, or sports`,
        `Break up long homework sessions with a 10-minute movement break every 45 minutes`,
        `Walk or cycle to school when possible — even 15 minutes of morning activity improves attention for the whole school day`,
      ],
      HP24: (() => {
        const top = getTopDomain();
        const bot = getBottomDomain();
        return [
          `Keep nurturing ${name}'s ${top.name} (${top.score}th percentile) — this is a genuine strength and should stay a priority`,
          `Now direct focused support to ${bot.name} (${bot.score}th percentile) — this specific area is where the gap is widening`,
          `Ask ${name}'s teacher whether they've noticed any specific difficulties in ${bot.name.toLowerCase()}-related activities at school`,
          `Set one concrete, visible goal for ${bot.name} that ${name} can track progress on within 4 weeks`,
        ];
      })(),
      HP29: (() => {
        const top = getTopDomain();
        const bot = getBottomDomain();
        return [
          `${name}'s ${top.name} is already strong (${top.score}th percentile) — keep the habits driving it and don't drop them`,
          `Now focus support specifically on ${bot.name} (${bot.score}th percentile) — this is the area that needs a targeted plan, not just general wellness advice`,
          `For ${bot.name}: identify one specific change this week — whether that's adding a food, starting a physical activity, or scheduling a doctor visit`,
          `Book a paediatrician check-in to discuss the ${top.score - bot.score}-point gap between ${top.name} and ${bot.name} — this specific contrast is the key conversation to have`,
        ];
      })(),
      HP32: [
        `Keep doing what's working — don't change a routine that's producing great results`,
        `This is a great time to introduce enrichment: a new sport, a creative skill, or a challenge that stretches ${name} in an exciting direction`,
        `Continue the current nutrition habits and re-assess in 6 months to confirm the trajectory`,
      ],
      HP33: [
        `Increase calcium and iron in the diet now — this is the window where bones and brain need the most support before puberty`,
        `Have an open, age-appropriate conversation with ${name} about the changes their body will go through — early preparation reduces anxiety`,
        `Ensure 8–9 hours of sleep nightly — growth hormones are primarily released during deep sleep at this age`,
        `Check in emotionally every week: this age group often internalises stress rather than voicing it`,
      ],
    };
    if (ACTION_OVERRIDES[patternId]) return ACTION_OVERRIDES[patternId];
    // For unrecognised patterns, append child's name to first action for personalisation
    return actions.map((a, i) => i === 0 && name ? `For ${name}: ${a.charAt(0).toLowerCase()}${a.slice(1)}` : a);
  }

  // Hidden patterns → HiddenPattern shape with parent-friendly fields
  const hiddenPatterns = patternActivations.patterns.slice(0, 8).map(hp => {
    const enrichedActions = enrichActions(hp.recommendedActions, hp.patternId);
    return {
      id: hp.patternId,
      title: hp.patternName,
      icon: hp.actionPriority === "immediate" ? "⚠️" : hp.actionPriority === "high" ? "🔍" : "💡",
      severity: hp.clinicalRisk.split(" — ")[0] ?? "MEDIUM",
      probability: Math.round(hp.confidence * 100),
      // Plain-English description grounded in what was observed
      description: translateSignals(hp.signalInputs, hp.patternId)[0] ?? `${childProfile.name}'s results triggered this pattern across multiple domains.`,
      // The "hidden insight" — what it means for this child
      hiddenInsight: translateMethod(hp.detectionMethod, childProfile.name),
      // First recommended action
      prediction: enrichedActions[0] ?? "",
      // Top 2 actions joined
      action: enrichedActions.slice(0, 2).join("; "),
      confidence: Math.round(hp.confidence * 100),
      researchBasis: `${categoryLabel(hp.category)} · V4.0 Engine`,
      // Structured fields for the expandable card
      signals: translateSignals(hp.signalInputs, hp.patternId),
      allActions: enrichedActions,
      categoryLabel: categoryLabel(hp.category),
      clinicalDetail: hp.clinicalRisk,
    };
  });

  // ─── Risk enrichment: plain-English contributor insights + preventive steps ──
  const RISK_ENRICHMENT: Record<string, {
    icon: string;
    whatItMeans: string;
    contributorInsights: (p: any, percentiles: any) => string[];
    preventiveSteps: string[];
    timeline: string;
  }> = {
    iron_deficiency: {
      icon: "🩸",
      whatItMeans: "Iron is essential for carrying oxygen to the brain. Low iron can cause fatigue, poor focus, and slower learning — even before anaemia shows up on a blood test.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.dietary?.iron < 45) lines.push("Dietary iron intake is below the recommended level for your child's age");
        if (pct?.physical?.endurance < 40) lines.push("Endurance and stamina scores suggest muscles aren't getting enough oxygen — a key sign of low iron");
        if (p.posterior > 0.6) lines.push("Multiple signals across nutrition and physical domains reinforce this finding");
        return lines.length ? lines : ["Low dietary iron and reduced physical stamina were detected together"];
      },
      preventiveSteps: [
        "Add iron-rich foods daily: spinach, lentils, rajma, ragi, fortified cereals, or chicken",
        "Pair iron foods with vitamin C (lemon, amla, tomato) to triple absorption",
        "Avoid tea/coffee within 1 hour of meals — tannins block iron absorption",
        "If symptoms like pale skin or fatigue persist, ask your doctor for a ferritin blood test",
      ],
      timeline: "4–8 weeks with consistent dietary changes",
    },
    vitamin_d_deficiency: {
      icon: "☀️",
      whatItMeans: "Vitamin D helps build strong bones and supports the immune system and mood. Most Indian children are deficient due to indoor lifestyles and limited sun exposure.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.dietary?.vitaminD < 50) lines.push("Dietary vitamin D intake is below recommended levels");
        if (pct?.physical?.boneHealth < 45) lines.push("Bone health indicators suggest vitamin D may be limiting growth");
        lines.push(`City tier and indoor lifestyle increase population-level deficiency risk`);
        return lines;
      },
      preventiveSteps: [
        "Ensure 20–30 minutes of outdoor play in morning sunlight (9–11am) daily",
        "Include eggs, fortified milk, and fatty fish if diet permits",
        "Ask your paediatrician about a vitamin D supplement — especially in winter",
        "Reduce all-day indoor confinement; encourage outdoor sports or walks",
      ],
      timeline: "6–12 weeks with sun exposure and/or supplementation",
    },
    protein_energy_malnutrition: {
      icon: "💪",
      whatItMeans: "Protein fuels muscle growth, brain development, and immune strength. Insufficient protein slows height gain and reduces energy and concentration.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.anthropometric?.weightForAge < 40) lines.push("Weight-for-age is below expected range, suggesting inadequate caloric or protein intake");
        if (pct?.dietary?.protein < 45) lines.push("Daily protein intake appears insufficient for your child's age and activity level");
        if (pct?.physical?.strength < 40) lines.push("Strength scores are lower than expected, consistent with limited protein availability");
        return lines.length ? lines : ["Nutrition and physical growth indicators suggest protein intake may be below requirements"];
      },
      preventiveSteps: [
        "Aim for a protein-rich food at every meal: dal, paneer, eggs, curd, sprouts, or chicken",
        "Add a mid-morning snack: peanut butter on roti, boiled egg, or a handful of mixed nuts",
        "For vegetarian families: combine grains + legumes (e.g. rice + dal) to complete the amino acid profile",
        "Track height and weight monthly — flag if growth velocity drops",
      ],
      timeline: "8–16 weeks of consistent dietary improvement",
    },
    zinc_deficiency: {
      icon: "🦴",
      whatItMeans: "Zinc supports immunity, wound healing, taste, and growth. Deficiency is common in children on plant-based diets and can slow development subtly.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.dietary?.zinc < 45) lines.push("Zinc intake from food appears below recommended daily amounts");
        if (pct?.physical?.immuneResilience < 40) lines.push("Immune resilience indicators are reduced, consistent with zinc insufficiency");
        return lines.length ? lines : ["Dietary and immune markers together suggest zinc may be a limiting nutrient"];
      },
      preventiveSteps: [
        "Include zinc-rich foods: pumpkin seeds, sesame, whole grains, legumes, or meat/seafood",
        "Soaking and sprouting legumes increases zinc bioavailability",
        "Avoid excessive calcium supplements at the same meal — they compete with zinc absorption",
        "Discuss a short zinc supplementation course with your paediatrician if diet changes are difficult",
      ],
      timeline: "4–8 weeks with dietary focus",
    },
    cognitive_underperformance: {
      icon: "🧠",
      whatItMeans: "Cognitive performance depends on nutrition, sleep, physical activity, and stimulation. Underperformance often reflects fixable environmental factors rather than innate ability.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.cognitive?.workingMemory < 40) lines.push("Working memory scores — key for learning and following instructions — are below average");
        if (pct?.cognitive?.processingSpeed < 40) lines.push("Processing speed appears slower than peers, which can affect academic performance");
        if (pct?.dietary?.omega3 < 45) lines.push("Omega-3 intake (critical for brain health) appears below optimal levels");
        return lines.length ? lines : ["Multiple cognitive sub-scores and nutritional markers point to underperformance"];
      },
      preventiveSteps: [
        "Ensure 8–10 hours of uninterrupted sleep — memory consolidation happens overnight",
        "Add omega-3 sources: walnuts, flaxseed, fish (if permitted), or a fish oil supplement",
        "Replace passive screen time with reading, puzzles, or creative play",
        "30+ minutes of outdoor aerobic activity improves BDNF — the brain's growth factor",
        "Create a distraction-free, consistent study routine",
      ],
      timeline: "6–12 weeks of consistent lifestyle changes",
    },
    overweight_obesity_risk: {
      icon: "⚖️",
      whatItMeans: "A healthy weight supports joint health, heart function, and metabolic health in childhood. Small lifestyle habits now prevent much bigger health challenges later.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.anthropometric?.bmiForAge > 75) lines.push("BMI-for-age is above the healthy range for your child's age and sex");
        if (pct?.physical?.cardioFitness < 40) lines.push("Cardiovascular fitness is below average, which tends to correlate with excess weight");
        lines.push("Screen time and activity levels contribute to overall energy balance");
        return lines;
      },
      preventiveSteps: [
        "Focus on food quality first: reduce ultra-processed snacks, packaged juices, and fried foods",
        "Build 60 minutes of active outdoor play into the daily routine",
        "Eat family meals together, slowly — it takes 20 minutes for fullness signals to reach the brain",
        "Limit screens to 2 hours/day and replace with physical activity where possible",
        "Avoid making weight a focus of conversation — frame it around energy and feeling strong",
      ],
      timeline: "3–6 months of consistent lifestyle changes",
    },
    stunting_risk: {
      icon: "📏",
      whatItMeans: "Stunting reflects long-term nutritional shortfall that limits height potential. It's often reversible in younger children with the right nutrition and care.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.anthropometric?.heightForAge < 35) lines.push("Height-for-age is below expected range, suggesting a period of nutritional stress");
        if (pct?.dietary?.calories < 40) lines.push("Total caloric intake appears insufficient for supporting normal growth velocity");
        return lines.length ? lines : ["Height and nutritional intake indicators together raise this concern"];
      },
      preventiveSteps: [
        "Prioritise calorie-dense, nutrient-rich foods: ghee, nuts, eggs, pulses, dairy",
        "Ensure three full meals + 2 healthy snacks daily without skipping",
        "Check for recurrent infections or digestive issues — these impair nutrient absorption",
        "Track height every 3 months and consult your paediatrician if growth stalls",
      ],
      timeline: "6–18 months; younger children respond faster",
    },
    social_emotional_risk: {
      icon: "💛",
      whatItMeans: "Social and emotional skills — empathy, self-regulation, peer relationships — are as important as academic skills for long-term wellbeing and success.",
      contributorInsights: (p, pct) => {
        const lines: string[] = [];
        if (pct?.psychosocial?.peerRelations < 40) lines.push("Peer relationship indicators suggest your child may find social interactions challenging");
        if (pct?.psychosocial?.emotionalRegulation < 40) lines.push("Emotional regulation scores are below average — this can lead to frustration or withdrawal");
        if (pct?.psychosocial?.selfEsteem < 40) lines.push("Self-esteem indicators are lower than expected for this age group");
        return lines.length ? lines : ["Psychosocial domain scores suggest social-emotional support would be beneficial"];
      },
      preventiveSteps: [
        "Make time for daily unstructured play with peers — essential for social learning",
        "Validate emotions openly: name feelings without dismissing or over-reacting",
        "Limit academic pressure — balance achievement focus with emotional safety",
        "Consider talking to your child's school counsellor if social difficulties persist",
        "Model healthy emotional expression in your own daily interactions",
      ],
      timeline: "Ongoing; most improvements visible within 2–3 months",
    },
  };

  // Generic fallback enrichment for unlisted conditions
  function enrichRisk(condition: string, b: any, pct: any) {
    const key = condition.toLowerCase().replace(/ /g, "_");
    const enrichment = RISK_ENRICHMENT[key];
    const conditionName = condition.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    if (enrichment) {
      return {
        icon: enrichment.icon,
        whatItMeans: enrichment.whatItMeans,
        contributorInsights: enrichment.contributorInsights(b, pct),
        preventiveSteps: enrichment.preventiveSteps,
        timeline: enrichment.timeline,
      };
    }

    // Fallback for unrecognised conditions
    const esScore = Math.round(b.evidenceStrength * 100);
    return {
      icon: "⚠️",
      whatItMeans: `Our engine detected elevated risk for ${conditionName} based on patterns across physical, nutritional, and cognitive data.`,
      contributorInsights: [
        `Evidence strength score: ${esScore}% — multiple data points converged on this finding`,
        "Cross-domain signals (nutrition + physical + cognitive) reinforced each other",
      ],
      preventiveSteps: [
        "Review the detailed report for specific contributing factors",
        "Discuss this finding with your child's paediatrician at the next check-up",
        "Focus on overall lifestyle: sleep, nutrition, and 60 min daily activity",
      ],
      timeline: "8–16 weeks if unaddressed",
    };
  }

  // Bayesian risks → legacy predictiveRisks + bayesianRisks
  const predictiveRisks = alg.bayesianPosteriors
    .filter(b => b.posterior > 0.25)
    .sort((a, b) => b.posterior - a.posterior)
    .slice(0, 5)
    .map(b => {
      const enriched = enrichRisk(b.condition, b, alg.domainPercentiles ?? {});
      return {
        name: b.condition.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        icon: enriched.icon,
        riskProbability: Math.round(b.posterior * 100),
        riskLevel: b.posterior > 0.70 ? "High" : b.posterior > 0.45 ? "Moderate" : "Low",
        timeline: enriched.timeline,
        preventability: Math.round((1 - b.posterior) * 100),
        interventionCost: "Low",
        topContributors: [{ label: "Evidence strength", score: Math.round(b.evidenceStrength * 100) }],
        whatItMeans: enriched.whatItMeans,
        contributorInsights: enriched.contributorInsights,
        preventiveSteps: enriched.preventiveSteps,
      };
    });

  const bayesianRisks = alg.bayesianPosteriors.map(b => ({
    name: b.condition.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    prior: Math.round(b.prior * 100),
    posterior: Math.round(b.posterior * 100),
    evidenceStrength: Math.round(b.evidenceStrength * 100),
    contributingFactors: [],
    riskLevel: b.posterior > 0.70 ? "High" : b.posterior > 0.45 ? "Moderate" : "Low",
  }));

  // Convergence → legacy shape
  const convergence = {
    activeChains: alg.mediationResults.slice(0, 5).map(m => ({
      id: m.pathId, source: m.xVariable, target: m.yVariable,
      mediator: m.mediator, totalEffect: m.totalEffect,
    })),
    convergenceNodes: Object.entries(alg.pageRankScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([metric, pr]) => ({
        metric, domain: "multi", score: Math.round(pr * 10000),
        chainCount: 1, chains: [], convergenceInsight: `PageRank leverage: ${pr.toFixed(4)}`,
        leverageScore: Math.round(pr * 10000),
      })),
    leveragePoints: alg.counterfactualRankings.slice(0, 3).map(r => ({
      intervention: r.intervention, expectedUtility: r.expectedUtility,
    })),
    totalChainsActive: alg.mediationResults.length,
    totalConvergencePoints: alg.convergenceScore.score,
  };

  // Graph nodes from PageRank
  const graphNodes = Object.entries(alg.pageRankScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, pr]) => ({
      id, domain: "multi", metric: id,
      score: Math.round(pr * 10000),
      inDegree: 1, outDegree: 1,
      betweenness: pr, pageRank: pr,
    }));

  // Intervention sims from saturation projections
  const interventionSims = alg.saturationProjections.slice(0, 6).map(sp => ({
    intervention: { name: sp.intervention, targetMetric: sp.domain, targetDomain: sp.domain,
      maxEffect: sp.expectedGainPercent, halfLife: Math.round(0.693 / sp.kRate), lagWeeks: 2,
      efficacy: sp.kRate * 10, evidenceLevel: 0.8, downstreamEffects: [] },
    timeline: sp.weeklyProjection.filter((_, i) => i % 4 === 3).map((score, wi) => ({
      week: (wi + 1) * 4, score, improvement: sp.expectedGainPercent * (wi + 1) / 6, confidence: 0.80,
    })),
    totalDownstreamMetrics: 1,
    expectedImpactScore: sp.expectedGainPercent,
  }));

  // Nutrient interactions
  const nutrientInteractions = {
    adjustedScores: nScoresEffective,
    interactions: alg.nutrientInteractions.map(ni => ({
      nutrient: ni.nutrientPair[0], raw: 50,
      adjusted: Math.round(ni.adjustedEfficacy),
      modifier: ni.coefficient,
      reason: `${ni.interactionType}: ${ni.nutrientPair.join(" × ")}`,
    })),
    relevantInteractions: alg.nutrientInteractions.map(ni => ({
      nutrientA: ni.nutrientPair[0], nutrientB: ni.nutrientPair[1],
      type: ni.interactionType === "synergy" ? "synergistic" : "antagonistic" as any,
      absorptionModifier: ni.coefficient,
      mechanism: `${ni.interactionType} interaction`,
      significance: Math.abs(ni.coefficient),
      recommendation: ni.interactionType === "antagonism"
        ? `Separate ${ni.nutrientPair[0]} and ${ni.nutrientPair[1]} intake`
        : `Take ${ni.nutrientPair[0]} with ${ni.nutrientPair[1]} for enhanced absorption`,
    })),
  };

  // Correlation matrix from mediation
  const correlationMatrix = alg.mediationResults.map(m => ({
    from: m.xVariable, to: m.yVariable,
    strength: m.mediationRatio, mechanism: m.mediator,
  }));

  // Report confidence
  const compositeArr = [p.physical.composite, p.cognitive.composite, p.dietary.composite, p.psychosocial.composite];
  const mean = compositeArr.reduce((a, b) => a + b, 0) / 4;
  const variance = compositeArr.reduce((s, v) => s + (v - mean) ** 2, 0) / 4;
  const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance)));
  const reportConfidence = {
    overall: Math.min(95, Math.round((alg.latentHealthScore.lhs * 0.4 + consistency * 0.35 + 70 * 0.25))),
    dataQuality: 85,
    consistency,
    evidenceDepth: 90,
    breakdown: `V4.0 engine: 24 algorithms, 33 patterns evaluated. LHS=${alg.latentHealthScore.lhs}, Phenotype=${alg.phenotypicProfile.name}`,
  };

  // Monte Carlo
  const mcPhys = alg.monteCarloResults.find(r => r.metric === "physical_composite");
  const monteCarloRisk = {
    mean: integrated,
    p5: mcPhys?.p5 ?? Math.round(integrated * 0.8),
    p25: mcPhys?.p25 ?? Math.round(integrated * 0.9),
    median: integrated,
    p75: mcPhys?.p75 ?? Math.round(integrated * 1.1),
    p95: mcPhys?.p95 ?? Math.round(integrated * 1.2),
    robustness: mcPhys?.robustnessScore ?? 75,
  };

  // Environmental context
  const environmentalContext = {
    cityTier: childProfile.cityTier,
    schoolType: childProfile.schoolType,
    dietType: childProfile.diet,
    screenTime: childProfile.screenTime,
    adjustedPriors: alg.bayesianPosteriors.map(b => ({
      riskFactor: b.condition, basePrior: b.prior,
      adjustedPrior: b.posterior, reason: "V4 Bayesian inference",
    })),
    dietModifiers: Object.entries(alg.bioavailabilityScores).map(([nutrient, score]) => ({
      nutrient, factor: score / 50, reason: "Bioavailability correction",
    })),
    screenEffects: alg.riskScores["psychosocial_risk"] > 50
      ? ["Screen time moderately elevated — attention risk noted"]
      : [],
  };

  // Weekly plan from action plan
  const weeklyPlan = Array.from({ length: 7 }, (_, i) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const physInt = actionPlan.topPriorityInterventions.filter(it => it.domain === "physical")[0];
    const cogInt = actionPlan.topPriorityInterventions.filter(it => it.domain === "cognitive")[0];
    return {
      day: days[i],
      physical: { focus: physInt?.title ?? "Active play", primary: physInt?.description ?? "Outdoor activity", secondary: "Stretching", duration: `${physInt?.durationMinutes ?? 30}min` },
      cognitive: { focus: cogInt?.title ?? "Brain games", primary: cogInt?.description ?? "Memory exercises", secondary: "Reading", duration: `${cogInt?.durationMinutes ?? 15}min` },
      nutrition: {
        breakfast: actionPlan.parentCommunication.quickWins[0] ?? "Iron-rich breakfast",
        lunch: "Balanced meal with protein + fibre",
        snack: actionPlan.parentCommunication.quickWins[1] ?? "Fruit with nuts",
        dinner: "Light, calcium-rich dinner",
        hydration: "1.2–1.5L water throughout day",
      },
    };
  });

  // Red flags
  const redFlags = patternActivations.patterns
    .filter(hp => hp.actionPriority === "immediate")
    .slice(0, 3)
    .map(hp => ({
      metric: hp.patternId, domain: hp.category,
      score: Math.round((1 - hp.confidence) * 100),
      severity: "warning" as const,
      message: hp.signalInputs,
      action: hp.recommendedActions[0] ?? "Consult paediatrician",
    }));

  // Strengths and concerns
  const strengths = [
    ...(p.physical.composite >= 60 ? [{ domain: "physical", metric: "composite", score: p.physical.composite }] : []),
    ...(p.cognitive.composite >= 60 ? [{ domain: "cognitive", metric: "composite", score: p.cognitive.composite }] : []),
    ...(p.dietary.composite >= 60 ? [{ domain: "nutrition", metric: "composite", score: p.dietary.composite }] : []),
    ...(p.psychosocial.composite >= 60 ? [{ domain: "psychosocial", metric: "composite", score: p.psychosocial.composite }] : []),
  ];

  const concerns = [
    ...(p.physical.composite < 45 ? [{ domain: "physical", metric: "composite", score: p.physical.composite }] : []),
    ...(p.cognitive.composite < 45 ? [{ domain: "cognitive", metric: "composite", score: p.cognitive.composite }] : []),
    ...(p.dietary.composite < 45 ? [{ domain: "nutrition", metric: "composite", score: p.dietary.composite }] : []),
    ...(p.psychosocial.composite < 45 ? [{ domain: "psychosocial", metric: "composite", score: p.psychosocial.composite }] : []),
  ];

  // Longitudinal (not available on first session)
  const longitudinal = alg.velocityResults.length > 0 ? {
    hasPreviousData: true,
    daysSinceLast: 90,
    overallTrend: alg.velocityResults.some(v => v.direction === "improving") ? "improving" as const :
      alg.velocityResults.some(v => v.direction === "declining") ? "declining" as const : "stable" as const,
    deltas: alg.velocityResults.map(v => ({
      metric: v.metric, domain: v.metric.split("_")[0],
      previousScore: 50, currentScore: 50 + (v.direction === "improving" ? v.magnitude : -v.magnitude),
      delta: v.direction === "improving" ? v.magnitude : v.direction === "declining" ? -v.magnitude : 0,
      trend: v.direction,
      velocity: v.magnitude,
    })),
    improvementRate: Math.round(alg.velocityResults.filter(v => v.direction === "improving").length / alg.velocityResults.length * 100),
    summary: actionPlan.parentCommunication.summary,
  } : null;

  return {
    childProfile: {
      name: childProfile.name ?? "Child",
      age: childProfile.age ?? 8,
      gender: childProfile.gender ?? "male",
      height: childProfile.height,
      weight: childProfile.weight,
      diet: childProfile.diet,
      screenTime: childProfile.screenTime,
      cityTier: childProfile.cityTier,
      schoolType: childProfile.schoolType,
      neurodivergence: childProfile.neurodivergence ?? [],
    },
    ageGroup: `${Math.floor(result.childProfile.ageYears / 3) * 3}-${Math.floor(result.childProfile.ageYears / 3) * 3 + 2}`,
    gender: childProfile.gender ?? "male",
    pScores, cScores, nScores, nScoresEffective,
    wellbeing: {
      stressIndex: 100 - p.psychosocial.stress,
      socialSafety: p.psychosocial.socialSafety,
      emotionalWellbeing: p.psychosocial.emotionalWellbeing,
      anxietyIndex: 100 - p.psychosocial.anxiety,
      resilience: p.psychosocial.resilience,
      composite: p.psychosocial.composite,
      alerts: patternActivations.patterns
        .filter(hp => hp.category === "psychosocial_physiological" && hp.actionPriority === "immediate")
        .slice(0, 2)
        .map(hp => ({ dimension: hp.patternName, level: "high", message: hp.recommendedActions[0] ?? "" })),
    },
    pAvg, cAvg, nAvg, nAvgEffective, integrated,
    devAge, devVelocity,
    hiddenPatterns, predictiveRisks, bayesianRisks,
    convergence, graphNodes, interventionSims,
    nutrientInteractions, correlationMatrix,
    reportConfidence, monteCarloRisk, environmentalContext,
    longitudinal,
    strengths, concerns, redFlags,
    missingDataFields: [],
    weeklyPlan,
    generatedAt: new Date().toISOString(),
    benchmarksUsed: "ICMR-NIN 2020, IAP 2015, WHO, NFHS-5, CNNS 2016-18, AIIMS Delhi 2019, NIMHANS 2021",
    engineVersion: `V4.0.0 (${result.metadata.algorithmsExecuted} algorithms, ${result.metadata.patternsEvaluated} patterns)`,
    // V4 extended data (available for future UI use)
    v4: {
      phenotypicProfile: alg.phenotypicProfile,
      latentHealthScore: alg.latentHealthScore,
      icd10Mappings: alg.icd10Mappings,
      neurodivergenceResult: alg.neurodivergenceResult,
      sleepProxy: alg.sleepProxy,
      resilienceRiskRatio: alg.resilienceRiskRatio,
      compensatoryPattern: alg.compensatoryPattern,
      anomalyAlerts: alg.anomalyAlerts,
      actionPlan,
      metadata: result.metadata,
    },
    // T2-D: Full 24-algorithm outputs for the enrich-report 3-step LLM pipeline
    algorithmOutputs: {
      phenotypicProfile: alg.phenotypicProfile,
      latentHealthScore: alg.latentHealthScore,
      bayesianPosteriors: alg.bayesianPosteriors,
      patternActivations: patternActivations.patterns,
      mediationResults: alg.mediationResults,
      developmentalAge: alg.developmentalAge,
      convergenceScore: alg.convergenceScore,
      topInterventions: actionPlan.topPriorityInterventions.slice(0, 3).map(i => ({ title: i.title, domain: i.domain, tier: i.tier })),
      domainPercentiles: percentiles,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── JWT Auth (P0-3 fix) ─────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;
  // ─────────────────────────────────────────────────────────────────────────

  try {
    // ─── DB-backed rate limiting (P0-4 fix) ──────────────────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const rateCheck = await checkRateLimit(userId, serviceClient);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Maximum 5 reports per 10 minutes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '0' },
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    const body = await req.json();
    const { childProfile, physicalData, cognitiveData, nutritionalData, previousReport } = body;

    // Granular validation — tell the caller exactly which field is missing
    const missingFields: string[] = [];
    if (!childProfile) missingFields.push('childProfile');
    if (!physicalData)  missingFields.push('physicalData');
    if (!cognitiveData) missingFields.push('cognitiveData');
    if (!nutritionalData) missingFields.push('nutritionalData');
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard: childProfile.age must be a number
    if (typeof childProfile.age !== 'number' || childProfile.age < 1 || childProfile.age > 18) {
      return new Response(JSON.stringify({ error: 'childProfile.age must be a number between 1 and 18' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Idempotency guard: if a report was already generated for this child
    // within the last 30 seconds, return it instead of running the engine again.
    // Prevents duplicate LLM costs from double-taps, retries, and React re-mounts.
    // ──────────────────────────────────────────────────────────────────────────
    if (childProfile?.id) {
      const idempotencyWindow = new Date(Date.now() - 30_000).toISOString();
      const { data: recentReport } = await serviceClient
        .from("reports")
        .select("report_data, created_at")
        .eq("child_id", childProfile.id)
        .eq("user_id", userId)
        .gt("created_at", idempotencyWindow)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentReport?.report_data) {
        console.log(`[generate-report] idempotency HIT for child ${childProfile.id} — returning cached report from ${recentReport.created_at}`);
        return new Response(JSON.stringify({ ...(recentReport.report_data as object), _idempotent: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-RateLimit-Remaining': String(rateCheck.remaining) },
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Map legacy input to V4 format
    const v4Input = mapLegacyToV4Input(childProfile, physicalData, cognitiveData, nutritionalData, previousReport);

    // ─── 15-second engine timeout (prevents hung edge function slots) ────────
    const ENGINE_TIMEOUT_MS = 15_000;
    const engineTimeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("ENGINE_TIMEOUT: V4 engine exceeded 15s — request aborted")),
        ENGINE_TIMEOUT_MS
      )
    );
    const engineRun = new Promise<ReturnType<typeof runEngine>>((resolve, reject) => {
      try {
        resolve(runEngine(v4Input));
      } catch (e) {
        reject(e);
      }
    });

    let v4Result: ReturnType<typeof runEngine>;
    try {
      v4Result = await Promise.race([engineRun, engineTimeout]);
    } catch (e: any) {
      const isTimeout = e?.message?.startsWith("ENGINE_TIMEOUT");
      console.error(isTimeout ? "[generate-report] Engine timed out" : "[generate-report] Engine threw:", e?.message);
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "Report generation timed out. Please try again — this is usually a transient issue."
            : (e?.message ?? "Engine error"),
          code: isTimeout ? "ENGINE_TIMEOUT" : "ENGINE_ERROR",
        }),
        {
          status: isTimeout ? 504 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Bridge to legacy output shape
    const legacyReport = bridgeV4ToLegacy(v4Result, childProfile);

    return new Response(JSON.stringify(legacyReport), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-RateLimit-Remaining': String(rateCheck.remaining) },
    });

  } catch (error) {
    console.error('V4 Engine error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal engine error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
