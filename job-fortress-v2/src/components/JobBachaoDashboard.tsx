import { motion, AnimatePresence } from 'framer-motion';
import { inferSeniorityTier, isExecutiveTier, getScoreColor } from '@/lib/seniority-utils';
import { computeStabilityScore } from '@/lib/stability-score';
import RateLimitUpsell from '@/components/RateLimitUpsell';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { useLiveEnrichment } from '@/hooks/use-live-enrichment';
import { useJudoIntel } from '@/hooks/use-judo-intel';
import { buildPivotOptions } from '@/lib/airmm-optimizer';
import { toast } from 'sonner';
import { RotateCcw, Stethoscope, Swords, Radio, Sparkles, MessageCircle, TrendingUp } from 'lucide-react';
import FateCardShare from '@/components/dashboard/FateCardShare';
import ChallengeColleague from '@/components/dashboard/ChallengeColleague';
import LocaleToggle from '@/components/dashboard/LocaleToggle';
import { useLocale } from '@/hooks/use-locale';
import type { DashboardSharedProps } from '@/components/dashboard/DashboardTypes';
import { useAuth } from '@/hooks/useAuth';
import ProGateCard from '@/components/ProGateCard';

// Tab components
import DiagnosisTab from '@/components/dashboard/DiagnosisTab';
import DefenseTab from '@/components/dashboard/DefenseTab';
import IntelTab from '@/components/dashboard/IntelTab';
import DossierTab from '@/components/dashboard/DossierTab';
import ReportChat from '@/components/dashboard/ReportChat';
import CoachNudgeWidget from '@/components/dashboard/CoachNudgeWidget';
import ScoreHistoryTab from '@/components/dashboard/ScoreHistoryTab';

interface JobBachaoDashboardProps {
  report: ScanReport;
  scanId: string;
  accessToken?: string;
  onReset: () => void;
  country?: string;
  scanGoals?: { intent?: string };
}

type BriefingScreen = 'diagnosis' | 'defense' | 'intel' | 'dossier' | 'history' | 'coach';

function getInitialTab(intent?: string): BriefingScreen {
  if (intent === 'actively_looking') return 'defense';
  if (intent === 'monitoring') return 'diagnosis';
  if (intent === 'future_planning') return 'intel';
  return 'diagnosis';
}

