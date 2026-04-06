import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, tavilySearchParallel, extractCitations, buildSearchContext } from "../_shared/tavily-search.ts";
import { getLocale } from "../_shared/locale-config.ts";

// DB-backed cache TTL (30 min)
const CACHE_TTL_MS = 30 * 60 * 1000;

async function getDbCache(supabase: any, cacheKey: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();
    if (data && Date.now() - new Date(data.cached_at).getTime() < CACHE_TTL_MS) {
      return data.data;
    }
  } catch { /* miss */ }
  return null;
}

async function setDbCache(supabase: any, cacheKey: string, data: any): Promise<void> {
  try {
    await supabase.from("enrichment_cache").upsert(
      { cache_key: cacheKey, data, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    );
  } catch (e) { console.warn("[live-market] Cache write failed:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { role, industry, metroTier, scanId, country } = await req.json();
    const locale = getLocale(country);

    if (!role && !industry) {
      return new Response(
        JSON.stringify({ error: "role or industry required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // DB-backed cache check
    const cacheKey = `lm:${(role || '')}_${(industry || '')}_${(metroTier || '')}_${locale.code}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await getDbCache(supabase, cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ...cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "APIs not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const primaryRole = (role || industry || "software engineer")
      .split(/[,&\/]+/)[0]
      .replace(/\b(professional|specialist|expert|consultant)\b/gi, '')
      .trim() || "software engineer";
    
    const tier = metroTier === "tier2" ? locale.tier2SearchString : locale.tier1SearchString;

    // ═══ TRIPLE-SOURCE: Tavily (primary) + Firecrawl + Perplexity fallback ═══
    const [tavilyResults, firecrawlArticles] = await Promise.all([
      // SOURCE 1: Tavily (PRIMARY)
      tavilySearchParallel([
        {
          query: `"${primaryRole}" ${locale.salarySearchTerms} 2025 2026 ${tier}`,
          maxResults: 5,
          days: 30,
          topic: "general",
        },
        {
          query: `"${primaryRole}" hiring jobs demand ${locale.label} AI automation impact ${industry || ''}`,
          maxResults: 5,
          days: 14,
          topic: "news",
        },
      ]),

      // SOURCE 2: Firecrawl web search
      FIRECRAWL_API_KEY ? (async () => {
        try {
          const queries = [
            `"${primaryRole}" ${locale.salarySearchTerms} 2025 2026`,
            `"${primaryRole}" jobs hiring ${locale.label} linkedin ${locale.jobBoards[0] || ''} ${tier}`,
          ];
          const searchResults = await Promise.all(
            queries.map((query) =>
              fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, limit: 5, lang: locale.searchLang, country: locale.searchCountry, tbs: "qdr:m" }),
              }).then((r) => r.ok ? r.json() : null).catch(() => null)
            )
          );
          const articles: string[] = [];
          for (const result of searchResults) {
            if (!result?.data) continue;
            for (const item of result.data) {
              if (item.title || item.description) {
                articles.push(`${item.title}: ${item.description || ""}`);
              }
            }
          }
          return articles;
        } catch (e) {
          console.error("[live-market] Firecrawl error:", e);
          return [];
        }
      })() : Promise.resolve([]),
    ]);

    // Merge all search context
    const tavilyAllResults = tavilyResults.flatMap((r) => r?.results || []);
    const tavilyContext = buildSearchContext(tavilyAllResults, 15);
    const tavilyAnswers = tavilyResults
      .filter((r) => r?.answer)
      .map((r) => r!.answer)
      .join("\n");
    const allCitations = extractCitations(tavilyAllResults);

    // If all sources failed
    if (tavilyAllResults.length === 0 && firecrawlArticles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No market data found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══ SYNTHESIZE: Merge all sources via Gemini ═══
    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Extract real job market data from the provided search results for the role "${primaryRole}" in ${locale.label}.
IMPORTANT: This person's actual role is "${primaryRole}" in ${industry || 'technology'} — focus salary data and market analysis on THIS specific role level.
You have search-grounded data from multiple sources. Cross-validate for accuracy.
Salary should be in ${locale.salaryUnit}. Use ${locale.currency} as the currency.
Return ONLY valid JSON:
{
  "salary_range_lpa": { "min": number, "max": number, "median": number },
  "job_postings_trend": "growing" | "declining" | "stable",
  "posting_change_pct": number (estimated YoY change),
  "ai_disruption_level": "LOW" | "MEDIUM" | "HIGH",
  "key_findings": [string] (3-5 key data points found),
  "top_hiring_companies": [string] (up to 5),
  "in_demand_skills": [string] (up to 5 most mentioned),
  "data_confidence": "high" | "medium" | "low"
}
Base ONLY on the provided data. No markdown.`,
          },
          {
            role: "user",
            content: `Market data for ${primaryRole} in ${metroTier === "tier2" ? locale.tier2Label + " " + locale.label + " cities" : locale.tier1Label + " " + locale.label + " metros"}:\n\n--- TAVILY SEARCH RESULTS ---\n${tavilyContext}\n\n--- TAVILY ANSWERS ---\n${tavilyAnswers}\n\n--- FIRECRAWL ARTICLES ---\n${firecrawlArticles.slice(0, 10).join("\n\n")}`,
          },
        ],
        temperature: 0.2,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!aiResp.ok) {
      return new Response(
        JSON.stringify({ error: "AI synthesis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content;

    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      const result = {
        ...parsed,
        articles_analyzed: tavilyAllResults.length + firecrawlArticles.length,
        source: "tavily_firecrawl_gemini",
        data_sources: {
          tavily: tavilyAllResults.length > 0,
          firecrawl: firecrawlArticles.length > 0,
          tavily_results_count: tavilyAllResults.length,
        },
        citations: allCitations.slice(0, 8),
      };
      setDbCache(supabase, cacheKey, result).catch(() => {});
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Parse failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[live-market] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
