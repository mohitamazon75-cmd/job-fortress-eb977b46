import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Calculator, Network, TrendingUp, ShieldCheck } from 'lucide-react';

const MOATS = [
  {
    icon: Calculator,
    number: '01',
    title: 'Deterministic Calculation Engine',
    headline: 'Zero Hallucinations. Pure Math.',
    desc: 'Every score computed from 48+ calibrated algorithms. Same input, same output, every time. No LLM touches your numbers — 1,465 lines of auditable formulas.',
    stats: [
      { label: '1,465', sublabel: 'lines of math' },
      { label: '48+', sublabel: 'calibration constants' },
    ],
    accent: 'var(--prophet-cyan)',
    accentHsl: 'hsl(var(--prophet-cyan))',
  },
  {
    icon: Network,
    number: '02',
    title: 'Structured Knowledge Graph',
    headline: '95 Job Families × 147 Skills. Industry-Calibrated.',
    desc: 'A structured database with weighted edges mapping automation risk, AI augmentation potential, and human edge strength — calibrated from O*NET, ESCO, and Indian labor market data. Same skill, different risk, by industry and seniority.',
    stats: [
      { label: '95', sublabel: 'job families' },
      { label: '147+', sublabel: 'skill vectors' },
    ],
    accent: 'hsl(var(--primary))',
    accentHsl: 'hsl(var(--primary))',
  },
  {
    icon: TrendingUp,
    number: '03',
    title: 'Search-Grounded Market Intelligence',
    headline: 'Live Data. Cited Sources. Not Training Data.',
    desc: 'Every market insight grounded in real-time web search — hiring trends, AI tool adoption, company news — with clickable source citations. Combined with AIRMM career transition modeling for quantified pivot options.',
    stats: [
      { label: 'Real-time', sublabel: 'market signals' },
      { label: 'Cited', sublabel: 'source URLs' },
    ],
    accent: 'hsl(var(--prophet-gold))',
    accentHsl: 'hsl(var(--prophet-gold))',
  },
];

export default function MoatsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-16 md:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dot-pattern opacity-20" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03] blur-[150px] pointer-events-none"
        style={{ background: 'hsl(var(--primary))' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12 md:mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Strategic Edge</span>
          </motion.div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-foreground mb-5">
            Why We Can't Be{' '}
            <span
              className="inline-block"
              style={{
                background: 'var(--gradient-threatened)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Copied.
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every competitor wraps an LLM and calls it "AI career advice." We built a{' '}
            <span className="text-foreground font-bold">ground-up intelligence system</span> with 3 layers of proprietary technology.
          </p>
        </motion.div>

        {/* Moats Grid */}
        <div className="grid gap-4 md:gap-5">
          {MOATS.map((moat, i) => {
            const Icon = moat.icon;
            const isEven = i % 2 === 0;
            return (
              <motion.div
                key={moat.number}
                initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                className="group relative rounded-2xl border-2 border-border bg-card hover:border-primary/20 transition-all duration-500 overflow-hidden"
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: moat.accentHsl }}
                />

                <div className="p-5 sm:p-7 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                    {/* Number + Icon */}
                    <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 flex-shrink-0">
                      <span className="font-mono text-xs font-black tracking-wider text-muted-foreground/40">{moat.number}</span>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                        style={{ background: `${moat.accentHsl}15` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: moat.accentHsl }} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{moat.title}</h3>
                      <p className="text-lg sm:text-xl md:text-2xl font-black text-foreground tracking-tight mb-2">
                        {moat.headline}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        {moat.desc}
                      </p>
                    </div>

                    {/* Stats pills */}
                    <div className="flex md:flex-col gap-3 flex-shrink-0">
                      {moat.stats.map((stat) => (
                        <div
                          key={stat.sublabel}
                          className="px-4 py-2.5 rounded-xl border border-border bg-secondary text-center min-w-[100px] group-hover:border-primary/15 transition-colors duration-300"
                        >
                          <p className="text-base sm:text-lg font-black text-foreground leading-none">{stat.label}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{stat.sublabel}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7 }}
          className="mt-10 md:mt-14 text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-4 rounded-2xl border border-border bg-card/50">
            {[
              'Deterministic Scores',
              'Auditable Formulas',
              'Industry-Calibrated',
              'Seniority-Aware',
              'Search-Grounded',
            ].map((item) => (
              <span key={item} className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
