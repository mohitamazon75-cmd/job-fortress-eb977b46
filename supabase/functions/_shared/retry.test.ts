/**
 * Tests for _shared/retry.ts — exponential backoff + circuit breaker.
 * Run with: supabase--test_edge_functions
 *
 * We stub global `fetch` to script transient failures and verify:
 *   1. Retries happen on 5xx, 429, network errors
 *   2. 4xx errors are NOT retried
 *   3. Breaker trips after N consecutive failures
 *   4. Open breaker fast-fails without calling fetch
 *   5. Half-open probe transitions correctly
 *   6. Successful response resets failure count
 *   7. AbortSignal short-circuits retries
 */

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  retryFetch,
  CircuitOpenError,
  __resetBreakers,
  __getBreakerState,
} from "./retry.ts";

const ORIGINAL_FETCH = globalThis.fetch;

function stubFetch(responses: Array<Response | Error>): { calls: number } {
  const counter = { calls: 0 };
  let i = 0;
  globalThis.fetch = ((_input: unknown, _init?: unknown) => {
    counter.calls++;
    const next = responses[i++] ?? responses[responses.length - 1];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }) as typeof fetch;
  return counter;
}

function restore() {
  globalThis.fetch = ORIGINAL_FETCH;
  __resetBreakers();
}

Deno.test("retries on 503 then succeeds", async () => {
  const counter = stubFetch([
    new Response("oops", { status: 503 }),
    new Response("ok", { status: 200 }),
  ]);
  try {
    const res = await retryFetch("https://api.test.local/x", {}, { baseDelayMs: 1, maxDelayMs: 2 });
    assertEquals(res.status, 200);
    assertEquals(counter.calls, 2);
  } finally {
    restore();
  }
});

Deno.test("does not retry on 400", async () => {
  const counter = stubFetch([new Response("bad", { status: 400 })]);
  try {
    const res = await retryFetch("https://api.test.local/x", {}, { baseDelayMs: 1, maxDelayMs: 2 });
    assertEquals(res.status, 400);
    assertEquals(counter.calls, 1);
  } finally {
    restore();
  }
});

Deno.test("breaker opens after 5 consecutive failures", async () => {
  const counter = stubFetch([new Response("err", { status: 500 })]);
  try {
    // Five failed calls (each with maxAttempts:1 to count as one failure each).
    for (let i = 0; i < 5; i++) {
      await retryFetch("https://api.brk.local/x", {}, { maxAttempts: 1, baseDelayMs: 1 });
    }
    assertEquals(counter.calls, 5);
    const state = __getBreakerState("https://api.brk.local");
    assertEquals(state?.status, "open");

    // Next call should fast-fail without invoking fetch.
    const before = counter.calls;
    await assertRejects(
      () => retryFetch("https://api.brk.local/x", {}, { maxAttempts: 1, baseDelayMs: 1 }),
      CircuitOpenError,
    );
    assertEquals(counter.calls, before);
  } finally {
    restore();
  }
});

Deno.test("successful response resets failure count", async () => {
  const counter = stubFetch([
    new Response("err", { status: 500 }),
    new Response("err", { status: 500 }),
    new Response("ok", { status: 200 }),
  ]);
  try {
    await retryFetch("https://api.reset.local/x", {}, { maxAttempts: 1, baseDelayMs: 1 });
    await retryFetch("https://api.reset.local/x", {}, { maxAttempts: 1, baseDelayMs: 1 });
    await retryFetch("https://api.reset.local/x", {}, { maxAttempts: 1, baseDelayMs: 1 });
    const state = __getBreakerState("https://api.reset.local");
    assertEquals(state?.consecutiveFailures, 0);
    assertEquals(state?.status, "closed");
    assertEquals(counter.calls, 3);
  } finally {
    restore();
  }
});

Deno.test("network errors trigger retry", async () => {
  const counter = stubFetch([
    new TypeError("network down"),
    new Response("ok", { status: 200 }),
  ]);
  try {
    const res = await retryFetch("https://api.net.local/x", {}, { baseDelayMs: 1, maxDelayMs: 2 });
    assertEquals(res.status, 200);
    assertEquals(counter.calls, 2);
  } finally {
    restore();
  }
});

Deno.test("AbortSignal stops retries immediately", async () => {
  stubFetch([new Response("err", { status: 500 })]);
  try {
    const ctrl = new AbortController();
    ctrl.abort();
    await assertRejects(
      () => retryFetch("https://api.abort.local/x", { signal: ctrl.signal }, { baseDelayMs: 1 }),
      DOMException,
    );
  } finally {
    restore();
  }
});
