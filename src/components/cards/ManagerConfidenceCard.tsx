import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';
import { computeStabilityScore } from '@/lib/stability-score';

// ═══════════════════════════════════════════════════════════════
// REPLACEABILITY CARD
// Uses the SAME stability score as Job Stability card (single
// source of truth) but reframes it through a replaceability lens.
// If stability = 74, replaceability MUST agree: hard to replace.
// ═══════════════════════════════════════════════════════════════

type Vibe = { emoji: string; label: string; color: string; bg: string; border: string; headline: string; body: string; bullets: string[] };

function getVibe(score: number, report: ScanReport): Vibe {
  const tier = inferSeniorityTier(report.seniority_tier);
  const tierLabel = tier.replace('_', ' ').toLowerCase();
  const moatSkills = (report.moat_skills || []).length;
  const strategicSkills = (report.strategic_skills || report.moat_skills || []).length;
  const talentDensity = report.market_position_model?.talent_density ?? 'moderate';
  const automatableRatio = report.automatable_task_ratio;
  const roleName = report.role_detected || 'your role';

  if (score >= 70) return {
    emoji: '👑', label: 'Hard to Replace', color: 'text-prophet-green', bg: 'bg-prophet-green/[0.06]', border: 'border-prophet-green/20',
    headline: 'If you left tomorrow, they\'d feel it.',
    body: `People in ${roleName} roles with your profile are genuinely hard to find. ${talentDensity === 'scarce' ? 'The talent pool is thin — that\'s real leverage.' : 'Your skill combination creates meaningful switching costs.'} Replacing you isn't just posting a job ad — it's months of knowledge transfer, relationship rebuilding, and institutional memory that walks out the door.`,
    bullets: [
      strategicSkills > 0 ? `${strategicSkills} of your skills require real human judgment — no AI or junior hire shortcuts` : 'Your work requires contextual judgment that\'s hard to hand off',
      talentDensity === 'scarce' ? 'Recruiters would genuinely struggle to find your replacement' : 'Your expertise mix is uncommon enough to make hiring a real challenge',
      `As a ${tierLabel}, you carry institutional knowledge that doesn't live in any document`,
    ],
  };
  if (score >= 50) return {
    emoji: '💪', label: 'Solid Position', color: 'text-primary', bg: 'bg-primary/[0.06]', border: 'border-primary/20',
    headline: 'You\'re valued — but not untouchable.',
    body: `You bring real value, and a good manager knows that. But here's the honest part: ${roleName} roles have ${talentDensity === 'abundant' ? 'a decent-sized talent pool out there' : 'a growing number of capable candidates'}. The gap between "valued employee" and "irreplaceable asset" is usually just 1-2 skills that nobody else on the team has.`,
    bullets: [
      moatSkills >= 2 ? `Your ${moatSkills} moat skills create a barrier — but it's not a wall yet. Keep building` : 'Your biggest opportunity: develop a skill that\'s genuinely difficult to hire for',
      automatableRatio === 'LOW' ? 'Your work is judgment-heavy — that\'s a natural defense against replacement' : 'Some parts of your role could be systematized — focus on the parts that can\'t',
      'The work that requires YOUR judgment? That\'s your job security. Make sure leadership sees it',
    ],
  };
  if (score >= 30) return {
    emoji: '😬', label: 'Exposed', color: 'text-prophet-gold', bg: 'bg-prophet-gold/[0.06]', border: 'border-prophet-gold/20',
    headline: 'Honestly? This role could be backfilled faster than you\'d like.',
    body: `This isn't personal — it's structural. ${roleName} roles with this skill profile are ${talentDensity === 'abundant' ? 'not that hard to hire for right now' : 'becoming easier to source'}. ${automatableRatio === 'HIGH' ? 'A lot of the daily work follows repeatable patterns, which is exactly what makes roles vulnerable.' : 'The standardized parts of your work are growing.'} The market sees the role, not the person — and on paper, this role is replaceable.`,
    bullets: [
      talentDensity === 'abundant' ? 'There are enough qualified candidates that replacing you wouldn\'t be a crisis' : 'The talent pool is growing — your differentiation is shrinking',
      automatableRatio === 'HIGH' ? 'Too much of your day follows a template — that\'s the #1 thing to fix' : 'Some tasks are commoditized — figure out which ones and evolve past them',
      'Pick one area where human judgment is everything, and become the go-to person for it',
    ],
  };
  return {
    emoji: '😰', label: 'Highly Replaceable', color: 'text-destructive', bg: 'bg-destructive/[0.06]', border: 'border-destructive/20',
    headline: 'Straight talk: this seat could be filled quickly.',
    body: `The numbers are clear. ${roleName} roles with this profile sit in a tough spot — high talent supply, standardized tasks, and ${moatSkills < 2 ? 'very few skills creating a real barrier' : 'a thin moat that others are catching up to'}. Companies are figuring out they can restructure around roles like this. The good news? Knowing this now puts you ahead of everyone who doesn't.`,
    bullets: [
      'High talent availability + routine tasks = a role that\'s structurally easy to fill',
      'On paper, not enough separates you from the next candidate — yet',
      'Start this week: identify one thing only YOU can do, and make it visible to decision-makers',
    ],
  };
}

export default function ManagerConfidenceCard({ report }: { report: ScanReport }) {
  // SAME score as Job Stability card — single source of truth
  const score = computeStabilityScore(report);
  const vibe = getVibe(score, report);
  const pos = Math.max(8, Math.min(92, score));

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 24 }}
      className={`rounded-2xl border-2 ${vibe.border} ${vibe.bg} p-5`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{vibe.emoji}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Replaceability
          </span>
        </div>
        <span className={`text-xs font-black uppercase tracking-wider ${vibe.color}`}>
          {vibe.label}
        </span>
      </div>

      {/* Replaceability slider */}
      <div className="mb-4">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-destructive/50 via-prophet-gold/50 to-prophet-green/50 overflow-visible">
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: `${pos}%` }}
            transition={{ duration: 0.8, type: 'spring', damping: 20 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-foreground border-3 border-background shadow-lg flex items-center justify-center"
          >
            <span className="text-[10px] font-black text-background tabular-nums">{score}</span>
          </motion.div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-destructive font-bold">Easy to replace</span>
          <span className="text-[11px] text-prophet-green font-bold">Hard to replace</span>
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm font-bold text-foreground text-center mb-2">
        {vibe.headline}
      </p>

      {/* Body */}
      <p className="text-xs text-foreground/80 leading-relaxed text-center mb-4">
        {vibe.body}
      </p>

      {/* Bullets */}
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
            <span className="text-[13px] text-foreground leading-relaxed">{b}</span>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground/50 text-center mt-5 italic">
        Based on role patterns, talent supply & market data — not your manager's actual opinion
      </p>
    </motion.div>
  );
}
