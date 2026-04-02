// ═══════════════════════════════════════════════════════════════
// Centralized constants — single source of truth for all edge functions
// Update here to change across the entire system.
// ═══════════════════════════════════════════════════════════════

/** Max concurrent scans in the processing queue */
export const MAX_CONCURRENT_SCANS = 50;

/** Daily cost limit in USD — triggers model downgrade, not hard block */
export const DAILY_COST_CAP_USD = 2500;

/** Per-stage timeout budgets in milliseconds */
export const TIMEOUTS = {
  AGENT1_MS: 15_000,       // Profile ingestion + role detection
  AGENT2A_MS: 30_000,      // Risk analysis
  AGENT2B_MS: 30_000,      // Career plan
  AGENT2C_MS: 30_000,      // Pivot suggestions
  SUB_SECTOR_MS: 8_000,    // Sub-sector circuit breaker
  TOTAL_SCAN_MS: 90_000,   // Hard wall for full scan
} as const;

/** Minimum KG role match confidence to trust the lookup */
export const KG_MIN_CONFIDENCE = 0.6;

/** Score delta thresholds for rescan messaging */
export const SCORE_DELTA = {
  IMPROVED: 5,      // +5 or more = "improving"
  DECLINED: -5,     // -5 or more = "declining"
  STABLE_BAND: 2,   // ±2 = "stable"
} as const;

/** Model identifiers — single source of truth */
export const MODELS = {
  GPT5: "google/gemini-3.1-pro-preview",
  PRO: "google/gemini-3-pro-preview",
  FLASH: "google/gemini-3-flash-preview",
  FALLBACK: "google/gemini-2.5-pro",
} as const;

/** Supabase storage bucket names */
export const BUCKETS = {
  RESUMES: "resumes",
  PROFILE_PHOTOS: "profile-photos",
  EXPORTS: "exports",
} as const;

/**
 * Creates a per-stage timeout guard.
 * Usage: const signal = stageTimeout(TIMEOUTS.AGENT1_MS);
 * Pass `signal` to fetch() calls — aborts if the stage takes too long.
 * Returns an object with the AbortSignal and a cancel() function.
 */
export function stageTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Stage timeout after ${ms}ms`)), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}
