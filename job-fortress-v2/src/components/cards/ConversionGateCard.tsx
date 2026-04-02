import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, DollarSign, Rocket, Users, Brain, Star } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

interface ConversionGateCardProps {
  report: ScanReport;
  onUpgrade: (defaultTier?: 'year' | 'month') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blurred Preview Tile Data
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewTile {
  id: string;
  icon: React.ReactNode;
  title: string;
  blurredContent: string;
}

function getPreviewTiles(): PreviewTile[] {
  return [
    {
      id: 'ats-resume',
      icon: <FileText className="w-5 h-5" />,
      title: 'ATS Resume Rewrite',
      blurredContent: '3 rewrites ready · 847 keywords added',
    },
    {
      id: 'defense-plan',
      icon: <Shield className="w-5 h-5" />,
      title: '90-Day Defense Plan',
      blurredContent: 'Week 1: Learn X · Week 2: Apply to Y',
    },
    {
      id: 'salary-scripts',
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Salary Negotiation Scripts',
      blurredContent: 'Copy-paste scripts for ₹2.4L raise',
    },
    {
      id: 'skill-roadmap',
      icon: <Rocket className="w-5 h-5" />,
      title: 'Skill Upgrade Roadmap',
      blurredContent: '8 skills · 12-week plan · free resources',
    },
    {
      id: 'peer-comparison',
      icon: <Users className="w-5 h-5" />,
      title: 'Peer Comparison',
      blurredContent: 'You rank 73rd percentile in your tier',
    },
    {
      id: 'ai-coach',
      icon: <Brain className="w-5 h-5" />,
      title: 'AI Career Coach',
      blurredContent: 'Unlimited Q&A · personalized to your scan',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Score-based Headlines
// ─────────────────────────────────────────────────────────────────────────────

interface HeadlineConfig {
  headline: string;
  subtext: string;
}

function getHeadline(score: number): HeadlineConfig {
  if (score < 50) {
    return {
      headline: 'You just saw your doom clock. Here\'s how to defuse it.',
      subtext: 'Unlocked by 47,000+ professionals this month',
    };
  }
  if (score < 70) {
    return {
      headline: 'You\'re in the warning zone. Here\'s your exact escape plan.',
      subtext: 'Unlocked by 47,000+ professionals this month',
    };
  }
  return {
    headline: 'You\'re safe — for now. Here\'s how to stay that way.',
    subtext: 'Unlocked by 47,000+ professionals this month',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blurred Preview Tile Component
// ─────────────────────────────────────────────────────────────────────────────

interface BlurredTileProps {
  tile: PreviewTile;
  index: number;
}

function BlurredTile({ tile, index }: BlurredTileProps) {
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
      {/* Icon and Title — always visible */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
          <div className="text-primary">{tile.icon}</div>
        </div>
        <h4 className="text-sm font-bold text-foreground leading-snug flex-1">
          {tile.title}
        </h4>
      </div>

      {/* Blurred Content Area — reveals slightly on hover */}
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/20 rounded transition-all duration-300"
          style={{
            filter: isHovered ? 'blur(2px)' : 'blur(4px)',
            opacity: isHovered ? 0.65 : 0.5,
          }}
        >
          {tile.blurredContent}
        </div>

        {/* Tease indicator — shows on hover */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/20 to-transparent rounded"
          >
            <span className="text-[10px] font-semibold text-primary/80">
              ✨ Unlock to see
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

export default function ConversionGateCard({
  report,
  onUpgrade,
}: ConversionGateCardProps) {
  const score = computeStabilityScore(report);
  const { headline, subtext } = getHeadline(score);
  const tiles = getPreviewTiles();

  const handleYearlyClick = () => {
    onUpgrade('year');
  };

  const handleScanOnlyClick = () => {
    onUpgrade('month');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 1: Emotional Header
          ────────────────────────────────────────────────────────────────────── */}

      <div className="space-y-4">
        {/* Tag */}
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

        {/* Main Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl sm:text-3xl font-black text-foreground leading-tight"
        >
          {headline}
        </motion.h2>

        {/* Subtext with social proof */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground leading-relaxed"
        >
          {subtext}
        </motion.p>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 2: Blurred Preview Grid
          ────────────────────────────────────────────────────────────────────── */}

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

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 3: Social Proof Bar
          ────────────────────────────────────────────────────────────────────── */}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4"
      >
        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
              />
            ))}
          </div>
          <span className="text-xs font-bold text-foreground">
            4.9/5 from 2,847 reviews
          </span>
        </div>

        {/* Companies */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Used by professionals at</span> TCS,
          Infosys, Flipkart, Razorpay, and 1000+ companies
        </p>
      </motion.div>

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 4: CTA Buttons
          ────────────────────────────────────────────────────────────────────── */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        {/* Primary CTA — Full Width */}
        <button
          onClick={handleYearlyClick}
          className="w-full py-4 px-4 rounded-xl bg-primary text-primary-foreground font-black text-base sm:text-lg flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shadow-lg hover:shadow-xl"
        >
          Unlock My Career Plan — ₹1,999/year
          <span className="text-xl">→</span>
        </button>

        {/* Secondary CTA — Full Width, Muted */}
        <button
          onClick={handleScanOnlyClick}
          className="w-full py-3 px-4 text-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded-lg"
        >
          ₹300/month — cancel anytime
        </button>

        {/* Micro-copy */}
        <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
          Early access pricing · Secure via Razorpay · Cancel anytime
        </p>
      </motion.div>

      {/* Optional: Trust indicators or disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"
      >
        <span>🔒</span>
        <span>Your scan data is private and encrypted</span>
      </motion.div>
    </motion.div>
  );
}
