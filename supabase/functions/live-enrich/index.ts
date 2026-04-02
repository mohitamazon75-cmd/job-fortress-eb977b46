import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, buildSearchContext, extractCitations } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { getLocale } from "../_shared/locale-config.ts";

// DB-backed cache TTL (6 hours — balances freshness vs cost)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Rate limiting constants
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
      console.error("[live-enrich RateLimit] DB check failed, blocking (fail-closed):", error.message);
      return false;
    }
    if ((count ?? 0) >= RATE_LIMIT) return false;
    await supabase.from("scan_rate_limits").insert({ client_ip: ip });
    return true;
  } catch (err) {
    console.error("[live-enrich RateLimit] Exception, blocking (fail-closed):", err);
    return false;
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

    const { role, industry, skills, moatSkills, pivotRoles, yearsExperience, company, country } = await req.json();
    const locale = getLocale(country);


    if (!role) {
      return new Response(
        JSON.stringify({ error: "role is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const skillsHash = (skills || []).slice(0, 3).join('_').toLowerCase();
    const cacheKey = `le:${role}_${industry}_${skillsHash}_${company || ''}_${locale.code}`.toLowerCase().replace(/\s+/g, '_');

    // DB-backed cache check
    try {
      const { data: cachedRow } = await supabase
        .from("enrichment_cache")
        .select("data, cached_at")
        .eq("cache_key", cacheKey)
        .single();
      if (cachedRow && Date.now() - new Date(cachedRow.cached_at).getTime() < CACHE_TTL_MS) {
        return new Response(JSON.stringify({ ...cachedRow.data, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* cache miss */ }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const skillsList = (skills || []).slice(0, 8).join(", ");
    const pivotsList = (pivotRoles || []).slice(0, 3).join(", ");
    const expContext = yearsExperience ? `with ${yearsExperience} years of experience` : '';
    const companyContext = company ? `currently at ${company}` : '';

    // ═══ STEP 1: Tavily searches in parallel (ENHANCED — double results for richer grounding) ═══
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
      // Market depth: salary benchmarks, layoff signals, hiring trends
      tavilySearch({
        query: `${role} ${industry || "technology"} layoffs hiring trends salary benchmark ${locale.label} 2026 ${company || ""}`,
        maxResults: 5,
        days: 14,
        topic: "news",
        includeAnswer: true,
      }),
    ]);

    const queries = [
      {
        role: "system",
        content: `You are a career technology analyst specializing in AI disruption in ${locale.label}. Return ONLY valid JSON, no markdown.

CONTEXT:
- Role: ${role} ${expContext} ${companyContext} in ${industry || 'technology'}
- Skills: ${skillsList}
- Moat skills: ${(moatSkills || []).join(", ")}

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
- Pivot toward: ${pivotsList || 'AI-augmented ' + role}

Using the search results, recommend REAL resources. For ${expContext || '5+ years'}, recommend ADVANCED resources.
Each "why_relevant" must explain why THIS resource matters for THEIR situation.

Return JSON:
{
  "books": [{ "title": string, "author": string, "year": number, "why_relevant": string }],
  "courses": [{ "title": string, "platform": string, "url": string, "why_relevant": string }],
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
- Proposed pivots: ${pivotsList || 'AI-augmented ' + role}

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

    // ═══ STEP 2: Synthesize via Gemini with search context ═══
    async function callAI(systemMsg: any, searchResult: any, idx: number) {
      if (!LOVABLE_API_KEY) return null;

      const context = searchResult ? buildSearchContext(searchResult.results, 15) : "";
      const answer = searchResult?.answer || "";
      // Inject market depth context into threat and pivot queries for richer grounding
      const marketDepthContext = tavilyMarketDepth ? `\n\nAdditional market context:\n${buildSearchContext(tavilyMarketDepth.results, 5)}\nMarket summary: ${tavilyMarketDepth.answer || ""}` : "";
      const userContent = idx === 0
        ? `Based on these search results, what AI tools threaten a ${role} with skills in ${skillsList}?\n\n${context}\n\nSummary: ${answer}${marketDepthContext}`
        : idx === 1
        ? `Based on these search results, recommend resources for a ${role} to upskill:\n\n${context}\n\nSummary: ${answer}`
        : `Based on these search results, validate pivots for a ${role} with ${skillsList}:\n\n${context}\n\nSummary: ${answer}${marketDepthContext}`;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [systemMsg, { role: "user", content: userContent }],
            temperature: 0.1,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          logTokenUsage("live-enrich", `query-${idx}`, "google/gemini-3-flash-preview", data);
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const citations = searchResult ? extractCitations(searchResult.results) : [];
            return { parsed: JSON.parse(jsonStr), citations };
          }
        } else {
          console.warn(`[live-enrich] Query ${idx} AI failed: ${resp.status}`);
        }
      } catch (e: any) {
        console.error(`[live-enrich] Query ${idx} error:`, e.message);
      }

      return null;
    }

    const results = await Promise.all([
      callAI(queries[0], tavilyThreats, 0),
      callAI(queries[1], tavilyResources, 1),
      callAI(queries[2], tavilyPivots, 2),
    ]);

    const courses = results[1]?.parsed?.courses || [];

    // Post-process URLs
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

    // Write to DB cache (non-blocking)
    supabase.from("enrichment_cache").upsert(
      { cache_key: cacheKey, data: enrichment, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    ).then(() => {}).catch((e: any) => console.warn("[live-enrich] Cache write failed:", e));

    return new Response(JSON.stringify(enrichment), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[live-enrich] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
