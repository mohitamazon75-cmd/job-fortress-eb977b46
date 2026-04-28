import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import HeroSection from '@/components/HeroSection';
import SocialProofSection from '@/components/SocialProofSection';
import InputMethodStep from '@/components/InputMethodStep';
// ── AuthOrAnon replaces AuthGuard in the auth-gate phase (see Index.tsx:~89) ─
import ReAuthModal from '@/components/ReAuthModal';
import RescanDetector from '@/components/RescanDetector';
import RateLimitUpsell from '@/components/RateLimitUpsell';
import GoalCaptureModal, { type ScanGoals } from '@/components/GoalCaptureModal';
import OnboardingFlow from '@/components/OnboardingFlow';
import ThankYouFooter from '@/components/ThankYouFooter';
import { useAuth } from '@/hooks/useAuth';

// Sprint 8: Lazy-load heavy components with one-time retry for stale chunk errors
// Keep the first-step onboarding screen in the main bundle to avoid critical-path lazy chunk failures.
const lazyWithRetry = (importFn: () => Promise<any>) => lazy(async () => {
  try {
    const mod = await importFn();
    try { sessionStorage.removeItem('jb_lazy_retry_once'); } catch {}
    return mod;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);
    const hasRetried = (() => {
      try { return sessionStorage.getItem('jb_lazy_retry_once') === '1'; } catch { return false; }
    })();

    if (isChunkError && !hasRetried) {
      try { sessionStorage.setItem('jb_lazy_retry_once', '1'); } catch {}
      const reloadKey = 'jb_chunk_error_reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem(reloadKey);
        console.error('Chunk load failed after reload attempt', error);
      }
      return new Promise(() => {}) as Promise<any>;
    }
    throw error;
  }
});

const MatrixLoading = lazyWithRetry(() => import('@/components/MatrixLoading'));
const SevenCardReveal = lazyWithRetry(() => import('@/components/SevenCardReveal'));
const AIDossierReveal = lazyWithRetry(() => import('@/components/AIDossierReveal'));
const MoneyShotCard = lazyWithRetry(() => import('@/components/MoneyShotCard'));
// CrisisSupport removed from MoneyShot flow — kept as standalone component for future use.
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport, createScan, uploadResume, triggerProcessScan, subscribeScanStatus } from '@/lib/scan-engine';
import { createClient } from '@supabase/supabase-js';
import { useAnalytics } from '@/hooks/use-analytics';
import { useLandingScrollDepth } from '@/hooks/use-landing-scroll-depth';
import { useRequestMutex } from '@/hooks/use-request-mutex';
import { useScanFlow } from '@/hooks/useScanFlow';
import { useOnboardingState, detectCountry } from '@/hooks/useOnboardingState';

// Helper: create a Supabase client with x-scan-access-token header so RLS allows reading
import { SUPABASE_URL as SB_URL, SUPABASE_PUBLISHABLE_KEY as SB_KEY } from '@/lib/supabase-config';
function createScanCheckClient(accessToken: string) {
  return createClient(SB_URL, SB_KEY, {
    global: { headers: { 'x-scan-access-token': accessToken } },
    auth: { persistSession: false },
  });
}

const PENDING_SCAN_MODE_KEY = 'jb_pending_scan_mode';

// CQ-3-A: insight-cards | crisis-center | startup-autopsy | market-radar removed (permanently unreachable).
// Features from these phases are now in ResultsModelB Tools tab.
type AppPhase = 'hero' | 'input-method' | 'auth-gate' | 'rescan-check' | 'onboarding' | 'processing' | 'seven-cards' | 'money-shot' | 'reveal' | 'thank-you' | 'error';

// FIX 4 (LOW): Named interface for ScanRow instead of inline type
interface ScanRow {
  scan_status: string;
  final_json_report: ScanReport | null;
}

interface ExistingScanHydrationRow {
  id: string;
  scan_status: string | null;
  final_json_report: ScanReport | null;
  access_token: string | null;
  country: string | null;
  industry: string | null;
  years_experience: string | null;
  metro_tier: string | null;
  linkedin_url: string | null;
}

