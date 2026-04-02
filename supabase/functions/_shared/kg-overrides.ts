// ═══════════════════════════════════════════════════════════════
// kg-overrides.ts — shared helper for IP #3: Dynamic Knowledge Graph
// ═══════════════════════════════════════════════════════════════
// Call loadKGOverrides(supabase) once per edge function invocation
// (after building the RiskKnowledgeGraph) to apply live market-signal
// derived overrides on top of the static TypeScript KG definition.
//
// Usage in any edge function:
//   import { RiskKnowledgeGraph } from "./_shared/riskiq-knowledge-graph.ts";
//   import { loadKGOverrides } from "./_shared/kg-overrides.ts";
//
//   const kg = new RiskKnowledgeGraph();
//   await loadKGOverrides(supabase, kg);   // ← merges live DB updates
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { RiskKnowledgeGraph } from "./riskiq-knowledge-graph.ts";

// Confidence threshold below which we don't apply an override
const MIN_CONFIDENCE = 0.65;

// Maximum age of an override before we ignore it (7 days)
const MAX_OVERRIDE_AGE_DAYS = 7;

export async function loadKGOverrides(
  supabase: SupabaseClient,
  kg: RiskKnowledgeGraph,
): Promise<{ applied: number; skipped: number }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_OVERRIDE_AGE_DAYS);

    const { data: overrides, error } = await supabase
      .from("kg_node_overrides")
      .select("*")
      .gte("updated_at", cutoffDate.toISOString())
      .gte("confidence", MIN_CONFIDENCE);

    if (error || !overrides?.length) {
      return { applied: 0, skipped: 0 };
    }

    let applied = 0;
    let skipped = 0;

    for (const override of overrides) {
      const role = kg.roles.get(override.role_id);
      if (!role) {
        skipped++;
        continue;
      }

      // Merge overrides — only update fields that are non-null in the override
      let changed = false;

      if (override.partial_displacement_years != null) {
        role.partial_displacement_years = Number(override.partial_displacement_years);
        changed = true;
      }

      if (override.current_demand_trend != null) {
        role.current_demand_trend = override.current_demand_trend as
          "growing" | "stable" | "declining" | "collapsing";
        changed = true;
      }

      if (override.salary_percentile != null) {
        role.salary_percentile = Number(override.salary_percentile);
        changed = true;
      }

      if (override.base_automation_prob != null) {
        role.base_automation_prob = Number(override.base_automation_prob);
        changed = true;
      }

      if (changed) applied++;
    }

    return { applied, skipped };
  } catch {
    // Never throw — KG overrides are additive, not critical path
    return { applied: 0, skipped: 0 };
  }
}

// ── loadCalibrationConfig: reads live CALIBRATION constants from DB ──
// Usage: call at edge function startup to patch the engine's constants.
//
//   import { CALIBRATION } from "./_shared/deterministic-engine.ts";
//   import { loadCalibrationConfig } from "./_shared/kg-overrides.ts";
//   await loadCalibrationConfig(supabase, CALIBRATION as any);

export async function loadCalibrationConfig(
  supabase: SupabaseClient,
  calibration: Record<string, number>,
): Promise<{ patched: number }> {
  try {
    const { data: rows } = await supabase
      .from("calibration_config")
      .select("key, value");

    if (!rows?.length) return { patched: 0 };

    let patched = 0;
    for (const row of rows) {
      if (row.key in calibration && row.key !== "CALIBRATION_VERSION") {
        calibration[row.key] = Number(row.value);
        patched++;
      }
    }

    return { patched };
  } catch {
    return { patched: 0 };
  }
}
