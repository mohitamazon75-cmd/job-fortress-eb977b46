import { motion } from 'framer-motion';
import { Shield, Brain, Database, Globe, BarChart3, Zap, ChevronRight } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

function getSteps(report: ScanReport) {
  const kgMatched = report.computation_method?.kg_skills_matched ?? 0;
  const toolsTracked = (report.ai_tools_replacing || []).length;
  const detIdx = (report.computation_method as any)?.determinism_index;
  const moatCount = report.moat_skills?.length ?? 0;
  return [
    { icon: Database, label: 'Knowledge Graph Match', desc: kgMatched > 0 ? `Matched ${kgMatched} of your skills against 2,400+ role-skill entries` : 'Your role was matched against 2,400+ role-skill entries — fewer direct matches widen uncertainty ranges', color: 'text-prophet-cyan', detail: 'ISCO-08 taxonomy · O*NET cross-ref' },
    { icon: Brain, label: 'AI Overlap Analysis', desc: toolsTracked > 0 ? `Compared your tasks against ${toolsTracked} AI tools currently tracked` : 'Compared each skill to current AI tool capabilities — no direct tool matches found for this role profile', color: 'text-prophet-gold', detail: 'Multi-model ensemble · 120+ tools tracked' },
    // Credibility: "Live" implies real-time; this data is from scan time, not a live feed.
    { icon: Globe, label: 'Fresh Market Scan', desc: 'Pulled hiring signals, salary trends & demand data from 6 sources at scan time', color: 'text-prophet-green', detail: 'Naukri · LinkedIn · Indeed · Glassdoor signals' },
    { icon: BarChart3, label: 'Score Computation', desc: `Computed Career Position Score across 5 weighted factors${detIdx ? ` (DI: ${detIdx})` : ''}`, color: 'text-primary', detail: 'Role risk · skill moats · market demand · AI overlap · seniority' },
    { icon: Shield, label: 'Defense Modelling', desc: moatCount > 0 ? `Found ${moatCount} defensible moat skills in your profile` : 'Identified your strongest moats and blind spots', color: 'text-prophet-green', detail: 'Judo strategy · augmentation paths · pivot options' },
  ];
}

interface Props {
  report: ScanReport;
  onGoDeeper: () => void;
}

export default function DeepAnalysisGateCard({ report, onGoDeeper }: Props) {
  const score = computeStabilityScore(report);
  const skillsAnalyzed = report.score_breakdown?.skill_adjustments?.length ?? 0;
  const kgMatched = report.computation_method?.kg_skills_matched ?? 0;
  const toolsTracked = (report.ai_tools_replacing || []).length;
  const steps = getSteps(report);

  return (
    <div className="space-y-5">
      {/* Trust header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Analysis Complete</p>
        </div>
        <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed mb-1">
          We analyzed {skillsAnalyzed > 0 ? `${skillsAnalyzed} skill vectors` : 'your full profile'} across 5 scoring dimensions.
        </p>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {kgMatched > 0
            ? `${kgMatched} of your skills were matched in our Knowledge Graph and cross-referenced with ${toolsTracked > 0 ? `${toolsTracked} AI tools` : 'current AI capabilities'}.`
            : `Your skills were compared against current AI tool capabilities and benchmarked with market data. Fewer direct KG matches mean wider confidence intervals in the score.`
          }
        </p>
      </motion.div>

      {/* What we ran */}
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border/50 p-3.5"
          >
            <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-background border border-border/60`}>
              <step.icon className={`w-4 h-4 ${step.color}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{step.detail}</p>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1, type: 'spring', damping: 12 }}
              className="ml-auto flex-shrink-0 mt-1"
            >
              <span className="text-[10px] font-black text-prophet-green bg-prophet-green/10 px-2 py-0.5 rounded-full">✓ Done</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Confidence statement */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="rounded-xl bg-foreground/[0.03] border border-border/50 p-4 text-center"
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          This isn't a quiz result — it's built on structured data from hiring platforms, 
          AI capability research, and real role taxonomies. Your score of <span className="font-black text-foreground">{score}/100</span> reflects 
          where you actually stand today.
        </p>
      </motion.div>

      {/* Deep dive CTA */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        whileTap={{ scale: 0.97 }}
        onClick={onGoDeeper}
        className="w-full py-4 rounded-xl border-2 border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all group"
      >
        <p className="text-sm font-black text-primary tracking-wide">
          Want the full deep-dive? <ChevronRight className="inline w-4 h-4 transition-transform group-hover:translate-x-1" />
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Intelligence map · AI timeline · resume rewrite · career pivots & more
        </p>
      </motion.button>
    </div>
  );
}
