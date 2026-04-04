import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/model-b-tokens.css";
import Card1RiskMirror from "@/components/model-b/Card1RiskMirror";
import Card2MarketRadar from "@/components/model-b/Card2MarketRadar";
import Card3SkillShield from "@/components/model-b/Card3SkillShield";
import Card4PivotPaths from "@/components/model-b/Card4PivotPaths";
import Card5JobsTracker from "@/components/model-b/Card5JobsTracker";
import Card6BlindSpots from "@/components/model-b/Card6BlindSpots";
import Card7HumanAdvantage from "@/components/model-b/Card7HumanAdvantage";
import PromptModal from "@/components/model-b/PromptModal";

export default function ResultsModelB() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");

  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentCard, setCurrentCard] = useState(0);
  const [actionModal, setActionModal] = useState<{ title: string; promptText: string } | null>(null);

  useEffect(() => {
    if (!analysisId) { navigate("/", { replace: true }); return; }
    const fetchData = async () => {
      setLoading(true); setError("");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
          body: { analysis_id: analysisId, user_id: user?.id || null, resume_filename: "Your Resume" },
        });
        if (fnError) throw new Error(fnError.message || "Analysis failed");
        if (!data?.success) throw new Error(data?.error || "Analysis failed");
        setCardData(data.data.card_data);
      } catch (e: any) { setError(e.message || "Something went wrong"); } finally { setLoading(false); }
    };
    fetchData();
  }, [analysisId, navigate]);

  if (!analysisId) return null;

  const buildActionPrompts = () => {
    if (!cardData) return [];
    const u = cardData.user || {};
    const pivot0 = cardData.card4_pivot?.pivots?.[0] || {};
    const advProofs = (cardData.card7_human?.advantages || []).map((a: any) => `- ${a.proof_label}`).join("\n");
    const missingKw = (cardData.card1_risk?.ats_missing_keywords || []).join(" · ");
    const blindFixes = (cardData.card6_blindspots?.blind_spots || []).map((b: any) => b.fix).join("; ");

    return [
      { label: "Write LinkedIn post", icon: "✏️", title: "LinkedIn Post · Lead with your strongest credential", promptText: `Write a LinkedIn post for ${u.name} announcing they are open to ${pivot0.role} roles at Indian B2B SaaS companies.\n\nKey evidence:\n${advProofs}\n- ${u.years_experience}+ years experience · Available ${u.availability} · ${u.location}\n\nRequirements:\n- Open with one extraordinary number — NOT 'I am excited to announce'\n- Maximum 200 words · Zero buzzwords · Specific\n- Clear CTA for hiring managers\n- Confident, direct tone` },
      { label: "Rewrite resume", icon: "📄", title: "Resume Rewrite — Move the numbers to the top", promptText: `Rewrite the Professional Summary and top bullets for ${u.name}'s resume for ${pivot0.role} roles at Indian B2B SaaS companies.\n\nTarget title: ${pivot0.role}\nCurrent title: ${u.current_title}\n\nStrongest evidence to surface (currently buried):\n${advProofs}\n\nATS keywords to include: ${missingKw}\n\nRules:\n- Summary must open with top credential within the first 10 words\n- Every bullet: outcome first → scale/impact → method at the end\n- Move all numbers from achievements sections into relevant job bullets\n- No bullet starts with a tool name or a verb without a number` },
      { label: "Top 10 companies", icon: "🏢", title: "Top 10 India B2B SaaS Companies", promptText: `Top 10 B2B SaaS companies in India hiring ${pivot0.role} leaders in 2026 for ${u.name}.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget salary: ${cardData.card4_pivot?.negotiation?.open_with || ''}\n\nFor each company: why they fit this profile specifically, appropriate role title and seniority, salary range including ESOPs, one credential to lead with in the application, best application route (direct/LinkedIn/referral).` },
      { label: "30-day action plan", icon: "📋", title: "30-Day Action Plan", promptText: `Create a 30-day action plan for ${u.name} to land a ${pivot0.role} role in India.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget: ${cardData.card4_pivot?.negotiation?.open_with || ''} base\n\nPlan:\nDays 1–3: Fix 3 blind spots — ${blindFixes}\nDays 4–7: Research 10 target companies, map specific credentials to each JD\nDays 8–14: 5 tailored applications with evidence mapped to each company\nDays 15–20: Referral activation — personalised outreach for each target company\nDays 21–25: Interview prep using STAR answers built from resume evidence\nDays 26–30: Follow-up cadence, negotiation preparation, offer evaluation framework\n\nFor each week: specific daily actions, time estimates, success metrics.` },
    ];
  };

  return (
    <div style={{ background: "var(--mb-paper)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--mb-ink)" }}>JobBachao</div>
          <button onClick={() => navigate(`/results/choose?id=${analysisId}`)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "1px solid var(--mb-rule)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>← Switch model</button>
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
            <button onClick={() => window.location.reload()} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer" }}>Try again</button>
          </div>
        )}

        {cardData && !loading && (
          <>
            {/* Card indicator dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} onClick={() => setCurrentCard(i)} style={{ width: currentCard === i ? 18 : 6, height: 6, borderRadius: 3, background: currentCard === i ? "var(--mb-navy)" : "var(--mb-rule)", cursor: "pointer", transition: "all 0.2s ease" }} />
              ))}
            </div>

            {currentCard === 0 && <Card1RiskMirror cardData={cardData} onNext={() => setCurrentCard(1)} />}
            {currentCard === 1 && <Card2MarketRadar cardData={cardData} onBack={() => setCurrentCard(0)} onNext={() => setCurrentCard(2)} />}
            {currentCard === 2 && <Card3SkillShield cardData={cardData} onBack={() => setCurrentCard(1)} onNext={() => setCurrentCard(3)} />}
            {currentCard === 3 && <Card4PivotPaths cardData={cardData} onBack={() => setCurrentCard(2)} onNext={() => setCurrentCard(4)} />}
            {currentCard === 4 && <Card5JobsTracker cardData={cardData} onBack={() => setCurrentCard(3)} onNext={() => setCurrentCard(5)} />}
            {currentCard === 5 && <Card6BlindSpots cardData={cardData} onBack={() => setCurrentCard(4)} onNext={() => setCurrentCard(6)} />}
            {currentCard === 6 && <Card7HumanAdvantage cardData={cardData} onBack={() => setCurrentCard(5)} />}

            {/* Bottom action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {buildActionPrompts().map((action, i) => (
                <button
                  key={i}
                  onClick={() => setActionModal({ title: action.title, promptText: action.promptText })}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, padding: "11px 10px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--mb-rule)", background: "white", color: "var(--mb-ink)", display: "flex", alignItems: "center", gap: 8, transition: "all 150ms" }}
                >
                  <span style={{ fontSize: 14 }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {actionModal && <PromptModal isOpen={true} onClose={() => setActionModal(null)} title={actionModal.title} promptText={actionModal.promptText} />}
    </div>
  );
}
