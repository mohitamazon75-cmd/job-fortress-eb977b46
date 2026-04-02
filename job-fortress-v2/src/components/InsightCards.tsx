import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Shield, Rocket, FileText, Briefcase, DollarSign, Brain, Search, Clock, Network, Shuffle, Target, Calendar, Users, Swords, Skull, Flame, Trophy, TrendingUp, type LucideIcon } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import KGPeerCard from '@/components/cards/KGPeerCard';
import DefensePlanCard from '@/components/cards/DefensePlanCard';
import ConversionGateCard from '@/components/cards/ConversionGateCard';
import { InsightProgressDots } from '@/components/InsightProgressDots';
// ShareExportCard removed — share moment moved to MoneyShotCard (Sprint 1)
import SkillRepositioningCard from '@/components/cards/SkillRepositioningCard';
import CareerPivotCard from '@/components/cards/CareerPivotCard';
import BestFitJobsCard from '@/components/cards/BestFitJobsCard';
import ResumeWeaponizerCard from '@/components/cards/ResumeWeaponizerCard';
import SkillUpgradePlanCard from '@/components/cards/SkillUpgradePlanCard';
import DeepAnalysisGateCard from '@/components/cards/DeepAnalysisGateCard';
import CoachOptInCard from '@/components/cards/CoachOptInCard';
import AITimelineCard from '@/components/cards/AITimelineCard';
import PeerComparisonPreviewCard from '@/components/cards/PeerComparisonPreviewCard';
import CareerObituaryCard, { type ObituaryData } from '@/components/cards/CareerObituaryCard';
import SalaryNegotiationCard from '@/components/cards/SalaryNegotiationCard';
import NoticePeriodCard from '@/components/cards/NoticePeriodCard';
import LinkedInRoastCard from '@/components/cards/LinkedInRoastCard';
import ShareableScoreCard from '@/components/cards/ShareableScoreCard';
import ScoreTrendCard from '@/components/cards/ScoreTrendCard';
import DoomClockCard from '@/components/cards/DoomClockCard';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProUpgradeModal from '@/components/ProUpgradeModal';
// DiagnosticLaunchCard removed — replaced with DefensePlanCard to keep users in-flow

const CareerGenomeDebate = React.lazy(() => import('@/components/dashboard/CareerGenomeDebate'));

interface InsightCardsProps {
  report: ScanReport;
  onComplete: () => void;
  scanId?: string;
  biggest_concern?: 'ai_replacement' | 'skill_gaps' | 'salary_stagnation' | 'job_market';
  isProUser?: boolean;
}

