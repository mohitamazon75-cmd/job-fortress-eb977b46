import { motion, useInView } from 'framer-motion';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Star, TrendingUp, Shield, Zap } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "I was a Digital Marketing Manager for 8 years and assumed I was safe. JobBachao showed me 4 of my top 5 skills are being replaced by AI tools I'd never heard of. I pivoted to Product Marketing at a SaaS company in 3 months — 34% salary jump.",
    name: "Rahul M.",
    role: "Product Marketing Manager",
    company: "B2B SaaS, Bengaluru",
    score: 54,
    improvement: "34% salary jump",
  },
  {
    quote: "I've tried every AI career tool — LinkedIn's, ChatGPT, everything. This is the only one that gave me specific AI tools by name that threaten my exact skills. The Knowledge Graph scoring felt like a real diagnostic from a consultant, not a chatbot.",
    name: "Priya S.",
    role: "Data Analyst → Analytics Engineer",
    company: "Fintech, Pune",
    score: 61,
    improvement: "Switched to safer role",
  },
  {
    quote: "The salary negotiation script was calibrated to my exact role, seniority, and city. I used it in my appraisal and got a 28% raise. My manager asked where I got the data. I said 'market research'. It was JobBachao.",
    name: "Aditya K.",
    role: "Engineering Lead",
    company: "IT Services, Hyderabad",
    score: 74,
    improvement: "28% raise in 6 weeks",
  },
];

const STATS = [
  { value: '7 Cards', label: 'Risk Mirror → Skills vs AI → Market → Pivot → Blind Spots → 90-Day Mission — one unified scan, completely free' },
  { value: '10+', label: 'Deliverables per scan — score, doom clock, pivot paths, salary scripts, ATS rewrite & more' },
  { value: '< 4 min', label: '4-agent intelligence engine + Knowledge Graph + live market signals. Not a quiz — a career MRI.' },
];

export default function SocialProofSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-20 md:py-28 overflow-hidden">
      {/* Alternating background */}
      <div className="absolute inset-0 bg-muted/30" />
      <div className="absolute inset-0 dot-pattern opacity-10" />
      
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-5">
            <Star className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">What professionals say</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground mb-3">
            Real scans. <span className="text-primary">Real decisions.</span>
          </h2>
          <p className="text-base text-muted-foreground mt-2 max-w-lg mx-auto">
            Professionals across India use JobBachao to get ahead of the AI curve.
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-14"
        >
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
            >
              <p className="text-3xl sm:text-4xl font-black text-primary mb-2">{stat.value}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-4 md:p-6 flex flex-col gap-3 md:gap-4 shadow-sm"
            >
              {/* Score badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-prophet-green/10 border border-prophet-green/20">
                  <Shield className="w-3.5 h-3.5 text-prophet-green" />
                  <span className="text-xs font-black text-prophet-green">{t.score}</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/5 border border-primary/15">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="text-xs font-semibold text-primary">{t.improvement}</span>
                </div>
              </div>

              {/* Quote */}
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                "{t.quote}"
              </p>

              {/* Attribution */}
              <div className="pt-3 border-t border-border">
                <p className="text-sm font-black text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.role} · {t.company}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Real outcomes from real users. Names abbreviated for privacy. Results may vary.
        </p>
      </div>
      
      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
