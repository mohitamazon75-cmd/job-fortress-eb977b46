import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Zap, Shield, Rocket, Check, ArrowRight } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";

const CORP_NAMES = ["Google", "Amazon", "Accenture", "Deloitte", "Infosys"];
const STARTUP_NAMES = ["Splink", "LiveSmart", "Blaze", "NeuralHire", "SkillForge"];

export default function ResultsChoose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");
  const [userId, setUserId] = useState<string | null>(null);
  const { isActive, loading: subLoading } = useSubscription();

  useEffect(() => {
    if (!analysisId) { navigate("/", { replace: true }); return; }
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id || null;
      setUserId(uid);
      supabase.functions.invoke("log-ab-event", {
        body: { analysis_id: analysisId, user_id: uid, event_type: "choice_shown" },
      });
    });
  }, [analysisId, navigate]);

  const logAndNavigate = async (eventType: string, path: string) => {
    await supabase.functions.invoke("log-ab-event", {
      body: { analysis_id: analysisId, user_id: userId, event_type: eventType },
    });
    navigate(path);
  };

  if (!analysisId) return null;

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "52px 24px 48px" }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#111" }}
        >
          JobBachao
        </motion.div>

        <div style={{ height: 52 }} />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#F0FDF4", border: "1.5px solid #BBF7D0",
            borderRadius: 100, padding: "5px 16px", marginBottom: 22,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#15803D", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Analysis complete — {isActive ? "pick your lens" : "unlock your reports"}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(30px, 4.5vw, 46px)", fontWeight: 900,
            color: "#111", lineHeight: 1.18, marginBottom: 18, marginTop: 0,
          }}
        >
          Two rival teams read your resume.
          <br />
          <span style={{ color: "#4F46E5" }}>They don't agree.</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 17, color: "#444",
            lineHeight: 1.75, marginBottom: 44, marginTop: 0, maxWidth: 640,
          }}
        >
          One team from <strong style={{ color: "#111" }}>Google, Amazon, Accenture</strong> — corporate veterans who've survived 10,000 layoffs.
          {" "}The other from <strong style={{ color: "#111" }}>Splink, LiveSmart, Blaze</strong> — startup builders who know what gets you hired <em>today</em>.
          <br /><br />
          Same data. Complete freedom. <strong style={{ color: "#111" }}>Very different answers.</strong>
        </motion.p>

        {/* ══════ Unified "Pay once, unlock both" banner for free users ══════ */}
        <AnimatePresence>
          {!subLoading && !isActive && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.2 }}
              style={{
                background: "linear-gradient(135deg, #EEF2FF 0%, #FDF2F8 100%)",
                border: "2px solid #C7D2FE",
                borderRadius: 16,
                padding: "20px 24px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Zap size={22} color="#FFF" />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800,
                  color: "#111", marginBottom: 2,
                }}>
                  One payment. Both reports unlock instantly.
                </div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666",
                  lineHeight: 1.5,
                }}>
                  Get the full Conservative <strong>+</strong> Aggressive analysis — ₹300/month (₹10/day)
                </div>
              </div>
              <button
                onClick={() => navigate("/pricing")}
                style={{
                  padding: "12px 28px", borderRadius: 12,
                  background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                  color: "#FFF", border: "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(79,70,229,0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,70,229,0.3)"; }}
              >
                Unlock Both Reports →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div className="ab-cards-row" style={{ display: "flex", gap: 20, alignItems: "stretch" }}>

          {/* TEAM A — Conservative / Stability */}
          <ReportCard
            locked={!isActive && !subLoading}
            loading={subLoading}
            team="A"
            icon="🏛️"
            teamColor="#999"
            title="The Stability Model"
            subtitle="Conservative Analysis"
            description={<>Built by senior professionals from <strong style={{ color: "#111" }}>India's largest companies</strong>. They focus on what you should <strong style={{ color: "#111" }}>protect</strong> — your salary, your seniority, your trajectory.</>}
            pills={CORP_NAMES}
            pillBg="#F3F4F6"
            pillColor="#374151"
            checklist={["Risk mitigation playbook", "Salary preservation strategy", "Industry-benchmarked scoring"]}
            checkColor="#111"
            buttonLabel="See conservative analysis"
            buttonStyle="outline"
            onNavigate={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
            onUnlock={() => navigate("/pricing")}
            LockIcon={Shield}
          />

          {/* VS divider */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 2px", minWidth: 36 }}>
            <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom, transparent, #E5E5E5, transparent)" }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 900,
              color: "#CCC", padding: "8px 0", letterSpacing: "0.1em",
            }}>VS</span>
            <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom, transparent, #E5E5E5, transparent)" }} />
          </div>

          {/* TEAM B — Aggressive / Growth */}
          <ReportCard
            locked={!isActive && !subLoading}
            loading={subLoading}
            team="B"
            icon="🚀"
            teamColor="#6366F1"
            title="The Growth Model"
            subtitle="Aggressive Analysis"
            description={<>Built by <strong style={{ color: "#4338CA" }}>startup disruptors</strong> who know what works in 2026. They don't just protect — they show you how to <strong style={{ color: "#4338CA" }}>attack</strong>.</>}
            pills={STARTUP_NAMES}
            pillBg="rgba(99,102,241,0.1)"
            pillColor="#4338CA"
            checklist={["Live ATS scoring & optimization", "₹ salary negotiation anchors", "Pivot paths with real job matches"]}
            checkColor="#4F46E5"
            buttonLabel="See aggressive analysis"
            buttonStyle="filled"
            onNavigate={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
            onUnlock={() => navigate("/pricing")}
            LockIcon={Rocket}
          />
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#999",
            textAlign: "center", marginTop: 32, lineHeight: 1.6,
          }}
        >
          {isActive
            ? "Switch between models anytime. Both use the same resume. Zero mock data."
            : "Both reports are included in a single Pro plan. No hidden charges."}
        </motion.p>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .ab-cards-row {
            flex-direction: column !important;
          }
          .ab-cards-row > div:nth-child(2) {
            flex-direction: row !important;
            padding: 0 !important;
            min-width: unset !important;
          }
          .ab-cards-row > div:nth-child(2) > div:first-child,
          .ab-cards-row > div:nth-child(2) > div:last-child {
            height: 2px !important; width: auto !important; flex: 1 !important;
            background: linear-gradient(to right, transparent, #E5E5E5, transparent) !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ReportCard — unified card for both locked & unlocked
   ═══════════════════════════════════════════════════════ */

interface ReportCardProps {
  locked: boolean;
  loading: boolean;
  team: "A" | "B";
  icon: string;
  teamColor: string;
  title: string;
  subtitle: string;
  description: React.ReactNode;
  pills: string[];
  pillBg: string;
  pillColor: string;
  checklist: string[];
  checkColor: string;
  buttonLabel: string;
  buttonStyle: "outline" | "filled";
  onNavigate: () => void;
  onUnlock: () => void;
  LockIcon: React.ComponentType<{ size?: number; color?: string }>;
}

function ReportCard({
  locked, loading, team, icon, teamColor, title, subtitle,
  description, pills, pillBg, pillColor, checklist, checkColor,
  buttonLabel, buttonStyle, onNavigate, onUnlock, LockIcon,
}: ReportCardProps) {
  const isTeamB = team === "B";
  const cardBg = isTeamB
    ? "linear-gradient(160deg, #EEF2FF, #F5F3FF)"
    : "#FAFAFA";
  const borderColor = isTeamB ? "#818CF8" : "#E5E5E5";
  const hoverShadow = isTeamB
    ? "0 12px 40px rgba(99,102,241,0.18)"
    : "0 8px 30px rgba(0,0,0,0.08)";
  const restShadow = isTeamB
    ? "0 4px 24px rgba(99,102,241,0.1)"
    : "none";

  // Skeleton while subscription status loads
  if (loading) {
    return (
      <div style={{
        flex: 1, borderRadius: 20, padding: 30,
        background: "#F9FAFB", border: "2px solid #E5E5E5",
      }}>
        <div style={{ height: 180 }} className="animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: isTeamB ? 0.3 : 0.25 }}
      style={{
        flex: 1, borderRadius: 20, padding: 30,
        display: "flex", flexDirection: "column",
        background: cardBg,
        border: `2px solid ${locked ? "#D1D5DB" : borderColor}`,
        boxShadow: locked ? "none" : restShadow,
        position: "relative", overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s",
        ...(locked ? { opacity: 1 } : {}),
      }}
      onMouseEnter={(e) => {
        if (!locked) {
          e.currentTarget.style.borderColor = isTeamB ? "#818CF8" : "#111";
          e.currentTarget.style.boxShadow = hoverShadow;
        }
      }}
      onMouseLeave={(e) => {
        if (!locked) {
          e.currentTarget.style.borderColor = borderColor;
          e.currentTarget.style.boxShadow = restShadow;
        }
      }}
    >
      {/* Locked overlay with blur */}
      {locked && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(4px)",
          borderRadius: 18,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: isTeamB
              ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
              : "linear-gradient(135deg, #111, #374151)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}>
            <Lock size={26} color="#FFF" />
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800,
            color: "#111", marginBottom: 6, textAlign: "center",
          }}>
            {subtitle}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666",
            marginBottom: 20, textAlign: "center", maxWidth: 220, lineHeight: 1.5,
          }}>
            Included in your Pro plan — unlock with a single payment
          </div>
          <button
            onClick={onUnlock}
            style={{
              padding: "11px 24px", borderRadius: 10,
              background: isTeamB
                ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
                : "#111",
              color: "#FFF", border: "none",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <Unlock size={14} /> Unlock Report
          </button>
        </div>
      )}

      {/* Card content (visible blurred behind overlay for locked state) */}
      <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>

      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800,
        letterSpacing: "0.14em", textTransform: "uppercase" as const,
        color: teamColor, marginBottom: 4,
      }}>
        TEAM {team}
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900,
        color: "#111", marginBottom: 10, lineHeight: 1.2,
      }}>
        {title}
      </div>
      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#555",
        lineHeight: 1.7, marginBottom: 20, marginTop: 0,
      }}>
        {description}
      </p>

      {/* Expert pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
        {pills.map((n) => (
          <span key={n} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
            background: pillBg, color: pillColor,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {n}
          </span>
        ))}
      </div>

      {/* Checklist */}
      <div style={{ marginBottom: 24 }}>
        {checklist.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Check size={16} color={checkColor} strokeWidth={2.5} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#333",
            }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      {/* CTA button — only clickable when unlocked */}
      <div style={{ marginTop: "auto" }}>
        {locked ? (
          <div style={{
            width: "100%", padding: "14px 0", borderRadius: 12,
            background: "#F3F4F6", textAlign: "center",
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
            color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Lock size={14} /> Locked — Pro required
          </div>
        ) : buttonStyle === "outline" ? (
          <button
            onClick={onNavigate}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
              cursor: "pointer", border: "2px solid #111",
              background: "#FFF", color: "#111", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#111"; e.currentTarget.style.color = "#FFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#111"; }}
          >
            {buttonLabel} <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={onNavigate}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
              cursor: "pointer", border: "none",
              background: "#4F46E5", color: "#FFF",
              boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#4338CA"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(79,70,229,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4F46E5"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,70,229,0.3)"; }}
          >
            {buttonLabel} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
