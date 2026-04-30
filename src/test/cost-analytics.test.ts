/**
 * cost-analytics.test.ts — Lock burn-rate + anomaly heuristics (Pass 3).
 *
 * Fixture invariants (restated from cost-analytics.ts heuristic block):
 *  - perScanTotals: group by scan_id, skip nulls, sort DESC by total_paise
 *  - percentile: R-7 linear interpolation, p=0.5 = median
 *  - burnRate: daily = total/windowDays, monthly = daily*30, cost/scan = total/uniqueScans
 *  - detectAnomalies: needs >=3 scans, flags >2x median AND >100 paise, sorted DESC
 */

import { describe, it, expect } from "vitest";
import {
  perScanTotals,
  percentile,
  median,
  burnRate,
  detectAnomalies,
} from "@/lib/cost-analytics";
import type { CostEventRow } from "@/lib/cost-events";

const row = (overrides: Partial<CostEventRow>): CostEventRow => ({
  id: crypto.randomUUID(),
  function_name: "fn",
  scan_id: null,
  provider: "lovable_ai",
  cost_inr_paise: 0,
  note: null,
  created_at: "2026-04-30T00:00:00Z",
  ...overrides,
});

describe("perScanTotals", () => {
  it("groups by scan_id, skips nulls, sorts DESC", () => {
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 100 }),
      row({ scan_id: "b", cost_inr_paise: 500 }),
      row({ scan_id: "a", cost_inr_paise: 50 }),
      row({ scan_id: null, cost_inr_paise: 9999 }), // dropped
    ];
    const result = perScanTotals(rows);
    expect(result).toEqual([
      { scan_id: "b", total_paise: 500, event_count: 1 },
      { scan_id: "a", total_paise: 150, event_count: 2 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(perScanTotals([])).toEqual([]);
  });
});

describe("percentile", () => {
  it("returns 0 for empty", () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it("median of odd-length sorted set", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("median of even-length interpolates", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it("p95 of 100 samples = ~95th value", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBeGreaterThanOrEqual(95);
    expect(percentile(values, 0.95)).toBeLessThanOrEqual(96);
  });

  it("p=0 returns min, p=1 returns max", () => {
    expect(percentile([5, 1, 9, 3], 0)).toBe(1);
    expect(percentile([5, 1, 9, 3], 1)).toBe(9);
  });

  it("median helper matches percentile(0.5)", () => {
    expect(median([10, 20, 30])).toBe(20);
  });
});

describe("burnRate", () => {
  it("returns zeros for empty", () => {
    expect(burnRate([], 30)).toEqual({
      total_paise: 0,
      daily_paise: 0,
      monthly_paise: 0,
      scan_count: 0,
      cost_per_scan_paise: 0,
    });
  });

  it("returns zeros if windowDays <= 0", () => {
    const rows = [row({ scan_id: "a", cost_inr_paise: 1000 })];
    expect(burnRate(rows, 0).daily_paise).toBe(0);
    expect(burnRate(rows, -5).daily_paise).toBe(0);
  });

  it("computes daily and monthly projection", () => {
    // 3000 paise across 10 days = 300/day = 9000/month
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 1000 }),
      row({ scan_id: "b", cost_inr_paise: 2000 }),
    ];
    const b = burnRate(rows, 10);
    expect(b.total_paise).toBe(3000);
    expect(b.daily_paise).toBe(300);
    expect(b.monthly_paise).toBe(9000);
    expect(b.scan_count).toBe(2);
    expect(b.cost_per_scan_paise).toBe(1500);
  });
});

describe("detectAnomalies", () => {
  it("returns empty if fewer than 3 scans", () => {
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 100 }),
      row({ scan_id: "b", cost_inr_paise: 9999 }),
    ];
    expect(detectAnomalies(rows)).toEqual([]);
  });

  it("flags scans >2x median and >100 paise", () => {
    // Median of [200, 200, 200, 200, 5000] = 200. Threshold = 400. 5000 flagged.
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 200 }),
      row({ scan_id: "b", cost_inr_paise: 200 }),
      row({ scan_id: "c", cost_inr_paise: 200 }),
      row({ scan_id: "d", cost_inr_paise: 200 }),
      row({ scan_id: "e", cost_inr_paise: 5000 }),
    ];
    const flagged = detectAnomalies(rows);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].scan_id).toBe("e");
    expect(flagged[0].multiple_of_median).toBe(25);
  });

  it("ignores sub-₹1 scans even if multiple is high", () => {
    // Median = 10 paise. 50 paise is 5x but still under 100 paise floor.
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 10 }),
      row({ scan_id: "b", cost_inr_paise: 10 }),
      row({ scan_id: "c", cost_inr_paise: 10 }),
      row({ scan_id: "d", cost_inr_paise: 50 }),
    ];
    expect(detectAnomalies(rows)).toEqual([]);
  });

  it("respects custom multiplier", () => {
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 1000 }),
      row({ scan_id: "b", cost_inr_paise: 1000 }),
      row({ scan_id: "c", cost_inr_paise: 1000 }),
      row({ scan_id: "d", cost_inr_paise: 4000 }), // 4x median
    ];
    expect(detectAnomalies(rows, 2)).toHaveLength(1);
    expect(detectAnomalies(rows, 5)).toHaveLength(0);
  });

  it("sorts flagged anomalies DESC", () => {
    const rows = [
      row({ scan_id: "a", cost_inr_paise: 100 }),
      row({ scan_id: "b", cost_inr_paise: 100 }),
      row({ scan_id: "c", cost_inr_paise: 100 }),
      row({ scan_id: "d", cost_inr_paise: 500 }),
      row({ scan_id: "e", cost_inr_paise: 1500 }),
      row({ scan_id: "f", cost_inr_paise: 800 }),
    ];
    const flagged = detectAnomalies(rows);
    expect(flagged.map((f) => f.scan_id)).toEqual(["e", "f", "d"]);
  });
});
