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

      {/* Share at Card 0 — maximum reach since 100% of users see this */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button
          onClick={() => {
            const score = cardData?.jobbachao_score ?? cardData?.risk_score ?? "—";
            const role = cardData?.user?.current_title || "professional";
            const threat = cardData?.card1_risk?.tasks_at_risk?.[0] || "execution skills";
            const text = `My Career Position Score: ${score}/100 as a ${role}. My biggest AI threat: ${threat}. Get yours free 👇 https://jobbachao.com`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, background: "#25D366", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Share my score
        </button>
        <button
          onClick={() => {
            const score = cardData?.jobbachao_score ?? cardData?.risk_score ?? "—";
            const role = cardData?.user?.current_title || "professional";
            const moat = cardData?.card3_shield?.skills?.find((s: any) => s.level === "best-in-class" || s.level === "strong")?.name || "judgment";
            const text = `Just got my AI Career Risk Score: ${score}/100 as a ${role}. My moat skill: ${moat}. Free scan at jobbachao.com — takes 4 min. #CareerDevelopment #AI #FutureOfWork`;
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://jobbachao.com")}&summary=${encodeURIComponent(text)}`, '_blank');
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, background: "#0A66C2", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          Share on LinkedIn
        </button>
      </div>
    </motion.div>
  );
}
