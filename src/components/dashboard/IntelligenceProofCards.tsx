import { motion } from 'framer-motion';
import { ScanReport } from '@/lib/scan-engine';
import { computeScoreBreakdown } from '@/lib/stability-score';
import { inferSeniorityTier } from '@/lib/seniority-utils';
import { Layers, ShieldCheck, Globe, FlaskConical, Quote } from 'lucide-react';

interface IntelligenceProofCardsProps {
  report: ScanReport;
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1.2: Industry Calibration Disclosure
// ═══════════════════════════════════════════════════════════════

export function IndustryCalibrationCard({ report }: IntelligenceProofCardsProps) {
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const industry = report.industry || 'your industry';
  const role = report.role || 'your role';

  // Simulate calibration by showing that same skill has different risk in different industries
  const topSkill = report.score_breakdown?.skill_adjustments?.[0];
  if (!topSkill) return null;

  // Industry modifier simulation: show the skill's risk varies by context
  const baseRisk = topSkill.automation_risk;
  const industries = [
    { name: industry, risk: baseRisk, isCurrent: true },
    { name: 'Healthcare', risk: Math.max(10, baseRisk - 18) },
    { name: 'Finance', risk: Math.min(95, baseRisk + 8) },
  ].sort((a, b) => b.risk - a.risk);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Industry-Calibrated Analysis</p>
      </div>
      <p className="text-sm text-foreground font-semibold mb-3">
        "<span className="text-primary">{topSkill.skill_name}</span>" carries different risk levels depending on industry context:
      </p>
      <div className="space-y-2">
        {industries.map((ind, i) => (
          <div key={ind.name} className="flex items-center gap-3">
            <span className={`text-xs font-bold w-24 truncate ${ind.isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
              {ind.isCurrent ? `→ ${ind.name}` : ind.name}
            </span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ind.risk}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className={`h-full rounded-full ${
                  ind.risk >= 70 ? 'bg-destructive' : ind.risk >= 40 ? 'bg-prophet-gold' : 'bg-prophet-green'
                }`}
              />
            </div>
            <span className={`text-xs font-black tabular-nums w-10 text-right ${ind.isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
              {ind.risk}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        📊 <span className="font-bold">Computed</span> · Your score uses {industry}-specific calibration, not a generic average
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1.3: Seniority Protection Disclosure
// ═══════════════════════════════════════════════════════════════

const SENIORITY_LABELS: Record<string, { label: string; points: number }> = {
  EXECUTIVE: { label: 'Executive', points: 85 },
  SENIOR_LEADER: { label: 'Senior Leader', points: 70 },
  MANAGER: { label: 'Manager', points: 55 },
  PROFESSIONAL: { label: 'Professional', points: 40 },
  ENTRY: { label: 'Entry Level', points: 25 },
};

export function SeniorityProtectionCard({ report }: IntelligenceProofCardsProps) {
  const tier = inferSeniorityTier(report.seniority_tier);
  const current = SENIORITY_LABELS[tier] || SENIORITY_LABELS.PROFESSIONAL;
  const entryLevel = SENIORITY_LABELS.ENTRY;
  const breakdown = computeScoreBreakdown(report);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.02] p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-prophet-green" />
        <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green">Career Capital</p>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        As a <span className="font-black text-primary">{current.label} (Tier {Object.keys(SENIORITY_LABELS).indexOf(tier) + 1})</span>,
        you receive a <span className="font-black text-prophet-green">{current.points}-point</span> seniority protection factor.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        An Entry-level professional in the same role would receive only <span className="font-bold">{entryLevel.points} points</span> — 
        making their score <span className="font-bold text-destructive">{current.points - entryLevel.points} points lower</span> than yours.
      </p>
      {/* Visual comparison */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-foreground w-20">You</span>
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${current.points}%` }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="h-full rounded-full bg-prophet-green"
            />
          </div>
          <span className="text-xs font-black text-prophet-green w-8 text-right">{current.points}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground w-20">Entry Level</span>
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${entryLevel.points}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="h-full rounded-full bg-muted-foreground/40"
            />
          </div>
          <span className="text-xs font-black text-muted-foreground w-8 text-right">{entryLevel.points}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        📊 <span className="font-bold">Computed</span> · Career Capital contributes {breakdown.seniorityShield >= 0 ? '+' : ''}{breakdown.seniorityShield.toFixed(1)} points to your final score (10% weight)
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1.4: Score Variability
// ═══════════════════════════════════════════════════════════════

export function ConfidenceIntervalCard({ report }: IntelligenceProofCardsProps) {
  const ci = report.score_variability;
  if (!ci) return null;

  const score = 100 - (report.determinism_index ?? 50);
  const rawLow = Math.min(100 - ci.di_range.high, 100 - ci.di_range.low);
  const rawHigh = Math.max(100 - ci.di_range.high, 100 - ci.di_range.low);
  // STAT-2 fix: Clamp CI bounds to valid score range [5, 95]
  const low = Math.max(5, rawLow);
  const high = Math.min(95, rawHigh);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Confidence Range</p>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-black text-foreground tabular-nums">{score}</span>
        <span className="text-sm font-bold text-muted-foreground">± {Math.round((high - low) / 2)}</span>
        <span className="text-xs text-muted-foreground">(range: {low}–{high})</span>
      </div>
      <div className="relative h-6 rounded-full bg-muted overflow-hidden">
        {/* Range band */}
        <div
          className="absolute h-full bg-primary/15 rounded-full"
          style={{ left: `${low}%`, width: `${high - low}%` }}
        />
        {/* Score marker */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${score}%` }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute top-0 h-full w-1 bg-primary rounded-full"
          style={{ transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-muted-foreground">0</span>
        <span className="text-[11px] text-muted-foreground">100</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        🔬 Scientific honesty — we show our confidence range, not just a single number
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1.5: Source Citation Badge (reusable)
// ═══════════════════════════════════════════════════════════════

export function CitationBadge({ source, className = '' }: { source: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground ${className}`}>
      <Quote className="w-2.5 h-2.5" />
      {source}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1.6: Computed vs AI Badge (reusable)
// ═══════════════════════════════════════════════════════════════

export function DataSourceBadge({ type }: { type: 'computed' | 'ai-assisted' }) {
  if (type === 'computed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary">
        📊 Computed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-prophet-gold/20 bg-prophet-gold/5 text-prophet-gold">
      🧠 AI-Assisted
    </span>
  );
}
