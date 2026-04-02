// ═══════════════════════════════════════════════════════════════
// CohortInsightBadge — IP #1: Cohort Intelligence Engine (UI)
// ═══════════════════════════════════════════════════════════════
// A compact, reusable badge that shows peer comparison insight.
// Designed to drop into the bottom of DoomClockCard and
// StabilityScoreCard without affecting their layout.
//
// Shows:
//  "312 Data Scientists in Bangalore — 68% improved by learning
//   cloud architecture."
//
// Props:
//   scanId: string          — current scan ID (RLS-protected)
//   variant: 'doom' | 'stability'  — small contextual tweak to copy
// ═══════════════════════════════════════════════════════════════

import { Users, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { useCohortIntel } from '@/hooks/useCohortIntel';

interface CohortInsightBadgeProps {
  scanId: string | undefined;
  variant?: 'doom' | 'stability';
  className?: string;
}

export default function CohortInsightBadge({
  scanId,
  variant = 'stability',
  className = '',
}: CohortInsightBadgeProps) {
  const { data, loading, error } = useCohortIntel(scanId);

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
        <span>Comparing with peers…</span>
      </div>
    );
  }

  // ── Error or no data — render nothing (non-blocking) ─────────
  if (error || !data || data.cohort_size < 3) return null;

  // ── Choose trend icon based on variant + cohort data ─────────
  const showImprovement = variant === 'stability' && data.pct_improved !== null && data.pct_improved > 0;
  const TrendIcon = showImprovement
    ? TrendingUp
    : data.cohort_size >= 20
    ? Minus
    : null;

  // ── Parse markdown bold from insight_text for display ─────────
  // Insight text uses **bold** markers for the key skill name.
  const renderInsightText = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} className="text-foreground font-semibold">{part}</strong>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div className={`flex items-start gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/50 ${className}`}>
      {/* Icon */}
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <Users className="w-3 h-3 text-primary/70" />
        {TrendIcon && (
          <TrendIcon className={`w-3 h-3 ${showImprovement ? 'text-emerald-500' : 'text-muted-foreground'}`} />
        )}
      </div>

      {/* Text */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {renderInsightText(data.insight_text)}
      </p>
    </div>
  );
}
