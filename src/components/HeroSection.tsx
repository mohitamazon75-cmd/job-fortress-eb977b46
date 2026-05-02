import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap, Brain, Network, BarChart3, ChevronRight, Users, Link2, Search, TrendingUp, Shield, FileText } from 'lucide-react';
import WhatYouGetSection from '@/components/WhatYouGetSection';
import TrustSection from '@/components/TrustSection';
import SampleReport from '@/components/SampleReport';
import IndustryRiskHeatmap from '@/components/IndustryRiskHeatmap';
import MethodologyModal from '@/components/MethodologyModal';
import { useEffect, useRef, useState, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HeroSectionProps {
  onStart: () => void;
  onStartWithRole?: (role: string) => void;
}

// Glitch text effect
function GlitchText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 z-0 opacity-0"
        style={{ background: 'var(--gradient-threatened)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        animate={{ opacity: [0, 0.5, 0], x: [0, 2, -2, 0] }}
        transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 4 }}
      >
        {children}
      </motion.span>
    </span>
  );
}

// Animated grid background
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.08) 0%, transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 80%, hsl(var(--prophet-red) / 0.04) 0%, transparent 50%)' }} />
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)' }}
        animate={{ top: ['-5%', '105%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0 dot-pattern opacity-20" />
    </div>
  );
}

// Live counter
function LivePulse({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-prophet-green opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-prophet-green" />
      </span>
      <span className="text-xs font-bold text-muted-foreground">
        <span className="text-prophet-green font-black">{count.toLocaleString()}</span> {label}
      </span>
    </div>
  );
}

export default function HeroSection({ onStart, onStartWithRole }: HeroSectionProps) {
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'complete')
      .then(({ count }) => {
        setScanCount(count && count > 0 ? count : null);
      }, () => setScanCount(null));
  }, []);

  return (
    <div className="bg-background">
      <div className="relative min-h-screen overflow-x-hidden">
      <GridBackground />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-20 flex items-center justify-between px-4 sm:px-8 md:px-12 py-4 sm:py-5"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={!window.matchMedia('(prefers-reduced-motion: reduce)').matches ? { rotate: [0, 3, -3, 0] } : {}}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-primary-foreground font-black text-sm"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
          >
            JB
          </motion.div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-black tracking-tight text-foreground leading-none">JOB BACHAO</span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary leading-none mt-0.5">AI Career Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.a
            href="/auth"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-foreground border border-border bg-background/80 min-h-[44px] flex items-center"
          >
            Sign In
          </motion.a>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-primary-foreground min-h-[44px]"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
          >
            Get Started →
          </motion.button>
        </div>
      </motion.nav>

      {/* HERO */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pb-8 sm:pb-16">
        <div className="text-center max-w-5xl mx-auto w-full">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-prophet-red/20 bg-prophet-red/5 mb-6 sm:mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-prophet-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-prophet-red" />
            </span>
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-prophet-red">
              AI is replacing jobs right now
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="text-[2.5rem] sm:text-7xl md:text-8xl lg:text-[8rem] font-black tracking-tighter leading-[0.88] mb-4 sm:mb-6"
          >
            <span className="text-foreground">Are You </span>
            <br className="sm:hidden" />
            <motion.span
              className="inline-block relative"
              style={{ background: 'var(--gradient-threatened)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Next?
              <motion.div
                className="absolute -bottom-2 sm:-bottom-3 left-0 right-0 h-2 sm:h-3 rounded-full opacity-90"
                style={{
                  background: 'var(--gradient-threatened)',
                  WebkitMaskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 8' preserveAspectRatio='none'><path d='M0 4 Q 5 0 10 4 T 20 4 T 30 4 T 40 4' stroke='black' stroke-width='3' fill='none'/></svg>\")",
                  maskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 8' preserveAspectRatio='none'><path d='M0 4 Q 5 0 10 4 T 20 4 T 30 4 T 40 4' stroke='black' stroke-width='3' fill='none'/></svg>\")",
                  WebkitMaskRepeat: 'repeat-x',
                  maskRepeat: 'repeat-x',
                  WebkitMaskSize: '40px 8px',
                  maskSize: '40px 8px',
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              />
            </motion.span>
          </motion.h1>

          {/* Hope line — the shield after the knife. The promise: this is not just a diagnosis. */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg sm:text-2xl md:text-3xl font-black text-primary mb-2 sm:mb-4"
          >
            In 4 minutes — know your risk, and exactly what to fix this Sunday.
          </motion.p>

          {/* Sub — v2 (2026-04-27): tightened from 47-word feature list to a
              benefit-led, friction-killing line. Old copy preserved in git
              history. Funnel will measure the lift via landing_scroll_depth +
              cta_click in /admin/funnel. To revert, restore the previous
              <motion.p> block from git. */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg sm:text-2xl md:text-3xl text-muted-foreground max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed font-medium"
          >
            Get a personalised{' '}
            <span className="text-foreground font-bold">AI risk score</span> in{' '}
            <span className="text-foreground font-bold">4 minutes</span> — based on your real role, skills, and{' '}
            <span className="text-foreground font-bold">India 2026 hiring data</span>.{' '}
            <span className="text-primary font-black">Free. No signup to start.</span>
          </motion.p>

          {/* Role selector — lets users self-identify before scanning */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-6 sm:mb-8"
          >
            <span className="text-xs text-muted-foreground font-medium mr-1">I'm a:</span>
            {['Software Engineer', 'Product Manager', 'Data Analyst', 'Marketing Pro', 'Finance / CA', 'Designer'].map((role) => (
              <button
                key={role}
                onClick={() => onStartWithRole ? onStartWithRole(role) : onStart()}
                className="px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200 text-muted-foreground"
              >
                {role}
              </button>
            ))}
          </motion.div>

          {/* Single CTA — removed dual-CTA confusion (both buttons routed to
              the same flow). Resume upload is offered inside the onboarding
              step, so no need to duplicate it here. */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mb-8 sm:mb-12"
          >
            <div className="flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={onStart}
                className="group relative w-full sm:w-auto px-8 sm:px-14 py-5 sm:py-6 rounded-2xl text-primary-foreground font-black text-base sm:text-xl flex items-center justify-center gap-3 transition-all duration-300"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 16px 60px hsl(var(--primary) / 0.4)' }}
              >
                Show Me My Risk Score
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary) / 0)', '0 0 0 10px hsl(var(--primary) / 0.12)', '0 0 0 0 hsl(var(--primary) / 0)'] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </motion.button>
            </div>

            {/* Friction-killers — 3 explicit objection-removers, replacing the
                old single-line "intelligence cards" feature recap. Per
                mem://style/social-proof-credibility we do NOT claim user counts
                we can't back up — only 5 real scans in last 30d as of today. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-5"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-prophet-green" />
                <span className="text-xs text-muted-foreground"><span className="text-foreground font-bold">No signup</span> until you see your score</span>
              </div>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-prophet-green" />
                <span className="text-xs text-muted-foreground"><span className="text-foreground font-bold">Under 4 minutes</span></span>
              </div>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-prophet-green" />
                <span className="text-xs text-muted-foreground">Methodology from <span className="text-foreground font-bold">WEF, NASSCOM, McKinsey, O*NET, Oxford</span></span>
              </div>
            </motion.div>
          </motion.div>

          {/* Proof numbers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mb-10"
          >
            {[
              { value: '7', label: 'Intelligence Cards', icon: BarChart3, color: 'hsl(var(--primary))' },
              { value: '10+', label: 'Deliverables', icon: Zap, color: 'hsl(var(--prophet-cyan))' },
              { value: '50+', label: 'AI Tools Tracked', icon: Brain, color: 'hsl(var(--prophet-gold))' },
              { value: '< 4 min', label: 'Deep Analysis', icon: Network, color: 'hsl(var(--prophet-green))' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.08 }}
                  className="rounded-xl border border-border bg-card/50 p-3 sm:p-4 text-center hover:border-primary/20 transition-colors"
                >
                  <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: stat.color }} />
                  <p className="text-xl sm:text-2xl font-black text-foreground leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-1">{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Social proof bar */}
          {scanCount !== null && scanCount >= 50 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex items-center justify-center gap-3 mb-10"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">{scanCount.toLocaleString()}{scanCount >= 100 ? '+' : ''} professionals</span>
                <span className="text-xs text-muted-foreground">already analyzed</span>
              </div>
            </motion.div>
          )}

          {/* Research basis — links to /methodology where each source is cited in full.
              We removed MeitY because no MeitY publication is referenced on the methodology
              page; only sources we actually cite are listed here. This strip is descriptive
              ("our risk model reads these reports"), not an endorsement claim. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 mb-8"
          >
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">Research basis</span>
            {[
              { name: 'WEF Future of Jobs Report 2025', label: 'WEF' },
              { name: 'NASSCOM India Tech Workforce 2024', label: 'NASSCOM' },
              { name: 'McKinsey GenAI Impact Report 2024', label: 'McKinsey' },
              { name: 'O*NET Task Database', label: 'O*NET' },
              { name: 'Frey & Osborne, Oxford (2013)', label: 'Oxford' },
              { name: 'LinkedIn Economic Graph', label: 'LinkedIn' },
            ].map(src => (
              <span
                key={src.label}
                title={src.name}
                className="text-[11px] font-bold text-muted-foreground/70 px-2.5 py-1 rounded-full border border-border bg-card/50"
              >
                {src.label}
              </span>
            ))}
            <a
              href="/methodology"
              className="text-[11px] font-bold text-primary hover:text-primary/80 underline underline-offset-2"
            >
              See methodology →
            </a>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            id="how-it-works"
            className="max-w-4xl mx-auto"
          >
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-6">How it works</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {[
                { step: '01', Icon: Link2, title: 'Link Profile', desc: 'Paste LinkedIn or upload your resume', color: 'hsl(var(--primary))' },
                { step: '02', Icon: Brain, title: 'AI Scan', desc: '4-agent intelligence engine analyses your career', color: 'hsl(var(--prophet-cyan))' },
                { step: '03', Icon: BarChart3, title: 'Risk Score', desc: 'Deterministic score + doom clock + skill threat map', color: 'hsl(var(--prophet-gold))' },
                { step: '04', Icon: Shield, title: '7-Card Report', desc: 'Pivot paths, salary data, 90-day mission, pro dashboard', color: 'hsl(var(--prophet-green))' },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 + i * 0.08 }}
                  className="p-3 sm:p-5 rounded-xl border border-border bg-card/50 text-left hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}12` }}>
                      <item.Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <span className="text-[11px] font-mono font-black text-muted-foreground/40">{item.step}</span>
                  </div>
                  <h3 className="font-bold text-foreground text-sm mb-0.5">{item.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Below-fold sections — outside the overflow-hidden hero */}
      <div className="relative z-10">
          <WhatYouGetSection onCTA={onStart} />
          <SampleReport onCTA={onStart} />
          <IndustryRiskHeatmap />
          <TrustSection />

          {/* Differentiator */}
          <div className="relative py-16 md:py-20">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="absolute inset-0 bg-muted/30" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="relative z-10 max-w-4xl mx-auto px-4 md:px-8"
            >
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                    <span className="text-primary-foreground font-black text-2xl">≠</span>
                  </div>
                  <div>
                    <h3 className="font-black text-foreground text-lg md:text-xl mb-2">
                      This is <span className="text-primary">NOT</span> another ChatGPT wrapper.
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Career scores are computed by a <span className="text-foreground font-bold">deterministic engine</span> backed by a <span className="text-foreground font-bold">structured Knowledge Graph</span> — same inputs always produce the same score.
                      Market signals and strategy use <span className="text-foreground font-bold">fine-tuned reasoning models</span> grounded in your actual data, with sources cited.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {['Structured KG', 'Deterministic Scores', 'Cited Market Data', 'AI Strategy'].map(tag => (
                        <span key={tag} className="text-[11px] font-black px-3 py-1 rounded-full border border-primary/15 bg-primary/5 text-primary">{tag}</span>
                      ))}
                    </div>
                    <a href="/methodology" className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
                      How the score is calculated →
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
      </div>

      {/* Bottom bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.6 }}
        className="relative z-10 border-t border-border bg-card/30 py-5 px-4"
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {scanCount !== null && (
              <LivePulse count={scanCount} label="careers analyzed" />
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-primary-foreground min-h-[44px]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Get Started
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
    </div>
  );
}
