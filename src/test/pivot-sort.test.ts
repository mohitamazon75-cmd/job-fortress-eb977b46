/**
 * Pass C1 (2026-04-30) — pivot sort regression net.
 *
 * Locks in the contract for sortPivotsByMatch:
 *   1. Rank by match_pct DESC (audit bug: 94% appearing below 88%)
 *   2. Stable on ties (preserves LLM-emitted order so the same payload renders identically)
 *   3. Pivots without a numeric match_pct sink to the bottom (-1 sentinel)
 *   4. Null/undefined/non-array input → empty array (no throws)
 *   5. Pure: input array is not mutated
 *
 * If any heuristic above changes, restate it in this comment. Summaries rot.
 */
import { describe, it, expect } from "vitest";
import { sortPivotsByMatch } from "@/lib/pivot-sort";

describe("sortPivotsByMatch", () => {
  it("ranks 94% before 88% before 76% (audit regression: 94% must be #1)", () => {
    const input = [
      { role: "Director RevOps", match_pct: 88 },
      { role: "GTM Strategy Consultant", match_pct: 76 },
      { role: "Head of Demand Gen", match_pct: 94 },
    ];
    const out = sortPivotsByMatch(input);
    expect(out.map((p) => p.role)).toEqual([
      "Head of Demand Gen",
      "Director RevOps",
      "GTM Strategy Consultant",
    ]);
  });

  it("is stable on ties (same match_pct preserves LLM order)", () => {
    const input = [
      { role: "A", match_pct: 80 },
      { role: "B", match_pct: 80 },
      { role: "C", match_pct: 80 },
    ];
    const out = sortPivotsByMatch(input);
    expect(out.map((p) => p.role)).toEqual(["A", "B", "C"]);
  });

  it("pushes pivots with missing/non-numeric match_pct to the bottom", () => {
    const input = [
      { role: "NoScore" }, // undefined
      { role: "Strong", match_pct: 90 },
      { role: "Garbage", match_pct: "high" }, // non-numeric
      { role: "Weak", match_pct: 60 },
    ];
    const out = sortPivotsByMatch(input);
    expect(out[0].role).toBe("Strong");
    expect(out[1].role).toBe("Weak");
    // NoScore and Garbage tie at -1; stable order preserves LLM emission
    expect(out[2].role).toBe("NoScore");
    expect(out[3].role).toBe("Garbage");
  });

  it("returns empty array for null/undefined/non-array input (no throws)", () => {
    expect(sortPivotsByMatch(null as any)).toEqual([]);
    expect(sortPivotsByMatch(undefined as any)).toEqual([]);
    expect(sortPivotsByMatch("not-an-array" as any)).toEqual([]);
    expect(sortPivotsByMatch({} as any)).toEqual([]);
  });

  it("does not mutate the input array (purity check)", () => {
    const input = [
      { role: "A", match_pct: 50 },
      { role: "B", match_pct: 90 },
    ];
    const snapshot = JSON.stringify(input);
    sortPivotsByMatch(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
