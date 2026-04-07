import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import HeroSection from '@/components/HeroSection';
import SocialProofSection from '@/components/SocialProofSection';
import InputMethodStep from '@/components/InputMethodStep';
import AuthGuard from '@/components/AuthGuard';
import ReAuthModal from '@/components/ReAuthModal';
import RescanDetector from '@/components/RescanDetector';
import RateLimitUpsell from '@/components/RateLimitUpsell';
import GoalCaptureModal, { type ScanGoals } from '@/components/GoalCaptureModal';
import OnboardingFlow from '@/components/OnboardingFlow';
import StartupAutopsyPage from '@/components/StartupAutopsyPage';
import MarketRadarWidget from '@/components/MarketRadarWidget';
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
const AIDossierReveal = lazyWithRetry(() => import('@/components/AIDossierReveal'));
const MoneyShotCard = lazyWithRetry(() => import('@/components/MoneyShotCard'));
const InsightCards = lazyWithRetry(() => import('@/components/InsightCards'));
const SideHustleGenerator = lazyWithRetry(() => import('@/components/SideHustleGenerator'));
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport, createScan, uploadResume, triggerProcessScan, subscribeScanStatus } from '@/lib/scan-engine';
import { createClient } from '@supabase/supabase-js';
import { useAnalytics } from '@/hooks/use-analytics';
import { useRequestMutex } from '@/hooks/use-request-mutex';

// Helper: create a Supabase client with x-scan-access-token header so RLS allows reading
import { SUPABASE_URL as SB_URL, SUPABASE_PUBLISHABLE_KEY as SB_KEY } from '@/lib/supabase-config';
function createScanCheckClient(accessToken: string) {
  return createClient(SB_URL, SB_KEY, {
    global: { headers: { 'x-scan-access-token': accessToken } },
    auth: { persistSession: false },
  });
}

type AppPhase = 'hero' | 'input-method' | 'auth-gate' | 'rescan-check' | 'onboarding' | 'processing' | 'reveal' | 'money-shot' | 'insight-cards' | 'crisis-center' | 'startup-autopsy' | 'market-radar' | 'thank-you' | 'error';

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

