import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
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
import Card0Verdict from "@/components/model-b/Card0Verdict";
import PromptModal from "@/components/model-b/PromptModal";

// Issue 1-A: Lazy-load the three highest-value previously-hidden features.
// These were fully built but permanently unreachable in the old flow.
// They load only when the user taps the Tools tab — zero bundle cost otherwise.
const ScoreTrendCard  = lazy(() => import("@/components/cards/ScoreTrendCard"));
// CareerGenomeDebate hidden — to re-enable, uncomment this import and the JSX block below.
// const CareerGenomeDebate = lazy(() => import("@/components/dashboard/CareerGenomeDebate"));
const ResumeWeaponizerCard = lazy(() => import("@/components/cards/ResumeWeaponizerCard"));
const OfficePowerVocab = lazy(() => import("@/components/cards/OfficePowerVocab"));
const SkillCompoundCalculator = lazy(() => import("@/components/cards/SkillCompoundCalculator"));
const PeerRankCard = lazy(() => import("@/components/cards/PeerRankCard"));
const TrajectoryCard = lazy(() => import("@/components/cards/TrajectoryCard"));

interface WeeklyIntelData {
  resources?: Array<{ title: string; url: string; type: string; time_commitment?: string }>;
  summary?: string;
  citations?: string[];
}

const LOADING_MESSAGES = [
  "📄 Extracting skills and experience from your resume...",
  "🧠 Matching your profile against 98 role archetypes...",
  "⚡ Computing your AI exposure score — 6 deterministic factors...",
  "🔍 Identifying which specific AI tools threaten each skill...",
  "📊 Fetching live salary data for your role and city...",
  "💼 Searching Naukri, LinkedIn, Indeed for matching roles...",
  "🛡️ Mapping your moat skills — what AI can't replicate...",
  "🎯 Building your personalised 90-day defense plan...",
  "🔄 Running final calibration against India 2026 data...",
];

const STREAK_KEY = "jb_streak";
const STREAK_DATE_KEY = "jb_streak_date";

const TAB_LABELS = ["Verdict", "Risk", "Market", "Shield", "Pivot", "Jobs", "Blind spots", "Human", "🛠 Tools"];

