/**
 * Golden Scan Suite — the close-the-loop tripwire.
 *
 * Runs the 5 frozen personas in _fixtures.ts through 5 invariant categories.
 * Each category corresponds to a real bug class found in production scans
 * over the last 4 sessions:
 *
 *   C1  Provenance leak           — un-sourced ₹ figures when no user CTC
 *   C2  Cross-card contradiction  — Card 1 verdict contradicting market_health
 *   C3  Persona under-fit         — exec losing same-family vertical pivots
 *                                    OR non-exec keeping same-family pivots
 *   C4  Degenerate LLM output     — 4 identical negotiation anchors (no-CTC case)
 *                                    must be detected by the dedup helper
 *   C5  Cohort/category mismatch  — KG industry → category lookup must return
 *                                    the expected first candidate
 *
 * If a future fix or LLM drift breaks ANY cell of the 5×5 matrix, this suite
 * fails BEFORE a real user encounters it. Add a new fixture (not a new
 * exception) when you find a new persona that surfaces a new bug class.
 */

import { describe, expect, it } from 'vitest';
import {
  filterEligiblePivots,
  inferFamilyFromRole,
} from '@/lib/analysis-context';
import { stripFabricatedRupeeFigures } from '@/lib/sanitizers/strip-fabricated-rupee-figures';
import { getCategoryCandidates } from '@/lib/kg-category-map';
import {
  ALL_FIXTURES,
  type GoldenScanFixture,
} from './_fixtures';

// Pure helper used by Card4PivotPaths to detect Bug 4 (degenerate anchors).
// Mirroring the UI logic here so the rule is testable without rendering.
function negotiationAnchorsAreDegenerate(anchors: {
  base?: string;
  plus_10?: string;
  plus_20?: string;
  plus_30?: string;
} | undefined): boolean {
  if (!anchors) return false;
  const values = [anchors.base, anchors.plus_10, anchors.plus_20, anchors.plus_30]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (values.length < 2) return false;
  return new Set(values).size === 1;
}

const FORTIFIED_RE = /\b(fortified|safe|protected|secure)\b/i;
// Matches an absolute rupee figure: ₹X, ₹X.YL, ₹X lakh, ₹XCr.
const ABSOLUTE_RUPEE_RE = /(₹\s*\d|\d+\s*(?:L|lakh|lakhs|cr|crore|crores)\b)/i;

describe('GOLDEN SCAN SUITE — 5 personas × 5 invariants', () => {
  describe.each(ALL_FIXTURES)('Persona: $id', (fx: GoldenScanFixture) => {
    // ─── C1 Provenance leak ──────────────────────────────────────────────
    it('C1 Card 1 monthly_loss copy carries no un-sourced ₹ figure when no user CTC', () => {
      const copy = fx.card1.cost?.monthly_loss_lpa ?? null;
      if (fx.has_user_ctc) {
        // With CTC, copy may carry absolute ₹ — invariant is satisfied trivially.
        return;
      }
      if (copy === null) return; // null is the cleanest pass.
      // If LLM emitted any text, the sanitizer must have stripped naked ₹ figures.
      const sanitized = stripFabricatedRupeeFigures(copy);
      expect(ABSOLUTE_RUPEE_RE.test(sanitized)).toBe(false);
    });

    // ─── C2 Cross-card contradiction ─────────────────────────────────────
    it('C2 Card 1 headline never claims fortified/safe when market is declining', () => {
      if (fx.ctx.user_role_market_health !== 'declining') return;
      expect(FORTIFIED_RE.test(fx.card1.headline)).toBe(false);
    });

    // ─── C3 Persona under-fit (the bidirectional pivot rule) ─────────────
    it('C3 pivot eligibility respects exec relaxation in both directions', () => {
      const out = filterEligiblePivots(fx.card4.pivots, fx.ctx);

      // 3a — declining-market pivots are ALWAYS dropped (no exec exception).
      for (const p of out) {
        const health = (p.market_health || '').toString().toLowerCase();
        expect(health).not.toBe('declining');
      }

      // 3b — same-family rule is INVERTED for execs.
      if (fx.ctx.user_is_exec) {
        // Execs MUST keep at least one same-family vertical pivot when the
        // input contains one (otherwise they get cross-family junior junk).
        const inputSameFamily = fx.card4.pivots.some((p) => {
          const fam = (p.job_family || inferFamilyFromRole(p.role) || '').toLowerCase();
          const health = (p.market_health || '').toLowerCase();
          return fam === fx.ctx.user_role_family && health !== 'declining';
        });
        if (inputSameFamily) {
          const outSameFamily = out.some((p) => {
            const fam = (p.job_family || inferFamilyFromRole(p.role) || '').toLowerCase();
            return fam === fx.ctx.user_role_family;
          });
          expect(outSameFamily, 'exec must retain at least one same-family vertical pivot').toBe(true);
        }
      } else {
        // Non-execs MUST have all same-family pivots stripped.
        for (const p of out) {
          const fam = (p.job_family || inferFamilyFromRole(p.role) || '').toLowerCase();
          if (fam) {
            expect(fam, `non-exec leaked same-family pivot: ${p.role}`).not.toBe(fx.ctx.user_role_family);
          }
        }
      }
    });

    // ─── C4 Degenerate LLM output ────────────────────────────────────────
    it('C4 degenerate negotiation anchors are detectable when CTC is missing', () => {
      const anchors = fx.card4.negotiation_anchors;
      if (!anchors) return;
      const isDegenerate = negotiationAnchorsAreDegenerate(anchors);
      if (!fx.has_user_ctc) {
        // If LLM emitted 4 identical anchors (the known no-CTC failure mode),
        // the helper MUST flag them so Card4PivotPaths can collapse the grid.
        // We do NOT require the LLM to be degenerate — only that when it is,
        // detection works. Both branches are valid:
        //   degenerate → must be detected
        //   non-degenerate → must NOT be falsely flagged
        if (anchors.base === anchors.plus_30 && anchors.base === anchors.plus_10) {
          expect(isDegenerate).toBe(true);
        } else {
          expect(isDegenerate).toBe(false);
        }
      } else {
        // With CTC, anchors should be a real ladder, never collapsed.
        expect(isDegenerate).toBe(false);
      }
    });

    // ─── C5 Cohort / category mismatch ───────────────────────────────────
    it('C5 industry input maps to expected first KG category candidate', () => {
      const candidates = getCategoryCandidates(fx.industry_input);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toBe(fx.expected_kg_category_in_candidates);
    });
  });

  // ─── Suite-level invariants (apply to the fixture set as a whole) ──────
  it('suite covers at least 5 personas', () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  it('every persona has a unique id', () => {
    const ids = ALL_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('suite covers both exec and non-exec personas', () => {
    expect(ALL_FIXTURES.some((f) => f.ctx.user_is_exec)).toBe(true);
    expect(ALL_FIXTURES.some((f) => !f.ctx.user_is_exec)).toBe(true);
  });

  it('suite covers both has-CTC and no-CTC personas', () => {
    expect(ALL_FIXTURES.some((f) => f.has_user_ctc)).toBe(true);
    expect(ALL_FIXTURES.some((f) => !f.has_user_ctc)).toBe(true);
  });

  it('suite covers at least one declining-market persona', () => {
    expect(ALL_FIXTURES.some((f) => f.ctx.user_role_market_health === 'declining')).toBe(true);
  });
});
