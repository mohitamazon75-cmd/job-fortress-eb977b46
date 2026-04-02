// ═══════════════════════════════════════════════════════════════
// Token/cost tracking for all AI calls.
// 1) ScanTokenTracker — in-memory accumulator for multi-agent scans
// 2) logTokenUsage — fire-and-forget DB persistence per AI call
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  model: string;
  agent: string;
}

// Approximate per-1K-token pricing (input/output blend)
const MODEL_COST_PER_1K: Record<string, number> = {
  "google/gemini-3.1-pro-preview": 0.005,
  "google/gemini-3-pro-preview": 0.004,
  "google/gemini-3-flash-preview": 0.001,
  "google/gemini-2.5-pro": 0.006,
  "google/gemini-2.5-flash": 0.0008,
  "google/gemini-2.5-flash-lite": 0.0003,
  "openai/gpt-5": 0.01,
  "openai/gpt-5-mini": 0.003,
  "openai/gpt-5-nano": 0.001,
  "openai/gpt-5.2": 0.012,
};

export function getCostPer1K(model: string): number {
  return MODEL_COST_PER_1K[model] || 0.004;
}

/**
 * Fire-and-forget: log a single AI call's token usage to DB.
 * Safe to call without await — errors are swallowed.
 */
export function logTokenUsage(
  functionName: string,
  agentName: string | null,
  model: string,
  responseData: any,
): void {
  try {
    const usage = responseData?.usage;
    if (!usage) return;

    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
    if (totalTokens === 0) return;

    const costPer1K = getCostPer1K(model);
    const estimatedCost = Math.round((totalTokens / 1000) * costPer1K * 10000) / 10000;

    // Structured log for edge function logs (always available)
    console.log(`[TokenTrack] ${functionName}${agentName ? `:${agentName}` : ""} | ${model} | ${promptTokens}+${completionTokens}=${totalTokens} tokens | $${estimatedCost}`);

    // Fire-and-forget DB insert
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const sb = createClient(url, key);
    sb.from("token_usage_log")
      .insert({
        function_name: functionName,
        agent_name: agentName,
        model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: estimatedCost,
      })
      .then(({ error }) => {
        if (error) console.warn("[TokenTrack] DB insert error:", error.message);
      })
      .catch(() => {});
  } catch {
    // Never throw — this is telemetry
  }
}

/**
 * Log token usage from raw token counts (for streaming functions
 * that parse usage from SSE chunks instead of a response object).
 */
export function logTokenUsageRaw(
  functionName: string,
  agentName: string | null,
  model: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens === 0) return;
  logTokenUsage(functionName, agentName, model, {
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens },
  });
}

/**
 * Creates a TransformStream that intercepts an OpenAI-compatible SSE stream,
 * passes all chunks through unchanged, and extracts usage data from the
 * final chunk (requires stream_options.include_usage: true in the request).
 * Fires logTokenUsage when usage is found.
 */
export function createTokenTrackingTransform(
  functionName: string,
  agentName: string | null,
  model: string,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      // Always pass chunk through immediately
      controller.enqueue(chunk);

      // Parse for usage data
      buffer += decoder.decode(chunk, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.usage) {
            logTokenUsage(functionName, agentName, model, parsed);
          }
        } catch { /* partial JSON, skip */ }
      }
    },
    flush() {
      // Parse any remaining buffer
      if (buffer.trim().startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(buffer.trim().slice(6));
          if (parsed.usage) {
            logTokenUsage(functionName, agentName, model, parsed);
          }
        } catch { /* ignore */ }
      }
    },
  });
}

// ─── ScanTokenTracker (in-memory accumulator for process-scan) ───

export class ScanTokenTracker {
  private usages: TokenUsage[] = [];

  record(agentName: string, model: string, responseData: any): void {
    const usage = responseData?.usage;
    if (!usage) return;

    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
    const costPer1K = getCostPer1K(model);
    const estimatedCost = Math.round((totalTokens / 1000) * costPer1K * 10000) / 10000;

    this.usages.push({
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      model,
      agent: agentName,
    });
  }

  getSummary(): {
    total_tokens: number;
    total_cost_usd: number;
    agent_breakdown: TokenUsage[];
    model_breakdown: Record<string, { tokens: number; cost: number }>;
  } {
    const totalTokens = this.usages.reduce((sum, u) => sum + u.total_tokens, 0);
    const totalCost = this.usages.reduce((sum, u) => sum + u.estimated_cost_usd, 0);

    const modelBreakdown: Record<string, { tokens: number; cost: number }> = {};
    for (const u of this.usages) {
      if (!modelBreakdown[u.model]) modelBreakdown[u.model] = { tokens: 0, cost: 0 };
      modelBreakdown[u.model].tokens += u.total_tokens;
      modelBreakdown[u.model].cost += u.estimated_cost_usd;
    }

    return {
      total_tokens: totalTokens,
      total_cost_usd: Math.round(totalCost * 10000) / 10000,
      agent_breakdown: this.usages,
      model_breakdown: modelBreakdown,
    };
  }
}
