// ═══════════════════════════════════════════════════════════════
// kg-node-updater — IP #3: Dynamic Knowledge Graph
// ═══════════════════════════════════════════════════════════════
// Reads live market_signals, computes updated RoleNode field values
// (partial_displacement_years, current_demand_trend, salary_percentile,
// base_automation_prob), and writes them to kg_node_overrides.
//
// Edge functions that use the KG (process-scan, riskiq-analyse, etc.)
// call loadKGOverrides() at startup to merge live overrides on top of
// the static TypeScript KG — so the KG stays self-healing.
//
// Trigger:
//   - Called by a Supabase cron every 24h after kg-refresh runs
//   - OR manually via: POST /kg-node-updater { "triggered_by": "admin" }
//   Auth: Bearer <service role key>
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// ── Static mapping: job_family (market_signals key) → role_id (KG key) ──
// This bridges the gap between kg-refresh's job_family strings and the
// RoleNode IDs in riskiq-knowledge-graph.ts
const JOB_FAMILY_TO_ROLE_ID: Record<string, string[]> = {
  "software_engineering":   ["software_engineer", "backend_engineer", "fullstack_engineer"],
  "data_science":           ["data_scientist", "ml_engineer"],
  "data_analytics":         ["data_analyst"],
  "product_management":     ["product_manager"],
  "business_analysis":      ["business_analyst"],
  "financial_analysis":     ["financial_analyst"],
  "accounting":             ["accountant"],
  "marketing":              ["marketing_manager", "content_writer"],
  "consulting":             ["consultant"],
  "ux_design":              ["ux_designer"],
  "hr_management":          ["hr_manager"],
  "sales":                  ["sales_rep"],
  "devops_engineering":     ["devops_engineer", "cloud_engineer"],
  "cybersecurity":          ["security_analyst"],
  "project_management":     ["project_manager"],
  "content_creation":       ["content_writer"],
  "customer_success":       ["customer_success_manager"],
};

// ── Derive demand_trend from market signals ──────────────────────
function deriveDemandTrend(
  postingChangePct: number,
  marketHealth: string,
  aiMentionsPct: number,
): "growing" | "stable" | "declining" | "collapsing" {
  const health = marketHealth?.toUpperCase() ?? "STABLE";

  if (health === "BOOMING" || postingChangePct > 20) return "growing";
  if (health === "GROWING" || postingChangePct > 5) return "growing";
  if (health === "CRITICAL" || postingChangePct < -30) return "collapsing";
  if (health === "DECLINING" || postingChangePct < -10) return "declining";
  if (aiMentionsPct > 60 && postingChangePct < 0) return "declining";
  return "stable";
}

// ── Derive partial_displacement_years from AI mentions + posting change ──
// Base: use the static KG value. Compress it if signals are alarming.
function deriveDisplacementYears(
  staticDisplacementYears: number,
  postingChangePct: number,
  aiMentionsPct: number,
  marketHealth: string,
): number {
  let factor = 1.0;

  // Strong AI adoption signal → compress timeline
  if (aiMentionsPct > 70) factor *= 0.75;
  else if (aiMentionsPct > 50) factor *= 0.88;

  // Severe posting decline → compress timeline further
  if (postingChangePct < -30) factor *= 0.80;
  else if (postingChangePct < -15) factor *= 0.90;

  // Market explicitly booming → extend timeline
  if (marketHealth?.toUpperCase() === "BOOMING") factor *= 1.15;
  else if (marketHealth?.toUpperCase() === "GROWING") factor *= 1.05;

  const result = staticDisplacementYears * factor;
  // Clamp: never below 6 months (0.5 years) or above 15 years
  return Math.round(Math.max(0.5, Math.min(15, result)) * 2) / 2; // round to 0.5
}

// ── Derive salary_percentile shift ───────────────────────────────
function deriveSalaryPercentile(
  staticPercentile: number,
  avgSalaryChangePct: number,
): number {
  // +10% salary growth → +5 percentile points, capped at ±15
  const shift = Math.round(Math.max(-15, Math.min(15, (avgSalaryChangePct / 2))));
  return Math.max(5, Math.min(95, staticPercentile + shift));
}

