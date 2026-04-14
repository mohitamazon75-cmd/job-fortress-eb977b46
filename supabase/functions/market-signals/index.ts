import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, tavilySearchParallel, extractCitations, buildSearchContext } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { getLocale } from "../_shared/locale-config.ts";
import { fetchHNSignals, fetchStackQuestions, fetchGitHubTrending, buildCommunityContext } from "../_shared/community-signals.ts";
import { enrichUrlsWithJina } from "../_shared/jina-reader.ts";
import { enrichRoleWithOnet } from "../_shared/onet-client.ts";

// Consolidated market signals cache TTL (varies by signal type)
const CACHE_TTL_MS = {
  enrich: 6 * 60 * 60 * 1000,    // 6 hours
  market: 30 * 60 * 1000,        // 30 minutes
  news: 60 * 60 * 1000,          // 1 hour
  intel: 24 * 60 * 60 * 1000,    // 24 hours
  landscape: 24 * 60 * 60 * 1000, // 24 hours
  company: 60 * 60 * 1000,       // 1 hour
};

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

async function checkRateLimit(ip: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  try {
    const { count, error } = await supabase
      .from("scan_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", ip)
      .gte("created_at", windowStart);
    if (error) {
      console.error("[market-signals RateLimit] DB check failed, blocking (fail-closed):", error.message);
      return false;
    }
    if ((count ?? 0) >= RATE_LIMIT) return false;
    await supabase.from("scan_rate_limits").insert({ client_ip: ip });
    return true;
  } catch (err) {
    console.error("[market-signals RateLimit] Exception, blocking (fail-closed):", err);
    return false;
  }
}

