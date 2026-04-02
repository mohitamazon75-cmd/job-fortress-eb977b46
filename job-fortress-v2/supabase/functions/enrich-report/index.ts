// KidVital360 — RAG Enrichment Edge Function v5
// 3-step LLM reasoning pipeline — ALL steps use google/gemini-3.1-pro-preview
//   Step 1 — Deep Clinical Synthesis: 5-part structured clinical analysis
//   Step 2 — Parent Narrative: warm, India-specific, jargon-free 300-word summary
//   Step 3 — Structured Intervention JSON: prioritised food swaps + referral triggers
//   Step 4 — Legacy compat layer: interventions/weeklyActions/encouragement JSON
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCacheKey, getCached, setCached, logCacheStats } from "../_shared/ai-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_TTL_DAYS = 7;
const MODEL = "google/gemini-3.1-pro-preview";

// ─── AI call with AbortController timeout ───────────────────────────────────
// Each LLM step is budget-capped at 55 s. The full 3-step pipeline should
// finish in <2 min; if any step hangs it aborts cleanly rather than holding
// an edge-function slot open indefinitely (avoids slot starvation under load).
const AI_STEP_TIMEOUT_MS = 55_000;

async function callAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature = 0.25
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_STEP_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      throw new Error("AI_TIMEOUT: LLM step exceeded 55 s — aborting to free slot");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) throw new Error("AI_RATE_LIMIT: upstream model rate-limited");
    throw new Error(`AI gateway ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── LLM-02: Full shape validator for Step 3 JSON output ────────────────────
function validateStep3(parsed: unknown): parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  const VALID_URGENCY = ["immediate", "high", "moderate", "low"];
  if (typeof p.topPriority !== "string" || !p.topPriority.trim()) return false;
  if (typeof p.timeframe !== "string" || !p.timeframe.trim()) return false;
  if (!Array.isArray(p.indianFoodSwaps) || p.indianFoodSwaps.length === 0) return false;
  for (const swap of p.indianFoodSwaps) {
    if (!swap || typeof swap !== "object") return false;
    const s = swap as Record<string, unknown>;
    if (typeof s.avoid !== "string" || typeof s.replace !== "string" || typeof s.reason !== "string") return false;
  }
  if (!VALID_URGENCY.includes(p.urgencyLevel as string)) return false;
  if (!Array.isArray(p.doctorReferralTriggers) || p.doctorReferralTriggers.length === 0) return false;
  if (p.doctorReferralTriggers.some((t: unknown) => typeof t !== "string")) return false;
  if (typeof p.weeklyMilestone !== "string" || !p.weeklyMilestone.trim()) return false;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── JWT Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      reportSummary, childAge, childGender, dietType,
      topConcerns, hiddenPatterns, risks, algorithmOutputs, wellbeingScores,
    } = body;

    if (!reportSummary) {
      return new Response(JSON.stringify({ error: "Missing report summary" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Cache check ────────────────────────────────────────────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cacheInputs = { reportSummary, childAge, childGender, dietType, topConcerns, hiddenPatterns, risks };
    const cacheKey = await buildCacheKey("enrich_report_v6", cacheInputs);

    const cached = await getCached(serviceClient, cacheKey, "enrich_report_v6");
    if (cached.hit) {
      logCacheStats("enrich-report");
      return new Response(JSON.stringify({ ...(cached.result as object), cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    // Distil algorithm outputs to key signals
    const algSummary = algorithmOutputs ? JSON.stringify({
      phenotype: algorithmOutputs.phenotypicProfile ?? null,
      latentHealthScore: algorithmOutputs.latentHealthScore?.lhs ?? null,
      bayesianPosteriors: (algorithmOutputs.bayesianPosteriors ?? []).slice(0, 6),
      topPatterns: (algorithmOutputs.patternActivations ?? []).slice(0, 6),
      mediationResults: (algorithmOutputs.mediationResults ?? []).slice(0, 5),
      developmentalAge: algorithmOutputs.developmentalAge ?? null,
      convergenceScore: algorithmOutputs.convergenceScore ?? null,
      topInterventions: (algorithmOutputs.topInterventions ?? []).slice(0, 5),
      icdFlags: (algorithmOutputs.icdFlags ?? []).slice(0, 4),
    }, null, 2) : "Not provided";

    // ALG-01 FIX: Format wellbeing domain data for the prompt
    const wellbeingSummary = wellbeingScores
      ? `Wellbeing assessed (projective screener): composite ${wellbeingScores.composite}/100, anxiety index ${wellbeingScores.anxiety}/100, social safety ${wellbeingScores.social}/100, emotional wellbeing ${wellbeingScores.emotional}/100, resilience ${wellbeingScores.resilience}/100${wellbeingScores.safetyFlag ? " — SAFETY FLAG RAISED" : ""}.`
      : "Wellbeing screener: not yet completed — do not speculate on psychosocial findings.";

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Deep Clinical Synthesis
    // Produces: structured 5-part clinical assessment with evidence anchors
    // ═══════════════════════════════════════════════════════════════════════
    // LLM-07 FIX: Replaced named AIIMS doctor persona (medico-legal risk) with
    // a role-based clinical voice. No real institution or individual is named.
    // LLM-01 FIX: Replaced "quote exact percentile values" with "reference scores
    // as provided on a 0–100 scale" to avoid misrepresenting engine scores as
    // population percentiles.
    const step1SystemPrompt = `You are a senior pediatric developmental medicine specialist with 20 years of experience in Indian child health. You specialise in integrating nutrition science, cognitive development, behavioural paediatrics, and psychosocial wellbeing.

You receive multi-domain assessment data from a validated 24-algorithm development engine and must produce a rigorous, structured clinical synthesis.

SCORE FORMAT: All scores in the data are on a 0–100 scale. Reference them as scores (e.g. "scored 42/100") — do NOT describe them as percentiles or population ranks unless the data explicitly labels them as such.

CORE PRINCIPLES:
1. PRECISION — Reference scores exactly as provided (0–100 scale). Never fabricate or infer population percentile ranks from these values.
2. EVIDENCE — Every mechanistic claim must be grounded in real, published research: ICMR, NIMHANS, IAP, WHO, Lancet, JAMA Pediatrics, Pediatrics, NJCP, IJCP. Do not invent citations — if you are uncertain of a specific citation, describe the mechanism without attributing it to a specific paper.
3. MECHANISM — Always explain WHY a pattern exists, not just WHAT the score is. Trace the biological/developmental pathway.
4. INDIA-SPECIFICITY — Contextualise every finding for Indian children: vegetarian diets, phytate interference, urban Tier-1/2 vitamin D deficit, screen-time patterns, CBSE/ICSE academic stress, food insecurity in lower tiers.
5. ACTIONABILITY — Every flag must have a corresponding leverage point (what, specifically, could change it).
6. NO DIAGNOSIS — Flag patterns warranting professional review, never label conditions.
7. FOUR DOMAINS — This engine assesses Physical, Cognitive, Nutritional, AND Wellbeing. Synthesise all four domains present in the data. If Wellbeing was not assessed, note its absence.

OUTPUT FORMAT — Return exactly these 5 sections, labelled precisely:

## CLINICAL NARRATIVE
A dense 4-5 sentence paragraph integrating all domain findings across Physical, Cognitive, Nutritional, and Wellbeing. Reference scores as X/100, name the dominant phenotypic profile if available, and use clinical language (Step 2 will translate this for parents).

## PRIORITY FLAGS
Three numbered flags. Each flag: [Flag name] — [score/100 value] — [mechanism in plain clinical terms] — [urgency: immediate/high/moderate] — [evidence basis or mechanism reference].

## BIOLOGICAL PATHWAY CHAIN
For the top nutritional/cognitive concern, trace the complete chain:
[Nutrient deficit] → [enzymatic/metabolic impact] → [neurotransmitter affected] → [brain region/circuit] → [observable behaviour/performance impact]
Reference the mechanism with a real published study if confident of the citation.

## COGNITIVE IMPACT TRIAD CHECK
If Iron, Omega-3, Vitamin B12, or Vitamin D are simultaneously low (below 80% adequacy score):
- Name the specific combination present (e.g., "Iron-B12 Dual Deficit" or "Iron-Omega3-D3 Triple Deficit")
- State each nutrient's score (X/100)
- Note ICMR-NIN adolescent RDA values for each nutrient
- Estimate expected improvement range if addressed (cite supporting research if confident)
If no deficit combination is present, state: "Cognitive Impact Triad: Not triggered (no dual-deficit pattern detected)."

## INDIA CONTEXT
- Reference specific ICMR-NIN RDAs by age group
- Name the dietary absorption mechanism relevant to this child's diet (e.g., phytate-mediated iron block, oxalate interference with calcium, limited dairy → B12 gap)
- Name the city-tier lifestyle factor most relevant (e.g., "Tier-1 urban indoor lifestyle → limited sun exposure → likely low vitamin D")
- Identify one school-system stressor (CBSE/ICSE rote load, competitive coaching pressure, etc.) and its neurobiological toll`;

    const step1UserPrompt = `Analyse these V4.0 engine outputs for a ${childAge}-year-old ${childGender} child on a ${dietType || 'vegetarian'} diet. Apply all 5 output sections rigorously. All scores are on a 0–100 scale.

DOMAIN SCORE SUMMARY (all values are 0–100 scores, not population percentiles):
${reportSummary}

WELLBEING DOMAIN:
${wellbeingSummary}

TOP CONCERNS (ranked by severity):
${topConcerns?.map((c: any, i: number) => `${i + 1}. ${c.domain} — ${c.metric}: score ${c.score}/100`).join('\n') || 'No critical concerns flagged'}

HIDDEN PATTERNS DETECTED:
${hiddenPatterns?.map((p: any) => `• ${p.title} (engine confidence: ${p.probability}%): ${p.description}`).join('\n') || 'None detected by pattern engine'}

BAYESIAN RISK POSTERIORS:
${risks?.map((r: any) => `• ${r.name}: posterior probability ${r.riskProbability}%, preventability index ${r.preventability}%`).join('\n') || 'Low risk across all domains'}

V4.0 ALGORITHM OUTPUTS (24-algorithm engine):
${algSummary}

Produce the full 5-section clinical synthesis now.`;

    console.log(`[enrich-report v5] Step 1: Deep clinical synthesis (${MODEL})...`);
    const step1Raw = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: step1SystemPrompt },
      { role: "user", content: step1UserPrompt },
    ], 2000, 0.15);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Parent Narrative (warm, India-specific, 300 words)
    // ═══════════════════════════════════════════════════════════════════════
    const step2SystemPrompt = `You are Meera, a warm and trusted child development counsellor who has worked with Indian families for 15 years. You write parent summaries that feel like a caring expert sat down with the family over chai.

YOUR WRITING STYLE:
- Speak directly to the parent ("your child", "you can", "try this at home")
- Open with 1 genuine strength — something the child is doing well
- Only use plain, everyday English — no medical words. If you must use a term, immediately explain it in brackets
- Reference familiar Indian foods: rajma, dal, ragi, palak, amla, dahi, atta, moringa, eggs if non-veg
- Be honest about gaps but frame them as opportunities, never as failures or deficits
- Never use the words: percentile, algorithm, posterior, phenotype, neurotransmitter, bioavailability, cortisol, cognitive architecture, laterality, rote load — translate all of these into what a parent actually experiences
- Maximum 320 words

MANDATORY STRUCTURE (follow this order):
1. ONE STRENGTH (1-2 sentences — what this child is genuinely good at based on data)
2. WHAT NEEDS ATTENTION (2-3 sentences — the 1-2 most important areas, explained simply)
3. THE FOOD CONNECTION (2-3 sentences — which specific nutrients are low, which Indian foods fix them, why this matters for focus/energy RIGHT NOW — be specific: "Iron is low, which reduces your child's ability to concentrate for more than 20 minutes")
4. SCHOOL & CAREER FIT (1-2 sentences — reference cognitive game scores to support stream/career direction if available)
5. TODAY'S ACTION (1 specific meal or activity the parent can do TODAY — name ingredients and quantity, e.g., "Tonight, add 2 tablespoons of ragi flour to your child's roti dough — ragi has 3× more iron than wheat")
6. ENCOURAGING CLOSE (1 sentence — warm, personal, forward-looking)`;

    const step2UserPrompt = `The clinical assessment for this ${childAge}-year-old ${childGender} child on a ${dietType || 'vegetarian'} diet is below. Write the 320-word parent summary following the exact 6-part structure. Be specific about Indian foods, name actual nutrients (but explain them plainly), and make the action step something they can do tonight.

CLINICAL ASSESSMENT:
${step1Raw}`;

    console.log(`[enrich-report v5] Step 2: Parent narrative (${MODEL})...`);
    const step2Raw = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: step2SystemPrompt },
      { role: "user", content: step2UserPrompt },
    ], 700, 0.4);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 — Structured Intervention JSON
    // ═══════════════════════════════════════════════════════════════════════
    const step3SystemPrompt = `You are a pediatric nutrition and development specialist. Extract a precise structured intervention plan from the clinical assessment below.
Return ONLY valid JSON — no markdown fences, no explanation text, no preamble.
Every string field must be complete, specific, and actionable. No vague placeholders.`;

    const step3UserPrompt = `Child: ${childAge}-year-old ${childGender}, diet: ${dietType || 'vegetarian'}

CLINICAL ASSESSMENT:
${step1Raw}

RISK AREAS:
${risks?.map((r: any) => `- ${r.name}: ${r.riskProbability}% posterior risk, ${r.preventability}% preventable`).join('\n') || 'Low risk across domains'}

Return a JSON object with EXACTLY this structure (all fields required, strings must be specific):
{
  "topPriority": "single most important intervention in 1 clear sentence naming the specific nutrient or domain and the exact food/action",
  "timeframe": "realistic improvement timeline, e.g. '6-10 weeks of consistent dietary change'",
  "indianFoodSwaps": [
    {"avoid": "specific food to reduce", "replace": "specific Indian food to add instead", "reason": "1-sentence mechanism — why this swap matters for this child"},
    {"avoid": "specific food to reduce", "replace": "specific Indian food to add instead", "reason": "1-sentence mechanism"},
    {"avoid": "specific food to reduce", "replace": "specific Indian food to add instead", "reason": "1-sentence mechanism"}
  ],
  "urgencyLevel": "immediate|high|moderate|low",
  "doctorReferralTriggers": [
    "specific measurable threshold that should prompt a paediatrician visit (e.g. 'If focus problems persist beyond 8 weeks despite dietary changes')",
    "second specific trigger"
  ],
  "weeklyMilestone": "one concrete, observable weekly check-in the parent can do at home (e.g., 'Check if your child can read for 25 minutes without breaks by week 4')"
}`;

    console.log(`[enrich-report v6] Step 3: Structured intervention (${MODEL})...`);
    const step3Raw = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: step3SystemPrompt },
      { role: "user", content: step3UserPrompt },
    ], 900, 0.15);

    // LLM-02: Full shape validation before storing — 6-key schema check, never corrupt
    let structuredIntervention: Record<string, unknown> = {};
    try {
      const cleaned = step3Raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (validateStep3(parsed)) {
        structuredIntervention = parsed;
      } else {
        console.warn("[enrich-report v6] Step 3 JSON failed shape validation, using raw fallback");
        structuredIntervention = { raw: step3Raw, parseError: true };
      }
    } catch {
      console.warn("[enrich-report v6] Step 3 JSON parse failed, using raw text");
      structuredIntervention = { raw: step3Raw, parseError: true };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4 — Legacy-Compatible Enrichment JSON
    // Backward compat for existing report consumers
    // ═══════════════════════════════════════════════════════════════════════
    const legacySystemPrompt = `You are a pediatric development expert specialising in Indian child health.
Produce evidence-based, parent-friendly recommendations in structured JSON.
Rules:
- All text must be plain English, no clinical jargon
- Include specific Indian foods and realistic daily practices
- Each intervention must have a measurable outcome
- Never diagnose — recommend and flag
Return ONLY valid JSON, no markdown fences.`;

    const legacyUserPrompt = `Based on this clinical synthesis for a ${childAge}-year-old ${childGender} child (diet: ${dietType || 'vegetarian'}):

${step1Raw}

Return a JSON object with exactly these keys:
{
  "interventions": [
    {"title": "string", "description": "2-sentence specific action", "timeframe": "string", "evidence": "citation"},
    {"title": "string", "description": "2-sentence specific action", "timeframe": "string", "evidence": "citation"},
    {"title": "string", "description": "2-sentence specific action", "timeframe": "string", "evidence": "citation"}
  ],
  "weeklyActions": [
    "Day 1-2: specific action",
    "Day 3-4: specific action",
    "Day 5-6: specific action",
    "Weekend: specific family activity",
    "Weekly check: one observable thing to look for"
  ],
  "doctorReferral": {
    "threshold": "specific condition that triggers referral",
    "reason": "1-sentence explanation of why this matters",
    "specialistType": "paediatrician|developmental paediatrician|dietitian|child psychologist"
  },
  "encouragement": "2-sentence warm closing for the parent — name one specific thing the child is doing well and one thing the parent can feel proud of doing"
}`;

    console.log(`[enrich-report v6] Step 4: Legacy compat layer (${MODEL})...`);
    const legacyRaw = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: legacySystemPrompt },
      { role: "user", content: legacyUserPrompt },
    ], 1800, 0.25);

    let legacyEnrichment: Record<string, unknown> = {};
    try {
      const cleaned = legacyRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      legacyEnrichment = JSON.parse(cleaned);
    } catch {
      legacyEnrichment = { raw: legacyRaw, parseError: true };
    }

    const result = {
      // Legacy compat key
      enrichment: legacyEnrichment,
      // 3-step pipeline outputs
      clinicalNarrative: step1Raw,
      parentSummary: step2Raw,
      structuredIntervention,
      model: MODEL,
      pipelineVersion: "v6",
      generatedAt: new Date().toISOString(),
    };

    // Cache result (fire and forget) + emit hit-rate stats
    setCached(serviceClient, cacheKey, "enrich_report_v6", result, CACHE_TTL_DAYS);
    logCacheStats("enrich-report");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[enrich-report v5] Error:", error);

    if (error.message?.includes("429")) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment" }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (error.message?.includes("402")) {
      return new Response(JSON.stringify({ error: "AI credits exhausted — please check your workspace billing" }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: error.message || "Enrichment pipeline failed" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
