import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Rocket, ArrowRight, RotateCcw } from "lucide-react";

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

  const teamAFeatures = [
    { text: "Career Safety Score & risk breakdown", highlight: false },
    { text: "AI Impact Dossier with skill analysis", highlight: false },
    { text: "90-day defense plan with resources", highlight: false },
    { text: "Salary preservation strategy", highlight: false },
  ];

  const teamBFeatures = [
    { text: "Live ATS scoring & resume optimization", highlight: false },
    { text: "Salary negotiation anchors with scripts", highlight: false },
    { text: "Pivot paths with real job matches", highlight: false },
    { text: "Market radar & growth playbook", highlight: false },
  ];

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 64px" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}
        >
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#111" }}>
            JobBachao
          </span>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
            color: "#22C55E", background: "#F0FDF4", border: "1.5px solid #BBF7D0",
            borderRadius: 100, padding: "5px 14px", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
            Analysis ready
          </span>
        </motion.div>

        {/* Headline — neutral, no bias */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{ marginBottom: 12 }}
        >
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900,
            color: "#111", lineHeight: 1.2, margin: 0,
          }}>
            Your resume. Two expert lenses.
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#666",
            lineHeight: 1.7, margin: "0 0 40px", maxWidth: 560,
          }}
        >
          Start with either report — you can always come back and explore the other.
          Both use the same data from your resume.
        </motion.p>

        {/* Cards — equal weight, no bias */}
        <div className="ab-cards-row" style={{ display: "flex", gap: 16, alignItems: "stretch" }}>

          {/* REPORT A */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="ab-card"
            onClick={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
            style={{
              flex: 1, borderRadius: 16, padding: "28px 24px",
              display: "flex", flexDirection: "column",
              background: "#FAFAFA", border: "1.5px solid #E5E7EB",
              cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#111";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Icon + Label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={20} color="#374151" />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9CA3AF" }}>
                  Report A
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#111", lineHeight: 1.2 }}>
                  Risk Diagnosis
                </div>
              </div>
            </div>

            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666",
              lineHeight: 1.65, margin: "0 0 18px",
            }}>
              Conservative analysis focused on protecting your current position, salary, and career trajectory.
            </p>

            {/* Features */}
            <div style={{ marginBottom: 20, flex: 1 }}>
              {teamAFeatures.map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#9CA3AF", fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500, color: "#444", lineHeight: 1.5 }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 10,
              border: "1.5px solid #D1D5DB", background: "#FFF",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#111",
              transition: "all 0.15s",
            }}>
              Start with Risk Diagnosis <ArrowRight size={14} />
            </div>
          </motion.div>

          {/* REPORT B */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="ab-card"
            onClick={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
            style={{
              flex: 1, borderRadius: 16, padding: "28px 24px",
              display: "flex", flexDirection: "column",
              background: "#FAFAFA", border: "1.5px solid #E5E7EB",
              cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#4F46E5";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(79,70,229,0.12)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Icon + Label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "#EEF2FF",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Rocket size={20} color="#4F46E5" />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9CA3AF" }}>
                  Report B
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#111", lineHeight: 1.2 }}>
                  Growth Playbook
                </div>
              </div>
            </div>

            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666",
              lineHeight: 1.65, margin: "0 0 18px",
            }}>
              Aggressive analysis focused on market opportunities, salary growth, and career pivots.
            </p>

            {/* Features */}
            <div style={{ marginBottom: 20, flex: 1 }}>
              {teamBFeatures.map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#4F46E5", fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500, color: "#444", lineHeight: 1.5 }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 10,
              border: "1.5px solid #D1D5DB", background: "#FFF",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#111",
              transition: "all 0.15s",
            }}>
              Start with Growth Playbook <ArrowRight size={14} />
            </div>
          </motion.div>
        </div>

        {/* Reassurance strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginTop: 28, padding: "12px 0",
          }}
        >
          <RotateCcw size={13} color="#9CA3AF" />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "#9CA3AF", fontWeight: 500,
          }}>
            You can switch to the other report anytime — no data is lost
          </span>
        </motion.div>
      </div>

      <style>{`
        .ab-card:hover > div:last-child {
          background: #111 !important;
          color: #FFF !important;
          border-color: #111 !important;
        }
        @media (max-width: 640px) {
          .ab-cards-row {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
}
