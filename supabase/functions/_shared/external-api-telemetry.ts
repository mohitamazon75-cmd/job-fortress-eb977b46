// ═══════════════════════════════════════════════════════════════
// External API Telemetry — Tracks paid API spend, latency, and
// errors for Tavily, Adzuna, Affinda, Apify, etc.
//
// Fire-and-forget: never blocks the calling function. Failures
// in logging never propagate to the caller.
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Approximate USD costs per call (update as pricing changes)
const COST_TABLE: Record<string, number> = {
  tavily: 0.008,           // $0.008 per advanced search
  adzuna: 0.0,             // free tier
  affinda: 0.10,           // ~$0.10 per resume parse
  apify: 0.05,             // estimate per actor run
  firecrawl: 0.003,        // per page scrape
  perplexity: 0.005,       // per query
};

export interface TelemetryEvent {
  provider: string;
  endpoint?: string;
  status?: "success" | "error" | "timeout" | "rate_limited";
  latency_ms?: number;
  cache_key?: string;
  function_name?: string;
  metadata?: Record<string, unknown>;
}

let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/**
 * Fire-and-forget telemetry write. Never throws.
 * Use `.catch(() => {})` is built-in — caller does not need to await.
 */
export function logExternalApiCall(event: TelemetryEvent): void {
  try {
    const client = getClient();
    if (!client) return;

    const cost = COST_TABLE[event.provider.toLowerCase()] ?? 0;
    const status = event.status || "success";
    // Errors don't incur cost; rate-limited often does
    const estimated_cost_usd = status === "error" ? 0 : cost;

    // Fire and forget — no await
    client
      .from("external_api_log")
      .insert({
        provider: event.provider,
        endpoint: event.endpoint || null,
        status,
        latency_ms: event.latency_ms || null,
        estimated_cost_usd,
        cache_key: event.cache_key || null,
        function_name: event.function_name || null,
        metadata: event.metadata || null,
      })
      .then(({ error }) => {
        if (error) console.warn("[telemetry] log failed:", error.message);
      });
  } catch (e) {
    // Never propagate telemetry errors
    console.warn("[telemetry] caught:", (e as Error).message);
  }
}

/**
 * Wraps an async API call with timing + telemetry. Re-throws on failure
 * after logging.
 */
export async function withTelemetry<T>(
  event: Omit<TelemetryEvent, "latency_ms" | "status">,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logExternalApiCall({
      ...event,
      status: "success",
      latency_ms: Date.now() - start,
    });
    return result;
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError" || /timeout/i.test(e?.message || "");
    const isRateLimit = /429|rate.?limit/i.test(e?.message || "");
    logExternalApiCall({
      ...event,
      status: isRateLimit ? "rate_limited" : isTimeout ? "timeout" : "error",
      latency_ms: Date.now() - start,
      metadata: { ...(event.metadata || {}), error: String(e?.message || e).slice(0, 200) },
    });
    throw e;
  }
}
