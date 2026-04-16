import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  try {
    const sb = createAdminClient();

    // Verify admin role from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries
    const [
      usageRes,
      alertsRes,
      recentErrorsRes,
      usersRes,
      scansRes,
      scans7dRes,
      profilesRes,
      agent1QualityRes,
      funnelEventsRes,
      tokenCostRes,
    ] = await Promise.all([
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
      // Total users
      sb.from("profiles")
        .select("id", { count: "exact", head: true }),
      // Total scans
      sb.from("scans")
        .select("id", { count: "exact", head: true }),
      // Scans last 7 days
      sb.from("scans")
        .select("id, scan_status, created_at, industry, role_detected, user_id")
        .gte("created_at", last7d)
        .order("created_at", { ascending: false })
        .limit(100),
      // Recent users
      sb.from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      // Agent1 quality logs (last 7 days)
      sb.from("edge_function_logs")
        .select("status, request_meta, created_at")
        .eq("function_name", "process-scan:agent1-quality")
        .gte("created_at", last7d)
        .order("created_at", { ascending: false })
        .limit(200),
      // Funnel events (last 7 days)
      sb.from("beta_events")
        .select("event_type, created_at, payload")
        .gte("created_at", last7d)
        .in("event_type", [
          "landing_view", "cta_click", "input_method_selected",
          "auth_complete", "scan_start", "scan_complete",
          "score_view", "tab_view", "share_click", "pdf_download",
          "micro_feedback", "error_view",
        ])
        .order("created_at", { ascending: false })
        .limit(1000),
      // Token usage (last 7 days) grouped by function
      sb.from("token_usage_log")
        .select("function_name, model, total_tokens, estimated_cost_usd, created_at")
        .gte("created_at", last7d)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const usage = usageRes.data || [];
    const totalCalls = usage.reduce((s, u) => s + (u.call_count || 0), 0);
    const totalErrors = usage.reduce((s, u) => s + (u.error_count || 0), 0);
    const errorRate = totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100) : 0;

    // LLM cost estimation (rough: $0.01 per call average across models)
    const llmFunctions = ["process-scan", "chat-report", "career-intel", "bluff-boss", "fake-it", "weaponized-laziness", "optimize-pivots"];
    const llmCalls = usage
      .filter(u => llmFunctions.includes(u.function_name))
      .reduce((s, u) => s + (u.call_count || 0), 0);
    const estimatedCostUsd = Math.round(llmCalls * 0.15 * 100) / 100; // ~$0.15 avg per LLM-heavy call

    // Scan status breakdown
    const scans7d = scans7dRes.data || [];
    const scansByStatus: Record<string, number> = {};
    for (const s of scans7d) {
      scansByStatus[s.scan_status || "unknown"] = (scansByStatus[s.scan_status || "unknown"] || 0) + 1;
    }

    // Agent1 quality metrics
    const agent1Logs = (agent1QualityRes.data || []) as any[];
    const a1Total = agent1Logs.length;
    const a1Success = agent1Logs.filter(l => l.status === "success").length;
    const a1Timeouts = a1Total - a1Success;
    const a1SuccessRate = a1Total > 0 ? Math.round((a1Success / a1Total) * 100) : 0;
    const a1WithFallbacks = agent1Logs.filter(l => {
      const fb = l.request_meta?.fallbacks_used;
      return Array.isArray(fb) && fb.length > 0;
    }).length;
    const a1FallbackRate = a1Total > 0 ? Math.round((a1WithFallbacks / a1Total) * 100) : 0;
    const a1SkillCounts = agent1Logs
      .filter(l => l.status === "success")
      .map(l => l.request_meta?.skills_extracted || 0);
    const a1AvgSkills = a1SkillCounts.length > 0
      ? Math.round(a1SkillCounts.reduce((s: number, n: number) => s + n, 0) / a1SkillCounts.length * 10) / 10
      : 0;

    // Recent agent1 entries for detail table
    const agent1Recent = agent1Logs.slice(0, 10).map(l => ({
      status: l.status,
      role: l.request_meta?.role_detected || l.request_meta?.role_hint || "—",
      seniority: l.request_meta?.seniority || "—",
      skills: l.request_meta?.skills_extracted || 0,
      fallbacks: l.request_meta?.fallbacks_used || [],
      job_family: l.request_meta?.job_family_matched || "—",
      created_at: l.created_at,
    }));

    // Funnel analytics
    const funnelEvents = funnelEventsRes.data || [];
    const funnelCounts: Record<string, number> = {};
    const microFeedbackStats: Record<string, { up: number; down: number }> = {};
    for (const ev of funnelEvents) {
      funnelCounts[ev.event_type] = (funnelCounts[ev.event_type] || 0) + 1;
      if (ev.event_type === "micro_feedback" && ev.payload) {
        const p = ev.payload as any;
        const cardId = p.card_id || "unknown";
        if (!microFeedbackStats[cardId]) microFeedbackStats[cardId] = { up: 0, down: 0 };
        if (p.vote === "up") microFeedbackStats[cardId].up++;
        else microFeedbackStats[cardId].down++;
      }
    }

    // Build funnel stages in order
    const funnelStages = [
      { stage: "Landing View", count: funnelCounts["landing_view"] || 0 },
      { stage: "CTA Click", count: funnelCounts["cta_click"] || 0 },
      { stage: "Input Selected", count: funnelCounts["input_method_selected"] || 0 },
      { stage: "Auth Complete", count: funnelCounts["auth_complete"] || 0 },
      { stage: "Scan Start", count: funnelCounts["scan_start"] || 0 },
      { stage: "Scan Complete", count: funnelCounts["scan_complete"] || 0 },
      { stage: "Score View", count: funnelCounts["score_view"] || 0 },
      { stage: "Tab View", count: funnelCounts["tab_view"] || 0 },
      { stage: "Share Click", count: funnelCounts["share_click"] || 0 },
    ];

    // ─── Token cost aggregation (actual vs estimated) ───
    const FUNCTION_COST_WEIGHTS: Record<string, number> = {
      "process-scan": 0.50, "chat-report": 0.05, "career-intel": 0.08,
      "live-enrich": 0.12, "live-market": 0.03, "company-news": 0.03,
      "generate-weekly-brief": 0.10, "optimize-pivots": 0.06, "simulate-skill": 0.04,
      "generate-side-hustles": 0.30, "ai-dossier": 0.15, "cheat-sheet": 0.08,
      "bluff-boss": 0.05, "weaponized-laziness": 0.05, "fake-it": 0.05,
      "career-landscape": 0.08, "resume-weaponizer": 0.15, "best-fit-jobs": 0.10,
      "career-genome": 0.12, "skill-arbitrage": 0.10, "startup-autopsy": 0.20,
      "run-pivot-analysis": 0.12, "coach-nudge": 0.05,
    };

    const tokenLogs = tokenCostRes.data || [];
    const costByFunction: Record<string, { actual_cost: number; actual_tokens: number; call_count: number; models: Record<string, number> }> = {};
    for (const log of tokenLogs) {
      const fn = log.function_name;
      if (!costByFunction[fn]) costByFunction[fn] = { actual_cost: 0, actual_tokens: 0, call_count: 0, models: {} };
      costByFunction[fn].actual_cost += log.estimated_cost_usd || 0;
      costByFunction[fn].actual_tokens += log.total_tokens || 0;
      costByFunction[fn].call_count += 1;
      costByFunction[fn].models[log.model] = (costByFunction[fn].models[log.model] || 0) + 1;
    }

    const tokenCostComparison = Object.entries(costByFunction).map(([fn, data]) => {
      const estimatedPerCall = FUNCTION_COST_WEIGHTS[fn] || 0.02;
      const actualPerCall = data.call_count > 0 ? Math.round((data.actual_cost / data.call_count) * 10000) / 10000 : 0;
      const variance = estimatedPerCall > 0 ? Math.round(((actualPerCall - estimatedPerCall) / estimatedPerCall) * 100) : 0;
      return {
        function_name: fn,
        calls_7d: data.call_count,
        actual_total_cost: Math.round(data.actual_cost * 10000) / 10000,
        actual_per_call: actualPerCall,
        estimated_per_call: estimatedPerCall,
        variance_pct: variance,
        total_tokens: data.actual_tokens,
        top_model: Object.entries(data.models).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
      };
    }).sort((a, b) => b.actual_total_cost - a.actual_total_cost);

    const totalActualCost7d = tokenCostComparison.reduce((s, c) => s + c.actual_total_cost, 0);
    const totalEstimatedCost7d = tokenCostComparison.reduce((s, c) => s + c.estimated_per_call * c.calls_7d, 0);

    return new Response(JSON.stringify({
      summary: {
        date: today,
        total_calls: totalCalls,
        total_errors: totalErrors,
        error_rate_pct: errorRate,
        functions_active: usage.length,
        total_users: usersRes.count || 0,
        total_scans: scansRes.count || 0,
        scans_7d: scans7d.length,
        estimated_cost_usd_today: estimatedCostUsd,
        llm_calls_today: llmCalls,
      },
      usage_by_function: usage,
      active_alerts: alertsRes.data || [],
      recent_errors: (recentErrorsRes.data || []).slice(0, 20),
      scans_by_status: scansByStatus,
      recent_scans: scans7d.slice(0, 20),
      recent_users: profilesRes.data || [],
      agent1_quality: {
        total: a1Total,
        success: a1Success,
        timeouts: a1Timeouts,
        success_rate_pct: a1SuccessRate,
        fallback_rate_pct: a1FallbackRate,
        avg_skills_extracted: a1AvgSkills,
        recent: agent1Recent,
      },
      funnel: {
        stages: funnelStages,
        micro_feedback: microFeedbackStats,
        total_events_7d: funnelEvents.length,
      },
      token_costs: {
        total_actual_7d: Math.round(totalActualCost7d * 100) / 100,
        total_estimated_7d: Math.round(totalEstimatedCost7d * 100) / 100,
        overall_variance_pct: totalEstimatedCost7d > 0 ? Math.round(((totalActualCost7d - totalEstimatedCost7d) / totalEstimatedCost7d) * 100) : 0,
        by_function: tokenCostComparison,
        total_token_calls_7d: tokenLogs.length,
      },
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[admin-dashboard] error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
