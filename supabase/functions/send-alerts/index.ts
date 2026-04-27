// ═══════════════════════════════════════════════════════════════
// SEND-ALERTS — Queries unacknowledged monitoring_alerts and
// forwards them to a configured webhook (Slack/Discord/email).
// Designed to be called by pg_cron every 5 minutes.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createAdminClient();

    // Fetch unacknowledged alerts from last 30 minutes
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: alerts, error } = await supabase
      .from("monitoring_alerts")
      .select("*")
      .eq("acknowledged", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[SendAlerts] DB query failed:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch alerts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: "No pending alerts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Also fetch daily spending stats for context
    const today = new Date().toISOString().split("T")[0];
    const { data: stats } = await supabase
      .from("daily_usage_stats")
      .select("function_name, call_count, error_count, avg_latency_ms")
      .eq("stat_date", today);

    const totalCalls = (stats || []).reduce((sum: number, s: any) => sum + s.call_count, 0);
    const totalErrors = (stats || []).reduce((sum: number, s: any) => sum + s.error_count, 0);

    // Build alert payload
    const criticalCount = alerts.filter((a: any) => a.severity === "critical").length;
    const warnCount = alerts.filter((a: any) => a.severity === "warning").length;

    const alertSummary = alerts
      .map((a: any) => `[${a.severity.toUpperCase()}] ${a.alert_type}: ${a.message} (${a.function_name || "system"})`)
      .join("\n");

    const payload = {
      text: `🚨 *JobBachao Alert Summary* (${alerts.length} unacknowledged)\n\n` +
        `Critical: ${criticalCount} | Warning: ${warnCount}\n` +
        `Today's usage: ${totalCalls} calls, ${totalErrors} errors\n\n` +
        `\`\`\`\n${alertSummary}\n\`\`\``,
    };

    // Send to webhook if configured
    const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL");
    if (webhookUrl) {
      try {
        const webhookResp = await fetchWithTimeout(webhookUrl, {
          method: "POST",
          timeoutMs: 10000,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!webhookResp.ok) {
          const errText = await webhookResp.text();
          console.error("[SendAlerts] Webhook failed:", webhookResp.status, errText);
        } else {
          await webhookResp.text(); // consume body
          console.log(`[SendAlerts] Sent ${alerts.length} alerts to webhook`);

          // Mark alerts as acknowledged
          const alertIds = alerts.map((a: any) => a.id);
          await supabase
            .from("monitoring_alerts")
            .update({ acknowledged: true })
            .in("id", alertIds);
        }
      } catch (e) {
        console.error("[SendAlerts] Webhook error:", e);
      }
    } else {
      console.warn("[SendAlerts] No ALERT_WEBHOOK_URL configured — alerts logged only");
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        alerts_found: alerts.length,
        critical: criticalCount,
        warning: warnCount,
        webhook_configured: !!webhookUrl,
        daily_stats: { total_calls: totalCalls, total_errors: totalErrors },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[SendAlerts] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
