import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVibe } from '@/lib/get-vibe';

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
