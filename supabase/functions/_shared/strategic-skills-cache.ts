/**
 * strategic-skills-cache.ts (Round 9, 2026-04-29)
 *
 * Score-stability fix. Background:
 *   Agent1 (Gemini Pro at temperature=0 + content-derived seed) is supposed to
 *   return identical `strategic_skills` arrays for the same resume. In practice
 *   the Lovable AI Gateway does not reliably honor seed for Gemini, and we
 *   observed the same resume producing 2 vs 5 strategic skills across re-scans
 *   18 minutes apart. That swing flowed straight into calculateSurvivability
 *   (strategic_bonus = strategic_skills.length × 5 for execs, capped at 25)
 *   and produced a 13-point Survivability swing on otherwise identical input.
 *
 * Fix: cache the FIRST run's strategic_skills classification, keyed on the
 * exact resume content + role + industry + experience_years. Subsequent scans
 * of the same resume reuse the cached classification, so the score-affecting
 * field is deterministic across re-scans without touching the engine itself.
 *
 * Trade-offs (accepted):
 *   • A 1-character resume edit invalidates the cache (correct: it's a new
 *     profile and may genuinely have different strategic skills).
 *   • If the LLM gets better at classification within the TTL, cached users
 *     don't see the improvement until 30 days pass. Acceptable for the
 *     stability-first launch posture.
 *   • Cache only stabilises strategic_skills. We do NOT cache execution_skills
 *     or all_skills — those don't drive scores and overcaching them could mask
 *     genuine threat-vector evolution.
 *
 * Storage: reuses the existing `enrichment_cache` table (service-role-only,
 * key/jsonb/cached_at). No migration needed. Cleanup is handled by the
 * existing `cleanup_expired_cache()` function (7-day window on that table —
 * shorter than our TTL, so we treat misses as "not cached" silently).
 */

const CACHE_KEY_PREFIX = "strat_skills_v1";
const TTL_DAYS = 7; // Aligned to enrichment_cache cleanup window.

/** Stable 31-bit FNV-1a hash. Matches deterministicSeedFromString in scan-utils. */
function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

/**
 * Build a cache key from the score-affecting profile inputs.
 * MUST include rawProfileText so different resumes don't collide.
 */
export function buildProfileCacheKey(args: {
  rawProfileText: string;
  role: string;
  industry: string;
  experienceYears: number | null;
}): string {
  const norm = [
    args.rawProfileText || "",
    (args.role || "").trim().toLowerCase(),
    (args.industry || "").trim().toLowerCase(),
    args.experienceYears == null ? "" : String(args.experienceYears),
  ].join("\n--ssc--\n");
  return `${CACHE_KEY_PREFIX}:${fnv1a(norm)}`;
}

export interface CachedStrategicSkills {
  strategic_skills: string[];
  cached_at: string;
  profiler_model: string | null;
}

/** Returns null on miss, error, or expiry. Never throws. */
export async function getCachedStrategicSkills(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cacheKey: string,
): Promise<CachedStrategicSkills | null> {
  try {
    const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .gte("cached_at", cutoff)
      .maybeSingle();
    if (error || !data) return null;
    const payload = data.data as { strategic_skills?: unknown; profiler_model?: unknown };
    if (!Array.isArray(payload?.strategic_skills)) return null;
    const skills = payload.strategic_skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (skills.length === 0) return null;
    return {
      strategic_skills: skills,
      cached_at: data.cached_at,
      profiler_model: typeof payload.profiler_model === "string" ? payload.profiler_model : null,
    };
  } catch {
    return null;
  }
}

/** Best-effort upsert. Never throws. */
export async function cacheStrategicSkills(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cacheKey: string,
  strategic_skills: string[],
  profiler_model: string | null,
): Promise<void> {
  try {
    const cleaned = (strategic_skills || []).filter((s) => typeof s === "string" && s.trim().length > 0);
    if (cleaned.length === 0) return; // Don't cache empty — let next run try fresh.
    await supabase.from("enrichment_cache").upsert({
      cache_key: cacheKey,
      data: { strategic_skills: cleaned, profiler_model },
      cached_at: new Date().toISOString(),
    });
  } catch {
    /* non-fatal */
  }
}

