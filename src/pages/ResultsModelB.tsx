import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/styles/model-b-tokens.css";
import Card1RiskMirror from "@/components/model-b/Card1RiskMirror";
import LiveMarketCard from "@/components/model-b/LiveMarketCard";
import Card2MarketRadar from "@/components/model-b/Card2MarketRadar";
import IntelligenceMapCard from "@/components/model-b/IntelligenceMapCard";
import Card3SkillShield from "@/components/model-b/Card3SkillShield";
import Card4PivotPaths from "@/components/model-b/Card4PivotPaths";
import Card5JobsTracker from "@/components/model-b/Card5JobsTracker";
import Card6BlindSpots from "@/components/model-b/Card6BlindSpots";
import Card7HumanAdvantage from "@/components/model-b/Card7HumanAdvantage";
import Card0Verdict from "@/components/model-b/Card0Verdict";
import MondayMoveCard from "@/components/model-b/MondayMoveCard";
import RevealShareStrip from "@/components/RevealShareStrip";
import PromptModal from "@/components/model-b/PromptModal";
import { useScanFunnelTracking } from "@/hooks/use-scan-funnel-tracking";
import {
  trackRevealEvent,
  classifyRevealOpen,
  makeScrollDepthTracker,
} from "@/lib/reveal-tracking";

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
  "🛰️ Ingesting AI disruption signals from the last 24 hours...",
  "🧠 Routing your profile through a multi-model reasoning ensemble...",
  "📡 Cross-referencing 396 live AI tools against your skill graph...",
  "⚡ Computing AI exposure index — 6 deterministic risk factors...",
  "📊 Calibrating today's compensation benchmarks for your role and city...",
  "💼 Aggregating live hiring signals across the Indian job market...",
  "🛡️ Mapping your defensible moat — capabilities AI cannot replicate...",
  "🎯 Synthesizing your personalised 90-day defense protocol...",
  "🔄 Final calibration against India 2026 hiring + layoff telemetry...",
];

const STREAK_KEY = "jb_streak";
const STREAK_DATE_KEY = "jb_streak_date";

