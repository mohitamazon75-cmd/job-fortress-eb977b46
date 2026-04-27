/**
 * @fileoverview Admin-only funnel analytics. Returns daily counts of the
 * Model B post-scan reveal funnel events plus the top of-funnel signals
 * from `analytics_events`.
 *
 * Why a dedicated function (not folded into admin-dashboard):
 *   - admin-dashboard is 360 LOC; CLAUDE.md Rule 9 says ask before
 *     modifying files >300 LOC. Standing up a sibling is cheaper.
 *   - This endpoint may evolve fast as we add events; isolating it keeps
 *     the operations dashboard contract stable.
 */

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface DailyBucket {
  day: string;
  events: Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  try {
    const sb = createAdminClient();

    // ── Auth: admin role required ────────────────────────────────────────
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
    const { data: role } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Range: last 14 days, configurable via ?days= ─────────────────────
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") || 14), 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Pull both event streams in parallel. We aggregate in JS — at current
    // volumes (~hundreds of rows) this is trivial; if it grows past tens of
    // thousands move to a SQL view.
    const [analyticsRes, behaviorRes, scansRes] = await Promise.all([
      sb.from("analytics_events")
        .select("event_type, payload, created_at")
        .gte("created_at", since)
        .limit(10_000),
      sb.from("behavior_events")
        .select("event_name, created_at, scan_id")
        .gte("created_at", since)
        .limit(10_000),
      sb.from("scans")
        .select("id, created_at, status")
        .gte("created_at", since)
        .limit(10_000),
    ]);

    const analytics = analyticsRes.data ?? [];
    const behavior = behaviorRes.data ?? [];
    const scans = scansRes.data ?? [];

    // ── Daily buckets ────────────────────────────────────────────────────
    const buckets = new Map<string, DailyBucket>();
    const ensure = (day: string) => {
      let b = buckets.get(day);
      if (!b) {
        b = { day, events: {} };
        buckets.set(day, b);
      }
      return b;
    };
    const seed = (rows: any[], key: string) => {
      for (const r of rows) {
        const day = (r.created_at as string).slice(0, 10);
        const ev = r[key] as string;
        if (!ev) continue;
        const b = ensure(day);
        b.events[ev] = (b.events[ev] || 0) + 1;
      }
    };
    seed(analytics, "event_type");
    seed(behavior, "event_name");
    for (const s of scans) {
      const day = (s.created_at as string).slice(0, 10);
      const b = ensure(day);
      const k = `scan_${s.status || "unknown"}`;
      b.events[k] = (b.events[k] || 0) + 1;
    }
    const daily = Array.from(buckets.values()).sort((a, b) => a.day.localeCompare(b.day));

    // ── Funnel summary across the entire window ──────────────────────────
    // Order matches the actual user journey so drop-off is visually obvious.
    const FUNNEL_ORDER = [
      "landing_view",
      "landing_scroll_depth",   // ← NEW: did they scroll past the fold?
      "cta_click",
      "auth_complete",
      "input_method_selected",
      "scan_start",
      "scan_complete",
      "result_loaded",          // ← from useScanFunnelTracking
      "card_viewed",
      "share_opened",
      "journey_completed",
      "cta_post_reveal",
    ];
    const totals: Record<string, number> = {};
    for (const b of daily) {
      for (const [k, v] of Object.entries(b.events)) {
        totals[k] = (totals[k] || 0) + v;
      }
    }
    const funnel = FUNNEL_ORDER.map((event) => ({
      event,
      count: totals[event] || 0,
    }));

    // ── Reach: how many distinct scan_ids fired result_loaded ────────────
    const reachedResultScanIds = new Set(
      behavior
        .filter((b) => b.event_name === "result_loaded" && b.scan_id)
        .map((b) => b.scan_id),
    );
    const completedJourneyScanIds = new Set(
      behavior
        .filter((b) => b.event_name === "journey_completed" && b.scan_id)
        .map((b) => b.scan_id),
    );

    // ── Scroll-depth distribution (the "did they bounce above the fold?" answer)
    const scrollDepth = { "25": 0, "50": 0, "75": 0, "100": 0 };
    let landingViewsTotal = 0;
    let landingViewsReturning = 0;
    const refHostCounts = new Map<string, number>();
    for (const a of analytics) {
      const payload = (a as any).payload || {};
      if (a.event_type === "landing_scroll_depth") {
        const bucket = String(payload.bucket || "");
        if (bucket in scrollDepth) {
          scrollDepth[bucket as keyof typeof scrollDepth]++;
        }
      }
      if (a.event_type === "landing_view") {
        landingViewsTotal++;
        if (payload.is_returning) landingViewsReturning++;
        const host = payload.referrer_host || "(direct)";
        refHostCounts.set(host, (refHostCounts.get(host) || 0) + 1);
      }
    }
    const referrers = Array.from(refHostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));

    return new Response(
      JSON.stringify({
        window_days: days,
        funnel,
        daily,
        reach: {
          scans_in_window: scans.length,
          unique_scans_reaching_result: reachedResultScanIds.size,
          unique_scans_completing_journey: completedJourneyScanIds.size,
        },
        landing: {
          views_total: landingViewsTotal,
          views_returning: landingViewsReturning,
          views_new: landingViewsTotal - landingViewsReturning,
          scroll_depth_buckets: scrollDepth,
          top_referrers: referrers,
        },
        totals,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[admin-funnel] error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
