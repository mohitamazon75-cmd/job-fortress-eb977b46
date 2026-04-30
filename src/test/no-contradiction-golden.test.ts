/**
 * Phase 1.B golden invariant — kills audit-finding P1.
 *
 * Locks the contract: a Performance Marketer scan must NEVER receive
 * a Card 4 pivot that is (a) inside the marketing family or (b) flagged
 * declining. This is the cross-card contradiction the entire shared-context
 * work exists to prevent.
 *
 * Fixture is calibrated against:
 *   - user_role_family: 'marketing' (set by process-scan from KG primaryJob)
 *   - filterEligiblePivots: same-family check uses inferFamilyFromRole when
 *     pivot.job_family is missing (LLM rarely emits it)
 *   - market_health: 'declining' is a hard reject regardless of family
 */
import { describe, expect, it } from 'vitest';
import { filterEligiblePivots } from '@/lib/analysis-context';

describe('GOLDEN: Performance Marketer scan — no Card 4 contradictions', () => {
  const ctx = { user_role_family: 'marketing' };

  it('drops same-family pivots even when LLM omits job_family', () => {
    // Calibrated against: LLM emits role strings only ("Brand Manager"),
    // inferFamilyFromRole maps to 'marketing', filter rejects.
    const llmEmitted = [
      { role: 'Brand Manager at SaaS Company', match_pct: 92 },           // marketing → REJECT
      { role: 'Growth Marketer (B2B)', match_pct: 88 },                   // marketing → REJECT
      { role: 'Product Manager — Growth', match_pct: 85 },                // product_design → KEEP
      { role: 'Customer Success Manager', match_pct: 78 },                // customer_success → KEEP
    ];
    const out = filterEligiblePivots(llmEmitted, ctx);
    expect(out.map((p) => p.role)).toEqual([
      'Product Manager — Growth',
      'Customer Success Manager',
    ]);
  });

  it('drops declining-market pivots regardless of family', () => {
    // Calibrated against: market_signals.market_health='declining' for the
    // pivot's family means Card 1 (current role declining) and Card 4
    // (recommending another declining role) would contradict.
    const llmEmitted = [
      { role: 'Data Analyst', market_health: 'declining', match_pct: 90 },
      { role: 'Solutions Engineer', market_health: 'booming', match_pct: 82 },
      { role: 'Product Manager', match_pct: 80 }, // health unknown → KEEP (fail-open)
    ];
    const out = filterEligiblePivots(llmEmitted, ctx);
    expect(out.map((p) => p.role)).toEqual(['Solutions Engineer', 'Product Manager']);
  });

  it('returns empty list rather than fabricating pivots when all are ineligible', () => {
    // Calibrated against: zero-hallucination rule. Better to render an empty
    // pivot tab (which Card4PivotPaths handles via empty-state copy) than
    // to ship a contradiction. UI-side empty handling is in Card4PivotPaths.tsx.
    const llmEmitted = [
      { role: 'SEO Specialist', match_pct: 95 },                    // marketing → REJECT
      { role: 'Email Marketing Manager', market_health: 'declining', match_pct: 88 }, // both → REJECT
    ];
    expect(filterEligiblePivots(llmEmitted, ctx)).toEqual([]);
  });

  it('does not silently treat missing context as a free-pass', () => {
    // Calibrated against: Phase 1.B fail-open semantics. When user_role_family
    // is missing (legacy scan, KG miss), filter still rejects on declining
    // market_health — partial moat > no moat (5-Lens L4).
    const noFamilyCtx = { user_role_family: null };
    const llmEmitted = [
      { role: 'Brand Manager', match_pct: 90 },                                  // KEEP (no family check)
      { role: 'Anything', market_health: 'declining', match_pct: 85 },           // REJECT (declining)
    ];
    const out = filterEligiblePivots(llmEmitted, noFamilyCtx);
    expect(out.map((p) => p.role)).toEqual(['Brand Manager']);
  });
});
