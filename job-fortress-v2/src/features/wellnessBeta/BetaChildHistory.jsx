import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Dot,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  WELLNESS_ZONES,
  PARENT_EMOTION_LABELS,
  scoreToZone,
} from "./utils/emotionEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#fef9c3", text: "#854d0e" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#fce7f3", text: "#9d174d" },
];
function avatarPalette(name = "") {
  return AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
}

function fmtDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function average(arr) {
  return arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;
}

function weekRange(offsetWeeks = 0) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - offsetWeeks * 7);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

const ALERT_MESSAGES = (name) => ({
  consecutive_pattern: `${name} has had a few unsettled days in a row. A little extra attention today could help.`,
  single_scan: `${name} seemed to be struggling at their last check-in. Check in with them today.`,
  weekly_decline: `${name}'s mood has been trending lower this week compared to last week.`,
});

const ZONE_REF_LINES = [
  { y: 80, color: WELLNESS_ZONES.green.color },
  { y: 60, color: WELLNESS_ZONES.blue.color },
  { y: 45, color: WELLNESS_ZONES.yellow.color },
  { y: 25, color: WELLNESS_ZONES.orange.color },
];

const DAY_TABS = [
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { score, zone, date } = payload[0].payload;
  const z = WELLNESS_ZONES[zone] ?? WELLNESS_ZONES.blue;
  const emotion = payload[0].payload.dominantEmotion ?? "neutral";
  const emo = PARENT_EMOTION_LABELS[emotion] ?? PARENT_EMOTION_LABELS.neutral;
  return (
    <div className="rounded-xl border border-border bg-card shadow-premium px-3 py-2 text-xs font-medium">
      <span>{z.emoji} {emo.parentLabel}</span>
      <br />
      <span className="text-muted-foreground">Score {score} · {date}</span>
    </div>
  );
}

