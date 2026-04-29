/**
 * strategic-skills-cache.test.ts (Round 9, 2026-04-29)
 *
 * Locks in:
 *   • cache key includes resume content → different resumes don't collide
 *   • cache key normalises role/industry casing → "CTO" === "cto"
 *   • cache key changes when experience_years changes
 *   • get returns null on miss, error, expiry, empty array, or wrong shape
 *   • set skips empty arrays (don't poison cache with junk)
 *   • set + get round-trip preserves order and values
 *
 * Heuristic conditions this fixture is calibrated against (per project rule):
 *   – TTL window: 7 days (matches enrichment_cache cleanup)
 *   – Cache key prefix: "strat_skills_v1"
 *   – Hash: 31-bit FNV-1a, matches deterministicSeedFromString
 */

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildProfileCacheKey,
  cacheStrategicSkills,
  getCachedStrategicSkills,
} from "./strategic-skills-cache.ts";

// ── Minimal in-memory supabase double ──────────────────────────────────────
function makeFakeSupabase(initial: Record<string, { data: unknown; cached_at: string }> = {}) {
  const store = { ...initial };
  return {
    _store: store,
    from(_table: string) {
      return {
        select(_cols: string) {
          const chain: any = {
            _key: null as string | null,
            _cutoff: null as string | null,
            eq(col: string, val: string) { if (col === "cache_key") chain._key = val; return chain; },
            gte(_col: string, val: string) { chain._cutoff = val; return chain; },
            async maybeSingle() {
              const row = chain._key ? store[chain._key] : null;
              if (!row) return { data: null, error: null };
              if (chain._cutoff && row.cached_at < chain._cutoff) return { data: null, error: null };
              return { data: { data: row.data, cached_at: row.cached_at }, error: null };
            },
          };
          return chain;
        },
        async upsert(payload: { cache_key: string; data: unknown; cached_at: string }) {
          store[payload.cache_key] = { data: payload.data, cached_at: payload.cached_at };
          return { error: null };
        },
      };
    },
  };
}

Deno.test("buildProfileCacheKey: same inputs → same key", () => {
  const k1 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  const k2 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  assertEquals(k1, k2);
});

Deno.test("buildProfileCacheKey: different resume → different key", () => {
  const k1 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  const k2 = buildProfileCacheKey({ rawProfileText: "abd", role: "CTO", industry: "Tech", experienceYears: 12 });
  assertNotEquals(k1, k2);
});

Deno.test("buildProfileCacheKey: role/industry casing normalised", () => {
  const k1 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  const k2 = buildProfileCacheKey({ rawProfileText: "abc", role: "  cto  ", industry: "TECH", experienceYears: 12 });
  assertEquals(k1, k2);
});

Deno.test("buildProfileCacheKey: experience_years swing → different key", () => {
  const k1 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  const k2 = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 13 });
  assertNotEquals(k1, k2);
});

Deno.test("buildProfileCacheKey: prefix is versioned", () => {
  const k = buildProfileCacheKey({ rawProfileText: "x", role: "y", industry: "z", experienceYears: 1 });
  assertEquals(k.startsWith("strat_skills_v1:"), true);
});

Deno.test("getCachedStrategicSkills: miss returns null", async () => {
  const sb = makeFakeSupabase();
  const got = await getCachedStrategicSkills(sb, "strat_skills_v1:nope");
  assertEquals(got, null);
});

Deno.test("set + get round-trip preserves skills array", async () => {
  const sb = makeFakeSupabase();
  const key = buildProfileCacheKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 });
  await cacheStrategicSkills(sb, key, ["Strategy", "M&A", "Board Mgmt"], "google/gemini-3-pro");
  const got = await getCachedStrategicSkills(sb, key);
  assertEquals(got?.strategic_skills, ["Strategy", "M&A", "Board Mgmt"]);
  assertEquals(got?.profiler_model, "google/gemini-3-pro");
});

Deno.test("cacheStrategicSkills: empty array is NOT cached", async () => {
  const sb = makeFakeSupabase();
  const key = "strat_skills_v1:empty";
  await cacheStrategicSkills(sb, key, [], null);
  const got = await getCachedStrategicSkills(sb, key);
  assertEquals(got, null);
});

Deno.test("getCachedStrategicSkills: wrong shape returns null", async () => {
  const sb = makeFakeSupabase({
    "strat_skills_v1:bad": { data: { strategic_skills: "not-an-array" }, cached_at: new Date().toISOString() },
  });
  const got = await getCachedStrategicSkills(sb, "strat_skills_v1:bad");
  assertEquals(got, null);
});

Deno.test("getCachedStrategicSkills: expired entry returns null", async () => {
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30d ago
  const sb = makeFakeSupabase({
    "strat_skills_v1:old": { data: { strategic_skills: ["X"] }, cached_at: oldDate },
  });
  const got = await getCachedStrategicSkills(sb, "strat_skills_v1:old");
  assertEquals(got, null);
});
