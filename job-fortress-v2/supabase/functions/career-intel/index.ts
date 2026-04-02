import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, extractCitations, buildSearchContext } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { getLocale } from "../_shared/locale-config.ts";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (DB-backed below)

// Rate limiting: 20 calls per hour per IP, fail-closed
const CAREER_RATE_LIMIT = 20;
const CAREER_RATE_WINDOW_MS = 60 * 60 * 1000;

async function checkCareerRateLimit(ip: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const windowStart = new Date(Date.now() - CAREER_RATE_WINDOW_MS).toISOString();
  try {
    const { count, error } = await supabase
      .from("scan_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", ip)
      .gte("created_at", windowStart);
    if (error) {
      console.error("[career-intel RateLimit] DB check failed, blocking (fail-closed):", error.message);
      return false;
    }
    if ((count ?? 0) >= CAREER_RATE_LIMIT) return false;
    await supabase.from("scan_rate_limits").insert({ client_ip: ip });
    return true;
  } catch (err) {
    console.error("[career-intel RateLimit] Exception, blocking (fail-closed):", err);
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
    if (!(await checkCareerRateLimit(ip))) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later.", signals: [] }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { role, industry, skills, location, seniority, experience, mode, scanId, country } = await req.json();
    const locale = getLocale(country);

    if (!role) {
      return new Response(
        JSON.stringify({ error: "role is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seniorityCtx = seniority || "PROFESSIONAL";
    const expCtx = experience || "";
    const skillsList = (skills || []).slice(0, 8).join(", ");
    const locationCtx = location || "Global";
    const isAdvantagePlan = mode === "advantage-plan";

    // User-scoped cache key
    const skillHash = (skills || []).sort().join("|");
    const cacheKey = `${mode || 'signals'}_${role}_${industry}_${skillHash}_${location}_${seniorityCtx}_${scanId || ''}`.toLowerCase().replace(/\s+/g, "_");
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DB-backed cache (survives cold starts)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const dbCacheKey = `ci:${cacheKey}`.slice(0, 200);
    try {
      const { data: dbCached } = await supabase
        .from("enrichment_cache")
        .select("data, cached_at")
        .eq("cache_key", dbCacheKey)
        .single();
      if (dbCached && Date.now() - new Date(dbCached.cached_at).getTime() < CACHE_TTL) {
        cache.set(cacheKey, { data: dbCached.data, ts: Date.now() });
        return new Response(JSON.stringify({ ...dbCached.data as object, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* cache miss */ }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    // ═══ PRIMARY: Perplexity sonar-pro (single grounded call) ═══
    if (PERPLEXITY_API_KEY && !isAdvantagePlan) {
      const perplexityResult = await fetchCareerSignalsPerplexity(
        PERPLEXITY_API_KEY, role, industry, skillsList, locationCtx, seniorityCtx, expCtx,
      );
      if (perplexityResult) {
        const result = {
          ...perplexityResult,
          generated_at: new Date().toISOString(),
          source: "perplexity_sonar_pro",
        };
        cache.set(cacheKey, { data: result, ts: Date.now() });
        // DB cache write (non-blocking)
        supabase.from("enrichment_cache").upsert(
          { cache_key: dbCacheKey, data: result, cached_at: new Date().toISOString() },
          { onConflict: "cache_key" }
        ).then(() => {}).catch((e: any) => console.warn("[career-intel] DB cache write fail:", e));
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("[career-intel] Perplexity failed, falling back to Tavily+Gemini");
    }

    // ═══ FALLBACK: Tavily Search + Gemini Pro Synthesis ═══
    const topSkills = (skills || []).slice(0, 5).join(" OR ");
    const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

    const tavilyQueries = isAdvantagePlan
      ? [
          { query: `best books courses for ${role} ${industry || "technology"} AI upskilling 2026`, maxResults: 5, days: 90 },
          { query: `${role} career future-proofing AI disruption resources ${locationCtx}`, maxResults: 5, days: 90 },
        ]
      : [
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

    // ═══ Synthesize via Gemini Pro (Tier 2) ═══
    const systemPrompt = isAdvantagePlan
      ? buildAdvantagePlanPrompt(role, industry, skillsList, locationCtx, seniorityCtx, expCtx)
      : buildSignalsPrompt(role, industry, skillsList, locationCtx, seniorityCtx, expCtx);

    const userPrompt = isAdvantagePlan
      ? `Create a hyper-personalized advantage plan based on these search results:\n\n${searchContext}\n\nTavily summaries:\n${tavilyAnswers}\n\nFor a ${seniorityCtx} ${role} in ${industry || "technology"} with skills in ${skillsList}, based in ${locationCtx}.`
      : `Based on these real-time search results, generate career signals:\n\n${searchContext}\n\nTavily summaries:\n${tavilyAnswers}\n\nFor a ${role} in ${industry || "technology"} with skills in ${skillsList}, based in ${locationCtx}.`;

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured", signals: [] }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 402 || status === 429) {
        return new Response(
          JSON.stringify({ error: status === 402 ? "AI credits exhausted" : "Rate limited", signals: [] }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI synthesis failed", signals: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    logTokenUsage("career-intel", null, "google/gemini-3-pro-preview", aiData);
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
      console.error("[career-intel] JSON parse failed:", content.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "Parse failed", signals: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Post-process advantage plan URLs
    if (isAdvantagePlan && parsed.advantage_plan) {
      const ap = parsed.advantage_plan;
      if (ap.books) {
        ap.books = ap.books.map((b: any) => ({
          ...b,
          url: `https://www.${locale.amazonDomain}/s?k=${encodeURIComponent(`${b.title} ${b.author || ''}`)}`,
        }));
      }
      if (ap.courses) {
        ap.courses = ap.courses.map((c: any) => ({
          ...c,
          url: `https://www.google.com/search?q=${encodeURIComponent(`${c.title} ${c.author || ''} course`)}`,
        }));
      }
      if (ap.videos) {
        ap.videos = ap.videos.map((v: any) => ({
          ...v,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${v.title} ${v.author || ''}`)}`,
        }));
      }
      if (ap.blogs) {
        ap.blogs = ap.blogs.map((b: any) => ({
          ...b,
          url: `https://www.google.com/search?q=${encodeURIComponent(`${b.title} ${b.author || ''} blog`)}`,
        }));
      }
    }

    const result = isAdvantagePlan
      ? {
          advantage_plan: parsed.advantage_plan || null,
          citations,
          generated_at: new Date().toISOString(),
          source: "tavily_gemini",
        }
      : {
          signals: parsed.signals || [],
          net_signal: parsed.net_signal || null,
          citations,
          generated_at: new Date().toISOString(),
          source: "tavily_gemini",
        };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    // DB cache write (non-blocking)
    supabase.from("enrichment_cache").upsert(
      { cache_key: dbCacheKey, data: result, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    ).then(() => {}).catch((e: any) => console.warn("[career-intel] DB cache write fail:", e));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("[career-intel] Request timed out");
      return new Response(
        JSON.stringify({ error: "Timeout", signals: [] }),
        { status: 504, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    console.error("[career-intel] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", signals: [] }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

// ═══ Perplexity sonar-pro: single grounded call with native citations ═══
async function fetchCareerSignalsPerplexity(
  apiKey: string,
  role: string,
  industry: string | null | undefined,
  skillsList: string,
  locationCtx: string,
  seniorityCtx: string,
  expCtx: string,
): Promise<{ signals: any[]; net_signal: string; citations: string[] } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const resp = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a career intelligence engine. Today: ${new Date().toISOString().split("T")[0]}.
Generate exactly 5 career signals for a ${seniorityCtx} ${role} in ${industry || "technology"} with skills: ${skillsList}, located in ${locationCtx}.${expCtx ? ` Experience: ${expCtx}.` : ""}
${seniorityCtx === "EXECUTIVE" || seniorityCtx === "SENIOR_LEADER" ? "Frame for senior executive — P&L impact, org-level AI adoption." : ""}
Each signal must reference the user's actual role/skills, name specific tools/companies, include data when available.`,
          },
          {
            role: "user",
            content: `What are the 5 most important career signals RIGHT NOW for a ${seniorityCtx} ${role} in ${industry || "technology"} with skills in ${skillsList}, based in ${locationCtx}?`,
          },
        ],
        temperature: 0.1,
        search_recency_filter: "week",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "career_signals",
            schema: {
              type: "object",
              properties: {
                signals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["ai_impact", "hiring_trend", "skill_premium", "hidden_opportunity", "risk_alert"] },
                      icon: { type: "string", enum: ["🤖", "🌍", "🧠", "💼", "⚠️"] },
                      headline: { type: "string" },
                      description: { type: "string" },
                      urgency: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["category", "icon", "headline", "description", "urgency"],
                  },
                },
                net_signal: { type: "string" },
              },
              required: ["signals", "net_signal"],
            },
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`[career-intel:Perplexity] Error: ${resp.status}`);
      await resp.text();
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];

    if (!content) return null;

    let parsed: any;
    try {
      // With response_format, content should be valid JSON directly
      parsed = JSON.parse(content);
    } catch {
      // Fallback: try extracting JSON from content
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("[career-intel:Perplexity] No JSON found:", content.slice(0, 200));
        return null;
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    console.log(`[career-intel:Perplexity] Generated ${parsed.signals?.length || 0} signals with ${citations.length} citations`);

    return {
      signals: parsed.signals || [],
      net_signal: parsed.net_signal || "",
      citations: Array.isArray(citations) ? citations.slice(0, 8) : [],
    };
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      console.error("[career-intel:Perplexity] Timed out");
    } else {
      console.error("[career-intel:Perplexity] Error:", e.message);
    }
    return null;
  }
}

// ═══ Prompt builders ═══
function buildSignalsPrompt(role: string, industry: string | null | undefined, skillsList: string, locationCtx: string, seniorityCtx: string, expCtx: string): string {
  return `You are a hyper-personalized career intelligence engine. Return ONLY valid JSON, no markdown.
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
4. The "headline" must pass this test: "Would a ${role} in ${industry || "technology"} care about this in their daily work?" If not, don't include it.
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
}

function buildAdvantagePlanPrompt(role: string, industry: string | null | undefined, skillsList: string, locationCtx: string, seniorityCtx: string, expCtx: string): string {
  return `You are a hyper-personalized career strategist. Return ONLY valid JSON, no markdown.

CONTEXT:
- Role: ${role}
- Industry: ${industry || "technology"}
- Key skills: ${skillsList}
- Location: ${locationCtx}
- Seniority: ${seniorityCtx}
- Experience: ${expCtx}

Generate a personalized advantage plan with real, specific resources. Use the search results provided to ground your recommendations.

${seniorityCtx === "EXECUTIVE" || seniorityCtx === "SENIOR_LEADER" ? "Focus on strategic leadership, AI governance, board-level positioning." : seniorityCtx === "ENTRY" ? "Focus on practical, hands-on resources for breaking into the field." : "Focus on skill deepening, career advancement, and staying ahead of AI disruption."}

Return JSON:
{
  "advantage_plan": {
    "books": [{ "title": string, "author": string, "url": string, "why": string }],
    "videos": [{ "title": string, "author": string, "url": string, "why": string }],
    "courses": [{ "title": string, "author": string, "url": string, "why": string }],
    "blogs": [{ "title": string, "author": string, "url": string, "why": string }]
  }
}
Each category must have exactly 3 items. All resources must be real and from the search data where possible.`;
}
