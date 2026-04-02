// ═══════════════════════════════════════════════════════════════════════════
// KidSutra — Blueprint Narrative Generator (v2 — full DM context)
// Generates 4 hyper-personalised bullet insights AFTER archetype is locked.
// Architecture: archetype+scores are computed deterministically FIRST;
// this function only generates the narrative wrapper, never the identity.
// Model: gemini-2.5-pro for maximum reasoning quality.
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
    const {
      childName,
      archetype,
      topDimension,
      topScore,
      secondDimension,
      secondScore,
      dmStandoutStrength,
      topPdfMetrics,
      childAge,
      childGender,
      // New: full DM context
      dmNaturalIntelligences,
      dmCareerTraits,
      dmStressors,
      dmLearningStyle,
      dmSportAptitude,
      dmArtisticStyle,
      allVectorScores,
      cogGameScores,
    } = await req.json();

    if (!childName || !archetype || !topDimension) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // ── Build rich DM context block ─────────────────────────────────────────
    const hasDM = !!dmStandoutStrength;

    const dmContextBlock = hasDM ? `
DISCOVERNE NEUROCOGNITIVE PROFILE:
- Brain profile: ${dmStandoutStrength}
- Natural intelligences: ${(dmNaturalIntelligences ?? []).join(', ') || 'not provided'}
- Career traits: ${(dmCareerTraits ?? []).join(', ') || 'not provided'}
- Stressors: ${(dmStressors ?? []).join(', ') || 'not provided'}
- Learning style: primary mode = ${dmLearningStyle?.primaryMode ?? 'unknown'}, needs novelty = ${dmLearningStyle?.needsNovelty ?? false}, tolerates repetition = ${dmLearningStyle?.toleratesRepetition ?? false}, prefers big picture = ${dmLearningStyle?.prefersBigPicture ?? false}, prefers detail = ${dmLearningStyle?.prefersDetail ?? false}
- Sport aptitude: coordination = ${dmSportAptitude?.coordinationRating ?? 'unknown'}, straight-line sports = ${dmSportAptitude?.straightLineSports ?? false}, agility = ${dmSportAptitude?.agilityBased ?? false}, stress impact on performance = ${dmSportAptitude?.stressImpactOnPerformance ?? 'unknown'}
- Artistic style: ${dmArtisticStyle ?? 'not provided'}
- Top PDF metrics confirmed: ${(topPdfMetrics ?? []).join(', ')}` : `No DiscoverMe neurocognitive data was uploaded. Use only the assessment scores below.`;

    // ── Build vector scores context ─────────────────────────────────────────
    const vectorContext = (allVectorScores ?? []).length > 0
      ? `\nAll 5 pathway scores: ${(allVectorScores as Array<{name: string; score: number}>).map(v => `${v.name} = ${v.score}/100`).join(' | ')}`
      : '';

    const cogContext = cogGameScores
      ? `\nCognitive game percentiles (vs Indian peers):
- Game 1 Sustained Attention: ${cogGameScores.g1_attention}th pct
- Game 2 Working Memory: ${cogGameScores.g2_workingMemory}th pct
- Game 3 Processing Speed: ${cogGameScores.g3_processingSpeed}th pct
- Game 4 Abstract Reasoning: ${cogGameScores.g4_reasoning}th pct
- Game 5 Cognitive Flexibility: ${cogGameScores.g5_cogFlex}th pct
- Game 6 Emotional Cognition: ${cogGameScores.g6_emotionCog}th pct`
      : '';

    const hybridContext = secondDimension && secondScore
      ? ` This is a HYBRID IDENTITY — secondary strength is ${secondDimension} (score: ${Math.round(secondScore)}/100), almost as strong as the primary.`
      : '';

    const prompt = `You are a world-class child development scientist writing a hyper-personalised developmental briefing for a parent.

CHILD PROFILE:
- Name: ${childName}, Age: ${childAge ?? 'unknown'} years, Gender: ${childGender ?? 'unspecified'}
- KidSutra Identity: "${archetype}"
- Top developmental strength: ${topDimension} (score: ${Math.round(topScore)}/100)${hybridContext}
${vectorContext}
${cogContext}

${dmContextBlock}

TASK: Write exactly 4 bullet insights for "What This Means For ${childName}".

RULES (violating any rule = failed output):
1. SPECIFICITY: Every bullet MUST cite at least one exact number (e.g. "86th percentile", "78/100", "29th pct"). Zero generic statements.
2. GAME SCORE CITATION: At least 2 bullets MUST explicitly name a cognitive game by name AND percentile (e.g. "Game 5 Cognitive Flexibility: 86th pct") and say what that means at home.
3. CROSS-DATA CONNECTION: Every bullet connects TWO data points non-obviously (e.g. Game 5 score + a named stressor, or DM learning style boolean + a cognitive game gap).
4. PERSONALISATION: If DiscoverMe data is present, at least 2 bullets must cite a specific named DM field (named intelligence, named stressor, a specific sport aptitude sub-type, or a learning style boolean value).
5. LENGTH: 20-30 words per bullet — enough to cite data AND deliver the insight.
6. ACTIONABILITY: End at least 1 bullet with a concrete specific action this week (e.g. "Switch to 25-min single-subject blocks — never 2 subjects back-to-back").
7. NO OVERLAP: Every bullet makes a completely distinct point.

Return ONLY a valid JSON array of 4 strings: ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]`;

    // Stricter prompt suffix to force pure JSON array output
    const jsonEnforcedPrompt = prompt + `

CRITICAL OUTPUT FORMAT: Your response MUST be a valid JSON array and nothing else.
Start with [ and end with ]. No markdown, no explanation, no numbering outside the array.
Example format: ["First bullet here.", "Second bullet here.", "Third bullet here.", "Fourth bullet here."]`;

    // AbortController timeout — 55 s per call; prevents edge-function slot starvation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55_000);

    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-pro-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a JSON-only response API. Always respond with a valid JSON array of exactly 4 strings. No markdown, no prose, no explanation — only the JSON array.',
            },
            { role: 'user', content: jsonEnforcedPrompt },
          ],
          temperature: 0.6,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Narrative generation timed out. Please try again.' }), {
          status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '';
    const finishReason = data.choices?.[0]?.finish_reason;
    console.log('[narrative] finish_reason:', finishReason, '| content len:', rawContent.length);
    // Strip markdown code fences if model wraps in ```json ... ```
    const content = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    if (!content) throw new Error('Empty AI response');

    let bullets: string[] = [];
    try {
      const parsed = JSON.parse(content);
      console.log('[narrative] parsed type:', typeof parsed, 'isArray:', Array.isArray(parsed));
      if (Array.isArray(parsed)) {
        bullets = parsed.map(String);
      } else if (typeof parsed === 'object' && parsed !== null) {
        const candidate =
          (parsed as Record<string, unknown>).bullets ??
          (parsed as Record<string, unknown>).insights ??
          (parsed as Record<string, unknown>).items ??
          (parsed as Record<string, unknown>).bullet_insights ??
          (parsed as Record<string, unknown>).what_this_means ??
          (parsed as Record<string, unknown>).results ??
          Object.values(parsed as Record<string, unknown>).find((v) => Array.isArray(v));
        if (Array.isArray(candidate)) {
          bullets = candidate.map(String);
        } else {
          const vals = Object.values(parsed as Record<string, unknown>).filter((v) => typeof v === 'string') as string[];
          if (vals.length >= 4) bullets = vals;
        }
      }
    } catch (parseErr) {
      console.warn('[narrative] JSON.parse failed:', parseErr, '| content start:', content.slice(0, 100));
      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try { bullets = JSON.parse(arrayMatch[0]).map(String); } catch { /* continue */ }
      }
      if (bullets.length < 4) {
        const lines = content
          .split(/\n+/)
          .map((l: string) => l.replace(/^[\s*\-•\d\.]+/, '').trim())
          .filter((l: string) => l.length >= 10);
        if (lines.length >= 4) bullets = lines;
      }
    }
    console.log('[narrative] bullets count:', bullets.length);

    bullets = bullets.slice(0, 4).map(String);
    if (bullets.length < 4) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI returned fewer than 4 bullets',
        bullets: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, bullets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[generate-blueprint-narrative] Error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
