// ═══════════════════════════════════════════════════════════════
// Shared Tavily Search Helper
// Primary search API — replaces Perplexity for grounded web search
//
// 2026-04-27 — internals rewritten to use _shared/retry.ts (retryFetch
// + per-host circuit breaker) and _shared/logger.ts (structured logs).
//
// Why the rewrite:
//   - The previous bespoke loop retried indefinitely against an
//     already-failing Tavily host, burning every user's scan budget
//     during provider outages. The breaker now fast-fails after 5
//     consecutive failures for a 30s cooldown.
//   - Logs are now JSON-structured with a per-call request_id so
//     Tavily latency / failure spikes are filterable in the dashboard.
//
// Contract preserved:
//   - Public signatures of tavilySearch / tavilySearchParallel /
//     extractCitations / buildSearchContext are unchanged.
//   - Returns `null` on any failure (caller code at all 18 call-sites
//     already handles null — see e.g. market-radar/index.ts).
//   - Default timeout still 20s for single search, 30s for parallel.
// ═══════════════════════════════════════════════════════════════

import { retryFetch, CircuitOpenError } from "./retry.ts";
import { createLogger } from "./logger.ts";

export interface TavilySearchOptions {
  query: string;
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  includeAnswer?: boolean;
  days?: number; // recency filter in days
  topic?: "general" | "news" | "finance";
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}

const TAVILY_URL = "https://api.tavily.com/search";

/**
 * Search the web using Tavily API.
 * Returns grounded search results with citations, or null on failure.
 *
 * @param options    - Search configuration
 * @param timeoutMs  - Hard wall on the entire call (default 20s)
 * @param maxRetries - Max attempts including initial (default 2)
 */
export async function tavilySearch(
  options: TavilySearchOptions,
  timeoutMs = 20_000,
  maxRetries = 2,
): Promise<TavilyResponse | null> {
  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
  const log = createLogger({ fn: "tavily-search", base: { provider: "tavily" } });

  if (!TAVILY_API_KEY) {
    log.warn("api_key_missing");
    return null;
  }

  // One AbortController for the whole call (covers all retry attempts).
  // retryFetch checks signal.aborted before each attempt and during sleep().
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();

  try {
    const resp = await retryFetch(
      TAVILY_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: options.query,
          search_depth: options.searchDepth || "basic",
          max_results: options.maxResults || 5,
          include_domains: options.includeDomains,
          exclude_domains: options.excludeDomains,
          include_answer: options.includeAnswer ?? true,
          days: options.days || 30,
          topic: options.topic || "general",
        }),
        signal: controller.signal,
      },
      { maxAttempts: maxRetries, logger: log },
    );

    if (!resp.ok) {
      // Terminal non-transient failure (e.g. 4xx) — retryFetch already
      // returned the response; we drain and return null per contract.
      log.warn("non_ok_response", {
        status: resp.status,
        latency_ms: Math.round(performance.now() - t0),
        query_preview: options.query.slice(0, 80),
      });
      await resp.text().catch(() => {});
      return null;
    }

    const data = await resp.json();
    log.info("search_ok", {
      latency_ms: Math.round(performance.now() - t0),
      result_count: Array.isArray(data.results) ? data.results.length : 0,
      has_answer: Boolean(data.answer),
    });

    return {
      answer: data.answer || undefined,
      results: (data.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        score: r.score || 0,
      })),
      query: options.query,
    };
  } catch (err) {
    const latency_ms = Math.round(performance.now() - t0);
    if (err instanceof CircuitOpenError) {
      // Provider is in a known-bad state. Fast-fail is the *correct* outcome —
      // log at info, not error, so it doesn't trigger the error-rate alert.
      log.info("circuit_open_skip", {
        latency_ms,
        retry_after_ms: err.retryAfterMs,
        breaker_key: err.breakerKey,
      });
      return null;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      log.warn("timeout_or_abort", { latency_ms, timeout_ms: timeoutMs });
      return null;
    }
    log.error("unexpected_failure", { latency_ms }, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run multiple Tavily searches in parallel.
 * Returns array of results (null for failed searches).
 */
export async function tavilySearchParallel(
  searches: TavilySearchOptions[],
  timeoutMs = 30_000,
): Promise<(TavilyResponse | null)[]> {
  return Promise.all(searches.map((s) => tavilySearch(s, timeoutMs)));
}

/** Extract citation URLs from Tavily results, ranked by score. */
export function extractCitations(results: TavilyResult[]): string[] {
  return results
    .filter((r) => r.url)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.url)
    .slice(0, 10);
}

/** Flatten Tavily results into a context string for LLM synthesis. */
export function buildSearchContext(results: TavilyResult[], maxItems = 10): string {
  return results
    .slice(0, maxItems)
    .map((r) => `${r.title}: ${r.content}`)
    .join("\n\n");
}
