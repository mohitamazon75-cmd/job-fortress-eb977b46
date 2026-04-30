/**
 * Pure pivot sort — used by Card4PivotPaths.
 *
 * Pass C1 (2026-04-30): the LLM emits `pivots` in arbitrary order, sometimes
 * placing a 94% match below an 88% match. This module sorts by `match_pct` DESC
 * with a stable tie-break on the original index, so the user always sees the
 * strongest-fit role at position #1.
 *
 * Calibration:
 *   - Pivots without a numeric `match_pct` are pushed to the bottom (-1).
 *   - Sort is stable on ties (LLM-emitted order preserved).
 *   - Pure: mutates nothing, returns a new array.
 */
export interface PivotLike {
  match_pct?: unknown;
  [k: string]: unknown;
}

export function sortPivotsByMatch<T extends PivotLike>(input: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(input)) return [];
  return [...input]
    .map((p, i) => ({ p, i, m: Number(p?.match_pct) }))
    .sort((a, b) => {
      const am = Number.isFinite(a.m) ? a.m : -1;
      const bm = Number.isFinite(b.m) ? b.m : -1;
      if (bm !== am) return bm - am;
      return a.i - b.i;
    })
    .map((x) => x.p);
}