export default function JobBachaoDashboard({ report, scanId, accessToken, onReset, country: countryProp, scanGoals }: JobBachaoDashboardProps) {
  const executionSkillsDead = report.execution_skills_dead || [];
  const moatSkills = report.moat_skills || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const source = report.source || 'mock';
  const deadEndNarrative = report.dead_end_narrative || '';

  const [activeScreen, setActiveScreen] = useState<BriefingScreen>(() => getInitialTab(scanGoals?.intent));
  const [showRecommendedBadge, setShowRecommendedBadge] = useState(true);
  const [kgLastRefresh, setKgLastRefresh] = useState<string | null>(null);
  const [showRateLimitUpsell, setShowRateLimitUpsell] = useState(false);
  const [rateLimitMinutes, setRateLimitMinutes] = useState(0);
  const [scanCountry, setScanCountry] = useState<string | null>(countryProp || null);
  const { locale, toggleLocale, strings } = useLocale('en');
  const { user } = useAuth();

  // Pro status: check report flag, then check referral pro grant in DB
  const [isProUser, setIsProUser] = useState<boolean>(!!(report as any).user_is_pro);

  const refreshProStatus = async () => {
    if ((report as any).user_is_pro) { setIsProUser(true); return; }
    if (!user?.id) return;
    const { supabase: sb } = await import('@/integrations/supabase/client');
    try {
      const { data } = await sb.from('referral_pro_grants')
        .select('expires_at')
        .eq('user_id', user.id)
        .single();
      if (data?.expires_at && new Date(data.expires_at) > new Date()) {
        setIsProUser(true);
      }
    } catch (e) {
      console.error('Error fetching pro status:', e);
    }
  };

  useEffect(() => {
    refreshProStatus();
  }, [user?.id]);

  // Listen for subscription updates from ProUpgradeModal
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      refreshProStatus();
    };
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, [user?.id]);

  const pivotRoleNames = useMemo(() => {
    const pivots = buildPivotOptions(report);
    return pivots.slice(0, 3).map(p => p.label);
  }, [report]);

  // Use ACTUAL profile skills for enrichment/intelligence — NOT abstract AI-generated labels
  // moat_skills/execution_skills_dead are AI analysis labels (e.g. "Algorithmic P&L Management")
  // report.all_skills contains the user's REAL skills (e.g. "Technology Consulting", "Python")
  const allSkills = useMemo(() => {
    const real = report.all_skills || [];
    if (real.length > 0) return real;
    // Fallback only if all_skills is empty
    return [...executionSkillsDead, ...(report.moat_skills || [])];
  }, [report]);

  const immediateNextStep = useMemo(() => {
    const step = report.immediate_next_step;
    if (!step) return null;
    const role = (report.role || '').toLowerCase();
    const isFounderLike = /(\bco[\s-]?founder\b|\bfounder\b|\bowner\b|\bmanaging\s+partner\b)/i.test(role);
    if (!isFounderLike) return step;
    const action = step.action || '';
    const rationale = step.rationale || '';
    const founderMismatch =
      /(1[-\s]?on[-\s]?1|meeting|schedule).*(ceo|founder|leadership)/i.test(action) ||
      /(align\s+on\s+strategic\s+priorities\s+for\s+ai\s+integration)/i.test(action) ||
      /(align\s+with\s+leadership)/i.test(rationale);
    if (!founderMismatch) return step;
    const company = report.linkedin_company || 'your company';
    return {
      ...step,
      action: `Draft and approve ${company}'s 30-day AI Transformation Blueprint, then align execution owners with your co-founder/team.`,
      rationale: "As a founder/co-founder, you're the decision-maker. Your highest-leverage move is setting AI strategy and execution priorities directly.",
      time_required: step.time_required || '2 hours (strategy) + 1 hour (team alignment)',
      deliverable: 'A one-page AI Transformation Blueprint with 3 priorities, owners, and 30-day KPIs.',
    };
  }, [report]);

  const enrichment = useLiveEnrichment(report.role, report.industry, allSkills, moatSkills, pivotRoleNames, scanId);
  const judoIntel = useJudoIntel(report.judo_strategy?.recommended_tool, report.role, report.industry);

  useEffect(() => {
    supabase
      .from('market_signals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.created_at) {
          const hoursAgo = Math.round((Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60));
          setKgLastRefresh(hoursAgo < 1 ? 'just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`);
        }
      });
    if (!countryProp) {
      supabase.from('scans').select('country').eq('id', scanId).single().then(({ data }) => {
        if (data?.country) setScanCountry(data.country);
      });
    }
  }, [scanId]);

  const seniorityTier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(seniorityTier);
  const displayScoreValue = computeStabilityScore(report);
  const clampedRisk = 100 - displayScoreValue;
  const scoreColorClass = getScoreColor(clampedRisk, seniorityTier);

  useEffect(() => {
    if (report.ml_timed_out) {
      toast('Running in offline mode.', { description: 'ML engine timed out — results use our deterministic engine.', duration: 6000 });
    }
  }, [report.ml_timed_out]);

  const toneTag = report.tone_tag || (clampedRisk > 75 ? 'CRITICAL' : clampedRisk > 55 ? 'WARNING' : clampedRisk > 35 ? 'MODERATE' : 'STABLE');
  const toneColors: Record<string, string> = {
    CRITICAL: 'bg-prophet-red/10 text-prophet-red border-prophet-red/30',
    WARNING: 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/30',
    MODERATE: 'bg-primary/10 text-primary border-primary/30',
    STABLE: 'bg-prophet-green/10 text-prophet-green border-prophet-green/30',
  };

  const userName = report.linkedin_name || 'Professional';
  const userCompany = report.linkedin_company;
  const displayRole = (!report.role || report.role === 'Unknown') ? `${report.industry || 'IT'} Professional` : report.role;
  const isLinkedIn = source.includes('linkedin');
  const isResume = source.includes('resume') || source.includes('deterministic');
  const profileContext = userCompany ? `${userName} at ${userCompany}` : userName;
  const ci = report.score_variability;
  const kgMatched = report.computation_method?.kg_skills_matched || 0;

  const normalizedMarketPosition = useMemo(() => {
    const raw = report.market_position_model as Record<string, unknown> | null | undefined;
    if (!raw || typeof raw !== 'object') return null;
    const parseNum = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
      return null;
    };
    const percentileRaw = parseNum(raw.market_percentile ?? raw.gaussian_fit_percentile ?? raw.marketPercentile);
    const fallbackPercentile = Math.max(5, Math.min(95, 100 - Math.round(report.determinism_index || 50)));
    const percentile = Math.max(1, Math.min(99, Math.round(percentileRaw ?? fallbackPercentile)));
    const alignment = parseNum(raw.industry_alignment_score);
    const competitiveTier = typeof raw.competitive_tier === 'string' && raw.competitive_tier.trim().length > 0
      ? raw.competitive_tier
      : typeof raw.market_position === 'string' && raw.market_position.trim().length > 0
        ? raw.market_position.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : percentile <= 35 ? 'Strong Position' : percentile <= 70 ? 'Balanced Position' : 'Crowded Segment';
    const leverageStatus = typeof raw.leverage_status === 'string' && raw.leverage_status.trim().length > 0
      ? raw.leverage_status
      : percentile <= 20 ? 'High Leverage' : percentile <= 45 ? 'Moderate Leverage' : 'Low Leverage';
    const talentDensity = typeof raw.talent_density === 'string' && raw.talent_density.trim().length > 0
      ? raw.talent_density
      : alignment != null ? `${Math.round(alignment)}% industry alignment`
        : percentile <= 30 ? `Lower competition in ${report.industry}` : percentile <= 70 ? `Balanced competition in ${report.industry}` : `Higher competition in ${report.industry}`;
    const demandTrend = typeof raw.demand_trend === 'string' && raw.demand_trend.trim().length > 0
      ? raw.demand_trend
      : percentile <= 35 ? 'Rising demand' : percentile <= 70 ? 'Stable demand' : 'Demand pressure';
    return { market_percentile: percentile, competitive_tier: competitiveTier, leverage_status: leverageStatus, talent_density: talentDensity, demand_trend: demandTrend };
  }, [report.market_position_model, report.determinism_index, report.industry]);

  const normalizedCareerShock = useMemo(() => {
    const raw = report.career_shock_simulator as Record<string, unknown> | null | undefined;
    if (!raw || typeof raw !== 'object') return null;
    const parseNum = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
      return null;
    };
    const expected = parseNum(raw.expected_time_to_rehire_months ?? raw.estimated_job_search_months) ?? Math.max(2, Math.round((report.months_remaining || 12) * 0.35));
    const worst = parseNum(raw.worst_case_scenario_months ?? raw.full_recovery_months) ?? Math.round(expected * 2.2);
    const runway = parseNum(raw.financial_runway_needed_in_months) ?? Math.round(worst * 1.3);
    const salaryDrop = parseNum(raw.salary_drop_percentage ?? raw.projected_salary_cut_percent) ?? Math.round((report.determinism_index || 50) * 0.2);
    return {
      expected_time_to_rehire_months: Math.max(1, Math.round(expected * 10) / 10),
      worst_case_scenario_months: Math.max(1, Math.round(worst)),
      financial_runway_needed_in_months: Math.max(3, Math.round(runway)),
      salary_drop_percentage: Math.max(1, Math.round(salaryDrop)),
      most_probable_role_offered: (() => {
        const suggested = typeof raw.most_probable_role_offered === 'string' ? raw.most_probable_role_offered : undefined;
        if (!suggested) return undefined;
        const RANK: Record<string, number> = {
          'founder': 10, 'co-founder': 10, 'cofounder': 10, 'owner': 10, 'managing partner': 9,
          'ceo': 10, 'cto': 9, 'cfo': 9, 'coo': 9, 'cmo': 9, 'cpo': 9,
          'president': 9, 'vice president': 8, 'vp': 8, 'svp': 8, 'evp': 8,
          'director': 7, 'senior director': 7.5, 'head': 7, 'principal': 7,
          'senior manager': 6, 'manager': 5, 'lead': 5, 'senior': 4,
        };
        const getRank = (t: string) => { const l = t.toLowerCase(); for (const [k, r] of Object.entries(RANK)) { if (l.includes(k)) return r; } return 3; };
        const currentRole = report.role || '';
        const curRank = getRank(currentRole);
        const sugRank = getRank(suggested);
        if (sugRank < curRank && curRank >= 7) return `${currentRole} — AI-Augmented (strategic leadership with AI leverage)`;
        return suggested;
      })(),
      highest_probability_hiring_industries: Array.isArray(raw.highest_probability_hiring_industries) ? (raw.highest_probability_hiring_industries as string[]) : undefined,
    };
  }, [report.career_shock_simulator, report.months_remaining, report.determinism_index]);

  const screens: { id: BriefingScreen; label: string; icon: React.ReactNode; shortLabel: string }[] = [
    { id: 'diagnosis', label: 'Diagnosis', shortLabel: 'Diagnosis', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'defense', label: 'Defense Plan', shortLabel: 'Defense', icon: <Swords className="w-4 h-4" /> },
    { id: 'intel', label: 'Market Intel', shortLabel: 'Intel', icon: <Radio className="w-4 h-4" /> },
    { id: 'dossier', label: 'AI Debate', shortLabel: 'Debate', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'history', label: locale === 'hi' ? 'इतिहास' : 'History', shortLabel: 'History', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'coach', label: 'AI Coach', shortLabel: 'Coach', icon: <MessageCircle className="w-4 h-4" /> },
  ];

  // Shared props object passed to all tab components
  const sharedProps: DashboardSharedProps = {
    report, scanId, userId: user?.id, accessToken, country: scanCountry,
    displayScoreValue, clampedRisk, scoreColorClass, seniorityTier, isExec,
    userName, userCompany: userCompany ?? undefined, displayRole, profileContext, isLinkedIn, isResume, source,
    toneTag, toneColors, executionSkillsDead, moatSkills, tools, allSkills, pivotRoleNames, deadEndNarrative,
    normalizedMarketPosition, normalizedCareerShock, immediateNextStep,
    ci, kgMatched, kgLastRefresh, enrichment, judoIntel,
    setActiveScreen, setShowRateLimitUpsell, setRateLimitMinutes,
    locale, strings,
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-20" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm safe-area-top"
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-[10px] sm:text-xs"
              style={{ background: 'var(--gradient-primary)' }}>
              {userName !== 'Professional' ? userName.charAt(0).toUpperCase() : 'JB'}
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-foreground leading-none">
                {userName !== 'Professional' ? `${userName}'s Briefing` : 'JOB BACHAO'}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold leading-none mt-0.5">
                {displayRole} · {report.industry}
              </span>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 ml-3 text-xs font-semibold text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              v3.2 ENGINE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ChallengeColleague scanId={scanId} score={displayScoreValue} role={displayRole} />
            <LocaleToggle locale={locale} onToggle={toggleLocale} />
            <button onClick={onReset} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center" aria-label="Start new scan">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Scan</span>
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('Sign out? Your current scan data will be lost.')) return;
                await supabase.auth.signOut();
                onReset();
              }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 min-h-[44px] px-2 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Screen Tabs */}
        <nav className="max-w-4xl mx-auto px-0 sm:px-4 pb-0" role="tablist" aria-label="Dashboard sections">
          <div className="flex overflow-x-auto scrollbar-hide border-b-0 -mx-0">
            {screens.map((screen) => (
              <button
                key={screen.id}
                role="tab"
                aria-selected={activeScreen === screen.id}
                aria-controls={`panel-${screen.id}`}
                onClick={() => {
                  setActiveScreen(screen.id);
                  setShowRecommendedBadge(false);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all relative whitespace-nowrap min-h-[44px] flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                  ${activeScreen === screen.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {screen.icon}
                <span className="hidden sm:inline">{screen.label}</span>
                <span className="sm:hidden">{screen.shortLabel}</span>
                {activeScreen === screen.id && showRecommendedBadge && (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    For you
                  </span>
                )}
                {activeScreen === screen.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--gradient-primary)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </nav>
      </motion.header>

      <main id="main-content" className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10" role="tabpanel" aria-label={`${activeScreen} panel`}>
        {/* isProUser: false by default, true if report.user_is_pro or referral pro grant active */}
        {(() => {
          return (
            <>
              {activeScreen === 'diagnosis' && <DiagnosisTab props={sharedProps} />}
              {activeScreen === 'defense' && <DefenseTab props={sharedProps} />}
              {activeScreen === 'intel' && (
                isProUser ? <IntelTab props={sharedProps} /> : <ProGateCard featureName="Market Intel" featureDescription="Real-time hiring trends, salary signals, and AI adoption rates for your specific role and city." icon={Radio} />
              )}
              {activeScreen === 'dossier' && (
                isProUser ? <DossierTab props={sharedProps} /> : <ProGateCard featureName="AI Debate" featureDescription="Deep strategic analysis of your career path powered by advanced AI models. Get comprehensive insights tailored to your role." icon={Sparkles} />
              )}
              {activeScreen === 'history' && user && (
                <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading score history...</div>}>
                  <ScoreHistoryTab userId={user.id} locale={locale} />
                </Suspense>
              )}
              {activeScreen === 'coach' && (
                isProUser ? (
                  <div className="py-2 space-y-6">
                    <CoachNudgeWidget />
                    <ReportChat scanId={scanId} accessToken={accessToken} inline />
                  </div>
                ) : (
                  <ProGateCard featureName="AI Career Coach" featureDescription="Get personalized career guidance powered by AI. Ask unlimited questions about your career strategy, role transitions, and skill development." icon={MessageCircle} />
                )
              )}

              {/* Sticky Floating Share FAB */}
              <FateCardShare report={report} scanId={scanId} sticky />
            </>
          );
        })()}
      </main>

      {/* Rate Limit Upsell Overlay */}
      <AnimatePresence>
        {showRateLimitUpsell && (
          <RateLimitUpsell
            minutesRemaining={rateLimitMinutes}
            onDismiss={() => setShowRateLimitUpsell(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
