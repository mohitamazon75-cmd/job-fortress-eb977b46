import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  rollupByDay,
  rollupByFunction,
  avgCostPerScan,
  formatRupees,
  type CostEventRow,
} from '@/lib/cost-events';
import {
  burnRate,
  detectAnomalies,
  perScanTotals,
  percentile,
} from '@/lib/cost-analytics';

/**
 * AdminCostDashboard — operator-only view of per-scan COGS.
 *
 * Reads `cost_events` (admin-RLS gated) and shows three rollups:
 *   1. Headline avg ₹/scan — the number that gates an ENFORCE_PRO flip
 *   2. Daily totals (last 30 days)
 *   3. Per-function totals (most expensive first)
 *
 * Edge functions are expected to insert into `cost_events` server-side
 * with their actual provider costs. This page does NOT estimate costs —
 * it reports what was logged. If the table is empty, the answer is
 * "no costs have been instrumented yet" — which is itself useful signal.
 */
export default function AdminCostDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CostEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
        const { data, error: queryError } = await supabase
          .from('cost_events' as any)
          .select('id,function_name,scan_id,provider,cost_inr_paise,note,created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5000);
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setRows([]);
          return;
        }
        setRows((data ?? []) as unknown as CostEventRow[]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'unknown error');
          setRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  if (rows === null) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-muted-foreground text-sm">Loading cost events…</p>
      </div>
    );
  }

  const dayRollup = rollupByDay(rows);
  const fnRollup = rollupByFunction(rows);
  const avgPaise = avgCostPerScan(rows);
  const totalPaise = rows.reduce((s, r) => s + r.cost_inr_paise, 0);
  const uniqueScans = new Set(rows.filter((r) => r.scan_id).map((r) => r.scan_id)).size;
  const burn = burnRate(rows, windowDays);
  const scanTotals = perScanTotals(rows);
  const scanCosts = scanTotals.map((s) => s.total_paise);
  const p50 = percentile(scanCosts, 0.5);
  const p95 = percentile(scanCosts, 0.95);
  const p99 = percentile(scanCosts, 0.99);
  const anomalies = detectAnomalies(rows);

  // Burn-rate threshold: at ₹399/mo Pro pricing, monthly COGS per Pro user
  // should stay under ~₹150 (≈37% gross margin floor). We show a soft warn
  // if the projected per-scan cost exceeds ₹50 (deeply unprofitable at single
  // scan/payment). Numbers are display-only; no automated kill-switch.
  const SOFT_WARN_PER_SCAN_PAISE = 5000; // ₹50
  const HARD_WARN_PER_SCAN_PAISE = 10000; // ₹100
  const burnSeverity =
    burn.cost_per_scan_paise >= HARD_WARN_PER_SCAN_PAISE
      ? 'critical'
      : burn.cost_per_scan_paise >= SOFT_WARN_PER_SCAN_PAISE
      ? 'warning'
      : 'ok';

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-foreground">Cost Dashboard</h1>
          <button
            onClick={() => navigate('/admin/monitor')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Admin home
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Window selector */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Window:</span>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                windowDays === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Headline cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Avg cost / scan" value={formatRupees(avgPaise)} sub={`${uniqueScans} scans`} />
          <Stat label="Total cost" value={formatRupees(totalPaise)} sub={`${rows.length} events`} />
          <Stat
            label="Status"
            value={rows.length === 0 ? 'No data' : 'Live'}
            sub={rows.length === 0 ? 'instrument edge fns to log' : `last ${windowDays}d`}
          />
        </div>

        {/* Burn rate + projection */}
        {rows.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Burn rate</h2>
              <BurnBadge severity={burnSeverity} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat
                label="Daily spend"
                value={formatRupees(burn.daily_paise)}
                sub={`avg over ${windowDays}d`}
              />
              <Stat
                label="Monthly projection"
                value={formatRupees(burn.monthly_paise)}
                sub="if burn holds"
              />
              <Stat
                label="Cost / scan"
                value={formatRupees(burn.cost_per_scan_paise)}
                sub={`${burn.scan_count} scans logged`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Soft warn at ₹50/scan, critical at ₹100/scan. At ₹399/mo Pro pricing,
              monthly COGS per Pro user should ideally stay under ₹150 (≈37% gross margin floor).
              Display-only — no automated kill-switch.
            </p>
          </section>
        )}

        {/* Per-scan distribution */}
        {scanTotals.length >= 3 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Per-scan distribution</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="p50 (median)" value={formatRupees(p50)} sub="typical scan" />
              <Stat label="p95" value={formatRupees(p95)} sub="tail scan" />
              <Stat label="p99" value={formatRupees(p99)} sub="worst-case" />
            </div>
          </section>
        )}

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Anomalies</h2>
              <span className="text-xs text-muted-foreground">
                Scans &gt;2× median, sorted by cost
              </span>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-amber-500/10">
                  <tr className="text-left text-amber-700 dark:text-amber-300">
                    <th className="px-4 py-2 font-medium">Scan ID</th>
                    <th className="px-4 py-2 font-medium text-right">Cost</th>
                    <th className="px-4 py-2 font-medium text-right">× median</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.slice(0, 20).map((a) => (
                    <tr key={a.scan_id} className="border-t border-amber-500/20">
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{a.scan_id}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatRupees(a.total_paise)}
                      </td>
                      <td className="px-4 py-2 text-right text-amber-700 dark:text-amber-300">
                        {a.multiple_of_median}×
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Investigate top anomalies — usually retries, runaway loops, or missing idempotency.
            </p>
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Query error: {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/40 p-6 space-y-2">
            <p className="text-sm font-semibold text-foreground">No cost events logged yet.</p>
            <p className="text-sm text-muted-foreground">
              Edge functions need to insert into <code className="text-xs">cost_events</code> with
              their actual API costs (Gemini, Tavily, Firecrawl, etc.). Once instrumented, this
              page will report the numbers used to gate the <code className="text-xs">ENFORCE_PRO</code> decision.
            </p>
          </div>
        ) : (
          <>
            {/* Per-function rollup */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">Cost by function</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Function</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                      <th className="px-4 py-2 font-medium text-right">Events</th>
                      <th className="px-4 py-2 font-medium text-right">Scans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fnRollup.map((r) => (
                      <tr key={r.function_name} className="border-t border-border/50">
                        <td className="px-4 py-2 font-mono text-xs text-foreground">{r.function_name}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatRupees(r.total_paise)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{r.event_count}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{r.unique_scans}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Daily rollup */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">Daily totals</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Day (UTC)</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                      <th className="px-4 py-2 font-medium text-right">Events</th>
                      <th className="px-4 py-2 font-medium text-right">Scans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRollup
                      .slice()
                      .reverse()
                      .map((r) => (
                        <tr key={r.day} className="border-t border-border/50">
                          <td className="px-4 py-2 font-mono text-xs text-foreground">{r.day}</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatRupees(r.total_paise)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{r.event_count}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{r.unique_scans}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-3xl font-black text-foreground mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function BurnBadge({ severity }: { severity: 'ok' | 'warning' | 'critical' }) {
  const styles = {
    ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    critical: 'bg-destructive/15 text-destructive border-destructive/30',
  } as const;
  const label = severity === 'ok' ? 'Healthy' : severity === 'warning' ? 'Watch' : 'Critical';
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${styles[severity]}`}>
      {label}
    </span>
  );
}
