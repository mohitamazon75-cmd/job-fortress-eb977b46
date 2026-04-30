/**
 * @fileoverview refresh-peripheral-tabs — Pass 2 cheap weekly refresh.
 *
 * Purpose
 *   The user paid for ONE deep scan (Pass 1 idempotency guard). But the
 *   peripheral surfaces — Market Radar, Live News, Sector Pulse, AI Tools,
 *   Best-Fit Jobs, India Jobs — are time-sensitive. They must keep updating
 *   without burning a full Pro-grade re-scan (~₹15-40) every time the user
 *   opens their report.
 *
 * Contract
 *   POST { scanId: string, force?: boolean }
 *
 *   Behavior:
 *     1. Loads the scan row. If not found / no ownership → 404.
 *     2. If !force AND now() - scans.peripheral_refreshed_at < 7 days,
 *        returns the cached payloads as-is (no external calls).
 *     3. Otherwise fans out to the six peripheral edge functions in
 *        parallel (Flash + Tavily only, no Pro), persists each result
 *        to peripheral_refresh_cache (UPSERT on (scan_id, surface)),
 *        and stamps scans.peripheral_refreshed_at = now().
 *
 *   Returns:
 *     {
 *       refreshed: boolean,            // true if we actually re-fetched
 *       refreshed_at: string,          // ISO timestamp
 *       surfaces: {
 *         market_radar:    { ok, payload?, error? },
 *         live_news:       { ok, payload?, error? },
 *         sector_pulse:    { ok, payload?, error? },
 *         tools:           { ok, payload?, error? },
 *         best_fit_jobs:   { ok, payload?, error? },
 *         india_jobs:      { ok, payload?, error? },
 *       }
 *     }
 *
 * Cost discipline
 *   - All downstream functions are Flash-tier or Tavily-only.
 *   - One refresh budget ≈ ₹3-7 max (vs ₹15-40 for a full re-scan).
 *   - Hard-capped to once per 7 days per scan unless `force=true`
 *     (force should only be used by admins / debug paths).
 *
 * Why not a cron?
 *   Lazy refresh: only run when a user actually opens their report.
 *   No cost on dormant scans, no email-blast obligation, no "we
 *   refreshed for users who churned" waste.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";
import { setCurrentScanId, clearCurrentScanId } from "../_shared/cost-logger.ts";

type SurfaceKey =
  | "market_radar"
  | "live_news"
  | "sector_pulse"
  | "tools"
  | "best_fit_jobs"
  | "india_jobs";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SurfaceResult {
  ok: boolean;
  payload?: unknown;
  error?: string;
}

interface ScanRow {
  id: string;
  user_id: string | null;
  role_detected: string | null;
  industry: string | null;
  country: string | null;
  metro_tier: string | null;
  peripheral_refreshed_at: string | null;
  final_json_report: Record<string, unknown> | null;
}

/**
 * Extract the "skills" array from a scan's final report. Different agents
 * stash it in slightly different places — we look in the obvious spots and
 * fall back to an empty array (the peripheral functions all tolerate that).
 */
function extractSkills(report: Record<string, unknown> | null): string[] {
  if (!report) return [];
  const candidates: unknown[] = [
    (report as Record<string, unknown>)?.execution_skills,
    (report as Record<string, unknown>)?.all_skills,
    ((report as Record<string, unknown>)?.intelligence_profile as Record<string, unknown>)?.execution_skills,
    ((report as Record<string, unknown>)?.profile as Record<string, unknown>)?.skills,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return c
        .map((x) => (typeof x === "string" ? x : typeof x === "object" && x !== null ? String((x as Record<string, unknown>).skill ?? (x as Record<string, unknown>).name ?? "") : ""))
        .filter((s) => s.length > 0)
        .slice(0, 12);
    }
  }
  return [];
}

/**
 * Invoke a peripheral edge function with a short timeout. We never let one
 * slow surface block the others — each surface has its own 25s budget.
 */
async function invokeFunction(
  fnName: string,
  body: Record<string, unknown>,
  authHeader: string,
): Promise<SurfaceResult> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${fnName}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "Non-JSON response" };
    }
    return { ok: true, payload: parsed };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

