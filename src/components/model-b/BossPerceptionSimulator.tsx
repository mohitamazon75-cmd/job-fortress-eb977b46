// ═══════════════════════════════════════════════════════════════════════════
// CAREER REALITY CHECK — Inline module for Card1RiskMirror
// ───────────────────────────────────────────────────────────────────────────
// Two diagnostic axes, six questions, one inference verdict:
//   Section A (3Q): Boss Psychology — power dynamics, narrative, succession
//   Section B (3Q): AI Currency     — augmentation depth in actual workflow
// Combined through a 2-axis inference engine → one of 4 quadrant verdicts,
// each with hyper-personalised gut-punch + 3 surgical 90-day actions.
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

// 2-axis quadrant. Boss-axis = perceived value to manager.
// AI-axis = how current/augmented the user is in their daily work.
type Quadrant =
  | "future-leader"     // High boss-trust + High AI-currency  → safest cohort
  | "ai-blind-favourite"// High boss-trust + Low AI-currency   → expiring asset
  | "hidden-operator"   // Low boss-trust  + High AI-currency  → undervalued, mobile
  | "exposed";          // Low boss-trust  + Low AI-currency   → first-out cohort

interface QuadrantConfig {
  id: Quadrant;
  emoji: string;
  label: string;
  oneLiner: string;
  layoffPct: number;
  bg: string;
  border: string;
  text: string;
  accent: string;
}