// ═══════════════════════════════════════════════════════════════
// Sprint 0 (2026-04-29): Broader Agent1 profile cache
// ═══════════════════════════════════════════════════════════════
// Round 9 cached strategic_skills only — that fixed the 13-pt Survivability
// swing but execution_skills, all_skills, and role_detected still drift
// across re-scans (Agent1 is non-deterministic via the LLM gateway). They
// don't drive the headline score, but they DO drive:
//   • Knowledge Graph skill chips (UI churn — same resume, different chips)
//   • Cohort matching (role_detected drift → wrong percentile bucket)
//   • Side-hustle / pivot prompts (skill set changes → different suggestions)
//
// Strategy: parallel cache entry under key prefix "agent1_profile_v1" in the
// SAME enrichment_cache table. Separate prefix so it can be invalidated
// independently. Same 7-day TTL to align with cleanup_expired_cache().
// Empty arrays / blank role_detected are NOT cached (don't poison the cache).

const PROFILE_CACHE_KEY_PREFIX = "agent1_profile_v1";

export interface CachedAgent1Profile {
  execution_skills: string[];
  all_skills: string[];
  role_detected: string | null;
  cached_at: string;
  profiler_model: string | null;
}

export function buildAgent1ProfileCacheKey(args: {
  rawProfileText: string;
  role: string;
  industry: string;
  experienceYears: number | null;
}): string {
  const norm = [
    args.rawProfileText || "",
    (args.role || "").trim().toLowerCase(),
    (args.industry || "").trim().toLowerCase(),
    args.experienceYears == null ? "" : String(args.experienceYears),
  ].join("\n--a1p--\n");
  return `${PROFILE_CACHE_KEY_PREFIX}:${fnv1a(norm)}`;
}

/** Returns null on miss, error, expiry, or unusable shape. Never throws. */
export async function getCachedAgent1Profile(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cacheKey: string,
): Promise<CachedAgent1Profile | null> {
  try {
    const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .gte("cached_at", cutoff)
      .maybeSingle();
    if (error || !data) return null;
    const payload = data.data as {
      execution_skills?: unknown;
      all_skills?: unknown;
      role_detected?: unknown;
      profiler_model?: unknown;
    };
    const exec = Array.isArray(payload?.execution_skills)
      ? payload.execution_skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
    const all = Array.isArray(payload?.all_skills)
      ? payload.all_skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
    const role = typeof payload.role_detected === "string" && payload.role_detected.trim().length > 0
      ? payload.role_detected.trim()
      : null;
    // Require at least all_skills OR role to be useful — otherwise treat as miss.
    if (all.length === 0 && !role) return null;
    return {
      execution_skills: exec,
      all_skills: all,
      role_detected: role,
      cached_at: data.cached_at,
      profiler_model: typeof payload.profiler_model === "string" ? payload.profiler_model : null,
    };
  } catch {
    return null;
  }
}

/** Best-effort upsert. Never throws. Skips entries with no usable data. */
export async function cacheAgent1Profile(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cacheKey: string,
  payload: {
    execution_skills: string[];
    all_skills: string[];
    role_detected: string | null;
    profiler_model: string | null;
  },
): Promise<void> {
  try {
    const exec = (payload.execution_skills || []).filter((s) => typeof s === "string" && s.trim().length > 0);
    const all = (payload.all_skills || []).filter((s) => typeof s === "string" && s.trim().length > 0);
    const role = typeof payload.role_detected === "string" && payload.role_detected.trim().length > 0
      ? payload.role_detected.trim()
      : null;
    if (all.length === 0 && !role) return; // Don't cache junk.
    await supabase.from("enrichment_cache").upsert({
      cache_key: cacheKey,
      data: {
        execution_skills: exec,
        all_skills: all,
        role_detected: role,
        profiler_model: payload.profiler_model,
      },
      cached_at: new Date().toISOString(),
    });
  } catch {
    /* non-fatal */
  }
}
