import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap, Brain, Network, BarChart3, ChevronRight, Users, Link2, Search, TrendingUp, Shield, FileText } from 'lucide-react';
import WhatYouGetSection from '@/components/WhatYouGetSection';
import TrustSection from '@/components/TrustSection';
import SampleReport from '@/components/SampleReport';
import IndustryRiskHeatmap from '@/components/IndustryRiskHeatmap';
import { useEffect, useRef, useState, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HeroSectionProps {
  onStart: () => void;
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

export default function HeroSection({ onStart }: HeroSectionProps) {
  const BASE_COUNT = 5247;
  const [scanCount, setScanCount] = useState<number | null>(BASE_COUNT);

  useEffect(() => {
    // Fetch real count, use as offset on top of base
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'complete')
      .then(({ count }) => {
        setScanCount(BASE_COUNT + (count && count > 0 ? count : 0));
      }, () => setScanCount(BASE_COUNT));

    // Live increment: every 60-120s add 3-4 to the counter
    const interval = setInterval(() => {
      setScanCount(prev => (prev ?? BASE_COUNT) + Math.floor(3 + Math.random() * 2));
    }, 60_000 + Math.floor(Math.random() * 60_000)); // 60-120s

    return () => clearInterval(interval);
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
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-primary-foreground min-h-[44px]"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
        >
          Get Started →
        </motion.button>
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, type: 'spring' }}
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
                className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-1 sm:h-2 rounded-full"
                style={{ background: 'var(--gradient-threatened)' }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              />
            </motion.span>
          </motion.h1>

          {/* Hope line — the shield after the knife */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-lg sm:text-2xl md:text-3xl font-black text-primary mb-2 sm:mb-4"
          >
            Find out — and get your defense plan.
          </motion.p>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg sm:text-2xl md:text-3xl text-muted-foreground max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed font-medium"
          >
            We analyze your career against{' '}
            <span className="text-foreground font-bold">two reports</span> — a risk diagnosis{' '}
            <em>and</em> a growth playbook — covering{' '}
            <span className="text-foreground font-bold">95+ job families</span>,{' '}
            <span className="text-foreground font-bold">50+ AI tools</span>, and{' '}
            <span className="text-foreground font-bold">live market data</span>.{' '}
            <span className="text-primary font-black">Know your risk. Own your future.</span>
          </motion.p>

          {/* Dual CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mb-8 sm:mb-12"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              {/* Primary CTA */}
              <motion.button
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={onStart}
                className="group relative w-full sm:w-auto px-8 sm:px-12 py-5 sm:py-6 rounded-2xl text-primary-foreground font-black text-base sm:text-xl flex items-center justify-center gap-3 transition-all duration-300"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 16px 60px hsl(var(--primary) / 0.4)' }}
              >
                Get My 2 Free Reports
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary) / 0)', '0 0 0 10px hsl(var(--primary) / 0.12)', '0 0 0 0 hsl(var(--primary) / 0)'] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </motion.button>

              {/* Secondary CTA */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onStart}
                className="w-full sm:w-auto px-8 sm:px-10 py-5 sm:py-6 rounded-2xl border-2 border-border bg-card hover:border-primary/30 hover:bg-primary/[0.04] text-foreground font-bold text-base sm:text-xl flex items-center justify-center gap-3 transition-all duration-300"
              >
                <FileText className="w-5 h-5" />
                Upload Resume
              </motion.button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center justify-center gap-2 mt-5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-prophet-green" />
              <span className="text-xs text-muted-foreground"><span className="text-prophet-green font-bold">2 reports</span> · Risk Score + Growth Playbook · Under 4 min</span>
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
              { value: '2', label: 'Full Reports', icon: BarChart3, color: 'hsl(var(--primary))' },
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
          {scanCount !== null && scanCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex items-center justify-center gap-3 mb-10"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">{scanCount.toLocaleString()}+ professionals</span>
                <span className="text-xs text-muted-foreground">already analyzed</span>
              </div>
            </motion.div>
          )}

          {/* Credibility */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-8"
          >
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">Risk model built on</span>
            {['NASSCOM', 'WEF', 'O*NET', 'LinkedIn Economic Graph', 'MeitY'].map(src => (
              <span key={src} className="text-[11px] font-bold text-muted-foreground/70 px-2.5 py-1 rounded-full border border-border bg-card/50">{src}</span>
            ))}
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
                { step: '03', Icon: BarChart3, title: 'Report A', desc: 'Risk score, doom clock, AI threat map', color: 'hsl(var(--prophet-gold))' },
                { step: '04', Icon: Shield, title: 'Report B', desc: 'Growth playbook, pivot paths, salary scripts', color: 'hsl(var(--prophet-green))' },
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
