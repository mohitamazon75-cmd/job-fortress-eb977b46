import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Shield, TrendingUp, Brain, Swords, Target, Briefcase, FileText, Zap, ArrowRight } from 'lucide-react';

const DELIVERABLES = [
  {
    icon: Shield,
    title: 'Defense Plan',
    desc: 'A 90-day action plan with exact skills to build, courses to take, and moves to make — personalized to your role.',
    tag: 'Core',
  },
  {
    icon: Target,
    title: 'Skill Gap Analysis',
    desc: 'Every skill you have mapped against AI replacement risk, with specific tools threatening each one.',
    tag: 'Core',
  },
  {
    icon: TrendingUp,
    title: 'Salary Negotiation Scripts',
    desc: 'Market salary benchmarks for your role + city, with copy-paste negotiation scripts and tactical leverage points.',
    tag: 'Core',
  },
  {
    icon: Swords,
    title: 'Career Pivot Options',
    desc: 'Quantified pivot paths showing salary impact, skill transfer %, and market demand for alternative roles.',
    tag: 'Deep',
  },
  {
    icon: Briefcase,
    title: 'Best-Fit Jobs',
    desc: 'AI-matched roles where your existing skills give you an unfair advantage — with hiring trend data.',
    tag: 'Deep',
  },
  {
    icon: FileText,
    title: 'Resume Weaponizer',
    desc: 'Your resume rewritten to highlight AI-resistant skills and position you as irreplaceable.',
    tag: 'Deep',
  },
];

interface WhatYouGetSectionProps {
  onCTA?: () => void;
}

export default function WhatYouGetSection({ onCTA }: WhatYouGetSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-14 md:py-20 overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-20" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-5"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">What You Get</span>
          </motion.div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground mb-4">
            Not Just a Score.{' '}
            <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              A Complete Playbook.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every analysis delivers actionable intelligence you can use <span className="text-foreground font-bold">today</span> — 
            not generic advice you've already seen on LinkedIn.
          </p>
        </motion.div>

        {/* Deliverables Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DELIVERABLES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="group relative p-5 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                    <Icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-foreground text-sm">{item.title}</h3>
                      <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.tag === 'Core' 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>{item.tag}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        {onCTA && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.7 }}
            className="text-center mt-10"
          >
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCTA}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-primary-foreground font-bold text-base"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 10px 40px hsl(var(--primary) / 0.3)' }}
            >
              Get Your Career Playbook
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
