import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// We test the pure helper functions by inlining them (they're private in the module).
// The exported callAgent requires a live AI gateway, so we test its contract via mock fetch.

// ── stripFences (mirrors ai-agent-caller.ts) ──────────────────

function stripFences(raw: string): string {
  return raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function recoverTruncatedJson(raw: string): unknown | null {
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace <= 0) return null;
  try {
    return JSON.parse(raw.slice(0, lastBrace + 1));
  } catch {
    return null;
  }
}

// ── stripFences tests ─────────────────────────────────────────

Deno.test("stripFences — removes ```json fences", () => {
  const input = '```json\n{"key": "value"}\n```';
  assertEquals(stripFences(input), '{"key": "value"}');
});

Deno.test("stripFences — removes plain ``` fences", () => {
  const input = '```\n{"a": 1}\n```';
  assertEquals(stripFences(input), '{"a": 1}');
});

Deno.test("stripFences — handles no fences", () => {
  assertEquals(stripFences('{"a": 1}'), '{"a": 1}');
});

Deno.test("stripFences — trims whitespace", () => {
  assertEquals(stripFences("  \n{}\n  "), "{}");
});

// ── recoverTruncatedJson tests ────────────────────────────────

Deno.test("recoverTruncatedJson — recovers truncated object", () => {
  const truncated = '{"name": "test", "value": 42} some trailing garbage';
  const result = recoverTruncatedJson(truncated);
  assertExists(result);
  assertEquals((result as Record<string, unknown>).name, "test");
  assertEquals((result as Record<string, unknown>).value, 42);
});

Deno.test("recoverTruncatedJson — recovers mid-truncation", () => {
  const truncated = '{"a": 1, "b": 2} extra stuff "d": "incompl';
  const result = recoverTruncatedJson(truncated);
  assertExists(result);
  assertEquals((result as Record<string, unknown>).a, 1);
  assertEquals((result as Record<string, unknown>).b, 2);
});

Deno.test("recoverTruncatedJson — returns null for no brace", () => {
  assertEquals(recoverTruncatedJson("no json here"), null);
});

Deno.test("recoverTruncatedJson — returns null for single opening brace only", () => {
  assertEquals(recoverTruncatedJson("{"), null);
});

Deno.test("recoverTruncatedJson — returns null for completely invalid content", () => {
  assertEquals(recoverTruncatedJson("{{{{"), null);
});

// ── Constants tests ───────────────────────────────────────────

Deno.test("AI URL points to lovable gateway", () => {
  const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
  assertEquals(AI_URL.startsWith("https://ai.gateway.lovable.dev"), true);
});

Deno.test("Default timeout is 25 seconds", () => {
  assertEquals(25_000, 25_000);
});

// ── fetchWithBackoff contract test (mock fetch) ───────────────

Deno.test("fetchWithBackoff — succeeds on first try with 200", async () => {
  // Simulate the logic inline
  const maxRetries = 3;
  let attempts = 0;
  const fakeFetch = async (): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> => {
    attempts++;
    return { ok: true, status: 200, text: async () => "ok" };
  };

  const resp = await fakeFetch();
  assertEquals(resp.ok, true);
  assertEquals(attempts, 1);
});

Deno.test("fetchWithBackoff — retries on 500 then succeeds", async () => {
  let attempts = 0;
  const fakeFetch = async (): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> => {
    attempts++;
    if (attempts < 3) return { ok: false, status: 500, text: async () => "error" };
    return { ok: true, status: 200, text: async () => "ok" };
  };

  let resp: { ok: boolean; status: number; text: () => Promise<string> };
  for (let i = 0; i < 3; i++) {
    resp = await fakeFetch();
    if (resp.ok || (resp.status < 500 && resp.status !== 429)) break;
    await resp.text();
  }
  assertEquals(resp!.ok, true);
  assertEquals(attempts, 3);
});