function isAnonymousAuthSession(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
  const user = session?.user;
  if (!user) return false;
  return Boolean((user as { is_anonymous?: boolean }).is_anonymous || (!user.email && !user.phone));
}

// Real auth gate for production scan flow.
// We preserve pending scan intent in storage, redirect to /auth, then resume the
// flow after login/signup. This prevents anonymous scans from generating stale
// resume-less analyses and ensures Google/email auth is the required entrypoint.
function AuthGate({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !isAnonymousAuthSession(session)) {
          onReady();
          return;
        }

        try {
          sessionStorage.setItem('jb_post_auth_redirect', '/');
        } catch {}

        navigate('/auth', { replace: true });
      } catch (e) {
        console.warn('[AuthGate] Auth check failed, redirecting to login:', e);
        navigate('/auth', { replace: true });
      }
    })();
  }, [navigate, onReady]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Redirecting to secure sign in...</div>
    </div>
  );
}

// ── ObituaryPhase — P1-1: Career Obituary as free viral content ──────────────
// Renders after MoneyShotCard (Replacement Invoice) before the Pro dashboard.
// Calls the career-obituary edge function and shows the output with share buttons.
// P.G. Wodehouse × Times of India editorial: a eulogy for a job role killed by AI.
function ObituaryPhase({ report, onContinue }: { report: import('@/lib/scan-engine').ScanReport; onContinue: () => void }) {
  const [obituary, setObituary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchObituary = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('career-obituary', {
          body: {
            role: report.role || 'Professional',
            industry: report.industry || 'Technology',
            city: (report as any).metro_tier === 'tier1' ? 'Bangalore' : 'India',
            skills: report.execution_skills_dead?.slice(0, 3) || [],
            achievements: report.immediate_next_step ? [report.immediate_next_step] : [],
          },
        });
        if (!error && data?.obituary) setObituary(data.obituary);
      } catch { /* silent — user can skip */ }
      finally { setLoading(false); }
    };
    fetchObituary();
  }, []);

  const handleShareLinkedIn = () => {
    if (!obituary) return;
    const snippet = obituary.slice(0, 200) + '…';
    const text = encodeURIComponent(`Just got an AI-written obituary for my job role.\n\n"${snippet}"\n\nCheck yours → jobbachao.com #AI #CareerRisk #JobBachao`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://jobbachao.com&summary=${text}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!obituary) return;
    const snippet = obituary.slice(0, 300) + '…';
    const text = encodeURIComponent(`AI wrote an obituary for my job role 😂\n\n"${snippet}"\n\nGet yours → jobbachao.com`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📜</div>
          <h2 className="text-xl font-black text-foreground">In Memoriam</h2>
          <p className="text-sm text-muted-foreground mt-1">A farewell to <strong>{report.role || 'your role'}</strong></p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-4 bg-muted/60 rounded animate-pulse" style={{width: `${75 + i * 5}%`}} />
            ))}
          </div>
        ) : obituary ? (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm text-foreground/80 leading-relaxed italic whitespace-pre-line">{obituary}</p>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleShareLinkedIn}
                className="flex-1 py-3 rounded-xl border-2 border-[#0A66C2] text-[#0A66C2] text-sm font-bold hover:bg-[#0A66C2]/5 transition-all">
                Share on LinkedIn
              </button>
              <button onClick={handleShareWhatsApp}
                className="flex-1 py-3 rounded-xl border-2 border-[#25D366] text-[#25D366] text-sm font-bold hover:bg-[#25D366]/5 transition-all">
                Share on WhatsApp
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            Could not generate obituary right now.
          </div>
        )}

        <button onClick={onContinue}
          className="w-full mt-4 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all">
          See My Full Risk Report →
        </button>
        {/* P1-2: 48-hour Pro trial button — shown after emotional peak of the obituary */}
        <button
          onClick={async () => {
            try {
              await supabase.functions.invoke('activate-trial');
            } catch { /* silent — trial activation failure shouldn't block navigation */ }
            onContinue();
          }}
          className="w-full mt-2 py-3 rounded-2xl border-2 border-primary/30 text-primary text-sm font-semibold hover:border-primary/60 transition-all"
        >
          Try full report free for 48 hours — no card needed
        </button>
        <p className="text-center text-xs text-muted-foreground mt-3">This is satire. Your career is not over — your report shows you what to do next.</p>
      </div>
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const { withMutex, isLocked } = useRequestMutex();

  // ── Onboarding state (country, industry, metro, skills, resume file) ───────
  const onboarding = useOnboardingState();
  const {
    country, setCountry,
    linkedinUrl, setLinkedinUrl,
    industry, setIndustry,
    yearsExperience, setYearsExperience,
    metroTier, setMetroTier,
    pendingSkills, setKeySkills,
    userReportedCTC, setUserReportedCTC,
    step, setStep,
    resumeFileRef,
    isManualPath: _isManualPath,
  } = onboarding;

  // ── Scan flow (phase machine, scan id/token/report, auto-recovery) ─────────
  const scanFlow = useScanFlow({
    onHydrateOnboardingFields: ({ country: c, industry: i, yearsExperience: y, metroTier: m, linkedinUrl: l }) => {
      if (c) setCountry(c);
      if (i) setIndustry(i);
      if (y) setYearsExperience(y);
      if (m) setMetroTier(m);
      if (l) setLinkedinUrl(l);
    },
  });
  const {
    phase, setPhase,
    scanId, setScanId,
    accessToken, setAccessToken,
    scanReport, setScanReport,
    moneyShotSeen, setMoneyShotSeen,
    errorScanStatus, setErrorScanStatus,
    errorReason,
    showRateLimitUpsell, setShowRateLimitUpsell,
    showReAuth, setShowReAuth,
    showPostRevealGoalModal, setShowPostRevealGoalModal,
    scanGoals, setScanGoals,
    cleanupRef,
    isMountedRef,
    hasCompletedScanRef,
    routedScanId,
    handleMoneyShotComplete,
  } = scanFlow;


  // On mount: capture ?ref= referral code, log click, store for conversion tracking
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.length === 6) {
        sessionStorage.setItem('jb_ref_code', refCode);
        // Track the click (fire-and-forget, non-blocking)
        supabase.functions.invoke('referral-track', {
          body: { action: 'click', code: refCode },
        }).catch(() => {}); // non-fatal
      }
    } catch {}
  }, []);

  const getPendingInputContext = useCallback((): { linkedinUrl?: string; hasResume?: boolean } | null => {
    try {
      const pending = sessionStorage.getItem('jb_pending_input');
      return pending ? JSON.parse(pending) as { linkedinUrl?: string; hasResume?: boolean } : null;
    } catch {
      try { sessionStorage.removeItem('jb_pending_input'); } catch {}
      return null;
    }
  }, []);

  const getPendingScanMode = useCallback((): 'resume' | 'linkedin' | null => {
    try {
      const mode = localStorage.getItem(PENDING_SCAN_MODE_KEY);
      return mode === 'resume' || mode === 'linkedin' ? mode : null;
    } catch {
      return null;
    }
  }, []);

  const clearPendingScanIntent = useCallback(() => {
    try { sessionStorage.removeItem('jb_pending_input'); } catch {}
    try { localStorage.removeItem('jb_fresh_scan_intent'); } catch {}
    try { localStorage.removeItem(PENDING_SCAN_MODE_KEY); } catch {}
  }, []);

  const hasPendingResumeIntent = useCallback(() => {
    const pending = getPendingInputContext();
    const pendingMode = getPendingScanMode();
    return Boolean(pending?.hasResume || pendingMode === 'resume');
  }, [getPendingInputContext, getPendingScanMode]);

  // On mount: restore input context if returning from OAuth redirect.
  // Keep the pending marker until auth is confirmed so we can skip old-scan restore.
  useEffect(() => {
    if (routedScanId) return;

    const pendingInput = getPendingInputContext();
    const pendingMode = getPendingScanMode();
    if (!pendingInput && !pendingMode) return;

    if (pendingInput?.linkedinUrl) setLinkedinUrl(pendingInput.linkedinUrl);
    if ((pendingInput?.hasResume || pendingMode === 'resume') && !resumeFileRef.current) {
      console.warn('Resume file lost after redirect — user will need to re-upload');
    }

    setPhase('auth-gate');
  }, [getPendingInputContext, getPendingScanMode, routedScanId, setLinkedinUrl, setPhase, resumeFileRef]);







  // Scroll to top on phase change + track phase
  useEffect(() => {
    window.scrollTo(0, 0);
    console.debug('[Phase]', phase, { scanReport: !!scanReport, moneyShotSeen });
    if (phase === 'hero') track('landing_view');
    else if (phase === 'processing') {
      track('scan_start');
      // Anchor for Time-to-Money-Shot instrumentation (audit P1 #9).
      // Read by MoneyShotCard mount to compute elapsed_ms.
      try { sessionStorage.setItem('jb_scan_start_ts', String(Date.now())); } catch { /* storage may be blocked */ }
    }
    else if (phase === 'reveal') track('score_view');
    else if (phase === 'money-shot') track('tab_view', { tab: 'money-shot' });
    else if (phase === 'error') track('error_view');
  }, [phase, track]);

  // Landing-page scroll depth tracking — fires landing_scroll_depth at 25/50/75/100%
  // buckets while the user is on the hero phase. Captures bouncers via pagehide.
  useLandingScrollDepth({ track, active: phase === 'hero' });


  // Global session expiry listener — shows re-auth modal instead of losing state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && phase !== 'hero' && phase !== 'input-method' && phase !== 'auth-gate') {
        setShowReAuth(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [phase]);

  // Wire the rescan-with-resume event fired by the accuracy upgrade card in the dossier.
  // When a low-confidence user uploads a resume from within the results view, reset
  // to input-method phase so the normal resume scan flow runs.
  useEffect(() => {
    const handleRescanWithResume = (e: Event) => {
      const file = (e as CustomEvent<{ file: File }>).detail?.file;
      if (!file) return;
      resumeFileRef.current = file;
      track('rescan_from_upgrade_card', { source: 'low_confidence_resume_upload' });
      setIndustry('');
      setYearsExperience('');
      setMetroTier('');
      setKeySkills('');
      try { sessionStorage.setItem('jb_pending_input', JSON.stringify({ hasResume: true })); } catch {}
      try { localStorage.setItem(PENDING_SCAN_MODE_KEY, 'resume'); } catch {}
      // Reset scan state then go straight to auth-gate (auth already exists)
      setScanReport(null);
      setScanId('');
      setPhase('auth-gate');
    };
    window.addEventListener('jb:rescan-with-resume', handleRescanWithResume);
    return () => window.removeEventListener('jb:rescan-with-resume', handleRescanWithResume);
  }, [track]);

  const handleStart = () => {
    track('cta_click');
    setPhase('input-method');
  };

  // Role chip on landing page — pre-fills industry for a smoother onboarding
  const ROLE_TO_INDUSTRY: Record<string, string> = {
    'Software Engineer': 'IT Services',
    'Product Manager': 'IT Services',
    'Data Analyst': 'IT Services',
    'Marketing Pro': 'Marketing & Advertising',
    'Finance / CA': 'Banking & Finance',
    'Designer': 'IT Services',
  };
  const handleStartWithRole = (role: string) => {
    track('cta_click', { role_chip: role });
    const mappedIndustry = ROLE_TO_INDUSTRY[role];
    if (mappedIndustry) setIndustry(mappedIndustry);
    setPhase('input-method');
  };

  // After user commits to an input method, persist context & gate auth
  const handleLinkedinSubmit = (url: string) => {
    setLinkedinUrl(url);
    track('input_method_selected', { method: 'linkedin' });
    // Persist so OAuth redirect can restore context and skip old-scan recovery.
    try { sessionStorage.setItem('jb_pending_input', JSON.stringify({ linkedinUrl: url })); } catch {}
    try { localStorage.setItem('jb_fresh_scan_intent', '1'); } catch {}
    try { localStorage.setItem(PENDING_SCAN_MODE_KEY, 'linkedin'); } catch {}
    setPhase('auth-gate');
  };

  const handleResumeSubmit = async (file: File) => {
    resumeFileRef.current = file;
    track('input_method_selected', { method: 'resume' });
    // CRITICAL: Clear stale industry/years from previous scan so process-scan
    // doesn't get biased toward old profile data (e.g. Marketing when uploading
    // an engineering resume). This is the root cause of "same old results" bug.
    setIndustry('');
    setYearsExperience('');
    setMetroTier('');
    setKeySkills('');
    setStep(1);
    try { sessionStorage.setItem('jb_pending_input', JSON.stringify({ hasResume: true })); } catch {}
    try { localStorage.setItem('jb_fresh_scan_intent', '1'); } catch {}
    try { localStorage.setItem(PENDING_SCAN_MODE_KEY, 'resume'); } catch {}
    setPhase('auth-gate');
  };

  // Called after auth is confirmed — check for previous scans
  const handleAuthConfirmed = () => {
    track('auth_complete');

    if (hasPendingResumeIntent() && !resumeFileRef.current) {
      toast.error('Your resume was not retained. Please upload it again to run a fresh analysis.');
      setPhase('input-method');
      return;
    }

    setPhase('rescan-check');
  };

  // Called when user wants to proceed with a new scan (from rescan check or directly)
  const handleProceedNewScan = () => {
    if (hasPendingResumeIntent() && !resumeFileRef.current) {
      toast.error('Please re-upload your resume before starting a new analysis.');
      setPhase('input-method');
      return;
    }

    // Clear stale onboarding values so new scan starts fresh
    setIndustry('');
    setYearsExperience('');
    setMetroTier('');
    setKeySkills('');
    setPhase('onboarding');
    setStep(1);
  };

  // Called when user wants to view a previous scan result
  const handleViewPreviousScan = useCallback((report: ScanReport, id: string) => {
    setScanReport(report);
    setScanId(id);
    setMoneyShotSeen(false);
    setPhase('seven-cards');
  }, []);

  const handleSelectCountry = (v: string) => { setCountry(v); setStep(2); };
  const handleSelectIndustry = (v: string) => { setIndustry(v); setStep(3); };
  const handleSelectExperience = (v: string) => { setYearsExperience(v); setStep(4); };

  // P1-7 FIX: Back navigation clears stale input when going back to input-method
  const handleBack = (fromStep: number) => {
    if (fromStep <= 1) {
      setLinkedinUrl('');
      resumeFileRef.current = null;
      clearPendingScanIntent();
      setPhase('input-method');
    } else {
      setStep(fromStep - 1);
    }
  };
  
  const startScanPipeline = useCallback(async (id: string, token: string, forceRefresh = false) => {
    cleanupRef.current?.();
    const cleanup = subscribeScanStatus(
      id,
      token,
      (report) => {
        if (!isMountedRef.current) return;
        setScanReport(report);
        setMoneyShotSeen(false);
        hasCompletedScanRef.current = true; // persist across state resets for rate limit gate
        track('scan_complete', { scanId: id });
        navigate(`/results/choose?id=${id}`);

        // Pre-warm Model B analysis in background so it's cached when user reaches it
        supabase.auth.getUser().then(({ data: { user } }) => {
          const uid = user?.id || null;
          if (uid) {
            console.debug('[PreWarm] Triggering Model B analysis in background for', id);
            supabase.functions.invoke('get-model-b-analysis', {
              body: { analysis_id: id, user_id: uid, resume_filename: 'Your Resume' },
            }).catch(() => {}); // Non-fatal — just pre-warming cache
          }
        }).catch(() => {});

        // Referral conversion: if user arrived via a referral link, log the conversion
        try {
          const refCode = sessionStorage.getItem('jb_ref_code');
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (refCode && s?.user?.id) {
              supabase.functions.invoke('referral-track', {
                body: { action: 'convert', code: refCode, refereeUserId: s.user.id, scanId: id },
              }).then(() => {
                sessionStorage.removeItem('jb_ref_code'); // only convert once
              }).catch(() => {}); // non-fatal
            }
          });
        } catch {}
      },
      () => {
        if (!isMountedRef.current) return;
        console.error('Scan failed or timed out');
        setPhase('error');
      }
    );
    cleanupRef.current = cleanup;

    // P0-3 FIX: Upload resume BEFORE triggering scan to prevent race condition
    if (resumeFileRef.current) {
      const sizeKb = Math.round(resumeFileRef.current.size / 1024);
      const uploadToastId = toast.loading(`Uploading your resume (${sizeKb} KB)…`);
      try {
        const filePath = await uploadResume(resumeFileRef.current, id);
        const { supabase: sb } = await import('@/integrations/supabase/client');
        await sb.from('scans')
          .update({ resume_file_path: filePath } as any)
          .eq('id', id);
        toast.success('Resume uploaded — starting analysis', { id: uploadToastId });
      } catch (err) {
        console.error('Resume upload failed:', err);
        toast.error(err instanceof Error ? err.message : 'Resume upload failed. Please try again.', { id: uploadToastId });
        // Mark the scan as error so it doesn't sit in "processing" forever and so the
        // user's next attempt creates a fresh scan instead of colliding with an orphan.
        try {
          const { supabase: sb } = await import('@/integrations/supabase/client');
          await sb.from('scans').update({ scan_status: 'error' } as any).eq('id', id);
        } catch (cleanupErr) {
          console.warn('Failed to mark orphan scan as error:', cleanupErr);
        }
        // PR1 (Reliability): Route to the persistent error screen instead of bouncing
        // silently back to input-method. Clear scanId so the "Try Again" CTA sends the
        // user back to re-pick their file (the in-memory File blob is gone after upload fail).
        setScanId('');
        setAccessToken('');
        cleanupRef.current?.();
        cleanupRef.current = null;
        setPhase('error');
        return false;
      }
    }

    // Always trigger from the client as the reliable source of truth.
    // The create-scan server-side trigger is only a best-effort backup.
    const trigger = await triggerProcessScan(id, forceRefresh, token);
    if (!trigger.accepted) {
      console.warn('Scan trigger rejected:', trigger.reason, trigger.error);
      setPhase('error');
      return false;
    }
    return true;
  }, [track, navigate]);



  const handleSelectMetro = async (v: string) => {
    setMetroTier(v);
    // CTC capture step is now mandatory (skippable) for ALL paths.
    // Powers the salary-bleed kill-shot section in the report.
    setStep(5);
  };

  const handleSubmitCTC = async (monthlyCTC: number | null) => {
    // Convert non-INR currencies to INR for storage (server stores estimated_monthly_salary_inr).
    // Rough conversion is fine — the field is used for ratio calculations, not exact comparisons,
    // and the server clamps to [5k, 5M] INR anyway.
    let inrValue: number | null = null;
    if (monthlyCTC !== null) {
      const rate = country === 'US' ? 84 : country === 'AE' ? 23 : 1;
      inrValue = Math.round(monthlyCTC * rate);
    }
    setUserReportedCTC(inrValue);

    // Manual path: still need skills step (step 6). Otherwise launch immediately.
    if (!linkedinUrl && !resumeFileRef.current) {
      setStep(6);
      return;
    }
    await launchScan(metroTier, '');
  };

  const handleSelectSkills = async (skills: string) => {
    setKeySkills(skills);
    await launchScan(metroTier, skills);
  };

  const handleSkipSkills = async () => {
    await launchScan(metroTier, '');
  };

  const launchScan = async (metro: string, skills: string) => {
    if (hasPendingResumeIntent() && !resumeFileRef.current) {
      toast.error('Resume missing. Please upload your resume again — we blocked fallback to stale manual analysis.');
      setPhase('input-method');
      return;
    }

    // P0-PROD-02 FIX: Gate free user rescan — show RateLimitUpsell if already scanned.
    // Use hasCompletedScanRef (not scanReport) because the upgrade-card rescan flow
    // clears scanReport before reaching launchScan — ref persists across state resets.
    const alreadyScanned = hasCompletedScanRef.current || !!scanReport;
    if (alreadyScanned && session && !session.user?.user_metadata?.subscription_tier) {
      // Free user who has already completed a scan
      track('error_view' as any);
      setShowRateLimitUpsell(true);
      return;
    }

    // Week 1 #5: Dedup — prevent double-submit
    const result = await withMutex('launchScan', async () => {
      setPhase('processing');
      try {
        const { id, accessToken: token } = await createScan({
          linkedinUrl: linkedinUrl || undefined,
          resumeFilePath: resumeFileRef.current ? 'pending-upload' : undefined,
          country: country || 'IN',
          industry,
          yearsExperience,
          metroTier: metro,
          keySkills: skills || undefined,
          estimatedMonthlySalaryInr: userReportedCTC ?? null,
        });
        if (!id || !token) {
          console.error('Scan creation failed: missing id or token');
          setPhase('error');
          return;
        }
        setScanId(id);
        setAccessToken(token);
        const started = await startScanPipeline(id, token, true);
        if (started) {
          clearPendingScanIntent();
        }
      } catch (err) {
        console.error('Scan creation failed:', err);
        const code = (err as any)?.code;
        const msg = err instanceof Error ? err.message : 'Could not start scan. Please try again.';
        if (code === 'DAILY_LIMIT_REACHED' || /daily.*limit/i.test(msg)) {
          setShowRateLimitUpsell(true);
          setPhase('hero');
          return;
        }
        toast.error(msg);
        setPhase('error');
      }
    });
    if (result === null && isLocked('launchScan')) {
      console.debug('[Index] Duplicate launchScan blocked');
    }
  };

  const handleLoadingComplete = useCallback(() => {
    // Transition to the new unified 7-card experience
    setPhase('seven-cards');
  }, []);

  const handleRevealComplete = useCallback(() => {
    setShowPostRevealGoalModal(true);
  }, []);




  const handleReset = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    navigate('/', { replace: true });
    setPhase('hero');
    setStep(1);
    setCountry('');
    setLinkedinUrl('');
    setIndustry('');
    setYearsExperience('');
    setMetroTier('');
    setKeySkills('');
    setScanId('');
    setAccessToken('');
    setScanReport(null);
    setMoneyShotSeen(false);
    resumeFileRef.current = null;
    clearPendingScanIntent();
  };

  // FIX 1 (HIGH): Remove duplicate session state — use useAuth() hook instead
  const { session } = useAuth();

  // Derive isProUser from scanReport
  const isProUser = !!(scanReport as any)?.user_is_pro;

  return (
    <>
      {/* FomoToast removed — Sprint 0.2 trust improvement */}
      {showRateLimitUpsell && (
        <RateLimitUpsell
          minutesRemaining={1440}
          onDismiss={() => setShowRateLimitUpsell(false)}
        />
      )}
      <ReAuthModal
        open={showReAuth}
        onSuccess={() => setShowReAuth(false)}
        onReset={() => { setShowReAuth(false); handleReset(); }}
      />
      <GoalCaptureModal
        isOpen={showPostRevealGoalModal}
        onComplete={(goals) => {
          setScanGoals(goals);
          setShowPostRevealGoalModal(false);
          setPhase('money-shot');
        }}
        onSkip={() => {
          setShowPostRevealGoalModal(false);
          setPhase('money-shot');
        }}
      />
      {phase === 'hero' && <HeroSection onStart={handleStart} onStartWithRole={handleStartWithRole} />}
      {phase === 'hero' && <SocialProofSection />}
      {phase === 'input-method' && (
        <InputMethodStep
          onSubmitLinkedin={handleLinkedinSubmit}
          onSubmitResume={handleResumeSubmit}
          onSkip={() => {}}
        />
      )}
      {phase === 'auth-gate' && (
        <AuthGate onReady={handleAuthConfirmed} />
      )}
      {phase === 'rescan-check' && (
        <RescanDetector
          onViewPrevious={handleViewPreviousScan}
          onStartNew={handleProceedNewScan}
        />
      )}
      {phase === 'onboarding' && (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
        <OnboardingFlow
          step={step}
          country={country}
          industry={industry}
          yearsExperience={yearsExperience}
          metroTier={metroTier}
          monthlyCTC={userReportedCTC}
          hasLinkedIn={!!linkedinUrl}
          hasResume={!!resumeFileRef.current}
          onSelectCountry={handleSelectCountry}
          onSelectIndustry={handleSelectIndustry}
          onSelectExperience={handleSelectExperience}
          onSelectMetro={handleSelectMetro}
          onSubmitCTC={handleSubmitCTC}
          onSelectSkills={handleSelectSkills}
          onSkipSkills={handleSkipSkills}
          onBack={handleBack}
        />
        </Suspense>
      )}
      {/* ── Optional CTC input — shown after onboarding, before scan launch ── */}
      {phase === 'processing' && <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><MatrixLoading onComplete={handleLoadingComplete} scanReady={!!scanReport} scanId={scanId} seniorityTier={
        yearsExperience === '0-2' ? 'ENTRY' : yearsExperience === '3-5' ? 'PROFESSIONAL' : yearsExperience === '6-10' ? 'MANAGER' : yearsExperience === '10+' ? 'SENIOR_LEADER' : yearsExperience === '15+' ? 'EXECUTIVE' : yearsExperience === '20+' ? 'EXECUTIVE' : yearsExperience === '25+' ? 'EXECUTIVE' : null
      } /></Suspense>}
      {/* ── NEW: 7-card unified experience (replaces reveal → money-shot → insight-cards sequence) ── */}
      {phase === 'seven-cards' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading your report...</div></div>}>
          <SevenCardReveal
            report={scanReport}
            scanId={scanId}
            onComplete={() => {
              // After 7 cards → Replacement Invoice (MoneyShotCard) → Pro dashboard.
              // The Replacement Invoice is the product's highest-converting viral moment —
              // it was accidentally removed from the critical path in the 7-card unification.
              // Restoring it here: seven-cards → money-shot → reveal.
              setMoneyShotSeen(false);
              setPhase('money-shot');
            }}
          />
        </Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'reveal' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading results...</div></div>}><AIDossierReveal report={scanReport} onComplete={handleRevealComplete} scanId={scanId} isProUser={isProUser} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'money-shot' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
          <MoneyShotCard report={scanReport} onContinue={handleMoneyShotComplete} scanId={scanId} />
        </Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}

      {phase === 'thank-you' && (
        <div className="min-h-screen bg-background">
          <div className="max-w-lg mx-auto px-4 py-12">
            <Suspense fallback={<div className="animate-pulse text-muted-foreground text-center">Loading...</div>}>
              <ThankYouFooter onStartOver={handleReset} scanId={scanId} userId={session?.user?.id} />
            </Suspense>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md text-center space-y-6">
            {errorScanStatus === 'checking' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Finalizing your report…</p>
              </div>
            ) : errorScanStatus === 'processing' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl">⏳</span>
                </div>
                <h1 className="text-2xl font-black text-foreground">Analysis Still Running</h1>
                <p className="text-muted-foreground">
                  Your analysis is still being processed. Click "Check Again" in a moment.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-prophet-red/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h1 className="text-2xl font-black text-foreground">Analysis Incomplete</h1>
                <p className="text-muted-foreground">
                  {errorReason?.message
                    || "Our intelligence engine couldn't complete your analysis. This can happen due to high demand or data availability issues. No mock data was served — we only show real results."}
                </p>
                {errorReason?.feedback_flag && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Reason code: <code>{errorReason.feedback_flag}</code>
                  </p>
                )}
              </>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              {scanId && errorScanStatus === 'processing' ? (
                <button
                  onClick={() => {
                    setErrorScanStatus('checking');
                    const sc = createScanCheckClient(accessToken);
                    sc.from('scans').select('scan_status, final_json_report').eq('id', scanId).single()
                      .then(({ data }: any) => {
                        const row = data as ScanRow | null;
                        if (row?.scan_status === 'complete' && row?.final_json_report) {
                          setScanReport(row.final_json_report as ScanReport);
                          setMoneyShotSeen(false);
                          navigate(`/results/choose?id=${scanId}`);
                        } else {
                          setErrorScanStatus(row?.scan_status ?? 'unknown');
                        }
                      })
                      .then(undefined, () => setErrorScanStatus('unknown'));
                  }}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
                >
                  Check Again
                </button>
              ) : scanId ? (
                <button
                  onClick={() => {
                    setErrorScanStatus(null);
                    setPhase('processing');
                    startScanPipeline(scanId, accessToken, true).catch(() => setPhase('error'));
                  }}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
                >
                  Retry Analysis
                </button>
              ) : (
              <button
                  onClick={() => {
                    // P1-8 FIX: Validate fields before jumping to step 4
                    if (!industry || !yearsExperience) {
                      setPhase('onboarding');
                      setStep(1);
                    } else {
                      setPhase('onboarding');
                      setStep(4);
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-all"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
