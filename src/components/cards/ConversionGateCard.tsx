import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, DollarSign, Rocket, Users, Brain, ChevronRight, Sparkles, Target } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { classifySkills } from '@/lib/unified-skill-classifier';

interface ConversionGateCardProps {
  report: ScanReport;
  onUpgrade: (defaultTier?: 'year' | 'month') => void;
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

  const salaryBleedMonthly = report.salary_bleed_monthly ?? 0;
  const annualBleedLakh = salaryBleedMonthly > 0
    ? `₹${(salaryBleedMonthly * 12 / 100000).toFixed(1)}L/yr at risk`
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
      description: `${annualBleedLakh}. Copy-paste scripts calibrated for your next review or offer negotiation.`,
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
// Feature Tile Component
// ─────────────────────────────────────────────────────────────────────────────

function FeatureTileComponent({ tile, index }: { tile: FeatureTile; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/20 transition-colors"
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
      <div className="flex items-center gap-1 text-[11px] font-semibold text-primary pt-1">
        <span>Explore in detail</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ConversionGateCard({ report, onUpgrade }: ConversionGateCardProps) {
  const score = computeStabilityScore(report);
  const { headline, subtext } = getHeadline(score);
  const tiles = buildFeatureTiles(report);

  return (
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
          <FeatureTileComponent key={tile.id} tile={tile} index={index} />
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
          <span className="font-bold text-foreground">Navigate through each card</span> using the Next button below.
          Every tool is personalized to your {report.role || 'role'} profile and current market data.
        </p>
      </motion.div>
    </motion.div>
  );
}
