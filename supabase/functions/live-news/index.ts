import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { fetchHNSignals } from "../_shared/community-signals.ts";
import { firecrawlSearch } from "../_shared/firecrawl.ts";

// DB-backed cache key and TTL
const CACHE_KEY = "live-news-headlines";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    // Public endpoint — guardRequest for origin check only, NO JWT validation
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const supabase = createAdminClient();

    // ── Check DB cache first ──
    const { data: cached } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();

    if (cached?.data && cached.cached_at) {
      const age = Date.now() - new Date(cached.cached_at).getTime();
      if (age < CACHE_TTL_MS) {
        const headlines = (cached.data as any).headlines;
        if (Array.isArray(headlines) && headlines.length > 0) {
          return new Response(JSON.stringify({ headlines, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════
    // STEP 1: Firecrawl search for REAL news
    // ═══════════════════════════════════════════════════════
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

    // HN community signals — free supplement
    const hnResults = await fetchHNSignals("AI jobs India layoffs hiring automation", { maxResults: 6, daysBack: 7 }).catch(() => []);

    // Add HN stories as additional news context
    const hnArticles = hnResults.map(s => ({
      title: s.title,
      url: s.url || '',
      content: `${s.title} (${s.points} upvotes on Hacker News)`,
    }));
    // Append top HN stories to rawArticles
    rawArticles.push(...hnArticles.slice(0, 3).map(a => `${a.title} — ${a.content} (${a.url})`));

    console.log(`[live-news] Firecrawl returned ${rawArticles.length - hnArticles.slice(0, 3).length} articles, added ${Math.min(3, hnArticles.length)} from HN`);

    if (rawArticles.length === 0) {
      const headlines = await geminiOnlyHeadlines(LOVABLE_API_KEY);
      if (headlines) {
        await persistCache(supabase, headlines);
        return new Response(JSON.stringify({ headlines, cached: false, source: "ai_only" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Gemini synthesizes real articles into headlines
    // ═══════════════════════════════════════════════════════
    const today = new Date().toISOString().split("T")[0];

    const ai1Ctrl = new AbortController();
    const ai1T = setTimeout(() => ai1Ctrl.abort(), 30_000);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a news editor for a Bloomberg/Reuters-style AI & Jobs ticker. You receive REAL search results from the web and your job is to extract/synthesize 16 concise ticker headlines from them.

RULES:
- Base headlines on the ACTUAL articles provided. Do NOT fabricate.
- If an article mentions a specific company, number, or statistic, USE IT.
- Each headline should be under 100 characters.
- Add emoji prefix: 🔴 for threatening/bad news, ✅ for positive, 📊/🇮🇳/📈 for neutral
- Mix of good, bad, neutral headlines
- Focus on India-relevant news but include global AI developments
- If you don't have 16 from the articles, supplement with 2-3 based on real trends you know about (clearly grounded in reality)

Today: ${today}

Return ONLY a JSON array: [{"text": "emoji headline", "type": "good"|"bad"|"neutral"}]
No markdown, no explanation.`,
          },
          {
            role: "user",
            content: `Here are ${rawArticles.length} real news articles from this week. Synthesize 16 ticker headlines:\n\n${rawArticles.slice(0, 20).join("\n\n")}`,
          },
        ],
        temperature: 0.3,
      }),
    });
    clearTimeout(ai1T);

    if (!aiResponse.ok) {
      console.error(`[live-news] AI error [${aiResponse.status}]`);
      return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    logTokenUsage("live-news", "headlines", "google/gemini-3-flash-preview", aiData);
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
        await persistCache(supabase, headlines);
        return new Response(JSON.stringify({ headlines, cached: false, source: "firecrawl_gemini" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("[live-news] JSON parse failed:", e);
    }

    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[live-news] error:", error);
    return new Response(JSON.stringify({ headlines: getFallbackHeadlines(), fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// DB CACHE PERSISTENCE
// ═══════════════════════════════════════════════════════════════
async function persistCache(supabase: any, headlines: any[]) {
  try {
    await supabase
      .from("enrichment_cache")
      .upsert({ cache_key: CACHE_KEY, data: { headlines }, cached_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch (e) {
    console.error("[live-news] Cache persist failed:", e);
  }
}

// Fallback: Gemini-only (no Firecrawl)
async function geminiOnlyHeadlines(apiKey: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const ai2Ctrl = new AbortController();
    const ai2T = setTimeout(() => ai2Ctrl.abort(), 30_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Generate 16 realistic news headlines about AI's impact on jobs, focusing on India. Base on real trends you know. Today: ${today}. Return ONLY JSON array: [{"text": "emoji headline", "type": "good"|"bad"|"neutral"}]`,
          },
          { role: "user", content: "Generate 16 AI & jobs headlines." },
        ],
        temperature: 0.4, // FIX D: was 0.9 — structured JSON array output
      }),
      signal: ai2Ctrl.signal,
    });
    clearTimeout(ai2T);
    if (!resp.ok) return null;
    const d = await resp.json();
    logTokenUsage("live-news", "fallback", "google/gemini-3-flash-preview", d);
    const c = d.choices?.[0]?.message?.content;
    if (!c) return null;
    const j = c.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(j);
  } catch {
    return null;
  }
}

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
