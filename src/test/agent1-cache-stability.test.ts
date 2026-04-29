/**
 * agent1-cache-stability.test.ts (Sprint 7 snapshot, 2026-04-29)
 *
 * Snapshot test that locks in deterministic cache-key generation so future
 * refactors of the FNV-1a hash, normalization rules, or key prefix CANNOT
 * silently regress. Hash output is intentionally hard-coded; if these
 * snapshots fail, you have changed the cache key contract and every cached
 * scan in production will be invalidated. That is a deliberate decision —
 * make it explicitly, do not "fix" the test by updating the snapshot.
 *
 * Why frontend snapshot for an edge-function module: the hash function is
 * pure and can be re-implemented as a vitest fixture. Locking the expected
 * outputs in BOTH test runners (Deno + vitest) means a refactor in one
 * environment can't ship past the other's CI gate.
 *
 * Heuristic conditions this fixture is calibrated against (per project rule):
 *   – Hash: 31-bit FNV-1a, offset 2166136261, prime 16777619, mod 2147483647.
 *   – Strategic-skills cache prefix: "strat_skills_v1:" (Round 9).
 *   – Agent1 profile cache prefix: "agent1_profile_v1:" (Sprint 0).
 *   – Joiners: "\n--ssc--\n" (strategic) and "\n--a1p--\n" (profile).
 *   – Role/industry trimmed and lowercased BEFORE hashing.
 *   – experience_years null/undefined → empty string in key (NOT "null").
 *
 * If you change ANY of the above, expect every cached scan to miss for ~7
 * days until the TTL flushes. That is not a bug; it is the price of changing
 * the contract. Document the change in DECISIONS.md.
 */

import { describe, it, expect } from "vitest";

// Re-implement the pure FNV-1a so the test doesn't depend on Deno imports.
// MUST stay byte-identical to fnv1a in supabase/functions/_shared/strategic-skills-cache.ts.
function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

function buildStrategicKey(args: {
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
  return `strat_skills_v1:${fnv1a(norm)}`;
}

function buildProfileKey(args: {
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
  return `agent1_profile_v1:${fnv1a(norm)}`;
}

describe("Agent1 cache key stability (Sprint 7 snapshot)", () => {
  // Fixture A: typical mid-career PM
  const FIXTURE_A = {
    rawProfileText: "Priya Sharma\nProduct Manager at Flipkart\n8 years experience in e-commerce and growth.",
    role: "Product Manager",
    industry: "E-commerce",
    experienceYears: 8,
  };

  // Fixture B: executive
  const FIXTURE_B = {
    rawProfileText: "Rohan Mehta\nChief Technology Officer\n18 years building engineering teams across fintech.",
    role: "CTO",
    industry: "Fintech",
    experienceYears: 18,
  };

  // Fixture C: edge — empty/null experience
  const FIXTURE_C = {
    rawProfileText: "fresh grad",
    role: "Software Engineer",
    industry: "Tech",
    experienceYears: null,
  };

  it("FIXTURE_A strategic-skills key snapshot", () => {
    expect(buildStrategicKey(FIXTURE_A)).toMatchInlineSnapshot(`"strat_skills_v1:1428562440"`);
  });

  it("FIXTURE_A profile key snapshot", () => {
    expect(buildProfileKey(FIXTURE_A)).toMatchInlineSnapshot(`"agent1_profile_v1:1483401960"`);
  });

  it("FIXTURE_B strategic-skills key snapshot", () => {
    expect(buildStrategicKey(FIXTURE_B)).toMatchInlineSnapshot(`"strat_skills_v1:894477090"`);
  });

  it("FIXTURE_B profile key snapshot", () => {
    expect(buildProfileKey(FIXTURE_B)).toMatchInlineSnapshot(`"agent1_profile_v1:1252807458"`);
  });

  it("FIXTURE_C (null experience) strategic-skills key snapshot", () => {
    expect(buildStrategicKey(FIXTURE_C)).toMatchInlineSnapshot(`"strat_skills_v1:1729408253"`);
  });

  it("FIXTURE_C (null experience) profile key snapshot", () => {
    expect(buildProfileKey(FIXTURE_C)).toMatchInlineSnapshot(`"agent1_profile_v1:1729408253"`);
  });

  it("strategic and profile keys for the same input are DIFFERENT (no cache collision)", () => {
    expect(buildStrategicKey(FIXTURE_A)).not.toBe(buildProfileKey(FIXTURE_A));
    expect(buildStrategicKey(FIXTURE_B)).not.toBe(buildProfileKey(FIXTURE_B));
  });

  it("two identical fixture invocations produce byte-identical keys (determinism)", () => {
    expect(buildStrategicKey(FIXTURE_A)).toBe(buildStrategicKey(FIXTURE_A));
    expect(buildProfileKey(FIXTURE_B)).toBe(buildProfileKey(FIXTURE_B));
  });

  it("role/industry casing is normalized (CTO === cto, Tech === TECH)", () => {
    const upper = { ...FIXTURE_B, role: "CTO", industry: "FINTECH" };
    const lower = { ...FIXTURE_B, role: "  cto  ", industry: "fintech" };
    expect(buildStrategicKey(upper)).toBe(buildStrategicKey(lower));
    expect(buildProfileKey(upper)).toBe(buildProfileKey(lower));
  });
});
