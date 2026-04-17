// ═══════════════════════════════════════════════════════════════
// Model fallback chain v2 with:
//   • Circuit breaker pattern (avoids hammering failing models)
//   • Quality-critical agent protection (Flash excluded)
//   • Latency-aware timeout reduction for fallbacks
//   • Telemetry for fallback frequency analysis
// ═══════════════════════════════════════════════════════════════

import { callAgent } from "./ai-agent-caller.ts";
import { trackAgentLatency } from "./edge-logger.ts";

const TIER1 = "google/gemini-3.1-pro-preview";
const TIER2 = "google/gemini-3-pro-preview";
const TIER3 = "google/gemini-3-flash-preview";
const OPENAI_PRIMARY = "openai/gpt-5";
const OPENAI_SECONDARY = "openai/gpt-5-mini";
// gemini-2.5-pro consistently times out on quality-critical agents
// (every prod log line shows it aborting at 24s while gemini-3-pro completes
// in 5–8s). Keep it as a last-resort emergency only.
const EMERGENCY = "google/gemini-2.5-pro";

// Quality-critical agents skip the EMERGENCY tier entirely — better to fail
// loudly than ship a low-fidelity 2.5-pro response.
const QUALITY_CRITICAL_SKIPS_EMERGENCY = true;

// Agents where Flash produces unacceptably degraded output
const QUALITY_CRITICAL_AGENTS = ["Agent1", "Agent2A", "Agent2B", "Agent2C", "JudoStrategy"];

// ─── Circuit Breaker ─────────────────────────────────────────
// Tracks model failure counts within a time window.
// After THRESHOLD failures in WINDOW_MS, the model is "open" (skipped)
// for COOLDOWN_MS before retrying.
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 120_000; // 2 minutes
const CIRCUIT_COOLDOWN_MS = 60_000; // 1 minute cooldown after opening

interface CircuitState {
  failures: number[];
  openedAt: number | null;
}

const circuitStates = new Map<string, CircuitState>();

function isCircuitOpen(model: string): boolean {
  const state = circuitStates.get(model);
  if (!state) return false;

  // If circuit is open, check if cooldown has passed
  if (state.openedAt) {
    if (Date.now() - state.openedAt > CIRCUIT_COOLDOWN_MS) {
      // Half-open: allow one attempt
      state.openedAt = null;
      state.failures = [];
      return false;
    }
    return true; // Still cooling down
  }

  // Prune old failures outside the window
  const cutoff = Date.now() - CIRCUIT_WINDOW_MS;
  state.failures = state.failures.filter(t => t > cutoff);

  return state.failures.length >= CIRCUIT_THRESHOLD;
}

function recordFailure(model: string): void {
  let state = circuitStates.get(model);
  if (!state) {
    state = { failures: [], openedAt: null };
    circuitStates.set(model, state);
  }

  state.failures.push(Date.now());

  // Prune and check threshold
  const cutoff = Date.now() - CIRCUIT_WINDOW_MS;
  state.failures = state.failures.filter(t => t > cutoff);

  if (state.failures.length >= CIRCUIT_THRESHOLD) {
    state.openedAt = Date.now();
    console.warn(`[CircuitBreaker] ${model} circuit OPENED after ${CIRCUIT_THRESHOLD} failures in ${CIRCUIT_WINDOW_MS / 1000}s`);
  }
}

function recordSuccess(model: string): void {
  const state = circuitStates.get(model);
  if (state) {
    state.failures = [];
    state.openedAt = null;
  }
}

export interface FallbackResult<T = any> {
  data: T | null;
  model_used: string;
  fallback_chain: string[];
  skipped_models: string[];
  latency_ms: number;
}

/**
 * Call an AI agent with automatic model fallback + circuit breaker.
 * Tries models in order: preferred → Tier2 → (Tier3 if not quality-critical) → Emergency.
 * Models with open circuits are skipped automatically.
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
  const skipped: string[] = [];

  const isQualityCritical = QUALITY_CRITICAL_AGENTS.some(prefix => agentName.startsWith(prefix));

  // Build fallback order
  const models = [preferredModel];
  if (preferredModel !== TIER1) models.push(TIER1);
  if (preferredModel !== TIER2) models.push(TIER2);
  if (preferredModel !== OPENAI_PRIMARY) models.push(OPENAI_PRIMARY);
  if (preferredModel !== OPENAI_SECONDARY) models.push(OPENAI_SECONDARY);
  if (!isQualityCritical && preferredModel !== TIER3) models.push(TIER3);
  // Quality-critical paths skip the slow gemini-2.5-pro emergency tier.
  if (!(isQualityCritical && QUALITY_CRITICAL_SKIPS_EMERGENCY)) {
    models.push(EMERGENCY);
  }
  const uniqueModels = [...new Set(models)];

  if (isQualityCritical) {
    console.log(`[FallbackChain] ${agentName} is quality-critical — Flash excluded`);
  }

  for (const model of uniqueModels) {
    // Circuit breaker check
    if (isCircuitOpen(model)) {
      console.log(`[FallbackChain] ${agentName}: skipping ${model.split("/").pop()} (circuit open)`);
      skipped.push(model);
      continue;
    }

    chain.push(model);
    // Progressive timeout reduction: first attempt gets full timeout,
    // subsequent attempts get 60% (enough to complete but won't blow the budget)
    const effectiveTimeout = chain.length === 1
      ? timeoutMs
      : Math.min(timeoutMs, Math.max(15_000, Math.round(timeoutMs * 0.6)));

    const result = await callAgent(
      apiKey, `${agentName}[${model.split("/").pop()}]`,
      systemPrompt, userPrompt,
      model, temperature, effectiveTimeout,
    );

    if (result !== null) {
      recordSuccess(model);
      if (chain.length > 1) {
        console.log(`[FallbackChain] ${agentName} succeeded on fallback ${model.split("/").pop()} (attempt ${chain.length})`);
      }
      // Roll-up outcome metric (one entry per logical agent call). Per-attempt
      // metrics are still emitted by callAgent under `${agentName}[model]`.
      trackAgentLatency(agentName, Date.now() - start, false, model).catch(() => {});
      return { data: result, model_used: model, fallback_chain: chain, skipped_models: skipped, latency_ms: Date.now() - start };
    }

    recordFailure(model);
    console.warn(`[FallbackChain] ${agentName} failed on ${model.split("/").pop()}, trying next...`);
  }

  // All models exhausted — true failure.
  trackAgentLatency(agentName, Date.now() - start, true, "none").catch(() => {});
  return { data: null, model_used: "none", fallback_chain: chain, skipped_models: skipped, latency_ms: Date.now() - start };
}
