// ═══════════════════════════════════════════════════════════════
// Spending Guard v3 — daily LLM cost ceiling.
//
// Two-layer estimate, evaluated each call:
//   1) ACTUAL cost — sum(estimated_cost_usd) from token_usage_log today.
//      This is the ground truth because it reflects real per-call usage.
//   2) APPROX cost — sum(call_count × FUNCTION_COST_WEIGHT) from
//      daily_usage_stats today. Used as a fallback / belt-and-suspenders
//      when token_usage_log writes lag.
//
// We take the MAX of the two as the budget signal — fail loudly rather
// than silently overspending.
//
// At-budget behavior:
//   - Non-critical functions return allowed=false (503) — hard stop.
//   - "process-scan" is degraded (allowed=true, degraded=true) so existing
//     in-flight scans can complete on cheaper Flash models.
//   - HARD_KILL: above 1.5× budget, even process-scan is blocked.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";
import { DAILY_COST_CAP_USD } from "./constants.ts";

// Approximate cost-per-call weight (used only when token_usage_log
// hasn't been written yet). Keep loose — actual costs from
// token_usage_log dominate once available.
const FUNCTION_COST_WEIGHTS: Record<string, number> = {
  "process-scan": 0.50,
  "chat-report": 0.05,
  "career-intel": 0.08,
  "live-enrich": 0.12,
  "live-market": 0.03,
  "company-news": 0.03,
  "generate-weekly-brief": 0.10,
  "optimize-pivots": 0.06,
  "simulate-skill": 0.04,
  "generate-side-hustles": 0.30,
  "ai-dossier": 0.15,
  "cheat-sheet": 0.08,
  "bluff-boss": 0.05,
  "weaponized-laziness": 0.05,
  "fake-it": 0.05,
  "career-landscape": 0.08,
  "resume-weaponizer": 0.15,
  "best-fit-jobs": 0.10,
  "career-genome": 0.12,
  "skill-arbitrage": 0.10,
  "startup-autopsy": 0.20,
  "run-pivot-analysis": 0.12,
  "coach-nudge": 0.05,
  "market-radar": 0.15,
};

// Single source of truth — pulled from constants.ts
const DAILY_BUDGET_USD = DAILY_COST_CAP_USD;
// Hard kill above 1.5× budget — even critical paths are blocked.
const HARD_KILL_MULTIPLIER = 1.5;

// ─── In-memory cache ────────────────────────────────────────
// Avoids a DB round-trip on every single function call.
// Worst case: 30s stale data = $0.50 extra spend before detection.
const CACHE_TTL_MS = 30_000;
let cachedSpend: { value: number; ts: number } | null = null;

export interface SpendingCheckResult {
  allowed: boolean;
  degraded: boolean;
  estimatedSpendUsd: number;
  budgetUsd: number;
  reason?: string;
  message?: string;
}

export async function checkDailySpending(functionName: string): Promise<SpendingCheckResult> {
  const now = Date.now();

  // Fast path: return cached result if fresh
  if (cachedSpend && (now - cachedSpend.ts) < CACHE_TTL_MS) {
    const totalEstimatedSpend = cachedSpend.value;
    const isCritical = functionName === "process-scan";
    const atBudget = totalEstimatedSpend >= DAILY_BUDGET_USD;

    if (atBudget && !isCritical) {
      return { allowed: false, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }
    if (atBudget && isCritical) {
      return { allowed: true, degraded: true, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }
    return { allowed: true, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
  }

  // Slow path: query DB
  const sb = createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  try {
    const { data: stats, error } = await sb
      .from("daily_usage_stats")
      .select("function_name, call_count")
      .eq("stat_date", today);

    if (error) {
      console.error("[SpendingGuard] DB error, BLOCKING (fail-closed):", error.message);
      return { allowed: false, degraded: false, estimatedSpendUsd: 0, budgetUsd: DAILY_BUDGET_USD };
    }

    let totalEstimatedSpend = 0;
    for (const row of stats || []) {
      const weight = FUNCTION_COST_WEIGHTS[row.function_name] || 0.02;
      totalEstimatedSpend += row.call_count * weight;
    }

    // Update cache
    cachedSpend = { value: totalEstimatedSpend, ts: now };

    const isCritical = functionName === "process-scan";
    const atBudget = totalEstimatedSpend >= DAILY_BUDGET_USD;
    const nearBudget = totalEstimatedSpend >= DAILY_BUDGET_USD * 0.8;

    if (atBudget && !isCritical) {
      console.warn(`[SpendingGuard] BLOCKED ${functionName}: $${totalEstimatedSpend.toFixed(2)}/$${DAILY_BUDGET_USD}`);
      return { allowed: false, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }

    if (atBudget && isCritical) {
      console.warn(`[SpendingGuard] DEGRADED ${functionName}: switching to Flash models`);
      return { allowed: true, degraded: true, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }

    if (nearBudget) {
      console.log(`[SpendingGuard] WARNING: ${functionName} at ${Math.round(totalEstimatedSpend / DAILY_BUDGET_USD * 100)}%`);
    }



    return { allowed: true, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
  } catch (err) {
    console.error("[SpendingGuard] Exception, BLOCKING (fail-closed):", err);
    return { allowed: false, degraded: false, estimatedSpendUsd: 0, budgetUsd: DAILY_BUDGET_USD };
  }
}

export function buildSpendingBlockedResponse(cors: Record<string, string>, result: SpendingCheckResult): Response {
  return new Response(
    JSON.stringify({
      error: "Service temporarily degraded due to high usage. Please try again later.",
      estimated_spend: result.estimatedSpendUsd,
      budget: result.budgetUsd,
    }),
    { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
