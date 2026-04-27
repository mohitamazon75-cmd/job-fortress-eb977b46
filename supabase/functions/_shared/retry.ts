/**
 * @fileoverview Retry with exponential backoff + jitter, and a per-host
 * in-memory circuit breaker for outbound HTTP from edge functions.
 *
 * Why this exists:
 *   - Tavily, Firecrawl, Adzuna, Apify, Lovable AI Gateway, and Perplexity
 *     all fail intermittently. Today we either swallow errors or 500 the
 *     whole scan — both are bad.
 *   - A naive `for (i=0; i<3; i++)` loop hammers a struggling provider and
 *     burns our timeout budget. Exponential backoff + jitter is the standard
 *     remedy (AWS Architecture Blog, "Exponential Backoff and Jitter").
 *   - When a provider is *actually* down, retrying every request wastes
 *     every user's scan budget. A circuit breaker fails fast for a cooldown
 *     window, then probes once. This keeps p99 latency sane during outages.
 *
 * Scope choices:
 *   - Per-edge-function isolate (Deno workers are short-lived). Breaker
 *     state lives in module scope, so it persists across requests served by
 *     the same isolate but resets on cold start. Good enough for our scale —
 *     a Redis-backed breaker is overkill until we have >100 RPS.
 *   - Only retry on transient failures: network errors, timeouts, 408, 425,
 *     429, 5xx. Never retry 4xx auth/validation — those are deterministic.
 *   - Honour `Retry-After` header on 429/503 when present.
 *   - Caller passes an AbortSignal (e.g. from stageTimeout) so retries can't
 *     overrun the stage budget.
 *
 * Usage:
 *
 *   import { retryFetch } from "../_shared/retry.ts";
 *   const res = await retryFetch("https://api.tavily.com/search", {
 *     method: "POST",
 *     body: JSON.stringify(payload),
 *     headers: { "content-type": "application/json" },
 *     signal: stageTimeout(TIMEOUTS.AGENT2A_MS).signal,
 *   }, { maxAttempts: 3, logger: log.child({ provider: "tavily" }) });
 */

import type { Logger } from "./logger.ts";

export interface RetryOptions {
  /** Total attempts (initial + retries). Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for backoff. Default 250ms. */
  baseDelayMs?: number;
  /** Cap on individual backoff delay. Default 4000ms. */
  maxDelayMs?: number;
  /** Optional logger; if provided, logs each retry/breaker event. */
  logger?: Pick<Logger, "warn" | "info" | "debug">;
  /**
   * Override the breaker key. Defaults to URL origin (host+port+protocol).
   * Use this if multiple URLs share a backend that should trip together.
   */
  breakerKey?: string;
}

interface BreakerState {
  /** "closed" = healthy. "open" = failing fast. "half_open" = probing. */
  status: "closed" | "open" | "half_open";
  consecutiveFailures: number;
  openedAt: number;
}

/** After this many consecutive failures, trip the breaker. */
const FAILURE_THRESHOLD = 5;
/** How long to stay open before allowing a probe. */
const OPEN_COOLDOWN_MS = 30_000;

const breakers = new Map<string, BreakerState>();

/** Exposed for tests — do not call from production code. */
export function __resetBreakers(): void {
  breakers.clear();
}

/** Exposed for tests/observability. */
export function __getBreakerState(key: string): BreakerState | undefined {
  return breakers.get(key);
}

export class CircuitOpenError extends Error {
  constructor(public readonly breakerKey: string, public readonly retryAfterMs: number) {
    super(`Circuit breaker open for ${breakerKey}; retry after ${retryAfterMs}ms`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Drop-in replacement for `fetch` with retry + circuit-breaker semantics.
 * Returns the final Response (success or terminal error). Throws only on
 * AbortError, CircuitOpenError, or genuine network failures after all retries.
 */
export async function retryFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 4_000;
  const log = opts.logger;

  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const key = opts.breakerKey ?? deriveBreakerKey(url);

  // Fast-fail if breaker is open and cooldown hasn't elapsed.
  const state = breakers.get(key);
  if (state?.status === "open") {
    const elapsed = Date.now() - state.openedAt;
    if (elapsed < OPEN_COOLDOWN_MS) {
      log?.warn("breaker_open_fast_fail", { breaker_key: key, elapsed_ms: elapsed });
      throw new CircuitOpenError(key, OPEN_COOLDOWN_MS - elapsed);
    }
    // Cooldown elapsed → allow one probe.
    state.status = "half_open";
    log?.info("breaker_half_open_probe", { breaker_key: key });
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Bail out early if caller's signal already aborted (e.g. stage timeout).
    if (init.signal?.aborted) {
      throw new DOMException("Aborted before attempt", "AbortError");
    }

    try {
      const res = await fetch(input, init);

      if (isTransientStatus(res.status) && attempt < maxAttempts) {
        const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, res.headers.get("retry-after"));
        log?.warn("retry_transient_status", {
          breaker_key: key,
          status: res.status,
          attempt,
          delay_ms: delay,
        });
        // Drain body so the connection can be reused — Deno warns otherwise.
        await res.body?.cancel().catch(() => {});
        await sleep(delay, init.signal);
        continue;
      }

      // Terminal response. Distinguish actual success (2xx/3xx) from a
      // transient failure we ran out of retries on — the latter must still
      // count toward the breaker even though we're returning the Response.
      if (isTransientStatus(res.status)) {
        onFailure(key, log);
      } else {
        onSuccess(key, log);
      }
      return res;
    } catch (err) {
      lastError = err;
      // Caller-initiated abort → propagate immediately, do not retry.
      if (isAbortError(err)) throw err;

      if (attempt < maxAttempts) {
        const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, null);
        log?.warn(
          "retry_network_error",
          { breaker_key: key, attempt, delay_ms: delay },
          err,
        );
        await sleep(delay, init.signal);
        continue;
      }
    }
  }

  // Exhausted attempts → record failure and surface the original error.
  onFailure(key, log);
  throw lastError ?? new Error(`retryFetch exhausted ${maxAttempts} attempts for ${key}`);
}

// ─── internals ───────────────────────────────────────────────────────────────

function deriveBreakerKey(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Full jitter (AWS recipe): delay = random(0, min(cap, base * 2^attempt)). */
function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfter: string | null,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }
  }
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function onSuccess(key: string, log?: RetryOptions["logger"]): void {
  const state = breakers.get(key);
  if (!state) return;
  if (state.status !== "closed") {
    log?.info("breaker_closed", { breaker_key: key });
  }
  breakers.set(key, { status: "closed", consecutiveFailures: 0, openedAt: 0 });
}

function onFailure(key: string, log?: RetryOptions["logger"]): void {
  const prev = breakers.get(key) ?? { status: "closed" as const, consecutiveFailures: 0, openedAt: 0 };
  const failures = prev.consecutiveFailures + 1;

  if (failures >= FAILURE_THRESHOLD || prev.status === "half_open") {
    breakers.set(key, { status: "open", consecutiveFailures: failures, openedAt: Date.now() });
    log?.warn("breaker_opened", { breaker_key: key, consecutive_failures: failures });
    return;
  }

  breakers.set(key, { status: "closed", consecutiveFailures: failures, openedAt: 0 });
}
