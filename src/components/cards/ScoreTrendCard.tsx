import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import CohortInsightBadge from '@/components/cards/CohortInsightBadge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

interface Props {
  report: ScanReport;   // current (live) scan
  scanId?: string;
}

interface TrendPoint {
  label: string;
  score: number;
  scanId: string;
  daysAgo: number;
  isCurrent?: boolean;
  [key: string]: unknown;
}

// ── helpers ────────────────────────────────────────────────────────────────

function shortDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function daysAgo(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60 * 24));
}

function scoreColor(s: number): string {
  if (s >= 70) return '#22c55e';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreTierLabel(s: number): string {
  if (s >= 70) return 'Safe Zone';
  if (s >= 50) return 'Heads Up';
  return 'Act Now';
}

// Custom dot so each point is colour-coded to its tier
interface TierDotProps {
  cx?: number;
  cy?: number;
  value?: number;
  [key: string]: unknown;
}
const TierDot = (props: TierDotProps) => {
  const { cx, cy, value } = props;
  if (!cx || !cy || value === undefined) return null;
  const fill = scoreColor(value);
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#0d1117" strokeWidth={2} />;
};

// ── Custom tooltip ────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}
const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const { score, label, isCurrent } = payload[0].payload;
  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${scoreColor(score)}55`,
      borderRadius: 10,
      padding: '8px 14px',
      fontSize: 12,
      color: '#f1f5f9',
    }}>
      <p style={{ fontWeight: 800, color: scoreColor(score), margin: 0 }}>
        {score}/100 — {scoreTierLabel(score)}
      </p>
      <p style={{ color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>
        {label}{isCurrent ? ' (current)' : ''}
      </p>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export default function ScoreTrendCard({ report, scanId }: Props) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentScore = computeStabilityScore(report);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Not signed in — show single-point chart with current scan only
          if (!cancelled) {
            setPoints([{
              label: 'Now',
              score: currentScore,
              scanId: scanId ?? 'current',
              daysAgo: 0,
              isCurrent: true,
            }]);
            setLoading(false);
          }
          return;
        }

        // Fetch last 5 complete scans (excluding the current one)
        const { data, error: dbError } = await supabase
          .from('scans')
          .select('id, created_at, final_json_report')
          .eq('user_id', user.id)
          .eq('scan_status', 'complete')
          .order('created_at', { ascending: true })
          .limit(5);

        if (dbError) throw dbError;

        const historical: TrendPoint[] = (data ?? [])
          // Exclude the current scan if its id is known; guard against undefined scanId
          .filter(row => (scanId ? row.id !== scanId : true))
          .map(row => {
            let s: number | null = null;
            if (row.final_json_report) {
              try {
                const report = typeof row.final_json_report === 'object' && row.final_json_report
                  ? row.final_json_report as unknown as ScanReport
                  : null;
                if (report) {
                  s = computeStabilityScore(report);
                }
              } catch {
                // Malformed stored report — skip this data point rather than
                // silently substituting currentScore (which would distort the trend)
              }
            }
            if (s === null) return null; // Skip scans we can't score
            return {
              label: shortDate(row.created_at),
              score: s,
              scanId: row.id,
              daysAgo: daysAgo(row.created_at),
              isCurrent: false,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null) as TrendPoint[];

        // Always append current scan as the rightmost point
        const allPoints: TrendPoint[] = [
          ...historical,
          {
            label: 'Now',
            score: currentScore,
            scanId: scanId ?? 'current',
            daysAgo: 0,
            isCurrent: true,
          },
        ];

        if (!cancelled) {
          setPoints(allPoints);
          setLoading(false);
        }
      } catch {
        // Do not log the error object — may contain auth/network details
        console.error('[ScoreTrendCard] fetch error');
        if (!cancelled) {
          setError('Could not load scan history.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // ── Derived insight ────────────────────────────────────────────────────
  const hasTrend = points.length >= 2;
  const firstScore = points[0]?.score ?? currentScore;
  const delta = currentScore - firstScore;
  // Find the most recent non-current scan (second-to-last, verified by isCurrent flag)
  const prevScan = points.length >= 2 && points[points.length - 1]?.isCurrent
    ? points[points.length - 2]
    : null;
  const latestDaysAgo = prevScan?.daysAgo ?? null;
  const isDueForRescan = latestDaysAgo !== null && latestDaysAgo >= 30;

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-muted/50 animate-pulse" />
        ))}
        <div className="h-40 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
        <p className="text-sm text-destructive font-bold">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">Try refreshing the page.</p>
      </div>
    );
  }

  // ── Single scan (no history) ─────────────────────────────────────────
  if (!hasTrend) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Current score big display */}
        <div className="rounded-2xl border border-border bg-muted/30 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Your Career Score
          </p>
          <p className="text-5xl font-black" style={{ color: scoreColor(currentScore) }}>
            {currentScore}
          </p>
          <p className="text-sm text-muted-foreground mt-1">out of 100</p>
          <div
            className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-black border"
            style={{
              color: scoreColor(currentScore),
              borderColor: `${scoreColor(currentScore)}55`,
              background: `${scoreColor(currentScore)}11`,
            }}
          >
            {scoreTierLabel(currentScore)}
          </div>
        </div>

        <div className="rounded-xl bg-muted/30 border border-border/50 p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">First scan complete</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Re-scan in 30 days to measure your progress and track how the AI landscape has shifted for your role.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Has trend data ────────────────────────────────────────────────────
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? 'text-prophet-green' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Delta headline */}
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-xl bg-background border border-border/60 ${trendColor}`}>
          <TrendIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-foreground">
            {delta > 0
              ? `↑ Up ${delta} pts since first scan`
              : delta < 0
              ? `↓ Down ${Math.abs(delta)} pts since first scan`
              : 'Score unchanged across scans'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {delta > 0
              ? 'You\'re building resilience — keep going.'
              : delta < 0
              ? 'AI is catching up — time to upskill or pivot.'
              : 'Stable position. Stay ahead with the upgrade plan.'}
          </p>
        </div>
        <div
          className="flex-shrink-0 text-center min-w-[52px]"
          style={{ color: scoreColor(currentScore) }}
        >
          <p className="text-2xl font-black leading-none">{currentScore}</p>
          <p className="text-[10px] font-bold text-muted-foreground">/100</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Score history
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            {/* Safe zone reference band */}
            <ReferenceLine y={70} stroke="rgba(34,197,94,0.3)" strokeDasharray="4 4"
              label={{ value: '70', position: 'right', fill: 'rgba(34,197,94,0.5)', fontSize: 10 }} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 70, 100]}
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#scoreGrad)"
              strokeWidth={2.5}
              dot={<TierDot />}
              activeDot={{ r: 7, stroke: '#0d1117', strokeWidth: 2 }}
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={scoreColor(firstScore)} />
                <stop offset="100%" stopColor={scoreColor(currentScore)} />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
          Dashed line = Safe Zone threshold (70/100)
        </p>
      </div>

      {/* Rescan nudge */}
      {isDueForRescan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-prophet-gold/25 bg-prophet-gold/5 p-3.5 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-prophet-gold flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-prophet-gold">Rescan recommended</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Your last scan was {latestDaysAgo} days ago. Job market dynamics change fast — a fresh scan shows the current landscape.
            </p>
          </div>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-prophet-gold/10 text-prophet-gold text-[11px] font-black border border-prophet-gold/30 hover:bg-prophet-gold/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Rescan
          </button>
        </motion.div>
      )}

      {/* Coaching nudge for declining trend */}
      {delta < -5 && (
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3.5 text-center">
          <p className="text-xs font-bold text-foreground">Your score dropped {Math.abs(delta)} pts</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            AI capabilities are outpacing your current skill set. The Skill Upgrade Plan
            (coming up in the cards ahead) shows exactly where to focus in the next 30 days.
          </p>
        </div>
      )}

      {/* Positive momentum */}
      {delta >= 8 && (
        <div className="rounded-xl bg-prophet-green/5 border border-prophet-green/20 p-3.5 text-center">
          <p className="text-xs font-bold text-prophet-green">↑ Strong upward trend</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            You're outrunning automation. Share your score card to inspire your network.
          </p>
        </div>
      )}

      {/* Cohort peer comparison — IP #1 */}
      {scanId && (
        <CohortInsightBadge scanId={scanId} variant="stability" />
      )}
    </motion.div>
  );
}
