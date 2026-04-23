// ═══════════════════════════════════════════════════════════════════════════
// BOSS PERCEPTION SIMULATOR — Inline module for Card1RiskMirror
// ───────────────────────────────────────────────────────────────────────────
// Psychology: 3 ultra-revealing questions (not 5) → instant verdict.
// Hyper-personalised using existing scan data (role, years, risk_score).
// No signup, no upload — pre-filled from the analysis already done.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTrack } from "@/hooks/use-track";

interface Props {
  role: string;
  years?: string | number;
  riskScore: number;
  tasksAtRisk?: string[];
  industry?: string;
}

type Tier = "future-leader" | "silent-performer" | "workhorse" | "invisible";

interface TierConfig {
  id: Tier;
  emoji: string;
  label: string;
  oneLiner: string;
  layoffPct: number;
  bg: string;
  border: string;
  text: string;
  accent: string;
}

const TIERS: Record<Tier, TierConfig> = {
  "future-leader": {
    id: "future-leader",
    emoji: "🟢",
    label: "Future Leader",
    oneLiner: "Your boss fights to keep you. You're on the succession map.",
    layoffPct: 8,
    bg: "var(--mb-green-tint)",
    border: "rgba(26,107,60,0.35)",
    text: "var(--mb-green)",
    accent: "var(--mb-green)",
  },
  "silent-performer": {
    id: "silent-performer",
    emoji: "🟡",
    label: "Silent Performer",
    oneLiner: "Boss likes you. Boss forgets you. You ship work, not narrative.",
    layoffPct: 42,
    bg: "var(--mb-amber-tint)",
    border: "rgba(139,90,0,0.35)",
    text: "var(--mb-amber)",
    accent: "var(--mb-amber)",
  },
  workhorse: {
    id: "workhorse",
    emoji: "🟠",
    label: "Reliable Workhorse",
    oneLiner: "Valued. Also forgettable. The first name on the cost-cut shortlist.",
    layoffPct: 71,
    bg: "rgba(220,120,40,0.10)",
    border: "rgba(180,90,30,0.35)",
    text: "rgb(180,90,30)",
    accent: "rgb(180,90,30)",
  },
  invisible: {
    id: "invisible",
    emoji: "🔴",
    label: "Invisible Asset",
    oneLiner: "Boss barely registers your name. You will not survive a reorg.",
    layoffPct: 89,
    bg: "var(--mb-red-tint)",
    border: "rgba(174,40,40,0.35)",
    text: "var(--mb-red)",
    accent: "var(--mb-red)",
  },
};

interface Question {
  id: string;
  prompt: string;
  options: { label: string; weight: number }[]; // weight 0 (best) → 3 (worst)
}

const QUESTIONS: Question[] = [
  {
    id: "praise",
    prompt: "When did your boss last praise your work in front of others?",
    options: [
      { label: "This month", weight: 0 },
      { label: "Last 3 months", weight: 1 },
      { label: "6+ months ago", weight: 2 },
      { label: "Honestly, never", weight: 3 },
    ],
  },
  {
    id: "critical-project",
    prompt: "A high-stakes project lands. Who does your boss think of first?",
    options: [
      { label: "Always me", weight: 0 },
      { label: "Sometimes me", weight: 1 },
      { label: "Rarely me", weight: 2 },
      { label: "Never me", weight: 3 },
    ],
  },
  {
    id: "fight-for-you",
    prompt: "If the team had to cut 2 people next quarter — would your boss fight for you?",
    options: [
      { label: "Definitely", weight: 0 },
      { label: "Probably", weight: 1 },
      { label: "Doubtful", weight: 2 },
      { label: "No chance", weight: 3 },
    ],
  },
];

function scoreToTier(totalWeight: number, riskScore: number): Tier {
  // 0-9 raw weight. Blend with role risk_score for hyper-personalisation.
  // High role risk pulls verdict harder toward red even with okay answers.
  const riskBoost = riskScore >= 70 ? 1.5 : riskScore >= 40 ? 0.75 : 0;
  const blended = totalWeight + riskBoost;
  if (blended <= 2) return "future-leader";
  if (blended <= 4.5) return "silent-performer";
  if (blended <= 7) return "workhorse";
  return "invisible";
}

function buildPersonalisedVerdict(
  tier: TierConfig,
  role: string,
  years: string | number | undefined,
  tasksAtRisk: string[] | undefined,
): { headline: string; gut: string; plan: string[] } {
  const roleClean = role || "your role";
  const yearsLabel = years ? `${years}` : "your tenure";
  const topTask = tasksAtRisk?.[0] || "core execution work";

  if (tier.id === "invisible") {
    return {
      headline: `${yearsLabel} in ${roleClean}. And your boss couldn't pick your last 3 wins out of a lineup.`,
      gut: `You're carrying ${topTask.toLowerCase()} that AI is already commoditising. Without visibility, you're a line item — not a person.`,
      plan: [
        "Send a 4-line Friday impact note to your boss for 4 weeks straight (non-negotiable)",
        `Pick ONE problem above your pay grade and email a 1-page memo to your boss this week`,
        "In your next 1:1, ask your boss: \"What does great look like in 6 months?\" — then deliver against that exact answer",
      ],
    };
  }

  if (tier.id === "workhorse") {
    return {
      headline: `You ship. You deliver. And you're the first name people forget when bonuses are decided.`,
      gut: `Reliability is table stakes — not a moat. With AI handling ${topTask.toLowerCase()}, "dependable" is the new "automatable".`,
      plan: [
        "Stop reporting tasks. Start reporting outcomes (₹ saved, hours cut, risks killed)",
        "Volunteer for ONE cross-team initiative this quarter — visibility compounds faster than competence",
        "Ask your boss WHY before HOW in every meeting — strategic posture changes how they perceive you",
      ],
    };
  }

  if (tier.id === "silent-performer") {
    return {
      headline: `Your work speaks. Unfortunately, your boss isn't in the audience.`,
      gut: `${yearsLabel} of solid output, but no narrative. When layoffs come, decisions are made on memory — not merit.`,
      plan: [
        "Build a \"wins doc\" — update it weekly, send a monthly highlight reel to your skip-level",
        "Make ONE strategic recommendation per month that's outside your direct scope",
        `Position yourself as the AI-augmented operator in ${roleClean} — nobody is doing this yet`,
      ],
    };
  }

  return {
    headline: `Your boss has your name on the keep-at-all-costs list. Don't get comfortable.`,
    gut: `You're protected today. But succession favours those who can lead through AI disruption — not just survive it.`,
    plan: [
      "Start mentoring 1 junior — leadership signal compounds your protection",
      "Lead one AI-augmentation pilot in your team within 90 days",
      "Have a career conversation with your boss this month: \"Where am I 18 months out?\"",
    ],
  };
}

