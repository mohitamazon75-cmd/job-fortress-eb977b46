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

/** Build 5 daily streak actions dynamically from the user's analysis data */
function buildStreakActions(cd: any): string[] {
  if (!cd) return ["Review your resume for one improvement you can make today."];
  const u = cd.user || {};
  const topAdv = cd.card7_human?.advantages?.[0];
  const topJob = cd.card5_jobs?.job_matches?.[0];
  const pivot0 = cd.card4_pivot?.pivots?.[0];
  const anchor = cd.card4_pivot?.negotiation?.open_with;
  const blindSpot = cd.card6_blindspots?.blind_spots?.[0];
  const missingKw = (cd.card1_risk?.ats_keywords || [])
    .filter((k: any) => k.color === "red")
    .map((k: any) => k.keyword)
    .slice(0, 2)
    .join(", ");

  return [
    topAdv
      ? `Update your LinkedIn headline to: "${u.current_title || "Professional"} | ${topAdv.proof_label}". This is your strongest credential — make it the first thing recruiters see.`
      : "Update your LinkedIn headline with your strongest credential.",

    topJob
      ? `Send a personalised message to someone at ${topJob.company}. Open with: "I noticed ${topJob.company} is ${(topJob.why_fit || "growing in this space").slice(0, 80)}. With my experience in ${topAdv?.proof_label || u.current_title || "this domain"}, I'd love to explore the ${topJob.role} opportunity."`
      : "Send one personalised outreach message to a target company today.",

    missingKw
      ? `Open your resume and add these missing ATS keywords that are hurting your match rate: ${missingKw}. Place them in your summary and your most recent role's bullet points.`
      : "Review your resume's top section — move your strongest metric into the first bullet point.",

    pivot0
      ? `Research ${topJob?.company || "your top target company"}'s recent news. Find one initiative where your ${pivot0.role} skills would add value. Save it — you'll use this in your cover letter tomorrow.`
      : "Research one target company's latest product launch or quarterly priorities.",

    anchor
      ? `Practice saying this out loud 3 times: "Based on my ${u.years_experience || "several"}+ years and track record in ${topAdv?.proof_label || u.current_title || "my domain"}, I'm targeting ${anchor} as base compensation."${blindSpot ? ` Then prepare a 30-second answer for this blind spot: "${blindSpot.gap}".` : ""}`
      : "Practice your salary negotiation anchor out loud — say your target number 3 times with confidence.",
  ];
}

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

  // Fetch data with polling support
  const fetchAnalysis = useCallback(async () => {
    if (!analysisId) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);

      // First call triggers the background job
      const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
        body: {
          analysis_id: analysisId,
          ...(uid ? { user_id: uid } : {}),
          resume_filename: "Your Resume",
        },
      });

      if (fnError) throw new Error(fnError.message || "Analysis failed");
      if (!data?.success) throw new Error(data?.error || "Analysis failed");

      // If we got data immediately (cache hit), use it
      if (data.data?.card_data) {
        const cd = data.data.card_data;
        setCardData(cd);
        setDisplayScore(cd?.jobbachao_score || 0);
        setLoading(false);
        return;
      }

      // Background processing started — poll for completion
      if (data.status === "processing") {
        pollForResult(uid);
        return;
      }

      // Unexpected state
      throw new Error("Unexpected response state");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setLoading(false);
    }
  }, [analysisId]);

  // Poll every 3s until result is ready
  const pollForResult = useCallback(async (uid: string | null) => {
    const MAX_POLLS = 40; // ~2 minutes max
    let polls = 0;

    const poll = async () => {
      polls++;
      if (polls > MAX_POLLS) {
        setError("Analysis is taking longer than expected. Please refresh the page.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
          body: {
            analysis_id: analysisId,
            ...(uid ? { user_id: uid } : {}),
            poll: true,
          },
        });

        if (fnError) throw new Error(fnError.message);

        if (data?.data?.card_data) {
          const cd = data.data.card_data;
          setCardData(cd);
          setDisplayScore(cd?.jobbachao_score || 0);
          setLoading(false);
          return;
        }

        if (data?.status === "processing") {
          setTimeout(poll, 3000);
          return;
        }

        // not_started or error — retry trigger
        if (polls < 3) {
          const { data: retrigger } = await supabase.functions.invoke("get-model-b-analysis", {
            body: {
              analysis_id: analysisId,
              ...(uid ? { user_id: uid } : {}),
              resume_filename: "Your Resume",
            },
          });
          if (retrigger?.data?.card_data) {
            const cd = retrigger.data.card_data;
            setCardData(cd);
            setDisplayScore(cd?.jobbachao_score || 0);
            setLoading(false);
            return;
          }
          setTimeout(poll, 3000);
          return;
        }

        setError("Analysis failed. Please try again.");
        setLoading(false);
      } catch {
        setTimeout(poll, 3000);
      }
    };

    setTimeout(poll, 3000);
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
    }, 3500);
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
    <div className="mb-root" style={{ background: "var(--mb-bg)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "var(--mb-ink)", letterSpacing: "-0.01em" }}>JobBachao</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {cardData && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: "var(--mb-navy)" }}>{displayScore}</span>
            )}
            <button onClick={() => navigate(`/results/choose?id=${analysisId}`)} className="mb-btn-secondary" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", transition: "all 150ms", minHeight: 40 }}>← Switch model</button>
          </div>
        </div>

        {/* Streak bar */}
        {cardData && !loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 12, marginBottom: 18, boxShadow: "var(--mb-shadow-sm)" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: "var(--mb-navy)" }}>🔥 {streak}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-navy)", flex: 1 }}>day streak</span>
            <button
              onClick={() => setStreakModal(true)}
              className="mb-btn-primary"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "var(--mb-navy)", background: "white", border: "1px solid var(--mb-navy-tint2)", borderRadius: 20, padding: "6px 16px", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", transition: "all 150ms" }}
            >Today's action</button>
          </div>
        )}

        {/* Progress bar */}
        {cardData && !loading && (
          <div style={{ height: 4, background: "var(--mb-rule)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: 4, background: "var(--mb-navy)", borderRadius: 2, width: `${progressPct}%`, transition: "width 0.4s ease" }} />
          </div>
        )}

        {/* Tabs */}
        {cardData && !loading && (
          <div style={{ display: "flex", gap: 3, marginBottom: 22, overflowX: "auto" }}>
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
                    border: state === "active" ? "1px solid var(--mb-navy-tint2)" : "1px solid transparent",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    position: "relative",
                    minHeight: 48,
                    transition: "all 150ms",
                    boxShadow: state === "active" ? "var(--mb-shadow-sm)" : "none",
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: colors.dot, transition: "background 150ms" }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: colors.label, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{label}</span>
                  {state === "done" && i !== currentCard && (
                    <span style={{ position: "absolute", top: 3, right: 4, fontSize: 8, color: "#1A6B3C", fontWeight: 700 }}>✓</span>
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
              <div style={{ height: 4, background: "var(--mb-navy)", borderRadius: 2, width: "0%", animation: "mbLoadBar 45s cubic-bezier(0.1, 0.6, 0.3, 1) forwards" }} />
            </div>
            <style>{`@keyframes mbLoadBar { from { width: 0% } 50% { width: 65% } 80% { width: 85% } to { width: 96% } }`}</style>
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
            {currentCard === 4 && <Card5JobsTracker cardData={cardData} onBack={() => handleTabChange(3)} onNext={() => handleTabChange(5)} analysisId={analysisId} />}
            {currentCard === 5 && <Card6BlindSpots cardData={cardData} onBack={() => handleTabChange(4)} onNext={() => handleTabChange(6)} />}
            {currentCard === 6 && <Card7HumanAdvantage cardData={cardData} onBack={() => handleTabChange(5)} copyFallback={handleCopyFallback} analysisId={analysisId} />}

            {/* Bottom action buttons */}
            <div className="mb-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              {buildActionPrompts().map((action, i) => (
                <button
                  key={i}
                  className="mb-btn-secondary"
                  onClick={() => {
                    logEvent("modal_opened", { source: action.label });
                    setActionModal({ title: action.title, promptText: action.promptText });
                  }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: "14px 12px", borderRadius: 12, cursor: "pointer", border: "1px solid var(--mb-rule)", background: "white", color: "var(--mb-ink)", display: "flex", alignItems: "center", gap: 10, transition: "all 150ms", minHeight: 48, boxShadow: "var(--mb-shadow-sm)" }}
                >
                  <span style={{ fontSize: 16 }}>{action.icon}</span>
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
          promptText={buildStreakActions(cardData)[streak % 5]}
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
