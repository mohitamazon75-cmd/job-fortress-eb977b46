'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2 } from 'lucide-react';

interface FreeActionCardProps {
  score: number;
  roleName: string;
  moatSkills: string[];
  primaryVulnerability?: string;
  onUpgrade: () => void;
}

interface ScoreTier {
  label: string;
  headline: string;
  body: string;
  labelPill: string;
  color: 'emerald' | 'amber' | 'orange' | 'red';
}

function getScoreTier(score: number): ScoreTier {
  if (score >= 70) {
    return {
      label: 'Reinforce your position',
      headline: 'Deepen your moat before the market shifts.',
      body: "You're in a strong position — but roles like yours are being redefined fast. The professionals who stay irreplaceable in the next 2 years are the ones building skills that sit at the intersection of AI and human judgment. Pick one strategic skill this quarter and go deep.",
      labelPill: 'Safe Zone',
      color: 'emerald',
    };
  }

  if (score >= 50) {
    return {
      label: 'Close the gap',
      headline: "One targeted upskill separates 'valued' from 'irreplaceable'.",
      body: "Analysts who learn to direct AI tools — not just use them — are commanding 18-24% salary premiums in India right now. The gap between your current score and a strong score is usually one well-chosen capability, not a career change.",
      labelPill: 'Stay Sharp',
      color: 'amber',
    };
  }

  if (score >= 30) {
    return {
      label: 'Act in the next 30 days',
      headline: 'Your window to differentiate is now — before the next wave.',
      body: 'Roles at this risk level are being restructured in Indian companies over the next 12-18 months. The professionals who move now — not when it\'s obvious — are the ones who end up on the right side. One domain-specific AI skill, applied to your exact role, changes everything.',
      labelPill: 'Heads Up',
      color: 'orange',
    };
  }

  return {
    label: 'Your first move',
    headline: 'Start with the smallest possible step — today.',
    body: 'The gap between where you are and where you need to be feels large. It isn\'t. The professionals in the highest-risk roles who recovered all started the same way: one skill, applied to one real problem, shared publicly. That\'s it. That\'s the whole formula.',
    labelPill: 'Act Now',
    color: 'red',
  };
}

function getBorderColor(color: string): string {
  const colorMap: Record<string, string> = {
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
  };
  return colorMap[color] || 'border-l-emerald-500';
}

function getLabelColor(color: string): string {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-700',
    amber: 'bg-amber-500/10 text-amber-700',
    orange: 'bg-orange-500/10 text-orange-700',
    red: 'bg-red-500/10 text-red-700',
  };
  return colorMap[color] || 'bg-emerald-500/10 text-emerald-700';
}

function getBlurredStepBg(index: number): string {
  const colors = [
    'bg-slate-500/5',
    'bg-blue-500/5',
    'bg-purple-500/5',
  ];
  return colors[index % colors.length];
}

export default function FreeActionCard({
  score,
  roleName,
  moatSkills,
  primaryVulnerability,
  onUpgrade,
}: FreeActionCardProps) {
  const tier = getScoreTier(score);
  const borderColor = getBorderColor(tier.color);
  const labelColor = getLabelColor(tier.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-4"
    >
      {/* ─────────────────────────────────────────────────────────────────────────
          FREE ACTION SECTION: #1 Move
          ───────────────────────────────────────────────────────────────────────── */}

      <div className={`rounded-2xl border-l-4 ${borderColor} border bg-card p-6 space-y-4`}>
        {/* Label pill */}
        <div className="inline-flex">
          <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${labelColor}`}>
            {tier.labelPill}
          </span>
        </div>

        {/* Headline */}
        <h3 className="text-base font-black text-foreground leading-snug">
          {tier.headline}
        </h3>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tier.body}
        </p>

        {/* Label badge at bottom */}
        <div className="inline-flex items-center gap-2 pt-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {tier.label}
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          PRO TEASE SECTION: Blurred glimpse + CTA
          ───────────────────────────────────────────────────────────────────────── */}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-2xl bg-muted/30 p-6 space-y-4"
      >
        {/* Header */}
        <div className="space-y-2">
          <h4 className="text-sm font-black text-foreground">
            Your complete 90-day defense plan is ready.
          </h4>
        </div>

        {/* Blurred plan steps */}
        <div className="space-y-2">
          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className={`rounded-lg ${getBlurredStepBg(0)} p-3 flex items-center gap-3`}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-black text-muted-foreground">2</span>
            </div>
            <p
              className="text-xs text-muted-foreground flex-1 select-none"
              style={{ filter: 'blur(3px)', opacity: 0.4 }}
            >
              Master one AI tool relevant to your exact role
            </p>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className={`rounded-lg ${getBlurredStepBg(1)} p-3 flex items-center gap-3`}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-black text-muted-foreground">3</span>
            </div>
            <p
              className="text-xs text-muted-foreground flex-1 select-none"
              style={{ filter: 'blur(3px)', opacity: 0.4 }}
            >
              Build one public proof of your new capability
            </p>
          </motion.div>

          {/* Step 4 */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.51 }}
            className={`rounded-lg ${getBlurredStepBg(2)} p-3 flex items-center gap-3`}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-black text-muted-foreground">4</span>
            </div>
            <p
              className="text-xs text-muted-foreground flex-1 select-none"
              style={{ filter: 'blur(3px)', opacity: 0.4 }}
            >
              Position for a role that's harder to automate
            </p>
          </motion.div>
        </div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-[11px] text-muted-foreground italic text-center mb-4"
        >
          Professionals who completed their 90-day plan reported an average 31% confidence increase in their job security.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.58, type: 'spring', damping: 22 }}
          onClick={onUpgrade}
          type="button"
          className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shadow-md hover:shadow-lg"
        >
          <Lock className="w-4 h-4 mr-2" />
          See My Full Plan — ₹300/month
        </motion.button>

        {/* Trust line below button */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[10px] text-muted-foreground text-center"
        >
          Cancel anytime · No commitment
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
