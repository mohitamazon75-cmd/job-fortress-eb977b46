/**
 * Tests for _shared/firecrawl.ts. We don't test the breaker/retry logic
 * here (that's covered exhaustively in retry.test.ts); we only verify
 * the Firecrawl-specific contract: payload shape, response normalisation,
 * and null-on-failure semantics.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __resetBreakers } from "./retry.ts";
import { firecrawlSearch, firecrawlScrape } from "./firecrawl.ts";

const ORIGINAL_FETCH = globalThis.fetch;

interface CapturedCall {
  url: string;
  body: any;
  headers: Record<string, string>;
}

function stubFetch(responses: Array<Response | Error>): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let i = 0;
  globalThis.fetch = ((input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    let body: any = null;
    if (init?.body) {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }
    calls.push({ url, body, headers: (init?.headers || {}) as Record<string, string> });
    const next = responses[i++] ?? responses[responses.length - 1];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }) as typeof fetch;
  return { calls };
}

function restore() {
  globalThis.fetch = ORIGINAL_FETCH;
  __resetBreakers();
}

function setKey() {
  Deno.env.set("FIRECRAWL_API_KEY", "test-key-123");
}
function clearKey() {
  Deno.env.delete("FIRECRAWL_API_KEY");
}

Deno.test("firecrawlSearch returns normalised results on 200", async () => {
  setKey();
  const cap = stubFetch([
    new Response(
      JSON.stringify({
        data: [
          { url: "https://a.com", title: "A", description: "first" },
          { url: "https://b.com", title: "B", description: "second" },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  ]);
  try {
    const out = await firecrawlSearch({ query: "ai jobs india", country: "in", tbs: "qdr:m" });
    assertEquals(out?.length, 2);
    assertEquals(out?.[0].url, "https://a.com");
    assertEquals(cap.calls[0].url, "https://api.firecrawl.dev/v1/search");
    assertEquals(cap.calls[0].body.query, "ai jobs india");
    assertEquals(cap.calls[0].body.country, "in");
    assertEquals(cap.calls[0].body.tbs, "qdr:m");
    assertEquals(cap.calls[0].body.limit, 5); // default
  } finally {
    restore();
    clearKey();
  }
});

Deno.test("firecrawlSearch returns null when API key missing", async () => {
  clearKey();
  const cap = stubFetch([new Response("{}", { status: 200 })]);
  try {
    const out = await firecrawlSearch({ query: "x" });
    assertEquals(out, null);
    assertEquals(cap.calls.length, 0); // never called
  } finally {
    restore();
  }
});

Deno.test("firecrawlSearch returns null on 4xx (no retry)", async () => {
  setKey();
  const cap = stubFetch([new Response("bad request", { status: 400 })]);
  try {
    const out = await firecrawlSearch({ query: "x" });
    assertEquals(out, null);
    assertEquals(cap.calls.length, 1); // 4xx not retried
  } finally {
    restore();
    clearKey();
  }
});

Deno.test("firecrawlSearch retries on 503 then succeeds", async () => {
  setKey();
  const cap = stubFetch([
    new Response("oops", { status: 503 }),
    new Response(JSON.stringify({ data: [{ url: "https://x.com", title: "X" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]);
  try {
    const out = await firecrawlSearch({ query: "x" });
    assertEquals(out?.length, 1);
    assertEquals(cap.calls.length, 2);
  } finally {
    restore();
    clearKey();
  }
});

Deno.test("firecrawlScrape sends correct payload and unwraps data", async () => {
  setKey();
  const cap = stubFetch([
    new Response(
      JSON.stringify({
        data: {
          markdown: "# Hello",
          metadata: { title: "Hello", sourceURL: "https://x.com", statusCode: 200 },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  ]);
  try {
    const out = await firecrawlScrape({ url: "https://x.com" });
    assertEquals(out?.markdown, "# Hello");
    assertEquals(out?.metadata?.statusCode, 200);
    assertEquals(cap.calls[0].url, "https://api.firecrawl.dev/v1/scrape");
    assertEquals(cap.calls[0].body.url, "https://x.com");
    assertEquals(cap.calls[0].body.formats, ["markdown"]); // default
    assertEquals(cap.calls[0].body.onlyMainContent, true); // default
  } finally {
    restore();
    clearKey();
  }
});

Deno.test("firecrawlScrape handles unwrapped response shape", async () => {
  setKey();
  // Some endpoints return content at top level, not under `data`.
  stubFetch([
    new Response(JSON.stringify({ markdown: "# Top-level" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]);
  try {
    const out = await firecrawlScrape({ url: "https://x.com" });
    assertEquals(out?.markdown, "# Top-level");
  } finally {
    restore();
    clearKey();
  }
});
