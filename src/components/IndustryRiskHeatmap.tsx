import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { TrendingDown, TrendingUp, Minus, BarChart3 } from 'lucide-react';

const INDUSTRY_RISKS = [
  { name: 'Media & Entertainment', risk: 68, trend: 'up' as const, emoji: '🎬' },
  { name: 'Marketing & Advertising', risk: 64, trend: 'up' as const, emoji: '📢' },
  { name: 'IT Services', risk: 62, trend: 'up' as const, emoji: '💻' },
  { name: 'Banking & Finance', risk: 58, trend: 'up' as const, emoji: '🏦' },
  { name: 'E-commerce & Retail', risk: 55, trend: 'up' as const, emoji: '🛒' },
  { name: 'Legal', risk: 52, trend: 'up' as const, emoji: '⚖️' },
  { name: 'Consulting', risk: 49, trend: 'up' as const, emoji: '📊' },
  { name: 'Manufacturing', risk: 45, trend: 'stable' as const, emoji: '🏭' },
  { name: 'Education', risk: 38, trend: 'stable' as const, emoji: '📚' },
  { name: 'Healthcare', risk: 31, trend: 'stable' as const, emoji: '🏥' },
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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-20 md:py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 dot-pattern opacity-10" />
      
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-5">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Industry Intelligence</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground mb-3">
            AI Risk by Industry
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Average automation risk across <span className="text-foreground font-bold">98+ role archetypes</span> in each sector
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {INDUSTRY_RISKS.map((industry, i) => (
              <motion.div
                key={industry.name}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-lg flex-shrink-0">{industry.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-foreground truncate">{industry.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {industry.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3 text-destructive" />
                      ) : (
                        <Minus className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${getRiskColor(industry.risk)}`}>
                        {industry.risk}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${getRiskBarColor(industry.risk)}`}
                      initial={{ width: 0 }}
                      animate={isInView ? { width: `${industry.risk}%` } : {}}
                      transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground text-center">
              📊 <span className="font-bold">Computed</span> from Knowledge Graph · Updated with live market signals
            </p>
          </div>
        </motion.div>
      </div>
      
      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
