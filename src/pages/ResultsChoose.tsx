import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const CORP_LOGOS = ["Google", "Amazon", "Accenture", "Deloitte", "Infosys"];
const STARTUP_LOGOS = ["Splink", "LiveSmart", "Blaze", "NeuralHire", "SkillForge"];

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
    <div style={{ background: "#0A0A0A", minHeight: "100vh", overflow: "hidden" }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", top: "-30%", left: "20%", width: "60%", height: "60%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "56px 24px 40px" }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#FAFAFA", marginBottom: 56 }}
        >
          JobBachao
        </motion.div>

        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 100, padding: "6px 16px", marginBottom: 20,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#A1A1AA", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            TWO EXPERT TEAMS · ONE RESUME · ZERO BIAS
          </span>
        </motion.div>

        {/* Hero headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{
            fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 900, color: "#FAFAFA", lineHeight: 1.15,
            marginBottom: 16, marginTop: 0, maxWidth: 700,
          }}
        >
          We gave your resume to{" "}
          <span style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            two rival teams.
          </span>
          <br />They disagree.
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#A1A1AA",
            lineHeight: 1.7, marginBottom: 48, marginTop: 0, maxWidth: 620,
          }}
        >
          One team from <strong style={{ color: "#D4D4D8" }}>Google, Amazon, Accenture</strong> — corporate veterans who've seen 10,000 layoffs.
          The other from <strong style={{ color: "#D4D4D8" }}>Splink, LiveSmart, Blaze</strong> — startup builders who know what actually gets you hired in 2026.
          <br /><br />
          Both got the same data. Both had complete freedom. Their conclusions?{" "}
          <strong style={{ color: "#FAFAFA" }}>Completely different.</strong>
        </motion.p>

        {/* Cards */}
        <div className="ab-cards-row" style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          {/* Team A */}
          <motion.div
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            onMouseEnter={() => setHoveredCard("a")} onMouseLeave={() => setHoveredCard(null)}
            style={{
              flex: 1, borderRadius: 20, padding: 32,
              display: "flex", flexDirection: "column",
              background: hoveredCard === "a"
                ? "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
                : "rgba(255,255,255,0.03)",
              border: hoveredCard === "a" ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onClick={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
          >
            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #374151, #1F2937)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20, fontSize: 22,
            }}>
              🏛️
            </div>

            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6B7280", marginBottom: 6 }}>
              TEAM A
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: "#FAFAFA", marginBottom: 8, lineHeight: 1.2 }}>
              The Stability Model
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 20, marginTop: 0 }}>
              Built by veterans from <strong style={{ color: "#D4D4D8" }}>India's biggest companies</strong>. 
              They focus on what you should <em>protect</em> — your salary, your seniority, your trajectory.
            </p>

            {/* Company pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
              {CORP_LOGOS.map((name) => (
                <span key={name} style={{
                  fontSize: 10, padding: "4px 10px", borderRadius: 6,
                  background: "rgba(255,255,255,0.05)", color: "#6B7280",
                  fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.03em",
                }}>
                  {name}
                </span>
              ))}
            </div>

            {/* What you get */}
            <div style={{ marginBottom: 24 }}>
              {["Risk mitigation playbook", "Salary preservation strategy", "Industry-benchmarked scoring"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#6B7280", fontSize: 14 }}>→</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9CA3AF" }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto" }}>
              <button
                onClick={(e) => { e.stopPropagation(); logAndNavigate("model_a_chosen", `/?id=${analysisId}`); }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent", color: "#FAFAFA",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                See the conservative view →
              </button>
            </div>
          </motion.div>

          {/* Divider */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 4px" }}>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
              color: "#6B7280", background: "#0A0A0A", padding: "6px 0",
              letterSpacing: "0.1em",
            }}>VS</span>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
          </div>

          {/* Team B */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
            onMouseEnter={() => setHoveredCard("b")} onMouseLeave={() => setHoveredCard(null)}
            style={{
              flex: 1, borderRadius: 20, padding: 32,
              display: "flex", flexDirection: "column",
              background: hoveredCard === "b"
                ? "linear-gradient(145deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))"
                : "linear-gradient(145deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))",
              border: hoveredCard === "b" ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(99,102,241,0.2)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
          >
            {/* Popular badge */}
            <div style={{
              position: "absolute", top: 16, right: 16,
              background: "linear-gradient(135deg, #6366F1, #818CF8)",
              borderRadius: 100, padding: "4px 12px",
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
              color: "white", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              ⚡ Most chosen
            </div>

            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #4F46E5, #6366F1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20, fontSize: 22,
            }}>
              🚀
            </div>

            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#818CF8", marginBottom: 6 }}>
              TEAM B
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: "#FAFAFA", marginBottom: 8, lineHeight: 1.2 }}>
              The Growth Model
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 20, marginTop: 0 }}>
              Built by <strong style={{ color: "#C7D2FE" }}>startup disruptors</strong> obsessed with what actually gets people hired <em>right now</em>.
              They don't protect — they <strong style={{ color: "#C7D2FE" }}>attack</strong>.
            </p>

            {/* Company pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
              {STARTUP_LOGOS.map((name) => (
                <span key={name} style={{
                  fontSize: 10, padding: "4px 10px", borderRadius: 6,
                  background: "rgba(99,102,241,0.1)", color: "#818CF8",
                  fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.03em",
                }}>
                  {name}
                </span>
              ))}
            </div>

            {/* What you get */}
            <div style={{ marginBottom: 24 }}>
              {["Live ATS scoring & optimization", "₹ salary negotiation anchors", "Pivot paths with job matches"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#818CF8", fontSize: 14 }}>→</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C7D2FE" }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto" }}>
              <button
                onClick={(e) => { e.stopPropagation(); logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`); }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                  color: "white", transition: "all 0.2s",
                  boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(99,102,241,0.3)"; }}
              >
                See the aggressive view →
              </button>
            </div>
          </motion.div>
        </div>

        {/* Trust footer */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ textAlign: "center", marginTop: 36 }}
        >
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#52525B",
            marginBottom: 4,
          }}>
            You can switch between models at any time. Both use the same resume data.
          </p>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#3F3F46",
          }}>
            No mock data. No templates. Every insight is generated fresh from your resume.
          </p>
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
          }
          .ab-cards-row > div:nth-child(2) > div:first-child,
          .ab-cards-row > div:nth-child(2) > div:last-child {
            height: 1px !important;
            width: auto !important;
            flex: 1 !important;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent) !important;
          }
        }
      `}</style>
    </div>
  );
}
