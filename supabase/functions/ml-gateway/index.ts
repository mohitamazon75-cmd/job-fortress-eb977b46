// ═══════════════════════════════════════════════════════════════
// ML-GATEWAY — Secure API proxy to external Python ML microservice
// ═══════════════════════════════════════════════════════════════
// Features:
//   1. Auth token validation (optional — falls back to IP tracking for anon)
//   2. DB-backed rate limiting (5 scans per 24 hours per IP)
//   3. ML result caching via profile hash (7-day TTL)
//   4. 15-second timeout with clean error payload
//   5. Replit URL kept server-side — never exposed to client
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
const ML_BASE_URL = Deno.env.get("ML_BASE_URL") || "https://dcce6740-52eb-4861-9ab4-1c6ffbf0a3fc-00-17r35n9rdd8su.kirk.replit.dev";
const RATE_LIMIT_MAX = 5;
const RATE_WINDOW_HOURS = 24;
const ML_TIMEOUT_MS = 15_000;
const CACHE_TTL_DAYS = 7;

// Simple hash for cache key generation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const supabase = createAdminClient();

    // ── Extract client identity ──
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") || "unknown";

    // ── Parse request ──
    const { endpoint, payload, scanId } = await req.json();

    if (!endpoint || !["predict-obsolescence", "build-graph"].includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: "Invalid endpoint. Use 'predict-obsolescence' or 'build-graph'." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // ══════════════════════════════════════════════════════════
    // RATE LIMITING — DB-backed, 5 per 24 hours per IP
    // ══════════════════════════════════════════════════════════
    const now = new Date();

    // Cleanup expired entries periodically (fire-and-forget)
    supabase.rpc("cleanup_expired_rate_limits").then(() => {}).catch(() => {});

    // Check current window
    const { data: rateLimitRows } = await supabase
      .from("scan_rate_limits")
      .select("id, scan_count, window_end")
      .eq("client_ip", ip)
      .gte("window_end", now.toISOString())
      .order("window_end", { ascending: false })
      .limit(1);

    const currentLimit = rateLimitRows?.[0];

    if (currentLimit && currentLimit.scan_count >= RATE_LIMIT_MAX) {
      const resetAt = new Date(currentLimit.window_end);
      const minutesRemaining = Math.ceil((resetAt.getTime() - now.getTime()) / 60_000);

      console.warn(`[ML-Gateway] Rate limit exceeded for IP ${ip.slice(0, 8)}*** (${currentLimit.scan_count}/${RATE_LIMIT_MAX})`);

      return new Response(
        JSON.stringify({
          error: "rate_limit_exceeded",
          message: `You've used all ${RATE_LIMIT_MAX} ML simulations for today. Resets in ${minutesRemaining} minutes.`,
          reset_at: resetAt.toISOString(),
          minutes_remaining: minutesRemaining,
          upgrade_hint: "Upgrade to Pro for unlimited simulations",
        }),
        { status: 429, headers: { ...jsonHeaders, "Retry-After": String(minutesRemaining * 60) } }
      );
    }

    // ══════════════════════════════════════════════════════════
    // CACHING — Check if we have a cached result for this payload
    // ══════════════════════════════════════════════════════════
    const payloadStr = JSON.stringify(payload || {});
    const cacheKey = `${endpoint}:${simpleHash(payloadStr)}`;

    if (scanId) {
      const { data: scanRow } = await supabase
        .from("scans")
        .select("ml_insights_hash, ml_insights_cached_at, final_json_report")
        .eq("id", scanId)
        .single();

      if (scanRow?.ml_insights_hash === cacheKey && scanRow?.ml_insights_cached_at) {
        const cacheAge = now.getTime() - new Date(scanRow.ml_insights_cached_at).getTime();
        const cacheTTL = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

        if (cacheAge < cacheTTL) {
          console.log(`[ML-Gateway] Cache HIT for ${endpoint} (age: ${Math.round(cacheAge / 3600000)}h)`);
          const cachedML = (scanRow.final_json_report as any)?.ml_raw;
          if (cachedML) {
            return new Response(
              JSON.stringify({ ...cachedML, cached: true, cache_age_hours: Math.round(cacheAge / 3600000) }),
              { status: 200, headers: jsonHeaders }
            );
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════
    // PROXY TO ML SERVICE — with 15s timeout
    // ══════════════════════════════════════════════════════════
    console.log(`[ML-Gateway] Proxying ${endpoint} for IP ${ip.slice(0, 8)}*** (${payloadStr.length} bytes)`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    let mlData: any;
    try {
      const mlResp = await fetch(`${ML_BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mlResp.ok) {
        const errBody = await mlResp.text().catch(() => "");
        console.error(`[ML-Gateway] ML service error [${mlResp.status}]:`, errBody.slice(0, 300));

        return new Response(
          JSON.stringify({
            error: "ml_service_error",
            message: "ML engine returned an error. Falling back to deterministic analysis.",
            status: mlResp.status,
            fallback: true,
          }),
          { status: 502, headers: jsonHeaders }
        );
      }

      mlData = await mlResp.json();
    } catch (err: any) {
      clearTimeout(timeout);

      if (err?.name === "AbortError") {
        console.warn(`[ML-Gateway] ML service timed out after ${ML_TIMEOUT_MS / 1000}s`);
        return new Response(
          JSON.stringify({
            error: "ml_timeout",
            message: "ML engine is waking up. Analysis will use our deterministic engine.",
            timeout_ms: ML_TIMEOUT_MS,
            fallback: true,
          }),
          { status: 504, headers: jsonHeaders }
        );
      }

      console.error(`[ML-Gateway] ML service unreachable:`, err);
      return new Response(
        JSON.stringify({
          error: "ml_unreachable",
          message: "ML engine is currently unavailable. Using deterministic analysis.",
          fallback: true,
        }),
        { status: 503, headers: jsonHeaders }
      );
    }

    // ══════════════════════════════════════════════════════════
    // UPDATE RATE LIMIT COUNTER
    // ══════════════════════════════════════════════════════════
    if (currentLimit) {
      await supabase
        .from("scan_rate_limits")
        .update({ scan_count: currentLimit.scan_count + 1 })
        .eq("id", currentLimit.id);
    } else {
      await supabase
        .from("scan_rate_limits")
        .insert({
          client_ip: ip,
          scan_count: 1,
          window_start: now.toISOString(),
          window_end: new Date(now.getTime() + RATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
        });
    }

    // ══════════════════════════════════════════════════════════
    // CACHE THE RESULT
    // ══════════════════════════════════════════════════════════
    if (scanId) {
      await supabase
        .from("scans")
        .update({
          ml_insights_hash: cacheKey,
          ml_insights_cached_at: now.toISOString(),
        })
        .eq("id", scanId);
    }

    console.log(`[ML-Gateway] ${endpoint} succeeded, rate: ${(currentLimit?.scan_count || 0) + 1}/${RATE_LIMIT_MAX}`);

    return new Response(
      JSON.stringify(mlData),
      { status: 200, headers: jsonHeaders }
    );

  } catch (error) {
    console.error("[ML-Gateway] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "gateway_error",
        message: "Internal gateway error. Using deterministic analysis.",
        fallback: true,
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
