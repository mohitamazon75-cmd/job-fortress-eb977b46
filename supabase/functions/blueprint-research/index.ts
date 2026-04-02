// KidSutra — Blueprint Research via Perplexity
// Enriches career/exam cards with live Indian context from Perplexity sonar
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCacheKey, getCached, setCached } from "../_shared/ai-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Career research is stable for 7 days
const CACHE_TTL_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── JWT Auth — prevents unauthenticated Perplexity credit burn ──────────────
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

  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    return new Response(JSON.stringify({ error: "Perplexity API key not configured" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { query, type = "career" } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input length cap — prevents giant payload abuse
    const safeQuery = query.trim().slice(0, 500);

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cacheKey = await buildCacheKey("blueprint_research_v1", { query: safeQuery, type });
    const cached = await getCached(serviceClient, cacheKey);
    if (cached.hit) {
      console.log(`[blueprint-research] cache HIT for "${safeQuery.slice(0, 30)}…"`);
      return new Response(JSON.stringify({ ...(cached.result as object), cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentYear = new Date().getFullYear();

    // Build query tailored to career vs exam type
    const systemPrompt = type === "exam"
      ? `You are an Indian education expert. Provide concise, factual information about entrance exams in India. Include eligibility, age limits, exam dates, and preparation tips. Format: 2–3 short paragraphs. Cite sources where possible.`
      : `You are an Indian career counsellor. Provide concise, factual information about career scope in India right now. Include salary ranges, top companies, required qualifications, and growth outlook. Format: 2–3 short paragraphs. Cite sources where possible.`;

    const userQuery = type === "exam"
      ? `${safeQuery} India ${currentYear} eligibility age limit syllabus preparation time coaching`
      : `${safeQuery} career India ${currentYear} salary scope entrance exam requirements job market`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userQuery },
        ],
        max_tokens: 500,
        temperature: 0.2,
        search_recency_filter: "year",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Research failed", details: errText }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];

    const result = {
      answer,
      citations,
      query: safeQuery,
      model: "perplexity-sonar",
      generatedAt: new Date().toISOString(),
    };

    // Cache non-blocking
    setCached(serviceClient, cacheKey, "blueprint_research", result, CACHE_TTL_DAYS);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("blueprint-research error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Research failed" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
