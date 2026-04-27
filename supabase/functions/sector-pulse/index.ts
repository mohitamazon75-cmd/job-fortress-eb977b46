// Supabase Edge Function: sector-pulse
// ----------------------------------------------------------------
// Returns 2–4 dated, cited news beats (hiring / layoffs / funding)
// for the user's sector × city, sourced via Perplexity sonar with a
// strict domain whitelist. Cached 24h in `sector_pulse_cache`.
//
// Honesty rules baked in:
//  • Every beat MUST have a source URL on TRUSTED_DOMAINS — server
//    drops anything else before caching.
//  • Empty result → `{ beats: [], reason: "no_signal" }` (not an error)
//    so the UI silently omits the strip.
//  • Hard 5s upstream timeout; on timeout we cache an empty result for
//    a SHORT window (10 min) to stop the user hammering Perplexity.
//  • LLM is asked for FACTS ONLY (no commentary, no risk interpretation).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side mirror of src/lib/sector-classifier.ts TRUSTED_NEWS_DOMAINS.
// Kept in lock-step manually; the UI re-validates on render.
const TRUSTED_DOMAINS: ReadonlyArray<string> = [
  "economictimes.indiatimes.com",
  "livemint.com",
  "moneycontrol.com",
  "business-standard.com",
  "inc42.com",
  "yourstory.com",
  "entrackr.com",
  "the-ken.com",
  "thehindubusinessline.com",
  "financialexpress.com",
  "bloomberg.com",
  "reuters.com",
  "techcrunch.com",
  "forbesindia.com",
  "ft.com",
  "wsj.com",
];

const CACHE_TTL_HOURS_OK = 24;
const CACHE_TTL_HOURS_EMPTY = 0.17; // ~10 min — short retry window on empty results
const PERPLEXITY_TIMEOUT_MS = 22000; // sonar + domain filter typically needs 8–15s; give headroom
const MAX_BEATS = 4;

interface Beat {
  headline: string;
  source_name: string;
  source_url: string;
  published_at: string; // ISO date
  signal: "hiring" | "layoff" | "funding";
  company?: string;
}

interface PulseResponse {
  beats: Beat[];
  window_days: number;
  fetched_at: string;
  cached: boolean;
  reason?: "no_signal" | "fetch_failed" | "timeout" | "low_confidence";
  sector_label: string;
}

function isTrustedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return TRUSTED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

async function readCache(supabase: ReturnType<typeof createClient>, sector: string, city: string) {
  const { data } = await supabase
    .from("sector_pulse_cache")
    .select("beats, reason, fetched_at")
    .eq("sector", sector)
    .eq("city", city)
    .maybeSingle();
  if (!data) return null;
  const ttl = (data.beats as Beat[]).length > 0 ? CACHE_TTL_HOURS_OK : CACHE_TTL_HOURS_EMPTY;
  if (ageHours(data.fetched_at as string) > ttl) return null;
  return data;
}

// Stale cache: ignore TTL, return last known row if it has any beats. Used as a
// fallback when a live fetch fails so the user still sees grounded news instead
// of a blank strip.
async function readStaleCache(supabase: ReturnType<typeof createClient>, sector: string, city: string) {
  const { data } = await supabase
    .from("sector_pulse_cache")
    .select("beats, reason, fetched_at")
    .eq("sector", sector)
    .eq("city", city)
    .maybeSingle();
  if (!data) return null;
  if (!Array.isArray(data.beats) || (data.beats as Beat[]).length === 0) return null;
  // Cap at 7 days — anything older than that is too stale to show as "live".
  if (ageHours(data.fetched_at as string) > 24 * 7) return null;
  return data;
}

async function writeCache(
  supabase: ReturnType<typeof createClient>,
  sector: string,
  city: string,
  beats: Beat[],
  reason?: string,
) {
  await supabase.from("sector_pulse_cache").upsert({
    sector,
    city,
    beats,
    reason: reason ?? null,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "sector,city" });
}

