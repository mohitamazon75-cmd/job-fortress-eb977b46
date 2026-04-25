import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, buildSearchContext, extractCitations } from "../_shared/tavily-search.ts";
import { getLocale } from "../_shared/locale-config.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const { role, industry, skills, moatSkills, company, country, yearsExperience } = await req.json();
    if (!role) {
      return new Response(JSON.stringify({ error: "role is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locale = getLocale(country);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Graceful degradation: return empty structure with flag so frontend can show
      // a "coming soon" state rather than an error. This avoids a 500 breaking the UI.
      console.warn("[cheat-sheet] LOVABLE_API_KEY not set — returning offline placeholder");
      return new Response(JSON.stringify({
        ai_unavailable: true,
        ai_tools: [],
        keywords: [],
        homework: {},
        generated_at: new Date().toISOString(),
        profile_context: { role, industry, country: locale.label },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();

    // Spending guard
    const spendCheck = await checkDailySpending("cheat-sheet");
    if (!spendCheck.allowed) return buildSpendingBlockedResponse(corsHeaders, spendCheck);

    const skillsList = (skills || []).slice(0, 8).join(", ");
    const moatList = (moatSkills || []).slice(0, 5).join(", ");
    const expContext = yearsExperience ? `${yearsExperience} years experience` : "";
    const companyCtx = company ? `at ${company}` : "";

    // Cache check
    const cacheKey = `cs:${role}_${industry}_${skillsList.slice(0, 30)}_${locale.code}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const { data: cached } = await supabase
        .from("enrichment_cache")
        .select("data, cached_at")
        .eq("cache_key", cacheKey)
        .single();
      if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS) {
        return new Response(JSON.stringify({ ...cached.data, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* cache miss */ }

    // 3 parallel Tavily searches — hyper-targeted
    const [toolsSearch, buzzSearch, resourceSearch] = await Promise.all([
      tavilySearch({
        query: `newest AI tools for ${role} ${industry} professionals 2025 2026 trending ${skillsList}`,
        maxResults: 10,
        days: 30,
        topic: "news",
        includeAnswer: true,
      }),
      tavilySearch({
        query: `${role} ${industry} AI buzzwords trends terminology keywords concepts ${locale.label} 2026`,
        maxResults: 8,
        days: 60,
        includeAnswer: true,
      }),
      tavilySearch({
        query: `best single book video course blog for ${role} ${industry} AI upskilling ${skillsList} ${expContext} 2025 2026`,
        maxResults: 8,
        days: 90,
        includeAnswer: true,
      }),
    ]);

    const toolsCtx = toolsSearch ? buildSearchContext(toolsSearch.results, 10) : "";
    const buzzCtx = buzzSearch ? buildSearchContext(buzzSearch.results, 8) : "";
    const resourceCtx = resourceSearch ? buildSearchContext(resourceSearch.results, 8) : "";

    // Single AI call with structured output for all 3 sections
    const systemPrompt = `You are a cutting-edge career intelligence analyst. You MUST return ONLY valid JSON, no markdown, no explanation.

PROFILE:
- Role: ${role} ${companyCtx} ${expContext}
- Industry: ${industry || "technology"}
- Skills: ${skillsList}
- Moat skills: ${moatList}
- Market: ${locale.label}

You must be HYPER-PERSONALIZED. Every suggestion must directly relate to THIS person's role, skills, and industry. Nothing generic.`;

    const userPrompt = `Using these search results, generate a personalized cheat sheet.

SECTION 1 - AI TOOLS SEARCH RESULTS:
${toolsCtx}
Summary: ${toolsSearch?.answer || ""}

SECTION 2 - BUZZWORDS SEARCH RESULTS:
${buzzCtx}
Summary: ${buzzSearch?.answer || ""}

SECTION 3 - RESOURCES SEARCH RESULTS:
${resourceCtx}
Summary: ${resourceSearch?.answer || ""}

Return this EXACT JSON structure:
{
  "ai_tools": [
    {
      "name": "tool name",
      "tagline": "one-line what it does (max 10 words)",
      "why_you": "why THIS ${role} in ${industry} needs it (1 sentence, reference their skills)",
      "trending_signal": "viral" | "surging" | "emerging" | "sleeper",
      "category": "productivity" | "coding" | "design" | "analytics" | "communication" | "automation"
    }
  ],
  "keywords": [
    {
      "term": "the buzzword/concept",
      "definition": "1-sentence plain-english explanation",
      "relevance": "why a ${role} in ${industry} must know this (1 sentence)",
      "hot_level": "🔥🔥🔥" | "🔥🔥" | "🔥"
    }
  ],
  "homework": {
    "book": { "title": "real book title", "author": "real author", "why": "why THIS person (1 sentence)" },
    "video": { "title": "real video/talk title", "channel": "real channel/speaker", "why": "why THIS person (1 sentence)" },
    "course": { "title": "real course title", "platform": "real platform", "why": "why THIS person (1 sentence)" },
    "blog": { "title": "real article/blog title", "source": "real publication/site", "why": "why THIS person (1 sentence)" }
  }
}

RULES:
- ai_tools: Give exactly 5-6 tools. They must be REAL, recently trending tools. Include at least 2 that went viral in last 3 months.
- keywords: Give exactly 6-8 keywords. Mix of AI terms + ${industry}-specific terms + ${role}-specific terms.
- homework: ALL resources must be REAL. The "why" must reference the person's specific skills or role.
- Every "why_you", "relevance", and "why" MUST mention something specific about being a ${role} in ${industry}.`;

    const aiCtrl = new AbortController();
    const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.15,
      }),
      signal: aiCtrl.signal,
    });
    clearTimeout(aiT);

    if (!resp.ok) {
      console.error(`[cheat-sheet] AI error: ${resp.status}`);
      return new Response(JSON.stringify({ error: "AI synthesis failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await resp.json();
    logTokenUsage("cheat-sheet", null, "google/gemini-3-flash-preview", aiData);
    const raw = aiData.choices?.[0]?.message?.content || "";
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[cheat-sheet] JSON parse failed:", jsonStr.slice(0, 200));
      return new Response(JSON.stringify({ error: "AI returned invalid data" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Post-process: add search URLs for homework
    const homework = parsed.homework || {};
    if (homework.book) {
      homework.book.url = `https://www.${locale.amazonDomain || "amazon.com"}/s?k=${encodeURIComponent(`${homework.book.title} ${homework.book.author}`)}`;
    }
    if (homework.video) {
      homework.video.url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${homework.video.title} ${homework.video.channel}`)}`;
    }
    if (homework.course) {
      homework.course.url = `https://www.google.com/search?q=${encodeURIComponent(`${homework.course.title} ${homework.course.platform} course`)}`;
    }
    if (homework.blog) {
      homework.blog.url = `https://www.google.com/search?q=${encodeURIComponent(`${homework.blog.title} ${homework.blog.source}`)}`;
    }

    // Add content verification hints to homework items
    if (parsed && typeof parsed === 'object') {
      if (parsed.homework && typeof parsed.homework === 'object') {
        const knownPlatforms = ['coursera', 'udemy', 'linkedin learning', 'wharton', 'harvard', 'mit', 'stanford', 'google', 'microsoft', 'amazon', 'youtube', 'tedx'];
        const knownPublishers = ['mckinsey', 'hbr', 'harvard business review', 'o\'reilly', 'manning', 'packt', 'wiley'];

        Object.values(parsed.homework as Record<string, any>).forEach((item: any) => {
          if (!item) return;
          const text = JSON.stringify(item).toLowerCase();
          const verified = [...knownPlatforms, ...knownPublishers].some(p => text.includes(p));
          item.content_verified = verified;
        });
      }
    }

    const result = {
      ai_tools: parsed.ai_tools || [],
      keywords: parsed.keywords || [],
      homework,
      citations: [
        ...extractCitations(toolsSearch?.results || []),
        ...extractCitations(buzzSearch?.results || []),
        ...extractCitations(resourceSearch?.results || []),
      ].slice(0, 8),
      generated_at: new Date().toISOString(),
      profile_context: { role, industry, country: locale.label },
    };

    // Validate AI response structure
    function isValidCheatSheetResponse(result: unknown): boolean {
      if (!result || typeof result !== 'object') return false;
      const r = result as Record<string, unknown>;
      // Must have at least one of the expected arrays
      const hasTools = Array.isArray(r.ai_tools) && r.ai_tools.length > 0;
      const hasKeywords = Array.isArray(r.keywords) && r.keywords.length > 0;
      const hasHomework = r.homework && typeof r.homework === 'object';
      return hasTools || hasKeywords || hasHomework;
    }

    if (!isValidCheatSheetResponse(result)) {
      console.error("[cheat-sheet] Invalid AI response:", JSON.stringify(result).slice(0, 200));
      // Return graceful placeholder instead of error, so frontend doesn't break
      return new Response(
        JSON.stringify({
          ai_unavailable: true,
          ai_tools: [],
          keywords: [],
          homework: {},
          error_detail: "AI returned incomplete data",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache (non-blocking)
    supabase.from("enrichment_cache").upsert(
      { cache_key: cacheKey, data: result, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    ).then(() => {}).catch((e: any) => console.warn("[cheat-sheet] cache write fail:", e));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cheat-sheet] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