async function getDbCache(supabase: any, cacheKey: string, ttlMs: number): Promise<any | null> {
  try {
    const { data } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();
    if (data && Date.now() - new Date(data.cached_at).getTime() < ttlMs) {
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
  } catch (e) { console.warn("[market-signals] Cache write failed:", e); }
}

// Handle enrich signal (replaces live-enrich)
async function handleEnrich(req: any, corsHeaders: any, supabase: any, body: any, locale: any) {
  const { role, industry, skills, moatSkills, pivotRoles, yearsExperience, company, country } = body;

  if (!role) {
    return new Response(
      JSON.stringify({ error: "role is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const skillsHash = (skills || []).slice(0, 3).join('_').toLowerCase();
  const cacheKey = `ms_enrich:${role}_${industry}_${skillsHash}_${company || ''}_${locale.code}`.toLowerCase().replace(/\s+/g, '_');

  // Check cache
  const cached = await getDbCache(supabase, cacheKey, CACHE_TTL_MS.enrich);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "APIs not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const skillsList = (skills || []).slice(0, 8).join(", ");
  const pivotsList = (pivotRoles || []).slice(0, 3).join(", ");
  const expContext = yearsExperience ? `with ${yearsExperience} years of experience` : '';
  const companyContext = company ? `currently at ${company}` : '';

  const [tavilyThreats, tavilyResources, tavilyPivots, tavilyMarketDepth] = await Promise.all([
    tavilySearch({
      query: `${role} AI tools automation replacing tasks ${industry || "technology"} ${locale.label} 2026 ${skillsList}`,
      maxResults: 8,
      days: 30,
      topic: "news",
      includeAnswer: true,
    }),
    tavilySearch({
      query: `best books courses videos for ${role} ${industry || "technology"} AI upskilling ${skillsList} advanced 2026`,
      maxResults: 8,
      days: 90,
      includeAnswer: true,
    }),
    tavilySearch({
      query: `${pivotsList || "AI-augmented " + role} jobs hiring ${locale.label} salary demand ${expContext} ${industry || "technology"}`,
      maxResults: 8,
      days: 30,
      topic: "news",
      includeAnswer: true,
    }),
    tavilySearch({
      query: `${role} ${industry || "technology"} layoffs hiring trends salary benchmark ${locale.label} 2026 ${company || ""}`,
      maxResults: 5,
      days: 14,
      topic: "news",
      includeAnswer: true,
    }),
  ]);

  // O*NET enrichment — real government occupation data (needs ONET_USERNAME + ONET_PASSWORD env vars)
  const onetData = await enrichRoleWithOnet(role, {
    username: Deno.env.get("ONET_USERNAME"),
    password: Deno.env.get("ONET_PASSWORD"),
  }).catch(() => null);

  const onetContext = onetData
    ? `\nO*NET OFFICIAL OCCUPATION DATA (US Dept of Labor):
  Occupation: ${onetData.occupation_title} (${onetData.occupation_code})
  Hot Technologies in this field: ${onetData.hot_technologies.join(", ") || "None listed"}
  Top skills by importance: ${onetData.top_skills.join(", ") || "None listed"}`
    : "";

  const queries = [
    {
      role: "system",
      content: `You are a career technology analyst specializing in AI disruption in ${locale.label}. Return ONLY valid JSON, no markdown.

CONTEXT:
- Role: ${role} ${expContext} ${companyContext} in ${industry || 'technology'}
- Skills: ${skillsList}
- Moat skills: ${(moatSkills || []).join(", ")}${onetContext}

Using the search results provided, identify what AI tools are currently replacing THIS person's specific tasks.

Return JSON:
{
  "tool_threats": [
    { "tool_name": string, "automates": string (reference THEIR specific tasks), "adoption": "Mainstream"|"Growing"|"Early", "evidence": string (from search results) }
  ],
  "threat_summary": string (2 sentences: first names most at-risk skill, second gives timeline and action)
}`
    },
    {
      role: "system",
      content: `You are a career development advisor for ${locale.label} professionals. Return ONLY valid JSON, no markdown.

CONTEXT:
- Role: ${role} ${expContext} in ${industry || 'technology'}
${companyContext ? `- Company: ${company}` : ''}
- Current skills: ${skillsList}
- Moat skills: ${(moatSkills || []).join(", ")}
- Pivot toward: ${pivotsList || 'AI-augmented ' + role}${onetContext}

Using the search results, recommend REAL resources. For ${expContext || '5+ years'}, recommend ADVANCED resources.
Each "why_relevant" must explain why THIS resource matters for THEIR situation.

Return JSON:
{
  "books": [{ "title": string, "author": string, "year": number, "why_relevant": string }],
  "courses": [{ "title": string, "platform": string, "why_relevant": string }],
  "videos": [{ "title": string, "channel": string, "why_relevant": string }]
}
Provide exactly 4 books, 4 courses, 4 videos. ALL must be REAL.`
    },
    {
      role: "system",
      content: `You are a ${locale.label} job market analyst. Return ONLY valid JSON, no markdown.

CONTEXT:
- Current role: ${role} ${expContext} ${companyContext}
- Industry: ${industry || 'technology'}
- Skills: ${skillsList}
- Proposed pivots: ${pivotsList || 'AI-augmented ' + role}${onetContext}

Using the search results, validate these career pivots with real market data.

Return JSON:
{
  "pivot_validation": [
    {
      "role": string,
      "is_viable": boolean,
      "active_postings_estimate": string,
      "salary_range": string (in ${locale.salaryUnit}),
      "top_companies_hiring": [string],
      "evidence": string (from search results),
      "skill_transfer": string
    }
  ]
}`
    }
  ];

  async function callAI(systemMsg: any, searchResult: any, idx: number) {
    if (!LOVABLE_API_KEY) return null;

    const context = searchResult ? buildSearchContext(searchResult.results, 15) : "";
    const answer = searchResult?.answer || "";
    const marketDepthContext = tavilyMarketDepth ? `\n\nAdditional market context:\n${buildSearchContext(tavilyMarketDepth.results, 5)}\nMarket summary: ${tavilyMarketDepth.answer || ""}` : "";
    const userContent = idx === 0
      ? `Based on these search results, what AI tools threaten a ${role} with skills in ${skillsList}?\n\n${context}\n\nSummary: ${answer}${marketDepthContext}`
      : idx === 1
      ? `Based on these search results, recommend resources for a ${role} to upskill:\n\n${context}\n\nSummary: ${answer}`
      : `Based on these search results, validate pivots for a ${role} with ${skillsList}:\n\n${context}\n\nSummary: ${answer}${marketDepthContext}`;

    try {
      const ms1Ctrl = new AbortController();
      const ms1T = setTimeout(() => ms1Ctrl.abort(), 30_000);
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ms1Ctrl.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [systemMsg, { role: "user", content: userContent }],
          temperature: 0.1,
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });
      clearTimeout(ms1T);

      if (resp.ok) {
        const data = await resp.json();
        logTokenUsage("market-signals[enrich]", `query-${idx}`, "google/gemini-3-flash-preview", data);
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            const citations = searchResult ? extractCitations(searchResult.results) : [];
            return { parsed, citations };
          } catch (e) {
            console.error(`[market-signals] Query ${idx} JSON parse failed:`, e);
          }
        }
      } else {
        console.warn(`[market-signals] Query ${idx} AI failed: ${resp.status}`);
      }
    } catch (e: any) {
      console.error(`[market-signals] Query ${idx} error:`, e.message);
    }

    return null;
  }

  const results = await Promise.all([
    callAI(queries[0], tavilyThreats, 0),
    callAI(queries[1], tavilyResources, 1),
    callAI(queries[2], tavilyPivots, 2),
  ]);

  const courses = results[1]?.parsed?.courses || [];
  const books = (results[1]?.parsed?.books || []).map((b: any) => ({
    ...b,
    url: `https://www.${locale.amazonDomain}/s?k=${encodeURIComponent(`${b.title} ${b.author || ''}`)}`,
  }));
  const fixedCourses = courses.map((c: any) => ({
    ...c,
    url: `https://www.google.com/search?q=${encodeURIComponent(`${c.title} ${c.platform || ''} course`)}`,
  }));
  const videos = (results[1]?.parsed?.videos || []).map((v: any) => ({
    ...v,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${v.title} ${v.channel || ''}`)}`,
  }));

  const enrichment = {
    tool_threats: results[0]?.parsed?.tool_threats || [],
    threat_summary: results[0]?.parsed?.threat_summary || null,
    threat_citations: results[0]?.citations || [],
    books,
    courses: fixedCourses,
    videos,
    resource_citations: results[1]?.citations || [],
    pivot_validation: results[2]?.parsed?.pivot_validation || [],
    pivot_citations: results[2]?.citations || [],
    enriched_at: new Date().toISOString(),
    source: "tavily_gemini",
  };

  setDbCache(supabase, cacheKey, enrichment).catch(() => {});

  return new Response(JSON.stringify(enrichment), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle market signal (replaces live-market)
async function handleMarket(req: any, corsHeaders: any, supabase: any, body: any, locale: any) {
  const { role, industry, metroTier, scanId, country } = body;

  if (!role && !industry) {
    return new Response(
      JSON.stringify({ error: "role or industry required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const cacheKey = `ms_market:${(role || '')}_${(industry || '')}_${(metroTier || '')}_${locale.code}`.toLowerCase().replace(/\s+/g, '_');
  const cached = await getDbCache(supabase, cacheKey, CACHE_TTL_MS.market);
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

  const [tavilyResults, firecrawlArticles] = await Promise.all([
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
        console.error("[market-signals] Firecrawl error:", e);
        return [];
      }
    })() : Promise.resolve([]),
  ]);

  const tavilyAllResults = tavilyResults.flatMap((r) => r?.results || []);
  const tavilyContext = buildSearchContext(tavilyAllResults, 15);
  const tavilyAnswers = tavilyResults
    .filter((r) => r?.answer)
    .map((r) => r!.answer)
    .join("\n");
  const allCitations = extractCitations(tavilyAllResults);

  if (tavilyAllResults.length === 0 && firecrawlArticles.length === 0) {
    return new Response(
      JSON.stringify({ error: "No market data found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const ms2Ctrl = new AbortController();
  const ms2T = setTimeout(() => ms2Ctrl.abort(), 30_000);
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ms2Ctrl.signal,
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
  });
  clearTimeout(ms2T);

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
    // Count actual search results from Tavily as a proxy for job demand
    const posting_volume_proxy = tavilyAllResults.length ?? 0;
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
      market_signals_source: "tavily_search",
      posting_volume_proxy,
      posting_volume_source: "search_result_count",
      posting_volume_note: "Based on web search result count — not a live job board count",
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
}

// Handle news signal (replaces live-news)
async function handleNews(corsHeaders: any, supabase: any, locale: any) {
  const CACHE_KEY = "live-news-headlines";
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Check DB cache
  const cached = await getDbCache(supabase, CACHE_KEY, CACHE_TTL_MS.news);
  if (cached && cached.headlines) {
    return new Response(JSON.stringify({ headlines: cached.headlines, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!FIRECRAWL_API_KEY || !LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Firecrawl search for real news
  const searchQueries = [
    "AI jobs India layoffs hiring 2026",
    "TCS Infosys Wipro AI automation employees",
    "AI replacing jobs India salary trends",
    "artificial intelligence impact Indian IT industry",
  ];

  const searchPromises = searchQueries.map((query) =>
    fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        lang: "en",
        country: "in",
        tbs: "qdr:w",
      }),
    }).then((r) => r.ok ? r.json() : null).catch(() => null)
  );

  const searchResults = await Promise.all(searchPromises);
  const rawArticles: string[] = [];
  for (const result of searchResults) {
    if (!result?.data) continue;
    for (const item of result.data) {
      if (item.title || item.description) {
        rawArticles.push(`${item.title || ""} — ${item.description || ""} (${item.url || ""})`);
      }
    }
  }

  // If Firecrawl returned fewer than 3 articles, supplement with Jina-fetched content
  if (rawArticles.length < 3) {
    try {
      const supplementUrls = [
        "https://economictimes.indiatimes.com/tech/technology/ai-automation-india-jobs",
        "https://timesofindia.indiatimes.com/technology/ai-jobs-india",
      ].slice(0, 3 - rawArticles.length);

      const jinaResults = await enrichUrlsWithJina(supplementUrls, { timeoutMs: 6000, maxChars: 2000 });
      const jinaArticles = jinaResults
        .filter(r => r.success && r.content.length > 100)
        .map(r => ({ title: r.title || r.url, content: r.content, url: r.url }));

      // Convert jina articles to rawArticles format
      for (const article of jinaArticles) {
        if (article.content) {
          rawArticles.push(`${article.title || "Article"} — ${article.content.substring(0, 200)}... (${article.url || ""})`);
        }
      }
    } catch (e) {
      console.warn("[market-signals] Jina supplemental fetch failed:", e);
    }
  }

  if (rawArticles.length === 0) {
    const headlines = await geminiOnlyHeadlines(LOVABLE_API_KEY);
    if (headlines) {
      setDbCache(supabase, CACHE_KEY, { headlines }).catch(() => {});
      return new Response(JSON.stringify({ headlines, cached: false, source: "ai_only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Gemini synthesizes articles into headlines
  const today = new Date().toISOString().split("T")[0];
  const ms3Ctrl = new AbortController();
  const ms3T = setTimeout(() => ms3Ctrl.abort(), 30_000);
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ms3Ctrl.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a news editor for a Bloomberg/Reuters-style AI & Jobs ticker. Extract 16 concise ticker headlines from real search results.
RULES:
- Base headlines on ACTUAL articles provided. Do NOT fabricate.
- If an article mentions a specific company, number, or statistic, USE IT.
- Each headline under 100 characters.
- Add emoji prefix: 🔴 for bad news, ✅ for positive, 📊/🇮🇳/📈 for neutral
- Focus on India-relevant news.
- If you don't have 16 from articles, supplement with 2-3 based on real trends (clearly grounded).
Today: ${today}
Return ONLY a JSON array: [{"text": "emoji headline", "type": "good"|"bad"|"neutral"}]
No markdown.`,
        },
        {
          role: "user",
          content: `Synthesize 16 ticker headlines from these ${rawArticles.length} real news articles:\n\n${rawArticles.slice(0, 20).join("\n\n")}`,
        },
      ],
      temperature: 0.3,
    }),
  });
  clearTimeout(ms3T);

  if (!aiResponse.ok) {
    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiData = await aiResponse.json();
  logTokenUsage("market-signals[news]", "headlines", "google/gemini-3-flash-preview", aiData);
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const headlines = JSON.parse(jsonStr);
    if (Array.isArray(headlines) && headlines.length > 0) {
      setDbCache(supabase, CACHE_KEY, { headlines }).catch(() => {});
      return new Response(JSON.stringify({ headlines, cached: false, source: "firecrawl_gemini" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("[market-signals] news JSON parse failed:", e);
  }

  return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle intel signal (replaces career-intel)
async function handleIntel(corsHeaders: any, supabase: any, body: any, locale: any) {
  const { role, industry, skills, location, seniority, experience, country } = body;

  if (!role) {
    return new Response(
      JSON.stringify({ error: "role is required", signals: [] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const seniorityCtx = seniority || "PROFESSIONAL";
  const expCtx = experience || "";
  const skillsList = (skills || []).slice(0, 8).join(", ");
  const locationCtx = location || "Global";

  const skillHash = (skills || []).sort().join("|");
  const cacheKey = `ms_intel:${role}_${industry}_${skillHash}_${location}_${seniorityCtx}`.toLowerCase().replace(/\s+/g, "_");

  // Check cache
  const cached = await getDbCache(supabase, cacheKey, CACHE_TTL_MS.intel);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI not configured", signals: [] }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Tavily searches
  const topSkills = (skills || []).slice(0, 5).join(" OR ");
  const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const tavilyQueries = [
    { query: `"${role}" ${industry || "technology"} AI automation tools replacing ${currentMonth}`, maxResults: 5, days: 14, topic: "news" as const },
    { query: `${role} hiring demand salary trends ${industry || "technology"} ${locationCtx} ${currentMonth}`, maxResults: 5, days: 14, topic: "news" as const },
    { query: `${topSkills || role} skills demand AI tools ${industry || "technology"} 2026`, maxResults: 5, days: 30 },
  ];

  const tavilyResults = await Promise.all(
    tavilyQueries.map((q) => tavilySearch(q))
  );

  const allResults = tavilyResults.flatMap((r) => r?.results || []);
  const citations = extractCitations(allResults);
  const searchContext = buildSearchContext(allResults, 15);
  const tavilyAnswers = tavilyResults
    .filter((r) => r?.answer)
    .map((r) => r!.answer)
    .join("\n");

  // Community signals — free, no auth required
  const primarySkill = (skills || [])[0] || role;
  const [hnStories, stackQuestions, githubRepos] = await Promise.allSettled([
    fetchHNSignals(`${role} AI automation jobs`, { maxResults: 4, daysBack: 14 }),
    fetchStackQuestions(primarySkill, { maxResults: 4, daysBack: 30 }),
    fetchGitHubTrending(primarySkill, { maxResults: 4, daysBack: 30 }),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []));

  const communityCtx = buildCommunityContext(hnStories as any[], stackQuestions as any[], githubRepos as any[]);

  const systemPrompt = `You are a hyper-personalized career intelligence engine. Return ONLY valid JSON, no markdown.
Today's date: ${new Date().toISOString().split("T")[0]}.

CONTEXT:
- Role: ${role}
- Industry: ${industry || "technology"}
- Key skills: ${skillsList}
- Location: ${locationCtx}
- Seniority: ${seniorityCtx}
- Experience: ${expCtx}

Using the real-time search results provided, generate exactly 5 career signals.

CRITICAL RELEVANCE RULES:
1. Every signal MUST be directly relevant to "${role}" in "${industry || "technology"}".
2. Do NOT include generic AI signals unless ${role} specifically involves governance/compliance.
3. Each signal must reference the user's ACTUAL skills (${skillsList}).
4. The "headline" must pass: "Would a ${role} in ${industry || "technology"} care about this in daily work?" If not, exclude it.
5. Demand/salary signals must be for ${role} or closely adjacent roles.
6. Name specific tools, companies, or platforms relevant to ${role}.

${seniorityCtx === "EXECUTIVE" || seniorityCtx === "SENIOR_LEADER" ? "Frame all signals for a senior executive — P&L impact, org-level AI adoption, competitive positioning." : ""}

Return JSON:
{
  "signals": [
    {
      "category": "ai_impact" | "hiring_trend" | "skill_premium" | "hidden_opportunity" | "risk_alert",
      "icon": "🤖" | "🌍" | "🧠" | "💼" | "⚠️",
      "headline": string (max 12 words, punchy, MUST reference ${role} or their specific skills),
      "description": string (2 sentences, specific to their role and skills — mention tool names, company names, or salary figures from search results),
      "urgency": "high" | "medium" | "low"
    }
  ],
  "net_signal": string (one sentence summary specific to ${role})
}`;

  const userPrompt = `Based on these real-time search results, generate career signals:\n\n${searchContext}\n\nTavily summaries:\n${tavilyAnswers}${communityCtx ? `\n\n${communityCtx}` : ''}\n\nFor a ${role} in ${industry || "technology"} with skills in ${skillsList}, based in ${locationCtx}.`;

  const ms4Ctrl = new AbortController();
  const ms4T = setTimeout(() => ms4Ctrl.abort(), 30_000);
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ms4Ctrl.signal,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });
  clearTimeout(ms4T);

  if (!aiResp.ok) {
    return new Response(
      JSON.stringify({ error: "AI synthesis failed", signals: [] }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const aiData = await aiResp.json();
  logTokenUsage("market-signals[intel]", null, "google/gemini-3-pro-preview", aiData);
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    return new Response(
      JSON.stringify({ error: "Empty AI response", signals: [] }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let parsed;
  try {
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("[market-signals] intel JSON parse failed:", content.slice(0, 300));
    return new Response(
      JSON.stringify({ error: "Parse failed", signals: [] }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = {
    signals: parsed.signals || [],
    net_signal: parsed.net_signal || null,
    citations,
    generated_at: new Date().toISOString(),
    source: "tavily_gemini",
  };

  setDbCache(supabase, cacheKey, result).catch(() => {});

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle landscape signal (replaces career-landscape)
async function handleLandscape(corsHeaders: any, supabase: any, body: any, locale: any) {
  const { role, industry, skills, currentDI, country } = body;

  if (!role || !industry) {
    return new Response(
      JSON.stringify({ error: "role and industry required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const cacheKey = `ms_landscape:${role}_${industry}_${(skills || []).join("|")}`.toLowerCase().replace(/\s+/g, "_");
  const cached = await getDbCache(supabase, cacheKey, CACHE_TTL_MS.landscape);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const topSkills = (skills || []).slice(0, 8).join(", ");
  const geo = country || "India";

  // Parallel Tavily searches
  const searches = [
    {
      query: `best career transitions from ${role} ${industry} 2025 lateral moves`,
      maxResults: 5,
      searchDepth: "basic" as const,
      days: 90,
    },
    {
      query: `${role} transferable skills highest demand roles ${geo} 2025`,
      maxResults: 5,
      searchDepth: "basic" as const,
      days: 90,
    },
  ];

  const [transitionResults, demandResults] = await Promise.all(
    searches.map((q) => tavilySearch(q))
  );

  const transitionCtx = transitionResults ? buildSearchContext(transitionResults.results, 5) : "";
  const demandCtx = demandResults ? buildSearchContext(demandResults.results, 5) : "";
  const citations = [
    ...extractCitations(transitionResults?.results || []),
    ...extractCitations(demandResults?.results || []),
  ].slice(0, 6);

  const prompt = `You are a career transition strategist. Analyze lateral move opportunities for this professional.

CURRENT PROFILE:
- Role: ${role}
- Industry: ${industry}
- Key Skills: ${topSkills}
- Current AI Disruption Index: ${currentDI || "unknown"}% (higher = more at risk)
- Location: ${geo}

LIVE MARKET INTELLIGENCE:
${transitionCtx}

${demandCtx}

CRITICAL RULES:
1. ONLY suggest roles that are a REALISTIC lateral move — someone with these specific skills could transition within 3-6 months
2. NEVER suggest roles that are a DEMOTION (e.g., don't suggest "Analyst" to a Director, or "Coordinator" to a Manager)
3. NEVER suggest completely unrelated fields (e.g., don't suggest "Doctor" to a Software Engineer)
4. Each role MUST share at least 40% skill overlap with the current role
5. Include the user's CURRENT role as the first entry for comparison
6. Roles must exist in the ${geo} job market with real demand
7. Sort by "transition feasibility" — easiest transitions first

Return EXACTLY this JSON (no markdown, no explanation):
{
  "transitions": [
    {
      "role": "string — the role title",
      "is_current": false,
      "skill_overlap_pct": 75,
      "demand_trend": "booming|growing|stable|declining",
      "risk_level": "HIGH" | "MEDIUM" | "LOW",
      "transition_difficulty": "easy|moderate|hard",
      "why_viable": "1 sentence — what specific skills transfer and why this works",
      "salary_delta": "+15%",
      "time_to_transition": "2-4 months"
    }
  ],
  "strategy_insight": "1-2 sentence strategic recommendation for this specific person"
}

Return 6-8 transitions including the current role. Be brutally realistic — no aspirational nonsense.`;

  const ms5Ctrl = new AbortController();
  const ms5T = setTimeout(() => ms5Ctrl.abort(), 30_000);
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ms5Ctrl.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  clearTimeout(ms5T);

  if (!aiResp.ok) {
    return new Response(
      JSON.stringify({ error: "AI synthesis failed" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const aiData = await aiResp.json();
  logTokenUsage("market-signals[landscape]", null, "google/gemini-3-pro-preview", aiData);
  const raw = aiData.choices?.[0]?.message?.content || "";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return new Response(
      JSON.stringify({ error: "Failed to parse AI response" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const result = {
    ...parsed,
    citations,
    source: "gemini-3-pro + tavily",
    generated_at: new Date().toISOString(),
  };

  setDbCache(supabase, cacheKey, result).catch(() => {});

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle company signal (replaces company-news)
async function handleCompany(corsHeaders: any, supabase: any, body: any, locale: any) {
  const { company, industry, role, skills, city } = body;

  if (!company) {
    return new Response(
      JSON.stringify({ error: "company is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const cacheKey = `ms_company:${company}_${industry || ""}_${role || ""}`.toLowerCase().replace(/\s+/g, "_");
  const cached = await getDbCache(supabase, cacheKey, CACHE_TTL_MS.company);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
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

  // Dual-source: Tavily + Firecrawl
  const [tavilyResult, firecrawlResults] = await Promise.all([
    tavilySearch({
      query: `${exactCompany}${industryTag} AI automation technology strategy hiring layoffs ${currentMonth}`,
      maxResults: 8,
      days: 14,
      topic: "news",
      includeAnswer: true,
    }),

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
        console.error("[market-signals] Firecrawl error:", e);
        return { articles: [], sourceUrls: [] };
      }
    })() : Promise.resolve({ articles: [] as string[], sourceUrls: [] as string[] }),
  ]);

  const firecrawlArticles = firecrawlResults.articles;
  const firecrawlUrls = firecrawlResults.sourceUrls;
  const tavilyContext = tavilyResult ? buildSearchContext(tavilyResult.results, 10) : "";
  const tavilyCitations = tavilyResult ? extractCitations(tavilyResult.results) : [];
  const tavilyAnswer = tavilyResult?.answer || "";

  if (firecrawlArticles.length === 0 && (!tavilyResult || tavilyResult.results.length === 0)) {
    const fallbackResult = await generateCompanyFallback(LOVABLE_API_KEY, company, industry || "Technology", role, skills);
    setDbCache(supabase, cacheKey, fallbackResult).catch(() => {});
    return new Response(JSON.stringify(fallbackResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const roleContext = role ? `\nThe employee viewing this works as: ${role}` : "";
  const skillsContext = skills?.length ? `\nTheir key skills: ${skills.slice(0, 5).join(", ")}` : "";

  const ms6Ctrl = new AbortController();
  const ms6T = setTimeout(() => ms6Ctrl.abort(), 30_000);
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ms6Ctrl.signal,
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
  clearTimeout(ms6T);

  if (!aiResp.ok) {
    return new Response(
      JSON.stringify({ news: [], error: "AI synthesis failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const aiData = await aiResp.json();
  logTokenUsage("market-signals[company]", "main", "google/gemini-3-flash-preview", aiData);
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
    setDbCache(supabase, cacheKey, result).catch(() => {});
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ news: [], error: "Parse failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Helper: Fallback headlines for news signal
function getFallbackHeadlines() {
  return [
    { text: "🔴 Anthropic CEO: 'Most coding jobs will be AI-assisted within 2 years'", type: "bad" },
    { text: "📊 AI/ML job postings surging across Indian metros", type: "neutral" },
    { text: "🇮🇳 Infosys accelerating AI retraining for 250K+ employees", type: "neutral" },
    { text: "✅ AI-augmented developers commanding 40% salary premium", type: "good" },
    { text: "🔴 Legacy testing divisions face hiring freezes at top IT firms", type: "bad" },
    { text: "📈 Prompt Engineering emerging as fastest-growing role in India", type: "good" },
    { text: "⚠️ McKinsey: 12M Indian workers need reskilling by 2030", type: "bad" },
    { text: "✅ Indian AI startup funding hitting record highs", type: "good" },
    { text: "🔴 Major IT firms automating 30-40% of BPO quality checks", type: "bad" },
    { text: "📊 Nearly half of Indian IT jobs face disruption by 2028", type: "bad" },
    { text: "✅ Data Science salaries rising sharply in Tier-1 metros", type: "good" },
    { text: "⚠️ AI coding assistants replacing junior dev tasks at scale", type: "bad" },
    { text: "🇮🇳 NASSCOM: India needs 1M+ AI-skilled workers by 2027", type: "neutral" },
    { text: "🔴 Major IT firms automating 35%+ of testing workflows", type: "bad" },
    { text: "✅ AI ethics & governance roles surging across India", type: "good" },
    { text: "⚠️ Leading AI labs predict AGI could arrive before 2030", type: "bad" },
  ];
}

// Helper: Gemini-only fallback for news
async function geminiOnlyHeadlines(apiKey: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const ms7Ctrl = new AbortController();
    const ms7T = setTimeout(() => ms7Ctrl.abort(), 30_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ms7Ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Generate 16 realistic news headlines about AI's impact on jobs, focusing on India. Base on real trends you know. Today: ${today}. Return ONLY JSON array: [{"text": "emoji headline", "type": "good"|"bad"|"neutral"}]`,
          },
          { role: "user", content: "Generate 16 AI & jobs headlines." },
        ],
        temperature: 0.9,
      }),
    });
    clearTimeout(ms7T);
    if (!resp.ok) return null;
    const d = await resp.json();
    logTokenUsage("market-signals[news]", "fallback", "google/gemini-3-flash-preview", d);
    const c = d.choices?.[0]?.message?.content;
    if (!c) return null;
    const j = c.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(j);
  } catch {
    return null;
  }
}

// Helper: Company fallback generation
async function generateCompanyFallback(apiKey: string, company: string, industry: string, role: string | undefined, skills: string[] | undefined): Promise<any> {
  const now = new Date();
  const currentMonth = now.toLocaleString("en-US", { month: "long", year: "numeric" });

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

  const ms8Ctrl = new AbortController();
  const ms8T = setTimeout(() => ms8Ctrl.abort(), 30_000);
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
    signal: ms8Ctrl.signal,
  });
  clearTimeout(ms8T);

  if (!aiResp.ok) {
    return { news: [], sources: [], is_industry_level: true, fetched_at: now.toISOString() };
  }

  const data = await aiResp.json();
  logTokenUsage("market-signals[company]", "industry", "google/gemini-3-flash-preview", data);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(ip))) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again in 1 minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { signal_type, role, industry, country } = body;
    const locale = getLocale(country);

    // Validate required fields
    if (!signal_type) {
      return new Response(
        JSON.stringify({ error: "signal_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!role && !industry) {
      return new Response(
        JSON.stringify({ error: "role or industry is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Route based on signal_type
    switch (signal_type) {
      case "enrich":
        return await handleEnrich(req, corsHeaders, supabase, body, locale);
      case "market":
        return await handleMarket(req, corsHeaders, supabase, body, locale);
      case "news":
        return await handleNews(corsHeaders, supabase, locale);
      case "intel":
        return await handleIntel(corsHeaders, supabase, body, locale);
      case "landscape":
        return await handleLandscape(corsHeaders, supabase, body, locale);
      case "company":
        return await handleCompany(corsHeaders, supabase, body, locale);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown signal_type: ${signal_type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[market-signals] error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
