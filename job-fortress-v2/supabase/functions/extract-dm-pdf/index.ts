// ═══════════════════════════════════════════════════════════════════════════
// KidSutra — DiscoverMe PDF Intelligence Extractor
// Uses Gemini AI to extract brain dominance profile data from any PDF format.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── JWT Auth ────────────────────────────────────────────────────────────────
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
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // ─────────────────────────────────────────────────────────────────────────────

  try {
    const { pdfText } = await req.json();

    if (!pdfText || pdfText.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'No PDF text provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const prompt = `You are a precise data extraction assistant. Extract brain dominance and learning style profile data from the following DiscoverMe / neuro-profiling report text.

Return ONLY a valid JSON object with these exact keys:
{
  "blueprintCode": string or null,           // e.g. "L", "LR", "R", "XR", "XL" — the profile/blueprint code
  "brainHemisphere": "left" | "right" | null,
  "dominantEye": "right" | "left" | null,
  "dominantEar": "right" | "left" | null,
  "dominantHand": "right" | "left" | null,
  "dominantFoot": "right" | "left" | null,
  "temperament": "expressive" | "receptive" | "emotional" | null,
  "naturalIntelligences": string[],
  "developmentalIntelligences": string[],
  "careerTraits": string[],
  "stressors": string[],
  "learningStyle": {
    "primaryMode": "visual" | "auditory" | "reading" | "kinesthetic" | null,
    "secondaryMode": "visual" | "auditory" | "reading" | "kinesthetic" | null,
    "tertiaryMode": "visual" | "auditory" | "reading" | "kinesthetic" | null,
    "weakestMode": "visual" | "auditory" | "reading" | "kinesthetic" | null,
    "varkRanked": string[],   // Full ordered VARK rank from the report e.g. ["visual","kinesthetic","auditory","reading"] — PRIMARY first, WEAKEST last. MUST have 4 distinct entries from: visual, auditory, reading, kinesthetic
    "prefersBigPicture": boolean,
    "prefersDetail": boolean,
    "needsNovelty": boolean,
    "toleratesRepetition": boolean
  },
  "sportAptitude": {
    "straightLineSports": boolean,
    "agilityBased": boolean,
    "handTechnique": boolean,
    "balanceSports": boolean,
    "coordinationRating": "high" | "medium" | "low",
    "stressImpactOnPerformance": "high" | "medium" | "low"
  },
  "artisticStyle": string | null,
  "blockedModalities": string[],
  "extractionConfidence": "high" | "medium" | "low",
  "extractedFields": string[],
  "missingFields": string[],
  "rawNotes": string
}

CRITICAL RULES for learningStyle:
- varkRanked MUST always contain exactly 4 entries: "visual", "auditory", "reading", "kinesthetic" — all four, no duplicates, ordered from STRONGEST (1st) to WEAKEST (4th).
- If the report explicitly names a learning style ranking or modality order, extract it exactly.
- If only a primary mode is named, infer the remaining 3 from brain hemisphere, temperament, and other clues in the report.
- "reading" means "Read/Write" learning style (VARK terminology).
- Also populate primaryMode, secondaryMode, tertiaryMode, weakestMode from the varkRanked array positions.
- NEVER repeat the same mode — all 4 must be different.

General rules:
- Extract ONLY what is present in the text. Do NOT invent values unrelated to the report.
- For booleans, default false if not mentioned.
- For arrays, return [] if nothing found.
- If the text is not a DiscoverMe/brain dominance report, set extractionConfidence to "low".

PDF Text to analyse:
---
${pdfText.slice(0, 14000)}
---`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error('Empty response from AI');

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(content);
    } catch {
      // Sometimes model returns JSON wrapped in markdown
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Validate we got something useful
    const hasData = extracted.brainHemisphere || extracted.blueprintCode || extracted.dominantHand;
    if (!hasData && extracted.extractionConfidence === 'low') {
      return new Response(JSON.stringify({
        success: false,
        error: 'This does not appear to be a DiscoverMe report. No brain dominance data found.',
        rawNotes: extracted.rawNotes,
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[extract-dm-pdf] Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
