// ═══════════════════════════════════════════════════════════════
// AI Agent Caller v2 — JSON-focused LLM call with:
//   • Structured output via response_format (eliminates JSON parse retries)
//   • Prompt hash deduplication (prevents identical concurrent calls)
//   • Request-scoped AbortController with hard timeout safety net
//   • Truncated-JSON recovery for edge cases
//   • Token tracking telemetry
// ═══════════════════════════════════════════════════════════════

import { trackAgentLatency } from "./edge-logger.ts";
import { logTokenUsage } from "./token-tracker.ts";
import { logCostEvent, estimateLlmCostInrPaise, getCurrentScanId } from "./cost-logger.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GPT5_MODEL = "google/gemini-3.1-pro-preview"; // Tier 1: Deep reasoning & narrative
const PRO_MODEL = "google/gemini-3-pro-preview"; // Tier 2: Core analysis
const FLASH_MODEL = "google/gemini-3-flash-preview"; // Tier 3: Fast synthesis
const FALLBACK_MODEL = "google/gemini-2.5-pro"; // Emergency fallback
const DEFAULT_TIMEOUT_MS = 30_000;
const HARD_TIMEOUT_FLOOR_MS = 40_000;

export { AI_URL, GPT5_MODEL, PRO_MODEL, FLASH_MODEL, FALLBACK_MODEL, DEFAULT_TIMEOUT_MS };

// ─── In-flight deduplication ─────────────────────────────────
// Prevents identical concurrent requests (same agent + same prompt hash)
const inflightRequests = new Map<string, Promise<any>>();

