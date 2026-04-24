// ═══════════════════════════════════════════════════════════════
// purge-expired-scans — DPDP 90-day retention enforcement
//
// India DPDP Act 2023 + project policy (mem://project/data-privacy-and-retention):
// scan data is retained for at most 90 days, then purged.
//
// Triggered by pg_cron daily at 02:00 UTC.
// Idempotent — re-running the same day deletes nothing new.
//
// Auth: requires the service-role key (cron supplies it). Anonymous
// or user-JWT calls are rejected.
//
// Cascade behavior: `scans` is the parent. Direct child rows
// (cohort_data, model_b_results) cascade via FK. Other satellite
// tables (score_history, learning_path_progress, defense_milestones,
// coach_nudges, scan_outcomes, scan_feedback, behavior_events,
// scan_vectors, cohort_cache, trajectory_predictions, weekly_briefs)
// reference `scan_id` without an enforced FK, so we delete them
// explicitly, oldest-children-first.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";
import { shouldPurgeScan } from "../../src/lib/dpdp-retention.ts";

const RETENTION_DAYS = 90;

// Tables that hold per-scan satellite data without an enforced FK cascade.
// Order does NOT matter for correctness (we resolve by scan_id), but we
// keep it stable for log readability.
const SATELLITE_TABLES = [
  "score_history",
  "learning_path_progress",
  "defense_milestones",
  "coach_nudges",
  "scan_outcomes",
  "scan_feedback",
  "behavior_events",
  "scan_vectors",
  "cohort_cache",
  "trajectory_predictions",
  "weekly_briefs",
  "chat_messages",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  try {
    // ── Auth: only service role (cron) may purge ──────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return errResponse(req, "Forbidden", 403);
    }

    const supabase = createAdminClient();
    const now = new Date();

    // ── Find expired scans ────────────────────────────────────
    const { data: scans, error: selErr } = await supabase
      .from("scans")
      .select("id, created_at");

    if (selErr) {
      console.error("[purge-expired-scans] select failed:", selErr.message);
      return errResponse(req, "Select failed", 500);
    }

    const ids = (scans ?? [])
      .filter((s) => shouldPurgeScan(s.created_at, now, RETENTION_DAYS))
      .map((s) => s.id as string);

    if (ids.length === 0) {
      return okResponse(req, { purged: 0, message: "Nothing to purge" });
    }

    // ── Delete satellites first (best-effort, individually logged) ──
    const satelliteResults: Record<string, { deleted: boolean; error?: string }> = {};
    for (const table of SATELLITE_TABLES) {
      const { error } = await supabase.from(table).delete().in("scan_id", ids);
      satelliteResults[table] = error
        ? { deleted: false, error: error.message }
        : { deleted: true };
      if (error) {
        console.warn(`[purge-expired-scans] satellite ${table} delete failed:`, error.message);
      }
    }

    // ── Delete the scans themselves (cascades to FK children) ─
    const { error: delErr } = await supabase.from("scans").delete().in("id", ids);
    if (delErr) {
      console.error("[purge-expired-scans] scans delete failed:", delErr.message);
      return errResponse(req, "Delete failed", 500);
    }

    console.log(
      `[purge-expired-scans] purged=${ids.length} satellites=${
        JSON.stringify(satelliteResults)
      }`,
    );

    return okResponse(req, {
      purged: ids.length,
      retention_days: RETENTION_DAYS,
      satellites: satelliteResults,
    });
  } catch (err) {
    console.error("[purge-expired-scans] unexpected:", err);
    return errResponse(req, "Internal server error", 500);
  }
});
