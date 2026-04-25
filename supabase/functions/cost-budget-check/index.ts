// ═══════════════════════════════════════════════════════════════
// COST-BUDGET-CHECK — Aggregates today's token_usage_log and writes
// a monitoring_alerts row when AI spend crosses configured thresholds.
//
// Designed to be called by pg_cron once per hour. No rate limiting,
// no automated kill-switches — just visibility for the operator.
//
// Thresholds (defaults; override via env):
//   COST_BUDGET_WARN_USD    — default $5/day  (warning)
//   COST_BUDGET_CRIT_USD    — default $20/day (critical)
//
// Idempotency: only one alert per (severity, day) — we look for an
// unacked alert with the same severity created today before inserting.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const warnThreshold = Number(Deno.env.get("COST_BUDGET_WARN_USD") ?? "5");
  const critThreshold = Number(Deno.env.get("COST_BUDGET_CRIT_USD") ?? "20");

  try {
    const sb = createAdminClient();

    // Sum today's spend (UTC day; close enough for a soft launch)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();

    const { data: rows, error } = await sb
      .from("token_usage_log")
      .select("estimated_cost_usd, total_tokens, function_name")
      .gte("created_at", startOfDay);

    if (error) {
      console.error("[CostBudgetCheck] Query failed:", error.message);
      return new Response(JSON.stringify({ error: "query_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list = rows ?? [];
    const totalUsd = list.reduce((s: number, r: any) => s + Number(r.estimated_cost_usd || 0), 0);
    const totalTokens = list.reduce((s: number, r: any) => s + Number(r.total_tokens || 0), 0);
    const callCount = list.length;

    // Top 3 cost contributors
    const byFn: Record<string, number> = {};
    for (const r of list as any[]) {
      const fn = r.function_name || "unknown";
      byFn[fn] = (byFn[fn] || 0) + Number(r.estimated_cost_usd || 0);
    }
    const topFns = Object.entries(byFn)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([fn, usd]) => `${fn}=$${usd.toFixed(2)}`)
      .join(", ");

    let severity: "critical" | "warning" | null = null;
    if (totalUsd >= critThreshold) severity = "critical";
    else if (totalUsd >= warnThreshold) severity = "warning";

    let inserted = false;
    if (severity) {
      // Idempotency: skip if an unacked alert with same severity already exists today
      const { data: existing } = await sb
        .from("monitoring_alerts")
        .select("id")
        .eq("alert_type", "ai_cost_threshold")
        .eq("severity", severity)
        .eq("acknowledged", false)
        .gte("created_at", startOfDay)
        .limit(1);

      if (!existing || existing.length === 0) {
        const message = `AI spend today: $${totalUsd.toFixed(2)} across ${callCount} calls (${totalTokens.toLocaleString()} tokens). Top: ${topFns || "n/a"}.`;
        const { error: insErr } = await sb.from("monitoring_alerts").insert({
          alert_type: "ai_cost_threshold",
          severity,
          function_name: null,
          message,
        });
        if (insErr) console.error("[CostBudgetCheck] Insert failed:", insErr.message);
        else inserted = true;
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        today_usd: Math.round(totalUsd * 100) / 100,
        today_tokens: totalTokens,
        today_calls: callCount,
        thresholds: { warn: warnThreshold, crit: critThreshold },
        severity,
        alert_inserted: inserted,
        top_functions: byFn,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[CostBudgetCheck] Fatal:", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
