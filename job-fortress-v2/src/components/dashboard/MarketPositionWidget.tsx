import { motion } from 'framer-motion';
import { TrendingUp, Users, Crown, Sparkles } from 'lucide-react';

export interface MarketPositionModel {
  market_percentile: number;
  competitive_tier: string;
  leverage_status: string;
  talent_density: string;
  demand_trend: string;
  posting_volume_proxy?: number;  // Optional — may not be present in older scans
}

interface Props {
  data: MarketPositionModel;
}

const leverageColors: Record<string, { text: string; bg: string; border: string }> = {
  high: { text: 'text-prophet-green', bg: 'bg-prophet-green/10', border: 'border-prophet-green/20' },
  moderate: { text: 'text-prophet-gold', bg: 'bg-prophet-gold/10', border: 'border-prophet-gold/20' },
  low: { text: 'text-prophet-red', bg: 'bg-prophet-red/10', border: 'border-prophet-red/20' },
};

function getLeverageStyle(status?: string) {
  if (!status) return leverageColors.moderate;
  const key = status.toLowerCase().includes('high') ? 'high' : status.toLowerCase().includes('low') ? 'low' : 'moderate';
  return leverageColors[key] || leverageColors.moderate;
}

function getDemandSignal(volume?: number): {
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
} {
  if (volume === undefined || volume === null) {
    return { label: 'Demand data loading', colorClass: 'text-muted-foreground', borderClass: 'border-border', bgClass: 'bg-background' };
  }
  if (volume >= 7) return { label: 'Strong demand signal', colorClass: 'text-prophet-green', borderClass: 'border-prophet-green/20', bgClass: 'bg-prophet-green/[0.04]' };
  if (volume >= 3) return { label: 'Moderate demand signal', colorClass: 'text-prophet-gold', borderClass: 'border-prophet-gold/20', bgClass: 'bg-prophet-gold/[0.04]' };
  return { label: 'Limited search signal', colorClass: 'text-destructive', borderClass: 'border-destructive/20', bgClass: 'bg-destructive/[0.04]' };
}

export default function MarketPositionWidget({ data }: Props) {
  const style = getLeverageStyle(data.leverage_status);
  const demandSignal = getDemandSignal(data.posting_volume_proxy);
  const percentileLabel = data.market_percentile <= 10 ? `Top ${data.market_percentile}%` :
    data.market_percentile <= 25 ? `Top ${data.market_percentile}%` :
    data.market_percentile <= 50 ? `Top ${data.market_percentile}%` :
    `Position ${data.market_percentile}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border-2 border-primary/20 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.04), hsl(var(--background)), hsl(var(--primary) / 0.02))',
      }}
    >
      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                Your Market Position
              </h3>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> ML-Powered
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Talent Market Position Model — where you stand vs. similar professionals
            </p>
          </div>
        </div>

        {/* Percentile Hero */}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-5 mb-4 text-center">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Market Percentile</p>
          <p className="text-4xl md:text-5xl font-black text-foreground leading-none">
            {percentileLabel}
          </p>
          <p className="text-sm text-muted-foreground mt-2 font-semibold">{data.competitive_tier}</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Leverage Status */}
          <div className={`rounded-xl border ${style.border} ${style.bg.replace('/10', '/[0.04]')} p-4`}>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={`w-3.5 h-3.5 ${style.text}`} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Leverage</span>
            </div>
            <p className={`text-sm font-black ${style.text} leading-tight`}>{data.leverage_status}</p>
          </div>

          {/* Talent Density */}
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Density</span>
            </div>
            <p className="text-sm font-black text-foreground leading-tight">{data.talent_density}</p>
          </div>

          {/* Job Demand Signal */}
          <div className={`rounded-xl border ${demandSignal.borderClass} ${demandSignal.bgClass} p-4`}>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={`w-3.5 h-3.5 ${demandSignal.colorClass}`} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Demand</span>
            </div>
            <p className={`text-sm font-black ${demandSignal.colorClass} leading-tight`}>{demandSignal.label}</p>
            <p className="text-[11px] text-muted-foreground mt-1">web search signal</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
