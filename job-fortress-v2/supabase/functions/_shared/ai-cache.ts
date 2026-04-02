/**
 * Shared AI result cache utilities for edge functions.
 *
 * Strategy:
 * - Cache key = SHA-256 hex of a deterministic canonical JSON string of the inputs.
 * - On cache HIT  → return cached result immediately (zero AI cost).
 * - On cache MISS → call AI, then write result to cache.
 * - TTL is configurable per call site (default 7 days for enrichment/research).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── SHA-256 via Web Crypto (available in Deno) ──────────────────────────────
export async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Produce a stable, deterministic cache key from arbitrary input data.
 * Sorts object keys recursively so key order doesn't affect the hash.
 */
export async function buildCacheKey(action: string, inputs: unknown): Promise<string> {
  const canonical = JSON.stringify(sortedJson(inputs));
  return sha256hex(`${action}:${canonical}`);
}

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortedJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

// ─── In-process hit/miss counter (resets per function invocation) ────────────
// Emitted as structured JSON so Supabase log drains / Grafana can parse it.
const _stats: Record<string, { hits: number; misses: number; writes: number }> = {};

function _track(action: string, event: "hit" | "miss" | "write") {
  if (!_stats[action]) _stats[action] = { hits: 0, misses: 0, writes: 0 };
  if (event === "hit")   _stats[action].hits++;
  if (event === "miss")  _stats[action].misses++;
  if (event === "write") _stats[action].writes++;
}

/** Call at the end of an edge function handler to emit one structured log line. */
export function logCacheStats(context?: string) {
  for (const [action, s] of Object.entries(_stats)) {
    const total = s.hits + s.misses;
    const hitRate = total > 0 ? Math.round((s.hits / total) * 100) : 0;
    console.log(
      JSON.stringify({
        level: "info",
        event: "ai_cache_stats",
        context: context ?? "edge-function",
        action,
        hits: s.hits,
        misses: s.misses,
        writes: s.writes,
        hit_rate_pct: hitRate,
        // Alert threshold — if hit-rate drops below 40% something is wrong
        alert: hitRate < 40 && total >= 5 ? "LOW_HIT_RATE" : null,
      })
    );
  }
}

// ─── Cache read ──────────────────────────────────────────────────────────────
export async function getCached(
  db: SupabaseClient,
  cacheKey: string,
  action?: string
): Promise<{ hit: true; result: unknown } | { hit: false }> {
  const t0 = Date.now();
  const { data, error } = await db
    .from("ai_cache")
    .select("result")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.warn("[ai-cache] read error (failing open):", error.message);
    if (action) _track(action, "miss");
    return { hit: false };
  }

  if (data) {
    const ms = Date.now() - t0;
    if (action) _track(action, "hit");
    console.log(
      JSON.stringify({ level: "info", event: "ai_cache_hit", action, latency_ms: ms, cache_key: cacheKey.slice(0, 12) + "…" })
    );
    return { hit: true, result: data.result };
  }

  if (action) _track(action, "miss");
  console.log(
    JSON.stringify({ level: "info", event: "ai_cache_miss", action, cache_key: cacheKey.slice(0, 12) + "…" })
  );
  return { hit: false };
}

// ─── Cache write ─────────────────────────────────────────────────────────────
export async function setCached(
  db: SupabaseClient,
  cacheKey: string,
  action: string,
  result: unknown,
  ttlDays = 7
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db.from("ai_cache").upsert(
    { cache_key: cacheKey, action, result, expires_at: expiresAt },
    { onConflict: "cache_key" }
  );

  if (error) {
    // Non-fatal — a cache write failure should never break the response
    console.warn("[ai-cache] write error:", error.message);
    return;
  }

  _track(action, "write");
  console.log(
    JSON.stringify({ level: "info", event: "ai_cache_write", action, ttl_days: ttlDays, cache_key: cacheKey.slice(0, 12) + "…" })
  );
}
