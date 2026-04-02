// ═══════════════════════════════════════════════════════════════════════════
// Panchkosha Intelligence Engine — Edge Function
// Maps 5 KidSutra assessment streams to the 5 Vedantic Koshas via KG + AI
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCacheKey, getCached, setCached, logCacheStats } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Lovable AI helper ────────────────────────────────────────────────────────
async function callAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 1200,
  temperature = 0.15,
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.1-pro-preview",
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI call failed: ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function computeAnnamayaScore(physical: Record<string, number>) {
  const coord = physical.coordinationPercentile ?? physical.coordination ?? 55;
  const balance = physical.balanceHoldPercentile ?? physical.balance ?? 55;
  const endurance = physical.enduranceProxy ?? physical.endurance ?? 50;
  const reaction = physical.reactionTimePercentile ?? physical.reactionTime ?? 55;
  const score = clamp(coord * 0.35 + balance * 0.25 + endurance * 0.20 + reaction * 0.20);
  const harmony = clamp((coord + balance) / 2 * 0.7 + endurance * 0.3);
  return { score, harmony };
}

function computePranamayaScore(nutrition: Record<string, number>) {
  const iron = nutrition.ironAdequacy ?? nutrition.iron ?? 74;
  const b12 = nutrition.vitaminB12Adequacy ?? nutrition.b12 ?? 88;
  const omega3 = nutrition.omega3Adequacy ?? nutrition.omega3 ?? 67;
  const vitD = nutrition.vitaminDAdequacy ?? nutrition.vitaminD ?? 77;
  const protein = nutrition.proteinAdequacy ?? nutrition.protein ?? 87;
  const score = clamp(iron * 0.30 + omega3 * 0.25 + b12 * 0.20 + vitD * 0.15 + protein * 0.10);
  const harmony = clamp((iron + omega3 + b12) / 3);
  return { score, harmony };
}

function computeManomayaScore(wellbeing: Record<string, number>) {
  const anxiety = 100 - (wellbeing.academicAnxiety?.pct ?? wellbeing.anxietyScreenPercentile ?? 55);
  const emotional = wellbeing.emotionalRegulation?.pct ?? wellbeing.emotionalWellbeingPercentile ?? 45;
  const social = wellbeing.socialBelonging?.pct ?? wellbeing.socialSafetyScore ?? 57;
  const resilience = wellbeing.selfConfidence?.pct ?? wellbeing.resiliencePercentile ?? 65;
  const optimism = wellbeing.futureOptimism?.pct ?? 70;
  const score = clamp(resilience * 0.25 + emotional * 0.25 + (100 - anxiety) * 0.20 + social * 0.15 + optimism * 0.15);
  const harmony = clamp((resilience + emotional + optimism) / 3);
  return { score, harmony };
}

function computeVijnanamayaScore(cognitive: Record<string, number>) {
  const g1 = cognitive.sustainedAttentionDPrime ?? cognitive.game1_attention ?? cognitive.attention ?? 50;
  const g2 = cognitive.workingMemoryPercentile ?? cognitive.game2_workingMemory ?? cognitive.workingMemory ?? 50;
  const g3 = cognitive.processingSpeedPercentile ?? cognitive.game3_processingSpeed ?? cognitive.processingSpeed ?? 55;
  const g4 = cognitive.fluidReasoningPercentile ?? cognitive.game4_reasoning ?? cognitive.reasoning ?? 55;
  const g5 = cognitive.emotionRecognitionPercentile ?? cognitive.game5_cognitiveFlexibility ?? cognitive.cogFlex ?? 60;
  const g6 = cognitive.game6_emotionalCognition ?? cognitive.emotionalCognition ?? 35;
  const score = clamp(g4 * 0.25 + g5 * 0.25 + g2 * 0.20 + g1 * 0.15 + g3 * 0.10 + g6 * 0.05);
  const harmony = clamp((g4 + g5 + g3) / 3);
  return { score, harmony };
}

