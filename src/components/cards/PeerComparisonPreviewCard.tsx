import React from 'react';
import { motion } from 'framer-motion';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import PeerComparison from '@/components/dashboard/PeerComparison';
import { TrendingUp, Shuffle, Target, Users, Info } from 'lucide-react';

interface PeerComparisonPreviewCardProps {
  report: ScanReport;
}

export default function PeerComparisonPreviewCard({ report }: PeerComparisonPreviewCardProps) {
  const careerPositionScore = computeStabilityScore(report);
  const peerPercentile = Math.min(95, Math.max(5, Math.round(((careerPositionScore - 5) / 90) * 100)));
  const di = report.determinism_index ?? null;
  const role = report.role || 'Professional';
  const industry = report.industry || 'Technology';
  const moatSkills = report.moat_skills || [];
  const pivotRole = report.pivot_roles?.[0]?.role
    ?? report.pivot_roles?.[0]?.title
    ?? report.arbitrage_role
    ?? null;

  // "Strong" profile benchmark — industry-aware heuristic
  const strongDI = di !== null ? Math.max(15, di - 20) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      {/* Main peer position chart */}
      <PeerComparison
        careerRisk={di || 50}
        role={role}
        industry={industry}
        survivabilityScore={careerPositionScore}
        peerPercentile={peerPercentile}
      />

      {/* Detailed stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Career Position Score */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Career Score</p>
          </div>
          <p className={`text-2xl font-black ${careerPositionScore >= 60 ? 'text-prophet-green' : careerPositionScore >= 40 ? 'text-prophet-gold' : 'text-destructive'}`}>
            {careerPositionScore}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {careerPositionScore >= 70 ? 'Strong position' : careerPositionScore >= 50 ? 'Moderate — room to improve' : 'Needs attention'}
          </p>
        </motion.div>

        {/* AI Exposure */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-prophet-gold" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Exposure</p>
          </div>
          {di !== null ? (
            <>
              <p className={`text-2xl font-black ${di <= 30 ? 'text-prophet-green' : di <= 60 ? 'text-prophet-gold' : 'text-destructive'}`}>
                {di}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {strongDI !== null ? `Strong ${role}s: ~${strongDI}%` : ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">
              Not enough data for your profile
            </p>
          )}
        </motion.div>

        {/* Moat Strength */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-prophet-green" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Human Moats</p>
          </div>
          {moatSkills.length > 0 ? (
            <>
              <p className="text-2xl font-black text-prophet-green">{moatSkills.length}</p>
              <p className="text-[10px] text-muted-foreground truncate" title={moatSkills.slice(0, 2).join(', ')}>
                {moatSkills.slice(0, 2).join(', ')}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">
              No strong moats detected yet
            </p>
          )}
        </motion.div>

        {/* Top Pivot */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Top Pivot</p>
          </div>
          {pivotRole ? (
            <>
              <p className="text-sm font-black text-foreground leading-snug">{pivotRole}</p>
              <p className="text-[10px] text-muted-foreground">Most common for your cohort</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">
              Cohort data builds as more {role}s scan
            </p>
          )}
        </motion.div>
      </div>

      {/* Data source note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
        <Info className="w-3 h-3" />
        <span>Based on your scan data · cohort insights build over time</span>
      </motion.div>
    </motion.div>
  );
}
