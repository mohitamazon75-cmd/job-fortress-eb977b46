/**
 * useScanFlow — owns the scan phase state machine and scan lifecycle state.
 *
 * Previously this logic was inline in Index.tsx, interleaved with onboarding
 * state, session state, and 1,000 lines of JSX. Separating it:
 *   1. Phase transitions are now readable in isolation.
 *   2. Scan lifecycle (id, token, report, polling) is independently testable.
 *   3. Auto-recovery logic is contained and doesn't leak into render code.
 *
 * State owned here:
 *   - phase (the AppPhase state machine)
 *   - scanId, accessToken (the current scan's credentials)
 *   - scanReport (the final analysis result)
 *   - moneyShotSeen (gate: was the Replacement Invoice shown before Model B?)
 *   - errorScanStatus (auto-recovery check state)
 *   - showRateLimitUpsell (rate limit guard)
 *   - showReAuth (session expiry modal)
 *   - showPostRevealGoalModal, scanGoals (post-reveal goal capture)
 *
 * Refs owned here:
 *   - cleanupRef (realtime subscription cleanup)
 *   - isMountedRef (unmount guard)
 *   - hasCompletedScanRef (rate limit: persists across scanReport resets)
 *   - hydrationAttemptedRef (prevents duplicate URL-scan hydration)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { subscribeScanStatus } from '@/lib/scan-engine';
import type { ScanReport, ScanFailureReason } from '@/lib/scan-engine';
import type { ScanGoals } from '@/components/GoalCaptureModal';
import { SUPABASE_URL as SB_URL, SUPABASE_PUBLISHABLE_KEY as SB_KEY } from '@/lib/supabase-config';
import { getAnonScanToken } from '@/lib/anon-scan-storage';

/**
 * Creates a scan-token-scoped client for reading scan status during polling.
 * Uses the access_token header rather than a user JWT — allows anonymous polling.
 * Moved here from Index.tsx where it was a private function.
 */
function createScanCheckClient(accessToken: string) {
  return createClient(SB_URL, SB_KEY, {
    global: { headers: { 'x-scan-access-token': accessToken } },
    auth: { persistSession: false },
  });
}

// Re-exported so Index.tsx doesn't need to import it separately
export type AppPhase =
  | 'hero'
  | 'input-method'
  | 'auth-gate'
  | 'rescan-check'
  | 'onboarding'
  | 'processing'
  | 'seven-cards'
  | 'money-shot'
  | 'reveal'
  // 'insight-cards' | 'crisis-center' | 'startup-autopsy' | 'market-radar' removed:
  // These phases were permanently unreachable (CQ-3-A). Features surfaced in ResultsModelB Tools tab.
  | 'thank-you'
  | 'error';

// Row shape used during URL-driven scan hydration
interface ScanHydrationRow {
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

interface ScanRow {
  scan_status: string | null;
  final_json_report: ScanReport | null;
}

export interface ScanFlowCallbacks {
  /** Called during URL hydration to restore onboarding state from DB */
  onHydrateOnboardingFields: (fields: {
    country?: string;
    industry?: string;
    yearsExperience?: string;
    metroTier?: string;
    linkedinUrl?: string;
  }) => void;
}

export interface ScanFlowState {
  phase: AppPhase;
  setPhase: (p: AppPhase) => void;
  scanId: string;
  setScanId: (id: string) => void;
  accessToken: string;
  setAccessToken: (t: string) => void;
  scanReport: ScanReport | null;
  setScanReport: (r: ScanReport | null) => void;
  moneyShotSeen: boolean;
  setMoneyShotSeen: (v: boolean) => void;
  errorScanStatus: string | null;
  setErrorScanStatus: (v: string | null) => void;
  errorReason: ScanFailureReason | null;
  setErrorReason: (v: ScanFailureReason | null) => void;
  showRateLimitUpsell: boolean;
  setShowRateLimitUpsell: (v: boolean) => void;
  showReAuth: boolean;
  setShowReAuth: (v: boolean) => void;
  showPostRevealGoalModal: boolean;
  setShowPostRevealGoalModal: (v: boolean) => void;
  scanGoals: ScanGoals | null;
  setScanGoals: (g: ScanGoals | null) => void;

  // Refs
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  isMountedRef: React.MutableRefObject<boolean>;
  hasCompletedScanRef: React.MutableRefObject<boolean>;
  routedScanId: string | null;

