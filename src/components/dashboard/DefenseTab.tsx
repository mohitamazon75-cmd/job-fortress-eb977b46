import { useState, lazy, Suspense } from 'react';
import MicroFeedback from '@/components/dashboard/MicroFeedback';
import HinglishTooltip from '@/components/dashboard/HinglishTooltip';
import MilestoneChecklist from '@/components/dashboard/MilestoneChecklist';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import FooterSection from '@/components/dashboard/FooterSection';
import type { DashboardSharedProps } from '@/components/dashboard/DashboardTypes';

const ImmediateNextStepWidget = lazy(() => import('@/components/dashboard/ImmediateNextStepWidget'));
const JudoStrategyWidget = lazy(() => import('@/components/dashboard/JudoStrategyWidget'));
const WeeklySurvivalDietWidget = lazy(() => import('@/components/dashboard/WeeklySurvivalDietWidget'));
const WhatIfSimulator = lazy(() => import('@/components/dashboard/WhatIfSimulator'));
const WeeklyActionPlan = lazy(() => import('@/components/dashboard/WeeklyActionPlan'));
const PivotOptimizerWidget = lazy(() => import('@/components/dashboard/PivotOptimizerWidget'));
const SkillGapMap = lazy(() => import('@/components/dashboard/SkillGapMap'));
const GeoArbitrageWidget = lazy(() => import('@/components/dashboard/GeoArbitrageWidget'));
const ObsolescenceTimelineWidget = lazy(() => import('@/components/dashboard/ObsolescenceTimelineWidget'));
const SkillArbitrageWidget = lazy(() => import('@/components/dashboard/SkillArbitrageWidget'));
const ResumeWeaponizerWidget = lazy(() => import('@/components/dashboard/ResumeWeaponizerWidget'));

export default function DefenseTab({ props }: { props: DashboardSharedProps }) {
  const {
    report, scanId, userId, country,
    displayRole, executionSkillsDead, moatSkills,
    enrichment, judoIntel, immediateNextStep,
    kgLastRefresh, kgMatched, isExec, userName,
    locale, strings,
  } = props;

  const [deepDiveOpen, setDeepDiveOpen] = useState(false);

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 py-8">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div>}>
      <motion.div
        key="defense"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              {isExec ? 'Your Strategic Playbook' : (locale === 'hi' ? strings.defense_title : 'Your Defense Plan')}
            </h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              {userName !== 'Professional' ? `${userName}, personalized` : 'Personalized'} for {displayRole} in {report.industry}
              <HinglishTooltip en={strings.tooltip_weekly_plan} hi={locale === 'hi' ? strings.tooltip_weekly_plan : undefined} locale={locale} />
            </p>
          </div>
        </div>

        {/* Milestone Checklist */}
        {userId && scanId && (
          <MilestoneChecklist userId={userId} scanId={scanId} />
        )}

        {/* Immediate Next Step */}
        {immediateNextStep && (
          <ImmediateNextStepWidget step={immediateNextStep} />
        )}

        {/* Judo Strategy */}
        {report.judo_strategy && (
          <JudoStrategyWidget
            strategy={report.judo_strategy}
            githubStars={judoIntel.githubStars}
            weeklyIntel={judoIntel.weeklyIntel}
            intelLoading={judoIntel.loading}
          />
        )}

        {/* Weekly Survival Diet */}
        {report.weekly_survival_diet && (
          <WeeklySurvivalDietWidget diet={report.weekly_survival_diet} />
        )}

        {/* What If Simulator */}
        <WhatIfSimulator scanId={scanId} />

        {/* Weekly Action Plan (quick-win, surfaces first so users see actionable tasks before async tools) */}
        {report.weekly_action_plan && report.weekly_action_plan.length > 0 && (
          <WeeklyActionPlan actions={report.weekly_action_plan} role={report.role} industry={report.industry} enrichment={enrichment.data} enrichmentLoading={enrichment.loading} />
        )}

        {/* Career Pivots */}
        <PivotOptimizerWidget report={report} enrichment={enrichment.data} enrichmentLoading={enrichment.loading} />

        {/* Skill Arbitrage Engine */}
        <SkillArbitrageWidget report={report} scanId={scanId} />

        {/* Resume Weaponizer — heavy async LLM tool, intentionally placed after quick-win sections per user feedback (long latency at top of screen creates "broken" perception) */}
        <ResumeWeaponizerWidget report={report} scanId={scanId} />

        {/* Collapsed Deep Dive */}
        <button
          onClick={() => setDeepDiveOpen(!deepDiveOpen)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors mb-4"
        >
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">
              {deepDiveOpen ? 'Hide' : 'Show'} Detailed Analysis — Skill Gaps, Protection Breakdown & Location Advantage
            </span>
          </div>
          {deepDiveOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {deepDiveOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-6 space-y-5"
            >
              {/* Skill Gap Map */}
              {report.skill_gap_map && report.skill_gap_map.length > 0 && (
                <SkillGapMap skillGaps={report.skill_gap_map} />
              )}

              {/* Protection Score Breakdown */}
              {report.survivability && (
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Protection Score Breakdown</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(report.survivability.breakdown).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <p className="text-lg font-black text-prophet-green">+{value}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                  {report.survivability.primary_vulnerability && (
                    <p className="text-xs text-prophet-gold mt-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Primary vulnerability: <span className="font-bold">{report.survivability.primary_vulnerability}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Geo Arbitrage */}
              {report.geo_arbitrage && (
                <GeoArbitrageWidget geoArbitrage={report.geo_arbitrage} tier2={report.tier2_alternative} pivotRole={report.arbitrage_role} country={country} />
              )}

              {/* Obsolescence Timeline */}
              {report.obsolescence_timeline && (
                <ObsolescenceTimelineWidget timeline={report.obsolescence_timeline} monthsRemaining={report.months_remaining} mlEnhanced={report.ml_enhanced} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Micro feedback */}
        <div className="mt-4 flex justify-end">
          <MicroFeedback scanId={scanId} cardId="defense_tab" label="Was this defense plan useful?" />
        </div>

        {/* Footer */}
        <FooterSection 
          enrichment={enrichment} 
          kgLastRefresh={kgLastRefresh} 
          kgMatched={kgMatched} 
          scanId={scanId}
          report={report}
        />
      </motion.div>
    </Suspense>
  );
}
