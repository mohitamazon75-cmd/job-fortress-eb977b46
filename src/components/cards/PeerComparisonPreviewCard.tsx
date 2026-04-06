import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import PeerComparison from '@/components/dashboard/PeerComparison';

interface PeerComparisonPreviewCardProps {
  report: ScanReport;
}

export default function PeerComparisonPreviewCard({ report }: PeerComparisonPreviewCardProps) {
  const careerPositionScore = computeStabilityScore(report);
  // Derive peer percentile from Career Position Score for consistency
  const peerPercentile = Math.min(95, Math.max(5, Math.round(((careerPositionScore - 5) / 90) * 100)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      <PeerComparison
        careerRisk={report.determinism_index || 50}
        role={report.role || 'Professional'}
        industry={report.industry || 'Technology'}
        survivabilityScore={careerPositionScore}
        peerPercentile={peerPercentile}
        preview={true}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4"
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          See how your AI exposure compares to peers in your role and industry.
          Upgrade to Pro to unlock detailed percentile rankings and survival probabilities.
        </p>
      </motion.div>
    </motion.div>
  );
}