function hashKey(agentName: string, userPrompt: string): string {
  // Fast hash: first 100 chars + length + last 50 chars
  const key = `${agentName}:${userPrompt.length}:${userPrompt.slice(0, 100)}:${userPrompt.slice(-50)}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return `${agentName}:${h}`;
}

/** Strip markdown fences from LLM output */
function stripFences(raw: string): string {
  return raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

/** Attempt to recover truncated JSON by finding the last closing brace */
function recoverTruncatedJson(raw: string): unknown | null {
  let braceDepth = 0;
  let inString = false;
  let escaped = false;
  let lastCompleteEnd = -1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0) lastCompleteEnd = i;
    }
  }

  if (lastCompleteEnd < 0) return null;

  try {
    return JSON.parse(raw.slice(0, lastCompleteEnd + 1));
  } catch {
    return null;
  }
}

/**
 * Internal AI call implementation.
 * Uses response_format: json_object for Gemini models to get reliable JSON.
 * Includes per-request AbortController timeout.
 */
async function callAgentCore(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  model = PRO_MODEL,
  temperature = 0.3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  seed?: number,
): Promise<any> {
  console.log(`[${agentName}] Starting on ${model.split("/").pop()} (${timeoutMs}ms timeout)...`);
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isGpt = model.includes("gpt-5");
    const effectiveTemp = isGpt ? 1 : temperature;

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: effectiveTemp,
    };

    if (typeof seed === "number") {
      requestBody.seed = seed;
    }

    // Use structured JSON output for all models that support it
    if (!isGpt) {
      requestBody.generationConfig = { responseMimeType: "application/json" };
    }
    requestBody.response_format = { type: "json_object" };

    if (agentName.startsWith("Agent1:Profiler")) {
      console.log("[DETERMINISM_DEBUG] Agent1 request body:", JSON.stringify({
        model: requestBody.model,
        temperature: requestBody.temperature,
        seed: requestBody.seed,
        messages_count: Array.isArray(requestBody.messages) ? requestBody.messages.length : undefined,
      }));
    }

    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[${agentName}] AI error [${resp.status}] on ${model}:`, errText.slice(0, 300));
      return null;
    }

    const data = await resp.json();
    // Fire-and-forget token tracking (USD)
    logTokenUsage("callAgent", agentName, model, data);
    // Fire-and-forget COGS tracking (INR paise) → /admin/costs dashboard
    try {
      const paise = estimateLlmCostInrPaise(model, data);
      if (paise > 0) {
        logCostEvent({
          function_name: "process-scan",
          scan_id: getCurrentScanId(),
          provider: "lovable_ai",
          cost_inr_paise: paise,
          note: agentName,
        });
      }
    } catch { /* never propagate */ }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[${agentName}] No content in response`);
      return null;
    }

    // Primary parse
    const cleaned = stripFences(content);
    try {
      const parsed = JSON.parse(cleaned);
      console.log(`[${agentName}] ✓ ${Date.now() - start}ms on ${model.split("/").pop()}`);
      return parsed;
    } catch {
      // Truncated recovery
      const recovered = recoverTruncatedJson(cleaned);
      if (recovered) {
        console.log(`[${agentName}] ✓ Recovered truncated JSON in ${Date.now() - start}ms`);
        return recovered;
      }

      console.error(`[${agentName}] JSON parse failed:`, content.slice(0, 300));
      // Single retry with explicit JSON nudge (cheaper than full retry)
      return retryWithJsonNudge(apiKey, agentName, systemPrompt, userPrompt, content, model, Math.min(timeoutMs, 20_000), seed);
    }
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") {
      console.warn(`[${agentName}] Timed out after ${timeoutMs}ms on ${model.split("/").pop()}`);
      return null;
    }
    console.error(`[${agentName}] Error:`, err);
    return null;
  }
}

/**
 * Public AI call wrapper with deduplication and hard timeout safety net.
 * Identical concurrent calls (same agent + prompt) share the same in-flight promise.
 */
export async function callAgent(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  model = PRO_MODEL,
  temperature = 0.3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  seed?: number,
): Promise<any> {
  const dedupeKey = `${hashKey(agentName, userPrompt)}:${typeof seed === "number" ? seed : "noseed"}`;

  // Return existing in-flight promise for identical requests
  const existing = inflightRequests.get(dedupeKey);
  if (existing) {
    console.log(`[${agentName}] Deduped — reusing in-flight request`);
    return existing;
  }

  const hardTimeoutMs = Math.max(timeoutMs + 5_000, HARD_TIMEOUT_FLOOR_MS);
  const start = Date.now();

  const promise = new Promise<any>((resolve) => {
    let settled = false;

    const settle = (result: Record<string, unknown> | null, timedOut: boolean) => {
      if (settled) return;
      settled = true;
      inflightRequests.delete(dedupeKey);
      const latencyMs = Date.now() - start;
      trackAgentLatency(agentName, latencyMs, timedOut, model).catch(() => {});
      resolve(result);
    };

    const hardTimer = setTimeout(() => {
      console.warn(`[${agentName}] Hard timeout after ${hardTimeoutMs}ms`);
      settle(null, true);
    }, hardTimeoutMs);

    callAgentCore(apiKey, agentName, systemPrompt, userPrompt, model, temperature, timeoutMs, seed)
      .then((result) => {
        if (settled) return;
        clearTimeout(hardTimer);
        settle(result, result === null);
      })
      .catch((err) => {
        if (settled) return;
        clearTimeout(hardTimer);
        console.error(`[${agentName}] Fatal wrapper error:`, err);
        settle(null, true);
      });
  });

  inflightRequests.set(dedupeKey, promise);
  return promise;
}

/** Single retry attempt with an explicit JSON-only instruction */
async function retryWithJsonNudge(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  previousContent: string,
  model: string,
  timeoutMs: number,
  seed?: number,
): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
          { role: "assistant", content: previousContent },
          { role: "user", content: "Your previous response was not valid JSON. Please respond with ONLY a valid JSON object, no markdown, no code fences, no explanation." },
        ],
        temperature: 0,
        ...(typeof seed === "number" ? { seed } : {}),
        response_format: { type: "json_object" },
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) { await resp.text(); return null; }

    const retryData = await resp.json();
    logTokenUsage("callAgent", `${agentName}:retry`, model, retryData);
    const retryContent = retryData.choices?.[0]?.message?.content;
    if (!retryContent) return null;

    const retryJson = stripFences(retryContent);
    try {
      return JSON.parse(retryJson);
    } catch {
      return recoverTruncatedJson(retryJson);
    }
  } catch {
    console.error(`[${agentName}] Retry also failed`);
    return null;
  }
}

/**
 * Fetch with exponential backoff for external APIs (Tavily, etc).
 * Retries on 5xx and 429 errors.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  baseDelayMs = 1000,
  attemptTimeoutMs = 12_000,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      lastResponse = resp;
      if (resp.ok || (resp.status < 500 && resp.status !== 429)) return resp;
      await resp.text(); // consume body
    } catch (err: any) {
      if (err?.name !== "AbortError") throw err;
      console.warn(`[fetchWithBackoff] ${url} timed out after ${attemptTimeoutMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    }

    if (attempt < maxRetries - 1) {
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 8000) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error(`fetchWithBackoff failed for ${url} after ${maxRetries} attempt(s)`);
}
