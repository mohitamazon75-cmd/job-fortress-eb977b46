// ═══════════════════════════════════════════════════════════════
// Week 2 #11: Model fallback chain with quality tracking.
// Wraps callAgent with a tiered retry: Tier1 → Tier2 → Tier3
// CRITICAL: Flash (Tier3) is excluded from fallback for quality-
// critical agents — it produces significantly degraded extraction.
// ═══════════════════════════════════════════════════════════════

import { callAgent } from "./ai-agent-caller.ts";

const TIER1 = "google/gemini-3.1-pro-preview";
const TIER2 = "google/gemini-3-pro-preview";
const TIER3 = "google/gemini-3-flash-preview";
const EMERGENCY = "google/gemini-2.5-pro";

// Agents where Flash produces unacceptably degraded output
const QUALITY_CRITICAL_AGENTS = ["Agent1", "Agent2A", "Agent2B", "Agent2C", "JudoStrategy"];

export interface FallbackResult<T = any> {
  data: T | null;
  model_used: string;
  fallback_chain: string[];
  latency_ms: number;
}

/**
 * Call an AI agent with automatic model fallback.
 * Tries models in order: preferred → Tier2 → (Tier3 if not quality-critical) → Emergency.
 * Tracks which model succeeded for quality auditing.
 */
export async function callAgentWithFallback(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  preferredModel = TIER1,
  temperature = 0.3,
  timeoutMs = 50_000,
): Promise<FallbackResult> {
  const start = Date.now();
  const chain: string[] = [];

  // Check if this agent requires quality-tier models only
  const isQualityCritical = QUALITY_CRITICAL_AGENTS.some(prefix => agentName.startsWith(prefix));

  // Build fallback order (skip duplicates, skip Flash for critical agents)
  const models = [preferredModel];
  if (preferredModel !== TIER2) models.push(TIER2);
  if (!isQualityCritical && preferredModel !== TIER3) models.push(TIER3);
  models.push(EMERGENCY);
  const uniqueModels = [...new Set(models)];

  if (isQualityCritical) {
    console.log(`[FallbackChain] ${agentName} is quality-critical — Flash excluded from fallback`);
  }

  for (const model of uniqueModels) {
    chain.push(model);
    const result = await callAgent(
      apiKey, `${agentName}[${model.split("/").pop()}]`,
      systemPrompt, userPrompt,
      model, temperature,
      // Reduce timeout for fallback attempts
      chain.length === 1 ? timeoutMs : Math.min(timeoutMs, 25_000),
    );
    if (result !== null) {
      if (chain.length > 1) {
        console.log(`[FallbackChain] ${agentName} succeeded on fallback model ${model} (attempt ${chain.length})`);
      }
      return { data: result, model_used: model, fallback_chain: chain, latency_ms: Date.now() - start };
    }
    console.warn(`[FallbackChain] ${agentName} failed on ${model}, trying next...`);
  }

  return { data: null, model_used: "none", fallback_chain: chain, latency_ms: Date.now() - start };
}
