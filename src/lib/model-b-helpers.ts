// ═══════════════════════════════════════════════════════════════
// Model B helpers — pure, testable nuclei of the round-3 fixes.
//
// These exist so the regression tests for BL-012 / BL-013 / BL-014
// can target tiny pure functions instead of spinning up the full
// 900-line ResultsModelB page. The page consumes these helpers; if
// anyone ever re-introduces a streak-never-resets bug or makes
// progressPct lie again, the test in model-b-helpers.test.ts fails
// before the change can ship.
//
// Invariants enforced here:
//   INV-F01 — modal/scan state must clear when scan_id changes
//   INV-F02 — streak resets to 1 on a calendar gap of ≥ 2 days
//   INV-F03 — progress reflects work done, not active tab index
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the next streak value given today's date, the date the
 * streak was last touched, and the current streak count.
 *
 * Rules (BL-013 / INV-F02):
 *   • same calendar day  → keep current streak (or 1 if none)
 *   • exactly 1 day gap  → increment (yesterday → today continues)
 *   • ≥ 2 day gap        → reset to 1
 *   • no prior date      → start at 1
 */
export function nextStreak(
  today: Date,
  lastDateStr: string | null,
  current: number,
): number {
  const todayStr = today.toDateString();
  if (lastDateStr === todayStr) {
    return current > 0 ? current : 1;
  }
  if (!lastDateStr) {
    return 1;
  }
  const last = new Date(lastDateStr);
  if (isNaN(last.getTime())) return 1;

  const dayMs = 24 * 60 * 60 * 1000;
  const todayMidnight = new Date(today).setHours(0, 0, 0, 0);
  const lastMidnight = new Date(last).setHours(0, 0, 0, 0);
  const diffDays = Math.round((todayMidnight - lastMidnight) / dayMs);

  if (diffDays === 1) return (current > 0 ? current : 0) + 1;
  return 1;
}

/**
 * Progress shown in the journey bar (BL-014 / INV-F03).
 * Always derived from how many tabs the user has actually visited,
 * never from the index of the currently-active tab.
 *
 * Bounded to [0, 100]. Defensive against bad inputs (negative,
 * NaN, totalTabs <= 0).
 */
export function journeyProgressPct(
  visitedCount: number,
  totalTabs: number,
): number {
  if (!Number.isFinite(visitedCount) || !Number.isFinite(totalTabs)) return 0;
  if (totalTabs <= 0) return 0;
  if (visitedCount <= 0) return 0;
  const pct = (visitedCount / totalTabs) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Should we reset per-scan UI state (modals, current card, etc.)
 * because the scan being viewed has changed? (BL-012 / INV-F01)
 *
 * Returns true on *transitions* between distinct non-null scan IDs.
 * Returns false on first mount (prevId null), on no change, or on
 * transitioning to a null id (which is "no scan loaded yet" — handled
 * separately by the loading state, not by clearing state).
 */
export function shouldClearScanState(
  prevId: string | null | undefined,
  nextId: string | null | undefined,
): boolean {
  if (!prevId) return false;
  if (!nextId) return false;
  return prevId !== nextId;
}