// Tiny component that fires onReady once on mount (avoids render-loop in AuthGuard children)
function AuthAutoAdvance({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) { fired.current = true; onReady(); }
  }, [onReady]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Preparing your analysis...</div>
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routedScanId = searchParams.get('id');
  const { track } = useAnalytics();
  const { withMutex, isLocked } = useRequestMutex();
  const [phase, setPhase] = useState<AppPhase>('hero');
  const [step, setStep] = useState(1);
  const detectCountry = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
      if (tz?.startsWith('America/')) return 'US';
      if (tz === 'Asia/Dubai') return 'AE';
    } catch {}
    return '';
  };
  const [country, setCountry] = useState(detectCountry);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [metroTier, setMetroTier] = useState('');
  const [_keySkills, setKeySkills] = useState('');
  const [scanId, setScanId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [moneyShotSeen, setMoneyShotSeen] = useState(false);
  const [showReAuth, setShowReAuth] = useState(false);
  const [_showGoalModal, _setShowGoalModal] = useState(false);
  const [showPostRevealGoalModal, setShowPostRevealGoalModal] = useState(false);
  const [scanGoals, setScanGoals] = useState<ScanGoals | null>(null);
  const [errorScanStatus, setErrorScanStatus] = useState<string | null>(null);
  const [showRateLimitUpsell, setShowRateLimitUpsell] = useState(false);
  const resumeFileRef = useRef<File | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // H-3 FIX: isMounted guard prevents state updates after component unmount
  const isMountedRef = useRef(true);
  const hydrationAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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

  // On mount: restore input context if returning from OAuth redirect
  // FIX 2 (MEDIUM): Add proper try-catch around JSON.parse to handle malformed data
  useEffect(() => {
    if (routedScanId) return;

    let pendingInput: any = null;
    try {
      const pending = sessionStorage.getItem('jb_pending_input');
      if (pending) {
        pendingInput = JSON.parse(pending);
      }
    } catch {
      // Malformed JSON in sessionStorage — clear it and continue
      try { sessionStorage.removeItem('jb_pending_input'); } catch {}
    }

    if (pendingInput) {
      try {
        sessionStorage.removeItem('jb_pending_input');
        if (pendingInput.linkedinUrl) setLinkedinUrl(pendingInput.linkedinUrl);
        if (pendingInput.hasResume) {
          // FIX 3 (MEDIUM): Check if resume file ref is lost after OAuth redirect
          if (!resumeFileRef.current) {
            // Resume file can't survive a page redirect — clear the stale flag
            pendingInput.hasResume = false;
            console.warn('Resume file lost after redirect — user will need to re-upload');
          }
          // Resume file can't be persisted — user will need to re-select, but we skip to auth-gate
          // which will auto-advance to rescan-check/onboarding
        }
        // If we had pending input, jump straight to auth-gate (session may already exist)
        setPhase('auth-gate');
      } catch {}
    }
  }, [routedScanId]);

  useEffect(() => {
    if (!routedScanId || scanReport) return;
    if (hydrationAttemptedRef.current === routedScanId) return;

    hydrationAttemptedRef.current = routedScanId;

    let cancelled = false;
    const ACTIVE_STATUSES = new Set(['processing', 'running']);

    const hydrateExistingScan = async () => {
      setPhase('processing');

      try {
        try { sessionStorage.removeItem('jb_pending_input'); } catch {}

        const { data, error } = await supabase
          .from('scans')
          .select('id, scan_status, final_json_report, access_token, country, industry, years_experience, metro_tier, linkedin_url')
          .eq('id', routedScanId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          console.warn('[Index] Failed to restore scan from URL', error);
          setScanId('');
          setAccessToken('');
          setPhase('hero');
          return;
        }

        const existingScan = data as ExistingScanHydrationRow;

        setScanId(existingScan.id);
        setAccessToken(existingScan.access_token || '');
        if (existingScan.country) setCountry(existingScan.country);
        if (existingScan.industry) setIndustry(existingScan.industry);
        if (existingScan.years_experience) setYearsExperience(existingScan.years_experience);
        if (existingScan.metro_tier) setMetroTier(existingScan.metro_tier);
        if (existingScan.linkedin_url) setLinkedinUrl(existingScan.linkedin_url);

        if (existingScan.scan_status === 'complete' && existingScan.final_json_report) {
          setScanReport(existingScan.final_json_report);
          setMoneyShotSeen(false);
          setPhase('reveal');
          return;
        }

        if (ACTIVE_STATUSES.has(existingScan.scan_status || '') && existingScan.access_token) {
          cleanupRef.current?.();
          cleanupRef.current = subscribeScanStatus(
            routedScanId,
            existingScan.access_token,
            (report) => {
              if (!isMountedRef.current || cancelled) return;
              setScanReport(report);
              setMoneyShotSeen(false);
              setPhase('reveal');
            },
            () => {
              if (!isMountedRef.current || cancelled) return;
              setPhase('error');
            }
          );
          return;
        }

        console.warn('[Index] Scan restore unavailable for status', existingScan.scan_status);
        setScanId('');
        setAccessToken('');
        setPhase('hero');
      } catch (error) {
        if (cancelled) return;
        console.error('[Index] Unexpected scan restore failure', error);
        setScanId('');
        setAccessToken('');
        setPhase('hero');
      }
    };

    void hydrateExistingScan();

    return () => {
      cancelled = true;
    };
  }, [routedScanId, scanReport]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  // Auto-recovery: when error screen shows, check if backend actually completed the scan
  // Also falls back to the URL param scan if the current in-flight scan failed
  useEffect(() => {
    if (phase !== 'error') return;
    
    const tryRecover = async () => {
      setErrorScanStatus('checking');

      // 1. Check the current in-flight scan
      if (scanId && accessToken) {
        try {
          const sc = createScanCheckClient(accessToken);
          const { data } = await sc.from('scans')
            .select('scan_status, final_json_report')
            .eq('id', scanId)
            .single();
          const row = data as ScanRow | null;
          if (row?.scan_status === 'complete' && row?.final_json_report) {
            console.debug('[AutoRecover] Current scan completed in backend');
            setScanReport(row.final_json_report as ScanReport);
            setMoneyShotSeen(false);
            navigate(`/results/choose?id=${scanId}`);
            return;
          }
        } catch {}
      }

      // 2. Fallback: if URL has a different scan ID, check if THAT one is complete
      if (routedScanId && routedScanId !== scanId) {
        try {
          const { data } = await supabase.from('scans')
            .select('id, scan_status, final_json_report, access_token')
            .eq('id', routedScanId)
            .single();
          const row = data as (ScanRow & { id: string; access_token: string | null }) | null;
          if (row?.scan_status === 'complete' && row?.final_json_report) {
            console.debug('[AutoRecover] URL scan is complete, recovering from', routedScanId);
            setScanId(row.id);
            setAccessToken(row.access_token || '');
            setScanReport(row.final_json_report as ScanReport);
            setMoneyShotSeen(false);
            navigate(`/results/choose?id=${routedScanId}`);
            return;
          }
        } catch {}
      }

      // 3. Check user's most recent completed scan as last resort
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data } = await supabase.from('scans')
            .select('id, scan_status, final_json_report, access_token')
            .eq('user_id', user.id)
            .eq('scan_status', 'complete')
            .not('final_json_report', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (data?.final_json_report) {
            console.debug('[AutoRecover] Found recent completed scan', data.id);
            setScanId(data.id);
            setAccessToken(data.access_token || '');
            setScanReport(data.final_json_report as unknown as ScanReport);
            setMoneyShotSeen(false);
            navigate(`/results/choose?id=${data.id}`);
            return;
          }
        }
      } catch {}

      if (isMountedRef.current) setErrorScanStatus('failed');
    };

    tryRecover();
  }, [phase, scanId, accessToken, routedScanId, navigate]);

  // Scroll to top on phase change + track phase
  useEffect(() => {
    window.scrollTo(0, 0);
    console.debug('[Phase]', phase, { scanReport: !!scanReport, moneyShotSeen });
    if (phase === 'hero') track('landing_view');
    else if (phase === 'processing') track('scan_start');
    else if (phase === 'reveal') track('score_view');
    else if (phase === 'money-shot') track('tab_view', { tab: 'money-shot' });
    else if (phase === 'error') track('error_view');
  }, [phase, track]);

  // Guard: never allow insight cards before Money Shot is explicitly continued
  useEffect(() => {
    if (phase === 'insight-cards' && scanReport && !moneyShotSeen) {
      setPhase('money-shot');
    }
  }, [phase, scanReport, moneyShotSeen]);

  // Global session expiry listener — shows re-auth modal instead of losing state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && phase !== 'hero' && phase !== 'input-method' && phase !== 'auth-gate') {
        setShowReAuth(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [phase]);

  const handleStart = () => {
    track('cta_click');
    setPhase('input-method');
  };

  // After user commits to an input method, persist context & gate auth
  const handleLinkedinSubmit = (url: string) => {
    setLinkedinUrl(url);
    track('input_method_selected', { method: 'linkedin' });
    // Persist so OAuth redirect can restore context
    try { sessionStorage.setItem('jb_pending_input', JSON.stringify({ linkedinUrl: url })); } catch {}
    setPhase('auth-gate');
  };

  const handleResumeSubmit = async (file: File) => {
    resumeFileRef.current = file;
    track('input_method_selected', { method: 'resume' });
    // Persist flag (file itself can't survive redirect — user will re-select)
    try { sessionStorage.setItem('jb_pending_input', JSON.stringify({ hasResume: true })); } catch {}
    setPhase('auth-gate');
  };

  // Called after auth is confirmed — check for previous scans
  const handleAuthConfirmed = () => {
    track('auth_complete');
    setPhase('rescan-check');
  };

  // Called when user wants to proceed with a new scan (from rescan check or directly)
  const handleProceedNewScan = () => {
    setPhase('onboarding');
    setStep(1);
  };

  // Called when user wants to view a previous scan result
  const handleViewPreviousScan = useCallback((report: ScanReport, id: string) => {
    setScanReport(report);
    setScanId(id);
    setMoneyShotSeen(false);
    setPhase('reveal');
  }, []);

  const handleSelectCountry = (v: string) => { setCountry(v); setStep(2); };
  const handleSelectIndustry = (v: string) => { setIndustry(v); setStep(3); };
  const handleSelectExperience = (v: string) => { setYearsExperience(v); setStep(4); };

  // P1-7 FIX: Back navigation clears stale input when going back to input-method
  const handleBack = (fromStep: number) => {
    if (fromStep <= 1) {
      setLinkedinUrl('');
      resumeFileRef.current = null;
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
        track('scan_complete', { scanId: id });
        navigate(`/results/choose?id=${id}`);

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
      try {
        const filePath = await uploadResume(resumeFileRef.current, id);
        const { supabase: sb } = await import('@/integrations/supabase/client');
        await sb.from('scans')
          .update({ resume_file_path: filePath } as any)
          .eq('id', id);
      } catch (err) {
        console.warn('Resume upload failed, continuing without:', err);
      }
    }

    // Always trigger from the client as the reliable source of truth.
    // The create-scan server-side trigger is only a best-effort backup.
    const trigger = await triggerProcessScan(id, forceRefresh, token);
    if (!trigger.accepted) {
      console.warn('Scan trigger rejected:', trigger.reason, trigger.error);
      setPhase('error');
      return;
    }
  }, [track, navigate]);

  const _isManualPath = !linkedinUrl && !resumeFileRef.current;

  const handleSelectMetro = async (v: string) => {
    setMetroTier(v);
    // Manual path: show skills step before scanning
    if (!linkedinUrl && !resumeFileRef.current) {
      setStep(5);
      return;
    }
    await launchScan(v, '');
  };

  const handleSelectSkills = async (skills: string) => {
    setKeySkills(skills);
    await launchScan(metroTier, skills);
  };

  const handleSkipSkills = async () => {
    await launchScan(metroTier, '');
  };

  const launchScan = async (metro: string, skills: string) => {
    // P0-PROD-02 FIX: Gate free user rescan — show RateLimitUpsell if already scanned
    if (scanReport && session && !session.user?.user_metadata?.subscription_tier) {
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
        });
        if (!id || !token) {
          console.error('Scan creation failed: missing id or token');
          setPhase('error');
          return;
        }
        setScanId(id);
        setAccessToken(token);
        await startScanPipeline(id, token, true);
      } catch (err) {
        console.error('Scan creation failed:', err);
        setPhase('error');
      }
    });
    if (result === null && isLocked('launchScan')) {
      console.debug('[Index] Duplicate launchScan blocked');
    }
  };

  const handleLoadingComplete = useCallback(() => {
    // scanReady prop in MatrixLoading already gates this call, so always transition
    setPhase('reveal');
  }, []);

  const handleRevealComplete = useCallback(() => {
    setShowPostRevealGoalModal(true);
  }, []);
  const handleMoneyShotComplete = useCallback(() => {
    setMoneyShotSeen(true);
    setPhase('insight-cards');
  }, []);
  const handleInsightCardsComplete = useCallback(() => { setPhase('crisis-center'); }, []);
  const handleCrisisCenterComplete = useCallback(() => { setPhase('startup-autopsy'); }, []);
  const handleAutopsyComplete = useCallback(() => { setPhase('market-radar'); }, []);
  const handleMarketRadarComplete = useCallback(() => { setPhase('thank-you'); }, []);

  const handleReset = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    navigate('/', { replace: true });
    setPhase('hero');
    setStep(1);
    setCountry(detectCountry());
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
      {phase === 'hero' && <HeroSection onStart={handleStart} />}
      {phase === 'hero' && <SocialProofSection />}
      {phase === 'input-method' && (
        <InputMethodStep
          onSubmitLinkedin={handleLinkedinSubmit}
          onSubmitResume={handleResumeSubmit}
          onSkip={() => {}}
        />
      )}
      {phase === 'auth-gate' && (
        <AuthGuard
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Checking authentication...</div>
            </div>
          }
        >
          {() => <AuthAutoAdvance onReady={handleAuthConfirmed} />}
        </AuthGuard>
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
          hasLinkedIn={!!linkedinUrl}
          hasResume={!!resumeFileRef.current}
          onSelectCountry={handleSelectCountry}
          onSelectIndustry={handleSelectIndustry}
          onSelectExperience={handleSelectExperience}
          onSelectMetro={handleSelectMetro}
          onSelectSkills={handleSelectSkills}
          onSkipSkills={handleSkipSkills}
          onBack={handleBack}
        />
        </Suspense>
      )}
      {phase === 'processing' && <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><MatrixLoading onComplete={handleLoadingComplete} scanReady={!!scanReport} scanId={scanId} seniorityTier={
        yearsExperience === '0-2' ? 'ENTRY' : yearsExperience === '3-5' ? 'PROFESSIONAL' : yearsExperience === '6-10' ? 'MANAGER' : yearsExperience === '10+' ? 'SENIOR_LEADER' : null
      } /></Suspense>}
      {phase === 'reveal' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading results...</div></div>}><AIDossierReveal report={scanReport} onComplete={handleRevealComplete} scanId={scanId} isProUser={isProUser} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'money-shot' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><MoneyShotCard report={scanReport} onContinue={handleMoneyShotComplete} scanId={scanId} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'insight-cards' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><InsightCards report={scanReport} onComplete={handleInsightCardsComplete} scanId={scanId} biggest_concern={scanGoals?.biggest_concern} isProUser={isProUser} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'crisis-center' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><SideHustleGenerator report={scanReport} onComplete={handleCrisisCenterComplete} country={country} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'startup-autopsy' && (scanReport ? (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><StartupAutopsyPage report={scanReport} onComplete={handleAutopsyComplete} country={country} /></Suspense>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ))}
      {phase === 'market-radar' && scanReport && (
        <div className="min-h-screen bg-background">
          <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
            <Suspense fallback={<div className="animate-pulse h-40 rounded-xl bg-muted" />}>
              <MarketRadarWidget
                role={scanReport.role || 'Professional'}
                industry={scanReport.industry || 'Technology'}
                skills={(scanReport.all_skills || scanReport.moat_skills || []).slice(0, 8)}
                country={country || 'India'}
                onComplete={handleMarketRadarComplete}
              />
            </Suspense>
          </div>
        </div>
      )}
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
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                  <span className="text-3xl">🔍</span>
                </div>
                <h1 className="text-2xl font-black text-foreground">Checking Analysis Status...</h1>
                <p className="text-muted-foreground">Verifying if your analysis completed in the background.</p>
              </>
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
                  Our intelligence engine couldn't complete your analysis. This can happen due to high demand or data availability issues. No mock data was served — we only show real results.
                </p>
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