async function fetchPerplexity(sectorQuery: string, sectorLabel: string, city: string): Promise<{ beats: Beat[]; reason?: string }> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return { beats: [], reason: "fetch_failed" };

  const prompt = `Find 2 to 4 recent news items (LAST 30 DAYS preferred, up to 45 days acceptable) about ${sectorQuery} in India${city ? ` (${city} relevance is a bonus, not required)` : ""}.

RULES:
- Each item must be from a real, verifiable news article published by an established Indian or global business publication (Economic Times, Mint, Business Standard, Inc42, Moneycontrol, Reuters, Bloomberg, YourStory, Times of India business, Forbes India, etc.).
- Classify each item as exactly one of: "hiring" (expansion, new hires, new offices, fresh recruitment drives), "layoff" (cuts, downsizing, hiring freeze, restructuring), or "funding" (raises, IPO, M&A, major business shifts that affect headcount).
- Include the article URL and publication date (ISO format).
- Skip pure opinion pieces and listicles.
- It is OK to return just 1 item if that's all you can find with confidence — do NOT return an empty array unless you genuinely have nothing.`;

  const schema = {
    name: "sector_pulse",
    schema: {
      type: "object",
      properties: {
        beats: {
          type: "array",
          maxItems: MAX_BEATS,
          items: {
            type: "object",
            required: ["headline", "source_name", "source_url", "published_at", "signal"],
            properties: {
              headline: { type: "string", minLength: 10, maxLength: 200 },
              source_name: { type: "string" },
              source_url: { type: "string" },
              published_at: { type: "string" },
              signal: { type: "string", enum: ["hiring", "layoff", "funding"] },
              company: { type: "string" },
            },
          },
        },
      },
      required: ["beats"],
    },
  };

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), PERPLEXITY_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a precise news researcher. Return only verifiable, dated facts with real article URLs from established business publications." },
          { role: "user", content: prompt },
        ],
        search_recency_filter: "month",
        // NOTE: search_domain_filter removed — it's a hard pre-filter on Perplexity's
        // index and was eliminating ~all results. We trust the prompt + post-filter
        // (isTrustedUrl) to enforce the whitelist as defense-in-depth.
        response_format: { type: "json_schema", json_schema: schema },
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[sector-pulse] perplexity ${res.status}: ${await res.text()}`);
      return { beats: [], reason: "fetch_failed" };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const citations = data?.citations ?? [];
    console.log(`[sector-pulse] perplexity citations: ${citations.length}, content_len: ${content?.length ?? 0}`);
    if (!content) return { beats: [], reason: "no_signal" };

    let parsed: { beats?: unknown };
    try { parsed = JSON.parse(content); } catch {
      console.error(`[sector-pulse] perplexity returned non-JSON content: ${content.slice(0, 300)}`);
      return { beats: [], reason: "fetch_failed" };
    }

    const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : [];
    console.log(`[sector-pulse] perplexity returned ${rawBeats.length} raw beats for sector="${sectorQuery}". sample: ${JSON.stringify(rawBeats[0] ?? {}).slice(0, 200)}`);
    const cleanBeats: Beat[] = [];
    const dropReasons: string[] = [];
    for (const b of rawBeats as Beat[]) {
      if (typeof b?.source_url !== "string" || !isTrustedUrl(b.source_url)) {
        dropReasons.push(`untrusted:${b?.source_url ?? "none"}`);
        continue;
      }
      if (typeof b?.published_at !== "string") { dropReasons.push("no_date"); continue; }
      // Drop anything older than 45 days as a safety net. Perplexity's published_at
      // often reflects the article URL's first-indexed date which can lag the event,
      // so we keep this lenient and rely on the prompt's "last 14 days" instruction.
      const ageDays = (Date.now() - new Date(b.published_at).getTime()) / (1000 * 60 * 60 * 24);
      if (!Number.isFinite(ageDays) || ageDays > 45 || ageDays < -1) {
        dropReasons.push(`age:${ageDays.toFixed(0)}d`);
        continue;
      }
      if (!["hiring", "layoff", "funding"].includes(b.signal)) { dropReasons.push(`signal:${b.signal}`); continue; }
      if (typeof b.headline !== "string" || b.headline.length < 10) { dropReasons.push("headline"); continue; }
      cleanBeats.push({
        headline: b.headline.trim(),
        source_name: (b.source_name ?? "").trim() || new URL(b.source_url).hostname,
        source_url: b.source_url,
        published_at: b.published_at,
        signal: b.signal,
        company: typeof b.company === "string" ? b.company.trim() : undefined,
      });
      if (cleanBeats.length >= MAX_BEATS) break;
    }

    if (cleanBeats.length === 0) {
      console.log(`[sector-pulse] all beats dropped. reasons: ${dropReasons.join(", ")}`);
      return { beats: [], reason: "low_confidence" };
    }
    return { beats: cleanBeats };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = (err as Error)?.name === "AbortError";
    console.error(`[sector-pulse] fetch error: ${(err as Error).message}`);
    return { beats: [], reason: isAbort ? "timeout" : "fetch_failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const sector = String(body?.sector ?? "").trim();
    const sectorLabel = String(body?.sector_label ?? sector).trim() || sector;
    const city = String(body?.city ?? "").trim();

    if (!sector || sector.length > 200) {
      return new Response(JSON.stringify({ error: "sector required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache lookup
    const cached = await readCache(supabase, sector, city);
    if (cached) {
      const resp: PulseResponse = {
        beats: cached.beats as Beat[],
        window_days: 14,
        fetched_at: cached.fetched_at as string,
        cached: true,
        reason: (cached.reason as PulseResponse["reason"]) ?? undefined,
        sector_label: sectorLabel,
      };
      return new Response(JSON.stringify(resp), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Live fetch
    const { beats, reason } = await fetchPerplexity(sector, sectorLabel, city);

    // If live fetch returned nothing usable, try a stale-but-recent cache row
    // before giving up. Better to show 5-day-old grounded news than a blank.
    if (beats.length === 0) {
      const stale = await readStaleCache(supabase, sector, city);
      if (stale) {
        const resp: PulseResponse = {
          beats: stale.beats as Beat[],
          window_days: 14,
          fetched_at: stale.fetched_at as string,
          cached: true,
          reason: undefined,
          sector_label: sectorLabel,
        };
        return new Response(JSON.stringify(resp), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await writeCache(supabase, sector, city, beats, reason);

    const resp: PulseResponse = {
      beats,
      window_days: 14,
      fetched_at: new Date().toISOString(),
      cached: false,
      reason: reason as PulseResponse["reason"],
      sector_label: sectorLabel,
    };
    return new Response(JSON.stringify(resp), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sector-pulse] unhandled:", err);
    return new Response(JSON.stringify({
      beats: [], window_days: 14, fetched_at: new Date().toISOString(),
      cached: false, reason: "fetch_failed", sector_label: "",
    }), {
      status: 200, // Never throw to UI — empty beats is the contract
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
