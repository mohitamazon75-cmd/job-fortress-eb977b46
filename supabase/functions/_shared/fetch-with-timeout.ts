// ─────────────────────────────────────────────────────────────────────────────
// fetch-with-timeout — shared utility used by every edge function that calls
// an external upstream (Lovable AI gateway, Tavily, Firecrawl, Apify, Affinda,
// Razorpay, Adzuna, Perplexity, etc).
//
// Why this exists:
//   - At thousands of users, a single slow upstream piles up function instances
//     and exhausts Supabase function concurrency. We MUST cap every external
//     call.
//   - Native `fetch` has no built-in timeout in Deno; we wrap with
//     AbortController so timeouts propagate to upstream sockets and the runtime
//     can reclaim the worker.
//
// Design:
//   - Drop-in replacement for `fetch`. Same return type. Same throw semantics
//     plus a `TimeoutError` wrapping the underlying AbortError.
//   - Default 20s — generous enough for slow LLM calls, tight enough that
//     Supabase function wall-clock (60s default) won't itself time out first.
//   - Caller may override per-call via second arg `timeoutMs`.
// ─────────────────────────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(public readonly url: string, public readonly timeoutMs: number) {
    super(`Upstream timeout after ${timeoutMs}ms: ${url}`);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20000, signal: callerSignal, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  // If the caller passed their own AbortSignal, chain it so either side can
  // cancel. Required for nested cancellation paths (request → orchestrator →
  // upstream).
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort();
    else callerSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: ctrl.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      throw new TimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
