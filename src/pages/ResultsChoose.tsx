import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ResultsChoose() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) {
      navigate("/", { replace: true });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id || null;
      setUserId(uid);

      // Fire choice_shown event
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
    <div style={{ background: "#FAF9F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
        {/* Logo */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#0F0F0E" }}>
          JobBachao
        </div>

        <div style={{ height: 48 }} />

        {/* Eyebrow */}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#B8B6AE",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            marginBottom: 12,
          }}
        >
          TWO TEAMS. ONE RESUME. VERY DIFFERENT CONCLUSIONS.
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 34,
            fontWeight: 700,
            color: "#0F0F0E",
            marginBottom: 12,
            marginTop: 0,
            lineHeight: 1.2,
          }}
        >
          Which analysis do you want to see?
        </h1>

        {/* Sub */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            color: "#7A7870",
            lineHeight: 1.65,
            marginBottom: 40,
            marginTop: 0,
          }}
        >
          Both teams read your resume. Choose the lens that matters most to you.
        </p>

        {/* Cards row */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "stretch",
          }}
          className="ab-cards-row"
        >
          {/* Model A */}
          <div
            style={{
              flex: 1,
              background: "white",
              border: "1px solid #E5E3DC",
              borderRadius: 16,
              padding: 28,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#B8B6AE", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              TEAM A · THE STABILITY MODEL
            </div>
            <div style={{ fontSize: 11, color: "#B8B6AE", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              Conservative analysis
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#0F0F0E", marginBottom: 10 }}>
              Protect what you have
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#7A7870", lineHeight: 1.65, marginBottom: 16, marginTop: 0 }}>
              Built by senior professionals from India's largest companies. Focuses on risk
              mitigation, salary preservation, and steady upskilling within your current trajectory.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {["Risk-focused", "Industry benchmarks", "Proven paths"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: 20,
                    border: "1px solid #E5E3DC",
                    color: "#7A7870",
                    background: "white",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "auto" }}>
              <button
                onClick={() => logAndNavigate("model_a_chosen", `/?id=${analysisId}`)}
                style={{
                  width: "100%",
                  padding: 11,
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid #D0CEC5",
                  background: "white",
                  color: "#0F0F0E",
                }}
              >
                See Team A's analysis →
              </button>
            </div>
          </div>

          {/* Model B */}
          <div
            style={{
              flex: 1,
              background: "white",
              border: "2px solid #1B2F55",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 4px 24px rgba(27,47,85,0.08)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#1B2F55", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              TEAM B · THE GROWTH MODEL
            </div>
            <div style={{ fontSize: 11, color: "#7A7870", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              Startup-built analysis
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#0F0F0E", marginBottom: 10 }}>
              Move to where the market is going
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#7A7870", lineHeight: 1.65, marginBottom: 16, marginTop: 0 }}>
              Built by a startup team obsessed with what actually gets people hired in 2026.
              Focuses on pivot opportunities, ATS scoring, live job matches, and your
              negotiation leverage right now.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {["Live market data", "ATS scoring", "₹ salary anchors"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: 20,
                    border: "1px solid #D8DFF0",
                    color: "#1B2F55",
                    background: "#EEF1F8",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "auto" }}>
              <button
                onClick={() => logAndNavigate("model_b_chosen", `/results/model-b?id=${analysisId}`)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#1B2F55",
                  color: "white",
                  border: "none",
                }}
              >
                See Team B's analysis →
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#B8B6AE",
            textAlign: "center",
            marginTop: 28,
          }}
        >
          You can switch between models at any time. Both use the same resume data.
        </p>
      </div>

      {/* Responsive CSS for mobile */}
      <style>{`
        @media (max-width: 640px) {
          .ab-cards-row {
            flex-direction: column-reverse !important;
          }
        }
      `}</style>
    </div>
  );
}
