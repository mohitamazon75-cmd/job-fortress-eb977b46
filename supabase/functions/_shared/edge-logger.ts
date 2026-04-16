// ═══════════════════════════════════════════════════════════════
// Edge Logger — structured error logging + usage tracking
// Import in any edge function to auto-log errors and track calls
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";

let _sb: ReturnType<typeof createClient> | null = null;

function getSb() {
  if (!_sb) {
    _sb = createAdminClient();
  }
  return _sb;
}

interface LogErrorOpts {
  functionName: string;
  errorMessage: string;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

/** Log an error to edge_function_logs table */
export async function logEdgeError(opts: LogErrorOpts): Promise<void> {
  try {
    await getSb().from("edge_function_logs").insert({
      function_name: opts.functionName,
      status: "error",
      error_message: opts.errorMessage.slice(0, 2000),
      error_code: opts.errorCode || null,
      request_meta: opts.meta || {},
    });
  } catch (e) {
    console.error("[EdgeLogger] Failed to log error:", e);
  }
}

/** Log a warning */
export async function logEdgeWarning(functionName: string, message: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    await getSb().from("edge_function_logs").insert({
      function_name: functionName,
      status: "warning",
      error_message: message.slice(0, 2000),
      request_meta: meta || {},
    });
  } catch (e) {
    console.error("[EdgeLogger] Failed to log warning:", e);
  }
}

const DAILY_CALL_THRESHOLD = 500; // Alert if exceeded

/** Increment daily usage counter and check for cost spike */
export async function trackUsage(functionName: string, isError: boolean, latencyMs?: number): Promise<void> {
  try {
    const sb = getSb();
    const today = new Date().toISOString().slice(0, 10);

    // Upsert daily stats
    const { data: existing } = await sb
      .from("daily_usage_stats")
      .select("id, call_count, error_count")
      .eq("stat_date", today)
      .eq("function_name", functionName)
      .maybeSingle();

    if (existing) {
      const ex = existing as { id: string; call_count: number; error_count: number };
      await sb
        .from("daily_usage_stats")
        .update({
          call_count: ex.call_count + 1,
          error_count: ex.error_count + (isError ? 1 : 0),
          avg_latency_ms: latencyMs || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ex.id);

      // Check daily threshold
      const newCount = ex.call_count + 1;
      if (newCount === DAILY_CALL_THRESHOLD || newCount === DAILY_CALL_THRESHOLD * 2) {
        await sb.from("monitoring_alerts").insert({
          alert_type: "cost_spike",
          function_name: functionName,
          message: `${functionName} hit ${newCount} calls today (threshold: ${DAILY_CALL_THRESHOLD})`,
          severity: newCount >= DAILY_CALL_THRESHOLD * 2 ? "critical" : "warning",
        });
      }
    } else {
      await sb.from("daily_usage_stats").insert({
        stat_date: today,
        function_name: functionName,
        call_count: 1,
        error_count: isError ? 1 : 0,
        avg_latency_ms: latencyMs || null,
      });
    }
  } catch (e) {
    console.error("[EdgeLogger] Failed to track usage:", e);
  }
}

/** Track per-agent latency telemetry in daily_usage_stats */
export async function trackAgentLatency(
  agentName: string,
  latencyMs: number,
  timedOut: boolean,
  model: string,
): Promise<void> {
  try {
    const sb = getSb();
    const today = new Date().toISOString().slice(0, 10);
    const fnName = `agent:${agentName}`;

    const { data: existing } = await sb
      .from("daily_usage_stats")
      .select("id, call_count, error_count, avg_latency_ms")
      .eq("stat_date", today)
      .eq("function_name", fnName)
      .maybeSingle();

    if (existing) {
      const ex = existing as { id: string; call_count: number; error_count: number; avg_latency_ms: number | null };
      // Running average for latency
      const prevAvg = ex.avg_latency_ms || latencyMs;
      const newAvg = Math.round((prevAvg * ex.call_count + latencyMs) / (ex.call_count + 1));
      await sb
        .from("daily_usage_stats")
        .update({
          call_count: ex.call_count + 1,
          error_count: ex.error_count + (timedOut ? 1 : 0),
          avg_latency_ms: newAvg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ex.id);
    } else {
      await sb.from("daily_usage_stats").insert({
        stat_date: today,
        function_name: fnName,
        call_count: 1,
        error_count: timedOut ? 1 : 0,
        avg_latency_ms: Math.round(latencyMs),
      });
    }
  } catch (e) {
    console.error("[EdgeLogger] Failed to track agent latency:", e);
  }
}

/**
 * Wraps an edge function handler with automatic usage tracking and error logging.
 * Usage: export default withMonitoring("my-function", handler)
 */
export function withMonitoring(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const start = Date.now();
    try {
      const response = await handler(req);
      const latency = Date.now() - start;
      const isError = response.status >= 400;

      // Fire-and-forget tracking
      trackUsage(functionName, isError, latency).catch(() => {});

      if (isError && response.status >= 500) {
        const body = await response.clone().text().catch(() => "unknown");
        logEdgeError({
          functionName,
          errorMessage: `HTTP ${response.status}: ${body.slice(0, 500)}`,
          errorCode: String(response.status),
        }).catch(() => {});
      }

      return response;
    } catch (e) {
      const latency = Date.now() - start;
      const errMsg = e instanceof Error ? e.message : String(e);

      // Log error + track usage in parallel
      Promise.all([
        logEdgeError({ functionName, errorMessage: errMsg, errorCode: "UNHANDLED" }),
        trackUsage(functionName, true, latency),
      ]).catch(() => {});

      throw e; // Re-throw to let the function's own error handler deal with it
    }
  };
}
