import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning! 👋";
  if (h < 17) return "Good afternoon! 👋";
  return "Good evening! 👋";
}

function formatDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Deterministic pastel bg + text color per name initial */
const AVATAR_PALETTES = [
  { bg: "bg-primary/10",     text: "text-primary"     },
  { bg: "bg-info/10",        text: "text-info"         },
  { bg: "bg-accent/20",      text: "text-accent-foreground" },
  { bg: "bg-purple-light",   text: "text-purple-700"   },
  { bg: "bg-success-light",  text: "text-success"      },
  { bg: "bg-warning-light",  text: "text-warning"      },
];

function avatarPalette(name = "") {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

const ZONE_META = {
  green:  { emoji: "😊", label: "Great",    badge: "bg-success-light text-success border-success/20"   },
  blue:   { emoji: "😌", label: "Calm",     badge: "bg-info/10 text-info border-info/20"                },
  yellow: { emoji: "😐", label: "Okay",     badge: "bg-accent/20 text-accent-foreground border-accent/30" },
  orange: { emoji: "😟", label: "Low",      badge: "bg-warning-light text-warning border-warning/30"    },
  red:    { emoji: "😔", label: "Struggling","badge": "bg-destructive/10 text-destructive border-destructive/20" },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function BetaChildList({ children, onAddChild, onCheckin, onViewHistory }) {
  // today's scans keyed by student_id
  const [todayScans, setTodayScans] = useState({});
  const [loadingScans, setLoadingScans] = useState(true);

  // ── Load today's scans ───────────────────────────────────────────────────
  useEffect(() => {
    if (!children.length) {
      setLoadingScans(false);
      return;
    }

    async function fetchTodayScans() {
      try {
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        const ids = children.map((c) => c.id);

        const { data, error } = await supabase
          .from("pulse_beta_scans")
          .select("student_id, dominant_emotion, wellness_score, wellness_zone, scanned_at")
          .in("student_id", ids)
          .gte("scanned_at", todayMidnight.toISOString())
          .order("scanned_at", { ascending: false });

        if (error) throw error;

        // Keep only the most recent scan per child
        const map = {};
        for (const scan of data ?? []) {
          if (!map[scan.student_id]) map[scan.student_id] = scan;
        }
        setTodayScans(map);
      } catch (err) {
        console.error("[BetaChildList] Failed to load today's scans:", err);
      } finally {
        setLoadingScans(false);
      }
    }

    fetchTodayScans();
  }, [children]);

  // ── Summary line ─────────────────────────────────────────────────────────
  const checkedInCount = useMemo(
    () => children.filter((c) => !!todayScans[c.id]).length,
    [children, todayScans]
  );

  const summaryLine =
    children.length === 0
      ? null
      : checkedInCount === children.length
      ? "All children checked in today ✅"
      : `${checkedInCount} of ${children.length} ${children.length === 1 ? "child" : "children"} checked in today`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-mesh">
      <div className="max-w-[520px] mx-auto px-6 pt-10 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Brand mark */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl gradient-hero flex items-center justify-center text-primary-foreground font-bold text-xs shadow-glow-primary">
              💚
            </div>
            <span className="font-display text-base font-semibold">
              Wellness <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase bg-amber-100 text-amber-700 border border-amber-300 ml-1">BETA</span>
            </span>
          </div>

          <h2 className="font-display text-[26px] font-bold leading-snug text-foreground">
            {getGreeting()}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate()}</p>

          {/* Summary */}
          {!loadingScans && summaryLine && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-3 text-sm font-semibold ${
                checkedInCount === children.length ? "text-success" : "text-muted-foreground"
              }`}
            >
              {summaryLine}
            </motion.p>
          )}
        </motion.div>

        {/* Child cards */}
        <div className="space-y-4">
          {children.map((child, i) => {
            const palette = avatarPalette(child.child_name);
            const initial = (child.child_name ?? "?").charAt(0).toUpperCase();
            const todayScan = todayScans[child.id];
            const zone = todayScan?.wellness_zone;
            const zoneMeta = zone ? ZONE_META[zone] : null;

            return (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="glass-strong rounded-2xl border border-border shadow-premium overflow-hidden"
              >
                {/* Top accent strip */}
                <div className={`h-1 w-full ${todayScan ? "bg-gradient-to-r from-success to-success/60" : "bg-gradient-to-r from-border to-border/40"}`} />

                <div className="p-5">
                  {/* Child identity row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${palette.bg} ${palette.text}`}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-bold text-foreground leading-tight truncate">
                        {child.child_name}
                      </p>
                      {child.year_group && (
                        <p className="text-[12px] text-muted-foreground font-medium">{child.year_group}</p>
                      )}
                    </div>

                    {/* Check-in status badge */}
                    {loadingScans ? (
                      <div className="w-24 h-6 rounded-full bg-muted animate-pulse" />
                    ) : todayScan && zoneMeta ? (
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${zoneMeta.badge}`}>
                        {zoneMeta.emoji} {zoneMeta.label}
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                        Not checked in
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => onCheckin(child)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold gradient-hero text-primary-foreground shadow-glow-primary hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      Check In Now 📷
                    </button>
                    <button
                      onClick={() => onViewHistory(child)}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                    >
                      History →
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Add child */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 + children.length * 0.08 + 0.1 }}
          className="mt-6"
        >
          <button
            onClick={onAddChild}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border bg-card text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Another Child
          </button>
        </motion.div>

      </div>
    </div>
  );
}