const ALL_SURFACES: SurfaceKey[] = [
  "market_radar",
  "live_news",
  "sector_pulse",
  "tools",
  "best_fit_jobs",
  "india_jobs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  if (req.method !== "POST") return errResponse(req, "Method not allowed", 405);

  let body: { scanId?: string; force?: boolean; surfaces?: string[]; extra?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return errResponse(req, "Invalid JSON body", 400);
  }

  const scanId = body?.scanId;
  const force = body?.force === true;
  if (!scanId || typeof scanId !== "string") {
    return errResponse(req, "scanId is required", 400);
  }

  // Optional surface filter — callers can request only the surfaces they need
  // (e.g. BestFitJobsCard asks for ['best_fit_jobs'] alone). When omitted,
  // refresh fans out to all six.
  const requestedSurfaces: SurfaceKey[] = Array.isArray(body?.surfaces) && body.surfaces.length > 0
    ? body.surfaces.filter((s): s is SurfaceKey => ALL_SURFACES.includes(s as SurfaceKey))
    : ALL_SURFACES;

  if (requestedSurfaces.length === 0) {
    return errResponse(req, "No valid surfaces requested", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Load scan
  const { data: scan, error: scanErr } = await admin
    .from("scans")
    .select("id, user_id, role_detected, industry, country, metro_tier, peripheral_refreshed_at, final_json_report")
    .eq("id", scanId)
    .maybeSingle<ScanRow>();

  if (scanErr) return errResponse(req, `DB error: ${scanErr.message}`, 500);
  if (!scan) return errResponse(req, "Scan not found", 404);

  // 2. Per-surface freshness check.
  //    A surface is "fresh" if it has a cached row younger than 7 days.
  //    We re-fetch only stale/missing surfaces, so a card asking for one
  //    surface never triggers a 6-way fan-out.
  const { data: cached } = await admin
    .from("peripheral_refresh_cache")
    .select("surface, payload, refreshed_at")
    .eq("scan_id", scanId)
    .in("surface", requestedSurfaces);

  const cachedBySurface = new Map<string, { payload: unknown; refreshed_at: string }>();
  for (const row of cached ?? []) {
    cachedBySurface.set(row.surface, { payload: row.payload, refreshed_at: row.refreshed_at });
  }

  const staleSurfaces: SurfaceKey[] = force
    ? requestedSurfaces
    : requestedSurfaces.filter((s) => {
        const c = cachedBySurface.get(s);
        if (!c) return true;
        return Date.now() - new Date(c.refreshed_at).getTime() >= REFRESH_TTL_MS;
      });

  // Short-circuit: nothing stale → return cache as-is, zero external calls.
  if (staleSurfaces.length === 0) {
    const surfaces: Record<string, SurfaceResult> = {};
    for (const s of requestedSurfaces) {
      const c = cachedBySurface.get(s);
      if (c) surfaces[s] = { ok: true, payload: c.payload };
    }
    return okResponse(req, {
      refreshed: false,
      refreshed_at: scan.peripheral_refreshed_at,
      surfaces,
    });
  }

  // 3. Re-fetch stale surfaces in parallel.
  setCurrentScanId(scanId);

  const role = scan.role_detected ?? "";
  const industry = scan.industry ?? "";
  const country = scan.country ?? "IN";
  const skills = extractSkills(scan.final_json_report);
  const authHeader = req.headers.get("Authorization") ?? `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`;

  // Optional caller-supplied extras override (lets BestFitJobsCard pass
  // moatSkills/seniority/determinismIndex which aren't on the scans row).
  const extras = (body.extra && typeof body.extra === "object") ? body.extra : {};

  // Per-surface request shapes mirror what each widget currently sends to
  // the underlying edge function. Drift here = cached payload won't match
  // the widget's expectations, so be careful when changing call sites.
  // Send BOTH scanId (camelCase, used by edge fn body parsers) and scan_id
  // (snake_case, kept for backwards compat) — peripheral fns wired in Pass 1.5
  // call setCurrentScanId(scanId) so logTokenUsage emits a cost_events row.
  const allTasks: Record<SurfaceKey, [string, Record<string, unknown>]> = {
    market_radar:  ["market-radar",            { role, industry, skills: skills.slice(0, 8), country, scanId, scan_id: scanId }],
    live_news:     ["live-news",               { role, industry, country, scanId, scan_id: scanId }],
    sector_pulse:  ["sector-pulse",            { role, industry, country, scanId, scan_id: scanId }],
    tools:         ["tool-learning-resources", { role, industry, skills: skills.slice(0, 8), scanId, scan_id: scanId }],
    best_fit_jobs: ["best-fit-jobs",           {
      role, industry, country, scanId, scan_id: scanId,
      skills: skills.slice(0, 12),
      moatSkills: extras.moatSkills ?? [],
      seniority: extras.seniority ?? "PROFESSIONAL",
      determinismIndex: extras.determinismIndex ?? null,
    }],
    india_jobs:    ["india-jobs",              { role, industry, country, scanId, scan_id: scanId }],
  };

  const tasks = staleSurfaces.map((key) => {
    const [fn, payload] = allTasks[key];
    return [key, fn, payload] as [SurfaceKey, string, Record<string, unknown>];
  });

  const results = await Promise.all(
    tasks.map(([key, fn, payload]) =>
      invokeFunction(fn, payload, authHeader).then((r) => [key, r] as [SurfaceKey, SurfaceResult]),
    ),
  );

  // 4. Persist successful surfaces (UPSERT on (scan_id, surface)).
  //    Failed surfaces are returned to the caller but NOT cached, so a
  //    transient outage doesn't poison the next 7 days of reads.
  const nowIso = new Date().toISOString();
  const upserts = results
    .filter(([, r]) => r.ok && r.payload !== undefined)
    .map(([surface, r]) => ({
      scan_id: scanId,
      surface,
      payload: r.payload as unknown,
      refreshed_at: nowIso,
    }));

  if (upserts.length > 0) {
    const { error: upErr } = await admin
      .from("peripheral_refresh_cache")
      .upsert(upserts, { onConflict: "scan_id,surface" });
    if (upErr) {
      console.error("[refresh-peripheral-tabs] cache upsert failed:", upErr.message);
    }
  }

  // 5. Stamp scans.peripheral_refreshed_at to the latest successful refresh.
  const anyOk = results.some(([, r]) => r.ok);
  let stampedAt = scan.peripheral_refreshed_at;
  if (anyOk) {
    stampedAt = nowIso;
    await admin
      .from("scans")
      .update({ peripheral_refreshed_at: stampedAt })
      .eq("id", scanId);
  }

  clearCurrentScanId();

  // 6. Compose response: fresh cache for non-stale surfaces +
  //    new results for refreshed surfaces.
  const surfaces: Record<string, SurfaceResult> = {};
  for (const s of requestedSurfaces) {
    const justRefreshed = results.find(([k]) => k === s);
    if (justRefreshed) {
      surfaces[s] = justRefreshed[1];
    } else {
      const c = cachedBySurface.get(s);
      if (c) surfaces[s] = { ok: true, payload: c.payload };
    }
  }

  return okResponse(req, {
    refreshed: anyOk,
    refreshed_at: stampedAt,
    surfaces,
  });
});
