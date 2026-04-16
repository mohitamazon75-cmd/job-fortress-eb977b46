/**
 * compute-outcome-calibration
 * 
 * Reads scan_outcomes, groups by DI bucket × role category × industry,
 * computes action rates vs expected rates, writes outcome_calibration_curves,
 * and patches calibration_config when sample_size ≥ MIN_SAMPLE.
 *
 * Called by pg_cron: Monday 04:00 UTC (after sendOutcomeFollowUps at 03:30 UTC)
 * Also callable manually: POST /compute-outcome-calibration (service role only)
 *
 * Output feeds Card 2 "Your cohort outcome" strip via get-cohort-outcomes.
 */

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const BUCKET_SIZE  = 10;    // DI buckets of width 10 (0-10, 10-20, ..., 90-100)
const MIN_SAMPLE   = 30;    // minimum outcomes before writing a curve row
const MAX_DELTA    = 5.0;   // maximum DI floor adjustment per cycle (±5 points)
const PATCH_SAMPLE = 100;   // minimum for patching calibration_config globally

// Positive outcomes = user took career action after the scan
const POSITIVE_OUTCOMES = new Set(["got_interview", "started_upskilling"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createAdminClient();

    // --- Load all outcomes with DI scores ---
    const { data: outcomes, error: outErr } = await supabase
      .from("scan_outcomes")
      .select("outcome, scan_determinism_index, scan_role, scan_industry, captured_at")
      .in("outcome", ["got_interview", "started_upskilling", "applied_to_jobs", "nothing_yet"])
      .not("scan_determinism_index", "is", null);

    if (outErr) throw outErr;
    if (!outcomes?.length) {
      console.log("[calibration] No outcomes yet — skipping");
      return new Response(JSON.stringify({ status: "no_data", curves: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[calibration] Processing ${outcomes.length} outcomes`);

    // --- Bucket outcomes by DI × segment (4 segment granularities) ---
    type BucketStats = {
      positive: number; total: number;
      got_interview: number; upskilling: number;
      di_min: number; di_max: number;
      role: string | null; industry: string | null;
    };
    const buckets = new Map<string, BucketStats>();

    const addToBucket = (
      di_min: number, di_max: number,
      role: string | null, industry: string | null,
      outcome: string
    ) => {
      const key = `${di_min}-${di_max}:${role ?? "*"}:${industry ?? "*"}`;
      if (!buckets.has(key)) {
        buckets.set(key, { positive: 0, total: 0, got_interview: 0, upskilling: 0,
          di_min, di_max, role, industry });
      }
      const b = buckets.get(key)!;
      b.total++;
      if (POSITIVE_OUTCOMES.has(outcome)) b.positive++;
      if (outcome === "got_interview") b.got_interview++;
      if (outcome === "started_upskilling") b.upskilling++;
    };

    for (const o of outcomes) {
      const di = o.scan_determinism_index as number;
      const di_min = Math.floor(di / BUCKET_SIZE) * BUCKET_SIZE;
      const di_max = di_min + BUCKET_SIZE;
      const role = normalizeRoleCategory(o.scan_role as string | null);
      const ind  = normalizeIndustry(o.scan_industry as string | null);

      // Store at 4 granularities: specific, role-only, industry-only, global
      addToBucket(di_min, di_max, role, ind, o.outcome as string);
      addToBucket(di_min, di_max, role, null, o.outcome as string);
      addToBucket(di_min, di_max, null, ind, o.outcome as string);
      addToBucket(di_min, di_max, null, null, o.outcome as string);
    }

    // --- Compute calibration errors and build rows ---
    const rows: Record<string, unknown>[] = [];

    for (const b of buckets.values()) {
      if (b.total < MIN_SAMPLE) continue;

      const action_rate        = b.positive / b.total;
      const got_interview_rate = b.got_interview / b.total;
      const upskilling_rate    = b.upskilling / b.total;

      // Expected: lower DI = lower risk = lower urgency = lower action rate.
      // Users with DI=70 (high risk) are expected to act more than DI=30 (low risk).
      const di_mid = (b.di_min + b.di_max) / 2;
      const expected_action_rate = di_mid / 100;  // 70% DI → 70% expected action rate

      // calibration_error > 0: we under-predicted action (DI too low → raise it)
      // calibration_error < 0: we over-predicted action (DI too high → lower it)
      const calibration_error = expected_action_rate - action_rate;

      // Suggested floor delta: clamp to ±MAX_DELTA
      const raw_delta = calibration_error * 10;  // 10% error → 1 DI point adjustment
      const suggested_di_floor_delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, raw_delta));

      rows.push({
        di_bucket_min: b.di_min,
        di_bucket_max: b.di_max,
        role_category: b.role,
        industry:      b.industry,
        sample_size:   b.total,
        action_rate:   +action_rate.toFixed(4),
        got_interview_rate: +got_interview_rate.toFixed(4),
        upskilling_rate:    +upskilling_rate.toFixed(4),
        calibration_error:  +calibration_error.toFixed(3),
        suggested_di_floor_delta: +suggested_di_floor_delta.toFixed(2),
      });
    }

    if (rows.length === 0) {
      console.log("[calibration] No buckets with enough data yet (need 30+ per bucket)");
      return new Response(JSON.stringify({ status: "insufficient_data", total_outcomes: outcomes.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Write calibration curves ---
    const { error: insertErr } = await supabase
      .from("outcome_calibration_curves")
      .upsert(rows as any[], { onConflict: "di_bucket_min,di_bucket_max,role_category,industry" });

    if (insertErr) {
      console.error("[calibration] Insert error:", insertErr);
      throw insertErr;
    }
    console.log(`[calibration] Wrote ${rows.length} calibration curve rows`);

    // --- Patch calibration_config with global adjustment (≥ PATCH_SAMPLE required) ---
    const globalRow = rows.find(r =>
      !r.role_category && !r.industry &&
      (r.sample_size as number) >= PATCH_SAMPLE
    );

    if (globalRow && Math.abs(globalRow.suggested_di_floor_delta as number) > 0.5) {
      await supabase.from("calibration_config").upsert({
        key:        "OUTCOME_DI_GLOBAL_OFFSET",
        value:      globalRow.suggested_di_floor_delta,
        updated_by: "compute-outcome-calibration",
        note:       `Auto from ${globalRow.sample_size} outcomes, error=${globalRow.calibration_error}`,
      }, { onConflict: "key" });
      console.log(`[calibration] Patched global DI offset: ${globalRow.suggested_di_floor_delta}`);
    }

    return new Response(JSON.stringify({
      status: "ok",
      curves_written: rows.length,
      total_outcomes: outcomes.length,
      global_patch: !!globalRow,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[calibration] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Normalizers ---
function normalizeRoleCategory(role: string | null): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (/software|engineer|developer|devops|sre|backend|frontend|fullstack|platform/.test(r)) return "engineering";
  if (/data|analyst|scientist|bi |analytics/.test(r)) return "data";
  if (/product|pm |program manager/.test(r)) return "product";
  if (/market|content|brand|seo|growth|social|copywr/.test(r)) return "marketing";
  if (/finance|account|audit|tax|banking|invest/.test(r)) return "finance";
  if (/hr |human resource|talent|recruit/.test(r)) return "hr";
  if (/sales|business dev|account executive/.test(r)) return "sales";
  if (/design|ux |ui |visual/.test(r)) return "design";
  if (/ops|operations|supply|logistics/.test(r)) return "operations";
  return "other";
}

function normalizeIndustry(industry: string | null): string | null {
  if (!industry) return null;
  const i = industry.toLowerCase();
  if (/tech|software|it |saas|cloud|cyber/.test(i)) return "technology";
  if (/finance|bank|insurance|fintech/.test(i)) return "finance";
  if (/health|pharma|biotech|medical/.test(i)) return "healthcare";
  if (/ecomm|retail|consumer/.test(i)) return "retail";
  if (/manufact|auto|industrial/.test(i)) return "manufacturing";
  if (/media|entertainment|gaming/.test(i)) return "media";
  return "other";
}
