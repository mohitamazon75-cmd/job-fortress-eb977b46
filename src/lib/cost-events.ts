/**
 * Cost-events helper — read-side only, used by AdminCostDashboard.
 *
 * Pure aggregation logic over rows from `cost_events`. No DB access here;
 * caller fetches rows and passes them in. This keeps the module testable
 * without a live Supabase connection.
 *
 * Heuristic restated in full (per mem://index.md "Test Fixture Comments" rule):
 *   - cost_inr_paise is a non-negative BIGINT in paise (1/100th of ₹).
 *     ₹1.50 = 150 paise. ₹1,000 = 100,000 paise.
 *   - rupees(paise) = paise / 100, returned as a plain number (not string).
 *   - rollupByDay groups by UTC calendar day (YYYY-MM-DD) of created_at.
 *   - rollupByFunction groups by function_name verbatim (case-sensitive).
 *   - perScanCost(rows, scanId) returns total paise for one scan, or 0 if none.
 *   - rollupByDay sorts results ascending by day; rollupByFunction by total
 *     descending (most expensive functions first). Both deterministic.
 */

export interface CostEventRow {
  id: string;
  function_name: string;
  scan_id: string | null;
  provider: string;
  cost_inr_paise: number;
  note: string | null;
  created_at: string; // ISO timestamptz
}

export interface CostByDay {
  day: string; // YYYY-MM-DD
  total_paise: number;
  event_count: number;
  unique_scans: number;
}

export interface CostByFunction {
  function_name: string;
  total_paise: number;
  event_count: number;
  unique_scans: number;
}

export function rupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatRupees(paise: number): string {
  const r = rupees(paise);
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function rollupByDay(rows: CostEventRow[]): CostByDay[] {
  const buckets = new Map<string, { total: number; count: number; scans: Set<string> }>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10); // YYYY-MM-DD prefix of ISO string
    const b = buckets.get(day) ?? { total: 0, count: 0, scans: new Set<string>() };
    b.total += r.cost_inr_paise;
    b.count += 1;
    if (r.scan_id) b.scans.add(r.scan_id);
    buckets.set(day, b);
  }
  return Array.from(buckets.entries())
    .map(([day, b]) => ({
      day,
      total_paise: b.total,
      event_count: b.count,
      unique_scans: b.scans.size,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function rollupByFunction(rows: CostEventRow[]): CostByFunction[] {
  const buckets = new Map<string, { total: number; count: number; scans: Set<string> }>();
  for (const r of rows) {
    const b = buckets.get(r.function_name) ?? { total: 0, count: 0, scans: new Set<string>() };
    b.total += r.cost_inr_paise;
    b.count += 1;
    if (r.scan_id) b.scans.add(r.scan_id);
    buckets.set(r.function_name, b);
  }
  return Array.from(buckets.entries())
    .map(([function_name, b]) => ({
      function_name,
      total_paise: b.total,
      event_count: b.count,
      unique_scans: b.scans.size,
    }))
    .sort((a, b) => b.total_paise - a.total_paise);
}

export function perScanCost(rows: CostEventRow[], scanId: string): number {
  return rows
    .filter((r) => r.scan_id === scanId)
    .reduce((sum, r) => sum + r.cost_inr_paise, 0);
}

/**
 * Average cost per scan across the rowset. Excludes events with no scan_id
 * (e.g., cron jobs, KG refreshes). Returns 0 if no scanned events present.
 */
export function avgCostPerScan(rows: CostEventRow[]): number {
  const scanned = rows.filter((r) => r.scan_id !== null);
  if (scanned.length === 0) return 0;
  const uniqueScans = new Set(scanned.map((r) => r.scan_id!)).size;
  if (uniqueScans === 0) return 0;
  const total = scanned.reduce((s, r) => s + r.cost_inr_paise, 0);
  return Math.round(total / uniqueScans);
}
