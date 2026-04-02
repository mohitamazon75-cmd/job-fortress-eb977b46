import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVerbatimRole } from '@/lib/role-guard';

type Vibe = { emoji: string; label: string; color: string; bg: string; border: string; headline: string; body: string; bullets: string[] };

function getVibe(score: number, report: ScanReport): Vibe {
  const moatSkills = (report.moat_skills || []).length;
  const demandTrend = report.market_position_model?.demand_trend ?? 'Stable';
  const automationRisk = report.automation_risk ?? report.determinism_index;
  const roleName = getVerbatimRole(report);

  if (score >= 70) return {
    emoji: '🛡️', label: 'Looking Good', color: 'text-prophet-green', bg: 'bg-prophet-green/[0.06]', border: 'border-prophet-green/20',
    headline: 'Your job is in a solid spot — for now.',
    body: `Here's the good news: ${roleName} roles still need a real human in the seat. You've got ${moatSkills > 0 ? moatSkills + ' skills that are genuinely hard to automate' : 'work that requires real judgment'}, and companies are still actively hiring for this. That said, "stable" doesn't mean "forever" — the market moves fast.`,
    bullets: [
      `Hiring for ${roleName} is ${demandTrend.toLowerCase()} — that's working in your favor right now`,
      `Only ~${automationRisk != null ? Math.round(automationRisk) + '% of' : 'some of'} your day-to-day overlaps with what AI tools can handle`,
      moatSkills >= 3 ? `You have ${moatSkills} skills that are genuinely hard to replace with a tool or a cheaper hire` : 'Building 1-2 more "only-I-can-do-this" skills would make you even harder to replace',
    ],
  };
  if (score >= 50) return {
    emoji: '⚡', label: 'Stay Sharp', color: 'text-primary', bg: 'bg-primary/[0.06]', border: 'border-primary/20',
    headline: 'Not bad — but don\'t get too comfortable.',
    body: `Your position is decent, but let's be real: ${roleName} roles are starting to feel some pressure. ${automationRisk != null ? `About ${Math.round(automationRisk)}% of your typical tasks could be handled by AI tools today.` : 'Some of your typical tasks could be handled by AI tools today.'} That doesn't mean you're getting replaced tomorrow, but it does mean the bar for "valuable" is rising.`,
    bullets: [
      `Market demand is ${demandTrend.toLowerCase()} — not terrible, but not a seller's market either`,
      moatSkills > 0 ? `You have ${moatSkills} defensible skills — double down on these, they're your insurance` : 'You need to develop skills that are harder to replicate — that\'s your biggest gap right now',
      `The parts of your work that are routine? AI is coming for those first. Focus on the messy, human-judgment stuff`,
    ],
  };
  if (score >= 30) return {
    emoji: '🔥', label: 'Heads Up', color: 'text-prophet-gold', bg: 'bg-prophet-gold/[0.06]', border: 'border-prophet-gold/20',
    headline: 'Real talk — your role is more exposed than most.',
    body: `This isn't about fear — it's about math. ${automationRisk != null ? `Around ${Math.round(automationRisk)}% of ${roleName} tasks are the kind AI tools are getting good at.` : `Many ${roleName} tasks are the kind AI tools are getting good at.`} Hiring demand is ${demandTrend.toLowerCase()}, which means more competition for fewer seats. The people who'll survive this shift are the ones who start moving now, not later.`,
    bullets: [
      `A big chunk of your daily work follows patterns that AI can learn — that's the core risk`,
      moatSkills > 0 ? `You have ${moatSkills} skills keeping you differentiated — but that's a thin margin` : 'Right now, it\'s hard to point to something that makes you irreplaceable — that needs to change',
      'This weekend, pick ONE skill that requires human creativity or relationships, and go deep on it',
    ],
  };
  return {
    emoji: '🚨', label: 'Act Now', color: 'text-destructive', bg: 'bg-destructive/[0.06]', border: 'border-destructive/20',
    headline: 'We\'re not going to sugarcoat this.',
    body: `${roleName} roles are in a tough spot. Most of the day-to-day work maps directly onto what AI tools already do well, there's a lot of talent available, and companies are starting to notice they can do more with less. This doesn't mean you're done — but it means you need to move with urgency.`,
    bullets: [
      `${automationRisk != null ? `~${Math.round(automationRisk)}% of your tasks overlap with AI capabilities — that's one of the highest we see` : 'A large portion of your tasks overlap with AI capabilities'}`,
      'Talent supply is high, which means you\'re competing with more people AND machines',
      'The move: find a niche where your human judgment actually matters, and make it your whole identity',
    ],
  };
}

export default function JobDangerMeterCard({ report }: { report: ScanReport }) {
  const score = computeStabilityScore(report);
  const vibe = getVibe(score, report);

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 24 }}
      className={`rounded-2xl border-2 ${vibe.border} ${vibe.bg} p-5`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{vibe.emoji}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Job Stability
          </span>
        </div>
        <span className={`text-xs font-black uppercase tracking-wider ${vibe.color}`}>
          {vibe.label}
        </span>
      </div>

      <div className="text-center mb-3">
        <p className={`text-6xl font-black ${vibe.color} leading-none tabular-nums`}>
          {score}
          <span className="text-lg text-muted-foreground font-bold">/100</span>
        </p>
      </div>

      <p className="text-sm font-bold text-foreground text-center mb-2">
        {vibe.headline}
      </p>

      <p className="text-xs text-foreground/70 leading-relaxed text-center mb-4">
        {vibe.body}
      </p>

      <div className="space-y-2.5">
        {vibe.bullets.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="flex items-start gap-2.5"
          >
            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
              vibe.color.replace('text-', 'bg-')
            }`} />
            <span className="text-xs text-foreground/80 leading-relaxed">{b}</span>
          </motion.div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/50 text-center mt-5 italic">
        Based on market data, role patterns & automation research — not a personal prediction
      </p>
    </motion.div>
  );
}
