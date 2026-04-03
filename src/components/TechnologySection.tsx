import { motion, useInView, animate } from 'framer-motion';
import { useRef, useEffect, useState, forwardRef } from 'react';
import { Database, Cpu, Globe, Zap, Network, BarChart3, Shield, Brain, Star, Quote } from 'lucide-react';

const AnimatedCounter = forwardRef<HTMLSpanElement, { target: number; suffix?: string; prefix?: string; duration?: number; delay?: number }>(
  ({ target, suffix = '', prefix = '', duration = 2, delay = 0 }, _forwardedRef) => {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-50px' });
    const [display, setDisplay] = useState('0');

    useEffect(() => {
      if (!inView) return;
      const controls = animate(0, target, {
        duration,
        delay,
        ease: 'easeOut',
        onUpdate: (v) => setDisplay(Math.round(v).toLocaleString()),
      });
      return () => controls.stop();
    }, [inView, target, duration, delay]);

    return (
      <span ref={ref} className="tabular-nums">
        {prefix}{display}{suffix}
      </span>
    );
  }
);
AnimatedCounter.displayName = 'AnimatedCounter';

const STATS = [
  { value: 95, suffix: '+', label: 'Job Families Mapped', sublabel: 'Scored & tracked', icon: Database, color: 'hsl(var(--primary))' },
  { value: 147, suffix: '+', label: 'Skill Vectors', sublabel: 'Vulnerability-tracked', icon: Network, color: 'hsl(var(--prophet-cyan))' },
  { value: 5, suffix: '', label: 'AI Agents', sublabel: 'Parallel pipeline', icon: Brain, color: 'hsl(var(--prophet-gold))' },
  { value: 100, suffix: '%', label: 'Deterministic', sublabel: 'Zero LLM-generated numbers', icon: BarChart3, color: 'hsl(var(--prophet-green))' },
];

const TECH_PILLARS = [
  {
    icon: Cpu,
    title: 'Deterministic Calculation Engine',
    desc: 'All career risk scores computed from structured Knowledge Graph data through auditable mathematical formulas. No LLM generates any number in your report.',
    tags: ['Weighted Skill Matching', 'Fuzzy KG Lookup', 'Auditable Formulas'],
  },
  {
    icon: Network,
    title: 'Structured Knowledge Graph',
    desc: '95+ job families × 147+ skill vectors with weighted edges mapping automation risk, AI augmentation potential, and human-edge strength across global labor markets.',
    tags: ['Job-Skill Matrix', 'Automation Risk Edges', 'Human Edge Scoring'],
  },
  {
    icon: Globe,
    title: 'Real-Time Market Intelligence',
    desc: 'Live hiring signals, salary trends, and AI adoption rates fetched via deep web search and synthesized by our reasoning engine — refreshed on every scan for your specific role.',
    tags: ['Deep Web Search', 'Neural Synthesis', 'Per-Scan Freshness'],
  },
  {
    icon: Shield,
    title: 'Hybrid Architecture',
    desc: 'Numbers come from deterministic algorithms (zero hallucination). Qualitative strategy comes from AI (Gemini 2.5 Flash) grounded in your actual profile data. Both are clearly labeled.',
    tags: ['Numbers: Algorithm', 'Strategy: AI-Assisted', 'Clearly Labeled'],
  },
];

// Testimonials removed — Sprint 0.1. Will be replaced with real user feedback
// from scan_feedback table once sufficient volume exists.
// Showing anonymized scan statistics instead.

export default function TechnologySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative py-12 md:py-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none" style={{ background: 'hsl(var(--primary))' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">


        {/* TECHNOLOGY SECTION — Under the Hood */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Under the Hood</span>
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground mb-4">
            Built Different.{' '}
            <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Built to be Right.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            While others wrap ChatGPT and call it "AI career advice," we engineered a{' '}
            <span className="text-foreground font-bold">ground-up intelligence system</span> purpose-built for the global job market.
          </p>
        </motion.div>

        {/* Animated Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10"
        >
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="relative group p-6 md:p-8 rounded-2xl border-2 border-border bg-card hover:border-primary/30 transition-all duration-500 text-center overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[60px] pointer-events-none"
                  style={{ background: stat.color, opacity: 0.05 }}
                />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                    <Icon className="w-6 h-6" style={{ color: stat.color }} />
                  </div>
                  <p className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-foreground mb-2">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} delay={0.9 + i * 0.15} />
                  </p>
                  <p className="text-sm font-bold text-foreground mb-0.5">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Technology Pillars */}
        <div className="grid md:grid-cols-2 gap-5 md:gap-6">
          {TECH_PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.0 + i * 0.12 }}
                className="group relative p-6 md:p-8 rounded-2xl border-2 border-border bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-500 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-[0.04] blur-[50px] pointer-events-none transition-opacity duration-500" style={{ background: 'hsl(var(--primary))' }} />
                <div className="relative">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-foreground text-lg mb-1">{pillar.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-16">
                    {pillar.tags.map((tag) => (
                      <span key={tag} className="text-[11px] font-bold px-3 py-1 rounded-full border border-border bg-secondary text-muted-foreground group-hover:border-primary/20 group-hover:text-primary group-hover:bg-primary/5 transition-colors duration-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom credibility bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.4 }}
          className="mt-12 md:mt-16 p-6 md:p-8 rounded-2xl border-2 border-primary/15 bg-primary/[0.02] text-center"
        >
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-4xl mx-auto">
            <span className="text-foreground font-bold">Every numerical score</span> passes through our{' '}
            <span className="font-mono text-primary font-bold">deterministic calculation engine</span>,{' '}
            <span className="font-mono text-primary font-bold">structured Knowledge Graph</span>, and{' '}
            <span className="font-mono text-primary font-bold">real-time market signals</span> before reaching you.
            Numbers = pure math. Strategy = AI-assisted, grounded in your data.
          </p>
          <div className="flex items-center justify-center gap-6 mt-5 flex-wrap">
            {['Deterministic Scores', 'Auditable Formulas', 'Global Market Data', 'AI-Assisted Strategy'].map((item) => (
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
