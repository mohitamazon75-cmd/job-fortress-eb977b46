import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Zap, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BriefSignal {
  category: string;
  headline: string;
  detail: string;
  urgency: 'high' | 'medium' | 'low';
  source_hint?: string;
}

interface WeeklyBrief {
  spi: number;
  spi_delta: number | null;
  signals: BriefSignal[];
  weekly_action: string;
  generated_at: string;
}

interface Props {
  scanId: string;
}

const urgencyColors: Record<string, string> = {
  high: 'bg-prophet-red/10 text-prophet-red border-prophet-red/20',
  medium: 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/20',
  low: 'bg-prophet-green/10 text-prophet-green border-prophet-green/20',
};

const categoryIcons: Record<string, string> = {
  ai_impact: '🤖',
  hiring_trend: '📊',
  role_shift: '🔄',
  opportunity: '💡',
  risk: '⚠️',
};

export default function WeeklyBriefWidget({ scanId }: Props) {
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase
          .from('weekly_briefs' as any)
          .select('brief_json, created_at')
          .eq('scan_id', scanId)
          .order('created_at', { ascending: false })
          .limit(1) as any)
          .maybeSingle();

        if (data?.brief_json) {
          setBrief(data.brief_json as WeeklyBrief);
        }
      } catch {
        // No brief yet — expected
      } finally {
        setLoading(false);
      }
    })();
  }, [scanId]);

  if (loading) return null;

  // No brief exists yet
  if (!brief) {
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
    const dayName = nextSunday.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold text-foreground">Weekly Intelligence Brief</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Your first weekly brief generates on <span className="font-semibold text-foreground">{dayName}</span>. 
          We'll track SPI movement, new market signals, and give you one action for the week.
        </p>
      </motion.div>
    );
  }

  const daysAgo = Math.round((Date.now() - new Date(brief.generated_at).getTime()) / (1000 * 60 * 60 * 24));
  const lastUpdated = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

  const DeltaIcon = brief.spi_delta === null || brief.spi_delta === 0
    ? Minus
    : brief.spi_delta > 0
    ? TrendingUp
    : TrendingDown;

  const deltaColor = brief.spi_delta === null || brief.spi_delta === 0
    ? 'text-muted-foreground'
    : brief.spi_delta > 0
    ? 'text-prophet-green'
    : 'text-prophet-red';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-black text-foreground uppercase tracking-wider">Weekly Intelligence Brief</p>
            <p className="text-[10px] text-muted-foreground">Updated {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* SPI Score + Delta */}
      <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-background border border-border">
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Strategic Position Index</p>
          <p className="text-2xl font-black text-foreground">{brief.spi}</p>
        </div>
        {brief.spi_delta !== null && (
          <div className={`flex items-center gap-1 ${deltaColor}`}>
            <DeltaIcon className="w-4 h-4" />
            <span className="text-sm font-bold">{brief.spi_delta > 0 ? '+' : ''}{brief.spi_delta}</span>
            <span className="text-[10px] text-muted-foreground ml-1">vs last week</span>
          </div>
        )}
      </div>

      {/* Weekly Action */}
      {brief.weekly_action && (
        <div className="mb-4 p-3 rounded-xl bg-prophet-green/[0.05] border border-prophet-green/20">
          <p className="text-[10px] font-black text-prophet-green uppercase tracking-wider mb-1">This Week's Action</p>
          <p className="text-xs text-foreground leading-relaxed">{brief.weekly_action}</p>
        </div>
      )}

      {/* Signals */}
      {brief.signals.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between py-2"
          >
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              {brief.signals.length} Market Signals
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {expanded && (
            <div className="space-y-2 mt-1">
              {brief.signals.map((signal, i) => (
                <div key={i} className={`rounded-lg border p-3 ${urgencyColors[signal.urgency] || urgencyColors.medium}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{categoryIcons[signal.category] || '📌'}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground">{signal.headline}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{signal.detail}</p>
                      {signal.source_hint && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">Source: {signal.source_hint}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
