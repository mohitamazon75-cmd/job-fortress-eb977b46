// ═══════════════════════════════════════════════════════════════
// validate-prediction — IP #2: Prediction Calibration Loop (read side)
// ═══════════════════════════════════════════════════════════════
// Called when a user re-scans. Matches previous unvalidated
// skill_predictions to their new scan results, computes error,
// and — once enough data exists (≥50 validated predictions) —
// writes a new row to calibration_log and optionally patches
// calibration_config with the improved OBSOLESCENCE_AI_ACCELERATION_RATE.
//
// POST /validate-prediction
//   { new_scan_id, skill_risks: [{ skill_name, risk_score, half_life_months }] }
//   Auth: Bearer <user JWT>
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Minimum validated predictions before we touch calibration constants
const MIN_SAMPLE_FOR_CALIBRATION = 50;
// Maximum ± adjustment per calibration cycle (prevents wild swings)
const MAX_CALIBRATION_DELTA = 0.02;

// ── Compute the optimal acceleration rate from validation errors ──
// Logic: if we're consistently OVER-predicting risk (error > 0 means
// predicted > actual), we should DECREASE the acceleration rate.
// If we're UNDER-predicting, we should INCREASE it.
function computeSuggestedAccelRate(
  validations: Array<{ error_pct: number; direction_correct: boolean }>,
  currentRate: number
): number {
  const meanError = validations.reduce((s, v) => s + v.error_pct, 0) / validations.length;
  const directionAccuracy = validations.filter((v) => v.direction_correct).length / validations.length;

  // Mean error > 0 means we over-predict → lower acceleration rate
  // Mean error < 0 means we under-predict → raise acceleration rate
  // Direction accuracy < 0.6 means we're often wrong about direction → moderate rate
  let adjustment = 0;

  if (Math.abs(meanError) > 10) {
    // Significant systematic bias — adjust by up to MAX_CALIBRATION_DELTA
    adjustment = -Math.sign(meanError) * Math.min(MAX_CALIBRATION_DELTA, Math.abs(meanError) / 1000);
  }

  if (directionAccuracy < 0.6) {
    // Poor direction accuracy — reduce confidence by shrinking rate toward baseline
    adjustment *= 0.5;
  }

  return Math.max(0.05, Math.min(0.25, currentRate + adjustment));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { new_scan_id, skill_risks } = body as {
      new_scan_id: string;
      skill_risks: Array<{ skill_name: string; risk_score: number; half_life_months: number }>;
    };

    if (!new_scan_id || !skill_risks?.length) {
      return new Response(JSON.stringify({ error: "new_scan_id and skill_risks required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Load unvalidated predictions for this user ────────
    const { data: unvalidated } = await supabase
      .from("skill_predictions")
      .select("*")
      .eq("user_id", user.id)
      .eq("validated", false)
      .order("predicted_at", { ascending: false });

    if (!unvalidated || unvalidated.length === 0) {
      return new Response(JSON.stringify({ validated: 0, message: "No prior predictions to validate" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a map of skill_name → new actual values
    const actualBySkill = new Map<string, { risk_score: number; half_life_months: number }>();
    for (const sr of skill_risks) {
      actualBySkill.set(sr.skill_name.toLowerCase(), sr);
    }

    const now = new Date();
    const validationUpdates: Array<{
      id: string;
      validated: boolean;
      validated_at: string;
      actual_risk_score: number;
      actual_half_life_months: number;
      error_pct: number;
      direction_correct: boolean;
      months_elapsed: number;
    }> = [];

    for (const pred of unvalidated) {
      const actual = actualBySkill.get(pred.skill_name.toLowerCase());
      if (!actual) continue; // skill not in new scan — skip

      const predictedAt = new Date(pred.predicted_at);
      const monthsElapsed = Math.round(
        (now.getTime() - predictedAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      // Error: signed % difference (positive = over-prediction)
      const errorPct = actual.risk_score !== 0
        ? ((pred.predicted_risk_score - actual.risk_score) / actual.risk_score) * 100
        : (pred.predicted_risk_score > 0 ? 100 : 0);

      // Direction: did risk go up when we predicted up, or down when we predicted down?
      const directionCorrect = Math.sign(pred.predicted_risk_score - 50) === Math.sign(actual.risk_score - 50)
        || Math.abs(pred.predicted_risk_score - actual.risk_score) < 10; // within 10pts = "correct"

      validationUpdates.push({
        id: pred.id,
        validated: true,
        validated_at: now.toISOString(),
        actual_risk_score: actual.risk_score,
        actual_half_life_months: actual.half_life_months,
        error_pct: Math.round(Math.abs(errorPct) * 100) / 100,
        direction_correct: directionCorrect,
        months_elapsed: Math.max(0, monthsElapsed),
      });
    }

    // ── 2. Bulk update validated predictions ─────────────────
    if (validationUpdates.length > 0) {
      for (const update of validationUpdates) {
        await supabase
          .from("skill_predictions")
          .update({
            validated: update.validated,
            validated_at: update.validated_at,
            actual_risk_score: update.actual_risk_score,
            actual_half_life_months: update.actual_half_life_months,
            error_pct: update.error_pct,
            direction_correct: update.direction_correct,
            months_elapsed: update.months_elapsed,
          })
          .eq("id", update.id);
      }
    }

    // ── 3. Check if we have enough global data to recalibrate ─
    const { count: totalValidated } = await supabase
      .from("skill_predictions")
      .select("*", { count: "exact", head: true })
      .eq("validated", true);

    let calibrationResult: Record<string, unknown> = { recalibrated: false };

    if ((totalValidated ?? 0) >= MIN_SAMPLE_FOR_CALIBRATION) {
      // Load last 500 validated predictions globally
      const { data: recentValidated } = await supabase
        .from("skill_predictions")
        .select("error_pct, direction_correct")
        .eq("validated", true)
        .not("error_pct", "is", null)
        .order("validated_at", { ascending: false })
        .limit(500);

      if (recentValidated && recentValidated.length >= MIN_SAMPLE_FOR_CALIBRATION) {
        // Get current acceleration rate from calibration_config
        const { data: configRow } = await supabase
          .from("calibration_config")
          .select("value")
          .eq("key", "OBSOLESCENCE_AI_ACCELERATION_RATE")
          .single();

        const currentRate = Number(configRow?.value ?? 0.12);
        const validationsForCalib = recentValidated.map((r: any) => ({
          error_pct: Number(r.error_pct),
          direction_correct: Boolean(r.direction_correct),
        }));

        const suggestedRate = computeSuggestedAccelRate(validationsForCalib, currentRate);
        const delta = suggestedRate - currentRate;
        const meanError = validationsForCalib.reduce((s, v) => s + v.error_pct, 0) / validationsForCalib.length;
        const dirAccuracy = validationsForCalib.filter((v) => v.direction_correct).length / validationsForCalib.length;

        // Log the calibration attempt
        await supabase.from("calibration_log").insert({
          model_version: "v3.3",
          sample_size: validationsForCalib.length,
          mean_error_pct: Math.round(meanError * 100) / 100,
          direction_accuracy: Math.round(dirAccuracy * 10000) / 100,
          suggested_accel_rate: Math.round(suggestedRate * 1000000) / 1000000,
          current_accel_rate: currentRate,
          delta: Math.round(delta * 1000000) / 1000000,
          applied: Math.abs(delta) > 0.001, // only apply if meaningful change
          notes: `Auto-calibration from ${validationsForCalib.length} validated predictions`,
        });

        // Only patch the live config if the adjustment is meaningful
        if (Math.abs(delta) > 0.001) {
          await supabase
            .from("calibration_config")
            .upsert({
              key: "OBSOLESCENCE_AI_ACCELERATION_RATE",
              value: suggestedRate,
              updated_at: now.toISOString(),
              updated_by: "validate-prediction",
              note: `Auto-calibrated from ${validationsForCalib.length} validated predictions. ` +
                    `Mean error: ${meanError.toFixed(1)}%, Direction accuracy: ${(dirAccuracy * 100).toFixed(0)}%`,
            }, { onConflict: "key" });

          calibrationResult = {
            recalibrated: true,
            old_rate: currentRate,
            new_rate: suggestedRate,
            delta,
            sample_size: validationsForCalib.length,
          };
        }
      }
    }

    return new Response(JSON.stringify({
      validated: validationUpdates.length,
      new_scan_id,
      calibration: calibrationResult,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[validate-prediction]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
