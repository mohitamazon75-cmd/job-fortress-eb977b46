// ═══════════════════════════════════════════════════════════════
// Spending Guard v2 — with in-memory cache to avoid DB hit on
// every single edge function call. Cache TTL = 30s.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";

// Cost weights per function (approximate $/call)
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

const DAILY_BUDGET_USD = 2500; // Viral-scale daily limit

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

export async function checkDailySpending(functionName: string, userId?: string): Promise<SpendingCheckResult> {
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

    // Per-user daily limit (only query if global budget is fine)
    if (userId) {
      const { data: userStats } = await sb
        .from("daily_usage_stats")
        .select("call_count")
        .eq("user_id", userId)
        .eq("stat_date", today);

      const userCallCount = (userStats || []).reduce((sum: number, r: any) => sum + (r.call_count || 0), 0);
      const USER_DAILY_LIMIT = 25;

      if (userCallCount >= USER_DAILY_LIMIT) {
        console.warn(`[SpendingGuard] BLOCKED ${functionName}: user ${userId} daily limit (${userCallCount}/${USER_DAILY_LIMIT})`);
        return {
          allowed: false, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD,
          reason: "user_daily_limit_exceeded",
          message: "Daily limit reached. Try again tomorrow.",
        };
      }
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
