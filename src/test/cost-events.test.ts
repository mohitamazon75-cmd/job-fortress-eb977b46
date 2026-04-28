/**
 * Cost-events tests — locks in pure aggregation contract.
 *
 * Heuristic restated in full (per mem://index.md "Test Fixture Comments" rule):
 *   1. rupees(paise) = Math.round(paise) / 100. Whole-paise rounding.
 *   2. formatRupees uses en-IN locale with exactly 2 decimal places.
 *   3. rollupByDay groups by ISO-string slice(0,10). Sorted ASC by day.
 *   4. rollupByFunction groups by exact function_name string. Sorted DESC
 *      by total_paise (most expensive first).
 *   5. perScanCost filters by exact scan_id match; null scan_ids are excluded.
 *   6. avgCostPerScan = total_paise / unique_scan_count, excluding null
 *      scan_id rows. Returns 0 if no scanned events. Uses Math.round.
 */

import { describe, it, expect } from 'vitest';
import {
  rupees,
  formatRupees,
  rollupByDay,
  rollupByFunction,
  perScanCost,
  avgCostPerScan,
  type CostEventRow,
} from '../lib/cost-events';

const mkRow = (over: Partial<CostEventRow>): CostEventRow => ({
  id: crypto.randomUUID(),
  function_name: 'process-scan',
  scan_id: 'scan-A',
  provider: 'gemini',
  cost_inr_paise: 100,
  note: null,
  created_at: '2026-04-28T10:00:00Z',
  ...over,
});

describe('rupees + formatRupees', () => {
  it('150 paise = ₹1.50', () => {
    expect(rupees(150)).toBe(1.5);
  });
  it('rounds half-paise to nearest paise', () => {
    expect(rupees(150.7)).toBe(1.51);
  });
  it('formatRupees uses 2 decimals', () => {
    expect(formatRupees(150)).toBe('₹1.50');
  });
  it('formatRupees handles thousands with en-IN grouping', () => {
    // ₹1,23,456.78 in Indian numbering (lakhs comma style).
    expect(formatRupees(12345678)).toMatch(/^₹1,23,456\.78$/);
  });
});

describe('rollupByDay', () => {
  it('groups by UTC calendar day', () => {
    const rows = [
      mkRow({ created_at: '2026-04-28T05:00:00Z', cost_inr_paise: 100, scan_id: 'A' }),
      mkRow({ created_at: '2026-04-28T23:59:00Z', cost_inr_paise: 200, scan_id: 'B' }),
      mkRow({ created_at: '2026-04-29T00:01:00Z', cost_inr_paise: 50, scan_id: 'C' }),
    ];
    const out = rollupByDay(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ day: '2026-04-28', total_paise: 300, event_count: 2, unique_scans: 2 });
    expect(out[1]).toEqual({ day: '2026-04-29', total_paise: 50, event_count: 1, unique_scans: 1 });
  });
  it('returns sorted ASC by day', () => {
    const rows = [
      mkRow({ created_at: '2026-04-30T00:00:00Z' }),
      mkRow({ created_at: '2026-04-28T00:00:00Z' }),
      mkRow({ created_at: '2026-04-29T00:00:00Z' }),
    ];
    expect(rollupByDay(rows).map((d) => d.day)).toEqual([
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
    ]);
  });
  it('counts null scan_ids in event_count but not unique_scans', () => {
    const rows = [
      mkRow({ scan_id: null, cost_inr_paise: 10 }),
      mkRow({ scan_id: 'X', cost_inr_paise: 20 }),
    ];
    const [day] = rollupByDay(rows);
    expect(day.event_count).toBe(2);
    expect(day.unique_scans).toBe(1);
    expect(day.total_paise).toBe(30);
  });
  it('returns [] for empty input', () => {
    expect(rollupByDay([])).toEqual([]);
  });
});

describe('rollupByFunction', () => {
  it('groups by function_name and sorts DESC by total', () => {
    const rows = [
      mkRow({ function_name: 'cheap-fn', cost_inr_paise: 50 }),
      mkRow({ function_name: 'expensive-fn', cost_inr_paise: 500 }),
      mkRow({ function_name: 'cheap-fn', cost_inr_paise: 25 }),
    ];
    const out = rollupByFunction(rows);
    expect(out[0].function_name).toBe('expensive-fn');
    expect(out[0].total_paise).toBe(500);
    expect(out[1].function_name).toBe('cheap-fn');
    expect(out[1].total_paise).toBe(75);
  });
  it('treats function_name case-sensitively', () => {
    const rows = [
      mkRow({ function_name: 'Foo' }),
      mkRow({ function_name: 'foo' }),
    ];
    expect(rollupByFunction(rows)).toHaveLength(2);
  });
});

describe('perScanCost', () => {
  it('sums paise for matching scan_id only', () => {
    const rows = [
      mkRow({ scan_id: 'A', cost_inr_paise: 100 }),
      mkRow({ scan_id: 'B', cost_inr_paise: 200 }),
      mkRow({ scan_id: 'A', cost_inr_paise: 50 }),
      mkRow({ scan_id: null, cost_inr_paise: 999 }),
    ];
    expect(perScanCost(rows, 'A')).toBe(150);
    expect(perScanCost(rows, 'B')).toBe(200);
    expect(perScanCost(rows, 'NOT_FOUND')).toBe(0);
  });
});

describe('avgCostPerScan', () => {
  it('divides total by unique scan count, excluding null scan_ids', () => {
    const rows = [
      mkRow({ scan_id: 'A', cost_inr_paise: 100 }),
      mkRow({ scan_id: 'A', cost_inr_paise: 50 }),  // same scan A
      mkRow({ scan_id: 'B', cost_inr_paise: 300 }), // scan B
      mkRow({ scan_id: null, cost_inr_paise: 9999 }), // excluded
    ];
    // Total scanned = 100+50+300 = 450 paise. 2 unique scans. avg = 225.
    expect(avgCostPerScan(rows)).toBe(225);
  });
  it('returns 0 when no scanned events present', () => {
    expect(avgCostPerScan([mkRow({ scan_id: null })])).toBe(0);
    expect(avgCostPerScan([])).toBe(0);
  });
});