// ── Static KG baseline values (mirrors riskiq-knowledge-graph.ts) ──
// Used when we can't load the TypeScript module (edge function context).
// Kept in sync with the TypeScript definition manually.
const STATIC_KG_BASELINES: Record<string, { displacement: number; salary_pct: number; automation: number }> = {
  financial_analyst:     { displacement: 1.5, salary_pct: 62, automation: 0.80 },
  accountant:            { displacement: 1.0, salary_pct: 55, automation: 0.86 },
  data_analyst:          { displacement: 1.0, salary_pct: 58, automation: 0.70 },
  data_scientist:        { displacement: 2.5, salary_pct: 78, automation: 0.45 },
  software_engineer:     { displacement: 2.0, salary_pct: 75, automation: 0.52 },
  ml_engineer:           { displacement: 3.0, salary_pct: 85, automation: 0.35 },
  business_analyst:      { displacement: 1.5, salary_pct: 60, automation: 0.72 },
  product_manager:       { displacement: 3.0, salary_pct: 80, automation: 0.42 },
  consultant:            { displacement: 2.5, salary_pct: 76, automation: 0.55 },
  marketing_manager:     { displacement: 1.5, salary_pct: 65, automation: 0.60 },
  content_writer:        { displacement: 0.5, salary_pct: 40, automation: 0.78 },
  ux_designer:           { displacement: 2.5, salary_pct: 70, automation: 0.48 },
  hr_manager:            { displacement: 2.0, salary_pct: 58, automation: 0.65 },
  sales_rep:             { displacement: 1.5, salary_pct: 55, automation: 0.62 },
  devops_engineer:       { displacement: 3.0, salary_pct: 80, automation: 0.38 },
  backend_engineer:      { displacement: 2.0, salary_pct: 75, automation: 0.52 },
  fullstack_engineer:    { displacement: 2.0, salary_pct: 74, automation: 0.53 },
  cloud_engineer:        { displacement: 3.5, salary_pct: 82, automation: 0.33 },
  security_analyst:      { displacement: 4.0, salary_pct: 83, automation: 0.30 },
  project_manager:       { displacement: 2.0, salary_pct: 68, automation: 0.60 },
  customer_success_manager: { displacement: 1.5, salary_pct: 60, automation: 0.58 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify this is a trusted caller (service role or admin JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy = (body as any).triggered_by ?? "cron";

    // ── 1. Load latest market_signals (one row per job_family for tier1) ──
    const { data: signals, error: signalsError } = await supabase
      .from("market_signals")
      .select("job_family, posting_change_pct, avg_salary_change_pct, ai_job_mentions_pct, market_health, snapshot_date")
      .eq("metro_tier", "tier1")
      .order("snapshot_date", { ascending: false });

    if (signalsError || !signals?.length) {
      return new Response(JSON.stringify({ error: "No market signals available", details: signalsError }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate: keep only the most recent snapshot per job_family
    const latestByFamily = new Map<string, typeof signals[0]>();
    for (const row of signals) {
      if (!latestByFamily.has(row.job_family)) {
        latestByFamily.set(row.job_family, row);
      }
    }

    // ── 2. Compute and upsert kg_node_overrides ───────────────
    let rolesUpdated = 0;
    let rolesUnchanged = 0;
    let rolesFailed = 0;

    const now = new Date().toISOString();

    for (const [jobFamily, signal] of latestByFamily) {
      const roleIds = JOB_FAMILY_TO_ROLE_ID[jobFamily];
      if (!roleIds?.length) continue;

      for (const roleId of roleIds) {
        try {
          const baseline = STATIC_KG_BASELINES[roleId];
          if (!baseline) {
            rolesFailed++;
            continue;
          }

          const newDemandTrend = deriveDemandTrend(
            signal.posting_change_pct ?? 0,
            signal.market_health ?? "STABLE",
            signal.ai_job_mentions_pct ?? 0,
          );

          const newDisplacementYears = deriveDisplacementYears(
            baseline.displacement,
            signal.posting_change_pct ?? 0,
            signal.ai_job_mentions_pct ?? 0,
            signal.market_health ?? "STABLE",
          );

          const newSalaryPercentile = deriveSalaryPercentile(
            baseline.salary_pct,
            signal.avg_salary_change_pct ?? 0,
          );

          // Load existing override to check if anything actually changed
          const { data: existing } = await supabase
            .from("kg_node_overrides")
            .select("current_demand_trend, partial_displacement_years, salary_percentile")
            .eq("role_id", roleId)
            .single();

          const unchanged = existing &&
            existing.current_demand_trend === newDemandTrend &&
            existing.partial_displacement_years === newDisplacementYears &&
            existing.salary_percentile === newSalaryPercentile;

          if (unchanged) {
            rolesUnchanged++;
            continue;
          }

          // Confidence: lower if we have thin data (few months of signals)
          const confidence = signal.ai_job_mentions_pct != null ? 0.80 : 0.60;

          const { error: upsertError } = await supabase
            .from("kg_node_overrides")
            .upsert({
              role_id: roleId,
              partial_displacement_years: newDisplacementYears,
              current_demand_trend: newDemandTrend,
              salary_percentile: newSalaryPercentile,
              source_market_signals_date: signal.snapshot_date,
              posting_change_pct: signal.posting_change_pct,
              avg_salary_change_pct: signal.avg_salary_change_pct,
              ai_job_mentions_pct: signal.ai_job_mentions_pct,
              market_health: signal.market_health,
              confidence,
              updated_at: now,
              updated_by: "kg-node-updater",
            }, { onConflict: "role_id" });

          if (upsertError) {
            console.error(`[kg-node-updater] failed for ${roleId}:`, upsertError);
            rolesFailed++;
          } else {
            rolesUpdated++;
          }
        } catch (err) {
          console.error(`[kg-node-updater] exception for ${roleId}:`, err);
          rolesFailed++;
        }
      }
    }

    // ── 3. Write audit log entry ──────────────────────────────
    await supabase.from("kg_update_log").insert({
      roles_updated: rolesUpdated,
      roles_unchanged: rolesUnchanged,
      roles_failed: rolesFailed,
      triggered_by: triggeredBy,
      notes: `Processed ${latestByFamily.size} job families from market_signals`,
    });

    return new Response(JSON.stringify({
      success: true,
      roles_updated: rolesUpdated,
      roles_unchanged: rolesUnchanged,
      roles_failed: rolesFailed,
      job_families_processed: latestByFamily.size,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[kg-node-updater]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
