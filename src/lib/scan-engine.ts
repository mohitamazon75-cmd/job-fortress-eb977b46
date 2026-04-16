import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';

// ── Scan-specific client: adds x-scan-access-token header so RLS policy
//    "Anon can select scan by access_token" allows reading without user JWT
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as SUPABASE_KEY } from '@/lib/supabase-config';

function createScanClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { 'x-scan-access-token': accessToken } },
    auth: { persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────
// Issue #8: Safe ScanReport parsing helper
// ─────────────────────────────────────────────────────────────
function parseScanReport(raw: unknown): ScanReport | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as ScanReport;
}

// ═══════════════════════════════════════════════════════════════
// V3.2 SCAN REPORT TYPES
// ═══════════════════════════════════════════════════════════════

export interface ReplacingTool {
  tool_name: string;
  automates_task: string;
  adoption_stage: 'Early' | 'Growing' | 'Mainstream';
}

export interface GeoArbitrage {
  target_market: string;
  raw_delta_inr_monthly: number;
  probability_adjusted_delta_inr: number;
  geo_probability_pct: number;
  expected_value_12mo_inr: number;
  fastest_path_weeks: number;
}

export interface Tier2Alternative {
  recommended_city: string;
  salary_estimate_inr: number;
  probability: number;
}

export interface ObsolescenceTimeline {
  purple_zone_months: number;
  yellow_zone_months: number;
  orange_zone_months: number;
  red_zone_months: number;
  already_in_warning: boolean;
}

export interface Survivability {
  score: number;
  breakdown: {
    experience_bonus: number;
    strategic_bonus: number;
    geo_bonus: number;
    adaptability_bonus: number;
  };
  primary_vulnerability: string;
  peer_percentile_estimate: string;
}

