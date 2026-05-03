// ═══════════════════════════════════════════════════════════════
// Job vs Business — Founder Readiness Quiz + Personalized Autopsy
// ═══════════════════════════════════════════════════════════════
// Sticky teaser at top of Pivot tab. 5 questions → deterministic verdict
// → Pro gate → AI-grounded autopsy. Pro-only feature.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Rocket, ChevronRight, Lock, Loader2, AlertTriangle, Sparkles, Target, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "sonner";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import { QUESTIONS, classify, type QuizAnswers, type Verdict } from "@/lib/job-vs-business-scoring";

interface Autopsy {
  verdict_paragraph: string;
  what_kills_you: string[];
  what_saves_you: string[];
  your_unfair_edge: string;
  the_30_60_90: { next_30_days: string; next_60_days: string; next_90_days: string };
  if_you_ignore_this: string;
}

type Stage = "teaser" | "quiz" | "verdict" | "autopsy" | "loading";

export default function JobVsBusinessCard({ scanId }: { scanId?: string }) {
  const { isActive: isPro } = useSubscription();
  const [stage, setStage] = useState<Stage>("teaser");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [autopsy, setAutopsy] = useState<Autopsy | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const isComplete = QUESTIONS.every((q) => answers[q.key] !== undefined);

  const handleAnswer = (val: 0 | 1 | 2 | 3) => {
    const key = QUESTIONS[step].key;
    const next = { ...answers, [key]: val };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setTimeout(() => setStep(step + 1), 200);
    } else {
      const v = classify(next as QuizAnswers);
      setVerdict(v);
      setStage("verdict");
    }
  };

  const unlockAutopsy = async () => {
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    if (!scanId || !verdict) return;

    setStage("loading");
    try {
      const { data, error } = await supabase.functions.invoke("job-vs-business-autopsy", {
        body: { scanId, answers, verdict },
      });
      if (error) throw error;
      if (data?.autopsy) {
        setAutopsy(data.autopsy);
        setStage("autopsy");
      } else {
        throw new Error("Empty response");
      }
    } catch (e: any) {
      console.error("[JobVsBusiness] autopsy fetch failed", e);
      toast.error("Couldn't generate autopsy. Try again in a moment.");
      setStage("verdict");
    }
  };

  const reset = () => {
    setStage("teaser");
    setStep(0);
    setAnswers({});
    setVerdict(null);
    setAutopsy(null);
  };

  // ── Teaser (collapsed) ──────────────────────────────────────────
  if (stage === "teaser") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={teaserStyle}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={iconBoxStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Briefcase size={18} color="#1f3a52" />
              <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 700 }}>vs</span>
              <Rocket size={18} color="#b8860b" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#b8860b", textTransform: "uppercase", marginBottom: 2 }}>
              Job vs Business · Founder Readiness
            </div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.2 }}>
              Should you build your own thing — or stay employed?
            </h3>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0 0", lineHeight: 1.4 }}>
              5 brutal questions. Deterministic verdict. Personalized autopsy of your idea.
            </p>
          </div>
          <button
            onClick={() => setStage("quiz")}
            style={ctaBtnStyle}
          >
            Take 60-sec quiz <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Quiz (one question at a time) ──────────────────────────────
  if (stage === "quiz") {
    const q = QUESTIONS[step];
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {QUESTIONS.map((_, i) => (
              <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i <= step ? "#b8860b" : "#e2e8f0" }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            {step + 1} of {QUESTIONS.length}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px 0", lineHeight: 1.25 }}>
              {q.prompt}
            </h4>
            <p style={{ fontSize: 13, color: "#64748b", fontStyle: "italic", margin: "0 0 18px 0", lineHeight: 1.4 }}>
              {q.why}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  style={optionBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#b8860b"; e.currentTarget.style.background = "#fffbeb"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "white"; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ marginTop: 14, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
          >
            ← Back
          </button>
        )}
      </motion.div>
    );
  }

  // ── Verdict (deterministic, free) ──────────────────────────────
  if (stage === "verdict" && verdict) {
    const bandColor = verdict.goNoGo === "GO" ? "#0d6e3a" : verdict.goNoGo === "WAIT" ? "#b8860b" : "#a02020";
    const bandBg = verdict.goNoGo === "GO" ? "#e8f5ec" : verdict.goNoGo === "WAIT" ? "#fef3c7" : "#fee2e2";
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={{ background: bandBg, border: `2px solid ${bandColor}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: bandColor, textTransform: "uppercase", marginBottom: 6 }}>
            Verdict · Score {verdict.score}/15 · {verdict.goNoGo}
          </div>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px 0", lineHeight: 1.2 }}>
            {verdict.headline}
          </h3>
          <p style={{ fontSize: 14, color: "#1f2937", margin: 0, lineHeight: 1.5 }}>
            {verdict.oneLiner}
          </p>
        </div>

        <div style={{ background: "#0f172a", color: "white", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} color="#fbbf24" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#fbbf24", textTransform: "uppercase" }}>
              Pro · Personalized Autopsy
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#e2e8f0", margin: "0 0 12px 0", lineHeight: 1.5 }}>
            Get the brutal autopsy of your idea — what kills founders like you, what saves them, your unfair edge, and a 30-60-90 day kill-criteria plan. Grounded in your role, CTC, and scan.
          </p>
          <button onClick={unlockAutopsy} style={proBtnStyle}>
            {isPro ? <>Generate my autopsy <ChevronRight size={16} /></> : <><Lock size={14} /> Unlock with Pro</>}
          </button>
        </div>

        <button onClick={reset} style={{ marginTop: 12, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
          ← Retake quiz
        </button>

        {showProModal && (
          <ProUpgradeModal
            isOpen={showProModal}
            onClose={() => setShowProModal(false)}
            featureName="Personalized Founder Autopsy"
          />
        )}
      </motion.div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <motion.div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "#b8860b", margin: "0 auto 12px", display: "block" }} />
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>Generating your personalized autopsy…</p>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0 0" }}>Cross-referencing your resume, role, CTC, and quiz answers.</p>
      </motion.div>
    );
  }

  // ── Autopsy (Pro, AI-generated) ────────────────────────────────
  if (stage === "autopsy" && autopsy && verdict) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#b8860b", textTransform: "uppercase", marginBottom: 8 }}>
          Founder Autopsy · {verdict.band.replace(/_/g, " ")}
        </div>

        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontStyle: "italic", color: "#1a1a1a", lineHeight: 1.5, margin: "0 0 20px 0", borderLeft: "3px solid #b8860b", paddingLeft: 14 }}>
          {autopsy.verdict_paragraph}
        </p>

        <Section icon={<AlertTriangle size={16} color="#a02020" />} title="What kills founders like you" items={autopsy.what_kills_you} accent="#a02020" />
        <Section icon={<Target size={16} color="#0d6e3a" />} title="What saves you (next 90 days)" items={autopsy.what_saves_you} accent="#0d6e3a" />

        <div style={subSectionStyle}>
          <div style={subSectionLabelStyle}><Sparkles size={14} color="#b8860b" /> Your unfair edge</div>
          <p style={subSectionTextStyle}>{autopsy.your_unfair_edge}</p>
        </div>

        <div style={{ ...subSectionStyle, background: "#f8fafc" }}>
          <div style={subSectionLabelStyle}><Calendar size={14} color="#1f3a52" /> 30-60-90 plan</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <Pill day="30" text={autopsy.the_30_60_90.next_30_days} />
            <Pill day="60" text={autopsy.the_30_60_90.next_60_days} />
            <Pill day="90" text={autopsy.the_30_60_90.next_90_days} highlight />
          </div>
        </div>

        <div style={{ background: "#1a0a0a", color: "#fca5a5", borderRadius: 10, padding: "14px 16px", marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#fbbf24", textTransform: "uppercase", marginBottom: 6 }}>
            If you ignore this
          </div>
          <p style={{ fontSize: 14, color: "#fee2e2", margin: 0, lineHeight: 1.5 }}>{autopsy.if_you_ignore_this}</p>
        </div>

        <button onClick={reset} style={{ marginTop: 14, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
          ← Retake quiz
        </button>
      </motion.div>
    );
  }

  return null;
}

function Section({ icon, title, items, accent }: { icon: React.ReactNode; title: string; items: string[]; accent: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: accent, textTransform: "uppercase" }}>{title}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 14, color: "#1f2937", lineHeight: 1.5, paddingLeft: 18, position: "relative", marginBottom: 6 }}>
            <span style={{ position: "absolute", left: 0, top: 0, color: accent, fontWeight: 700 }}>›</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pill({ day, text, highlight }: { day: string; text: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "white", borderRadius: 8, padding: "10px 12px", border: highlight ? "2px solid #a02020" : "1px solid #e2e8f0" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: highlight ? "#a02020" : "#1f3a52", lineHeight: 1, minWidth: 28 }}>{day}</div>
      <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.45, flex: 1 }}>
        {highlight && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#a02020", textTransform: "uppercase", marginBottom: 2 }}>Kill-criteria</div>}
        {text}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const teaserStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
  border: "2px solid #b8860b",
  borderLeft: "5px solid #b8860b",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 16,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "2px solid #b8860b",
  borderLeft: "5px solid #b8860b",
  borderRadius: 14,
  padding: "20px 22px",
  marginBottom: 16,
};

const iconBoxStyle: React.CSSProperties = {
  background: "white",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
};

const ctaBtnStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const optionBtnStyle: React.CSSProperties = {
  textAlign: "left",
  background: "white",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  color: "#1f2937",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.15s ease",
  fontFamily: "inherit",
};

const proBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #fbbf24 0%, #b8860b 100%)",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const subSectionStyle: React.CSSProperties = {
  background: "#fffbeb",
  borderRadius: 10,
  padding: "12px 14px",
  marginBottom: 12,
};

const subSectionLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "#1f3a52",
  textTransform: "uppercase",
  marginBottom: 4,
};

const subSectionTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#1f2937",
  lineHeight: 1.5,
  margin: 0,
};
