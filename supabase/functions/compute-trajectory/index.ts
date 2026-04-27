/**
 * compute-trajectory — Career Trajectory Engine
 * 
 * Predicts a user's score at t+30, t+90, t+180 days based on:
 *   1. Their current score and profile
 *   2. Cohort data: what happened to similar users (same role/score band)  
 *   3. Action signals: what they've clicked/engaged with
 *   4. KG decay rates: how fast their industry is changing
 * 
 * Phase 1 (today): Model-based prediction using KG calibration constants.
 * Phase 2 (30 days): Cohort-boosted once we have real rescan data.
 * Phase 3 (90 days): High-confidence from real outcome correlations.
 */
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/require-auth.ts";

// Industry decay rates per month (% score drop without any action)
// Based on WEF 2025 automation adoption curves
const DECAY_RATES: Record<string, number> = {
  "Marketing & Advertising": 1.8,
  "IT Services": 1.2,
  "Banking & Finance": 0.9,
  "E-commerce & Retail": 1.4,
  "Consulting": 0.8,
  "Media & Entertainment": 2.1,
  "Manufacturing": 0.6,
  "Education": 0.5,
  "Healthcare": 0.4,
  "Legal": 0.7,
  "default": 1.0,
};

// Action uplift scores: expected score increase if user takes this action
const ACTION_UPLIFT: Record<string, { impact: number; months: number; probability: number }> = {
  "skill_selected": { impact: 2, months: 1, probability: 0.4 },     // investigating skills
  "plan_action_checked": { impact: 5, months: 2, probability: 0.6 }, // checking off plan items
  "job_clicked": { impact: 1, months: 1, probability: 0.3 },         // applying to jobs
  "share_whatsapp": { impact: 0, months: 0, probability: 1.0 },      // no direct impact
  "pivot_expanded": { impact: 3, months: 3, probability: 0.35 },     // exploring pivots
  "vocab_copied": { impact: 1, months: 1, probability: 0.5 },        // learning vocabulary
  "tool_opened": { impact: 1, months: 1, probability: 0.3 },         // using tools
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  // P0 hardening: require valid JWT, with service-role bypass for internal callers (process-scan).
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`;
  if (!isServiceRole) {
    const auth = await requireAuth(req, cors);
    if (auth.kind === "unauthorized") return auth.response;
  }

  try {
    const { scan_id, user_id } = await req.json();
    if (!scan_id) {
      return new Response(JSON.stringify({ error: "scan_id required" }), 
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabase = createAdminClient();

    // 1. Get scan context
    const { data: scan } = await supabase.from("scans")
      .select("id, role_detected, industry, final_json_report")
      .eq("id", scan_id).single();

    if (!scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const report = scan.final_json_report as any;
    const currentScore = report?.determinism_index ?? report?.score ?? 55;
    const industry = scan.industry || "default";
    const role = scan.role_detected || "Professional";

    // 2. Get user's action signals for this scan
    const { data: signals } = await supabase.from("user_action_signals")
      .select("action_type, action_payload, created_at")
      .eq("scan_id", scan_id)
      .order("created_at", { ascending: false });

    // 3. Get cohort rescan data (users who rescanned with similar profile)
    const { data: cohortRescans } = await supabase.from("scans")
      .select("final_json_report")
      .eq("industry", industry)
      .eq("scan_status", "complete")
      .neq("id", scan_id)
      .limit(50);

    const cohortScores = (cohortRescans || [])
      .map((s: any) => s.final_json_report?.determinism_index)
      .filter(Boolean) as number[];

    const cohortMedian = cohortScores.length > 0
      ? cohortScores.sort((a, b) => a - b)[Math.floor(cohortScores.length / 2)]
      : currentScore;

    // 4. Compute decay
    // Fuzzy industry matching — handles LLM variations like "FMCG", "Ad Tech", "SaaS"
    const normalised = industry.toLowerCase();
    const monthlyDecay = (() => {
      if (normalised.includes("market") || normalised.includes("advertis") || normalised.includes("fmcg") || normalised.includes("brand")) return DECAY_RATES["Marketing & Advertising"];
      if (normalised.includes("it") || normalised.includes("software") || normalised.includes("tech") || normalised.includes("saas") || normalised.includes("startup")) return DECAY_RATES["IT Services"];
      if (normalised.includes("bank") || normalised.includes("finance") || normalised.includes("fintech") || normalised.includes("insurance")) return DECAY_RATES["Banking & Finance"];
      if (normalised.includes("ecommerce") || normalised.includes("e-commerce") || normalised.includes("retail") || normalised.includes("commerce")) return DECAY_RATES["E-commerce & Retail"];
      if (normalised.includes("consult")) return DECAY_RATES["Consulting"];
      if (normalised.includes("media") || normalised.includes("entertainment") || normalised.includes("content")) return DECAY_RATES["Media & Entertainment"];
      if (normalised.includes("manufactur")) return DECAY_RATES["Manufacturing"];
      if (normalised.includes("educat") || normalised.includes("edtech") || normalised.includes("learn")) return DECAY_RATES["Education"];
      if (normalised.includes("health") || normalised.includes("medic") || normalised.includes("pharma") || normalised.includes("hospital")) return DECAY_RATES["Healthcare"];
      if (normalised.includes("legal") || normalised.includes("law")) return DECAY_RATES["Legal"];
      return DECAY_RATES.default;
    })();

    // 5. Compute action uplift from signals
    const signalTypes = (signals || []).map((s: any) => s.action_type);
    let totalUplift30 = 0, totalUplift90 = 0, totalUplift180 = 0;

    for (const signalType of [...new Set(signalTypes)]) {
      const uplift = ACTION_UPLIFT[signalType];
      if (!uplift) continue;
      const expected = uplift.impact * uplift.probability;
      if (uplift.months <= 1) totalUplift30 += expected;
      if (uplift.months <= 3) totalUplift90 += expected;
      totalUplift180 += expected;
    }

    // 6. Project scores
    const noActionScore30 = Math.max(20, currentScore - monthlyDecay);
    const noActionScore90 = Math.max(20, currentScore - monthlyDecay * 3);
    const noActionScore180 = Math.max(20, currentScore - monthlyDecay * 6);

    const predicted30 = Math.min(98, Math.round(noActionScore30 + totalUplift30));
    const predicted90 = Math.min(98, Math.round(noActionScore90 + totalUplift90));
    const predicted180 = Math.min(98, Math.round(noActionScore180 + totalUplift180));

    // 7. Top recommended actions (sorted by impact × probability)
    const topActions = Object.entries(ACTION_UPLIFT)
      .filter(([type]) => !signalTypes.includes(type))
      .map(([type, data]) => ({
        action: type,
        expected_score_impact: Math.round(data.impact * data.probability * 10) / 10,
        months_to_see_impact: data.months,
      }))
      .sort((a, b) => b.expected_score_impact - a.expected_score_impact)
      .slice(0, 3);

    const prediction = {
      current_score: currentScore,
      predicted_score_30d: predicted30,
      predicted_score_90d: predicted90,
      predicted_score_180d: predicted180,
      no_action_score_90d: Math.round(noActionScore90),
      monthly_decay_rate: monthlyDecay,
      cohort_size: cohortScores.length,
      cohort_median: cohortMedian,
      top_actions: topActions,
      confidence: cohortScores.length >= 10 ? "cohort" : "model",
      role,
      industry,
    };

    // 8. Cache in trajectory_predictions
    await supabase.from("trajectory_predictions").upsert({
      scan_id,
      predicted_score_30d: predicted30,
      predicted_score_90d: predicted90,
      predicted_score_180d: predicted180,
      top_actions: topActions,
      cohort_size: cohortScores.length,
      cohort_median_delta: cohortMedian - currentScore,
      confidence: prediction.confidence,
      computed_at: new Date().toISOString(),
    }, { onConflict: "scan_id" });

    return new Response(JSON.stringify({ success: true, data: prediction }),
      { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[compute-trajectory] Error:", e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
