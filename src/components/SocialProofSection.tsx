import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Star, TrendingUp, Shield, Zap } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "The skill breakdown was eye-opening. I didn't realize how much of my work could be automated until I saw it mapped against specific AI tools. Changed my upskilling plan completely.",
    name: "Beta Tester #14",
    role: "Product Manager",
    company: "SaaS, Bengaluru",
    score: 68,
    improvement: "Acted on plan",
  },
  {
    quote: "I've used ChatGPT to 'check my career risk' before — this is completely different. The Knowledge Graph scoring felt like an actual diagnostic, not a chatbot guessing.",
    name: "Beta Tester #7",
    role: "Data Analyst",
    company: "Fintech, Mumbai",
    score: 52,
    improvement: "Switched roles",
  },
  {
    quote: "Shared my score card on LinkedIn and 3 colleagues signed up the same day. The salary negotiation script alone was worth it — used it in my next appraisal.",
    name: "Beta Tester #22",
    role: "Engineering Lead",
    company: "IT Services, Hyderabad",
    score: 74,
    improvement: "Got 28% raise",
  },
];

const STATS = [
  { value: '₹10/day', label: 'Less than a coffee — unlimited scans, full defense plan, AI career coach & salary scripts' },
  { value: '95×147', label: 'Job families × skill vectors in the Knowledge Graph — O*NET, ESCO, NASSCOM calibrated' },
  { value: '< 4 min', label: 'We don\'t just ask an AI — we run your profile through 14,000+ skill vectors, a proprietary Knowledge Graph, and 3 reasoning models. That takes a moment. Accuracy takes longer than guessing.' },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4 shadow-sm"
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
          Feedback from early beta testers during closed testing. Identities anonymized per our privacy policy.
        </p>
      </div>
      
      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
