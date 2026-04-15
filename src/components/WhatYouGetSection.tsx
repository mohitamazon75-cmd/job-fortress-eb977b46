import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Shield, TrendingUp, Brain, Swords, Target, Briefcase, FileText, Zap, ArrowRight, BarChart3, Radar, BookOpen, MessageSquare } from 'lucide-react';

const REPORT_A = [
  {
    icon: Target,
    title: 'Career Safety Score',
    desc: 'Your deterministic risk score — computed by our Knowledge Graph, not guessed by an LLM.',
  },
  {
    icon: Shield,
    title: 'Skill Gap Analysis',
    desc: 'Every skill mapped against AI replacement risk, with specific tools threatening each one.',
  },
  {
    icon: TrendingUp,
    title: 'Doom Clock',
    desc: 'Months until significant displacement risk — based on AI adoption curves in your industry.',
  },
  {
    icon: Brain,
    title: 'AI Impact Dossier',
    desc: '5-factor breakdown: Automation Risk, Market Demand, Moat Strength, Supply Pressure, Career Capital.',
  },
];

const REPORT_B = [
  {
    icon: Radar,
    title: 'Market Radar',
    desc: 'Live salary benchmarks for your role + city, with negotiation scripts you can use today.',
  },
  {
    icon: Swords,
    title: 'Career Pivot Paths',
    desc: 'Quantified lateral moves showing salary delta, skill transfer %, and growth trajectory.',
  },
  {
    icon: Briefcase,
    title: 'Best-Fit Jobs',
    desc: 'AI-matched roles where your existing skills give you an unfair advantage — with live postings.',
  },
  {
    icon: FileText,
    title: 'Resume Weaponizer',
    desc: 'ATS-optimized rewrite highlighting AI-resistant skills that make you irreplaceable.',
  },
  {
    icon: BookOpen,
    title: '90-Day Defense Plan',
    desc: 'Week-by-week action plan with exact courses, certifications, and moves to make.',
  },
  {
    icon: MessageSquare,
    title: 'AI Career Coach',
    desc: 'Ask follow-up questions about your results — powered by your actual scan data, not generic advice.',
  },
];

interface WhatYouGetSectionProps {
  onCTA?: () => void;
}

export default function WhatYouGetSection({ onCTA }: WhatYouGetSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 dot-pattern opacity-10" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Two Reports. One Scan.</span>
          </motion.div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground mb-5">
            Not Just a Score.{' '}
            <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              A Complete Arsenal.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every scan delivers a <span className="text-foreground font-bold">7-card intelligence report</span> — 
            risk diagnosis, skill threats, pivot paths, and a 90-day mission. Not generic LinkedIn advice.{' '}
            <span className="text-foreground font-bold">Actionable intelligence you can use today.</span>
          </p>
        </motion.div>

        {/* Report A */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-destructive/10 border border-destructive/20">
              <BarChart3 className="w-4.5 h-4.5 text-destructive" />
            </div>
            <div>
              <h3 className="font-black text-foreground text-base">Cards 1–4 — Risk Diagnosis</h3>
              <p className="text-xs text-muted-foreground">How vulnerable are you? The honest, deterministic answer.</p>
            </div>
            <span className="ml-auto text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              Free
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {REPORT_A.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="group p-5 rounded-xl border border-border bg-card hover:border-destructive/20 hover:shadow-md transition-all duration-300"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-destructive/8">
                    <Icon className="w-4 h-4 text-destructive" />
                  </div>
                  <h4 className="font-black text-foreground text-sm mb-1.5">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Connector */}
        <div className="flex items-center justify-center py-4">
          <div className="w-px h-8 bg-gradient-to-b from-destructive/30 to-primary/30" />
        </div>

        {/* Report B */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <TrendingUp className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-black text-foreground text-base">Cards 5–7 — Growth Playbook</h3>
              <p className="text-xs text-muted-foreground">Your pivot path, blind spots, and 90-day mission.</p>
            </div>
            <span className="ml-auto text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Included
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_B.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.45 + i * 0.06 }}
                  className="group p-5 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-md transition-all duration-300"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--gradient-primary)' }}>
                    <Icon className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h4 className="font-black text-foreground text-sm mb-1.5">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        {onCTA && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-5">
              <span className="text-foreground font-bold">10 deliverables.</span> Two views. One scan. Under 4 minutes.
            </p>
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCTA}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-primary-foreground font-black text-lg"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 10px 40px hsl(var(--primary) / 0.3)' }}
            >
              Get Both Reports Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
