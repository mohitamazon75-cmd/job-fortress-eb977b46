import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FlaskConical, ChevronDown, ExternalLink } from 'lucide-react';
import { type ObsolescenceTimeline as OTType } from '@/lib/scan-engine';

interface ObsolescenceTimelineProps {
  timeline: OTType;
  monthsRemaining: number;
  mlEnhanced?: boolean;
}

const ZONES = [
  { key: 'purple', label: 'Safe Window', desc: 'Act now for maximum options', color: 'bg-purple-500', textColor: 'text-purple-600', borderColor: 'border-purple-200', bgColor: 'bg-purple-50' },
  { key: 'yellow', label: 'Pressure Starts', desc: 'Salary pressure begins (−15%)', color: 'bg-prophet-gold', textColor: 'text-prophet-gold', borderColor: 'border-prophet-gold/20', bgColor: 'bg-prophet-gold/5' },
  { key: 'orange', label: 'Role Shrinks', desc: 'Role commoditized (−35%)', color: 'bg-orange-500', textColor: 'text-orange-600', borderColor: 'border-orange-200', bgColor: 'bg-orange-50' },
  { key: 'red', label: 'Major Change', desc: 'Role significantly transformed (−65%)', color: 'bg-prophet-red', textColor: 'text-prophet-red', borderColor: 'border-prophet-red/20', bgColor: 'bg-prophet-red/5' },
] as const;

const METHODOLOGY_SOURCES = [
  {
    org: 'McKinsey Global Institute',
    year: '2024',
    finding: 'Generative AI adoption is doubling every ~18 months across enterprise use cases, accelerating task automation timelines.',
    url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
  },
  {
    org: 'World Economic Forum',
    year: '2025',
    finding: '23% of jobs globally will undergo structural change within the next 5 years, driven primarily by AI and automation.',
    url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/',
  },
  {
    org: 'Goldman Sachs Research',
    year: '2024',
    finding: '300 million jobs worldwide are exposed to AI-driven automation, with partial displacement expected within 3–5 years for high-exposure roles.',
    url: 'https://www.goldmansachs.com/insights/articles/generative-ai-could-raise-global-gdp-by-7-percent',
  },
];

const METHODOLOGY_FACTORS = [
  { label: 'AI Acceleration', desc: 'Compounding 12%/year from 2024 baseline — timelines shorten each year as AI adoption accelerates.' },
  { label: 'Market Signals', desc: 'Real-time job posting trends and AI mention rates compress or extend the window based on your specific role\'s market health.' },
  { label: 'Risk-Relative Zones', desc: 'Zone boundaries scale with your risk level — higher risk roles have tighter windows, not fixed offsets.' },
];

export default function ObsolescenceTimelineWidget({ timeline, monthsRemaining, mlEnhanced }: ObsolescenceTimelineProps) {
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const months = [
    timeline.purple_zone_months,
    timeline.yellow_zone_months,
    timeline.orange_zone_months,
    timeline.red_zone_months,
  ];

  const maxMonths = Math.max(...months, 48);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="mb-6"
    >
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        How Long You Have
        {mlEnhanced && (
          <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            ML-Enhanced
          </span>
        )}
      </h2>
      <p className="text-xs text-muted-foreground mb-2 ml-6">
        Projected timeline based on AI adoption speed, job posting trends, and 
        real-time market data. Purple = best window to act. Red = significant role transformation expected.
      </p>

      {/* Methodology expandable */}
      <button
        onClick={() => setMethodologyOpen(!methodologyOpen)}
        className="flex items-center gap-1.5 ml-6 mb-3 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors group"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        How is this calculated?
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${methodologyOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {methodologyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden ml-6 mb-4"
          >
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Formula Components</h4>
                <div className="space-y-2">
                  {METHODOLOGY_FACTORS.map((f) => (
                    <div key={f.label} className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-foreground">{f.label}: </span>
                        <span className="text-xs text-muted-foreground">{f.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Research Sources</h4>
                <div className="space-y-2.5">
                  {METHODOLOGY_SOURCES.map((s) => (
                    <div key={s.org} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{s.org} <span className="font-normal text-muted-foreground">({s.year})</span></p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.finding}</p>
                        </div>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded hover:bg-muted transition-colors" title="View source">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground italic">
                Timeline adjusts automatically as market conditions change. Scores are estimates, not guarantees.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-border bg-card p-5">
        {timeline.already_in_warning && (
          <div className="rounded-lg border border-prophet-red/30 bg-prophet-red/5 px-4 py-2 mb-4">
            <p className="text-xs font-bold text-prophet-red">⚠ You are already in the pressure window. Immediate action required.</p>
          </div>
        )}

        {/* Visual timeline bar */}
        <div className="relative h-8 rounded-full bg-muted overflow-hidden mb-4">
          {ZONES.map((zone, i) => {
            const startPct = i === 0 ? 0 : (months[i - 1] / maxMonths) * 100;
            const widthPct = (months[i] / maxMonths) * 100 - startPct;
            return (
              <motion.div
                key={zone.key}
                initial={{ width: 0 }}
                animate={{ width: `${startPct + widthPct}%` }}
                transition={{ duration: 1, delay: 0.8 + i * 0.15 }}
                className={`absolute top-0 bottom-0 left-0 ${zone.color} opacity-70`}
                style={{ zIndex: 4 - i }}
              />
            );
          })}
          <div className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10" style={{ left: '0%' }}>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-foreground whitespace-nowrap">NOW</div>
          </div>
        </div>

        {/* Zone cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ZONES.map((zone, i) => (
            <div key={zone.key} className={`rounded-xl border ${zone.borderColor} ${zone.bgColor} p-3`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${zone.color}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${zone.textColor}`}>{zone.label}</span>
              </div>
              <p className="text-lg font-black text-foreground">{months[i]}mo</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{zone.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