  // Actions
  handleMoneyShotComplete: () => void;
}

export function useScanFlow(callbacks: ScanFlowCallbacks): ScanFlowState {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routedScanId = searchParams.get('id');

  const [phase, setPhase] = useState<AppPhase>('hero');
  const [scanId, setScanId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [moneyShotSeen, setMoneyShotSeen] = useState(false);
  const [errorScanStatus, setErrorScanStatus] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<ScanFailureReason | null>(null);
  const [showRateLimitUpsell, setShowRateLimitUpsell] = useState(false);
  const [showReAuth, setShowReAuth] = useState(false);
  const [showPostRevealGoalModal, setShowPostRevealGoalModal] = useState(false);
  const [scanGoals, setScanGoals] = useState<ScanGoals | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const hasCompletedScanRef = useRef(false);
  const hydrationAttemptedRef = useRef<string | null>(null);

  // Unmount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // URL-driven scan hydration: when /?id=<scanId> is in the URL, restore that scan
  useEffect(() => {
    if (!routedScanId || scanReport) return;

    // Fast path: if navigated here with cached report in state, skip DB
    const navState = location.state as { cachedReport?: ScanReport; cachedScanId?: string } | null;
    if (navState?.cachedReport && navState?.cachedScanId === routedScanId) {
      setScanId(routedScanId);
      setScanReport(navState.cachedReport);
      setMoneyShotSeen(false);
      setPhase('seven-cards');
      window.history.replaceState({}, '', window.location.href);
      return;
    }

    if (hydrationAttemptedRef.current === routedScanId) return;
    hydrationAttemptedRef.current = routedScanId;

    let cancelled = false;
    const ACTIVE_STATUSES = new Set(['processing', 'running']);

    const hydrateExistingScan = async () => {
      setPhase('processing');
      try {
        try { sessionStorage.removeItem('jb_pending_input'); } catch {}

        // Audit fix #19: For anonymous users, the default `supabase` client has
        // no JWT and no x-scan-access-token header — RLS will block the row read
        // and the scan looks "lost" after refresh. If we have a stored anon
        // token for this scanId, use a scan-scoped client; otherwise fall back
        // to the default client (which still works for authed owners).
        const anonToken = getAnonScanToken(routedScanId);
        const readClient = anonToken ? createScanCheckClient(anonToken) : supabase;

        const { data, error } = await readClient
          .from('scans')
          .select('id, scan_status, final_json_report, access_token, country, industry, years_experience, metro_tier, linkedin_url')
          .eq('id', routedScanId)
          .single();

        if (cancelled) return;
        if (error || !data) {
          console.warn('[useScanFlow] Failed to restore scan from URL', error);
          setScanId('');
          setAccessToken('');
          setPhase('hero');
          return;
        }

        const row = data as ScanHydrationRow;
        setScanId(row.id);
        setAccessToken(row.access_token || '');

        // Restore onboarding fields via callback (owned by useOnboardingState)
        callbacks.onHydrateOnboardingFields({
          country: row.country ?? undefined,
          industry: row.industry ?? undefined,
          yearsExperience: row.years_experience ?? undefined,
          metroTier: row.metro_tier ?? undefined,
          linkedinUrl: row.linkedin_url ?? undefined,
        });

        if (row.scan_status === 'complete' && row.final_json_report) {
          setScanReport(row.final_json_report);
          hasCompletedScanRef.current = true;
          setMoneyShotSeen(false);
          setPhase('seven-cards');
          return;
        }

        if (ACTIVE_STATUSES.has(row.scan_status || '') && row.access_token) {
          cleanupRef.current?.();
          cleanupRef.current = subscribeScanStatus(
            routedScanId,
            row.access_token,
            (report) => {
              if (!isMountedRef.current || cancelled) return;
              setScanReport(report);
              hasCompletedScanRef.current = true;
              setMoneyShotSeen(false);
              setPhase('seven-cards');
            },
            (reason) => {
              if (!isMountedRef.current || cancelled) return;
              if (reason) setErrorReason(reason);
              setPhase('error');
            },
          );
          return;
        }

        console.warn('[useScanFlow] Scan restore unavailable for status', row.scan_status);
        setScanId('');
        setAccessToken('');
        setPhase('hero');
      } catch (err) {
        if (cancelled) return;
        console.error('[useScanFlow] Unexpected scan restore failure', err);
        setScanId('');
        setAccessToken('');
        setPhase('hero');
      }
    };

    void hydrateExistingScan();
    return () => { cancelled = true; };
  }, [routedScanId, scanReport, location.state, callbacks]);


  // Auto-recovery: when error screen shows, check if backend actually completed
  useEffect(() => {
    if (phase !== 'error') return;

    let cancelled = false;
    const tryRecover = async () => {
      setErrorScanStatus('checking');

      if (scanId && accessToken) {
        try {
          const sc = createScanCheckClient(accessToken);
          const { data } = await sc.from('scans')
            .select('scan_status, final_json_report')
            .eq('id', scanId)
            .single();
          const row = data as ScanRow | null;
          if (row?.scan_status === 'complete' && row?.final_json_report) {
            if (cancelled) return;
            setScanReport(row.final_json_report);
            setMoneyShotSeen(false);
            navigate(`/results/choose?id=${scanId}`);
            return;
          }
        } catch {}
      }

      if (routedScanId && routedScanId !== scanId) {
        try {
          const { data } = await supabase.from('scans')
            .select('id, scan_status, final_json_report, access_token')
            .eq('id', routedScanId)
            .single();
          const row = data as (ScanRow & { id: string; access_token: string | null }) | null;
          if (row?.scan_status === 'complete' && row?.final_json_report) {
            if (cancelled) return;
            setScanId(row.id);
            setAccessToken(row.access_token || '');
            setScanReport(row.final_json_report);
            setMoneyShotSeen(false);
            navigate(`/results/choose?id=${routedScanId}`);
            return;
          }
        } catch {}
      }

      if (!cancelled && isMountedRef.current) setErrorScanStatus('failed');
    };

    void tryRecover();
    return () => { cancelled = true; };
  }, [phase, scanId, accessToken, routedScanId, navigate]);

  // Stable action callbacks
  const handleMoneyShotComplete = useCallback(() => {
    setMoneyShotSeen(true);
    if (scanId) {
      navigate(`/results/model-b?id=${scanId}`);
    } else {
      setPhase('reveal');
    }
  }, [scanId, navigate]);


  return {
    phase,
    setPhase,
    scanId,
    setScanId,
    accessToken,
    setAccessToken,
    scanReport,
    setScanReport,
    moneyShotSeen,
    setMoneyShotSeen,
    errorScanStatus,
    setErrorScanStatus,
    showRateLimitUpsell,
    setShowRateLimitUpsell,
    showReAuth,
    setShowReAuth,
    showPostRevealGoalModal,
    setShowPostRevealGoalModal,
    scanGoals,
    setScanGoals,

    cleanupRef,
    isMountedRef,
    hasCompletedScanRef,
    routedScanId,

    handleMoneyShotComplete,
  };
}
