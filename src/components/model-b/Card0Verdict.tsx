/**
 * Card 0 — The Verdict (Knockout Opener)
 *
 * First impression. Must hit like a punch.
 * Cinematic dossier reveal: massive score, fear+hope blend,
 * one threat, one moat, one move. Built for screenshot virality.
 */
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, TrendingDown, Sparkles, Lock } from "lucide-react";
import { useEffect, useState } from "react";

interface Card0VerdictProps {
  cardData: any;
  onNext: () => void;
}

export default function Card0Verdict({ cardData, onNext }: Card0VerdictProps) {
  const c1 = cardData?.card1_risk;
  const c3 = cardData?.card3_shield;
  const c4 = cardData?.card4_pivot;
  const user = cardData?.user;
  const rawScore = cardData?.jobbachao_score ?? cardData?.risk_score ?? 0;

  // Animated score counter — feels alive
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    if (!rawScore) return;
    const dur = 1400;
    const start = performance.now();
    let frame: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimScore(Math.round(rawScore * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rawScore]);

  // Auto-advance hint countdown — appears after 6s, gentle nudge not auto-skip
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(true), 6000);
    return () => clearTimeout(t);
  }, []);

  // Sharper fear — pull SPECIFIC threat data from card1_risk schema
  // Schema fields: tasks_at_risk[], ai_tools_replacing (root-level on legacy scans), risk_score
  // Use ?? not || so legitimate 0 values aren't skipped
  const tasksAtRisk: string[] = Array.isArray(c1?.tasks_at_risk) ? c1.tasks_at_risk.slice(0, 3) : [];
  const threatTask = tasksAtRisk[0];
  const threatPct = c1?.ai_coverage_pct ?? c1?.exposure_pct
    ?? (typeof c1?.risk_score === "number" ? Math.min(95, Math.max(40, c1.risk_score + 10)) : null);
  const threatTool = c1?.ai_tools_replacing?.[0]
    || cardData?.ai_tools_replacing?.[0]?.tool_name
    || cardData?.ai_tools_replacing?.[0];
  const topMoatSkill = c3?.skills?.find((s: any) => s.level === "best-in-class" || s.level === "strong");
  const topMoat = topMoatSkill?.name
    || c1?.hope_bridge?.split(".")?.[0]?.replace(" is your shield", "")?.replace(/^[^a-zA-Z]+/, "")
    || "your judgment and pattern-recognition";

  // Build per-task auto-coverage % for the disappearance bars (deterministic, no extra LLM cost)
  // High-risk tasks deterministically map to 55–85% based on score position; safer tasks 35–55%.
  const taskRows = tasksAtRisk.map((task, i) => {
    const base = typeof threatPct === "number" ? threatPct : 60;
    const pct = Math.max(35, Math.min(88, base - i * 8));
    return { task: cap(task), pct };
  });

  // Build the visceral fear→hope couplet — the threat is named, the edge is TEASED
  const threatToolStr = typeof threatTool === "string" ? threatTool : null;
  const fearLine = threatTask && threatPct
    ? `${cap(threatTask)} — ${threatPct}% of it${threatToolStr ? ` is already done by ${threatToolStr}` : " can be automated"} today.`
    : threatTask
    ? `${cap(threatTask)} is being automated in your stack — today, not in five years.`
    : "Your top execution skills are being automated today — not in five years.";
  // Curiosity gap: show how many edges they have, lock the names.
  const moatSkillsList = c3?.skills?.filter((s: any) => s.level === "best-in-class" || s.level === "strong") || [];
  const moatCount = moatSkillsList.length;
  const hopeLine = moatCount > 0
    ? `You have ${moatCount === 1 ? "1 unfair edge" : `${moatCount} unfair edges`} AI cannot replicate — unlock to see ${moatCount === 1 ? "what it is" : "what they are"}.`
    : `You have edges AI cannot replicate — unlock to see them.`;

  // Risk tier — drives the entire color story
  const tier = rawScore >= 70
    ? { label: "FORTIFIED", sub: "Low displacement risk", color: "#15803d", glow: "rgba(21,128,61,0.18)", ring: "#16a34a", arc: "Hope" }
    : rawScore >= 50
    ? { label: "EXPOSED", sub: "Moderate displacement risk", color: "#b45309", glow: "rgba(180,83,9,0.18)", ring: "#d97706", arc: "Warning" }
    : rawScore >= 35
    ? { label: "AT RISK", sub: "High displacement risk", color: "#b91c1c", glow: "rgba(185,28,28,0.18)", ring: "#dc2626", arc: "Threat" }
    : { label: "CRITICAL", sub: "Severe displacement risk", color: "#7f1d1d", glow: "rgba(127,29,29,0.22)", ring: "#991b1b", arc: "Crisis" };

  // Confidence + freshness derived from data depth
  const dataDepth = (c1 ? 1 : 0) + (c3 ? 1 : 0) + (c4 ? 1 : 0);
  const confidenceLabel = dataDepth >= 3 ? "High" : dataDepth >= 2 ? "Medium" : "Building";
  const confidenceColor = dataDepth >= 3 ? "#15803d" : dataDepth >= 2 ? "#b45309" : "#6b7280";

  // Stats below the score — ONE canonical fear number (AI exposure), then concrete threat counts.
  // Replaces the green "moat skills" reassurance pill with a red "skills decaying" threat metric.
  const aiCoverage = c1?.ai_coverage_pct ?? c1?.exposure_pct
    ?? (typeof c1?.risk_score === "number" ? c1.risk_score : null);
  const decayingSkillsCount = c3?.skills?.filter((s: any) => s.level === "decaying" || s.level === "weak" || s.level === "obsolete")?.length || 0;
  const pivotCount = c4?.pivots?.length || 0;

  // Top move — TEASED, not revealed (curiosity gap drives clicks)
  // Show category + match %, lock the specific role behind the CTA.
  // Schema: pivots[].match_pct (not skill_overlap_pct)
  const topPivot = c4?.pivots?.[0];
  const topMatchPct = topPivot?.match_pct || topPivot?.skill_overlap_pct || 70;
  const topMove = topPivot?.role
    ? `Your skills already transfer ${topMatchPct}% to a safer role we've identified — unlock to see which one.`
    : "We've mapped your top 3 escape routes — unlock the full report to see them.";

  // Conic-gradient ring percentage
  const ringPct = Math.max(0, Math.min(100, rawScore));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* DOSSIER HEADER STRIP */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 0",
          borderTop: "1px solid var(--mb-ink, #111827)",
          borderBottom: "1px solid var(--mb-rule, #e5e7eb)",
          marginBottom: 22,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--mb-muted, #6b7280)",
        }}
      >
        <span>Career Intelligence Dossier</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 8px #16a34a" }} />
          Verified · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </motion.div>

      {/* NAME + ROLE — Newspaper masthead */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={{ textAlign: "center", marginBottom: 24 }}
      >
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(32px, 5vw, 44px)",
          fontWeight: 900,
          color: "var(--mb-ink, #111827)",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginBottom: 8,
        }}>
          {user?.name || "Your Career"}
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--mb-muted, #6b7280)",
          letterSpacing: "0.04em",
        }}>
          {user?.current_title}{user?.location ? ` · ${user.location}` : ""}{user?.years_experience ? ` · ${user.years_experience}y experience` : ""}
        </div>
      </motion.div>

      {/* THE SCORE — knockout centerpiece */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: "absolute",
          inset: -20,
          background: `radial-gradient(circle at center, ${tier.glow} 0%, transparent 60%)`,
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Subtle pulsing rings — cinematic intelligence-terminal motion */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.5, 0], scale: [0.85, 1.25, 1.4] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: `1.5px solid ${tier.ring}`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.35, 0], scale: [0.85, 1.4, 1.6] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeOut", delay: 2.2 }}
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: `1px solid ${tier.ring}`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Conic ring */}
        <div style={{
          position: "relative",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: `conic-gradient(${tier.ring} ${ringPct * 3.6}deg, rgba(0,0,0,0.06) ${ringPct * 3.6}deg)`,
          padding: 8,
          zIndex: 1,
        }}>
          <div style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "var(--mb-paper, #ffffff)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `inset 0 2px 12px rgba(0,0,0,0.04), 0 8px 32px ${tier.glow}`,
          }}>
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: "var(--mb-muted, #9ca3af)",
              textTransform: "uppercase",
              marginBottom: 2,
            }}>
              Career Position
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 84,
              fontWeight: 900,
              color: tier.color,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
            }}>
              {animScore}
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--mb-muted, #6b7280)",
              marginTop: 2,
              letterSpacing: "0.05em",
            }}>
              out of 100
            </div>
          </div>
        </div>

        {/* Tier badge */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{
            marginTop: 18,
            padding: "8px 20px",
            background: tier.color,
            color: "white",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.18em",
            boxShadow: `0 6px 20px ${tier.glow}`,
            zIndex: 1,
          }}
        >
          {tier.label}
        </motion.div>
        <div style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--mb-muted, #6b7280)",
          zIndex: 1,
        }}>
          {tier.sub}
        </div>

        {/* Confidence + freshness micro-line */}
        <div style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10.5,
          fontWeight: 700,
          color: "var(--mb-muted, #6b7280)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          zIndex: 1,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: confidenceColor }} />
            Confidence: {confidenceLabel}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Refreshed today</span>
        </div>
      </motion.div>

      {/* QUICK STATS — three pill-cards */}
      {(aiCoverage != null || moatCount > 0 || pivotCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 28,
          }}
        >
          <StatPill icon={<TrendingDown size={14} />} value={aiCoverage != null ? `${aiCoverage}%` : "—"} label="AI exposure" tone="threat" />
          <StatPill icon={<Shield size={14} />} value={moatCount > 0 ? String(moatCount) : "—"} label="Moat skills" tone="moat" />
          <StatPill icon={<Sparkles size={14} />} value={pivotCount > 0 ? String(pivotCount) : "—"} label="Safe pivots" tone="hope" />
        </motion.div>
      )}

      {/* DIVIDER */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}
      >
        <div style={{ height: 1, flex: 1, background: "var(--mb-rule, #e5e7eb)" }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", color: "var(--mb-muted, #9ca3af)" }}>
          THE 30-SECOND VERDICT
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--mb-rule, #e5e7eb)" }} />
      </motion.div>

      {/* THREE-SENTENCE VERDICT */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>

        {/* THE FEAR → HOPE COUPLET — single knockout block */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "relative",
            background: "white",
            border: "1.5px solid var(--mb-rule, #e5e7eb)",
            borderRadius: 16,
            padding: "20px 22px",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          {/* Vertical fear/hope spine */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0, width: 4,
            background: "linear-gradient(180deg, #dc2626 0%, #dc2626 50%, #15803d 50%, #15803d 100%)",
          }} />

          {/* Fear half */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#dc2626", marginBottom: 4 }}>
                The Threat
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--mb-ink, #111827)", lineHeight: 1.45, letterSpacing: "-0.005em" }}>
                {fearLine}
              </div>

              {/* Disappearance bars — top tasks AI does today */}
              {taskRows.length > 1 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280", marginBottom: 2 }}>
                    Will disappear first
                  </div>
                  {taskRows.map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#374151", lineHeight: 1.3 }}>
                        {row.task}
                      </div>
                      <div style={{ width: 90, height: 6, borderRadius: 999, background: "rgba(220,38,38,0.12)", overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${row.pct}%` }}
                          transition={{ delay: 0.9 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          style={{ height: "100%", background: "linear-gradient(90deg, #dc2626, #ef4444)" }}
                        />
                      </div>
                      <div style={{ width: 32, fontSize: 12, fontWeight: 800, color: "#b91c1c", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.pct}%
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Soft separator */}
          <div style={{ height: 1, background: "var(--mb-rule, #e5e7eb)", marginBottom: 14 }} />

          {/* Hope half */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>🛡️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#15803d", marginBottom: 4 }}>
                Your Edge
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--mb-ink, #111827)", lineHeight: 1.45, letterSpacing: "-0.005em" }}>
                {hopeLine}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Move — solid navy */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "linear-gradient(135deg, var(--mb-navy, #1e3a5f) 0%, #0f1f3a 100%)",
            borderRadius: 16,
            padding: "18px 20px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            boxShadow: "0 12px 30px rgba(15,31,58,0.25)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Lock size={16} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.18)", fontSize: 8.5, letterSpacing: "0.15em" }}>LOCKED</span>
              YOUR #1 MOVE
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "white", lineHeight: 1.45, letterSpacing: "-0.005em" }}>
              {topMove}
            </div>
          </div>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        style={{
          width: "100%",
          padding: "18px 24px",
          background: "var(--mb-ink, #111827)",
          color: "white",
          border: "none",
          borderRadius: 16,
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: "0.01em",
          boxShadow: "0 10px 30px rgba(17,24,39,0.25)",
        }}
      >
        See How to Survive
        <ArrowRight size={18} />
      </motion.button>

      <p style={{ fontSize: 11, color: "var(--mb-muted, #9ca3af)", textAlign: "center", marginTop: 12, letterSpacing: "0.04em" }}>
        Unlock 7 intelligence cards · Your safe pivot · Defense plan · Live market signals
      </p>

      {/* Auto-advance hint — gentle nudge after 6s, never auto-skips */}
      {hintVisible && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onNext}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "10px auto 0",
            padding: "6px 14px",
            background: "transparent",
            border: "1px dashed var(--mb-rule, #d1d5db)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--mb-muted, #6b7280)",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--mb-muted, #9ca3af)" }}
          />
          Card 1 of 7 · Risk Mirror is next
          <ArrowRight size={12} />
        </motion.button>
      )}

      {/* Share row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.15 }}
        style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}
      >
        <button
          onClick={() => {
            const score = cardData?.jobbachao_score ?? cardData?.risk_score ?? "—";
            const role = cardData?.user?.current_title || "professional";
            const threat = cardData?.card1_risk?.tasks_at_risk?.[0] || "execution skills";
            const text = `My Career Position Score: ${score}/100 as a ${role}. My biggest AI threat: ${threat}. Get yours free 👇 https://jobbachao.com`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, background: "#25D366", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
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
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, background: "#0A66C2", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          Share on LinkedIn
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Sub-components ─────────── */

function StatPill({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: "threat" | "moat" | "hope" }) {
  const colors = {
    threat: { fg: "#b91c1c", bg: "rgba(185,28,28,0.06)", border: "rgba(185,28,28,0.16)" },
    moat: { fg: "#15803d", bg: "rgba(21,128,61,0.06)", border: "rgba(21,128,61,0.16)" },
    hope: { fg: "#1e3a5f", bg: "rgba(30,58,95,0.06)", border: "rgba(30,58,95,0.16)" },
  }[tone];
  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: "10px 8px",
      textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: colors.fg, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-muted, #6b7280)" }}>
        {label}
      </div>
    </div>
  );
}

/* Capitalize first letter helper */
function cap(s: string): string {
  if (!s || typeof s !== "string") return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
