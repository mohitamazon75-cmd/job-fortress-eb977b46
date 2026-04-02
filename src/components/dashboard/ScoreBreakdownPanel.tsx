import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, ChevronDown, ChevronUp } from 'lucide-react';
import { ScanReport } from '@/lib/scan-engine';

interface ScoreBreakdownPanelProps {
  breakdown: ScanReport['score_breakdown'];
  data_quality?: ScanReport['data_quality'];
  role?: string;
  matchedCount?: number;
}

interface PillarData {
  name: string;
  score: number;
  drivers: string[];
  action: string;
  confidence?: string;
}

export default function ScoreBreakdownPanel({ breakdown, data_quality, role, matchedCount }: ScoreBreakdownPanelProps) {
  const [open, setOpen] = useState(false);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  if (!breakdown) return null;

  const COMPLETENESS_NUDGE_THRESHOLD = 70;

  const GAP_LABELS: Record<string, string> = {
    current_role: 'job title',
    experience_years: 'years of experience',
    primary_skills: 'specific skills',
    estimated_monthly_salary_inr: 'current salary',
    industry: 'industry / sector',
    current_company: 'current employer',
    city: 'location',
  };

  const completenessNudge = data_quality?.profile_completeness_pct !== undefined &&
    data_quality.profile_completeness_pct < COMPLETENESS_NUDGE_THRESHOLD
    ? {
        pct: data_quality.profile_completeness_pct,
        gaps: (data_quality.profile_gaps || []).map(g => GAP_LABELS[g] || g),
      }
    : null;

  const baseScore = breakdown.base_score;
  const skillAvg = breakdown.weighted_skill_average;
  const diDirection = skillAvg !== null
    ? (skillAvg > baseScore ? 'higher' : skillAvg < baseScore ? 'lower' : 'equal to')
    : null;

  // Construct pillar drill-down data (5 pillars per spec)
  const pillars: PillarData[] = [
    {
      name: 'AI Resistance',
      score: breakdown.final_clamped || 50,
      drivers: [
        `Automation risk: ${breakdown.final_clamped}%`,
        ...(breakdown.skill_adjustments?.slice(0, 2).map(s => `${s.skill_name}: ${Math.round(s.automation_risk)}% risk`) || [])
      ],
      action: 'Add one AI-augmented skill to your workflow this month',
      confidence: 'High'
    },
    {
      name: 'Market Position',
      score: Math.max(0, 100 - (breakdown.market_pressure || 0) * 2),
      drivers: [
        breakdown.market_pressure ? `Market AI pressure: +${breakdown.market_pressure} points` : 'Market pressure is moderate',
        'Demand trend: Stable in your sector'
      ],
      action: 'Monitor job postings in your role for demand shifts quarterly',
      confidence: 'Medium'
    },
    {
      name: 'Skill Moat',
      score: skillAvg !== null ? Math.round(skillAvg) : 50,
      drivers: [
        `Skill average: ${skillAvg !== null ? Math.round(skillAvg) : '?'}%`,
        ...(breakdown.skill_adjustments?.slice(2, 4).map(s => `${s.skill_name}: ${Math.round(s.automation_risk)}% risk`) || [])
      ],
      action: 'Deepen expertise in your 2-3 highest-value skills',
      confidence: 'High'
    },
    {
      name: 'Role Trajectory',
      score: Math.max(0, 100 - baseScore),
      drivers: [
        `Base role family score: ${baseScore}`,
        'Career pivot opportunities available'
      ],
      action: 'Explore 2-3 adjacent roles that leverage your moat skills',
      confidence: 'Medium'
    },
    {
      name: 'Seniority Protection',
      score: Math.min(100, (breakdown.experience_reduction || 0) * 2),
      drivers: [
        breakdown.experience_reduction ? `Experience advantage: -${breakdown.experience_reduction} points` : 'Limited seniority advantage',
        'Seniority provides moderate protection'
      ],
      action: 'Leverage your experience as a strategic moat in positioning',
      confidence: 'Medium'
    }
  ];

  return (
    <div className="mt-4">
      {completenessNudge && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-prophet-gold/30 bg-prophet-gold/5 px-3 py-2.5 text-xs text-prophet-gold">
          <span className="flex-shrink-0">⚠</span>
          <span>
            Score based on <strong>{completenessNudge.pct}% complete profile</strong>.
            {completenessNudge.gaps.length > 0 && (
              <> Missing: {completenessNudge.gaps.join(', ')}.</>
            )}
            {' '}Update your LinkedIn profile to improve accuracy.
          </span>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <Database className="w-3 h-3" />
        {open ? 'Hide Score Breakdown' : 'View Score Breakdown'}
        <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Pillar Drill-Down Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Score Pillars</p>
                {pillars.map((pillar) => (
                  <div key={pillar.name} className="border border-border/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedPillar(expandedPillar === pillar.name ? null : pillar.name)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-card/50 hover:bg-card/80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{pillar.name}</span>
                          <span className={`text-sm font-black ${pillar.score > 65 ? 'text-prophet-green' : pillar.score > 35 ? 'text-prophet-gold' : 'text-prophet-red'}`}>
                            {Math.round(pillar.score)}
                          </span>
                        </div>
                      </div>
                      {expandedPillar === pillar.name ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>

                    <AnimatePresence>
                      {expandedPillar === pillar.name && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-border/30 bg-card/30"
                        >
                          <div className="px-3 py-2 space-y-2">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Key Drivers:</p>
                              <ul className="space-y-0.5">
                                {pillar.drivers.map((driver, i) => (
                                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span>
                                    <span>{driver}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {pillar.action && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Action to Improve:</p>
                                <p className="text-xs text-foreground bg-primary/10 rounded px-2 py-1">{pillar.action}</p>
                              </div>
                            )}
                            {pillar.confidence && (
                              <p className="text-[10px] text-muted-foreground italic">Confidence: {pillar.confidence}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border" />

              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">How Your Score Was Computed</p>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Base Score ({role || 'Role'} family)</span>
                <span className="font-semibold text-foreground">{baseScore}</span>
              </div>

              {skillAvg !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Weighted Skill Average ({matchedCount || '?'} skills)</span>
                    <span className="font-semibold text-foreground">{Math.round(skillAvg)}</span>
                  </div>
                  {breakdown.skill_adjustments && breakdown.skill_adjustments.length > 0 && (
                    <>
                      <div className="mt-2 space-y-1 pl-2 border-l-2 border-primary/20 ml-1">
                        {breakdown.skill_adjustments.slice(0, 6).map((adj, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">
                              {adj.skill_name}
                              <span className="ml-1 text-[11px] text-muted-foreground/60">w:{adj.weight.toFixed(2)}</span>
                            </span>
                            <span className={`font-semibold ${adj.automation_risk > 60 ? 'text-prophet-red' : adj.automation_risk > 35 ? 'text-prophet-gold' : 'text-prophet-green'}`}>
                              {Math.round(adj.automation_risk)}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">
                        Your specific skills push the risk {diDirection} than the industry average.
                      </p>
                    </>
                  )}
                </div>
              )}

              {breakdown.market_pressure !== 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Market AI Pressure</span>
                  <span className="font-semibold text-prophet-red">+{breakdown.market_pressure}</span>
                </div>
              )}

              {breakdown.experience_reduction > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Experience Reduction</span>
                    <span className="font-semibold text-prophet-green">-{breakdown.experience_reduction}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-1 pl-1">
                    Your seniority reduces risk by {breakdown.experience_reduction} points — experience provides some protection against automation.
                  </p>
                </>
              )}

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <span className="font-black text-foreground">Automation Risk Index</span>
                <span className="font-black text-prophet-red text-sm">{breakdown.final_clamped}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1 pl-1">
                {breakdown.final_clamped}% of your role's tasks have AI alternatives. Your Career Position Score (above) factors this alongside market demand, moat strength, income resilience, and seniority.
              </p>

              {/* Income impact breakdown */}
              <div className="pt-2 border-t border-border space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Income Impact Formula</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Base depreciation rate</span>
                  <span className="font-semibold">{(breakdown.salary_bleed_breakdown.depreciation_rate * 100).toFixed(1)}%</span>
                </div>
                {breakdown.salary_bleed_breakdown.market_amplifier > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Market amplifier</span>
                    <span className="font-semibold text-prophet-red">+{(breakdown.salary_bleed_breakdown.market_amplifier * 100).toFixed(1)}%</span>
                  </div>
                )}
                {breakdown.salary_bleed_breakdown.ai_pressure_add > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI pressure add</span>
                    <span className="font-semibold text-prophet-red">+{(breakdown.salary_bleed_breakdown.ai_pressure_add * 100).toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Final annual rate</span>
                  <span className="font-black">{(breakdown.salary_bleed_breakdown.final_rate * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Plain-language summary */}
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">What Does This Mean?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {breakdown.final_clamped > 65
                    ? `Your role faces significant automation pressure. The combination of your skill profile and market trends puts you at ${breakdown.final_clamped}% risk — meaning most of your core tasks are actively being targeted by AI tools. Immediate action is recommended.`
                    : breakdown.final_clamped > 40
                    ? `Your role has moderate automation risk at ${breakdown.final_clamped}%. Some of your tasks are vulnerable, but your strategic skills provide a buffer. Proactive upskilling in the next 6-12 months will help maintain your position.`
                    : `Your role currently has lower automation risk at ${breakdown.final_clamped}%. Your skill mix and experience provide good protection, but continuous investment in strategic capabilities is essential to stay ahead.`
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
