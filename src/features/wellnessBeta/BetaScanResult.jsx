import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  WELLNESS_ZONES,
  PARENT_EMOTION_LABELS,
  detectAlertPattern,
} from "./utils/emotionEngine";

// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = [
  { value: "great",     emoji: "😍", label: "Great"     },
  { value: "okay",      emoji: "😐", label: "Okay"      },
  { value: "not_great", emoji: "😕", label: "Not great" },
];

export default function BetaScanResult({ child, result, onDone }) {
  const [feedbackRating, setFeedbackRating] = useState(null); // null | 'great' | 'okay' | 'not_great'
  const [feedbackDone,   setFeedbackDone]   = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  async function submitFeedback(rating) {
    if (feedbackSaving || feedbackDone) return;
    setFeedbackRating(rating);
    setFeedbackSaving(true);
    try {
      await supabase.from("pulse_beta_feedback").insert({ rating });
    } catch (err) {
      console.error("[BetaScanResult] feedback insert failed:", err);
    } finally {
      setFeedbackSaving(false);
      setFeedbackDone(true);
    }
  }
  const savedRef = useRef(false); // prevent double-save on StrictMode remount

  const {
    dominantEmotion = "neutral",
    wellnessScore   = 65,
    wellnessZone    = "blue",
    dominantConfidence,
    isConcerning    = false,
    expressions,
  } = result ?? {};

  const zoneInfo    = WELLNESS_ZONES[wellnessZone]      ?? WELLNESS_ZONES.blue;
  const emotionMeta = PARENT_EMOTION_LABELS[dominantEmotion] ?? PARENT_EMOTION_LABELS.neutral;
  const firstName   = (child?.child_name ?? "Your child").split(" ")[0];

  // ── Background tint derived from zone.bg ─────────────────────────────────
  // zone.bg is a hex-based color — we apply it via inline style
  const pageBg = zoneInfo.bg;

  // ── Save scan + check alerts (non-blocking) ───────────────────────────────
  useEffect(() => {
    if (savedRef.current || !child?.id) return;
    savedRef.current = true;

    async function saveScanAndCheckAlerts() {
      try {
        // 1. Insert scan
        const { error: insertErr } = await supabase
          .from("pulse_beta_scans")
          .insert({
            student_id:       child.id,
            dominant_emotion: dominantEmotion,
            wellness_score:   wellnessScore,
            wellness_zone:    wellnessZone,
            expressions:      expressions ?? null,
            scanned_at:       new Date().toISOString(),
          });

        if (insertErr) {
          console.error("[BetaScanResult] scan insert failed:", insertErr);
          return;
        }

        // 2. Load recent scans (last 14 days, newest first)
        const since = new Date();
        since.setDate(since.getDate() - 14);

        const { data: recentScans, error: fetchErr } = await supabase
          .from("pulse_beta_scans")
          .select("wellness_zone, wellness_score, scanned_at")
          .eq("student_id", child.id)
          .gte("scanned_at", since.toISOString())
          .order("scanned_at", { ascending: false });

        if (fetchErr) {
          console.error("[BetaScanResult] recent scans fetch failed:", fetchErr);
          return;
        }

        // 3. Detect alert pattern
        const alert = detectAlertPattern(recentScans ?? [], 2);

        // 4. Insert alert if triggered
        if (alert.shouldAlert) {
          const { error: alertErr } = await supabase
            .from("pulse_beta_alerts")
            .insert({
              student_id: child.id,
              alert_type: alert.alertType,
              zone:       alert.zone,
              message:    alert.message,
              resolved:   false,
            });

          if (alertErr) {
            console.error("[BetaScanResult] alert insert failed:", alertErr);
          }
        }
      } catch (err) {
        console.error("[BetaScanResult] background save error:", err);
      }
    }

    saveScanAndCheckAlerts();
  }, [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: pageBg }}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">

        {/* Zone emoji */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          style={{ fontSize: 88, lineHeight: 1 }}
          aria-hidden="true"
        >
          {zoneInfo.emoji}
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
            {firstName} is feeling<br />
            <span style={{ color: zoneInfo.color }}>{emotionMeta.parentLabel}</span>!
          </h1>
        </motion.div>

        {/* Wellness score */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className="font-display text-[64px] font-bold leading-none"
            style={{ color: zoneInfo.color }}
          >
            {wellnessScore}
          </span>
          <span className="text-sm font-semibold text-foreground">Today's Wellness Score</span>
          <span className="text-[11px] text-muted-foreground">Score is based on facial expression</span>
        </motion.div>

        {/* Tip card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-white shadow-sm px-5 py-4 text-left"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            💡 Today's Tip
          </p>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {emotionMeta.tip}
          </p>
        </motion.div>

        {/* Compassion card — only for orange/red */}
        {isConcerning && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-amber-200 px-5 py-4 text-left"
          >
            <p className="text-sm font-bold text-amber-700 mb-1">💛 You've got this</p>
            <p className="text-sm text-foreground leading-relaxed">
              It's completely normal for kids to have tough days. Your attention makes a big difference.
            </p>
          </motion.div>
        )}

        {/* Done button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="w-full flex flex-col items-center gap-2 pt-2"
        >
          <button
            onClick={onDone}
            className="w-full relative overflow-hidden rounded-2xl text-[17px] font-semibold py-5 gradient-hero text-primary-foreground shadow-glow-primary hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
          >
            <span className="relative z-10">Done ✓</span>
            <div className="absolute inset-0 shimmer" />
          </button>
          <p className="text-[10px] text-muted-foreground font-medium">
            No images were captured or stored
          </p>
        </motion.div>

        {/* Quick experience feedback */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="w-full rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 px-5 py-4 text-center"
        >
          {feedbackDone ? (
            <p className="text-sm font-semibold text-foreground">Thanks for your feedback! 🙏</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground mb-3">How was your experience? 👇</p>
              <div className="flex justify-center gap-3">
                {EMOJI_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => submitFeedback(opt.value)}
                    disabled={feedbackSaving}
                    className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-white/80 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>

      </div>
    </div>
  );
}