// C2: module-scope copy helpers — stable across renders, no useCallback needed.
function fallbackCopy(text: string) {
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
}
function handleCopyFallback(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

// Sprint 3 (2026-04-29) — tab merge surgery:
//   • Trends (Card2MarketRadar) merged INTO Live Market tab (stacked below)
//   • Human (Card7HumanAdvantage) merged INTO Blind spots tab (stacked below)
// Tab count: 10 → 8. All downstream indices shift accordingly.
const TAB_LABELS = ["Verdict", "Risk", "Live Market", "Shield", "Pivot", "Jobs", "Blind spots", "🛠 Tools"];
const TOOLS_TAB_INDEX = 7;

// Tabs where the header "Career Safety" score is hidden.
// 0 = Verdict, 3 = Shield (sub-score conflict), 7 = Tools.
const HEADER_SCORE_HIDDEN_TABS = new Set([0, 3, TOOLS_TAB_INDEX]);
// Tabs where the bottom action button grid is hidden — these tabs have their own
// dedicated CTAs and the grid would clutter the emotional/utility frame.
const ACTION_BUTTONS_HIDDEN_TABS = new Set([0, TOOLS_TAB_INDEX]);
// Friendly #2 (Farheen) feedback (2026-04-28):
//   • Verdict tab must be score-only — no Share Strip, no Monday Move on first frame.
//   • Monday Move felt redundant on every screen — restrict to the two action-y tabs.
const SHARE_STRIP_HIDDEN_TABS = new Set([0]);
const MONDAY_MOVE_VISIBLE_TABS = new Set([1, 4]); // Risk + Pivot Paths (post-Sprint-3 indices)
// P0 polish (2026-04-28): Tab 0 = pure verdict moment.
// Hide streak bar, progress bar and tab nav above the score so the
// first frame is exactly: logo → score card. Card0Verdict's onNext
// CTA carries the user forward; we don't strand them.
const FRAME_MINIMAL_TABS = new Set([0]);
// Total content tabs = single source of truth (avoids drift with TAB_LABELS).
const TOTAL_JOURNEY_TABS = TAB_LABELS.length;

// C1 #2: Streak now correctly resets to 1 if the user skips a day.
// Pure logic lives in src/lib/model-b-helpers.ts (BL-013 / INV-F02).
import { getAnalysisErrorCode, nextStreak, journeyProgressPct } from "@/lib/model-b-helpers";

function useStreak() {
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    const today = new Date();
    const stored = localStorage.getItem(STREAK_DATE_KEY);
    const current = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
    const next = nextStreak(today, stored, current);
    setStreak(next);
    if (stored !== today.toDateString()) {
      localStorage.setItem(STREAK_KEY, String(next));
      localStorage.setItem(STREAK_DATE_KEY, today.toDateString());
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
  // B1 (#4): Journey state is persisted per-scan in localStorage so a refresh
  // does not reset progress or re-trigger the +6 completion bonus.
  const journeyStorageKey = analysisId ? `jb_journey_${analysisId}` : null;
  const readJourneyState = (key: string | null) => {
    try {
      if (!key) return { visited: new Set([0]), done: false };
      const raw = localStorage.getItem(key);
      if (!raw) return { visited: new Set([0]), done: false };
      const parsed = JSON.parse(raw);
      return {
        visited: new Set<number>(Array.isArray(parsed?.visited) ? parsed.visited : [0]),
        done: Boolean(parsed?.done),
      };
    } catch { return { visited: new Set([0]), done: false }; }
  };
  const initialJourney = readJourneyState(journeyStorageKey);
  const [visitedCards, setVisitedCards] = useState<Set<number>>(initialJourney.visited);
  const [actionModal, setActionModal] = useState<{ title: string; promptText: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false); // show for any non-email user
  const [journeyDone, setJourneyDone] = useState(initialJourney.done);

  // Funnel instrumentation — fires result_loaded / card_viewed / journey_completed
  // into behavior_events. Single line of business logic; all behavior in the hook.
  useScanFunnelTracking({
    scanId: analysisId,
    resultLoaded: Boolean(cardData),
    currentCard,
    visitedCount: visitedCards.size,
    totalCards: TOTAL_JOURNEY_TABS,
  });
  // P-3-B: Fetch monthly scan count once here, pass to Card1RiskMirror as a prop.
  const [monthlyScanCount, setMonthlyScanCount] = useState<number | null>(null);
  // Risk-card rupee anchoring: pull the user's estimated monthly salary from the
  // scan record so Card1 can convert percentage gaps into absolute ₹ values.
  // (Component layer — does not change LLM contract.)
  const [monthlySalaryInr, setMonthlySalaryInr] = useState<number | null>(null);
  // Feature 3: Weekly intel for the Tools tab Judo section — fetched lazily when Tools tab opens.
  const [weeklyIntel, setWeeklyIntel] = useState<WeeklyIntelData | null>(null);
  const [weeklyIntelLoading, setWeeklyIntelLoading] = useState(false);
  // B5 (#11): displayScore is derived from the canonical jobbachao_score plus
  // the journey-completion bonus. Avoids drift, survives refresh correctly,
  // and removes 4 setDisplayScore call sites that could fall out of sync.
  const baseScore = cardData?.jobbachao_score || 0;
  const displayScore = useMemo(
    () => (journeyDone ? baseScore + 6 : baseScore),
    [baseScore, journeyDone],
  );

  const streak = useStreak();
  const [streakModal, setStreakModal] = useState(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Polling lifecycle refs — guard against unmount leaks and double-chains (P0 #1, #2, #19)
  const isMountedRef = useRef(true);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intelRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGenerationRef = useRef(0); // increments on each fetchAnalysis to invalidate prior chains

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (intelRetryTimeoutRef.current) clearTimeout(intelRetryTimeoutRef.current);
    };
  }, []);

  // B1 follow-up: re-sync journey state when analysisId changes (SPA navigation
  // between two scans). Without this, scan-A's visited/done state would persist
  // into scan-B until a hard refresh.
  useEffect(() => {
    const next = readJourneyState(journeyStorageKey);
    setVisitedCards(next.visited);
    setJourneyDone(next.done);
    setCurrentCard(0);
    setActionModal(null); // C1 #10: clear stale modal when scan switches
    // readJourneyState is stable (no closure deps that change per-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyStorageKey]);

  // Log helper — cardData is in deps (C1 #5) so behavioural signals carry the
  // role/industry/score context once analysis lands, instead of always nulls.
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
  }, [analysisId, userId, cardData]);

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
      const { data: userResp, error: userErr } = await supabase.auth.getUser();
      if (!isMountedRef.current || myGen !== pollGenerationRef.current) return;

      // Stale JWT recovery: if the auth user no longer exists (e.g. account
      // was deleted server-side) Supabase returns 403 user_not_found. The
      // local session is unusable — sign out and bounce to /auth instead of
      // calling the edge function with user_id: null (which 400s).
      const errMsg = (userErr as any)?.message || (userErr as any)?.code || "";
      if (userErr && /user_not_found|not.?found|jwt|sub.?claim/i.test(String(errMsg))) {
        try { await supabase.auth.signOut(); } catch {}
        navigate("/auth", { replace: true });
        return;
      }

      const user = userResp?.user;
      const uid = user?.id || null;
      setUserId(uid);
      // Show save prompt if no email (anonymous or not logged in at all)
      setShowSavePrompt(!user?.email);

      if (!uid) {
        setError("Please sign in to view this analysis.");
        setShowSavePrompt(true);
        setLoading(false);
        return;
      }

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
        if (getAnalysisErrorCode(parsed) === "SCAN_NOT_READY") {
          setError("This scan didn't complete. Start a new scan to view your analysis.");
          setLoading(false);
          return;
        }
        if (getAnalysisErrorCode(parsed) === "AUTH_REQUIRED") {
          setError("Please sign in to view this analysis.");
          setShowSavePrompt(true);
          setLoading(false);
          return;
        }
        if (getAnalysisErrorCode(parsed) === "FORBIDDEN") {
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
      if (!data?.success) {
        const code = getAnalysisErrorCode(data);
        if (code === "SCAN_NOT_READY") {
          setError("This scan didn't complete. Start a new scan to view your analysis.");
          setLoading(false);
          return;
        }
        if (code === "AUTH_REQUIRED") {
          setError("Please sign in to view this analysis.");
          setShowSavePrompt(true);
          setLoading(false);
          return;
        }
        if (code === "FORBIDDEN") {
          try {
            localStorage.removeItem("jb_last_scan_id");
            localStorage.removeItem("lastScanId");
          } catch {}
          setError(data.error || "This analysis belongs to a different account. Start a new scan.");
          setLoading(false);
          return;
        }
        throw new Error(data?.error || "Analysis failed");
      }

      // If we got data immediately (cache hit), use it
      if (data.data?.card_data) {
        const cd = data.data.card_data;
        setCardData(cd);
        // displayScore is derived from cardData (B5) — no separate state to set.
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
    const MAX_POLLS = 30; // 30 × 3s = 90s, matches loader animation (C1 #1)
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
          // displayScore is derived (B5).
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
            // displayScore is derived (B5).
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

    // Pull monthly salary for this scan so Card1 can render rupee-anchored cost lines.
    if (analysisId) {
      supabase
        .from("scans")
        .select("estimated_monthly_salary_inr")
        .eq("id", analysisId)
        .maybeSingle()
        .then(({ data }) => {
          if (!isMountedRef.current) return;
          const v = (data as any)?.estimated_monthly_salary_inr;
          if (typeof v === "number" && v > 0) setMonthlySalaryInr(v);
        }, () => { /* swallow silently — card has graceful fallback */ });
    }
  }, [analysisId, navigate, fetchAnalysis]);

  // Friendly debrief instrumentation (2026-04-28).
  // Three signals captured here:
  //   1. reveal_opened / reveal_reopened — fired exactly once per scan per device
  //      (localStorage marker keyed on scan id) so we can compute return-rate.
  //   2. scroll_depth — fires once each at 25/50/75/100% of page scroll. The
  //      `crossed` Set lives in a ref so threshold de-duplication survives
  //      re-renders; we re-allocate it whenever the scan changes.
  //   3. (share/CTA events live on the buttons themselves, not in this effect.)
  // Gated on `cardData` so we don't fire opens before the payload is on screen.
  const scrollCrossedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!analysisId || !cardData) return;
    scrollCrossedRef.current = new Set();

    const ctx = {
      scanId: analysisId,
      userId,
      scanRole: cardData?.user?.current_title ?? null,
      scanIndustry: cardData?.user?.industry ?? null,
      scanScore:
        typeof cardData?.jobbachao_score === "number" ? cardData.jobbachao_score : null,
      scanCity: cardData?.user?.location ?? null,
    };

    const openType = classifyRevealOpen(analysisId);
    if (openType) {
      trackRevealEvent(openType, ctx, {
        viewport_w: typeof window !== "undefined" ? window.innerWidth : null,
      });
    }

    const handler = makeScrollDepthTracker(scrollCrossedRef.current, (pct) => {
      trackRevealEvent("scroll_depth", ctx, { pct });
    });
    window.addEventListener("scroll", handler, { passive: true });
    handler(); // fire once in case page is shorter than viewport
    return () => window.removeEventListener("scroll", handler);
  }, [analysisId, cardData, userId]);

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
    // B3 (#12): one retry on failure before giving up silently.
    if (index === TOOLS_TAB_INDEX && !weeklyIntelLoading && !weeklyIntel && cardData?.scan_judo?.recommended_tool) {
      setWeeklyIntelLoading(true);
      const body = {
        role: cardData.user?.current_title || "",
        judo_tool: (cardData.scan_judo as any)?.recommended_tool || "",
        industry: cardData.user?.industry || "",
        scanId: analysisId,
      };
      const tryFetch = (attempt: number): Promise<void> =>
        supabase.functions.invoke("fetch-weekly-intel", { body })
          .then(({ data, error }) => {
            if (error) throw error;
            if (!isMountedRef.current) return;
            if (data?.resources?.length || data?.summary) setWeeklyIntel(data);
          })
          .catch(() => {
            if (attempt < 1 && isMountedRef.current) {
              return new Promise<void>(resolve => {
                // Dedicated ref so unmount during the 1.5s wait cancels the retry
                // without colliding with the polling chain (pollTimeoutRef).
                intelRetryTimeoutRef.current = setTimeout(() => {
                  intelRetryTimeoutRef.current = null;
                  resolve();
                }, 1500);
              }).then(() => isMountedRef.current ? tryFetch(attempt + 1) : undefined);
            }
          });
      tryFetch(0).finally(() => { if (isMountedRef.current) setWeeklyIntelLoading(false); });
    }
  }, [logEvent, weeklyIntelLoading, weeklyIntel, cardData, analysisId]);

  // B1 (#4): Persist visited tabs + completion every time they change so refresh
  // restores progress instead of resetting it.
  useEffect(() => {
    if (!journeyStorageKey) return;
    try {
      localStorage.setItem(journeyStorageKey, JSON.stringify({
        visited: Array.from(visitedCards),
        done: journeyDone,
      }));
    } catch {}
  }, [journeyStorageKey, visitedCards, journeyDone]);

  // Journey complete detection — only fires when user has explored ALL 9 tabs (0..8).
  // Idempotent: bonus is only applied if not already persisted as done.
  useEffect(() => {
    if (journeyDone) return;
    if (visitedCards.size >= TOTAL_JOURNEY_TABS && cardData) {
      setJourneyDone(true);
      // displayScore picks up the +6 automatically via the journeyDone useMemo (B5).
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
      { label: "Write LinkedIn post", icon: "✏️", title: "LinkedIn Post · Lead with your strongest credential", promptText: `Write a LinkedIn post for ${u.name} announcing they are open to ${pivot0.role} roles at Indian B2B SaaS companies.\n\nKey evidence:\n${advProofs}\n- ${u.years_experience}+ years experience · Available ${u.availability} · ${u.location}\n\nRequirements:\n- Open with one extraordinary number — NOT 'I am excited to announce'\n- Maximum 200 words · Zero buzzwords · Specific\n- Clear CTA for hiring managers\n- Confident, direct tone\n- End the post with: "Career check by @JobBachao 🛡️" on its own line, then 3 hashtags: #FutureProof #CareerAlpha #JobBachao` },
      { label: "Rewrite resume", icon: "📄", title: "Resume Rewrite — Move the numbers to the top", promptText: `Rewrite the Professional Summary and top bullets for ${u.name}'s resume for ${pivot0.role} roles at Indian B2B SaaS companies.\n\nTarget title: ${pivot0.role}\nCurrent title: ${u.current_title}\n\nStrongest evidence to surface (currently buried):\n${advProofs}\n\nATS keywords to include: ${missingKw}\n\nRules:\n- Summary must open with top credential within the first 10 words\n- Every bullet: outcome first → scale/impact → method at the end\n- Move all numbers from achievements sections into relevant job bullets\n- No bullet starts with a tool name or a verb without a number` },
      { label: "Top 10 companies", icon: "🏢", title: "Top 10 India B2B SaaS Companies", promptText: `Top 10 B2B SaaS companies in India hiring ${pivot0.role} leaders in 2026 for ${u.name}.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget salary: ${cardData.card4_pivot?.negotiation?.open_with || ''}\n\nFor each company give: 1) why they fit this profile specifically, 2) appropriate role title and seniority, 3) salary range including ESOPs (₹ LPA), 4) one credential to lead with in the application, 5) best application route — and where possible the LinkedIn careers URL or a hiring manager search link (e.g. linkedin.com/search/results/people/?keywords=${encodeURIComponent(pivot0.role || u.current_title || '')}%20at%20<company>). Format as a numbered list, one company per block.` },
      { label: "Weekly action plan", icon: "📋", title: "Your Weekly Action Plan (Indian working hours)", promptText: `Create a realistic WEEKLY action plan for ${u.name} to land a ${pivot0.role} role in India.\n\nProfile: ${u.years_experience}+ years · ${u.current_title} · ${u.location} · Available ${u.availability}\nTop credential: ${cardData.card7_human?.advantages?.[0]?.proof_label || ''}\nTarget: ${cardData.card4_pivot?.negotiation?.open_with || ''} base\n\nDESIGN RULES (critical — follow exactly):\n- This is a recurring WEEKLY plan (not a 30-day march). Indians plan in week-cycles around the Sunday reset.\n- Weekday cap: 1 hour/day Mon–Fri (after-office reality)\n- Weekend cap: 2–3 hours/day Sat–Sun\n- Total ≤ 11 hours/week. Anything over = unrealistic, will be ignored.\n\nFormat as a single week (Monday → Sunday), then a "Repeat next week with these tweaks" section.\n\nFor each day:\n- ⏱ Time block (e.g. "Mon · 9–10pm")\n- 🎯 Single concrete action (no vague verbs like "research" — say what to produce)\n- ✅ Visible deliverable by end of session (1 message sent, 1 bullet rewritten, 1 doc opened)\n\nStart with: ${day1to3Line}\nThen distribute: company research → tailored applications → referral outreach → interview reps → follow-up cadence across the week.\n\nEnd with one line: "Mark your Sunday for a 30-min review — this is the only meeting that compounds."` },
    ];
  }, [cardData]);

  if (!analysisId) return null;

  // Progress is based on all 9 tabs (Verdict → Tools)
  // C1 #7: progress reflects actual exploration (visited tabs), not just current index.
  // Pure logic in src/lib/model-b-helpers.ts (BL-014 / INV-F03).
  const progressPct = journeyProgressPct(visitedCards.size, TOTAL_JOURNEY_TABS);

  const getTabState = (i: number) => {
    if (i === currentCard) return "active";
    if (visitedCards.has(i)) return "done";
    return "unvisited";
  };

  // C2: copy helpers reference the module-scope functions (stable, no realloc per render)

  // Personalisation backbone (Farheen feedback, 2026-04-29):
  // Single derivation reused by RevealShareStrip + MondayMoveCard so the
  // user's first name is consistent across surfaces. Empty/missing name
  // becomes null — every consumer must guard for that.
  const revealFirstName = useMemo<string | null>(() => {
    const raw = (cardData?.user?.full_name || cardData?.user?.name || "")
      .toString()
      .trim()
      .split(/\s+/)[0];
    return raw && raw.length > 0 ? raw : null;
  }, [cardData?.user?.full_name, cardData?.user?.name]);

  // Browser-tab personalisation: name in <title> earns trust on back-button +
  // tab-switch. Falls back to product name when no first name is available.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    document.title = revealFirstName
      ? `${revealFirstName}'s career reality check · JobBachao`
      : "Career reality check · JobBachao";
    return () => { document.title = previous; };
  }, [revealFirstName]);

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

        {/* Streak bar — hidden on Verdict tab so the score lands first */}
        {cardData && !loading && !FRAME_MINIMAL_TABS.has(currentCard) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 12, marginBottom: 18, boxShadow: "var(--mb-shadow-sm)" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: "var(--mb-navy)" }}>🔥 {streak}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-navy)", flex: 1 }}>day streak</span>
            <button
              onClick={() => {
                if (typeof console !== "undefined") {
                  // eslint-disable-next-line no-console
                  console.log("[jb] today's action tapped, streak=", streak);
                }
                setStreakModal(true);
              }}
              className="mb-btn-primary mb-attn-pulse"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "1.5px solid var(--mb-navy)", borderRadius: 20, padding: "8px 14px", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", gap: 4, transition: "all 150ms", WebkitTapHighlightColor: "rgba(255,255,255,0.2)" }}
            >Today's task →</button>
          </div>
        )}

        {/* Progress bar — hidden on Verdict tab (no journey context yet) */}
        {cardData && !loading && !FRAME_MINIMAL_TABS.has(currentCard) && (
          <div style={{ height: 4, background: "var(--mb-rule)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: 4, background: "var(--mb-navy)", borderRadius: 2, width: `${progressPct}%`, transition: "width 0.4s ease" }} />
          </div>
        )}

        {/* Navigation — scrollable pill row. Hidden on Verdict tab so the score isn't competing with 10 chrome pills. Card0Verdict's own onNext CTA moves the user forward. */}
        {cardData && !loading && !FRAME_MINIMAL_TABS.has(currentCard) && (
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 8, lineHeight: 1.25 }}>
              Stress-testing your career against every frontier model and the last 24 hours of market signals
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", marginBottom: 4 }}>
              {cardData?.resume_filename || "Your Resume"} · multi-model reasoning ensemble · 396-tool exposure catalog · live India hiring telemetry
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink4)", marginBottom: 24, minHeight: 20 }}>
              {LOADING_MESSAGES[loadingMsg]}
            </div>
            {/* Progress bar — animation duration matches MAX_POLLS (30 × 3s = 90s)
                so the bar never visually "completes" while polling is still active.
                Keyframes live in model-b-tokens.css (C2). */}
            <div style={{ maxWidth: 320, margin: "0 auto", height: 4, background: "var(--mb-rule)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: 4, background: "var(--mb-navy)", borderRadius: 2, width: "0%", animation: "mbLoadBar 90s cubic-bezier(0.1, 0.6, 0.3, 1) forwards" }} />
            </div>
          </div>
        )}

        {/* Error state — with auto-retry and clear messaging */}
        {error && !loading && (() => {
          // Order matters: FORBIDDEN messages can also contain "start a new scan",
          // so we must check forbidden/auth FIRST and only fall through to
          // "scan didn't complete" for genuine SCAN_NOT_READY cases.
          const isForbidden = /forbidden|different account|belongs to another|403/i.test(error);
          const isAuthRequired = /please sign in|auth_required|401/i.test(error);
          const isScanIncomplete = !isForbidden && !isAuthRequired &&
            /didn't complete|not ready|scan_not_ready/i.test(error);
          if (isForbidden) {
            // Render forbidden branch (defined below) by falling through
          }
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
            {!SHARE_STRIP_HIDDEN_TABS.has(currentCard) && (
              <RevealShareStrip
                ctx={{
                  scanId: analysisId,
                  userId,
                  scanRole: cardData?.user?.current_title ?? null,
                  scanIndustry: cardData?.user?.industry ?? null,
                  scanScore:
                    typeof cardData?.jobbachao_score === "number"
                      ? cardData.jobbachao_score
                      : null,
                  scanCity: cardData?.user?.location ?? null,
                }}
                firstName={revealFirstName}
              />
            )}
            {MONDAY_MOVE_VISIBLE_TABS.has(currentCard) && <MondayMoveCard cardData={cardData} firstName={revealFirstName} />}
            {currentCard === 0 && <Card0Verdict cardData={cardData} scanId={analysisId ?? undefined} onNext={() => handleTabChange(1)} />}
            {currentCard === 1 && <Card1RiskMirror cardData={cardData} onBack={() => handleTabChange(0)} onNext={() => handleTabChange(2)} monthlyScanCount={monthlyScanCount} monthlySalaryInr={monthlySalaryInr} firstName={revealFirstName} />}
            {/* Sprint 3: Tab 2 = Live Market + Trends (Card2MarketRadar) stacked. */}
            {currentCard === 2 && (() => {
              const u = cardData.user || {};
              const role = u.current_title || cardData.role || "Professional";
              const city = u.location || u.city || cardData.country || "India";
              const skills = (cardData.card3_shield?.skills || []).map((s: any) => s.name).filter(Boolean);
              return (
                <>
                  <LiveMarketCard
                    role={role}
                    city={city}
                    all_skills={skills}
                    onPrev={() => handleTabChange(1)}
                    /* onNext intentionally omitted — single nav lives on the Trends section below */
                  />
                  <div style={{ height: 24 }} />
                  <Card2MarketRadar cardData={cardData} />
                  <div style={{ height: 24 }} />
                  {/* Sprint 4 (2026-04-29): KG IP surfaced in Live Market tab. Self-hides if data is too thin. */}
                  <IntelligenceMapCard cardData={cardData} />
                  <div style={{ height: 24 }} />
                  {/* Single forward nav for the merged tab */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleTabChange(3)}
                      style={{
                        background: "var(--mb-navy)",
                        color: "var(--mb-paper)",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 18px",
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        boxShadow: "var(--mb-shadow-md)",
                      }}
                    >
                      Continue → Skill Shield
                    </button>
                  </div>
                </>
              );
            })()}
            {currentCard === 3 && <Card3SkillShield cardData={cardData} onBack={() => handleTabChange(2)} onNext={() => handleTabChange(4)} overallScore={baseScore} scanId={analysisId ?? undefined} onUpgradePlan={() => {
              logEvent("modal_opened", { source: "upgrade_plan" });
              setActionModal({
                title: "60-Day Skill Upgrade Plan",
                promptText: `Create a 60-day skill upgrade plan for ${cardData.user?.name} based on their resume.\n\nCurrent skills: ${(cardData.card3_shield?.skills || []).map((s: any) => s.name).join(", ")}\nSkill gaps: ${(cardData.card3_shield?.skills || []).filter((s: any) => s.level === "buildable" || s.level === "critical-gap").map((s: any) => s.name).join(", ")}\n\nFor each week:\n- Specific learning resources (free, India-accessible)\n- Practice exercises with measurable outcomes\n- Portfolio project milestones\n- Time estimates (assume 1hr/day on weekdays)`
              });
            }} />}
            {currentCard === 4 && <Card4PivotPaths cardData={cardData} onBack={() => handleTabChange(3)} onNext={() => handleTabChange(5)} scanId={analysisId ?? undefined} />}
            {currentCard === 5 && <Card5JobsTracker cardData={cardData} onBack={() => handleTabChange(4)} onNext={() => handleTabChange(6)} analysisId={analysisId} />}
            {/* Sprint 3: Tab 6 = Blind spots + Human Advantage (Card7) stacked. */}
            {currentCard === 6 && (
              <>
                <Card6BlindSpots
                  cardData={cardData}
                  onBack={() => handleTabChange(5)}
                  /* onNext omitted — forward nav lives on the Human section below */
                  scanId={analysisId ?? undefined}
                  firstName={revealFirstName}
                />
                <div style={{ height: 24 }} />
                <Card7HumanAdvantage
                  cardData={cardData}
                  /* onBack omitted — back nav lives on Card6BlindSpots above */
                  onNext={() => handleTabChange(TOOLS_TAB_INDEX)}
                  copyFallback={handleCopyFallback}
                  analysisId={analysisId}
                />
              </>
            )}

            {/* ── Tools tab (index 7, post-Sprint-3) ───────────────────── */}
            {currentCard === TOOLS_TAB_INDEX && (() => {
              // Build a minimal ScanReport-shaped object from cardData so the
              // existing tool components (built for ScanReport) work without changes.
              // B4 (#24): country and seniority_tier now derived from cardData
              // instead of hardcoded "IN" / "PROFESSIONAL".
              const u = cardData.user || {};
              const detectedCountry = (u.country || cardData.country || "IN").toString().toUpperCase();
              const yearsNum = parseInt(String(u.years_experience || "").replace(/[^\d]/g, ""), 10);
              const detectedSeniority = !isNaN(yearsNum)
                ? (yearsNum >= 15 ? "EXECUTIVE" : yearsNum >= 8 ? "SENIOR" : yearsNum >= 3 ? "PROFESSIONAL" : "EARLY")
                : "PROFESSIONAL";
              const syntheticReport = {
                role: u.current_title || "Professional",
                industry: u.industry || "Technology",
                determinism_index: cardData.risk_score || 55,
                moat_score: cardData.shield_score || 50,
                all_skills: (cardData.card3_shield?.skills || []).map((s: any) => s.name),
                moat_skills: (cardData.card3_shield?.skills || []).filter((s: any) => s.level === "best-in-class" || s.level === "strong").map((s: any) => s.name),
                execution_skills_dead: (cardData.card3_shield?.skills || []).filter((s: any) => s.level === "critical-gap").map((s: any) => s.name),
                free_advice_1: cardData.card6_blindspots?.blind_spots?.[0]?.body || "",
                free_advice_2: cardData.card6_blindspots?.blind_spots?.[1]?.body || "",
                seniority_tier: detectedSeniority as any,
                survivability: { score: 100 - (cardData.risk_score || 55), breakdown: { experience_bonus: 0, strategic_bonus: 0, geo_bonus: 0, adaptability_bonus: 0 }, primary_vulnerability: cardData.card6_blindspots?.blind_spots?.[0]?.title || "" },
                country: detectedCountry,
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
            {!ACTION_BUTTONS_HIDDEN_TABS.has(currentCard) && actionPrompts.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--mb-ink3)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ flex: "0 0 auto" }} aria-hidden>⚡</span>
                  <span>Quick actions</span>
                  <span style={{ flex: 1, height: 1, background: "var(--mb-rule)" }} />
                </div>
                <div className="mb-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {actionPrompts.map((action, i) => (
                    <button
                      key={i}
                      className="mb-btn-secondary"
                      onClick={() => {
                        // Diagnostic: friendly #2 said "bottom 4 not working" — log every tap
                        // so the next debrief tells us if buttons are silent or content fails.
                        if (typeof console !== "undefined") {
                          // eslint-disable-next-line no-console
                          console.log("[jb] action button tapped:", action.label);
                        }
                        logEvent("modal_opened", { source: action.label });
                        setActionModal({ title: action.title, promptText: action.promptText });
                      }}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        padding: "14px 14px",
                        borderRadius: 12,
                        cursor: "pointer",
                        border: "1.5px solid var(--mb-navy-tint2)",
                        background: "var(--mb-navy-tint)",
                        color: "var(--mb-navy)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 150ms",
                        minHeight: 56,
                        boxShadow: "var(--mb-shadow-sm)",
                        WebkitTapHighlightColor: "rgba(27,47,85,0.15)",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{action.icon}</span>
                      <span style={{ flex: 1, textAlign: "left", lineHeight: 1.3 }}>{action.label}</span>
                      <span style={{ fontSize: 14, opacity: 0.55, flexShrink: 0 }}>→</span>
                    </button>
                  ))}
                </div>
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
          promptText={buildStreakActions(cardData)[(Math.max(1, streak) - 1) % 5] || "Give me one specific, actionable career task I can complete in the next 60 minutes to strengthen my professional position."}
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
