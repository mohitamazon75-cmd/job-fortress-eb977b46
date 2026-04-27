/**
 * Admin funnel view — daily breakdown of the entire scan journey from
 * landing_view through journey_completed. The whole point of this page
 * is to give the founder a single URL to check every morning so we can
 * stop guessing where users drop off.
 *
 * Read-only, admin-guarded, polls the `admin-funnel` edge function.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowDownRight } from "lucide-react";

interface FunnelStep {
  event: string;
  count: number;
}

interface DailyBucket {
  day: string;
  events: Record<string, number>;
}

interface FunnelData {
  window_days: number;
  funnel: FunnelStep[];
  daily: DailyBucket[];
  reach: {
    scans_in_window: number;
    unique_scans_reaching_result: number;
    unique_scans_completing_journey: number;
  };
  totals: Record<string, number>;
}

const HUMAN_LABEL: Record<string, string> = {
  landing_view: "Landing viewed",
  cta_click: "CTA clicked",
  auth_complete: "Signed in",
  input_method_selected: "Picked input method",
  scan_start: "Scan started",
  scan_complete: "Scan completed",
  result_loaded: "Result actually loaded",
  card_viewed: "Card navigated",
  share_opened: "Share opened",
  journey_completed: "Visited all cards",
  cta_post_reveal: "CTA after reveal",
};

export default function AdminFunnel() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke(
        `admin-funnel?days=${days}`,
      );
      if (err) throw err;
      setData(result as FunnelData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load funnel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading funnel…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-destructive">Error: {error}</p>
      </div>
    );
  }
  if (!data) return null;

  // Drop-off math: relative to the previous step, only when both are non-zero.
  const stepsWithDropoff = data.funnel.map((step, i) => {
    const prev = i > 0 ? data.funnel[i - 1] : null;
    const dropPct =
      prev && prev.count > 0 && step.count <= prev.count
        ? Math.round(((prev.count - step.count) / prev.count) * 100)
        : null;
    return { ...step, dropPct, prevCount: prev?.count ?? null };
  });

  const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Funnel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last {data.window_days} days · {data.reach.scans_in_window} scans started ·{" "}
              {data.reach.unique_scans_reaching_result} reached the report ·{" "}
              {data.reach.unique_scans_completing_journey} completed all cards
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 90].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "default" : "outline"}
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Funnel bars */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Steps (cumulative across window)</h2>
          <div className="space-y-3">
            {stepsWithDropoff.map((step, i) => {
              const widthPct = (step.count / maxCount) * 100;
              const isDeadStep = step.count === 0;
              return (
                <motion.div
                  key={step.event}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6 text-right">
                        {i + 1}.
                      </span>
                      <span className={isDeadStep ? "text-muted-foreground" : ""}>
                        {HUMAN_LABEL[step.event] ?? step.event}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {step.dropPct !== null && step.dropPct > 0 && (
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <ArrowDownRight className="h-3 w-3" />
                          {step.dropPct}%
                        </span>
                      )}
                      <span className="font-mono tabular-nums">{step.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={isDeadStep ? "h-full bg-muted-foreground/20" : "h-full bg-primary"}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ delay: 0.1 + i * 0.04, duration: 0.4 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Steps with 0 events either haven't been wired up yet or no user has reached them in this window.
          </p>
        </Card>

        {/* Daily breakdown */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Daily breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Landing</th>
                  <th className="py-2 pr-4 font-medium">Scan start</th>
                  <th className="py-2 pr-4 font-medium">Scan complete</th>
                  <th className="py-2 pr-4 font-medium">Result loaded</th>
                  <th className="py-2 pr-4 font-medium">Cards navigated</th>
                  <th className="py-2 pr-4 font-medium">Journey done</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.slice().reverse().map((b) => (
                  <tr key={b.day} className="border-b border-border/40">
                    <td className="py-2 pr-4 font-mono">{b.day}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.landing_view ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.scan_start ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.scan_complete ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.result_loaded ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.card_viewed ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.events.journey_completed ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
