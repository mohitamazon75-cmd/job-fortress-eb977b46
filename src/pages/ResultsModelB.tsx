import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/model-b-tokens.css";
import Card1RiskMirror from "@/components/model-b/Card1RiskMirror";
import Card2MarketRadar from "@/components/model-b/Card2MarketRadar";
import Card3SkillShield from "@/components/model-b/Card3SkillShield";

export default function ResultsModelB() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");

  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentCard, setCurrentCard] = useState(0);

  useEffect(() => {
    if (!analysisId) {
      navigate("/", { replace: true });
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;

        const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
          body: { analysis_id: analysisId, user_id: userId, resume_filename: "Your Resume" },
        });

        if (fnError) throw new Error(fnError.message || "Analysis failed");
        if (!data?.success) throw new Error(data?.error || "Analysis failed");

        setCardData(data.data.card_data);
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [analysisId, navigate]);

  if (!analysisId) return null;

  return (
    <div style={{ background: "var(--mb-paper)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--mb-ink)" }}>JobBachao</div>
          <button
            onClick={() => navigate(`/results/choose?id=${analysisId}`)}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "1px solid var(--mb-rule)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}
          >
            ← Switch model
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink3)", marginBottom: 8 }}>Analysing your resume...</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink4)" }}>This usually takes 15–30 seconds</div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-red)", marginBottom: 12 }}>{error}</div>
            <button onClick={() => window.location.reload()} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer" }}>
              Try again
            </button>
          </div>
        )}

        {cardData && !loading && (
          <>
            {/* Card indicator dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  onClick={() => setCurrentCard(i)}
                  style={{
                    width: currentCard === i ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: currentCard === i ? "var(--mb-navy)" : "var(--mb-rule)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
            </div>

            {currentCard === 0 && <Card1RiskMirror cardData={cardData} onNext={() => setCurrentCard(1)} />}
            {currentCard === 1 && <Card2MarketRadar cardData={cardData} onBack={() => setCurrentCard(0)} onNext={() => setCurrentCard(2)} />}
            {currentCard === 2 && <Card3SkillShield cardData={cardData} onBack={() => setCurrentCard(1)} onNext={() => setCurrentCard(3)} />}
            {currentCard >= 3 && (
              <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink3)" }}>
                Cards 4–7 coming soon
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
