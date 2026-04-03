import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Calculator, Network, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react';

const TRUST_PILLARS = [
  {
    icon: Calculator,
    title: 'Deterministic Engine',
    desc: 'Career scores computed by auditable algorithms — same inputs always produce the same result.',
    proof: '48+ calibration constants',
    highlight: 'Fully traceable',
  },
  {
    icon: Network,
    title: 'Structured Knowledge Graph',
    desc: '95 job families × 147+ skill vectors mapped with automation risk, AI augmentation, and human-edge data.',
    proof: 'Calibrated from O*NET, ESCO, NASSCOM',
    highlight: 'Not an LLM guess',
  },
  {
    icon: TrendingUp,
    title: 'Live Market Intelligence',
    desc: 'Real-time hiring signals, salary trends, and AI adoption rates — refreshed on every scan with cited sources.',
    proof: 'Search-grounded, not training data',
    highlight: 'Always current',
  },
];

export default function TrustSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-10" />
      
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Why Trust Us</span>
          </motion.div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground mb-4">
            Not Another ChatGPT Wrapper.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            <span className="text-foreground font-bold">Numbers = pure math</span> from our deterministic engine. <span className="text-foreground font-bold">Strategy = AI-assisted</span>, grounded in your data.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {TRUST_PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--gradient-primary)' }}>
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-black text-foreground text-base mb-2">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{pillar.desc}</p>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {pillar.proof}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-prophet-green bg-prophet-green/10 px-2 py-0.5 rounded-full">
                    {pillar.highlight}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
