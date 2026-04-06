import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVibe } from '@/lib/get-vibe';

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
