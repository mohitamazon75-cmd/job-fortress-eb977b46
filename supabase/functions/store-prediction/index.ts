// ═══════════════════════════════════════════════════════════════
// store-prediction — IP #2: Prediction Calibration Loop (write side)
// ═══════════════════════════════════════════════════════════════
// Called at the END of every scan to snapshot the doom clock +
// per-skill risk predictions with the CALIBRATION constants used.
// On re-scan, validate-prediction compares actual vs predicted.
//
// POST /store-prediction
//   { scan_id, doom_clock_months, skill_risks: [{ skill_name, risk_score, half_life_months }] }
//   Auth: Bearer <user JWT>
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

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

    const supabase = createAdminClient();

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      scan_id,
      doom_clock_months,
      skill_risks,
    } = body as {
      scan_id: string;
      doom_clock_months: number;
      skill_risks: Array<{
        skill_name: string;
        risk_score: number;
        half_life_months: number;
      }>;
    };

    if (!scan_id || doom_clock_months == null || !skill_risks?.length) {
      return new Response(JSON.stringify({ error: "scan_id, doom_clock_months, and skill_risks required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify scan belongs to user
    const { data: scan } = await supabase
      .from("scans")
      .select("id, user_id")
      .eq("id", scan_id)
      .eq("user_id", user.id)
      .single();

    if (!scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read live calibration constants (from calibration_config table)
    // These are the constants that were in effect at prediction time.
    const { data: calibRows } = await supabase
      .from("calibration_config")
      .select("key, value")
      .in("key", ["OBSOLESCENCE_AI_ACCELERATION_RATE", "OBSOLESCENCE_BASE_MONTHS", "CALIBRATION_VERSION"]);

    const calibrationInput: Record<string, number> = {};
    for (const row of (calibRows ?? [])) {
      calibrationInput[row.key] = Number(row.value);
    }

    // Store one prediction row per skill
    const predictions = skill_risks.map((sr) => ({
      scan_id,
      user_id: user.id,
      skill_name: sr.skill_name,
      predicted_risk_score: Math.round(Math.max(0, Math.min(100, sr.risk_score))),
      predicted_half_life_months: Math.round(Math.max(1, sr.half_life_months)),
      doom_clock_months: Math.round(doom_clock_months),
      model_version: `v${calibrationInput.CALIBRATION_VERSION ?? 3.3}`,
      calibration_input: calibrationInput,
      validated: false,
    }));

    const { error: insertError } = await supabase
      .from("skill_predictions")
      .insert(predictions);

    if (insertError) {
      console.error("[store-prediction] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store predictions" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      stored: predictions.length,
      scan_id,
      model_version: predictions[0]?.model_version,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[store-prediction]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