const QUADRANTS: Record<Quadrant, QuadrantConfig> = {
  "future-leader": {
    id: "future-leader",
    emoji: "🟢",
    label: "Future Leader",
    oneLiner: "Boss bets on you. AI works for you. You're on the succession map.",
    layoffPct: 9,
    bg: "var(--mb-green-tint)",
    border: "rgba(26,107,60,0.35)",
    text: "var(--mb-green)",
    accent: "var(--mb-green)",
  },
  "ai-blind-favourite": {
    id: "ai-blind-favourite",
    emoji: "🟡",
    label: "AI-Blind Favourite",
    oneLiner: "Your boss loves you today. The 2027 boss won't know your name.",
    layoffPct: 48,
    bg: "var(--mb-amber-tint)",
    border: "rgba(139,90,0,0.35)",
    text: "var(--mb-amber)",
    accent: "var(--mb-amber)",
  },
  "hidden-operator": {
    id: "hidden-operator",
    emoji: "🟠",
    label: "Hidden Operator",
    oneLiner: "AI-fluent and undervalued. The market wants you more than your boss does.",
    layoffPct: 38,
    bg: "rgba(220,120,40,0.10)",
    border: "rgba(180,90,30,0.35)",
    text: "rgb(180,90,30)",
    accent: "rgb(180,90,30)",
  },
  exposed: {
    id: "exposed",
    emoji: "🔴",
    label: "Exposed",
    oneLiner: "Invisible to your boss. Outpaced by AI. This is the first-cut cohort.",
    layoffPct: 87,
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

// SECTION A — Boss Psychology (deeper than "did your boss praise you")
// Probes: decision-table presence, boss's career bet on you, narrative ownership.
const BOSS_QUESTIONS: Question[] = [
  {
    id: "decision-room",
    prompt: "When your boss has to decide something risky in your domain — are you in the room before the decision is made?",
    options: [
      { label: "Yes — boss asks me first", weight: 0 },
      { label: "Sometimes, when it's convenient", weight: 1 },
      { label: "Only after the decision is made", weight: 2 },
      { label: "Never — I find out from a meeting invite", weight: 3 },
    ],
  },
  {
    id: "career-bet",
    prompt: "If your boss had to stake their reputation on one direct report's promotion next year — would they pick you?",
    options: [
      { label: "Yes, I'm the obvious choice", weight: 0 },
      { label: "I'd be in their top 3", weight: 1 },
      { label: "I'd be considered, but not first", weight: 2 },
      { label: "Honestly, no", weight: 3 },
    ],
  },
  {
    id: "narrative",
    prompt: "When your boss describes your work to their boss — do they describe outcomes you owned, or tasks you completed?",
    options: [
      { label: "Outcomes — they name me as the driver", weight: 0 },
      { label: "Mostly outcomes, sometimes tasks", weight: 1 },
      { label: "Mostly tasks I executed", weight: 2 },
      { label: "I'm not sure they describe my work at all", weight: 3 },
    ],
  },
];

// SECTION B — AI Currency (depth, not vanity usage)
// Probes: integration into core workflow, decision-grade output, leverage created.
const AI_QUESTIONS: Question[] = [
  {
    id: "ai-frequency",
    prompt: "In a normal work week — how often does AI sit inside your actual deliverables (not just emails or summaries)?",
    options: [
      { label: "Daily — AI is wired into my core workflow", weight: 0 },
      { label: "A few times a week on real work", weight: 1 },
      { label: "Occasionally, mostly for drafts", weight: 2 },
      { label: "Rarely or never on the work that matters", weight: 3 },
    ],
  },
  {
    id: "ai-depth",
    prompt: "When you ship work using AI — is the output good enough that your boss couldn't tell the difference from your best manual work?",
    options: [
      { label: "Yes — and faster than my manual work", weight: 0 },
      { label: "Usually, with some editing", weight: 1 },
      { label: "Sometimes; I often re-do it manually", weight: 2 },
      { label: "I haven't really tested this", weight: 3 },
    ],
  },
  {
    id: "ai-leverage",
    prompt: "Has AI changed what you can take on? (e.g., handling 2× the scope, owning a new function, killing a hire request)",
    options: [
      { label: "Yes — visibly more scope or output", weight: 0 },
      { label: "Some — small efficiency wins", weight: 1 },
      { label: "Not really — same scope, slightly faster", weight: 2 },
      { label: "No change at all", weight: 3 },
    ],
  },
];

const ALL_QUESTIONS = [...BOSS_QUESTIONS, ...AI_QUESTIONS];

/** Combine boss-axis (Q1-3) and AI-axis (Q4-6) into a quadrant verdict.
 *  Each axis is 0-9 raw. We split on the midpoint (4.5) with a small risk_score lean.
 */
function inferQuadrant(answers: number[], riskScore: number): { quad: Quadrant; bossRaw: number; aiRaw: number } {
  const bossRaw = answers.slice(0, 3).reduce((a, b) => a + b, 0);
  const aiRaw = answers.slice(3, 6).reduce((a, b) => a + b, 0);

  // Risk-score lean: high role-risk pulls AI-axis worse (0.75 pts) — being in a
  // high-risk role with low AI fluency is an even sharper failure mode.
  const aiLean = riskScore >= 70 ? 0.75 : riskScore >= 40 ? 0.4 : 0;
  const aiAdj = aiRaw + aiLean;

  const bossWeak = bossRaw > 4.5;  // boss perception is weak
  const aiWeak = aiAdj > 4.5;      // AI currency is weak

  let quad: Quadrant;
  if (!bossWeak && !aiWeak) quad = "future-leader";
  else if (!bossWeak && aiWeak) quad = "ai-blind-favourite";
  else if (bossWeak && !aiWeak) quad = "hidden-operator";
  else quad = "exposed";

  return { quad, bossRaw, aiRaw };
}

function buildPersonalisedVerdict(
  cfg: QuadrantConfig,
  bossRaw: number,
  aiRaw: number,
  role: string,
  years: string | number | undefined,
  tasksAtRisk: string[] | undefined,
): { headline: string; gut: string; plan: string[] } {
  const roleClean = role || "your role";
  const yearsLabel = years ? `${years} years` : "your tenure";
  const topTask = tasksAtRisk?.[0] || "core execution work";
  const bossPct = Math.round(((9 - bossRaw) / 9) * 100); // higher = better
  const aiPct = Math.round(((9 - aiRaw) / 9) * 100);

  if (cfg.id === "exposed") {
    return {
      headline: `${yearsLabel} in ${roleClean} — and you're invisible to your boss while AI eats ${topTask.toLowerCase()}.`,
      gut: `Boss visibility: ${bossPct}/100. AI fluency: ${aiPct}/100. Both axes are red. The next reorg won't even feel like a decision — it'll feel like a spreadsheet exercise.`,
      plan: [
        `This week: pick ONE AI tool genuinely used by senior people in ${roleClean} and ship one real deliverable with it. Document the time saved.`,
        `Send your boss a 4-line Friday note for 4 weeks — outcome, scope, what's next, what you need. Non-negotiable.`,
        `Within 30 days, propose ONE initiative that uses AI to solve a problem above your pay grade. Email it. Make sure it's read.`,
      ],
    };
  }

  if (cfg.id === "ai-blind-favourite") {
    return {
      headline: `Your boss bets on you today. The 2027 version of your boss won't.`,
      gut: `Boss visibility: ${bossPct}/100 (strong). AI fluency: ${aiPct}/100 (weak). You're protected by relationship, not by what you can do. When your boss leaves or the org restructures, you reset to zero.`,
      plan: [
        `Pick the top 2 AI tools your role peers in India are using. Get to "boss-quality output" in 30 days. Document the before/after.`,
        `Lead one AI-augmentation pilot inside your team this quarter — something that visibly multiplies output. This is your insurance policy.`,
        `In your next 1:1, position yourself as the AI-augmented operator in ${roleClean}. Ask: "Where's our team going to need AI fluency in 12 months?" — then volunteer.`,
      ],
    };
  }

  if (cfg.id === "hidden-operator") {
    return {
      headline: `You're more AI-fluent than your boss realises. The market knows. Your boss doesn't.`,
      gut: `Boss visibility: ${bossPct}/100 (weak). AI fluency: ${aiPct}/100 (strong). You're undervalued internally — which means external offers will likely beat your current trajectory. Use it.`,
      plan: [
        `Build a "wins doc" — 4 lines per week, send a monthly highlight reel to your skip-level. Lead with AI-leveraged outcomes.`,
        `Take ONE strategic problem you've solved with AI and turn it into a 1-page memo to your boss. Frame it as a recommendation, not a request.`,
        `Quietly take 2 external interviews in the next 60 days — not to leave, but to price yourself. Bring the data back to your boss.`,
      ],
    };
  }

  // future-leader
  return {
    headline: `You're in the small group that survives the AI shake-out. Don't get comfortable.`,
    gut: `Boss visibility: ${bossPct}/100. AI fluency: ${aiPct}/100. Both green. You're on the keep-at-all-costs list — but succession favours those who lead through AI disruption, not just survive it.`,
    plan: [
      `Mentor 1 junior on AI-augmented workflows this quarter — leadership signal compounds your protection.`,
      `Lead one company-wide AI initiative in the next 90 days. This moves you from "AI user" to "AI strategist".`,
      `Have an 18-month conversation with your boss this month. Ask: "What does great look like at the next level?" — then deliver against the exact answer.`,
    ],
  };
}

// `industry` is accepted for future industry-aware verdicts but not used yet.
export default function BossPerceptionSimulator({ role, years, riskScore, tasksAtRisk, industry: _industry }: Props) {
  const [step, setStep] = useState<"intro" | "q" | "result">("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const { track } = useTrack();

  const handleAnswer = (weight: number) => {
    const next = [...answers, weight];
    setAnswers(next);
    if (qIdx < ALL_QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
    } else {
      setStep("result");
      const { quad, bossRaw, aiRaw } = inferQuadrant(next, riskScore);
      track("boss_simulator_completed", {
        tier: quad,
        boss_raw: bossRaw,
        ai_raw: aiRaw,
        role,
        risk_score: riskScore,
      });
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

  const inference = step === "result" ? inferQuadrant(answers, riskScore) : null;
  const cfg = inference ? QUADRANTS[inference.quad] : null;
  const verdict = cfg && inference
    ? buildPersonalisedVerdict(cfg, inference.bossRaw, inference.aiRaw, role, years, tasksAtRisk)
    : null;

  // Section label based on current question
  const isBossSection = qIdx < BOSS_QUESTIONS.length;
  const sectionLabel = isBossSection ? "Section A · Boss Psychology" : "Section B · AI Currency";
  const sectionAccent = isBossSection ? "#ff4d4d" : "#4d9fff";

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
            Career Reality Check · 60 seconds · 6 questions
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
          What does your boss <em style={{ color: "#ff8a8a", fontStyle: "italic" }}>actually</em> think — and is AI on your side?
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
          Two axes decide whether you survive the next 24 months: how your boss perceives you, and how current you are with AI. We test both, then run the inference.
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
            {/* Section preview chips */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.25)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ff8a8a", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  Section A · 3 Qs
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  Boss Psychology
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                  Power, narrative, succession
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "rgba(77,159,255,0.08)",
                  border: "1px solid rgba(77,159,255,0.25)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8ab8ff", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  Section B · 3 Qs
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  AI Currency
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                  Workflow depth, leverage
                </div>
              </div>
            </div>

            {/* Demoted to secondary style — was a red gradient hero CTA that pulled
                attention away from the rupee-cost data above it. Now reads as an
                opt-in diagnostic, not the page's primary action. */}
            <button
              onClick={startSim}
              style={{
                width: "100%",
                background: "transparent",
                color: "white",
                border: "1.5px solid rgba(255,255,255,0.35)",
                borderRadius: 10,
                padding: "13px 20px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
              }}
            >
              Run the 6-question reality check →
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
            {/* Section label */}
            <div
              style={{
                display: "inline-block",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: sectionAccent,
                marginBottom: 10,
                padding: "3px 10px",
                background: `${sectionAccent}15`,
                borderRadius: 6,
                border: `1px solid ${sectionAccent}40`,
              }}
            >
              {sectionLabel}
            </div>

            {/* Progress dots — split into two visual sections */}
            <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
              {ALL_QUESTIONS.map((_, i) => {
                const isInCurrentSection = (i < 3 && qIdx < 3) || (i >= 3 && qIdx >= 3);
                const isAnswered = i <= qIdx;
                const isBoss = i < 3;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: isAnswered
                        ? (isBoss ? "#ff4d4d" : "#4d9fff")
                        : "rgba(255,255,255,0.10)",
                      opacity: isInCurrentSection ? 1 : 0.55,
                      transition: "background 0.3s, opacity 0.3s",
                      // small gap separator between section A and B
                      marginRight: i === 2 ? 6 : 0,
                    }}
                  />
                );
              })}
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
              Question {qIdx + 1} of {ALL_QUESTIONS.length}
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
              {ALL_QUESTIONS[qIdx].prompt}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALL_QUESTIONS[qIdx].options.map((opt, i) => (
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
                    e.currentTarget.style.background = `${sectionAccent}1f`;
                    e.currentTarget.style.borderColor = `${sectionAccent}73`;
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

        {step === "result" && cfg && verdict && inference && (
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
                background: cfg.bg,
                border: `2px solid ${cfg.border}`,
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 14,
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
                Inference verdict
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 30,
                  fontWeight: 900,
                  color: cfg.text,
                  lineHeight: 1.1,
                  marginBottom: 6,
                  letterSpacing: "-0.015em",
                }}
              >
                {cfg.emoji} {cfg.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: cfg.text,
                  letterSpacing: "0.01em",
                  marginBottom: 8,
                  fontStyle: "italic",
                }}
              >
                {cfg.oneLiner}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  color: cfg.text,
                  letterSpacing: "0.02em",
                  opacity: 0.85,
                }}
              >
                {cfg.layoffPct}% chance you're sacrificed in the next layoff round
              </div>
            </motion.div>

            {/* Two-axis breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { label: "Boss visibility", raw: inference.bossRaw, accent: "#ff4d4d" },
                { label: "AI currency", raw: inference.aiRaw, accent: "#4d9fff" },
              ].map((axis) => {
                const score = Math.round(((9 - axis.raw) / 9) * 100);
                return (
                  <div
                    key={axis.label}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.55)",
                        marginBottom: 6,
                      }}
                    >
                      {axis.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 22,
                        fontWeight: 800,
                        color: axis.accent,
                        marginBottom: 6,
                      }}
                    >
                      {score}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>/100</span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${score}%`,
                          height: "100%",
                          background: axis.accent,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Personalised gut-punch */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderLeft: `3px solid ${cfg.accent}`,
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
                Your 90-day correction plan
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
                        background: cfg.accent,
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
