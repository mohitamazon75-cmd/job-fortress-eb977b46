// ═══════════════════════════════════════════════════════════════
// Monitoring Dashboard API — aggregates error + usage data
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  try {
    const sb = createAdminClient();

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries
    const [usageRes, alertsRes, recentErrorsRes] = await Promise.all([
      sb.from("daily_usage_stats")
        .select("*")
        .eq("stat_date", today)
        .order("call_count", { ascending: false }),
      sb.from("monitoring_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20),
      sb.from("edge_function_logs")
        .select("function_name, status, error_message, error_code, created_at")
        .gte("created_at", last24h)
        .eq("status", "error")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const usage = usageRes.data || [];
    const totalCalls = usage.reduce((s, u) => s + (u.call_count || 0), 0);
    const totalErrors = usage.reduce((s, u) => s + (u.error_count || 0), 0);
    const errorRate = totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100) : 0;

    // Group errors by function
    const errorsByFunction: Record<string, number> = {};
    for (const err of recentErrorsRes.data || []) {
      errorsByFunction[err.function_name] = (errorsByFunction[err.function_name] || 0) + 1;
    }

    return new Response(JSON.stringify({
      summary: {
        date: today,
        total_calls: totalCalls,
        total_errors: totalErrors,
        error_rate_pct: errorRate,
        functions_active: usage.length,
      },
      usage_by_function: usage,
      active_alerts: alertsRes.data || [],
      recent_errors: (recentErrorsRes.data || []).slice(0, 20),
      errors_by_function: errorsByFunction,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[monitoring-dashboard] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
