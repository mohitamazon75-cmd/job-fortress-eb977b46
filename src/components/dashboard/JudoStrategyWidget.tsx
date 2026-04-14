import { motion } from 'framer-motion';
import { Zap, ArrowUp, Clock, Sparkles, Star, ExternalLink, Newspaper, Lightbulb, TrendingUp } from 'lucide-react';
import type { WeeklyIntel } from '@/hooks/use-judo-intel';
import { buildResourceUrl } from '@/lib/resource-links';

interface GitHubValidation {
  verified: boolean;
  repo?: string;
  stars?: number;
  last_push?: string;
  language?: string;
  description?: string;
  actively_maintained?: boolean;
  reason?: string;
}

interface JudoStrategy {
  recommended_tool: string;
  pitch: string;
  survivability_after_judo: number;
  months_gained: number;
  github_validation?: GitHubValidation;
}

interface JudoStrategyWidgetProps {
  strategy: JudoStrategy;
  githubStars?: number | null;
  weeklyIntel?: WeeklyIntel | null;
  intelLoading?: boolean;
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function JudoStrategyWidget({ strategy, githubStars: legacyStars, weeklyIntel, intelLoading }: JudoStrategyWidgetProps) {
  const ghv = strategy.github_validation;
  const starCount = ghv?.stars ?? legacyStars;
  const isVerified = ghv?.verified === true;
  const isActive = ghv?.actively_maintained === true;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mb-6"
    >
      <div className="relative rounded-2xl border-2 border-primary/30 overflow-hidden">
        {/* Pulsing border glow */}
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-pulse pointer-events-none" />

        {/* Glassmorphism background */}
        <div
          className="relative p-6 md:p-8"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--background)), hsl(var(--primary) / 0.03))',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Plain language hook */}
          <p className="text-sm font-bold text-foreground/80 italic mb-4">
            If you learn one thing this month, make it this.
          </p>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Immediate Action: The Judo Strategy
                </h3>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  ML-Powered
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Use AI's own momentum against it — learn this tool this weekend
              </p>
            </div>
          </div>

          {/* Recommended Tool */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-5 mb-4">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
              Learn This Weekend
            </p>
            <div className="flex items-center gap-3">
              <p className="text-2xl md:text-3xl font-black text-foreground leading-tight">
                {strategy.recommended_tool}
              </p>
              {starCount != null && starCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-prophet-gold/10 text-prophet-gold border border-prophet-gold/20">
                  <Star className="w-3.5 h-3.5 fill-prophet-gold" />
                  {formatStars(starCount)}
                </span>
              )}
              {isVerified && isActive && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-prophet-green/10 text-prophet-green border border-prophet-green/20">
                  ✓ Actively maintained
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              📚 Tutorials on YouTube & NPTEL · Coursera India pricing available
            </p>
          </div>

          {/* The Pitch */}
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
              Why This Matters
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {strategy.pitch}
            </p>
          </div>

          {/* Live Weekly Intel */}
          {intelLoading && (
            <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-2">
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-full bg-muted animate-pulse rounded" />
              <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
            </div>
          )}

          {weeklyIntel && !intelLoading && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.02] p-4 mb-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Live Intel</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-prophet-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" /> Updated live
                </span>
              </div>

              {weeklyIntel.news && (
                <div className="flex items-start gap-2">
                  <Newspaper className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{weeklyIntel.news}</p>
                </div>
              )}

              {weeklyIntel.tutorial?.title && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <a
                      href={buildResourceUrl(weeklyIntel.tutorial.title, weeklyIntel.tutorial.platform || '', 'course', weeklyIntel.tutorial.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-foreground hover:text-primary underline underline-offset-2 transition-colors"
                    >
                      {weeklyIntel.tutorial.title}
                    </a>
                    {weeklyIntel.tutorial.platform && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">on {weeklyIntel.tutorial.platform}</span>
                    )}
                  </div>
                </div>
              )}

              {weeklyIntel.market_signal && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-prophet-green mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{weeklyIntel.market_signal}</p>
                </div>
              )}

              {weeklyIntel.weekly_tip && (
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-prophet-gold mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-semibold text-foreground leading-relaxed">{weeklyIntel.weekly_tip}</p>
                </div>
              )}
            </div>
          )}

          {/* Impact Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.04] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUp className="w-4 h-4 text-prophet-green" />
                <span className="text-[10px] font-black text-prophet-green uppercase tracking-wider">
                  Survivability Boost
                </span>
              </div>
              <p className="text-2xl font-black text-prophet-green">
                {strategy.survivability_after_judo}
                <span className="text-base">%</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                New protection score after adoption
              </p>
            </div>
            <div className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.04] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-4 h-4 text-prophet-green" />
                <span className="text-[10px] font-black text-prophet-green uppercase tracking-wider">
                  Extra Runway
                </span>
              </div>
              <p className="text-2xl font-black text-prophet-green">
                +{strategy.months_gained}
                <span className="text-base">mo</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Additional months of career runway
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
