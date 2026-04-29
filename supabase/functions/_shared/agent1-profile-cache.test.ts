/**
 * agent1-profile-cache.test.ts (Sprint 0, 2026-04-29)
 *
 * Companion to strategic-skills-cache.test.ts. Locks in the broader Agent1
 * profile cache (execution_skills + all_skills + role_detected).
 *
 * Locks in:
 *   • cache key includes resume content + role + industry + experience
 *   • prefix is "agent1_profile_v1" (separate from strategic_skills cache)
 *   • casing normalized for role/industry
 *   • round-trip preserves all 3 payload fields + profiler_model
 *   • set skips junk (no all_skills AND no role_detected)
 *   • get returns null on miss / expiry / unusable shape
 *   • get filters out non-string array elements
 *
 * Heuristic conditions this fixture is calibrated against (per project rule):
 *   – TTL window: 7 days, must match cleanup_expired_cache().
 *   – Cache stores execution_skills, all_skills, role_detected — NOT
 *     strategic_skills (those go through cacheStrategicSkills which is the
 *     score-affecting cache). Splitting prevents accidental cross-contamination.
 *   – "Useful" payload = at least all_skills.length > 0 OR role_detected != null.
 *     We do NOT require execution_skills (many resumes are pure-strategic).
 */

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAgent1ProfileCacheKey,
  cacheAgent1Profile,
  getCachedAgent1Profile,
} from "./strategic-skills-cache.ts";

function makeFakeSupabase(initial: Record<string, { data: unknown; cached_at: string }> = {}) {
  const store = { ...initial };
  return {
    _store: store,
    from(_table: string) {
      return {
        select(_cols: string) {
          // deno-lint-ignore no-explicit-any
          const chain: any = {
            _key: null as string | null,
            _cutoff: null as string | null,
            eq(col: string, val: string) { if (col === "cache_key") chain._key = val; return chain; },
            gte(_col: string, val: string) { chain._cutoff = val; return chain; },
            // deno-lint-ignore require-await
            async maybeSingle() {
              const row = chain._key ? store[chain._key] : null;
              if (!row) return { data: null, error: null };
              if (chain._cutoff && row.cached_at < chain._cutoff) return { data: null, error: null };
              return { data: { data: row.data, cached_at: row.cached_at }, error: null };
            },
          };
          return chain;
        },
        // deno-lint-ignore require-await
        async upsert(payload: { cache_key: string; data: unknown; cached_at: string }) {
          store[payload.cache_key] = { data: payload.data, cached_at: payload.cached_at };
          return { error: null };
        },
      };
    },
  };
}

Deno.test("buildAgent1ProfileCacheKey: prefix is versioned and distinct", () => {
  const k = buildAgent1ProfileCacheKey({ rawProfileText: "x", role: "y", industry: "z", experienceYears: 1 });
  assertEquals(k.startsWith("agent1_profile_v1:"), true);
});

Deno.test("buildAgent1ProfileCacheKey: same inputs → same key", () => {
  const a = { rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 };
  assertEquals(buildAgent1ProfileCacheKey(a), buildAgent1ProfileCacheKey(a));
});

Deno.test("buildAgent1ProfileCacheKey: different resume → different key", () => {
  const a = { rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 };
  const b = { ...a, rawProfileText: "abd" };
  assertNotEquals(buildAgent1ProfileCacheKey(a), buildAgent1ProfileCacheKey(b));
});

Deno.test("buildAgent1ProfileCacheKey: role/industry casing normalized", () => {
  const a = buildAgent1ProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  const b = buildAgent1ProfileCacheKey({ rawProfileText: "abc", role: " cto ", industry: "TECH", experienceYears: 12 });
  assertEquals(a, b);
});

Deno.test("buildAgent1ProfileCacheKey: distinct from strategic-skills cache key", () => {
  // The two caches share the same table; key prefixes MUST differ to avoid collision.
  const k = buildAgent1ProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  assertEquals(k.startsWith("strat_skills_v1:"), false);
});

Deno.test("getCachedAgent1Profile: miss returns null", async () => {
  const sb = makeFakeSupabase();
  const got = await getCachedAgent1Profile(sb, "agent1_profile_v1:nope");
  assertEquals(got, null);
});

Deno.test("set + get round-trip preserves all fields", async () => {
  const sb = makeFakeSupabase();
  const key = buildAgent1ProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  await cacheAgent1Profile(sb, key, {
    execution_skills: ["Coding", "Reviews"],
    all_skills: ["Coding", "Reviews", "Architecture"],
    role_detected: "Chief Technology Officer",
    profiler_model: "google/gemini-3-pro",
  });
  const got = await getCachedAgent1Profile(sb, key);
  assertEquals(got?.execution_skills, ["Coding", "Reviews"]);
  assertEquals(got?.all_skills, ["Coding", "Reviews", "Architecture"]);
  assertEquals(got?.role_detected, "Chief Technology Officer");
  assertEquals(got?.profiler_model, "google/gemini-3-pro");
});

Deno.test("cacheAgent1Profile: junk payload (no all_skills, no role) NOT cached", async () => {
  const sb = makeFakeSupabase();
  const key = "agent1_profile_v1:junk";
  await cacheAgent1Profile(sb, key, {
    execution_skills: ["X"],
    all_skills: [],
    role_detected: null,
    profiler_model: null,
  });
  const got = await getCachedAgent1Profile(sb, key);
  assertEquals(got, null);
});

Deno.test("cacheAgent1Profile: role-only payload IS cached", async () => {
  const sb = makeFakeSupabase();
  const key = "agent1_profile_v1:roleonly";
  await cacheAgent1Profile(sb, key, {
    execution_skills: [],
    all_skills: [],
    role_detected: "Product Manager",
    profiler_model: null,
  });
  const got = await getCachedAgent1Profile(sb, key);
  assertEquals(got?.role_detected, "Product Manager");
  assertEquals(got?.all_skills, []);
});

Deno.test("getCachedAgent1Profile: filters non-string array elements", async () => {
  const sb = makeFakeSupabase({
    "agent1_profile_v1:dirty": {
      data: { execution_skills: ["Good", 42, null, ""], all_skills: ["X"], role_detected: "PM" },
      cached_at: new Date().toISOString(),
    },
  });
  const got = await getCachedAgent1Profile(sb, "agent1_profile_v1:dirty");
  assertEquals(got?.execution_skills, ["Good"]);
});

Deno.test("getCachedAgent1Profile: expired entry returns null", async () => {
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sb = makeFakeSupabase({
    "agent1_profile_v1:old": {
      data: { all_skills: ["X"], role_detected: "PM" },
      cached_at: oldDate,
    },
  });
  const got = await getCachedAgent1Profile(sb, "agent1_profile_v1:old");
  assertEquals(got, null);
});
