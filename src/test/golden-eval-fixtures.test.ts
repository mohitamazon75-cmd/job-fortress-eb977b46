/**
 * Static integrity check for the Golden Eval fixture file.
 * Runs in normal Vitest — no network, no DB. Catches:
 *   • duplicate fixture IDs
 *   • impossible score windows (min > max, outside [0,100])
 *   • tone tags that contradict their declared score window
 *   • family counts dropping below the minimum coverage we promised
 *
 * If this test fails, a fixture file edit broke an invariant — fix the
 * fixture before pushing. The integration runner (golden-eval-run edge fn)
 * tests the actual scoring engine; this file tests the eval suite itself.
 */

import { describe, it, expect } from "vitest";
import {
  GOLDEN_FIXTURES,
  expectedToneForScore,
  GOLDEN_EVAL_PASS_THRESHOLD,
  FAMILY_COUNTS,
} from "../../supabase/functions/_shared/golden-eval-fixtures";

describe("Golden Eval fixture file integrity", () => {
  it("has at least 50 fixtures", () => {
    expect(GOLDEN_FIXTURES.length).toBeGreaterThanOrEqual(50);
  });

  it("every fixture has a unique id", () => {
    const ids = GOLDEN_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every score window is well-formed and inside [0,100]", () => {
    for (const f of GOLDEN_FIXTURES) {
      expect(f.expected_score_min, `${f.id} min`).toBeGreaterThanOrEqual(0);
      expect(f.expected_score_max, `${f.id} max`).toBeLessThanOrEqual(100);
      expect(f.expected_score_min, `${f.id} min<=max`).toBeLessThanOrEqual(f.expected_score_max);
      // Window must be wide enough to be useful (≥10) but not absurdly wide (≤50)
      const width = f.expected_score_max - f.expected_score_min;
      expect(width, `${f.id} window width`).toBeGreaterThanOrEqual(15);
      expect(width, `${f.id} window width`).toBeLessThanOrEqual(50);
    }
  });

  it("declared tone is consistent with score window midpoint (within 1 tone class)", () => {
    const TONE_ORDER = ["CRITICAL", "WARNING", "MODERATE", "STABLE"];
    for (const f of GOLDEN_FIXTURES) {
      const mid = (f.expected_score_min + f.expected_score_max) / 2;
      const impliedTone = expectedToneForScore(mid);
      const distance = Math.abs(
        TONE_ORDER.indexOf(impliedTone) - TONE_ORDER.indexOf(f.expected_tone),
      );
      expect(distance, `${f.id}: declared=${f.expected_tone}, midpoint(${mid})→${impliedTone}`).toBeLessThanOrEqual(1);
    }
  });

  it("each of the 8 target families has at least 5 fixtures", () => {
    const REQUIRED = [
      "Software Engineer",
      "Engineering Manager",
      "Product Manager",
      "Digital Marketing",
      "BPO / Customer Support",
      "Sales",
      "Founder / CEO",
      "Content Writer",
    ];
    for (const fam of REQUIRED) {
      expect(FAMILY_COUNTS[fam] ?? 0, `family count for "${fam}"`).toBeGreaterThanOrEqual(5);
    }
  });

  it("CI threshold is sane (between 0.7 and 1.0)", () => {
    expect(GOLDEN_EVAL_PASS_THRESHOLD).toBeGreaterThanOrEqual(0.7);
    expect(GOLDEN_EVAL_PASS_THRESHOLD).toBeLessThanOrEqual(1.0);
  });

  it("rationale is present for every fixture (audit trail)", () => {
    for (const f of GOLDEN_FIXTURES) {
      expect(f.rationale.length, `${f.id} rationale`).toBeGreaterThan(15);
    }
  });
});
