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

/**
 * Race two models in parallel and return whichever succeeds first.
 * Used for Agent 1 Profiler specifically to eliminate the 60-100s serial
 * retry chain that was causing synthetic fallbacks when Pro was slow.
 *
 * Primary (Pro) and secondary (Flash) are fired simultaneously.
 * First valid response wins. Loser is abandoned (its timeout will cancel it).
 * If BOTH fail within timeout, falls through to the serial chain as last resort.
 */
export async function callAgentRace(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  primaryModel = TIER1,
  secondaryModel = TIER3,
  temperature = 0.3,
  timeoutMs = 25_000,
): Promise<FallbackResult> {
  const start = Date.now();

  const primaryOpen = isCircuitOpen(primaryModel);
  const secondaryOpen = isCircuitOpen(secondaryModel);

  if (primaryOpen && secondaryOpen) {
    console.warn(`[Race] ${agentName}: both models have open circuits — using serial chain fallback`);
    return callAgentWithFallback(apiKey, agentName, systemPrompt, userPrompt, TIER2, temperature, timeoutMs);
  }

  const racers: Promise<{ data: any; model: string } | null>[] = [];

  if (!primaryOpen) {
    racers.push(
      callAgent(apiKey, `${agentName}[${primaryModel.split("/").pop()}]`, systemPrompt, userPrompt,
        primaryModel, temperature, timeoutMs)
        .then(data => data ? { data, model: primaryModel } : null)
        .catch(() => null)
    );
  }

  if (!secondaryOpen) {
    racers.push(
      callAgent(apiKey, `${agentName}[${secondaryModel.split("/").pop()}]`, systemPrompt, userPrompt,
        secondaryModel, temperature, timeoutMs)
        .then(data => data ? { data, model: secondaryModel } : null)
        .catch(() => null)
    );
  }

  // Race — first non-null result wins
  const winner = await Promise.race([
    ...racers,
    new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs + 2_000)),
  ]);

  if (winner) {
    recordSuccess(winner.model);
    const latency = Date.now() - start;
    console.log(`[Race] ${agentName} won by ${winner.model.split("/").pop()} in ${latency}ms`);
    trackAgentLatency(agentName, latency, false, winner.model).catch(() => {});
    return {
      data: winner.data,
      model_used: winner.model,
      fallback_chain: [winner.model],
      skipped_models: [],
      latency_ms: latency,
    };
  }

  // Both failed — settle then fall through to serial chain
  const settled = await Promise.all(racers);
  for (const r of settled) {
    if (!r) {
      if (!primaryOpen) recordFailure(primaryModel);
      if (!secondaryOpen) recordFailure(secondaryModel);
      break;
    }
  }

  console.warn(`[Race] ${agentName}: both parallel models failed, falling through to serial chain`);
  return callAgentWithFallback(apiKey, agentName, systemPrompt, userPrompt, OPENAI_PRIMARY, temperature, timeoutMs);
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
  // Strategy: try Pro-tier models first (quality), then OpenAI siblings,
  // then Flash as a LAST-RESORT before giving up. For quality-critical
  // agents (Agent1 etc.) Flash output is degraded but vastly better than
  // the generic synthetic/template fallback the caller is forced into when
  // we return null. Empirically: synthetic produces "Your CEO role is
  // shifting fast" boilerplate that any user can spot. Flash produces a
  // real profile from the resume — slightly less nuanced but personalised.
  const models = [preferredModel];
  if (preferredModel !== TIER1) models.push(TIER1);
  if (preferredModel !== TIER2) models.push(TIER2);
  if (preferredModel !== OPENAI_PRIMARY) models.push(OPENAI_PRIMARY);
  if (preferredModel !== OPENAI_SECONDARY) models.push(OPENAI_SECONDARY);
  // Flash is now ALWAYS in the chain. For non-critical agents it sits
  // earlier (cheaper); for critical agents it's the last real attempt
  // before the slow EMERGENCY tier (which is itself skipped for critical).
  if (preferredModel !== TIER3) models.push(TIER3);
  // Quality-critical paths skip the slow gemini-2.5-pro emergency tier.
  if (!(isQualityCritical && QUALITY_CRITICAL_SKIPS_EMERGENCY)) {
    models.push(EMERGENCY);
  }
  const uniqueModels = [...new Set(models)];

  if (isQualityCritical) {
    console.log(`[FallbackChain] ${agentName} is quality-critical — Flash kept as last-resort, EMERGENCY skipped`);
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