function computeAnandamayaScore(discoverme: Record<string, unknown> | null) {
  if (!discoverme) return { score: 68, harmony: 72 };
  const hasBlocked = Boolean(discoverme.blockedProfile) || ((discoverme.blockedModalities as string[] | null)?.length ?? 0) >= 3;
  const dominantCount = [
    discoverme.dominant_hand, discoverme.dominant_eye,
    discoverme.dominant_ear, discoverme.dominant_foot,
  ].filter(Boolean).length;
  const coherenceScore = dominantCount >= 4 ? 88 : dominantCount === 3 ? 78 : 68;
  const score = clamp(hasBlocked ? coherenceScore - 12 : coherenceScore);
  const harmony = clamp(hasBlocked ? 65 : coherenceScore - 6);
  return { score, harmony };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildKoshaPrompt(
  childName: string,
  ageYears: number,
  gender: string,
  diet: string,
  koshaData: {
    annamaya: { score: number; harmony: number };
    pranamaya: { score: number; harmony: number };
    manomaya: { score: number; harmony: number };
    vijnanamaya: { score: number; harmony: number };
    anandamaya: { score: number; harmony: number };
  },
  rawScores: {
    physical: Record<string, number>;
    cognitive: Record<string, number>;
    nutrition: Record<string, number>;
    wellbeing: Record<string, number>;
    discoverme: Record<string, unknown> | null;
  },
): string {
  const dm = rawScores.discoverme;

  const isVeg = diet?.toLowerCase().includes("veg") && !diet?.toLowerCase().includes("non");
  const ironFoods = isVeg
    ? "ragi porridge, rajma, horse gram (kulthi), spinach (palak) sabzi, or dates (khajoor)"
    : "ragi porridge, rajma, chicken liver curry, or spinach (palak) sabzi";
  const omega3Foods = isVeg
    ? "walnuts (akhrot), flaxseed (alsi) chutney, or mustard oil-based curries"
    : "rohu or katla fish curry twice a week, walnuts (akhrot), or mustard oil-based curries";
  const b12Foods = isVeg
    ? "paneer, curd (dahi), fortified idli batter, or a paediatrician-recommended B12 supplement"
    : "eggs, chicken, or curd (dahi)";
  const vitDFoods = "morning sun (10–15 min before 9 AM), fortified cow's milk, or a paediatrician-recommended Vitamin D3 drop";
  const brainFoods = "a small bowl of mixed dry fruits (badam, akhrot, kishmish) after school";
  const calmFoods = "warm haldi-doodh at bedtime, banana with ghee, or amla candy (not packaged)";
  const strengthFoods = isVeg
    ? "a glass of milk with a pinch of ashwagandha powder, or sprouted moong chaat after activity"
    : "boiled eggs with chaat masala, or chicken soup after physical activity";

  const schoolScenario = ageYears <= 8
    ? "during Class 1–3 where sitting still and following instructions is the first big challenge"
    : ageYears <= 11
    ? "during Class 4–6 where the jump to multiple subjects and increased homework pressure begins"
    : ageYears <= 14
    ? "during Class 7–9 where board exam pressure starts and peer comparison intensifies"
    : "during Class 10–12 where career choices and board exam stress peak";

  const parentScenario = ageYears <= 8
    ? `Many parents notice ${childName} gets distracted during homework time or gets tired quickly during play — this assessment explains exactly why.`
    : ageYears <= 11
    ? `Many parents notice ${childName} starts strong in a subject but loses focus halfway, or gets upset when things don't go as expected — this assessment now has answers.`
    : `Many parents notice ${childName} works hard but results don't always match the effort, or gets anxious before tests — this data finally explains the 'why'.`;

  const genderPronoun = gender?.toLowerCase() === "female" ? "she" : gender?.toLowerCase() === "male" ? "he" : "they";
  const genderPossessive = gender?.toLowerCase() === "female" ? "her" : gender?.toLowerCase() === "male" ? "his" : "their";

  return `You are KidSutra's Panchkosha Intelligence Engine — an AI that maps modern child development science to the ancient 5-layer Vedantic framework of the Taittiriya Upanishad. Your job is to write warm, specific, and honest insights for Indian parents.

WRITING RULES (follow strictly):
1. Write at a warm, clear 8th-grade reading level — like a knowledgeable family doctor who speaks plain Hindi-English (Hinglish tone is fine for warmth, but keep sentences in English).
2. DO NOT use jargon like "neurocognitive", "hemispheric lateralisation", "bioavailability", "posterior cortex", "rote load", or "analytical architecture". Replace with plain words.
3. ALWAYS reference ${childName} by name. Use "${genderPronoun}/${genderPossessive}" consistently.
4. Ground EVERY insight in the actual numbers provided. Never be generic.
5. Suggest specific Indian foods by name (ragi, amla, ghee, rajma, paneer, dahi, dal, palak, akhrot, etc.) — not "healthy foods" or "nutrient-rich diet".
6. Reference real Indian school scenarios: board exams, class tests, PTM (Parent-Teacher Meeting), tuition, after-school classes.
7. Each "reading" should feel like a warm letter to the parent — acknowledging their child's unique strengths first, then honest about gaps, then specific about what to do.
8. Each "block" is a 1-2 sentence precise finding — clinical but in plain English.
9. "kg_edges" are knowledge graph connections — keep them in "Source → relationship → Target" format, specific to ${childName}'s data.

CHILD PROFILE:
Name: ${childName}
Age: ${ageYears} years (${schoolScenario})
Gender: ${gender}
Diet: ${diet}

COMPUTED KOSHA SCORES (0–100):
- Annamaya (Physical body): score=${koshaData.annamaya.score}, harmony=${koshaData.annamaya.harmony}
- Pranamaya (Vital energy / nutrition): score=${koshaData.pranamaya.score}, harmony=${koshaData.pranamaya.harmony}
- Manomaya (Mind / emotions): score=${koshaData.manomaya.score}, harmony=${koshaData.manomaya.harmony}
- Vijnanamaya (Intellect / deep learning): score=${koshaData.vijnanamaya.score}, harmony=${koshaData.vijnanamaya.harmony}
- Anandamaya (Core identity / blueprint): score=${koshaData.anandamaya.score}, harmony=${koshaData.anandamaya.harmony}

RAW ASSESSMENT DATA:
PHYSICAL: coordination=${rawScores.physical.coordinationPercentile ?? rawScores.physical.coordination ?? 55}th percentile, balance=${rawScores.physical.balanceHoldPercentile ?? rawScores.physical.balance ?? 55}th percentile, endurance=${rawScores.physical.enduranceProxy ?? rawScores.physical.endurance ?? 50}th percentile
COGNITIVE: attention(G1)=${rawScores.cognitive.sustainedAttentionDPrime ?? rawScores.cognitive.attention ?? 50}th, workingMemory(G2)=${rawScores.cognitive.workingMemoryPercentile ?? rawScores.cognitive.workingMemory ?? 50}th, processingSpeed(G3)=${rawScores.cognitive.processingSpeedPercentile ?? rawScores.cognitive.processingSpeed ?? 55}th, reasoning(G4)=${rawScores.cognitive.fluidReasoningPercentile ?? rawScores.cognitive.reasoning ?? 55}th, cogFlex(G5)=${rawScores.cognitive.emotionRecognitionPercentile ?? rawScores.cognitive.cogFlex ?? 60}th, emoCog(G6)=${rawScores.cognitive.game6_emotionalCognition ?? rawScores.cognitive.emotionalCognition ?? 35}th
NUTRITION: iron=${rawScores.nutrition.ironAdequacy ?? rawScores.nutrition.iron ?? 74}% of daily need, b12=${rawScores.nutrition.vitaminB12Adequacy ?? rawScores.nutrition.b12 ?? 88}% of daily need, omega3=${rawScores.nutrition.omega3Adequacy ?? rawScores.nutrition.omega3 ?? 67}% of daily need, vitD=${rawScores.nutrition.vitaminDAdequacy ?? rawScores.nutrition.vitaminD ?? 77}% of daily need
WELLBEING: academicAnxiety=${rawScores.wellbeing.academicAnxiety ?? rawScores.wellbeing.anxietyScreenPercentile ?? 55}th, emotionalRegulation=${rawScores.wellbeing.emotionalRegulation ?? rawScores.wellbeing.emotionalWellbeingPercentile ?? 45}th, selfConfidence=${rawScores.wellbeing.selfConfidence ?? rawScores.wellbeing.resiliencePercentile ?? 65}th
DISCOVERME: ${dm ? `brain_hemisphere=${dm.brain_hemisphere ?? "right"}, dominant_hand=${dm.dominant_hand ?? "right"}, dominant_eye=${dm.dominant_eye ?? "right"}, dominant_ear=${dm.dominant_ear ?? "right"}, dominant_foot=${dm.dominant_foot ?? "right"}, blocked_profile=${Boolean((dm.blockedModalities as string[] | null)?.length ?? 0) >= 3}, temperament=${dm.temperament ?? "expressive"}` : "Not completed yet"}

INDIAN FOOD ANCHORS FOR THIS CHILD (diet: ${diet}):
- Iron gap → suggest: ${ironFoods}
- Omega-3 gap → suggest: ${omega3Foods}
- B12 gap → suggest: ${b12Foods}
- Vitamin D gap → suggest: ${vitDFoods}
- Brain focus support → suggest: ${brainFoods}
- Emotional calm → suggest: ${calmFoods}
- Physical strength → suggest: ${strengthFoods}
- Always mention: avoid chai/tea within 1 hour of iron-rich meals (tannins block iron)

PARENT CONTEXT: ${parentScenario}

TASK: Generate all 5 kosha readings + the atman archetype. Every sentence must reference ${childName}'s actual numbers. Use the Indian food anchors above when giving practical advice. Keep each "reading" under 120 words. Keep each "block" under 40 words.

Return ONLY valid JSON:
{
  "annamaya": {
    "reading": "3–4 warm sentences. Name ${childName}. Reference coordination, balance, endurance percentiles. Lead with a strength. Give one specific Indian food or outdoor activity suggestion. End with what this means for ${genderPossessive} school day.",
    "block": "1–2 sentences. The most significant physical gap. Start with the actual percentile number. Plain English only.",
    "kg_edges": ["Source → relationship → Target (specific to ${childName})", "edge2", "edge3", "edge4"]
  },
  "pranamaya": {
    "reading": "3–4 warm sentences. Name ${childName}. Reference iron%, omega3%, b12% as 'getting X% of what ${genderPossessive} body needs'. Mention a specific Indian meal that would help. Reference the school impact.",
    "block": "1–2 sentences. How the nutrition gap is quietly reducing ${genderPossessive} brain performance. Plain English. No jargon.",
    "kg_edges": ["edge1", "edge2", "edge3", "edge4"]
  },
  "manomaya": {
    "reading": "3–4 warm sentences. Name ${childName}. Reference anxiety percentile (frame as 'school pressure score', not clinical term), emotional regulation, self-confidence. Use a relatable Indian school scenario. Suggest one calming home practice.",
    "block": "1–2 sentences. The most significant emotional pattern. Reference the exact score. Frame with compassion.",
    "kg_edges": ["edge1", "edge2", "edge3", "edge4"]
  },
  "vijnanamaya": {
    "reading": "3–4 warm sentences. Name ${childName}. Reference working memory and reasoning scores in plain language. Use 'buddhi' once in a Vedantic context. Mention a specific study strategy suited to this profile. Reference the nutrition link if omega3 < 70%.",
    "block": "1–2 sentences. The key cognitive gap. Plain English. Reference the Pranamaya link if relevant.",
    "kg_edges": ["edge1", "edge2", "edge3", "edge4"]
  },
  "anandamaya": {
    "reading": "3–4 warm sentences. Name ${childName}. Reference DiscoverMe data (hemisphere, temperament, dominance pattern) as ${genderPossessive} 'fixed inner wiring'. Use warm language. Mention what kind of learning environment or career direction this points to.",
    "block": "1–2 sentences. The core blueprint insight. Reference the specific laterality/temperament data.",
    "kg_edges": ["edge1", "edge2", "edge3", "edge4"]
  },
  "atman": {
    "name": "2–4 word archetype name rooted in ${childName}'s top vectors.",
    "confidence": 75
  }
}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ─── JWT Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const serviceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const body = await req.json();
    const {
      child_id,
      child_name = "Child",
      age_years = 12,
      gender = "unknown",
      diet = "mixed",
      physical = {},
      cognitive = {},
      nutrition = {},
      wellbeing = {},
      discoverme = null,
    } = body;

    console.log(`[panchkosha] Generating for child_id=${child_id}, name=${child_name}`);

    // ── Compute scores from raw data ──────────────────────────────────────────
    const annamaya = computeAnnamayaScore(physical);
    const pranamaya = computePranamayaScore(nutrition);
    const manomaya = computeManomayaScore(wellbeing);
    const vijnanamaya = computeVijnanamayaScore(cognitive);
    const anandamaya = computeAnandamayaScore(discoverme);

    const koshaData = { annamaya, pranamaya, manomaya, vijnanamaya, anandamaya };

    // ── Cache check ───────────────────────────────────────────────────────────
    const cacheInputs = {
      v: "panchkosha_v2_cultural",
      child_id,
      physical: {
        coord: physical.coordinationPercentile ?? physical.coordination,
        balance: physical.balanceHoldPercentile ?? physical.balance,
        endurance: physical.enduranceProxy ?? physical.endurance,
      },
      cognitive: {
        g1: cognitive.sustainedAttentionDPrime ?? cognitive.attention,
        g2: cognitive.workingMemoryPercentile ?? cognitive.workingMemory,
        g4: cognitive.fluidReasoningPercentile ?? cognitive.reasoning,
        g5: cognitive.emotionRecognitionPercentile ?? cognitive.cogFlex,
        g6: cognitive.game6_emotionalCognition ?? cognitive.emotionalCognition,
      },
      nutrition: {
        iron: nutrition.ironAdequacy ?? nutrition.iron,
        omega3: nutrition.omega3Adequacy ?? nutrition.omega3,
        b12: nutrition.vitaminB12Adequacy ?? nutrition.b12,
      },
      wellbeing: {
        anxiety: wellbeing.academicAnxiety ?? wellbeing.anxietyScreenPercentile,
        emotional: wellbeing.emotionalRegulation ?? wellbeing.emotionalWellbeingPercentile,
      },
    };

    const cacheKey = await buildCacheKey("panchkosha_v2_cultural", cacheInputs);
    const cachedResult = await getCached(serviceClient, cacheKey, "panchkosha_v2_cultural");
    if (cachedResult.hit) {
      logCacheStats("panchkosha");
      return new Response(JSON.stringify(cachedResult.result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate AI narratives ────────────────────────────────────────────────
    const prompt = buildKoshaPrompt(
      child_name,
      age_years,
      gender,
      diet,
      koshaData,
      { physical, cognitive, nutrition, wellbeing, discoverme },
    );

    const aiRaw = await callAI(
      LOVABLE_API_KEY,
      [{ role: "user", content: prompt }],
      2400,
      0.15,
    );

    // ── Parse AI JSON ─────────────────────────────────────────────────────────
    let aiJson: Record<string, unknown> = {};
    try {
      const match = aiRaw.match(/```json\s*([\s\S]*?)```/) ?? aiRaw.match(/(\{[\s\S]*\})/);
      const jsonStr = match ? match[1] : aiRaw;
      aiJson = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error("[panchkosha] JSON parse failed:", e, "raw:", aiRaw.slice(0, 500));
    }

    // ── Merge computed scores with AI narratives ──────────────────────────────
    const getKosha = (id: string, score: number, harmony: number) => {
      const ai = aiJson[id] as Record<string, unknown> | undefined;
      return {
        score,
        harmony,
        reading: (ai?.reading as string) ?? `Assessment data for ${id} is being processed.`,
        block: (ai?.block as string) ?? "",
        kg_edges: (ai?.kg_edges as string[]) ?? [],
      };
    };

    const result = {
      child_id,
      child_name,
      annamaya:    getKosha("annamaya",    annamaya.score,    annamaya.harmony),
      pranamaya:   getKosha("pranamaya",   pranamaya.score,   pranamaya.harmony),
      manomaya:    getKosha("manomaya",    manomaya.score,    manomaya.harmony),
      vijnanamaya: getKosha("vijnanamaya", vijnanamaya.score, vijnanamaya.harmony),
      anandamaya:  getKosha("anandamaya",  anandamaya.score,  anandamaya.harmony),
      atman: {
        name:       ((aiJson.atman as Record<string, unknown>)?.name as string) ?? "The Developing Child",
        confidence: ((aiJson.atman as Record<string, unknown>)?.confidence as number) ?? 75,
      },
      metadata: { generated_at: new Date().toISOString(), model: "google/gemini-3.1-pro-preview" },
    };

    // ── Cache result + emit monitoring stats ──────────────────────────────────
    await setCached(serviceClient, cacheKey, "panchkosha_v2_cultural", result, 30);
    logCacheStats("panchkosha");

    console.log(`[panchkosha] Done. Atman: ${result.atman.name} (${result.atman.confidence}%)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[panchkosha] Error:", err);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
