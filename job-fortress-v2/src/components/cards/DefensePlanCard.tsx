import { motion } from 'framer-motion';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { Target, Clock, Flame, GraduationCap, TrendingUp, Swords } from 'lucide-react';
import { computeStabilityScore } from '@/lib/stability-score';
import DataProvenance from '@/components/cards/DataProvenance';

interface DefensePlanCardProps {
  report: ScanReport;
}

export default function DefensePlanCard({ report }: DefensePlanCardProps) {
  const score = computeStabilityScore(report);
  const immediateStep = report.immediate_next_step;
  const judoStrategy = report.judo_strategy;
  const moatSkills = report.moat_skills || [];
  const skillGaps = report.score_breakdown?.skill_adjustments?.filter(s => s.automation_risk >= 50).slice(0, 3) || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const kgMatched = report.computation_method?.kg_skills_matched ?? (report.score_breakdown?.skill_adjustments?.length || 0);
  const marketModel = report.market_position_model;

  // Build 90-day path
  const milestones = [
    {
      phase: 'Week 1-2',
      icon: <Flame className="w-4 h-4" />,
      action: immediateStep?.action || judoStrategy?.recommended_tool
        ? `Learn ${judoStrategy?.recommended_tool || 'the key AI tool for your role'}`
        : `Master one AI tool that complements your ${moatSkills[0] || 'core'} skill`,
      detail: immediateStep?.time_required || '2-4 hours',
      color: 'text-destructive',
      borderColor: 'border-destructive/20',
      bgColor: 'bg-destructive/[0.03]',
    },
    {
      phase: 'Week 3-6',
      icon: <GraduationCap className="w-4 h-4" />,
      action: skillGaps[0]
        ? `Get certified in ${skillGaps[0].skill_name} augmentation`
        : 'Complete a micro-certification in AI-augmented workflows',
      detail: '10-15 hours total',
      color: 'text-prophet-gold',
      borderColor: 'border-prophet-gold/20',
      bgColor: 'bg-prophet-gold/[0.03]',
    },
    {
      phase: 'Week 7-12',
      icon: <TrendingUp className="w-4 h-4" />,
      action: (judoStrategy as any)?.career_positioning
        || `Position yourself as the ${moatSkills[0] || 'domain'} + AI expert on your team`,
      detail: 'Ongoing — build visible proof',
      color: 'text-prophet-green',
      borderColor: 'border-prophet-green/20',
      bgColor: 'bg-prophet-green/[0.03]',
    },
  ];


  return (
    <div className="space-y-5">
      {/* #1 Priority */}
      {immediateStep && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 22 }}
          className="rounded-2xl border-2 border-primary/25 bg-primary/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Your #1 Priority This Week</p>
          </div>
          <p className="text-base font-black text-foreground leading-snug">{immediateStep.action}</p>
          {immediateStep.rationale && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{immediateStep.rationale}</p>
          )}
          {immediateStep.time_required && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold">{immediateStep.time_required}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Judo Strategy — prominent callout */}
      {judoStrategy?.recommended_tool && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Swords className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Your Judo Move</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-black text-primary">{judoStrategy.recommended_tool}</span> is threatening your role — but learning it first flips the threat into your biggest advantage.
          </p>
          {judoStrategy.pitch && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">"{judoStrategy.pitch}"</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {judoStrategy.months_gained > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-prophet-green/20 bg-prophet-green/10 text-prophet-green">
                +{judoStrategy.months_gained} months runway
              </span>
            )}
            {judoStrategy.survivability_after_judo > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary">
                Score → {judoStrategy.survivability_after_judo} after adoption
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* 90-Day Career Upgrade Path */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border-2 border-border bg-card p-5"
      >
        <p className="text-xs font-semibold text-muted-foreground mb-4">
          90-Day Career Upgrade Path
        </p>

        <div className="space-y-4 relative">
          <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-border" />

          {milestones.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
              className={`rounded-xl border-2 ${m.borderColor} ${m.bgColor} p-4 relative ml-6`}
            >
              <div className={`absolute -left-[30px] top-4 w-5 h-5 rounded-full border-2 ${m.borderColor} bg-background flex items-center justify-center`}>
                <span className={`${m.color}`}>{m.icon}</span>
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${m.color} mb-1`}>{m.phase}</p>
              <p className="text-sm font-bold text-foreground leading-snug">{m.action}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {m.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Expected outcome */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border-2 border-prophet-green/20 bg-prophet-green/[0.03] p-4"
      >
        <p className="text-xs font-semibold text-prophet-green uppercase tracking-wide mb-2">What Happens If You Execute</p>
        <p className="text-sm font-bold text-foreground leading-snug">
          Closing your top skill gaps typically moves career scores <span className="text-prophet-green font-black">10–25 points</span> within 90 days.
        </p>
        {skillGaps[0] && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your biggest lever right now: <span className="font-bold text-foreground">{skillGaps[0].skill_name}</span> — addressing this single gap has the highest impact on your score.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-2 italic">
          Based on typical outcomes from users who closed similar skill gaps — individual results vary.
        </p>
      </motion.div>

      {/* Data provenance */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <DataProvenance
          skillsMatched={kgMatched}
          toolsTracked={tools.length}
          kgCoverage={report.data_quality?.kg_coverage}
          source={report.source}
          compact
        />
      </motion.div>
    </div>
  );
}