export default function InsightCards({ report, onComplete, scanId, biggest_concern, isProUser = false }: InsightCardsProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [deepMode, setDeepMode] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proModalDefaultTier, setProModalDefaultTier] = useState<'month' | 'year'>('year');
  const tier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(tier);

  // Prefetch obituary ONLY for Pro users — it's a DEEP card (costs an LLM call).
  // Free users never reach it, so prefetching for them burns API budget with zero return.
  const [obituaryData, setObituaryData] = useState<ObituaryData | null>(null);
  const [obituaryLoading, setObituaryLoading] = useState(true);

  useEffect(() => {
    // Cost gate: skip the LLM call entirely for free users
    if (!isProUser) { setObituaryLoading(false); return; }

    let cancelled = false;
    const roleLabel = report.role || 'Professional';
    const industryLabel = report.industry || '';
    const locationLabel = report.geo_advantage || 'India';
    const expLabel = (report as ScanReport & { years_experience?: string }).years_experience || (isExec ? '10+ years' : '');
    const allSkills = (report.all_skills && report.all_skills.length > 0)
      ? report.all_skills.slice(0, 10)
      : [...(report.execution_skills_dead || []), ...(report.moat_skills || [])].slice(0, 8);
    const topRiskSkills = [...(report.score_breakdown?.skill_adjustments || [])]
      .sort((a, b) => b.automation_risk - a.automation_risk)
      .slice(0, 3)
      .map(s => s.skill_name);
    const topTools = normalizeTools(report.ai_tools_replacing || []).slice(0, 3).map(t => t.tool_name);

    const fetchObituary = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke('career-obituary', {
          body: {
            role: roleLabel,
            industry: industryLabel,
            city: locationLabel,
            skills: allSkills.slice(0, 8),
            experience: expLabel || undefined,
            topRiskSkills,
            topTools,
          },
        });
        if (!cancelled && !fnError) setObituaryData(result as ObituaryData);
        else if (!cancelled && fnError) console.error('[Prefetch] Obituary error:', fnError);
      } catch (e) {
        console.error('[Prefetch] Obituary error:', e);
      } finally {
        if (!cancelled) setObituaryLoading(false);
      }
    };

    fetchObituary();
    return () => { cancelled = true; };
  }, [report, isExec, isProUser]);

  // Keyboard navigation handler (stable ref — only recreated when nav state changes)
  const paginate = useCallback((direction: number) => {
    if (direction > 0) handleNext();
    else if (direction < 0) handleBack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, deepMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') paginate(1);
      if (e.key === 'ArrowLeft') paginate(-1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // paginate references handleNext/handleBack which close over cardIndex, deepMode etc.
     
  }, [paginate]);

  // ── FREE vs PRO ARCS ──
  //
  // COST RATIONALE (India market):
  //   Free arc = ZERO extra API calls after the initial scan.
  //   Every extra LLM/API call on a non-converting free user = direct loss.
  //   best-fit-jobs → Perplexity/Tavily call (~$0.03/user) — Pro only.
  //   coach opt-in  → 3 LLM email nudges (~$0.06/user) — Pro only.
  //   career-obituary prefetch → LLM call — Pro only (gated above).
  //
  // FREE ARC (3 cards — all computed from scan data, zero extra cost):
  //  1. doom-clock      — fear hook (computed)
  //  2. score-card      — viral share (computed)
  //  3. conversion-gate — emotional paywall (static)
  //
  // PRO ARC (9 cards — full experience, costs justified by ₹1,999/year revenue):
  //  1. doom-clock
  //  2. best-fit         ← external API call, Pro only
  //  3. defense
  //  4. score-card
  //  5. resume           ← LLM call, Pro only
  //  6. salary-negotiation
  //  7. coach            ← LLM email nudges, Pro only
  //  8. skill-upgrade    ← LLM call, Pro only
  //  9. deep-gate → unlocks 10 DEEP cards
  //
  // biggest_concern reordering: applies ONLY to PRO_CORE_CARDS.
  // Free users always see the same 3 cards in fixed order.

  const FREE_CORE_CARDS: Array<{ id: string; title: string; subtitle: string; Icon: LucideIcon; iconColor: string }> = [
    // 1. VIRAL HOOK — doom clock (fear + specificity). Computed, no API cost.
    { id: 'doom-clock', title: 'Your Skill Doom Clock', subtitle: 'Which of your skills AI will replace first — and when', Icon: Clock, iconColor: 'text-destructive' },
    // 2. SHARE — score card. Computed + shareable = viral loop, no API cost.
    { id: 'score-card', title: 'Your Career Score Card', subtitle: 'Generate & share your AI-readiness score with your network', Icon: Trophy, iconColor: 'text-prophet-gold' },
    // 3. GATE — blurred preview of Pro features. Static, no API cost.
    { id: 'conversion-gate', title: 'Unlock Your Career Defense Package', subtitle: 'Your personalized plan is ready — see what Pro unlocks', Icon: Shield, iconColor: 'text-primary' },
  ];

  const PRO_CORE_CARDS: Array<{ id: string; title: string; subtitle: string; Icon: LucideIcon; iconColor: string }> = [
    // 1. VIRAL HOOK — doom clock (fear + specificity = immediate share trigger)
    { id: 'doom-clock', title: 'Your Skill Doom Clock', subtitle: 'Which of your skills AI will replace first — and when', Icon: Clock, iconColor: 'text-destructive' },
    // 2. HOPE — real jobs you can apply to right now
    { id: 'best-fit', title: 'Best-Fit Jobs for You', subtitle: 'Real openings you can apply to right now', Icon: Briefcase, iconColor: 'text-primary' },
    // 3. AGENCY — the antidote to the fear in card 1
    { id: 'defense', title: 'Your 90-Day Defense Plan', subtitle: 'Immediate actions · unconventional pivots · career upgrade path', Icon: Shield, iconColor: 'text-prophet-green' },
    // 4. SHARE — score card AFTER user has absorbed value (share-when-primed, not share-when-cold)
    { id: 'score-card', title: 'Your Career Score Card', subtitle: 'Generate & share your AI-readiness score with your network', Icon: Trophy, iconColor: 'text-prophet-gold' },
    // 5. TOOL — tangible resume improvement
    { id: 'resume', title: 'ATS Resume Rewrite', subtitle: 'AI rewrites your resume to pass ATS filters & highlight human moats', Icon: FileText, iconColor: 'text-prophet-cyan' },
    // 6. WIN — financial leverage moment
    { id: 'salary-negotiation', title: 'Salary Negotiation Leverage', subtitle: 'Market gap · leverage signals · copy-paste scripts', Icon: DollarSign, iconColor: 'text-prophet-green' },
    // 7. CONVERT — free ongoing support BEFORE the Pro paywall (free before paid)
    { id: 'coach', title: 'AI Career Coach', subtitle: 'Free · 3 personalized nudges over 48 hours', Icon: Brain, iconColor: 'text-primary' },
    // 8. TOOL — skill development path (Pro-gated; after Coach so free value precedes paywall)
    { id: 'skill-upgrade', title: 'My Skill Upgrade Plan', subtitle: 'Tools to learn · concepts to master · weekend deep-dives', Icon: Rocket, iconColor: 'text-primary' },
    // 9. GATE — transparency + unlock deep insights
    { id: 'deep-gate', title: 'What We Ran On Your Profile', subtitle: "The data behind your score · what we tested · where we're confident", Icon: Search, iconColor: 'text-muted-foreground' },
  ];

  // ── Reorder PRO_CORE_CARDS based on the user's stated biggest concern ──
  // This makes the modal's "surfaces the most relevant insights first" promise true.
  // FREE_CORE_CARDS are NOT reordered — free users always see the same 5 cards in order.
  //
  // PINNED: doom-clock is ALWAYS index 0 regardless of biggest_concern.
  // It is the fear-hook that contextualises everything that follows; moving it
  // breaks the Fear → Hope → Agency arc and kills the viral share moment.
  // The concern-priority card bubbles to index 1 instead.
  const ORDERED_CORE_CARDS = (() => {
    const baseCards = isProUser ? PRO_CORE_CARDS : FREE_CORE_CARDS;
    if (!isProUser || !biggest_concern) return baseCards;

    const priorityMap: Record<string, string> = {
      // salary_stagnation → show score-card first so the user can benchmark their leverage
      // before jumping straight to negotiation tactics (which need context)
      salary_stagnation: 'score-card',
      skill_gaps: 'skill-upgrade',
      job_market: 'best-fit',
      ai_replacement: 'defense',
    };
    const priorityId = priorityMap[biggest_concern];
    if (!priorityId) return baseCards;

    // doom-clock is pinned at 0 — find the priority card in positions 1+
    const [pinnedFirst, ...rest] = baseCards;
    const idx = rest.findIndex(c => c.id === priorityId);
    if (idx <= 0) return baseCards; // already at pos 1 or not found
    const reordered = [...rest];
    const [priorityCard] = reordered.splice(idx, 1);
    reordered.unshift(priorityCard);
    return [pinnedFirst, ...reordered];
  })();

  // ── DEEP INSIGHTS: Context → Strategy → Entertainment ──
  // Credibility: Career Obituary ("your role's death notice") is darkly appropriate for
  // high-risk users but deeply confusing for SAFE ZONE users (score ≥ 70) who just saw
  // "Your job is in a solid spot." Only show it to users who scored below the safe threshold.
  // Default 71 (just above safe zone threshold): when survivability data is missing entirely,
  // err toward NOT showing the death notice. Showing it to a user whose risk we cannot
  // determine is worse than hiding it from a true high-risk user.
  const careerScoreForGate = report.survivability?.score ?? 71;
  const isSafeZone = careerScoreForGate >= 70;

  const DEEP_CARDS: Array<{ id: string; title: string; subtitle: string; Icon: LucideIcon; iconColor: string }> = [
    // 1. Score history — orient user with how they've trended over time
    { id: 'score-trend', title: 'Score Trend', subtitle: 'How your career score has moved across scans', Icon: TrendingUp, iconColor: 'text-prophet-green' },
    // 2. Context — skill-by-skill automation timeline (urgency map)
    { id: 'timeline', title: 'Your AI Timeline', subtitle: 'When each skill faces automation pressure', Icon: Clock, iconColor: 'text-prophet-gold' },
    // 3. Social proof — how you compare to peers (builds credibility before strategy)
    { id: 'peer-preview', title: 'Peer Comparison', subtitle: 'How you compare to professionals in your role', Icon: Users, iconColor: 'text-prophet-cyan' },
    // 4. Strategy — adjacent career pivots (immediate actionable moves)
    { id: 'pivot', title: 'Safer Career Pivots', subtitle: '3 adjacent moves + 1 bold stretch · skill gaps · timelines', Icon: Shuffle, iconColor: 'text-primary' },
    // 5. Strategy — individual skill repositioning (KG-grounded before→after)
    { id: 'repositioning', title: isExec ? 'Strategic Repositioning' : 'Skill Repositioning', subtitle: 'KG-grounded before→after for every skill', Icon: Target, iconColor: 'text-primary' },
    // 6. Engagement — debate makes the stakes visceral before practical logistics
    { id: 'debate', title: 'AI Debate: Your Future', subtitle: '3 AI agents argue your career fate using live market evidence', Icon: Swords, iconColor: 'text-destructive' },
    // 7. Practical — notice period logistics (post-debate action planning)
    { id: 'notice-period', title: 'Notice Period Optimizer', subtitle: 'Buyout calculator · email templates · pro tips', Icon: Calendar, iconColor: 'text-muted-foreground' },
    // 8. Engagement closer — LinkedIn roast (only if source is linkedin)
    ...(report.source === 'linkedin' ? [{ id: 'linkedin-roast', title: 'LinkedIn Profile Roast', subtitle: 'Your profile audited · roasted · fixed — shareable!', Icon: Flame, iconColor: 'text-destructive' }] : []),
    // 9. Gate obituary behind score threshold — "death notice" contradicts SAFE ZONE messaging
    ...(!isSafeZone ? [{ id: 'obituary', title: 'Career Obituary', subtitle: "Your role's darkly funny newspaper death notice", Icon: Skull, iconColor: 'text-muted-foreground' }] : []),
    // 10. Technical appendix — Knowledge Graph peer map (last; dense/technical, rewards curious users)
    { id: 'kg-peer', title: 'Your Intelligence Map', subtitle: `${report.computation_method?.kg_skills_matched ?? 'N'} skills mapped in our Knowledge Graph`, Icon: Network, iconColor: 'text-prophet-cyan' },
  ];

  const CARDS = deepMode ? [...ORDERED_CORE_CARDS, ...DEEP_CARDS] : ORDERED_CORE_CARDS;

  const card = CARDS[cardIndex];
  if (!card) return null; // Bounds check: cardIndex is out of range
  const isLast = cardIndex === CARDS.length - 1;
  const isGateCard = card.id === 'deep-gate' && !deepMode;
  const handleNext = () => {
    setDragDir(1);
    if (isGateCard) { onComplete(); return; }
    if (isLast) { onComplete(); } else { setCardIndex(i => i + 1); }
  };
  const handleBack = () => { setDragDir(-1); setCardIndex(i => Math.max(0, i - 1)); };
  const handleGoDeeper = () => {
    setDragDir(1);
    setDeepMode(true);
    setCardIndex(i => i + 1);
  };

  const [dragDir, setDragDir] = useState(0);

  const swipeConfidenceThreshold = 50;
  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = Math.abs(info.velocity.x) * info.offset.x;
    if (swipe < -swipeConfidenceThreshold * 1000 && !isLast && !isGateCard) {
      handleNext();
    } else if (swipe > swipeConfidenceThreshold * 1000 && cardIndex > 0) {
      handleBack();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[190] bg-background overflow-y-auto"
      role="region"
      aria-label="Career insight cards navigation">

      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {cardIndex + 1} / {CARDS.length}
          </p>
          <button type="button" onClick={onComplete}
            className="text-xs font-bold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors uppercase tracking-wider min-h-[44px] min-w-[44px] flex items-center justify-center">
            Skip →
          </button>
        </div>

        {/* Segmented progress dots */}
        <InsightProgressDots
          total={CARDS.length}
          current={cardIndex}
          onDotClick={(i) => setCardIndex(i)}
        />

        {/* Card content — drag to swipe */}
        <div className="flex-1 px-4 sm:px-5 md:px-8 pb-28 sm:pb-32 max-w-lg mx-auto w-full"
          role="main"
          aria-live="polite"
          aria-label={`Card ${cardIndex + 1}: ${card.title}`}>
          <AnimatePresence mode="wait" custom={dragDir}>
            <motion.div
              key={card.id}
              custom={dragDir}
              initial={{ opacity: 0, x: dragDir >= 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dragDir >= 0 ? -60 : 60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              style={{ touchAction: 'pan-y' }}
            >
              <div className="mb-4 sm:mb-6 pt-2">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-muted flex-shrink-0`}>
                    <card.Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground leading-tight">{card.title}</h2>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{card.subtitle}</p>
              </div>

              {card.id === 'defense' && (
                <ErrorBoundary>
                  <DefensePlanCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'skill-upgrade' && (
                <ErrorBoundary>
                  <SkillUpgradePlanCard report={report} scanId={scanId} />
                </ErrorBoundary>
              )}
              {card.id === 'deep-gate' && (
                <ErrorBoundary>
                  <DeepAnalysisGateCard report={report} onGoDeeper={handleGoDeeper} />
                </ErrorBoundary>
              )}
              {card.id === 'salary-negotiation' && (
                <ErrorBoundary>
                  <SalaryNegotiationCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'notice-period' && (
                <ErrorBoundary>
                  <NoticePeriodCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'kg-peer' && (
                <ErrorBoundary>
                  <KGPeerCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'timeline' && (
                <ErrorBoundary>
                  <AITimelineCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'best-fit' && (
                <ErrorBoundary>
                  <BestFitJobsCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'resume' && (
                <ErrorBoundary>
                  <ResumeWeaponizerCard report={report} scanId={scanId} />
                </ErrorBoundary>
              )}
              {card.id === 'debate' && (
                <ErrorBoundary>
                  <React.Suspense fallback={<div className="animate-pulse h-40 rounded-xl bg-muted" />}>
                    <div className="space-y-4">
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-4 text-center">
                        <p className="text-sm font-bold text-foreground">
                          We've mapped your skills, threats & defenses. Now let's <span className="text-primary">debate your future</span> —
                          a Prosecutor, Defender & Judge argue your career fate using live market evidence.
                        </p>
                      </motion.div>
                      <CareerGenomeDebate report={report} scanId={scanId || ''} />
                    </div>
                  </React.Suspense>
                </ErrorBoundary>
              )}
              {card.id === 'repositioning' && (
                <ErrorBoundary>
                  <SkillRepositioningCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'pivot' && (
                <ErrorBoundary>
                  <CareerPivotCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'peer-preview' && (
                <ErrorBoundary>
                  <PeerComparisonPreviewCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'obituary' && (
                <ErrorBoundary>
                  <CareerObituaryCard report={report} prefetchedData={obituaryData} prefetchedLoading={obituaryLoading} />
                </ErrorBoundary>
              )}
              {card.id === 'coach' && (
                <ErrorBoundary>
                  <CoachOptInCard report={report} scanId={scanId} />
                </ErrorBoundary>
              )}
              {card.id === 'linkedin-roast' && (
                <ErrorBoundary>
                  <LinkedInRoastCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'doom-clock' && (
                <ErrorBoundary>
                  <DoomClockCard report={report} scanId={scanId} />
                </ErrorBoundary>
              )}
              {card.id === 'score-card' && (
                <ErrorBoundary>
                  <ShareableScoreCard report={report} />
                </ErrorBoundary>
              )}
              {card.id === 'score-trend' && (
                <ErrorBoundary>
                  <ScoreTrendCard report={report} scanId={scanId} />
                </ErrorBoundary>
              )}
              {card.id === 'conversion-gate' && (
                <ErrorBoundary>
                  <ConversionGateCard
                    report={report}
                    onUpgrade={(tier) => { setProModalDefaultTier(tier ?? 'year'); setShowProModal(true); }}
                  />
                </ErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 inset-x-0 z-10 bg-gradient-to-t from-background via-background to-transparent pt-6 sm:pt-10 pb-6 sm:pb-8 px-4 sm:px-6 safe-area-bottom">
          <div className="max-w-lg mx-auto flex gap-3">
            {cardIndex > 0 && (
              <motion.button type="button" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.97 }} onClick={handleBack}
                className="flex items-center justify-center gap-1 px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border-2 border-border bg-card text-foreground font-bold text-sm sm:text-base tracking-wide hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all min-h-[48px]">
                <ChevronLeft className="w-5 h-5" /> Back
              </motion.button>
            )}
            {!isGateCard && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-primary-foreground font-black text-sm sm:text-base tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all min-h-[48px]"
                style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
              >
                {isLast ? (
                  <>Finish <ArrowRight className="w-5 h-5" /></>
                ) : (
                  <>Next <ChevronRight className="w-5 h-5" /></>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        onSuccess={() => setShowProModal(false)}
        defaultTier={proModalDefaultTier}
      />
    </motion.div>
  );
}
