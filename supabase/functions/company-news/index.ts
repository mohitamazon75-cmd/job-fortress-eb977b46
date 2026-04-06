import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, extractCitations, buildSearchContext } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

// Simple in-memory cache per company (5 min TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { company, industry, role, skills, scanId } = await req.json();

    if (!company) {
      return new Response(
        JSON.stringify({ error: "company is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User-scoped cache key includes scanId + role
    const cacheKey = `${company}_${industry || ""}_${role || ""}_${scanId || ''}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ news: [], error: "APIs not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exactCompany = `"${company}"`;
    const industryTag = industry ? ` ${industry}` : "";
    const now = new Date();
    const currentMonth = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    // ═══ DUAL-SOURCE: Tavily (primary) + Firecrawl in parallel ═══
    const [tavilyResult, firecrawlResults] = await Promise.all([
      // SOURCE 1: Tavily (PRIMARY) — last 14 days for maximum freshness
      tavilySearch({
        query: `${exactCompany}${industryTag} AI automation technology strategy hiring layoffs ${currentMonth}`,
        maxResults: 8,
        days: 14,
        topic: "news",
        includeAnswer: true,
      }),

      // SOURCE 2: Firecrawl web search
      FIRECRAWL_API_KEY ? (async () => {
        try {
          const queries = [
            `${exactCompany}${industryTag} AI automation technology strategy ${currentMonth}`,
            `${exactCompany} employees hiring layoffs artificial intelligence`,
          ];
          const results = await Promise.all(
            queries.map((query) =>
              fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, limit: 5, lang: "en", tbs: "qdr:w" }),
              }).then((r) => r.ok ? r.json() : null).catch(() => null)
            )
          );
          const articles: string[] = [];
          const sourceUrls: string[] = [];
          const companyLower = company.toLowerCase().replace(/[-_\s.]+/g, "");
          for (const result of results) {
            if (!result?.data) continue;
            for (const item of result.data) {
              if (!item.title) continue;
              const textToCheck = `${item.title} ${item.description || ""} ${item.url || ""}`.toLowerCase().replace(/[-_\s.]+/g, "");
              const companyTokens = companyLower.replace(/global|india|pvt|ltd|inc|corp|technologies|solutions/gi, "").trim();
              if (companyTokens.length >= 3 && !textToCheck.includes(companyTokens)) continue;
              articles.push(`${item.title}: ${item.description || ""}`);
              if (item.url) sourceUrls.push(item.url);
            }
          }
          return { articles, sourceUrls };
        } catch (e) {
          console.error("[company-news] Firecrawl error:", e);
          return { articles: [], sourceUrls: [] };
        }
      })() : Promise.resolve({ articles: [] as string[], sourceUrls: [] as string[] }),
    ]);

    const firecrawlArticles = firecrawlResults.articles;
    const firecrawlUrls = firecrawlResults.sourceUrls;
    const tavilyContext = tavilyResult ? buildSearchContext(tavilyResult.results, 10) : "";
    const tavilyCitations = tavilyResult ? extractCitations(tavilyResult.results) : [];
    const tavilyAnswer = tavilyResult?.answer || "";

    // If both sources returned nothing, use SEARCH-GROUNDED industry fallback
    if (firecrawlArticles.length === 0 && (!tavilyResult || tavilyResult.results.length === 0)) {
      const fallbackResult = await generateIndustryFallback(
        LOVABLE_API_KEY, company, industry || "Technology", role, skills, corsHeaders
      );
      cache.set(cacheKey, { data: fallbackResult, ts: Date.now() });
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ SYNTHESIZE: Merge Tavily + Firecrawl via Gemini ═══
    const roleContext = role ? `\nThe employee viewing this works as: ${role}` : "";
    const skillsContext = skills?.length ? `\nTheir key skills: ${skills.slice(0, 5).join(", ")}` : "";

    const ai1Ctrl = new AbortController();
    const ai1T = setTimeout(() => ai1Ctrl.abort(), 30_000);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ai1Ctrl.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You analyze real news about a SPECIFIC company's AI strategy and its impact on employees.
Today's date: ${now.toISOString().split("T")[0]}.

CRITICAL RULES:
1. ONLY include news that is ACTUALLY about "${company}". Do NOT confuse with similarly-named companies.
2. Every headline must explicitly reference "${company}" or its exact business.
3. If an article is about a DIFFERENT company, EXCLUDE it entirely.
4. Personalize the "skill_impact" to the viewer's specific skills: ${skills?.slice(0, 5).join(", ") || "general"}.
5. You have search-grounded data from the last 2 weeks. Cross-validate and use the most accurate information.
6. Each news item MUST include "date_signal" — the approximate date from the source (e.g. "Feb 2026", "Last week").

Return ONLY a JSON object:
{
  "news": [
    {
      "headline": "concise headline under 80 chars — must be about ${company}",
      "summary": "2-3 sentences explaining impact on ${role || "employees"} specifically, referencing their skills where relevant",
      "impact": "positive" | "negative" | "neutral",
      "relevance": "high" | "medium",
      "skill_impact": "which of the employee's specific skills this affects (or null)",
      "date_signal": "approximate date from source"
    }
  ],
  "ai_readiness_signal": "1-2 sentence assessment of how ${company} specifically is adopting AI — be specific about tools/initiatives mentioned in sources",
  "employee_risk_level": "LOW" | "MEDIUM" | "HIGH"
}
Maximum 5 news items. No markdown.`,
          },
          {
            role: "user",
            content: `Company: ${company}${industry ? ` (${industry})` : ""}${roleContext}${skillsContext}\n\n--- TAVILY SEARCH RESULTS (last 14 days) ---\n${tavilyContext}\n\nTavily Summary: ${tavilyAnswer}\n\n--- FIRECRAWL ARTICLES ---\n${firecrawlArticles.slice(0, 10).join("\n\n")}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    clearTimeout(ai1T);

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 402 || status === 429) {
        return new Response(
          JSON.stringify({ news: [], error: status === 402 ? "AI credits exhausted" : "Rate limited", rate_limited: true }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ news: [], error: "AI synthesis failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    logTokenUsage("company-news", "main", "google/gemini-3-flash-preview", aiData);
    const content = aiData.choices?.[0]?.message?.content;

    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      const allSources = [
        ...tavilyCitations.slice(0, 5),
        ...firecrawlUrls.slice(0, 5),
      ];
      const result = {
        ...parsed,
        sources: [...new Set(allSources)],
        fetched_at: now.toISOString(),
        data_sources: {
          tavily: (tavilyResult?.results?.length || 0) > 0,
          firecrawl: firecrawlArticles.length > 0,
          tavily_results_count: tavilyResult?.results?.length || 0,
        },
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ news: [], error: "Parse failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[company-news] error:", error);
    return new Response(
      JSON.stringify({ news: [], error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback: SEARCH-GROUNDED industry intelligence when no company-specific news found
async function generateIndustryFallback(
  apiKey: string,
  company: string,
  industry: string,
  role: string | undefined,
  skills: string[] | undefined,
  corsHeaders: Record<string, string>
): Promise<any> {
  const now = new Date();
  const currentMonth = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Search for industry-level AI news first — DON'T generate from thin air
  const industrySearch = await tavilySearch({
    query: `${industry} industry AI automation impact employees jobs ${currentMonth}`,
    maxResults: 6,
    days: 14,
    topic: "news",
    includeAnswer: true,
  });

  const searchContext = industrySearch ? buildSearchContext(industrySearch.results, 8) : "";
  const citations = industrySearch ? extractCitations(industrySearch.results) : [];
  const searchAnswer = industrySearch?.answer || "";
  const hasSearchData = searchContext.length > 0;

  const roleCtx = role ? `working as a ${role}` : "";
  const skillCtx = skills?.length ? `with skills in ${skills.slice(0, 5).join(", ")}` : "";

  const ai2Ctrl = new AbortController();
  const ai2T = setTimeout(() => ai2Ctrl.abort(), 30_000);
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You provide AI industry intelligence for an employee at "${company}" in ${industry} ${roleCtx} ${skillCtx}.
Today's date: ${now.toISOString().split("T")[0]}.
${hasSearchData ? "You have REAL search results from the last 2 weeks. Base your analysis ONLY on these." : "No search data available. Be honest and generic."}

RULES:
- Do NOT make up news about "${company}" specifically
- Focus on ${industry} industry AI trends that would affect someone ${roleCtx}
- ${hasSearchData ? "Ground every headline in the search results provided" : "Only state well-known, verifiable trends"}
- Personalize skill_impact to: ${skills?.slice(0, 5).join(", ") || "general skills"}
- Include date_signal for each item

Return ONLY JSON:
{
  "news": [
    {
      "headline": "industry trend headline under 80 chars",
      "summary": "2-3 sentences personalized to ${role || "professional"}'s skills",
      "impact": "positive" | "negative" | "neutral",
      "relevance": "high" | "medium",
      "skill_impact": "which specific skill this affects or null",
      "date_signal": "approximate date"
    }
  ],
  "ai_readiness_signal": "Assessment of ${industry} industry AI adoption trends",
  "employee_risk_level": "LOW" | "MEDIUM" | "HIGH",
  "is_industry_level": true
}
Maximum 4 items. No markdown.`,
        },
        {
          role: "user",
          content: hasSearchData
            ? `Generate ${industry} AI industry insights for a ${role || "professional"} at ${company}${skillCtx ? ` ${skillCtx}` : ""}.\n\n--- SEARCH RESULTS (last 14 days) ---\n${searchContext}\n\nSummary: ${searchAnswer}`
            : `Generate ${industry} AI industry insights for a ${role || "professional"} at ${company}${skillCtx ? ` ${skillCtx}` : ""}.`,
        },
      ],
      temperature: 0.3,
    }),
    signal: ai2Ctrl.signal,
  });
  clearTimeout(ai2T);

  if (!aiResp.ok) {
    return { news: [], sources: [], is_industry_level: true, fetched_at: now.toISOString() };
  }

  const data = await aiResp.json();
  logTokenUsage("company-news", "industry", "google/gemini-3-flash-preview", data);
  const content = data.choices?.[0]?.message?.content;
  try {
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return {
      ...JSON.parse(jsonStr),
      sources: citations,
      fetched_at: now.toISOString(),
      search_grounded: hasSearchData,
    };
  } catch {
    return { news: [], sources: [], is_industry_level: true, fetched_at: now.toISOString() };
  }
}
