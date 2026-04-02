// KidVital360 — Tavily Live Research Enrichment
// Enriches hidden patterns with real-time, cited pediatric research via Tavily AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCacheKey, getCached, setCached } from "../_shared/ai-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Research results are stable for 3 days — same patterns → same citations
const CACHE_TTL_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── JWT Auth (P0-3 fix) ──────────────────────────────────────────────────
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
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    if (!TAVILY_API_KEY) {
      return new Response(JSON.stringify({ error: "Tavily API key not configured" }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { hiddenPatterns, childAge, childGender, neurodivergence, dietType } = body;

    if (!hiddenPatterns || hiddenPatterns.length === 0) {
      return new Response(JSON.stringify({ citations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build focused research queries for top 3 patterns
    const topPatterns = hiddenPatterns.slice(0, 3);
    const ndContext = neurodivergence?.length > 0 ? ` with ${neurodivergence.join(", ")}` : "";
    const patternTitles = topPatterns.map((p: any) => p.title).join(", ");

    // ─── Hash-based deduplication ─────────────────────────────────────────
    // Key on the inputs that actually determine the query + response
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use pattern titles + profile as the canonical cache inputs
    // (patternTitles captures what we searched for; profile captures context)
    const cacheInputs = {
      patternTitles,
      childAge,
      childGender,
      neurodivergence: neurodivergence ?? [],
      dietType: dietType ?? "mixed",
    };
    const cacheKey = await buildCacheKey("tavily_research", cacheInputs);

    const cached = await getCached(serviceClient, cacheKey);
    if (cached.hit) {
      console.log(`[perplexity-research] cache HIT for key ${cacheKey.slice(0, 12)}…`);
      return new Response(JSON.stringify({
        ...(cached.result as object),
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    const searchQuery = `Evidence-based interventions for Indian children aged ${childAge} (${childGender}${ndContext}, ${dietType || "mixed"} diet) for developmental patterns: ${patternTitles}. WHO ICMR IAP Lancet pediatrics research 2018-2024`;

    // Call Tavily search API
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: searchQuery,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: 8,
        include_domains: [
          "who.int",
          "ncbi.nlm.nih.gov",
          "pediatrics.aappublications.org",
          "indianpediatrics.net",
          "icmr.gov.in",
          "iapindia.org",
          "thelancet.com",
          "pubmed.ncbi.nlm.nih.gov",
        ],
      }),
    });

    if (!tavilyResponse.ok) {
      const errText = await tavilyResponse.text();
      console.error("Tavily error:", tavilyResponse.status, errText);
      return new Response(JSON.stringify({ error: "Research enrichment failed", details: errText }), {
        status: tavilyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await tavilyResponse.json();
    const answer = data.answer || "";
    const results = data.results || [];

    // Build structured research text from Tavily results
    const patternList = topPatterns.map((p: any, i: number) =>
      `${i + 1}. **${p.title}**: ${p.description}`
    ).join("\n\n");

    const researchSummary = answer
      ? `**Research Summary for ${childData_label(childAge, childGender, ndContext)}:**\n\n${answer}\n\n**Key Patterns Analyzed:**\n${patternList}`
      : `**Evidence-Based Findings:**\n\n${patternList}\n\n${results.slice(0, 3).map((r: any) => `• ${r.title}: ${r.content?.slice(0, 200)}...`).join("\n\n")}`;

    const citations = results.map((r: any) => r.url).filter(Boolean);

    const result = {
      research: researchSummary,
      citations,
      model: "tavily-advanced",
      patternCount: topPatterns.length,
      generatedAt: new Date().toISOString(),
    };

    // ─── Write to cache (non-blocking — fire and forget) ──────────────────
    setCached(serviceClient, cacheKey, "tavily_research", result, CACHE_TTL_DAYS);
    // ─────────────────────────────────────────────────────────────────────

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Tavily research error:", error);
    return new Response(JSON.stringify({ error: error.message || "Research failed" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function childData_label(age: number, gender: string, ndContext: string): string {
  return `${age}-year-old ${gender}${ndContext}`;
}