export default function BossPerceptionSimulator({ role, years, riskScore, tasksAtRisk }: Props) {
  const [step, setStep] = useState<"intro" | "q" | "result">("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const { track } = useTrack();

  const handleAnswer = (weight: number) => {
    const next = [...answers, weight];
    setAnswers(next);
    if (qIdx < QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
    } else {
      setStep("result");
      // Fire-and-forget — captures verdict tier for engagement analytics
      const finalTier = scoreToTier(next.reduce((a, b) => a + b, 0), riskScore);
      track("boss_simulator_completed", { tier: finalTier, role, risk_score: riskScore });
    }
  };

  const reset = () => {
    setStep("intro");
    setAnswers([]);
    setQIdx(0);
    track("boss_simulator_rerun");
  };

  const startSim = () => {
    setStep("q");
    track("boss_simulator_started", { role, risk_score: riskScore });
  };

  const totalWeight = answers.reduce((a, b) => a + b, 0);
  const tier = step === "result" ? TIERS[scoreToTier(totalWeight, riskScore)] : null;
  const verdict = tier ? buildPersonalisedVerdict(tier, role, years, tasksAtRisk) : null;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0f0f12 0%, #1a1a20 100%)",
        border: "1.5px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 0,
        marginBottom: 22,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      {/* Header — always visible */}
      <div
        style={{
          padding: "18px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(90deg, rgba(174,40,40,0.12), transparent)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Boss Perception Simulator · 30 seconds
          </span>
        </div>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.25,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          What does your boss <em style={{ color: "#ff8a8a", fontStyle: "italic" }}>actually</em> think of you?
        </h3>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            margin: "6px 0 0",
            lineHeight: 1.55,
          }}
        >
          73% of professionals think their boss values them. Only 23% are right. 3 questions tell you which one you are.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ padding: "22px" }}
          >
            <button
              onClick={startSim}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #ff4d4d 0%, #c41e1e 100%)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "16px 22px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.02em",
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(196,30,30,0.35)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Run the simulator → Get my Boss Score
            </button>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                textAlign: "center",
                margin: "12px 0 0",
                fontWeight: 500,
              }}
            >
              Pre-filled from your resume · No signup · Brutally honest
            </p>
          </motion.div>
        )}

        {step === "q" && (
          <motion.div
            key={`q-${qIdx}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            style={{ padding: "22px" }}
          >
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: i <= qIdx ? "#ff4d4d" : "rgba(255,255,255,0.12)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>

            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
                marginBottom: 10,
              }}
            >
              Question {qIdx + 1} of {QUESTIONS.length}
            </div>

            <p
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 19,
                fontWeight: 700,
                color: "white",
                lineHeight: 1.35,
                margin: "0 0 18px",
                letterSpacing: "-0.005em",
              }}
            >
              {QUESTIONS[qIdx].prompt}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {QUESTIONS[qIdx].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.weight)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    padding: "13px 16px",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,77,77,0.12)";
                    e.currentTarget.style.borderColor = "rgba(255,77,77,0.45)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "result" && tier && verdict && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ padding: "22px" }}
          >
            {/* Verdict pill */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 220 }}
              style={{
                background: tier.bg,
                border: `2px solid ${tier.border}`,
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 8,
                }}
              >
                Your boss sees you as
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 30,
                  fontWeight: 900,
                  color: tier.text,
                  lineHeight: 1.1,
                  marginBottom: 6,
                  letterSpacing: "-0.015em",
                }}
              >
                {tier.emoji} {tier.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  color: tier.text,
                  letterSpacing: "0.02em",
                }}
              >
                {tier.layoffPct}% chance you're sacrificed in the next layoff round
              </div>
            </motion.div>

            {/* Personalised gut-punch */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderLeft: `3px solid ${tier.accent}`,
                borderRadius: "0 10px 10px 0",
                padding: "14px 16px",
                marginBottom: 14,
              }}
            >
              <p
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "white",
                  lineHeight: 1.45,
                  margin: "0 0 8px",
                  fontStyle: "italic",
                  letterSpacing: "-0.005em",
                }}
              >
                {verdict.headline}
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {verdict.gut}
              </p>
            </motion.div>

            {/* 90-day plan */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 10,
                }}
              >
                Your 90-day perception fix
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {verdict.plan.map((action, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: tier.accent,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {i + 1}
                    </div>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.88)",
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {action}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <button
              onClick={reset}
              style={{
                width: "100%",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "10px 16px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              ↻ Re-run with different answers
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
