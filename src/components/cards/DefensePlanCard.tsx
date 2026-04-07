import { motion } from 'framer-motion';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { Target, Clock, Flame, GraduationCap, TrendingUp, Swords, BookOpen, Video, Headphones, ExternalLink, ChevronDown } from 'lucide-react';
import { computeStabilityScore } from '@/lib/stability-score';
import DataProvenance from '@/components/cards/DataProvenance';
import { useState } from 'react';

interface DefensePlanCardProps {
  report: ScanReport;
}

interface WeekPlan {
  week: number;
  theme: string;
  action: string;
  deliverable: string;
  effort_hours?: number;
  fallback_action?: string;
  books?: Array<{ title: string; author_or_platform: string; why_relevant: string; url?: string }>;
  courses?: Array<{ title: string; author_or_platform: string; why_relevant: string; url?: string }>;
  videos?: Array<{ title: string; author_or_platform: string; why_relevant: string; url?: string }>;
}

const buildSearchUrl = (title: string, author: string, type: 'book' | 'course' | 'video', url?: string) => {
  if (url && /^https?:\/\//i.test(url)) return url;
  const query = `${title} ${author}`.trim();
  if (type === 'book') return `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  if (type === 'video') return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query + ' course')}`;
};

export default function DefensePlanCard({ report }: DefensePlanCardProps) {
  const score = computeStabilityScore(report);
  const immediateStep = report.immediate_next_step;
  const judoStrategy = report.judo_strategy;
  const moatSkills = report.moat_skills || [];
  const deadSkills = (report as any).execution_skills_dead || [];
  const monthsRemaining = report.months_remaining ?? 48;
  const role = report.role || 'your role';
  const industry = report.industry || 'your industry';
  const di = report.determinism_index ?? 50;
  const skillGaps = report.score_breakdown?.skill_adjustments?.filter(s => s.automation_risk >= 50).slice(0, 3) || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const kgMatched = report.computation_method?.kg_skills_matched ?? (report.score_breakdown?.skill_adjustments?.length || 0);

  // Extract the AI-generated weekly action plan from Agent 2B
  const weeklyPlan: WeekPlan[] = (report as any).weekly_action_plan || [];
  const hasRichPlan = weeklyPlan.length > 0;

  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);

  // Urgency framing based on months_remaining
  const isCrisis = monthsRemaining < 24;
  const isSteady = monthsRemaining >= 24 && monthsRemaining <= 48;
  const urgencyLabel = isCrisis ? 'URGENT — Act within days' : isSteady ? 'Strategic pace — steady action' : 'Long horizon — build methodically';

  const topDeadSkill = deadSkills[0] || skillGaps[0]?.skill_name || 'your most automated task';
  const secondDeadSkill = deadSkills[1] || skillGaps[1]?.skill_name || 'routine workflows';
  const topMoat = moatSkills[0] || 'your core human skill';
  const judoTool = judoStrategy?.recommended_tool || 'the leading AI tool for your role';

  // Enhanced fallback milestones with WHY + OUTCOME + urgency
  const fallbackMilestones = [
    {
      phase: isCrisis ? 'Week 1 (Start Today)' : 'Week 1-2',
      icon: <Flame className="w-4 h-4" />,
      title: `Replace ${topDeadSkill} with AI`,
      action: immediateStep?.action
        || `Search "${topDeadSkill} AI tools" on YouTube. Pick the top-rated free tool. Complete one real work task with it this week.`,
      why: isCrisis
        ? `With ${monthsRemaining} months of runway, ${topDeadSkill} is already being automated — every week you delay costs you leverage.`
        : `${topDeadSkill} has ${di}% AI exposure in ${industry}. Learning the AI alternative now makes you the person who leads the transition, not the person replaced by it.`,
      outcome: `You will have hands-on experience with one AI tool that replaces ${topDeadSkill} — and proof you can adapt.`,
      detail: isCrisis ? '3-5 hours (this weekend)' : '2-4 hours',
      color: 'text-destructive',
      borderColor: 'border-destructive/20',
      bgColor: 'bg-destructive/[0.03]',
    },
    {
      phase: isCrisis ? 'Week 2-4' : 'Week 3-6',
      icon: <GraduationCap className="w-4 h-4" />,
      title: `Get certified in ${topMoat} + AI`,
      action: skillGaps[0]
        ? `Search "AI for ${skillGaps[0].skill_name}" on Coursera or LinkedIn Learning. Complete a micro-certification that proves you can augment ${skillGaps[0].skill_name} with AI tools.`
        : `Complete a micro-certification in AI-augmented ${topMoat} workflows. Search Coursera for "${topMoat} AI" and pick one under 15 hours.`,
      why: `${topMoat} is your strongest moat — but only if you can prove you use AI to amplify it. A certification makes this visible to hiring managers and your current leadership.`,
      outcome: `You will have a credential that says "${role} who uses AI for ${topMoat}" — a rare and valuable combination in ${industry}.`,
      detail: isCrisis ? '10-12 hours (2 weekends)' : '10-15 hours total',
      color: 'text-prophet-gold',
      borderColor: 'border-prophet-gold/20',
      bgColor: 'bg-prophet-gold/[0.03]',
    },
    {
      phase: isCrisis ? 'Week 5-8' : 'Week 7-12',
      icon: <TrendingUp className="w-4 h-4" />,
      title: `Become the ${topMoat} + AI expert in ${industry}`,
      action: (judoStrategy as any)?.career_positioning
        || `Write one LinkedIn post showing how you used ${judoTool} to improve a ${topMoat} outcome. Present an "AI workflow" in your next team meeting. Volunteer to lead your team's AI adoption for ${topMoat}-related tasks.`,
      why: `In ${industry}, the people who survive AI disruption are the ones who publicly demonstrate they've adapted. Visibility converts skill into job security.`,
      outcome: `Your team and network see you as the "${topMoat} + AI" person — the one who adapted first. This is your moat.`,
      detail: isCrisis ? 'Ongoing — one visible action per week' : 'Ongoing — build visible proof',
      color: 'text-prophet-green',
      borderColor: 'border-prophet-green/20',
      bgColor: 'bg-prophet-green/[0.03]',
    },
  ];

  const phaseColors = [
    { color: 'text-destructive', border: 'border-destructive/20', bg: 'bg-destructive/[0.03]', icon: <Flame className="w-4 h-4" /> },
    { color: 'text-prophet-gold', border: 'border-prophet-gold/20', bg: 'bg-prophet-gold/[0.03]', icon: <GraduationCap className="w-4 h-4" /> },
    { color: 'text-primary', border: 'border-primary/20', bg: 'bg-primary/[0.03]', icon: <TrendingUp className="w-4 h-4" /> },
    { color: 'text-prophet-green', border: 'border-prophet-green/20', bg: 'bg-prophet-green/[0.03]', icon: <TrendingUp className="w-4 h-4" /> },
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

      {/* Judo Strategy */}
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

      {/* Rich Weekly Plan from Agent 2B */}
      {hasRichPlan ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border-2 border-border bg-card overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">
              Your Personalized {weeklyPlan.length}-Week Plan
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              AI-generated from your exact scan data — with curated resources
            </p>
          </div>

          <div className="divide-y divide-border">
            {weeklyPlan.map((week, i) => {
              const phase = phaseColors[Math.min(i, phaseColors.length - 1)];
              const isOpen = expandedWeek === i;
              const hasResources = (week.books?.length || 0) + (week.courses?.length || 0) + (week.videos?.length || 0) > 0;

              return (
                <div key={i}>
                  <button
                    onClick={() => setExpandedWeek(isOpen ? null : i)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${phase.bg} border ${phase.border}`}>
                      <span className={phase.color}>{phase.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${phase.color}`}>Week {week.week}</span>
                        {week.effort_hours && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {week.effort_hours}h
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">{week.theme}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{week.action}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground mt-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pb-4 space-y-3"
                    >
                      {/* Deliverable */}
                      {week.deliverable && (
                        <div className="rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Deliverable</p>
                          <p className="text-xs text-foreground leading-relaxed">{week.deliverable}</p>
                        </div>
                      )}

                      {/* Resources */}
                      {hasResources && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Curated Resources</p>
                          
                          {week.books?.map((b, j) => (
                            <a key={`book-${j}`} href={buildSearchUrl(b.title, b.author_or_platform, 'book', (b as any).url)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors group cursor-pointer">
                              <BookOpen className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-primary group-hover:underline">{b.title}</p>
                                <p className="text-[11px] text-muted-foreground">{b.author_or_platform}</p>
                                {b.why_relevant && <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">{b.why_relevant}</p>}
                              </div>
                              <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary mt-0.5 flex-shrink-0" />
                            </a>
                          ))}

                          {week.courses?.map((c, j) => (
                            <a key={`course-${j}`} href={buildSearchUrl(c.title, c.author_or_platform, 'course', (c as any).url)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors group cursor-pointer">
                              <GraduationCap className="w-3.5 h-3.5 text-prophet-gold mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-prophet-gold group-hover:underline">{c.title}</p>
                                <p className="text-[11px] text-muted-foreground">{c.author_or_platform}</p>
                                {c.why_relevant && <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">{c.why_relevant}</p>}
                              </div>
                              <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-prophet-gold mt-0.5 flex-shrink-0" />
                            </a>
                          ))}

                          {week.videos?.map((v, j) => (
                            <a key={`video-${j}`} href={buildSearchUrl(v.title, v.author_or_platform, 'video', (v as any).url)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors group cursor-pointer">
                              <Video className="w-3.5 h-3.5 text-prophet-cyan mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-prophet-cyan group-hover:underline">{v.title}</p>
                                <p className="text-[11px] text-muted-foreground">{v.author_or_platform}</p>
                                {v.why_relevant && <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">{v.why_relevant}</p>}
                              </div>
                              <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-prophet-cyan mt-0.5 flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Fallback action */}
                      {week.fallback_action && (
                        <p className="text-[11px] text-muted-foreground italic">
                          <span className="font-semibold">Can't do this?</span> {week.fallback_action}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* Fallback: enhanced 90-day milestones with WHY + OUTCOME */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border-2 border-border bg-card overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">
              {isCrisis ? '🚨 Crisis-Mode Action Plan' : '90-Day Career Upgrade Path'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{urgencyLabel}</p>
          </div>
          <div className="p-5 space-y-4 relative">
            <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-border" />
            {fallbackMilestones.map((m, i) => (
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
                <p className="text-sm font-bold text-foreground leading-snug">{m.title}</p>
                <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{m.action}</p>
                <div className="mt-2.5 rounded-lg bg-muted/30 px-3 py-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">Why now:</span> {m.why}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-bold text-prophet-green">After this:</span> {m.outcome}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {m.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

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
          Projected from closing your top skill gaps — deterministic estimate, individual results vary.
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
