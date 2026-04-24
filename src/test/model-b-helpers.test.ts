// ═══════════════════════════════════════════════════════════════
// Round-3 regression tests — BL-012 / BL-013 / BL-014.
//
// Each `describe` block locks in one of the bugs we found in the
// third audit pass. If a future refactor re-introduces any of them,
// CI fails before merge (per docs/DEFINITION_OF_DONE.md).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  getAnalysisErrorCode,
  nextStreak,
  journeyProgressPct,
  shouldClearScanState,
} from "@/lib/model-b-helpers";

// ─────────────────────────────────────────────────────────────────
// BL-013 / INV-F02 — Streak resets to 1 after a ≥ 2-day calendar gap.
// Round-3 finding: counter incremented forever even after skipped days.
// ─────────────────────────────────────────────────────────────────
describe("nextStreak (BL-013 / INV-F02)", () => {
  const day = (s: string) => new Date(s);

  it("returns 1 on first ever visit (no prior date)", () => {
    expect(nextStreak(day("2026-04-24T10:00:00Z"), null, 0)).toBe(1);
  });

  it("keeps the streak unchanged on a same-day re-visit", () => {
    const today = day("2026-04-24T10:00:00Z");
    expect(nextStreak(today, today.toDateString(), 5)).toBe(5);
  });

  it("treats a same-day visit with current=0 as streak 1", () => {
    const today = day("2026-04-24T10:00:00Z");
    expect(nextStreak(today, today.toDateString(), 0)).toBe(1);
  });

  it("increments on a 1-day gap (yesterday → today)", () => {
    const yesterday = day("2026-04-23T10:00:00Z").toDateString();
    expect(nextStreak(day("2026-04-24T10:00:00Z"), yesterday, 4)).toBe(5);
  });

  it("RESETS to 1 after a 2-day gap", () => {
    const twoDaysAgo = day("2026-04-22T10:00:00Z").toDateString();
    expect(nextStreak(day("2026-04-24T10:00:00Z"), twoDaysAgo, 9)).toBe(1);
  });

  it("RESETS to 1 after a 7-day gap", () => {
    const weekAgo = day("2026-04-17T10:00:00Z").toDateString();
    expect(nextStreak(day("2026-04-24T10:00:00Z"), weekAgo, 30)).toBe(1);
  });

  it("handles a corrupted lastDateStr by resetting to 1", () => {
    expect(nextStreak(day("2026-04-24T10:00:00Z"), "not-a-date", 9)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// BL-014 / INV-F03 — progressPct reflects visited tabs, not active index.
// Round-3 finding: jumping straight to the last tab read as 100% complete.
// ─────────────────────────────────────────────────────────────────
describe("journeyProgressPct (BL-014 / INV-F03)", () => {
  it("0 visited → 0%", () => {
    expect(journeyProgressPct(0, 9)).toBe(0);
  });

  it("1 of 9 visited → ~11%, NOT 100% even if user is on the last tab", () => {
    const pct = journeyProgressPct(1, 9);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(20);
  });

  it("all visited → exactly 100%", () => {
    expect(journeyProgressPct(9, 9)).toBe(100);
  });

  it("clamps to 100 when visited > total (defensive)", () => {
    expect(journeyProgressPct(99, 9)).toBe(100);
  });

  it("returns 0 for invalid inputs (defensive)", () => {
    expect(journeyProgressPct(NaN, 9)).toBe(0);
    expect(journeyProgressPct(5, 0)).toBe(0);
    expect(journeyProgressPct(-3, 9)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// BL-012 / INV-F01 — UI state must clear when scan_id changes.
// Round-3 finding: actionModal leaked across navigation between scans.
// ─────────────────────────────────────────────────────────────────
describe("shouldClearScanState (BL-012 / INV-F01)", () => {
  it("does NOT clear on first mount (no prev id)", () => {
    expect(shouldClearScanState(null, "scan-A")).toBe(false);
    expect(shouldClearScanState(undefined, "scan-A")).toBe(false);
  });

  it("does NOT clear when id is unchanged", () => {
    expect(shouldClearScanState("scan-A", "scan-A")).toBe(false);
  });

  it("does NOT clear when transitioning to null (handled by loading state)", () => {
    expect(shouldClearScanState("scan-A", null)).toBe(false);
  });

  it("DOES clear when navigating between two distinct scan ids", () => {
    expect(shouldClearScanState("scan-A", "scan-B")).toBe(true);
  });

  it("DOES clear even between visually similar ids", () => {
    expect(shouldClearScanState("abc-123", "abc-124")).toBe(true);
  });
});

describe("getAnalysisErrorCode", () => {
  it("extracts app-level error codes from handled edge payloads", () => {
    expect(getAnalysisErrorCode({ success: false, code: "FORBIDDEN" })).toBe("FORBIDDEN");
  });

  it("returns null for missing or invalid payloads", () => {
    expect(getAnalysisErrorCode(null)).toBeNull();
    expect(getAnalysisErrorCode({ success: false })).toBeNull();
    expect(getAnalysisErrorCode("FORBIDDEN")).toBeNull();
  });
});
