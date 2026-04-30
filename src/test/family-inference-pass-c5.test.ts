/**
 * Pass C5 (2026-04-30) — Sales / Business Development family inference.
 *
 * Calibrated against: src/lib/analysis-context.ts FAMILY_TOKENS — the
 * "Senior Manager – Business Development" misclassification (→ project_manager
 * in production scans). These assertions lock in the dictionary so future
 * edits to FAMILY_TOKENS cannot silently re-break BD/Sales pivot filtering.
 *
 * Each title below was found in real production scans or recruiter postings.
 * Adding a non-sales title that happens to contain "manager" (e.g. "Project
 * Manager") is intentionally NOT mapped to sales — that is the regression we
 * are guarding against.
 */
import { describe, expect, it } from 'vitest';
import { inferFamilyFromRole } from '@/lib/analysis-context';

describe('Pass C5 — sales/BD family inference', () => {
  const SALES_TITLES = [
    'Senior Manager – Business Development',
    'Senior Manager - Business Development',
    'Business Development Manager',
    'Sales Manager',
    'Sales Executive',
    'Head of Sales',
    'VP Sales',
    'Director of Sales',
    'Account Executive',
    'Enterprise Account Manager',
    'Inside Sales Representative',
    'BDM - Enterprise',
    'SDR Lead',
    'Partnerships Lead',
    'Key Account Manager',
  ];

  it.each(SALES_TITLES)('maps %s to sales', (title) => {
    expect(inferFamilyFromRole(title)).toBe('sales');
  });

  // Negative cases: titles that share the word "manager" but are NOT sales.
  // Guards against the original bug where over-broad token matching swept
  // generic managers into sales (or vice versa via KG).
  it('does NOT map Project Manager to sales', () => {
    // Project Manager has no sales/BD token, so should fall through to null
    // (no 'project_manager' family exists in the dictionary today).
    expect(inferFamilyFromRole('Project Manager')).toBeNull();
  });

  it('does NOT map Engineering Manager to sales', () => {
    // 'engineering' family wins via 'tech lead' / 'principal engineer' tokens?
    // 'Engineering Manager' contains none of those — should be null, NOT sales.
    expect(inferFamilyFromRole('Engineering Manager')).toBeNull();
  });

  it('does NOT map Product Manager to sales', () => {
    expect(inferFamilyFromRole('Product Manager')).toBe('product_design');
  });
});
