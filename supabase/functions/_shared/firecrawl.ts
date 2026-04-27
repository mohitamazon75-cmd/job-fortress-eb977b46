/**
 * @fileoverview Shared Firecrawl v1 client (search + scrape) using the
 * reliability primitives from `_shared/retry.ts` and `_shared/logger.ts`.
 *
 * Why this exists:
 *   Firecrawl is called from 11 raw `fetch` sites across 8 edge functions,
 *   each duplicating headers, body shape, timeout handling, and error
 *   swallowing. There is no shared wrapper today (unlike Tavily). That
 *   means:
 *     - Bug fixes have to be applied 11 times.
 *     - No circuit breaker, so during Firecrawl outages (which happen
 *       ~weekly) every scan burns its full budget hammering a dead host.
 *     - Logs are unstructured `console.error` strings — impossible to
 *       filter Firecrawl-specific failure rate in the dashboard.
 *
 * Design (matches tavily-search.ts so adoption is muscle-memory):
 *   - Public functions return `null` on failure. Callers already do the
 *     `if (!result) fallback` dance — preserving this contract means each
 *     adoption is a one-line replacement.
 *   - One AbortController for the entire call (timeoutMs covers all
 *     retry attempts combined, not per-attempt).
 *   - CircuitOpenError is logged at INFO, not ERROR. We *want* the breaker
 *     to fire during outages — it's working as designed and shouldn't
 *     trigger our 20% error-rate alert (see `check_error_threshold` DB fn).
 *
 * Adoption order (one PR each):
 *   kg-refresh → live-news → company-news → live-market → market-signals
 *   → parse-linkedin → process-scan/scan-enrichment.
 */

import { retryFetch, CircuitOpenError } from "./retry.ts";
import { createLogger } from "./logger.ts";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export interface FirecrawlSearchOptions {
  query: string;
  /** 1–100, defaults to 5. */
  limit?: number;
  /** ISO language code, e.g. "en". */
  lang?: string;
  /** ISO country code, e.g. "in". Crucial for India market data. */
  country?: string;
  /** Time-based search filter, e.g. "qdr:m" (last month). */
  tbs?: string;
  /** If true, ask Firecrawl to scrape full markdown for each result. */
  scrapeFullContent?: boolean;
}

export interface FirecrawlSearchResult {
  url?: string;
  title?: string;
  description?: string;
  /** Present only when `scrapeFullContent: true` was requested. */
  markdown?: string;
}

export interface FirecrawlScrapeOptions {
  url: string;
  /** Defaults to ["markdown"]. */
  formats?: Array<"markdown" | "html" | "rawHtml" | "links" | "screenshot">;
  /** Strip nav/header/footer before extraction. Defaults to true. */
  onlyMainContent?: boolean;
  /** ms to wait for client-side JS to render before extracting. */
  waitFor?: number;
}

export interface FirecrawlScrapeResult {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
  };
}

/**
 * Firecrawl web search. Returns `null` on any failure (missing key,
 * network error, breaker open, non-2xx response).
 *
 * @param options    - Search configuration
 * @param timeoutMs  - Hard wall on the entire call including retries (default 15s)
 * @param maxRetries - Total attempts including the initial one (default 2)
 */
export async function firecrawlSearch(
  options: FirecrawlSearchOptions,
  timeoutMs = 15_000,
  maxRetries = 2,
): Promise<FirecrawlSearchResult[] | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  const log = createLogger({ fn: "firecrawl-search", base: { provider: "firecrawl" } });

  if (!apiKey) {
    log.warn("api_key_missing");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();

  try {
    const body: Record<string, unknown> = {
      query: options.query,
      limit: options.limit ?? 5,
    };
    if (options.lang) body.lang = options.lang;
    if (options.country) body.country = options.country;
    if (options.tbs) body.tbs = options.tbs;
    if (options.scrapeFullContent) {
      body.scrapeOptions = { formats: ["markdown"] };
    }

    const resp = await retryFetch(
      `${FIRECRAWL_BASE}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
      { maxAttempts: maxRetries, logger: log },
    );

    if (!resp.ok) {
      log.warn("non_ok_response", {
        status: resp.status,
        latency_ms: Math.round(performance.now() - t0),
        query_preview: options.query.slice(0, 80),
      });
      await resp.text().catch(() => {});
      return null;
    }

    const data = await resp.json();
    const results: FirecrawlSearchResult[] = Array.isArray(data?.data)
      ? data.data.map((item: any) => ({
          url: item.url,
          title: item.title,
          description: item.description,
          markdown: item.markdown,
        }))
      : [];

    log.info("search_ok", {
      latency_ms: Math.round(performance.now() - t0),
      result_count: results.length,
    });
    return results;
  } catch (err) {
    return handleErr(err, log, performance.now() - t0, timeoutMs);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Firecrawl single-URL scrape. Returns `null` on failure.
 */
export async function firecrawlScrape(
  options: FirecrawlScrapeOptions,
  timeoutMs = 30_000,
  maxRetries = 2,
): Promise<FirecrawlScrapeResult | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  const log = createLogger({ fn: "firecrawl-scrape", base: { provider: "firecrawl" } });

  if (!apiKey) {
    log.warn("api_key_missing");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();

  try {
    const resp = await retryFetch(
      `${FIRECRAWL_BASE}/scrape`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: options.url,
          formats: options.formats ?? ["markdown"],
          onlyMainContent: options.onlyMainContent ?? true,
          ...(options.waitFor != null ? { waitFor: options.waitFor } : {}),
        }),
        signal: controller.signal,
      },
      { maxAttempts: maxRetries, logger: log },
    );

    if (!resp.ok) {
      log.warn("non_ok_response", {
        status: resp.status,
        latency_ms: Math.round(performance.now() - t0),
        url: options.url,
      });
      await resp.text().catch(() => {});
      return null;
    }

    const data = await resp.json();
    // Firecrawl v1 wraps content under `data`.
    const inner = data?.data ?? data;
    log.info("scrape_ok", {
      latency_ms: Math.round(performance.now() - t0),
      url: options.url,
      has_markdown: Boolean(inner?.markdown),
      status_code: inner?.metadata?.statusCode,
    });
    return {
      markdown: inner?.markdown,
      html: inner?.html,
      links: inner?.links,
      metadata: inner?.metadata,
    };
  } catch (err) {
    return handleErr(err, log, performance.now() - t0, timeoutMs);
  } finally {
    clearTimeout(timer);
  }
}

// ─── shared error funnel ─────────────────────────────────────────────────────

function handleErr(
  err: unknown,
  log: ReturnType<typeof createLogger>,
  elapsed: number,
  timeoutMs: number,
): null {
  const latency_ms = Math.round(elapsed);
  if (err instanceof CircuitOpenError) {
    // Working-as-designed during a known provider outage — info, not error.
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
}
