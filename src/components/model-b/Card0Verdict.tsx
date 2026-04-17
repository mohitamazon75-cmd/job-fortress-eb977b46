/**
 * Card 0 — The Verdict
 * 
 * 30-second plain-language summary BEFORE the score.
 * Three sentences: your risk, your biggest threat, your #1 move.
 * Designed to be instantly shareable on WhatsApp.
 * 
 * Psychology: names the fear, names the moat, names one action.
 * This converts browsers to actors before they see a single number.
 */
import { motion } from "framer-motion";
import { ArrowRight, AlertTriangle, Shield, Zap } from "lucide-react";

interface Card0VerdictProps {
  cardData: any;
  onNext: () => void;
}

export default function Card0Verdict({ cardData, onNext }: Card0VerdictProps) {
  const c1 = cardData?.card1_risk;
  const c3 = cardData?.card3_shield;
  const c4 = cardData?.card4_pivot;
  const user = cardData?.user;
  const score = cardData?.jobbachao_score ?? cardData?.risk_score ?? null;

  // Derive the three verdict sentences from existing LLM data
  const topThreat = c1?.tasks_at_risk?.[0] || c1?.fear_hook?.split(".")?.[0] || "your top execution skills";
  const topMoat = c3?.skills?.find((s: any) => s.level === "best-in-class" || s.level === "strong")?.name
    || c1?.hope_bridge?.split(".")?.[0]?.replace(" is your shield", "") 
    || "your judgment and experience";
  const topMove = c4?.pivots?.[0]?.role 
    ? `Pivot toward ${c4.pivots[0].role} — ${c4.pivots[0].skill_overlap_pct || 70}% of your skills transfer directly.`
    : c1?.confrontation?.split(".")?.[0] + "." || "Start with one concrete case study this week.";

  // Risk level label
  const riskLabel = score == null ? null 
    : score >= 70 ? { text: "LOW RISK", color: "#16a34a", bg: "rgba(22,163,74,0.1)" }
    : score >= 50 ? { text: "MODERATE RISK", color: "#d97706", bg: "rgba(217,119,6,0.1)" }
    : score >= 35 ? { text: "HIGH RISK", color: "#dc2626", bg: "rgba(220,38,38,0.1)" }
    : { text: "CRITICAL RISK", color: "#991b1b", bg: "rgba(153,27,27,0.15)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Eyebrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ height: 1, flex: 1, background: "var(--mb-rule, #e5e7eb)" }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--mb-muted, #9ca3af)" }}>
          The Verdict
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--mb-rule, #e5e7eb)" }} />
      </div>

      {/* Name + Risk badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--mb-ink, #111827)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {user?.name || "Your Career"}
          </div>
          <div style={{ fontSize: 13, color: "var(--mb-muted, #6b7280)", marginTop: 3 }}>
            {user?.current_title}{user?.location ? ` · ${user.location}` : ""}
          </div>
        </div>
        {riskLabel && (
          <div style={{
            background: riskLabel.bg,
            color: riskLabel.color,
            border: `1.5px solid ${riskLabel.color}30`,
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}>
            {riskLabel.text}
          </div>
        )}
      </div>

      {/* The 3-sentence verdict */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>

        {/* Sentence 1 — The threat */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: "rgba(220,38,38,0.05)",
            border: "1.5px solid rgba(220,38,38,0.15)",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(220,38,38,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dc2626", marginBottom: 4 }}>
              Biggest Threat
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--mb-ink, #111827)", lineHeight: 1.5 }}>
              {typeof topThreat === "string" && topThreat.length > 5
                ? `${topThreat.charAt(0).toUpperCase() + topThreat.slice(1)} is already being automated — and your employer will know by ${c1?.disruption_year || "2027"}.`
                : `Your top execution skills are already being automated.`}
            </div>
          </div>
        </motion.div>

        {/* Sentence 2 — The moat */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: "rgba(22,163,74,0.05)",
            border: "1.5px solid rgba(22,163,74,0.15)",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(22,163,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={16} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#16a34a", marginBottom: 4 }}>
              Your Unfair Advantage
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--mb-ink, #111827)", lineHeight: 1.5 }}>
              {topMoat} is what AI cannot replicate. That is your moat — and it compounds every year you stay in the game.
            </div>
          </div>
        </motion.div>

        {/* Sentence 3 — The move */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            background: "var(--mb-navy, #1e3a5f)",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
              Your #1 Move
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "white", lineHeight: 1.5 }}>
              {topMove}
            </div>
          </div>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        style={{
          width: "100%",
          padding: "16px 24px",
          background: "var(--mb-navy, #1e3a5f)",
          color: "white",
          border: "none",
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        See Your Full Score & Analysis
        <ArrowRight size={18} />
      </motion.button>

      <p style={{ fontSize: 11, color: "var(--mb-muted, #9ca3af)", textAlign: "center", marginTop: 12 }}>
        7 intelligence cards · Score decomposition · Live market data · 90-day plan
      </p>
    </motion.div>
  );
}
