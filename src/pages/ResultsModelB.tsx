import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/styles/model-b-tokens.css";
import Card1RiskMirror from "@/components/model-b/Card1RiskMirror";
import Card2MarketRadar from "@/components/model-b/Card2MarketRadar";
import Card3SkillShield from "@/components/model-b/Card3SkillShield";
import Card4PivotPaths from "@/components/model-b/Card4PivotPaths";
import Card5JobsTracker from "@/components/model-b/Card5JobsTracker";
import Card6BlindSpots from "@/components/model-b/Card6BlindSpots";
import Card7HumanAdvantage from "@/components/model-b/Card7HumanAdvantage";
import PromptModal from "@/components/model-b/PromptModal";

const LOADING_MESSAGES = [
  "Reading your resume with fresh eyes...",
  "Mapping your skills to India's 2026 market...",
  "Checking live ATS match scores...",
  "Finding pivot roles that match your profile...",
  "Scanning salary benchmarks for your tier...",
  "Identifying blind spots competitors miss...",
  "Extracting your irreplaceable advantages...",
  "Building your personalised career strategy...",
];

const STREAK_KEY = "jb_streak";
const STREAK_DATE_KEY = "jb_streak_date";

const TAB_LABELS = ["Risk", "Market", "Shield", "Pivot", "Jobs", "Blind spots", "Human"];

function useStreak() {
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(STREAK_DATE_KEY);
    const current = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
    if (stored !== today) {
      const next = current + 1;
      setStreak(next);
      localStorage.setItem(STREAK_KEY, String(next));
      localStorage.setItem(STREAK_DATE_KEY, today);
    } else {
      setStreak(current || 1);
    }
  }, []);
  return streak;
}

const STREAK_ACTIONS = [
  "Update your LinkedIn headline with your strongest credential.",
  "Send one personalised outreach message today.",
  "Add one missing ATS keyword to your resume.",
  "Research one target company's Q1 2026 priorities.",
  "Practice your salary negotiation anchor out loud.",
];

