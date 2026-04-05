import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const CORP_NAMES = ["Google", "Amazon", "Accenture", "Deloitte", "Infosys"];
const STARTUP_NAMES = ["Splink", "LiveSmart", "Blaze", "NeuralHire", "SkillForge"];

export default function ResultsChoose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");
  const [userId, setUserId] = useState<string | null>(null);

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
            Analysis complete — pick your lens
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

        {/* Cards */}
        <div className="ab-cards-row" style={{ display: "flex", gap: 20, alignItems: "stretch" }}>

          {/* TEAM A */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="ab-card-a"
            style={{
              flex: 1, borderRadius: 20, padding: 30,
              display: "flex", flexDirection: "column",
              background: "#FAFAFA",
              border: "2px solid #E5E5E5",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#111"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E5E5"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>🏛️</div>

            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#999", marginBottom: 4 }}>
              TEAM A
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#111", marginBottom: 10, lineHeight: 1.2 }}>
              The Stability Model
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 20, marginTop: 0 }}>
              Built by senior professionals from <strong style={{ color: "#111" }}>India's largest companies</strong>.
              They focus on what you should <strong style={{ color: "#111" }}>protect</strong> — your salary, your seniority, your trajectory.
            </p>

            {/* Expert pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
              {CORP_NAMES.map((n) => (
                <span key={n} style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "#F3F4F6", color: "#374151", fontFamily: "'DM Sans', sans-serif",
                }}>
                  {n}
                </span>
              ))}
            </div>

            {/* Checklist */}
            <div style={{ marginBottom: 24 }}>
              {["Risk mitigation playbook", "Salary preservation strategy", "Industry-benchmarked scoring"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>✓</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#333" }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto" }}>
              <button
                onClick={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
                  cursor: "pointer", border: "2px solid #111",
                  background: "#FFF", color: "#111", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#111"; e.currentTarget.style.color = "#FFF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#111"; }}
              >
                See conservative analysis →
              </button>
            </div>
          </motion.div>

          {/* VS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 2px", minWidth: 36 }}>
            <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom, transparent, #E5E5E5, transparent)" }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 900,
              color: "#CCC", padding: "8px 0", letterSpacing: "0.1em",
            }}>VS</span>
            <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom, transparent, #E5E5E5, transparent)" }} />
          </div>

          {/* TEAM B */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{
              flex: 1, borderRadius: 20, padding: 30,
              display: "flex", flexDirection: "column",
              background: "linear-gradient(160deg, #EEF2FF, #F5F3FF)",
              border: "2px solid #818CF8",
              boxShadow: "0 4px 24px rgba(99,102,241,0.1)",
              position: "relative", overflow: "hidden",
              transition: "box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(99,102,241,0.1)"; }}
          >
            {/* Badge */}
            <div style={{
              position: "absolute", top: 16, right: 16,
              background: "#4F46E5", borderRadius: 100, padding: "4px 14px",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800,
              color: "#FFF", letterSpacing: "0.04em", textTransform: "uppercase" as const,
            }}>
              ⚡ Most picked
            </div>

            <div style={{ fontSize: 32, marginBottom: 16 }}>🚀</div>

            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#6366F1", marginBottom: 4 }}>
              TEAM B
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#111", marginBottom: 10, lineHeight: 1.2 }}>
              The Growth Model
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 20, marginTop: 0 }}>
              Built by <strong style={{ color: "#4338CA" }}>startup disruptors</strong> who know what works in 2026.
              They don't just protect — they show you how to <strong style={{ color: "#4338CA" }}>attack</strong>.
            </p>

            {/* Expert pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
              {STARTUP_NAMES.map((n) => (
                <span key={n} style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8,
                  background: "rgba(99,102,241,0.1)", color: "#4338CA", fontFamily: "'DM Sans', sans-serif",
                }}>
                  {n}
                </span>
              ))}
            </div>

            {/* Checklist */}
            <div style={{ marginBottom: 24 }}>
              {["Live ATS scoring & optimization", "₹ salary negotiation anchors", "Pivot paths with real job matches"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ color: "#4F46E5", fontSize: 16 }}>✓</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#333" }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto" }}>
              <button
                onClick={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
                  cursor: "pointer", border: "none",
                  background: "#4F46E5", color: "#FFF",
                  boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#4338CA"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(79,70,229,0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4F46E5"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,70,229,0.3)"; }}
              >
                See aggressive analysis →
              </button>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#999",
            textAlign: "center", marginTop: 32, lineHeight: 1.6,
          }}
        >
          Switch between models anytime. Both use the same resume. Zero mock data.
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
