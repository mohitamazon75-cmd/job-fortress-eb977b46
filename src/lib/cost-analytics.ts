/**
 * cost-analytics.ts — Pure burn-rate + anomaly helpers for AdminCostDashboard (Pass 3).
 *
 * No DB access. Caller passes already-fetched CostEventRow[]. All functions
 * are deterministic and total — they never throw. Empty inputs return zeros
 * (or empty arrays), which the dashboard renders as the "no data yet" state.
 *
 * Heuristic restated in full (mem://index.md "Test Fixture Comments" rule):
 *
 *  perScanTotals(rows):
 *    - Groups by scan_id (skips rows where scan_id is null — those are
 *      cron/global events, not attributable to one user scan).
 *    - Returns sorted array of { scan_id, total_paise } DESCENDING by cost
 *      (most expensive scan first). Stable sort.
 *
 *  percentile(values, p):
 *    - p in [0,1]. p=0.5 = median, p=0.95 = p95.
 *    - Linear interpolation between sorted samples (R-7 / Excel default).
 *    - Returns 0 for empty input. Values must be numeric paise.
 *
 *  burnRate(rows, windowDays):
 *    - daily_paise   = total / windowDays
 *    - monthly_paise = daily_paise * 30
 *    - Returns 0 if windowDays <= 0 or rows empty.
 *    - Does NOT exclude weekends or any other smoothing — raw division.
 *
 *  detectAnomalies(rows, multiplier=2):
 *    - Computes median per-scan cost.
 *    - Flags any scan whose total_paise > median * multiplier AND > 100 paise (₹1)
 *      to avoid noise from sub-rupee scans.
 *    - Returns flagged scans sorted DESCENDING by cost. Empty if <3 scans
 *      (median is unreliable below n=3).
 */

import type { CostEventRow } from "./cost-events";

export interface ScanTotal {
  scan_id: string;
  total_paise: number;
  event_count: number;
}

export interface BurnRate {
  total_paise: number;
  daily_paise: number;
  monthly_paise: number;
  scan_count: number;
  cost_per_scan_paise: number;
}

export interface Anomaly {
  scan_id: string;
  total_paise: number;
  multiple_of_median: number;
}

export function perScanTotals(rows: CostEventRow[]): ScanTotal[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (!r.scan_id) continue;
    const b = buckets.get(r.scan_id) ?? { total: 0, count: 0 };
    b.total += r.cost_inr_paise;
    b.count += 1;
    buckets.set(r.scan_id, b);
  }
  return Array.from(buckets.entries())
    .map(([scan_id, b]) => ({ scan_id, total_paise: b.total, event_count: b.count }))
    .sort((a, b) => b.total_paise - a.total_paise);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

export function median(values: number[]): number {
  return percentile(values, 0.5);
}

export function burnRate(rows: CostEventRow[], windowDays: number): BurnRate {
  if (windowDays <= 0 || rows.length === 0) {
    return { total_paise: 0, daily_paise: 0, monthly_paise: 0, scan_count: 0, cost_per_scan_paise: 0 };
  }
  const total = rows.reduce((s, r) => s + r.cost_inr_paise, 0);
  const scanIds = new Set(rows.filter((r) => r.scan_id).map((r) => r.scan_id!));
  const scan_count = scanIds.size;
  const daily = Math.round(total / windowDays);
  return {
    total_paise: total,
    daily_paise: daily,
    monthly_paise: daily * 30,
    scan_count,
    cost_per_scan_paise: scan_count > 0 ? Math.round(total / scan_count) : 0,
  };
}

export function detectAnomalies(rows: CostEventRow[], multiplier = 2): Anomaly[] {
  const totals = perScanTotals(rows);
  if (totals.length < 3) return [];
  const med = median(totals.map((t) => t.total_paise));
  if (med <= 0) return [];
  const threshold = med * multiplier;
  const MIN_PAISE = 100; // ignore sub-₹1 scans
  return totals
    .filter((t) => t.total_paise > threshold && t.total_paise > MIN_PAISE)
    .map((t) => ({
      scan_id: t.scan_id,
      total_paise: t.total_paise,
      multiple_of_median: Math.round((t.total_paise / med) * 10) / 10,
    }));
}
