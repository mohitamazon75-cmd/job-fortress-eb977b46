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
