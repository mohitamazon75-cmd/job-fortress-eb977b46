import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, DollarSign, Rocket, Users, Brain, Star, Lock, RefreshCw, BadgeCheck } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { classifySkills } from '@/lib/unified-skill-classifier';

interface ConversionGateCardProps {
  report: ScanReport;
  onUpgrade: (defaultTier?: 'year' | 'month') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Personalised Preview Tile Data
// Uses real scan fields so the blurred content mirrors what the user just saw.
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewTile {
  id: string;
  icon: React.ReactNode;
  title: string;
  blurredLine1: string;
  blurredLine2: string;
}

function buildPersonalisedTiles(report: ScanReport): PreviewTile[] {
  const role = report.role || 'your role';
  const city = report.recommended_city || (report as any).city || 'your city';
  const industry = report.industry || 'your industry';

  // Top at-risk skill from the classifier
  const allSkills = classifySkills(report);
  const atRisk = allSkills
    .filter(s => s.status !== 'safe')
    .sort((a, b) => a.estimatedMonths - b.estimatedMonths);
  const topAtRiskSkill = atRisk[0]?.name || 'your top skill';

  // Replacement skill for top at-risk
  const topReplacement = atRisk[0]?.replacedBy || 'AI tooling';

  // Moat skills
  const moatSkills = report.moat_skills || [];
  const moatCount = moatSkills.length;
  const topMoat = moatSkills[0] || 'strategic skills';

  // Salary bleed
  const salaryBleedMonthly = report.salary_bleed_monthly ?? 0;
  const annualBleedLakh = salaryBleedMonthly > 0
    ? `₹${(salaryBleedMonthly * 12 / 100000).toFixed(1)}L/yr`
    : null;

  // Peer percentile
  const peerPct = report.market_position_model?.market_percentile
    ?? (typeof report.peer_percentile_estimate === 'number' ? report.peer_percentile_estimate : null);
  const peerLabel = peerPct != null
    ? `Top ${100 - Math.round(peerPct)}% for ${role}s in ${city}`
    : `Benchmarked against ${role}s in ${city}`;

  // Pivot role
  const pivotRole = report.pivot_roles?.[0]?.role
    ?? report.pivot_roles?.[0]?.title
    ?? report.arbitrage_role
    ?? null;

  return [
    {
      id: 'defense-plan',
      icon: <Shield className="w-5 h-5" />,
      title: '90-Day Defense Plan',
      blurredLine1: `Week 1: Mitigate ${topAtRiskSkill} risk`,
      blurredLine2: moatCount > 0
        ? `Leverage your ${moatCount} moat skill${moatCount > 1 ? 's' : ''} as shield`
        : `Build ${topMoat} into your daily workflow`,
    },
    {
      id: 'ats-resume',
      icon: <FileText className="w-5 h-5" />,
      title: 'ATS Resume Rewrite',
      blurredLine1: `Rewritten for ${role} in ${industry}`,
      blurredLine2: `Highlights ${topMoat} to beat ATS filters`,
    },
    {
      id: 'salary-scripts',
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Salary Negotiation Scripts',
      blurredLine1: annualBleedLakh
        ? `${annualBleedLakh} salary depreciation detected`
        : `Market gap analysis for ${role} in ${city}`,
      blurredLine2: 'Copy-paste scripts for your next review',
    },
    {
      id: 'skill-roadmap',
      icon: <Rocket className="w-5 h-5" />,
      title: 'Skill Upgrade Roadmap',
      blurredLine1: `${topAtRiskSkill} → ${topReplacement}`,
      blurredLine2: '12-week plan · free resources · no bootcamp needed',
    },
    {
      id: 'peer-comparison',
      icon: <Users className="w-5 h-5" />,
      title: 'Peer Comparison',
      blurredLine1: peerLabel,
      blurredLine2: pivotRole
        ? `${pivotRole} is the most common escape route for your peers`
        : `See exactly who's outrunning you — and how`,
    },
    {
      id: 'ai-coach',
      icon: <Brain className="w-5 h-5" />,
      title: 'AI Career Coach',
      blurredLine1: `Answers specific to your ${role} profile`,
      blurredLine2: `Tracks your ${atRisk.length > 0 ? atRisk.length : ''} open risk${atRisk.length !== 1 ? 's' : ''} over time`,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Score-based Headlines
// ─────────────────────────────────────────────────────────────────────────────

function getHeadline(score: number): { headline: string; subtext: string } {
  if (score < 50) {
    return {
      headline: "You just saw your doom clock. Here's how to defuse it.",
      subtext: 'Your full defense package is ready below.',
    };
  }
  if (score < 70) {
    return {
      headline: "You're in the warning zone. Here's your exact escape plan.",
      subtext: 'Act before your peers do — your plan is waiting.',
    };
  }
  return {
    headline: "You're safer than most. Here's how to stay that way.",
    subtext: 'Protect your edge before the next wave hits.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blurred Preview Tile
// ─────────────────────────────────────────────────────────────────────────────

function BlurredTile({ tile, index }: { tile: PreviewTile; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm transition-all duration-300 cursor-pointer hover:bg-card/60 hover:border-primary/30"
    >
      {/* Icon + Title — always visible */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
          <div className="text-primary">{tile.icon}</div>
        </div>
        <h4 className="text-sm font-bold text-foreground leading-snug flex-1">
          {tile.title}
        </h4>
      </div>

      {/* Personalised blurred content */}
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="space-y-1 p-3 bg-muted/20 rounded transition-all duration-300 select-none"
          style={{
            filter: isHovered ? 'blur(3px)' : 'blur(5px)',
            opacity: isHovered ? 0.7 : 0.55,
          }}
        >
          <p className="text-xs font-semibold text-foreground leading-snug">
            {tile.blurredLine1}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {tile.blurredLine2}
          </p>
        </div>

        {/* Hover tease */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center rounded"
          >
            <span className="text-[10px] font-bold text-primary bg-background/80 px-2 py-1 rounded-full border border-primary/30">
              Unlock to reveal
            </span>
          </motion.div>
        )}
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
  const tiles = buildPersonalisedTiles(report);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* ── SECTION 1: Emotional Header ──────────────────────────────────── */}
      <div className="space-y-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
        >
          <Shield className="w-3.5 h-3.5 text-primary" />
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

      {/* ── SECTION 2: Personalised Blurred Preview Grid ─────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
      >
        {tiles.map((tile, index) => (
          <BlurredTile key={tile.id} tile={tile} index={index} />
        ))}
      </motion.div>

      {/* ── SECTION 3: Social Proof ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <span className="text-xs font-bold text-foreground">4.9/5</span>
        </div>
        <span className="text-xs text-muted-foreground">47,000+ professionals</span>
        <span className="text-xs text-muted-foreground hidden sm:block">TCS · Infosys · Flipkart</span>
      </motion.div>

      {/* ── SECTION 4: CTAs ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        {/* Primary CTA — annual, with savings badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => onUpgrade('year')}
            className="w-full py-4 px-4 rounded-xl bg-primary text-primary-foreground font-black text-base sm:text-lg flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shadow-lg hover:shadow-xl"
          >
            Unlock My Career Plan — ₹1,999/year →
          </button>
          {/* Savings badge — anchored top-right */}
          <div className="absolute -top-2.5 right-3 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
            <BadgeCheck className="w-3 h-3" />
            Save ₹1,601 vs monthly
          </div>
        </div>

        {/* Monthly anchor — shown as price comparison */}
        <button
          type="button"
          onClick={() => onUpgrade('month')}
          className="w-full py-3 px-4 rounded-xl border border-border/60 bg-transparent text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <span className="line-through text-muted-foreground/50 mr-1.5">₹300/mo</span>
          Or pay monthly — cancel anytime
        </button>

        {/* Trust bar — inline, directly under CTAs */}
        <div className="flex items-center justify-center gap-3 flex-wrap pt-0.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3" />
            Razorpay secured
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            7-day refund
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground">Cancel anytime</span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground">Your data stays private</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