export interface SkillGap {
  missing_skill: string;
  importance_for_pivot: number;
  fastest_path: string;
  weeks_to_proficiency: number;
  salary_unlock_inr_monthly?: number; // deprecated — legacy scans may still have this
  demand_signal?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface LearningResource {
  title: string;
  author_or_platform: string;
  url?: string;
  why_relevant: string;
}

export interface WeeklyAction {
  week: number;
  theme: string;
  action: string;
  deliverable: string;
  effort_hours: number;
  fallback_action: string;
  books?: LearningResource[];
  courses?: LearningResource[];
  videos?: LearningResource[];
}

export interface ImmediateNextStep {
  action: string;
  rationale: string;
  time_required: string;
  deliverable: string;
}

export interface CulturalRiskAssessment {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  family_conversation_script: string;
  social_proof_example: string;
}

export interface DataQuality {
  profile_completeness: number;
  kg_coverage: number;
  overall: 'HIGH' | 'MEDIUM' | 'LOW';
  unmatched_skills_count?: number;
  salary_source?: 'real_api' | 'not_available';
  market_signals_source?: 'real_api' | 'tavily_search';
  posting_count_source?: 'real_api' | 'search_result_count';
  data_age_hours?: number | null;
  profile_completeness_pct?: number;
  profile_gaps?: string[];
}

// Task 1: Score Breakdown
export interface SkillAdjustment {
  skill_name: string;
  automation_risk: number;
  weight: number;
  contribution: number;
}

export interface ScoreBreakdown {
  base_score: number;
  skill_adjustments: SkillAdjustment[];
  weighted_skill_average: number | null;
  market_pressure: number;
  experience_reduction: number;
  pre_clamp_score: number;
  final_clamped: number;
  salary_bleed_breakdown: {
    depreciation_rate: number;
    market_amplifier: number;
    ai_pressure_add: number;
    final_rate: number;
  };
  survivability_breakdown: {
    base: number;
    experience_bonus: number;
    strategic_bonus: number;
    geo_bonus: number;
    adaptability_bonus: number;
    seniority_bonus: number;
    di_penalty: number;
    final: number;
  };
}

// Task 2: Score Variability
export interface ScoreVariability {
  di_range: { low: number; high: number };
  months_range: { low: number; high: number };
  salary_bleed_range: { low: number; high: number };
}

export interface ExecutiveImpactSignals {
  revenue_scope_usd: number | null;
  team_size_direct: number | null;
  team_size_org: number | null;
  budget_authority_usd: number | null;
  regulatory_domains: string[];
  geographic_scope: string[];
  board_exposure: boolean;
  investor_facing: boolean;
  domain_tenure_years: number | null;
  cross_industry_pivots: number;
  moat_type: 'REGULATORY' | 'SCALE' | 'RELATIONSHIP' | 'DOMAIN' | 'HYBRID' | null;
  moat_evidence: string | null;
}

export interface ScanReport {
  role: string;
  determinism_index: number;
  determinism_confidence?: 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  months_remaining: number;
  salary_bleed_monthly: number;
  total_5yr_loss_inr?: number;
  execution_skills_dead: string[];
  cognitive_moat: string;
  moat_skills: string[];
  industry: string;
  ai_tools_replacing: (string | ReplacingTool)[];
  arbitrage_role: string;
  arbitrage_companies_count: number;
  free_advice_1: string;
  free_advice_2: string;
  free_advice_3?: string;
  geo_advantage: string;
  geo_arbitrage?: GeoArbitrage | null;
  tier2_alternative?: Tier2Alternative | null;
  obsolescence_timeline?: ObsolescenceTimeline | null;
  survivability?: Survivability | null;
  skill_gap_map?: SkillGap[];
  weekly_action_plan?: WeeklyAction[];
  immediate_next_step?: ImmediateNextStep | null;
  cultural_risk_assessment?: CulturalRiskAssessment | null;
  tone_tag?: 'CRITICAL' | 'WARNING' | 'MODERATE' | 'STABLE';
  dead_end_narrative?: string;
  source: string;
  // Persisted skill arrays from Agent 1 for insight cards
  all_skills?: string[];
  execution_skills?: string[];
  strategic_skills?: string[];
  linkedin_name?: string | null;
  linkedin_company?: string | null;
  seniority_tier?: 'EXECUTIVE' | 'SENIOR_LEADER' | 'MANAGER' | 'PROFESSIONAL' | 'ENTRY' | null;
  executive_impact?: ExecutiveImpactSignals | null;
  data_quality?: DataQuality | null;
  engine_version?: string;
  computation_method?: {
    numbers: string;
    qualitative: string;
    kg_skills_matched: number;
  };
  // Task 1 & 2
  score_breakdown?: ScoreBreakdown | null;
  score_variability?: ScoreVariability | null;
  // Task 8
  compound_role?: boolean;
  role_components?: string[];
  // Task 6
  company_tier?: string | null;
  // ML Enhancement
  ml_enhanced?: boolean;
  ml_timed_out?: boolean;
  ml_raw?: any;
  automation_risk?: number | null;
  judo_strategy?: {
    recommended_tool: string;
    pitch: string;
    survivability_after_judo: number;
    months_gained: number;
  } | null;
  weekly_survival_diet?: {
    theme: string;
    read: { title: string; action: string; time_commitment: string };
    watch: { title: string; action: string; time_commitment: string };
    listen: { title: string; action: string; time_commitment: string };
  } | null;
  market_position_model?: {
    market_percentile: number;
    competitive_tier: string;
    leverage_status: string;
    talent_density: string;
    demand_trend: string;
  } | null;
  career_shock_simulator?: {
    expected_time_to_rehire_months: number;
    worst_case_scenario_months: number;
    financial_runway_needed_in_months: number;
    salary_drop_percentage: number;
    most_probable_role_offered?: string;
    highest_probability_hiring_industries?: string[];
  } | null;
  // Phase 2: Full-Spectrum Tier Intelligence
  moat_score?: number;
  urgency_score?: number;
  automatable_task_ratio?: 'HIGH' | 'MEDIUM' | 'LOW';
  primary_ai_threat_vector?: string;
  moat_indicators?: string[];
  metro_tier?: string | null;
  // Fields populated from scan context
  country?: string;
  years_experience?: string;
  estimated_monthly_salary_inr?: number;
  pivot_roles?: Array<{ role?: string; title?: string; [key: string]: unknown }>;
  // Graph/peer analysis fields
  matched_job_family?: string;
  peer_percentile_estimate?: number;
  // Defense plan & gating fields
  // NOTE: threat_timeline from Agent 2A has a different shape than the array below.
  // Agent 2A outputs: { partial_displacement_year, significant_displacement_year, critical_displacement_year, primary_threat_tool, at_risk_task }
  threat_timeline?: {
    partial_displacement_year?: number;
    significant_displacement_year?: number;
    critical_displacement_year?: number;
    primary_threat_tool?: string;
    at_risk_task?: string;
  } | Array<{ period: string; risk_level: string; description: string }> | null;
  role_detected?: string | null;
  current_role?: string | null;
  defense_plan?: string | null;
  user_is_pro?: boolean;
  skill_threat_intel?: SkillThreatIntel[] | null;
  // Fields previously generated by Agent 2A but dropped from DB — now persisted
  moat_narrative?: string | null;
  urgency_horizon?: string | null;
  skill_trajectory?: Array<{
    skill: string;
    current_state: string;
    month_1: string;
    month_3: string;
    pivot_title: string;
  }> | null;
}

export interface SkillThreatIntel {
  skill: string;
  threat_tool: string;
  what_ai_does: string;
  what_human_still_owns: string;
  industry_proof: string;
  risk_pct?: number; // deprecated — legacy scans may still have this
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Helper to normalize tools (can be string or object)
export function normalizeTools(tools: (string | ReplacingTool)[]): ReplacingTool[] {
  return (tools || []).map((t) => {
    if (typeof t === 'string') return { tool_name: t, automates_task: 'Various tasks', adoption_stage: 'Growing' as const };
    return t;
  });
}

// ═══════════════════════════════════════════════════════════════
// SCAN OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function createScan(params: {
  linkedinUrl?: string;
  resumeFilePath?: string;
  country?: string;
  industry?: string;
  yearsExperience?: string;
  metroTier?: string;
  keySkills?: string;
  estimatedMonthlySalaryInr?: number | null; // Optional CTC — improves Replacement Invoice accuracy
}): Promise<{ id: string; accessToken: string; triggered?: boolean }> {
  // Check if user is authenticated to associate scan with user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error('Authentication check failed. Please sign in again.')
  }

  // ── Use the create-scan edge function (service role) to bypass RLS ──
  // The "Allow anonymous insert" policy was removed (migration 20260309140336),
  // so direct REST inserts fail with 401 for anon users.  The edge function
  // runs with SUPABASE_SERVICE_ROLE_KEY and handles dedup + safe insertion.
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('create-scan', {
      body: {
        linkedinUrl: params.linkedinUrl || null,
        resumeFilePath: params.resumeFilePath || null,
        country: params.country || 'IN',
        industry: params.industry || null,
        yearsExperience: params.yearsExperience || null,
        metroTier: params.metroTier || null,
        keySkills: params.keySkills || null,
        userId: user?.id || null,
        // VibeSec: server-side clamp enforced in create-scan edge fn (5k–5M INR/month)
        estimatedMonthlySalaryInr: params.estimatedMonthlySalaryInr ?? null,
      },
    });

    if (!fnError && fnData?.id) {
      const scanId = fnData.id as string;
      const accessToken = fnData.accessToken as string;

      // Week 1 #1: Store scan ID for anonymous migration with 30-day TTL
      if (!user?.id) {
        try {
          const scanEntry = { id: scanId, storedAt: Date.now() };
          const existing = JSON.parse(localStorage.getItem('anon_scans') || '[]');
          const pruned = existing.filter((e: any) => Date.now() - e.storedAt < 30 * 24 * 60 * 60 * 1000);
          localStorage.setItem('anon_scans', JSON.stringify([...pruned, scanEntry].slice(-10)));
        } catch {}
      }

      console.debug('[Scan] Created via edge function:', scanId);
      const triggered = !!(fnData.triggered);
      return { id: scanId, accessToken, triggered };
    }

    // Log edge function error but fall through to direct insert attempt
    console.warn('[Scan] create-scan edge function failed, trying direct insert:', fnError);
  } catch (fnErr) {
    console.warn('[Scan] create-scan edge function threw, trying direct insert:', fnErr);
  }

  const insertPayload: Record<string, unknown> = {
    linkedin_url: params.linkedinUrl || null,
    resume_file_path: params.resumeFilePath || null,
    country: params.country || 'IN',
    industry: params.industry || null,
    years_experience: params.yearsExperience || null,
    metro_tier: params.metroTier || null,
    scan_status: 'processing',
    payment_status: 'unpaid',
    // Store manual key skills in enrichment_cache for process-scan to read
    ...(params.keySkills ? { enrichment_cache: { key_skills: params.keySkills } } : {}),
  };

  if (user?.id) {
    insertPayload.user_id = user.id;
  }

  const { data, error } = await supabase
    .from('scans')
    .insert(insertPayload as any)
    .select('id, access_token')
    .single();

  if (error) throw error;
  const row = data as { id: string; access_token: string } | null;
  if (!row?.id) throw new Error('Scan creation returned no ID');

  // Week 1 #1: Store scan ID for anonymous migration with 30-day TTL
  if (!user?.id) {
    try {
      const scanEntry = { id: row.id, storedAt: Date.now() };
      const existing = JSON.parse(localStorage.getItem('anon_scans') || '[]');
      const pruned = existing.filter((e: any) => Date.now() - e.storedAt < 30 * 24 * 60 * 60 * 1000);
      localStorage.setItem('anon_scans', JSON.stringify([...pruned, scanEntry].slice(-10)));
    } catch {}
  }

  return { id: row.id, accessToken: row.access_token };
}

