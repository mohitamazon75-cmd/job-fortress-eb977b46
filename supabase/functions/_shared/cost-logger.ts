// ═══════════════════════════════════════════════════════════════
// cost-logger.ts — Fire-and-forget COGS tracker writing to public.cost_events.
//
// Complements token-tracker.ts (which logs LLM token usage in USD)
// by recording per-call cost in INR paise across ALL providers
// (Gemini via Lovable AI, Tavily, Firecrawl, etc.) so the
// /admin/costs dashboard can compute per-scan COGS.
//
// Design rules:
//  - NEVER throws. All errors swallowed. Caller path must not break.
//  - Service-role client bypasses RLS by design (admin-only SELECT).
//  - Pilot scope: instrument 1 edge function first (translate-verdict),
//    observe 48hrs in /admin/costs before rolling to others.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";
import { getCostPer1K } from "./token-tracker.ts";

// USD → INR conversion. Static for now; if INR moves >5% revisit.
const USD_TO_INR = 84;

export type CostProvider = "lovable_ai" | "tavily" | "firecrawl" | "perplexity" | "other";

export interface CostEventInput {
  function_name: string;
  scan_id?: string | null;
  provider: CostProvider;
  cost_inr_paise: number; // integer paise (₹1 = 100 paise)
  note?: string | null;
}

/**
 * Fire-and-forget: insert one cost event. Errors swallowed.
 */
export function logCostEvent(input: CostEventInput): void {
  try {
    if (!Number.isFinite(input.cost_inr_paise) || input.cost_inr_paise < 0) return;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const sb = createAdminClient();
    sb.from("cost_events")
      .insert({
        function_name: input.function_name,
        scan_id: input.scan_id ?? null,
        provider: input.provider,
        cost_inr_paise: Math.round(input.cost_inr_paise),
        note: input.note ?? null,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("[CostLogger] insert error:", error.message);
      });
  } catch (e) {
    // Never propagate
    console.warn("[CostLogger] swallowed error:", (e as Error)?.message);
  }
}

/**
 * Convenience: derive cost_inr_paise from an LLM response's usage block.
 * Returns 0 if usage missing (caller still safe to log — will be no-op).
 */
export function estimateLlmCostInrPaise(model: string, responseData: unknown): number {
  try {
    const usage = (responseData as { usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number } } | null)?.usage;
    if (!usage) return 0;
    const total = usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0));
    if (!total) return 0;
    const usd = (total / 1000) * getCostPer1K(model);
    const inr = usd * USD_TO_INR;
    const paise = Math.round(inr * 100);
    return paise > 0 ? paise : 0;
  } catch {
    return 0;
  }
}
