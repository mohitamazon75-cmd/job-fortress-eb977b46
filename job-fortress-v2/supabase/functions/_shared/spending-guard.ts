import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
};

const DAILY_BUDGET_USD = 2500; // Viral-scale daily limit

export interface SpendingCheckResult {
  allowed: boolean;
  degraded: boolean; // true = switch to cheaper models
  estimatedSpendUsd: number;
  budgetUsd: number;
  reason?: string;
  message?: string;
}

export async function checkDailySpending(functionName: string, userId?: string): Promise<SpendingCheckResult> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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

    // Critical functions (process-scan) get degraded mode, not blocked
    const isCritical = functionName === "process-scan";
    const atBudget = totalEstimatedSpend >= DAILY_BUDGET_USD;
    const nearBudget = totalEstimatedSpend >= DAILY_BUDGET_USD * 0.8;

    if (atBudget && !isCritical) {
      console.warn(`[SpendingGuard] BLOCKED ${functionName}: $${totalEstimatedSpend.toFixed(2)}/$${DAILY_BUDGET_USD} daily budget exceeded`);
      return { allowed: false, degraded: false, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }

    if (atBudget && isCritical) {
      console.warn(`[SpendingGuard] DEGRADED ${functionName}: switching to Flash models ($${totalEstimatedSpend.toFixed(2)}/$${DAILY_BUDGET_USD})`);
      return { allowed: true, degraded: true, estimatedSpendUsd: totalEstimatedSpend, budgetUsd: DAILY_BUDGET_USD };
    }

    if (nearBudget) {
      console.log(`[SpendingGuard] WARNING: ${functionName} at ${Math.round(totalEstimatedSpend / DAILY_BUDGET_USD * 100)}% of daily budget`);
    }

    // Per-user daily limit
    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: userStats } = await sb
        .from("daily_usage_stats")
        .select("call_count")
        .eq("user_id", userId)
        .eq("stat_date", today);

      const userCallCount = (userStats || []).reduce((sum: number, r: any) => sum + (r.call_count || 0), 0);
      const USER_DAILY_LIMIT = 25; // calls per user per day

      if (userCallCount >= USER_DAILY_LIMIT) {
        console.warn(`[SpendingGuard] BLOCKED ${functionName}: user ${userId} reached daily limit (${userCallCount}/${USER_DAILY_LIMIT})`);
        return {
          allowed: false,
          degraded: false,
          estimatedSpendUsd: totalEstimatedSpend,
          budgetUsd: DAILY_BUDGET_USD,
          reason: "user_daily_limit_exceeded",
          message: "Daily limit reached. Try again tomorrow.",
        };
      }
    }

    // Never degrade quality for near-budget — only degrade when actually over budget
    // Quality and accuracy trump cost savings
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