export async function uploadResume(file: File, scanId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session expired before the resume upload completed. Please try again.');
  }

  const formData = new FormData();
  formData.append('scanId', scanId);
  formData.append('file', file, file.name || 'resume.pdf');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-resume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null) as { filePath?: string; error?: string } | null;
  if (!response.ok || !payload?.filePath) {
    throw new Error(payload?.error || 'Resume upload failed');
  }

  return payload.filePath;
}

export async function triggerProcessScan(
  scanId: string,
  forceRefresh = false,
  accessToken?: string
): Promise<{ accepted: boolean; reason?: 'rate_limited' | 'failed'; error?: string }> {
  const body: Record<string, unknown> = { scanId, forceRefresh };
  const scanClient = accessToken ? createScanClient(accessToken) : supabase;
  const processScanUrl = `${SUPABASE_URL}/functions/v1/process-scan`;

  const getProcessScanHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
    };

    if (!session?.access_token && accessToken) {
      headers['x-scan-access-token'] = accessToken;
    }

    return headers;
  };

  const readFunctionError = async (response: Response): Promise<string> => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      return payload?.error || payload?.message || `HTTP ${response.status}`;
    }

    const text = await response.text().catch(() => '');
    return text || `HTTP ${response.status}`;
  };

  const markScanError = async () => {
    try {
      await supabase
        .from('scans')
        .update({ scan_status: 'error' })
        .eq('id', scanId);
    } catch (updateErr) {
      console.warn('Failed to mark scan as error after invoke failure:', updateErr);
    }
  };

  const tryInvoke = async (): Promise<{ accepted: boolean; reason?: 'rate_limited' | 'failed'; error?: string }> => {
    const INVOKE_WAIT_MS = 12_000;

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), INVOKE_WAIT_MS);

      const response = await fetch(processScanUrl, {
        method: 'POST',
        headers: await getProcessScanHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      window.clearTimeout(timer);

      if (response.ok) {
        await response.text().catch(() => '');
        return { accepted: true };
      }

      const status = response.status;
      const message = await readFunctionError(response);

      if (status === 429 || /429|rate limit/i.test(message)) {
        console.warn('process-scan request returned 429:', message);

        const { data: current } = await scanClient
          .from('scans')
          .select('scan_status')
          .eq('id', scanId)
          .single();

        if ((current as any)?.scan_status === 'processing' || (current as any)?.scan_status === 'running') {
          console.warn('[Scan] 429 received but scan is active; continuing polling');
          return { accepted: true };
        }

        await markScanError();
        return { accepted: false, reason: 'rate_limited' };
      }

      if (status && status >= 400 && status < 500 && status !== 408) {
        console.warn(`process-scan request non-retriable error (status ${status}):`, message);
        await markScanError();
        return { accepted: false, reason: 'failed', error: message };
      }

      // Ambiguous network failures: avoid duplicate invocations. If row is still processing, continue polling.
      const { data: current2 } = await scanClient
        .from('scans')
        .select('scan_status')
        .eq('id', scanId)
        .single();

      if ((current2 as any)?.scan_status === 'processing' || (current2 as any)?.scan_status === 'running') {
        console.warn('[Scan] process-scan request returned transient error; scan is still active, continuing polling');
        return { accepted: true };
      }

      await markScanError();
      return { accepted: false, reason: 'failed' };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.debug(`[Scan] process-scan request still running after ${INVOKE_WAIT_MS}ms; continuing with status polling`);
        return { accepted: true };
      }

      const errMessage = err instanceof Error ? err.message : String(err);
      console.warn('process-scan request exception:', err);

      const { data: current3 } = await scanClient
        .from('scans')
        .select('scan_status')
        .eq('id', scanId)
        .single();

      if ((current3 as any)?.scan_status === 'processing' || (current3 as any)?.scan_status === 'running') {
        console.warn('[Scan] process-scan request exception but scan is active; continuing polling');
        return { accepted: true };
      }

      await markScanError();
      return { accepted: false, reason: 'failed', error: errMessage };
    }
  };

  return tryInvoke();
}

