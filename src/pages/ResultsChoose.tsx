import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Rocket, ArrowRight, RotateCcw, Zap, TrendingUp, Lock, Target } from "lucide-react";

export default function ResultsChoose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");
  const [userId, setUserId] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<"a" | "b" | null>(null);

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
    <div style={{ background: "#09090B", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Ambient glow effects */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%", width: "50%", height: "60%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "-20%", right: "-10%", width: "50%", height: "60%",
        background: "radial-gradient(ellipse, rgba(234,179,8,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "0", left: "30%", width: "40%", height: "40%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px 64px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 56 }}
        >
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#FAFAFA" }}>
            JobBachao
          </span>
          <motion.span
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
              color: "#4ADE80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 100, padding: "6px 16px", display: "inline-flex", alignItems: "center", gap: 8,
              letterSpacing: "0.05em", textTransform: "uppercase" as const,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 8px #4ADE80" }} />
            Analysis Complete
          </motion.span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: 16 }}
        >
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 900,
            color: "#FAFAFA", lineHeight: 1.15, margin: 0,
          }}>
            Two reports.{" "}
            <span style={{
              background: "linear-gradient(135deg, #818CF8, #6366F1, #A78BFA)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              One resume.
            </span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#71717A",
            lineHeight: 1.7, margin: "0 auto 48px", maxWidth: 480, textAlign: "center",
          }}
        >
          Start with either — explore the other anytime. Both powered by the same AI analysis of your resume.
        </motion.p>

        {/* Cards */}
        <div className="ab-cards-row" style={{ display: "flex", gap: 20, alignItems: "stretch" }}>

          {/* REPORT A — Risk Diagnosis */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, type: "spring", damping: 20 }}
            className="ab-card"
            onClick={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
            onMouseEnter={() => setHoveredCard("a")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              flex: 1, borderRadius: 20, padding: "32px 28px",
              display: "flex", flexDirection: "column",
              background: hoveredCard === "a"
                ? "linear-gradient(165deg, rgba(39,39,42,0.95), rgba(24,24,27,0.98))"
                : "rgba(24,24,27,0.6)",
              border: hoveredCard === "a" ? "1.5px solid rgba(161,161,170,0.3)" : "1.5px solid rgba(63,63,70,0.5)",
              cursor: "pointer",
              transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              transform: hoveredCard === "a" ? "translateY(-4px)" : "translateY(0)",
              boxShadow: hoveredCard === "a"
                ? "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(161,161,170,0.1)"
                : "0 4px 20px rgba(0,0,0,0.2)",
              backdropFilter: "blur(20px)",
              position: "relative", overflow: "hidden",
            }}
          >
            {/* Accent gradient bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, #A1A1AA, #D4D4D8, #A1A1AA)",
              opacity: hoveredCard === "a" ? 1 : 0.3,
              transition: "opacity 0.3s",
            }} />

            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, rgba(161,161,170,0.15), rgba(161,161,170,0.05))",
              border: "1px solid rgba(161,161,170,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Shield size={22} color="#A1A1AA" />
            </div>

            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase" as const,
              color: "#71717A", marginBottom: 6,
            }}>
              Report A
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900,
              color: "#FAFAFA", marginBottom: 12, lineHeight: 1.2,
            }}>
              Risk Diagnosis
            </div>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#71717A",
              lineHeight: 1.7, margin: "0 0 22px",
            }}>
              What to <strong style={{ color: "#A1A1AA" }}>protect</strong> — your salary, seniority, and career trajectory under AI disruption.
            </p>

            {/* Features */}
            <div style={{ marginBottom: 24, flex: 1 }}>
              {[
                { icon: <Target size={13} />, text: "Career Safety Score & risk breakdown" },
                { icon: <Zap size={13} />, text: "AI Impact Dossier with skill analysis" },
                { icon: <Shield size={13} />, text: "90-day defense plan with resources" },
                { icon: <Lock size={13} />, text: "Salary preservation strategy" },
              ].map((f) => (
                <div key={f.text} style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                  padding: "6px 0",
                }}>
                  <span style={{ color: "#52525B", flexShrink: 0 }}>{f.icon}</span>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500,
                    color: "#A1A1AA", lineHeight: 1.4,
                  }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 0", borderRadius: 12,
              background: hoveredCard === "a"
                ? "linear-gradient(135deg, #FAFAFA, #E4E4E7)"
                : "rgba(63,63,70,0.3)",
              color: hoveredCard === "a" ? "#09090B" : "#A1A1AA",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
              transition: "all 0.3s",
              border: hoveredCard === "a" ? "none" : "1px solid rgba(63,63,70,0.5)",
            }}>
              Start with Risk Diagnosis <ArrowRight size={14} />
            </div>
          </motion.div>

          {/* Divider */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "0 4px", minWidth: 40,
          }}>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, transparent, rgba(63,63,70,0.5), transparent)" }} />
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
              color: "#3F3F46", padding: "10px 0", letterSpacing: "0.15em",
            }}>OR</span>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, transparent, rgba(63,63,70,0.5), transparent)" }} />
          </div>

          {/* REPORT B — Growth Playbook */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: "spring", damping: 20 }}
            className="ab-card"
            onClick={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
            onMouseEnter={() => setHoveredCard("b")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              flex: 1, borderRadius: 20, padding: "32px 28px",
              display: "flex", flexDirection: "column",
              background: hoveredCard === "b"
                ? "linear-gradient(165deg, rgba(49,46,89,0.6), rgba(24,24,27,0.98))"
                : "rgba(24,24,27,0.6)",
              border: hoveredCard === "b" ? "1.5px solid rgba(129,140,248,0.4)" : "1.5px solid rgba(63,63,70,0.5)",
              cursor: "pointer",
              transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              transform: hoveredCard === "b" ? "translateY(-4px)" : "translateY(0)",
              boxShadow: hoveredCard === "b"
                ? "0 20px 60px rgba(99,102,241,0.15), 0 0 0 1px rgba(129,140,248,0.1)"
                : "0 4px 20px rgba(0,0,0,0.2)",
              backdropFilter: "blur(20px)",
              position: "relative", overflow: "hidden",
            }}
          >
            {/* Accent gradient bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, #6366F1, #818CF8, #A78BFA)",
              opacity: hoveredCard === "b" ? 1 : 0.3,
              transition: "opacity 0.3s",
            }} />

            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))",
              border: "1px solid rgba(99,102,241,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Rocket size={22} color="#818CF8" />
            </div>

            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase" as const,
              color: "#6366F1", marginBottom: 6,
            }}>
              Report B
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900,
              color: "#FAFAFA", marginBottom: 12, lineHeight: 1.2,
            }}>
              Growth Playbook
            </div>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#71717A",
              lineHeight: 1.7, margin: "0 0 22px",
            }}>
              How to <strong style={{ color: "#818CF8" }}>attack</strong> — salary growth, market pivots, and ATS-optimized positioning.
            </p>

            {/* Features */}
            <div style={{ marginBottom: 24, flex: 1 }}>
              {[
                { icon: <Zap size={13} />, text: "Live ATS scoring & resume optimization" },
                { icon: <TrendingUp size={13} />, text: "Salary negotiation anchors with scripts" },
                { icon: <Rocket size={13} />, text: "Pivot paths with real job matches" },
                { icon: <Target size={13} />, text: "Market radar & growth playbook" },
              ].map((f) => (
                <div key={f.text} style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                  padding: "6px 0",
                }}>
                  <span style={{ color: "#6366F1", flexShrink: 0 }}>{f.icon}</span>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500,
                    color: "#A1A1AA", lineHeight: 1.4,
                  }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 0", borderRadius: 12,
              background: hoveredCard === "b"
                ? "linear-gradient(135deg, #6366F1, #4F46E5)"
                : "rgba(63,63,70,0.3)",
              color: hoveredCard === "b" ? "#FFF" : "#818CF8",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
              transition: "all 0.3s",
              border: hoveredCard === "b" ? "none" : "1px solid rgba(99,102,241,0.2)",
              boxShadow: hoveredCard === "b" ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
            }}>
              Start with Growth Playbook <ArrowRight size={14} />
            </div>
          </motion.div>
        </div>

        {/* Footer reassurance */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginTop: 36, padding: "14px 0",
          }}
        >
          <RotateCcw size={12} color="#52525B" />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#52525B", fontWeight: 500,
          }}>
            Switch to the other report anytime — no data is lost
          </span>
        </motion.div>
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
            height: 1px !important; width: auto !important; flex: 1 !important;
            background: linear-gradient(to right, transparent, rgba(63,63,70,0.5), transparent) !important;
          }
        }
      `}</style>
    </div>
  );
}
