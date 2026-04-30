import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { logEdgeError, trackUsage } from "../_shared/edge-logger.ts";
import { setCurrentScanId, clearCurrentScanId } from "../_shared/cost-logger.ts";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { role, judo_tool, industry, scanId } = await req.json();
    // Attribute downstream cost_event rows to this scan for /admin/costs.
    if (typeof scanId === "string" && scanId.length > 0) setCurrentScanId(scanId);

    if (!judo_tool) {
      return new Response(
        JSON.stringify({ error: "judo_tool required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User-scoped cache key includes scanId
    const cacheKey = `${role}_${judo_tool}_${industry}_${scanId || ''}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // ═══ STEP 1: Tavily Search (PRIMARY) ═══
    const tavilyResult = await tavilySearch({
      query: `${judo_tool} tutorial course ${role || "professional"} ${industry || "technology"} India 2026`,
      maxResults: 5,
      days: 60,
      includeAnswer: true,
    });

    const searchContext = tavilyResult
      ? tavilyResult.results.map((r) => `${r.title}: ${r.content}`).join("\n\n")
      : "";
    const tavilyAnswer = tavilyResult?.answer || "";
    const citations = tavilyResult
      ? tavilyResult.results.map((r) => r.url).filter(Boolean).slice(0, 5)
      : [];

    // ═══ STEP 2: Synthesize via Gemini ═══
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasSearchData = searchContext.length > 0;

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
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a career intelligence agent. Generate insights about "${judo_tool}" for a "${role || 'professional'}" in ${industry || 'technology'}.
${hasSearchData ? "Use the provided real-time search results to ground your response." : "CRITICAL: Do NOT generate URLs — you will hallucinate them. Leave url as empty string."}
Return ONLY valid JSON (no markdown, no code fences):
{"news":"One sentence about a recent development","tutorial":{"title":"${hasSearchData ? 'Real tutorial title from search' : 'Search YouTube for: [query]'}","url":"${hasSearchData ? 'real URL from search results' : ''}","platform":"YouTube"},"market_signal":"One sentence about adoption trends in India","weekly_tip":"One actionable tip"}`,
          },
          {
            role: "user",
            content: hasSearchData
              ? `Based on these search results, generate career intelligence about ${judo_tool}:\n\n${searchContext}\n\nSummary: ${tavilyAnswer}\n\nFor ${role || 'professionals'} in India's ${industry || 'technology'} sector.`
              : `Generate career intelligence about ${judo_tool} for ${role || 'professionals'} in India's ${industry || 'technology'} sector.`,
          },
        ],
        temperature: 0.3,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!aiResp.ok) {
      const status = aiResp.status;
      console.error("[fetch-weekly-intel] AI failed:", status);
      if (status === 402 || status === 429) {
        return new Response(
          JSON.stringify({ error: status === 402 ? "AI credits exhausted" : "Rate limited", rate_limited: true }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI synthesis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    try {
      let jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      if (!jsonStr.endsWith("}")) {
        const lastBrace = jsonStr.lastIndexOf("}");
        if (lastBrace > 0) jsonStr = jsonStr.slice(0, lastBrace + 1);
      }
      const parsed = JSON.parse(jsonStr);
      const result = {
        ...parsed,
        source: hasSearchData ? "tavily_gemini" : "gemini_no_search",
        citations,
        fetched_at: new Date().toISOString(),
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      const fallback = {
        news: `${judo_tool} continues to gain traction in ${industry || 'technology'} sector.`,
        tutorial: { title: `Search YouTube for: ${judo_tool} tutorial 2026`, url: "", platform: "YouTube" },
        market_signal: `${judo_tool} adoption is growing across Indian enterprises.`,
        weekly_tip: `Explore ${judo_tool} documentation and try one hands-on exercise this week.`,
        source: "fallback",
        fetched_at: new Date().toISOString(),
      };
      cache.set(cacheKey, { data: fallback, ts: Date.now() });
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[fetch-weekly-intel] error:", error);
    logEdgeError({ functionName: "fetch-weekly-intel", errorMessage: String(error), errorCode: "UNHANDLED" }).catch(() => {});
    trackUsage("fetch-weekly-intel", true).catch(() => {});
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    clearCurrentScanId();
  }
});