export function subscribeScanStatus(
  scanId: string,
  accessToken: string,
  onComplete: (report: ScanReport) => void,
  onError?: () => void
) {
  // Use scan-specific client with x-scan-access-token header so RLS allows reading
  const scanClient = createScanClient(accessToken);
  const ACTIVE_SCAN_STATUSES = new Set(['processing', 'running']);
  const TERMINAL_SCAN_STATUSES = new Set(['failed', 'invalid_input', 'error']);

  let resolved = false;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;
  let hardTimeout: ReturnType<typeof setTimeout> | null = null;
  let realtimeConnected = false;

  const clearTimers = () => {
    if (pollTimeout) clearTimeout(pollTimeout);
    if (hardTimeout) clearTimeout(hardTimeout);
  };

  const resolve = (report: ScanReport) => {
    if (resolved) return;
    resolved = true;
    clearTimers();
    channel.unsubscribe();
    onComplete(report);
  };

  const reject = () => {
    if (resolved) return;
    resolved = true;
    clearTimers();
    channel.unsubscribe();
    onError?.();
  };

  const verifyTerminalState = async (source: string) => {
    if (resolved) return;

    try {
      const { data } = await scanClient
        .from('scans')
        .select('scan_status, final_json_report, industry')
        .eq('id', scanId)
        .single();

      const row = data as Record<string, unknown> | null;
      const status = String(row?.scan_status || '');

      if (status === 'complete' && row?.final_json_report) {
        console.debug(`[Scan] ${source} recovered completed scan after terminal signal`);
        const parsed = parseScanReport(row.final_json_report);
        if (parsed) {
          resolve(parsed);
          return;
        }
      }

      if (ACTIVE_SCAN_STATUSES.has(status)) {
        console.warn(`[Scan] ${source} saw transient terminal signal while scan is still active; continuing to poll`);
        startPolling();
        return;
      }
    } catch (error) {
      console.warn(`[Scan] ${source} terminal-state verification failed; continuing to poll`, error);
      startPolling();
      return;
    }

    reject();
  };

  // Immediate check: the scan may already be complete before we subscribe
  const immediateCheck = async () => {
    if (resolved) return;
    try {
      const { data } = await scanClient
        .from('scans')
        .select('scan_status, final_json_report, industry')
        .eq('id', scanId)
        .single();
      const row = data as Record<string, unknown> | null;
      if (row?.scan_status === 'complete' && row?.final_json_report) {
        console.debug('[Scan] Immediate check found completed scan');
        const parsed = parseScanReport(row.final_json_report);
        if (parsed) {
          resolve(parsed);
        }
      } else if (TERMINAL_SCAN_STATUSES.has(String(row?.scan_status || ''))) {
        await verifyTerminalState('Immediate check');
      }
    } catch (e) {
      console.warn('[Scan] Immediate check error:', e);
    }
  };

  // PRIMARY: Realtime subscription
  const channel = supabase
    .channel(`scan-${scanId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'scans',
        filter: `id=eq.${scanId}`,
      },
      (payload) => {
        const row = payload.new as any;
        if (row.scan_status === 'complete' && row.final_json_report) {
          const parsed = parseScanReport(row.final_json_report);
          if (parsed) {
            resolve(parsed);
          }
        } else if (TERMINAL_SCAN_STATUSES.has(String(row.scan_status || ''))) {
          void verifyTerminalState('Realtime update');
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeConnected = true;
        console.debug('[Scan] Realtime connected');
        // Re-check immediately after realtime connects to catch updates during connection
        immediateCheck();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Scan] Realtime failed, activating polling fallback');
        realtimeConnected = false;
        startPolling();
      }
    });

  // FALLBACK: Polling with exponential backoff
  const getPollingInterval = (attempt: number) =>
    attempt < 2 ? 3000 : attempt < 5 ? 5000 : attempt < 10 ? 8000 : 10000;
  const MAX_POLL_ATTEMPTS = 25; // ~3+ minutes with backoff

  const pollForResult = async (attempt: number) => {
    if (resolved) return;

    try {
      const { data } = await scanClient
        .from('scans')
        .select('scan_status, final_json_report, industry')
        .eq('id', scanId)
        .single();

      const row = data as Record<string, unknown> | null;
      if (row?.scan_status === 'complete' && row?.final_json_report) {
        const parsed = parseScanReport(row.final_json_report);
        if (parsed) {
          resolve(parsed);
        }
        return;
      }
      if (TERMINAL_SCAN_STATUSES.has(String(row?.scan_status || ''))) {
        await verifyTerminalState('Polling');
        return;
      }
    } catch (error) {
      console.warn('[Scan] Poll error, retrying...', error);
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      pollTimeout = setTimeout(() => void pollForResult(attempt + 1), getPollingInterval(attempt));
      return;
    }

    console.error('[Scan] Pipeline timed out after poll attempts');
    reject();
  };

  const startPolling = () => {
    if (resolved || pollTimeout) return;
    void pollForResult(0);
  };

  // Refresh token to ensure it won't expire during a long scan
  (async () => {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      console.warn('Token refresh before polling failed:', e);
      // Non-fatal — continue anyway
    }
  })();

  // Do an immediate check right away (catches already-complete scans)
  immediateCheck().catch(err => console.error('[scan-engine]', err));

  // Global timeout (applies even if Realtime is connected but no updates arrive)
  const MAX_TOTAL_WAIT_MS = 360_000; // 6 min — allows longer scans to complete
  hardTimeout = setTimeout(() => {
    if (resolved) return;
    console.error('[Scan] Global timeout reached, failing scan subscription');
    reject();
  }, MAX_TOTAL_WAIT_MS);

  // Grace period: start polling as a safety net even when Realtime is connected
  setTimeout(() => {
    if (!resolved) {
      if (!realtimeConnected) {
        console.warn('[Scan] Realtime grace period expired, starting safety polling');
      }
      startPolling();
    }
  }, 10_000);

  return () => {
    resolved = true;
    clearTimers();
    channel.unsubscribe();
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

export function formatINR(amount: number): string {
  return formatCurrency(amount, 'IN');
}

export function formatCurrency(amount: number, country?: string | null): string {
  const code = (country || 'IN').toUpperCase();
  const config: Record<string, { locale: string; currency: string }> = {
    IN: { locale: 'en-IN', currency: 'INR' },
    US: { locale: 'en-US', currency: 'USD' },
    AE: { locale: 'en-AE', currency: 'AED' },
  };
  const { locale, currency } = config[code] || config.IN;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
