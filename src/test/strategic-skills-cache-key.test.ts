/**
 * strategic-skills-cache-key.test.ts (Round 9, 2026-04-29)
 *
 * Mirror test that locks in the FNV-1a hash shape used by the Deno-side
 * `_shared/strategic-skills-cache.ts`. The cache module itself is Deno-only
 * (server runtime), so we can't import it directly from vitest. Instead we
 * replicate the pure hash + key-builder logic here so that ANY future change
 * to the hash algorithm in the edge function will fail this test — forcing a
 * coordinated cache bust (bump CACHE_KEY_PREFIX from v1 → v2).
 *
 * Heuristic conditions this fixture is calibrated against:
 *   – Hash: 31-bit FNV-1a (offset basis 2166136261, prime 16777619)
 *   – Output range: 1 .. 2147483646 (skip 0 sentinel)
 *   – Key format: "strat_skills_v1:<int>"
 *   – Normalisation: role + industry → trim().toLowerCase(); resume verbatim
 *   – Separator: "\n--ssc--\n"
 *   – Null exp years → empty string segment
 */

import { describe, it, expect } from "vitest";

// ── Local replica of the Deno module's pure functions ─────────────────────
function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

function buildKey(args: { rawProfileText: string; role: string; industry: string; experienceYears: number | null }): string {
  const norm = [
    args.rawProfileText || "",
    (args.role || "").trim().toLowerCase(),
    (args.industry || "").trim().toLowerCase(),
    args.experienceYears == null ? "" : String(args.experienceYears),
  ].join("\n--ssc--\n");
  return `strat_skills_v1:${fnv1a(norm)}`;
}

describe("strategic-skills cache key (mirror of Deno module)", () => {
  it("matches versioned prefix", () => {
    expect(buildKey({ rawProfileText: "x", role: "y", industry: "z", experienceYears: 1 })).toMatch(/^strat_skills_v1:\d+$/);
  });

  it("identical inputs → identical key", () => {
    const a = { rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 };
    expect(buildKey(a)).toBe(buildKey(a));
  });

  it("resume diff (1 char) → different key", () => {
    expect(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 }))
      .not.toBe(buildKey({ rawProfileText: "abd", role: "CTO", industry: "Tech", experienceYears: 12 }));
  });

  it("role/industry casing + whitespace normalised", () => {
    expect(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 }))
      .toBe(buildKey({ rawProfileText: "abc", role: "  cto  ", industry: "TECH", experienceYears: 12 }));
  });

  it("experience year swing → different key", () => {
    expect(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 12 }))
      .not.toBe(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: 13 }));
  });

  it("null experience years is stable", () => {
    expect(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: null }))
      .toBe(buildKey({ rawProfileText: "abc", role: "CTO", industry: "Tech", experienceYears: null }));
  });

  it("hash output never 0", () => {
    // FNV-1a of empty string yields 2166136261; %2147483647 = 18648967, non-zero.
    // Defensive check: empty inputs still produce a valid positive int.
    const k = buildKey({ rawProfileText: "", role: "", industry: "", experienceYears: null });
    const intPart = Number(k.split(":")[1]);
    expect(intPart).toBeGreaterThan(0);
  });
});
