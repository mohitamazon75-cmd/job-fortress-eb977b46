import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Calculator, Network, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react';

const TRUST_PILLARS = [
  {
    icon: Calculator,
    title: 'Deterministic Engine',
    desc: 'Career scores computed by auditable algorithms — same inputs always produce the same result. 48+ calibration constants, fully traceable.',
    proof: '48+ calibration constants',
  },
  {
    icon: Network,
    title: 'Structured Knowledge Graph',
    desc: '95 job families × 147+ skill vectors mapped with automation risk, AI augmentation, and human-edge data.',
    proof: 'Calibrated from O*NET, ESCO, NASSCOM',
  },
  {
    icon: TrendingUp,
    title: 'Live Market Intelligence',
    desc: 'Real-time hiring signals, salary trends, and AI adoption rates — refreshed on every scan with cited sources.',
    proof: 'Search-grounded, not training data',
  },
];

export default function TrustSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-12 md:py-16 overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-20" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-5"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Why Trust Us</span>
          </motion.div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground mb-3">
            Not Another ChatGPT Wrapper.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Numbers = pure math from our deterministic engine. Strategy = AI-assisted, grounded in your data.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {TRUST_PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--gradient-primary)' }}>
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-black text-foreground text-sm mb-1.5">{pillar.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{pillar.desc}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                  <CheckCircle2 className="w-3 h-3" />
                  {pillar.proof}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