export default function ResultsModelB() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysisId = searchParams.get("id");

  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentCard, setCurrentCard] = useState(0);
  const [visitedCards, setVisitedCards] = useState<Set<number>>(new Set([0]));
  const [actionModal, setActionModal] = useState<{ title: string; promptText: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [journeyDone, setJourneyDone] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const streak = useStreak();
  const [streakModal, setStreakModal] = useState(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Log helper
  const logEvent = useCallback(async (event_type: string, metadata?: Record<string, unknown>) => {
    try {
      await supabase.functions.invoke("log-ab-event", {
        body: { analysis_id: analysisId, user_id: userId, event_type, metadata },
      });
    } catch {}
  }, [analysisId, userId]);

  // Fetch data
  const fetchAnalysis = useCallback(async () => {
    if (!analysisId) return;
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || null;
      setUserId(uid);
      const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
        body: { analysis_id: analysisId, user_id: uid, resume_filename: "Your Resume" },
      });
      if (fnError) throw new Error(fnError.message || "Analysis failed");
      if (!data?.success) throw new Error(data?.error || "Analysis failed");
      const cd = data.data.card_data;
      setCardData(cd);
      setDisplayScore(cd?.jobbachao_score || 0);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) { navigate("/", { replace: true }); return; }
    fetchAnalysis();
  }, [analysisId, navigate, fetchAnalysis]);

  // Loading message cycling
  useEffect(() => {
    if (!loading) {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      return;
    }
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMsg(p => (p + 1) % LOADING_MESSAGES.length);
    }, 500);
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); };
  }, [loading]);

  // Tab change handler with logging
  const handleTabChange = useCallback((index: number) => {
    setCurrentCard(index);
    setVisitedCards(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    logEvent("card_viewed", { card_index: index });
  }, [logEvent]);

  // Journey complete detection
  useEffect(() => {
    if (journeyDone) return;
    if (visitedCards.size >= 7 && cardData) {
      setJourneyDone(true);
      setDisplayScore(prev => prev + 6);
      toast.success("Journey complete ✓", { duration: 2800 });
      logEvent("journey_complete");
    }
  }, [visitedCards, cardData, journeyDone, logEvent]);

  if (!analysisId) return null;

  const progressPct = ((currentCard + 1) / 7) * 100;

  const getTabState = (i: number) => {
    if (i === currentCard) return "active";
    if (visitedCards.has(i)) return "done";
    return "unvisited";
  };

  const tabColors = {
    active: { dot: "#1B2F55", label: "#1B2F55", bg: "#EEF1F8" },
    done: { dot: "#1A6B3C", label: "#1A6B3C", bg: "transparent" },
    unvisited: { dot: "#D0CEC5", label: "#B8B6AE", bg: "transparent" },
  };

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

  const handleCopyFallback = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {}
  };

  return (
    <div style={{ background: "var(--mb-bg)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--mb-ink)" }}>JobBachao</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {cardData && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: "var(--mb-navy)" }}>{displayScore}</span>
            )}
            <button onClick={() => navigate(`/results/choose?id=${analysisId}`)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "1px solid var(--mb-rule)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>← Switch model</button>
          </div>
        </div>

        {/* Streak bar */}
        {cardData && !loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--mb-navy)" }}>🔥 {streak}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-navy)", flex: 1 }}>day streak</span>
            <button
              onClick={() => setStreakModal(true)}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: "var(--mb-navy)", background: "white", border: "1px solid var(--mb-navy-tint2)", borderRadius: 20, padding: "4px 12px", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center" }}
            >Today's action</button>
          </div>
        )}

        {/* Progress bar */}
        {cardData && !loading && (
          <div style={{ height: 3, background: "var(--mb-rule)", borderRadius: 1.5, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: 3, background: "var(--mb-navy)", borderRadius: 1.5, width: `${progressPct}%`, transition: "width 0.3s ease" }} />
          </div>
        )}

        {/* Tabs */}
        {cardData && !loading && (
          <div style={{ display: "flex", gap: 2, marginBottom: 20, overflowX: "auto" }}>
            {TAB_LABELS.map((label, i) => {
              const state = getTabState(i);
              const colors = tabColors[state];
              return (
                <button
                  key={i}
                  onClick={() => handleTabChange(i)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px 4px",
                    background: colors.bg,
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    position: "relative",
                    minHeight: 44,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 600, color: colors.label, whiteSpace: "nowrap" }}>{label}</span>
                  {state === "done" && i !== currentCard && (
                    <span style={{ position: "absolute", top: 2, right: 2, fontSize: 7, color: "#1A6B3C" }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 8 }}>
              Analysing your resume...
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 4 }}>
              {cardData?.resume_filename || "Your Resume"}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink4)", marginBottom: 24, minHeight: 20 }}>
              {LOADING_MESSAGES[loadingMsg]}
            </div>
            {/* Progress bar */}
            <div style={{ maxWidth: 320, margin: "0 auto", height: 4, background: "var(--mb-rule)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: 4, background: "var(--mb-navy)", borderRadius: 2, width: "0%", animation: "mbLoadBar 4s ease-out forwards" }} />
            </div>
            <style>{`@keyframes mbLoadBar { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--mb-red)", marginBottom: 8 }}>{error}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", marginBottom: 20, lineHeight: 1.65, maxWidth: 400, margin: "0 auto 20px" }}>
              This is usually temporary — our AI might be busy. Your resume data is safe. Tap below to try again without refreshing.
            </div>
            <button
              onClick={() => { setError(""); fetchAnalysis(); }}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 8, padding: "12px 28px", cursor: "pointer", minHeight: 44 }}
            >Try again</button>
          </div>
        )}

        {/* Main content */}
        {cardData && !loading && !error && (
          <>
            {currentCard === 0 && <Card1RiskMirror cardData={cardData} onNext={() => handleTabChange(1)} />}
            {currentCard === 1 && <Card2MarketRadar cardData={cardData} onBack={() => handleTabChange(0)} onNext={() => handleTabChange(2)} />}
            {currentCard === 2 && <Card3SkillShield cardData={cardData} onBack={() => handleTabChange(1)} onNext={() => handleTabChange(3)} onUpgradePlan={() => {
              logEvent("modal_opened", { source: "upgrade_plan" });
              setActionModal({
                title: "60-Day Skill Upgrade Plan",
                promptText: `Create a 60-day skill upgrade plan for ${cardData.user?.name} based on their resume.\n\nCurrent skills: ${(cardData.card3_shield?.skills || []).map((s: any) => s.name).join(", ")}\nSkill gaps: ${(cardData.card3_shield?.skills || []).filter((s: any) => s.level === "buildable" || s.level === "critical-gap").map((s: any) => s.name).join(", ")}\n\nFor each week:\n- Specific learning resources (free, India-accessible)\n- Practice exercises with measurable outcomes\n- Portfolio project milestones\n- Time estimates (assume 1hr/day on weekdays)`
              });
            }} />}
            {currentCard === 3 && <Card4PivotPaths cardData={cardData} onBack={() => handleTabChange(2)} onNext={() => handleTabChange(4)} />}
            {currentCard === 4 && <Card5JobsTracker cardData={cardData} onBack={() => handleTabChange(3)} onNext={() => handleTabChange(5)} />}
            {currentCard === 5 && <Card6BlindSpots cardData={cardData} onBack={() => handleTabChange(4)} onNext={() => handleTabChange(6)} />}
            {currentCard === 6 && <Card7HumanAdvantage cardData={cardData} onBack={() => handleTabChange(5)} copyFallback={handleCopyFallback} analysisId={analysisId} />}

            {/* Bottom action buttons */}
            <div className="mb-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {buildActionPrompts().map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    logEvent("modal_opened", { source: action.label });
                    setActionModal({ title: action.title, promptText: action.promptText });
                  }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, padding: "11px 10px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--mb-rule)", background: "white", color: "var(--mb-ink)", display: "flex", alignItems: "center", gap: 8, transition: "all 150ms", minHeight: 44 }}
                >
                  <span style={{ fontSize: 14 }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {actionModal && <PromptModal isOpen={true} onClose={() => setActionModal(null)} title={actionModal.title} promptText={actionModal.promptText} />}
      {streakModal && (
        <PromptModal
          isOpen={true}
          onClose={() => setStreakModal(false)}
          title={`Day ${streak} Action`}
          promptText={STREAK_ACTIONS[streak % 5]}
        />
      )}

      {/* Mobile responsive CSS */}
      <style>{`
        @media (max-width: 640px) {
          .mb-action-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
