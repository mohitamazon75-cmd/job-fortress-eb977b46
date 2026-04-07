import React, { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, DollarSign, Rocket, Users, Brain, ChevronRight, Sparkles, Target, X } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { classifySkills } from '@/lib/unified-skill-classifier';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load the heavy card components — only loaded when drawer opens
const DefensePlanCard = lazy(() => import('@/components/cards/DefensePlanCard'));
const ResumeWeaponizerCard = lazy(() => import('@/components/cards/ResumeWeaponizerCard'));
const SalaryNegotiationCard = lazy(() => import('@/components/cards/SalaryNegotiationCard'));
const SkillUpgradePlanCard = lazy(() => import('@/components/cards/SkillUpgradePlanCard'));
const PeerComparisonPreviewCard = lazy(() => import('@/components/cards/PeerComparisonPreviewCard'));
const CoachOptInCard = lazy(() => import('@/components/cards/CoachOptInCard'));

interface ConversionGateCardProps {
  report: ScanReport;
  onUpgrade: (defaultTier?: 'year' | 'month') => void;
  scanId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature tile data — personalized from scan report
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureTile {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: string;
  accentClass: string;
}

function buildFeatureTiles(report: ScanReport): FeatureTile[] {
  const role = report.role || 'your role';
  const industry = report.industry || 'your industry';

  const allSkills = classifySkills(report);
  const atRisk = allSkills
    .filter(s => s.status !== 'safe')
    .sort((a, b) => a.estimatedMonths - b.estimatedMonths);
  const topAtRiskSkill = atRisk[0]?.name || 'your top skill';
  const topReplacement = atRisk[0]?.replacedBy || 'AI tooling';

  const moatSkills = report.moat_skills || [];
  const topMoat = moatSkills[0] || 'strategic skills';

  const salaryDropPct = report.career_shock_simulator?.salary_drop_percentage
    ?? (report.score_breakdown?.salary_bleed_breakdown?.final_rate
      ? Math.round(report.score_breakdown.salary_bleed_breakdown.final_rate * 100)
      : null);
  const annualBleedLabel = salaryDropPct && salaryDropPct > 0
    ? `~${salaryDropPct}% annual earning pressure`
    : `Market-calibrated for ${role}`;

  const pivotRole = report.pivot_roles?.[0]?.role
    ?? report.pivot_roles?.[0]?.title
    ?? report.arbitrage_role
    ?? null;

  return [
    {
      id: 'defense-plan',
      icon: <Shield className="w-5 h-5" />,
      title: '90-Day Defense Plan',
      description: `Week-by-week action plan to mitigate ${topAtRiskSkill} risk and strengthen your ${topMoat} advantage.`,
      highlight: 'Personalized to your exact role',
      accentClass: 'bg-primary/10 text-primary border-primary/20',
    },
    {
      id: 'ats-resume',
      icon: <FileText className="w-5 h-5" />,
      title: 'ATS Resume Rewrite',
      description: `Optimized for ${role} in ${industry} — highlights your human-edge skills to pass ATS filters.`,
      highlight: 'AI-proof positioning',
      accentClass: 'bg-prophet-cyan/10 text-prophet-cyan border-prophet-cyan/20',
    },
    {
      id: 'salary-scripts',
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Salary Negotiation Scripts',
      description: `${annualBleedLabel}. Copy-paste scripts calibrated for your next review or offer negotiation.`,
      highlight: 'Ready-to-use scripts',
      accentClass: 'bg-prophet-green/10 text-prophet-green border-prophet-green/20',
    },
    {
      id: 'skill-roadmap',
      icon: <Rocket className="w-5 h-5" />,
      title: 'Skill Upgrade Roadmap',
      description: `${topAtRiskSkill} → ${topReplacement}. A 12-week plan with free resources — no bootcamp needed.`,
      highlight: 'Highest ROI skills first',
      accentClass: 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/20',
    },
    {
      id: 'peer-comparison',
      icon: <Users className="w-5 h-5" />,
      title: 'Peer Benchmarking',
      description: pivotRole
        ? `See how you rank vs peers. ${pivotRole} is the most common pivot for your cohort.`
        : `See exactly where you stand among ${role} professionals in your market.`,
      highlight: 'Real market data',
      accentClass: 'bg-accent text-accent-foreground border-border',
    },
    {
      id: 'ai-coach',
      icon: <Brain className="w-5 h-5" />,
      title: 'AI Career Coach',
      description: `Ask anything about your ${role} career — get specific, actionable answers based on your full profile analysis.`,
      highlight: 'Unlimited conversations',
      accentClass: 'bg-primary/10 text-primary border-primary/20',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Score-based Headlines
// ─────────────────────────────────────────────────────────────────────────────

function getHeadline(score: number): { headline: string; subtext: string } {
  if (score < 50) {
    return {
      headline: "Your defense package is ready. Here's everything inside.",
      subtext: "We've built a complete action plan based on your scan results. Explore each tool below.",
    };
  }
  if (score < 70) {
    return {
      headline: "You're in the warning zone. Here's your full toolkit.",
      subtext: "Every tool below is calibrated to your specific role, skills, and market position.",
    };
  }
  return {
    headline: "You're ahead of most. Here's how to stay there.",
    subtext: "Your defense package helps you maintain and extend your advantage.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader for lazy card content
// ─────────────────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawer content renderer — maps tile ID to the real card component
// ─────────────────────────────────────────────────────────────────────────────

function DrawerCardContent({ tileId, report, scanId }: { tileId: string; report: ScanReport; scanId?: string }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<CardSkeleton />}>
        {tileId === 'defense-plan' && <DefensePlanCard report={report} />}
        {tileId === 'ats-resume' && <ResumeWeaponizerCard report={report} scanId={scanId} />}
        {tileId === 'salary-scripts' && <SalaryNegotiationCard report={report} />}
        {tileId === 'skill-roadmap' && <SkillUpgradePlanCard report={report} scanId={scanId} />}
        {tileId === 'peer-comparison' && <PeerComparisonPreviewCard report={report} />}
        {tileId === 'ai-coach' && <CoachOptInCard report={report} scanId={scanId} />}
      </Suspense>
    </ErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Tile Component (now clickable)
// ─────────────────────────────────────────────────────────────────────────────

function FeatureTileComponent({ tile, index, onOpen }: { tile: FeatureTile; index: number; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      onClick={onOpen}
      className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors text-left w-full group cursor-pointer"
    >
      {/* Icon + Title */}
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 p-2 rounded-lg border ${tile.accentClass}`}>
          {tile.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground leading-snug">
            {tile.title}
          </h4>
          <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-full">
            {tile.highlight}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {tile.description}
      </p>

      {/* Navigate hint */}
      <div className="flex items-center gap-1 text-[11px] font-semibold text-primary pt-1 group-hover:gap-2 transition-all">
        <span>Explore in detail</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ConversionGateCard({ report, onUpgrade, scanId }: ConversionGateCardProps) {
  const score = computeStabilityScore(report);
  const { headline, subtext } = getHeadline(score);
  const tiles = buildFeatureTiles(report);
  const [openTileId, setOpenTileId] = useState<string | null>(null);
  const openTile = tiles.find(t => t.id === openTileId);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="space-y-6"
      >
        {/* ── Header ── */}
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Your Career Defense Package
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl sm:text-3xl font-black text-foreground leading-tight"
          >
            {headline}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            {subtext}
          </motion.p>
        </div>

        {/* ── Feature Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tiles.map((tile, index) => (
            <FeatureTileComponent
              key={tile.id}
              tile={tile}
              index={index}
              onOpen={() => setOpenTileId(tile.id)}
            />
          ))}
        </div>

        {/* ── Summary bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-4"
        >
          <Target className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            <span className="font-bold text-foreground">Tap any card above</span> to explore the full tool.
            Every tool is personalized to your {report.role || 'role'} profile and current market data.
          </p>
        </motion.div>
      </motion.div>

      {/* ── Bottom Sheet Drawer ── */}
      <Drawer open={!!openTileId} onOpenChange={(open) => { if (!open) setOpenTileId(null); }}>
        <DrawerContent className="max-h-[90vh] overflow-hidden">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-3">
              {openTile && (
                <div className={`flex-shrink-0 p-2 rounded-lg border ${openTile.accentClass}`}>
                  {openTile.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DrawerTitle className="text-lg font-black text-foreground">
                  {openTile?.title || 'Loading...'}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground mt-0.5">
                  Personalized for {report.role || 'your role'}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8 max-h-[75vh]">
            {openTileId && (
              <DrawerCardContent tileId={openTileId} report={report} scanId={scanId} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