// ── Custom dot colored by zone ────────────────────────────────────────────────
function ZoneDot(props) {
  const { cx, cy, payload } = props;
  const color = WELLNESS_ZONES[payload?.zone]?.color ?? "#3b82f6";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BetaChildHistory({ child, onBack }) {
  const [allScans, setAllScans]     = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [chartDays, setChartDays]   = useState(7);
  const [resolvingId, setResolvingId] = useState(null);

  const firstName = (child?.child_name ?? "Your child").split(" ")[0];
  const palette   = avatarPalette(child?.child_name);
  const initial   = (child?.child_name ?? "?").charAt(0).toUpperCase();

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!child?.id) return;
    async function loadData() {
      setLoading(true);
      try {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);

        const [{ data: scans }, { data: rawAlerts }] = await Promise.all([
          supabase
            .from("pulse_beta_scans")
            .select("id, dominant_emotion, wellness_score, wellness_zone, scanned_at")
            .eq("student_id", child.id)
            .gte("scanned_at", since30.toISOString())
            .order("scanned_at", { ascending: false }),
          supabase
            .from("pulse_beta_alerts")
            .select("id, alert_type, zone, message, resolved, created_at")
            .eq("student_id", child.id)
            .eq("resolved", false)
            .order("created_at", { ascending: false }),
        ]);
        setAllScans(scans ?? []);
        setAlerts(rawAlerts ?? []);
      } catch (err) {
        console.error("[BetaChildHistory] load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [child?.id]);

  // ── Resolve alert ─────────────────────────────────────────────────────────
  async function resolveAlert(alertId) {
    setResolvingId(alertId);
    try {
      await supabase
        .from("pulse_beta_alerts")
        .update({ resolved: true })
        .eq("id", alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("[BetaChildHistory] resolve failed:", err);
    } finally {
      setResolvingId(null);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const thisWeek = useMemo(() => {
    const { start, end } = weekRange(0);
    return allScans.filter((s) => {
      const d = new Date(s.scanned_at);
      return d >= start && d <= end;
    });
  }, [allScans]);

  const lastWeek = useMemo(() => {
    const { start, end } = weekRange(1);
    return allScans.filter((s) => {
      const d = new Date(s.scanned_at);
      return d >= start && d <= end;
    });
  }, [allScans]);

  const thisWeekAvg = average(thisWeek.map((s) => s.wellness_score));
  const lastWeekAvg = average(lastWeek.map((s) => s.wellness_score));

  const trend = useMemo(() => {
    if (thisWeekAvg == null || lastWeekAvg == null) return "steady";
    if (thisWeekAvg - lastWeekAvg > 5)  return "improving";
    if (lastWeekAvg - thisWeekAvg > 5)  return "declining";
    return "steady";
  }, [thisWeekAvg, lastWeekAvg]);

  const trendLabel = {
    improving: "↑ Improving",
    steady:    "→ Steady",
    declining: "↓ Needs attention",
  }[trend];
  const trendColor = {
    improving: "#22c55e",
    steady:    "#eab308",
    declining: "#f97316",
  }[trend];

  const mostCommonEmotion = useMemo(() => {
    if (!thisWeek.length) return null;
    const counts = {};
    for (const s of thisWeek) counts[s.dominant_emotion] = (counts[s.dominant_emotion] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
  }, [thisWeek]);

  // Chart data
  const chartScans = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - chartDays);
    return [...allScans]
      .filter((s) => new Date(s.scanned_at) >= since)
      .reverse()
      .map((s) => ({
        date: fmtDate(s.scanned_at),
        score: s.wellness_score,
        zone: s.wellness_zone,
        dominantEmotion: s.dominant_emotion,
      }));
  }, [allScans, chartDays]);

  // Recent list (14d, newest first)
  const recentList = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    return allScans.filter((s) => new Date(s.scanned_at) >= since);
  }, [allScans]);

  // Avg zone for guidance
  const avgZone = thisWeekAvg != null ? scoreToZone(thisWeekAvg) : null;
  const GUIDANCE = {
    green:  `🌟 ${firstName} has been having a great week! Keep up the positive routines.`,
    blue:   `🌟 ${firstName} has been having a great week! Keep up the positive routines.`,
    yellow: `😐 A mixed week for ${firstName}. Consistency in routines and sleep helps stabilize mood.`,
    orange: `💛 ${firstName} has been unsettled this week. Consider more 1-on-1 time and check if anything is worrying them at school.`,
    red:    `🔴 ${firstName} has been struggling. If this continues, speaking with their teacher or a school counsellor could help.`,
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  const tooFewScans = allScans.length < 3;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[540px] mx-auto px-5 pt-10 pb-20">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ backgroundColor: palette.bg, color: palette.text }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[17px] text-foreground leading-tight truncate">{child?.child_name}</p>
            {child?.year_group && (
              <p className="text-xs text-muted-foreground">{child.year_group}</p>
            )}
          </div>
        </motion.div>

        {/* ── Alert cards ── */}
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
            >
              <p className="text-sm font-bold text-amber-800 mb-1">💛 Something to be aware of</p>
              <p className="text-sm text-amber-900 leading-relaxed mb-3">
                {ALERT_MESSAGES(firstName)[alert.alert_type] ?? alert.message}
              </p>
              <button
                onClick={() => resolveAlert(alert.id)}
                disabled={resolvingId === alert.id}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
              >
                {resolvingId === alert.id ? "Saving…" : "Mark as noted ✓"}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {tooFewScans ? (
          /* ── Empty state ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl border border-border shadow-premium px-6 py-10 text-center"
          >
            <p className="text-4xl mb-4">📊</p>
            <p className="font-semibold text-foreground mb-2">Not enough data yet</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Check in daily to start seeing trends here.
            </p>
          </motion.div>
        ) : (
          <>
            {/* ── This week summary ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-strong rounded-2xl border border-border shadow-premium px-5 py-5 mb-4"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">This Week</p>
              <div className="flex items-center gap-5">
                {/* Score gauge */}
                <div className="flex flex-col items-center">
                  <span
                    className="font-display text-[48px] font-bold leading-none"
                    style={{ color: WELLNESS_ZONES[avgZone]?.color ?? "#3b82f6" }}
                  >
                    {thisWeekAvg ?? "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">avg score</span>
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Check-ins</span>
                    <span className="font-semibold">{thisWeek.length}</span>
                  </div>
                  {mostCommonEmotion && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Common mood</span>
                      <span className="font-semibold">
                        {WELLNESS_ZONES[scoreToZone(thisWeekAvg ?? 65)]?.emoji}{" "}
                        {PARENT_EMOTION_LABELS[mostCommonEmotion]?.parentLabel ?? mostCommonEmotion}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">vs last week</span>
                    <span className="font-semibold text-xs" style={{ color: trendColor }}>
                      {trendLabel}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Mood trend chart ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-strong rounded-2xl border border-border shadow-premium px-4 pt-5 pb-4 mb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mood Trend</p>
                <div className="flex gap-1">
                  {DAY_TABS.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setChartDays(t.days)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        chartDays === t.days
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-border"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {chartScans.length < 2 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Not enough data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartScans} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "hsl(0 0% 54%)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: "hsl(0 0% 54%)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {ZONE_REF_LINES.map((r) => (
                      <ReferenceLine
                        key={r.y}
                        y={r.y}
                        stroke={r.color}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                        strokeWidth={1}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(160 48% 20%)"
                      strokeWidth={2}
                      dot={<ZoneDot />}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* ── Recent check-ins list ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-strong rounded-2xl border border-border shadow-premium overflow-hidden mb-4"
            >
              <div className="px-5 py-4 border-b border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recent Check-ins</p>
              </div>
              {recentList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No check-ins in the last 14 days.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentList.map((scan) => {
                    const z  = WELLNESS_ZONES[scan.wellness_zone] ?? WELLNESS_ZONES.blue;
                    const em = PARENT_EMOTION_LABELS[scan.dominant_emotion] ?? PARENT_EMOTION_LABELS.neutral;
                    return (
                      <div key={scan.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xl shrink-0">{z.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{em.parentLabel}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDateTime(scan.scanned_at)}</p>
                        </div>
                        <span
                          className="text-sm font-bold shrink-0"
                          style={{ color: z.color }}
                        >
                          {scan.wellness_score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* ── Parent guidance ── */}
            {avgZone && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong rounded-2xl border border-border shadow-premium px-5 py-4 mb-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Guidance</p>
                <p className="text-sm text-foreground leading-relaxed">{GUIDANCE[avgZone]}</p>
              </motion.div>
            )}
          </>
        )}

        {/* ── Privacy reminder ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[10px] text-muted-foreground text-center leading-relaxed px-4 mt-2"
        >
          🔒 No images are stored. Scores reflect facial expressions only, not your child's full emotional state.
        </motion.p>

      </div>
    </div>
  );
}
