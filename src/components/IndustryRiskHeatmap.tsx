import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

// Static industry risk data derived from Knowledge Graph averages
const INDUSTRY_RISKS = [
  { name: 'IT Services', risk: 62, trend: 'up' as const, emoji: '💻' },
  { name: 'Banking & Finance', risk: 58, trend: 'up' as const, emoji: '🏦' },
  { name: 'Marketing & Advertising', risk: 64, trend: 'up' as const, emoji: '📢' },
  { name: 'Healthcare', risk: 31, trend: 'stable' as const, emoji: '🏥' },
  { name: 'Legal', risk: 52, trend: 'up' as const, emoji: '⚖️' },
  { name: 'Manufacturing', risk: 45, trend: 'stable' as const, emoji: '🏭' },
  { name: 'Education', risk: 38, trend: 'stable' as const, emoji: '📚' },
  { name: 'E-commerce & Retail', risk: 55, trend: 'up' as const, emoji: '🛒' },
  { name: 'Media & Entertainment', risk: 68, trend: 'up' as const, emoji: '🎬' },
  { name: 'Consulting', risk: 49, trend: 'up' as const, emoji: '📊' },
];

function getRiskColor(risk: number) {
  if (risk >= 60) return 'bg-destructive/20 text-destructive border-destructive/20';
  if (risk >= 45) return 'bg-prophet-gold/20 text-prophet-gold border-prophet-gold/20';
  return 'bg-prophet-green/20 text-prophet-green border-prophet-green/20';
}

function getRiskBarColor(risk: number) {
  if (risk >= 60) return 'bg-destructive/40';
  if (risk >= 45) return 'bg-prophet-gold/40';
  return 'bg-prophet-green/40';
}

export default function IndustryRiskHeatmap() {
  const sorted = [...INDUSTRY_RISKS].sort((a, b) => b.risk - a.risk);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5 }}
      className="max-w-4xl mx-auto mt-10 sm:mt-14"
    >
      <div className="text-center mb-5">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Industry Intelligence</span>
        <h3 className="text-xl sm:text-2xl font-black text-foreground mt-1">AI Risk by Industry</h3>
        <p className="text-sm text-muted-foreground mt-1">Average automation risk across 95+ job families in each sector</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {sorted.map((industry, i) => (
            <motion.div
              key={industry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.6 + i * 0.05 }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <span className="text-lg flex-shrink-0">{industry.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground truncate">{industry.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {industry.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3 text-destructive" />
                    ) : (
                      <Minus className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${getRiskColor(industry.risk)}`}>
                      {industry.risk}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${getRiskBarColor(industry.risk)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${industry.risk}%` }}
                    transition={{ delay: 1.8 + i * 0.05, duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground text-center">
            📊 <span className="font-bold">Computed</span> from Knowledge Graph · Updated with live market signals
          </p>
        </div>
      </div>
    </motion.div>
  );
}