// Tabs where the header "Career Safety" score is hidden.
// 0 = Verdict (presents its own hero score), 3 = Shield (sub-score conflict),
// 8 = Tools (utility tab — no score frame needed).
const HEADER_SCORE_HIDDEN_TABS = new Set([0, 3, 8]);
// Tabs where the bottom action button grid is hidden — these tabs have their own
// dedicated CTAs and the grid would clutter the emotional/utility frame.
const ACTION_BUTTONS_HIDDEN_TABS = new Set([0, 8]);
// Total content tabs in the journey (0..8 inclusive). Visiting all 9 = complete.
const TOTAL_JOURNEY_TABS = 9;

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
  const [showSavePrompt, setShowSavePrompt] = useState(false); // show for any non-email user
  const [journeyDone, setJourneyDone] = useState(false);
  // P-3-B: Fetch monthly scan count once here, pass to Card1RiskMirror as a prop.
  const [monthlyScanCount, setMonthlyScanCount] = useState<number | null>(null);
  // Feature 3: Weekly intel for the Tools tab Judo section — fetched lazily when Tools tab opens.
  const [weeklyIntel, setWeeklyIntel] = useState<WeeklyIntelData | null>(null);
  const [weeklyIntelLoading, setWeeklyIntelLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const streak = useStreak();
  const [streakModal, setStreakModal] = useState(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Polling lifecycle refs — guard against unmount leaks and double-chains (P0 #1, #2, #19)
  const isMountedRef = useRef(true);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGenerationRef = useRef(0); // increments on each fetchAnalysis to invalidate prior chains

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // Log helper
  const logEvent = useCallback(async (event_type: string, metadata?: Record<string, unknown>) => {
    // Also log to user_action_signals for the behavioral flywheel
    const validActionTypes = ['card_viewed','job_clicked','skill_selected','vocab_copied',
      'pivot_expanded','plan_action_checked','share_whatsapp','share_linkedin',
      'rescan_initiated','outcome_reported','tool_opened'];
    if (validActionTypes.includes(event_type) && analysisId) {
      // Guard: only insert when analysisId exists (prevents orphaned signals).
      // Cast needed until Supabase types regenerate with new table.
      (supabase.from as any)('user_action_signals').insert({
        scan_id: analysisId,
        action_type: event_type,
        action_payload: metadata || {},
        scan_role: cardData?.user?.current_title || null,
        scan_industry: cardData?.user?.industry || null,
        scan_score: cardData?.jobbachao_score || null,
        scan_city: cardData?.user?.location || null,
      }).then(() => {}, () => {});
    }
    try {
      await supabase.functions.invoke("log-ab-event", {
        body: { analysis_id: analysisId, user_id: userId, event_type, metadata },
      });
    } catch {}
  }, [analysisId, userId]);

  // Fetch data with polling support
  const fetchAnalysis = useCallback(async () => {
    if (!analysisId) return;
    // Invalidate any in-flight polling chain from a previous call
    pollGenerationRef.current += 1;
    const myGen = pollGenerationRef.current;
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMountedRef.current || myGen !== pollGenerationRef.current) return;
      const uid = user?.id || null;
      setUserId(uid);
      // Detect anonymous users (created by signInAnonymously) to show sign-in prompt
      // Show save prompt if no email (anonymous or not logged in at all)
      setShowSavePrompt(!user?.email);

      // First call triggers the background job
      const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
        body: { analysis_id: analysisId, user_id: uid, resume_filename: "Your Resume" },
      });

      if (!isMountedRef.current || myGen !== pollGenerationRef.current) return;

      if (fnError) {
        // Edge function returned non-2xx — try to surface a useful message
        const ctx: any = (fnError as any).context;
        let parsed: any = null;
        try { parsed = ctx?.body ? JSON.parse(ctx.body) : null; } catch {}
        if (parsed?.code === "SCAN_NOT_READY") {
          setError("This scan didn't complete. Start a new scan to view your analysis.");
          setLoading(false);
          return;
        }
        if (parsed?.code === "AUTH_REQUIRED") {
          setError("Please sign in to view this analysis.");
          setShowSavePrompt(true);
          setLoading(false);
          return;
        }
        if (parsed?.code === "FORBIDDEN") {
          // Stale/shared link pointing at another account's scan.
          // Clear cached pointers so the next scan starts cleanly.
          try {
            localStorage.removeItem("jb_last_scan_id");
            localStorage.removeItem("lastScanId");
          } catch {}
          setError(parsed.error || "This analysis belongs to a different account. Start a new scan.");
          setLoading(false);
          return;
        }
        throw new Error(parsed?.error || fnError.message || "Analysis failed");
      }
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
        pollForResult(uid, myGen);
        return;
      }

      // Unexpected state
      throw new Error("Unexpected response state");
    } catch (e: any) {
      if (!isMountedRef.current || myGen !== pollGenerationRef.current) return;
      setError(e.message || "Something went wrong");
      setLoading(false);
    }
  }, [analysisId]);

  // Poll every 3s until result is ready — guarded by mount + generation refs (P0 #1, #2)
  const pollForResult = useCallback(async (uid: string | null, gen: number) => {
    const MAX_POLLS = 40; // ~2 minutes max
    let polls = 0;
    let consecutiveErrors = 0; // P1 #9: surface error after 3 consecutive failures

    const scheduleNext = () => {
      if (!isMountedRef.current || gen !== pollGenerationRef.current) return;
      pollTimeoutRef.current = setTimeout(poll, 3000);
    };

    const poll = async () => {
      if (!isMountedRef.current || gen !== pollGenerationRef.current) return;
      polls++;
      if (polls > MAX_POLLS) {
        setError("Analysis is taking longer than expected. Please refresh the page.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-model-b-analysis", {
          body: { analysis_id: analysisId, user_id: uid, poll: true },
        });

        if (!isMountedRef.current || gen !== pollGenerationRef.current) return;
        if (fnError) throw new Error(fnError.message);
        consecutiveErrors = 0;

        if (data?.data?.card_data) {
          const cd = data.data.card_data;
          setCardData(cd);
          setDisplayScore(cd?.jobbachao_score || 0);
          setLoading(false);
          return;
        }

        if (data?.status === "processing") {
          scheduleNext();
          return;
        }

        // not_started or error — retry trigger
        if (polls < 3) {
          const { data: retrigger } = await supabase.functions.invoke("get-model-b-analysis", {
            body: { analysis_id: analysisId, user_id: uid, resume_filename: "Your Resume" },
          });
          if (!isMountedRef.current || gen !== pollGenerationRef.current) return;
          if (retrigger?.data?.card_data) {
            const cd = retrigger.data.card_data;
            setCardData(cd);
            setDisplayScore(cd?.jobbachao_score || 0);
            setLoading(false);
            return;
          }
          scheduleNext();
          return;
        }

        setError("Analysis failed. Please try again.");
        setLoading(false);
      } catch {
        if (!isMountedRef.current || gen !== pollGenerationRef.current) return;
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          setError("Backend is unreachable. Please check your connection and try again.");
          setLoading(false);
          return;
        }
        scheduleNext();
      }
    };

    pollTimeoutRef.current = setTimeout(poll, 3000);
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) { navigate("/", { replace: true }); return; }
    fetchAnalysis();

    // P-3-B: Fetch monthly scan count for social proof (lifted from Card1RiskMirror)
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ count }) => {
        if (!isMountedRef.current) return;
        if (count !== null && count >= 10) {
          setMonthlyScanCount(Math.floor(count / 10) * 10);
        }
      }, () => { /* P0 #3: swallow RLS/network errors silently */ });
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

    // Feature 3: Fetch live Tavily learning resources when user first opens the Tools tab.
    // Fires once (guarded by weeklyIntelLoading + weeklyIntel), lazy, 30-min cached.
    if (index === 8 && !weeklyIntelLoading && !weeklyIntel && cardData?.scan_judo?.recommended_tool) {
      setWeeklyIntelLoading(true);
      supabase.functions.invoke("fetch-weekly-intel", {
        body: {
          role: cardData.user?.current_title || "",
          judo_tool: (cardData.scan_judo as any)?.recommended_tool || "",
          industry: cardData.user?.industry || "",
          scanId: analysisId,
        },
      }).then(({ data }) => {
        if (data?.resources?.length || data?.summary) setWeeklyIntel(data);
      }).catch(() => {}).finally(() => setWeeklyIntelLoading(false));
    }
  }, [logEvent, weeklyIntelLoading, weeklyIntel, cardData, analysisId]);

  // Journey complete detection — only fires when user has explored ALL 9 tabs (0..8)
  useEffect(() => {
    if (journeyDone) return;
    if (visitedCards.size >= TOTAL_JOURNEY_TABS && cardData) {
      setJourneyDone(true);
      setDisplayScore(prev => prev + 6);
      toast.success("Journey complete ✓", { duration: 2800 });
      logEvent("journey_complete");
    }
  }, [visitedCards, cardData, journeyDone, logEvent]);

  // Memoized — was being rebuilt on every render (P0 #6)
  // Moved above the early return so hook order stays stable across renders.
  const actionPrompts = useMemo(() => {
    if (!cardData) return [] as Array<{ label: string; icon: string; title: string; promptText: string }>;
    const u = cardData.user || {};
    const pivot0 = cardData.card4_pivot?.pivots?.[0] || {};
    const advProofs = (cardData.card7_human?.advantages || []).map((a: any) => `- ${a.proof_label}`).join("\n");
    const missingKw = (cardData.card1_risk?.ats_missing_keywords || []).join(" · ");
    // Fix #10: only render the blind-spot day-1 line when fixes actually exist —
    // prevents a trailing "Days 1–3: Fix 3 blind spots — " with empty content.
    const blindFixesArr = (cardData.card6_blindspots?.blind_spots || []).map((b: any) => b?.fix).filter(Boolean);
    const blindFixes = blindFixesArr.join("; ");
    const day1to3Line = blindFixes
      ? `Days 1–3: Fix 3 blind spots — ${blindFixes}`
      : `Days 1–3: Audit your resume against the role JD — list 3 measurable gaps to close this week`;
    return [
      { label: "Write LinkedIn post", icon: "✏️", title: "LinkedIn Post · Lead with your strongest credential", promptText: `Write a LinkedIn post for ${u.name} announcing they are open to ${pivot0.role} roles at Indian B2B SaaS companies.\n\nKey evidence:\n${advProofs}\n- ${u.years_experience}+ years experience · Available ${u.availability} · ${u.location}\n\nRequirements:\n- Open with one extraordinary number — NOT 'I am excited to announce'\n- Maximum 200 words · Zero buzzwords · Specific\n- Clear CTA for hiring managers\n- Confident, direct tone` },
      { label: "Rewrite resume", icon: "📄", title: "Resume Rewrite — Move the numbers to the top", promptText: `Rewrite the Professional Summary and top bullets for ${u.name}'s resume for ${pivot0.role} roles at Indian B2B SaaS companies.\n\nTarget title: ${pivot0.role}\nCurrent title: ${u.current_title}\n\nStrongest evidence to surface (currently buried):\n${advProofs}\n\nATS keywords to include: ${missingKw}\n\nRules:\n- Summary must open with top credential within the first 10 words\n- Every bullet: outcome first → scale/impact → method at the end\n- Move all numbers from achievements sections into relevant job bullets\n- No bullet starts with a tool name or a verb without a number` },
      { label: "Top 10 companies", icon: "🏢", title: "Top 10 India B2B SaaS Companies", promptText: `Top 10 B2B SaaS companies in India hiring ${pivot0.role} leaders in 2026 for ${u.name}.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget salary: ${cardData.card4_pivot?.negotiation?.open_with || ''}\n\nFor each company: why they fit this profile specifically, appropriate role title and seniority, salary range including ESOPs, one credential to lead with in the application, best application route (direct/LinkedIn/referral).` },
      { label: "30-day action plan", icon: "📋", title: "30-Day Action Plan", promptText: `Create a 30-day action plan for ${u.name} to land a ${pivot0.role} role in India.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget: ${cardData.card4_pivot?.negotiation?.open_with || ''} base\n\nPlan:\n${day1to3Line}\nDays 4–7: Research 10 target companies, map specific credentials to each JD\nDays 8–14: 5 tailored applications with evidence mapped to each company\nDays 15–20: Referral activation — personalised outreach for each target company\nDays 21–25: Interview prep using STAR answers built from resume evidence\nDays 26–30: Follow-up cadence, negotiation preparation, offer evaluation framework\n\nFor each week: specific daily actions, time estimates, success metrics.` },
    ];
  }, [cardData]);

  if (!analysisId) return null;

  // Progress is based on all 9 tabs (Verdict → Tools)
  const progressPct = Math.min(100, ((Math.min(currentCard, TOTAL_JOURNEY_TABS - 1) + 1) / TOTAL_JOURNEY_TABS) * 100);

  const getTabState = (i: number) => {
    if (i === currentCard) return "active";
    if (visitedCards.has(i)) return "done";
    return "unvisited";
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

        {/* ── Sign-in banner for anonymous users ── */}
        {showSavePrompt && cardData && (
          <div style={{ background: "var(--mb-navy)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 800, color: "white", marginBottom: 2 }}>
                💾 Save your results
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                Sign in to track score changes and get weekly updates
              </div>
            </div>
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem('jb_post_auth_redirect', `${window.location.pathname}${window.location.search}`);
                } catch {}
                window.location.href = '/auth';
              }}
              style={{ background: "white", color: "var(--mb-navy)", border: "none", borderRadius: 10, padding: "8px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}
            >
              Sign In / Sign Up →
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "var(--mb-ink)", letterSpacing: "-0.01em" }}>JobBachao</div>
          {cardData && !HEADER_SCORE_HIDDEN_TABS.has(currentCard) && (
            // Hidden on Verdict (0 — own hero), Shield (3 — sub-score conflict),
            // and Tools (8 — utility tab) to keep each frame focused.
            <div
              style={{ display: "flex", alignItems: "baseline", gap: 6 }}
              title="Your overall JobBachao Career Safety Score (0–100). Higher = safer. Different from the AI Exposure score on the Risk tab."
            >
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "var(--mb-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>Career Safety</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 800, color: "var(--mb-navy)", letterSpacing: "-0.02em" }}>{displayScore}</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "var(--mb-muted)", letterSpacing: "0.1em" }}>/100</span>
            </div>
          )}
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

        {/* Navigation — scrollable pill row, works on any screen size */}
        {cardData && !loading && (
          <div style={{ marginBottom: 20, WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {TAB_LABELS.map((label, i) => {
                const state = getTabState(i);
                const isActive = state === "active";
                const isDone = state === "done";
                return (
                  <button
                    key={i}
                    onClick={() => handleTabChange(i)}
                    style={{
                      flexShrink: 0,
                      padding: "8px 14px",
                      background: isActive ? "var(--mb-navy)" : isDone ? "rgba(26,107,60,0.08)" : "var(--mb-paper)",
                      border: isActive ? "1.5px solid var(--mb-navy)" : isDone ? "1.5px solid rgba(26,107,60,0.25)" : "1.5px solid var(--mb-rule)",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: isActive ? 800 : 600,
                      color: isActive ? "white" : isDone ? "#1A6B3C" : "var(--mb-ink3)",
                      whiteSpace: "nowrap",
                      transition: "all 150ms",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      minHeight: 36,
                    }}
                  >
                    {isDone && !isActive && <span style={{ fontSize: 10 }}>✓</span>}
                    {label}
                  </button>
                );
              })}
            </div>
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

        {/* Error state — with auto-retry and clear messaging */}
        {error && !loading && (() => {
          const isForbidden = /forbidden|403|different account|not found|404/i.test(error);
          const isScanIncomplete = /didn't complete|not ready|scan_not_ready|run a new scan|start a new scan/i.test(error);
          if (isScanIncomplete) {
            return (
              <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: 440, margin: "0 auto" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8 }}>
                  This scan didn't complete
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 24, lineHeight: 1.7 }}>
                  The original scan failed before producing a report — usually because the resume or LinkedIn URL couldn't be parsed. Run a fresh scan to get your analysis (takes about a minute).
                </div>
                <button
                  onClick={() => { window.location.href = "/"; }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 12, padding: "14px 32px", cursor: "pointer", minHeight: 48 }}
                >
                  Start a fresh scan
                </button>
              </div>
            );
          }
          if (isForbidden) {
            return (
              <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: 440, margin: "0 auto" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8 }}>
                  This scan belongs to another account
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 24, lineHeight: 1.7 }}>
                  You're signed in with a different email than the one that created this analysis. Sign in with the original account, or run a fresh scan now — it takes about a minute.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { window.location.href = "/"; }}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 12, padding: "14px 28px", cursor: "pointer", minHeight: 48 }}
                  >
                    Start a fresh scan
                  </button>
                  <button
                    onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)", background: "transparent", border: "1.5px solid var(--mb-ink)", borderRadius: 12, padding: "14px 28px", cursor: "pointer", minHeight: 48 }}
                  >
                    Switch account
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8 }}>
                Analysis still generating
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 24, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>
                Our AI engine is processing your profile. This usually takes 30–60 seconds. Your data is safe — tap below to check again.
              </div>
              <button
                onClick={() => { setError(""); fetchAnalysis(); }}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 12, padding: "14px 32px", cursor: "pointer", minHeight: 48, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                ↻ Check again
              </button>
              <div style={{ marginTop: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)" }}>
                {error.includes("non-2xx") ? "AI engine busy — this resolves automatically" : error}
              </div>
            </div>
          );
        })()}

        {/* Main content */}
        {cardData && !loading && !error && (
          <>
            {currentCard === 0 && <Card0Verdict cardData={cardData} onNext={() => handleTabChange(1)} />}
            {currentCard === 1 && <Card1RiskMirror cardData={cardData} onNext={() => handleTabChange(2)} monthlyScanCount={monthlyScanCount} />}
            {currentCard === 2 && <Card2MarketRadar cardData={cardData} onBack={() => handleTabChange(1)} onNext={() => handleTabChange(3)} />}
            {currentCard === 3 && <Card3SkillShield cardData={cardData} onBack={() => handleTabChange(2)} onNext={() => handleTabChange(4)} overallScore={displayScore} scanId={analysisId ?? undefined} onUpgradePlan={() => {
              logEvent("modal_opened", { source: "upgrade_plan" });
              setActionModal({
                title: "60-Day Skill Upgrade Plan",
                promptText: `Create a 60-day skill upgrade plan for ${cardData.user?.name} based on their resume.\n\nCurrent skills: ${(cardData.card3_shield?.skills || []).map((s: any) => s.name).join(", ")}\nSkill gaps: ${(cardData.card3_shield?.skills || []).filter((s: any) => s.level === "buildable" || s.level === "critical-gap").map((s: any) => s.name).join(", ")}\n\nFor each week:\n- Specific learning resources (free, India-accessible)\n- Practice exercises with measurable outcomes\n- Portfolio project milestones\n- Time estimates (assume 1hr/day on weekdays)`
              });
            }} />}
            {currentCard === 4 && <Card4PivotPaths cardData={cardData} onBack={() => handleTabChange(3)} onNext={() => handleTabChange(5)} scanId={analysisId ?? undefined} />}
            {currentCard === 5 && <Card5JobsTracker cardData={cardData} onBack={() => handleTabChange(4)} onNext={() => handleTabChange(6)} analysisId={analysisId} />}
            {currentCard === 6 && <Card6BlindSpots cardData={cardData} onBack={() => handleTabChange(5)} onNext={() => handleTabChange(7)} scanId={analysisId ?? undefined} />}
            {currentCard === 7 && <Card7HumanAdvantage cardData={cardData} onBack={() => handleTabChange(6)} onNext={() => handleTabChange(8)} copyFallback={handleCopyFallback} analysisId={analysisId} />}

            {/* ── Tools tab (index 8) ─────────────────────────────────
                Three fully-built features that were unreachable in the old flow.
                Lazy-loaded — zero bundle cost until the user taps Tools. */}
            {currentCard === 8 && (() => {
              // Build a minimal ScanReport-shaped object from cardData so the
              // existing tool components (built for ScanReport) work without changes.
              const syntheticReport = {
                role: cardData.user?.current_title || "Professional",
                industry: cardData.user?.industry || "Technology",
                determinism_index: cardData.risk_score || 55,
                moat_score: cardData.shield_score || 50,
                all_skills: (cardData.card3_shield?.skills || []).map((s: any) => s.name),
                moat_skills: (cardData.card3_shield?.skills || []).filter((s: any) => s.level === "best-in-class" || s.level === "strong").map((s: any) => s.name),
                execution_skills_dead: (cardData.card3_shield?.skills || []).filter((s: any) => s.level === "critical-gap").map((s: any) => s.name),
                free_advice_1: cardData.card6_blindspots?.blind_spots?.[0]?.body || "",
                free_advice_2: cardData.card6_blindspots?.blind_spots?.[1]?.body || "",
                seniority_tier: "PROFESSIONAL" as const,
                survivability: { score: 100 - (cardData.risk_score || 55), breakdown: { experience_bonus: 0, strategic_bonus: 0, geo_bonus: 0, adaptability_bonus: 0 }, primary_vulnerability: cardData.card6_blindspots?.blind_spots?.[0]?.title || "" },
                country: "IN",
              } as any;

              return (
                <div style={{ paddingBottom: 32 }}>
                  {/* Header */}
                  <div style={{ background: "var(--mb-navy)", borderRadius: 16, padding: "20px 22px", marginBottom: 20, textAlign: "center" as const }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" as const, letterSpacing: "0.15em", marginBottom: 6 }}>Exclusive tools · Built for your profile</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "white" }}>Go deeper on your career intelligence</div>
                  </div>

                  <Suspense fallback={<div style={{ padding: 40, textAlign: "center" as const, color: "var(--mb-ink3)", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Loading tools…</div>}>

                    {/* Score Trend — how your risk score changed over time */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 12 }}>📈 Your Risk Score Over Time</div>
                      <ScoreTrendCard report={syntheticReport} scanId={analysisId ?? undefined} />
                    </div>

                    {/* Feature 3: Live Tavily learning resources for the Judo tool */}
                    {(weeklyIntelLoading || weeklyIntel) && (
                      <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-amber)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 12 }}>
                          🥋 LIVE LEARNING RESOURCES — {cardData.scan_judo?.recommended_tool || "Your Judo Tool"}
                        </div>
                        {weeklyIntelLoading && !weeklyIntel && (
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink3)", padding: "12px 0" }}>Searching Tavily for live resources…</div>
                        )}
                        {weeklyIntel?.summary && (
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, marginBottom: 14 }}>{weeklyIntel.summary}</div>
                        )}
                        {(weeklyIntel?.resources || []).slice(0, 4).map((r: any, i: number) => (
                          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: i < Math.min(3, (weeklyIntel?.resources?.length || 0) - 1) ? "1px solid var(--mb-rule)" : "none", textDecoration: "none" }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{r.type === "video" ? "▶️" : r.type === "course" ? "🎓" : "📖"}</span>
                            <div>
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-navy)", marginBottom: 2 }}>{r.title}</div>
                              {r.time_commitment && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--mb-ink3)" }}>{r.time_commitment}</div>}
                            </div>
                          </a>
                        ))}
                        {weeklyIntel?.citations && weeklyIntel.citations.length > 0 && (
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "var(--mb-ink4)", marginTop: 10 }}>Sources: {weeklyIntel.citations.slice(0, 2).join(" · ")}</div>
                        )}
                      </div>
                    )}

                    {/* Career Genome Debate — temporarily hidden to focus tokens on Resume Weaponizer */}
                    {/* <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 12 }}>🧬 Career Genome Debate</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 14, lineHeight: 1.6 }}>3 AI agents debate your career future. Pessimist. Optimist. Realist. Who's right?</div>
                      <CareerGenomeDebate report={syntheticReport} scanId={analysisId ?? ""} />
                    </div> */}

                    {/* Resume Weaponizer — rewrite your resume for the AI era */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 12 }}>⚔️ Resume Weaponizer</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 14, lineHeight: 1.6 }}>Rewrite your resume to emphasise AI-proof skills. Built from your actual profile.</div>
                      <ResumeWeaponizerCard report={syntheticReport} scanId={analysisId ?? ""} />
                    </div>

                    {/* Career Trajectory Engine */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <TrajectoryCard analysisId={analysisId ?? ""} cardData={cardData} />
                    </div>

                    {/* Peer Rank */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <PeerRankCard cardData={cardData} />
                    </div>

                    {/* Skill Compound Calculator */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <SkillCompoundCalculator cardData={cardData} />
                    </div>

                    {/* Office Power Vocabulary — Use This Not That */}
                    <div style={{ marginBottom: 20, background: "white", borderRadius: 16, padding: "20px", border: "1px solid var(--mb-rule)", boxShadow: "var(--mb-shadow-sm)" }}>
                      <OfficePowerVocab cardData={cardData} />
                    </div>

                  </Suspense>

                  <button onClick={() => handleTabChange(0)} style={{ width: "100%", padding: "14px", background: "var(--mb-navy)", color: "white", border: "none", borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                    ← Back to Verdict
                  </button>
                </div>
              );
            })()}

            {/* Bottom action buttons — hidden on Verdict (own CTAs) and Tools (utility tab) */}
            {!ACTION_BUTTONS_HIDDEN_TABS.has(currentCard) && (
              <div className="mb-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                {actionPrompts.map((action, i) => (
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
            )}
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
          promptText={buildStreakActions(cardData)[streak % 5] || "Give me one specific, actionable career task I can complete in the next 60 minutes to strengthen my professional position."}
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
