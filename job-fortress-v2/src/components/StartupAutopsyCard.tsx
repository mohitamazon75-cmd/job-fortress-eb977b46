import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Skull, Loader2, Check, ChevronDown, ChevronUp, AlertTriangle,
  Shield, Target, Zap, Clock, ArrowRight, RefreshCw, Lightbulb,
  Crosshair, Flame, Bug, Swords, TrendingUp, BookOpen,
  Brain, Search, Database, FileSearch, Microscope, Network, Scan, Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { getVerbatimRole } from '@/lib/role-guard';

// ═══ TYPES ═══
interface DeadStartup {
  name: string;
  what_they_did: string;
  funding_raised: string;
  years_active: string;
  root_cause_of_death: string;
  failure_category: string;
  warning_signs_they_missed: string[];
  similarity_to_your_idea: string;
  key_lesson: string;
}

interface RiskVector {
  vector: string;
  risk_level: number;
  dead_startup_reference: string;
  your_exposure: string;
  mitigation: string;
}

interface NonObviousKill {
  threat: string;
  why_hidden: string;
  how_to_detect_early: string;
  escape_plan: string;
}

interface AntiPattern {
  pattern: string;
  your_version: string;
  antidote: string;
}

interface PlaybookAction {
  action: string;
  tool_or_method: string;
  success_metric: string;
  dead_startup_lesson: string;
}

interface PlaybookPhase {
  phase: string;
  objective: string;
  actions: PlaybookAction[];
  kill_switch: string;
}

interface PivotTrigger {
  signal: string;
  threshold: string;
  pivot_direction: string;
}

interface BetterAlternative {
  idea_name: string;
  one_liner: string;
  why_better: string;
  survival_boost: string;
  first_step: string;
}

interface Alternative {
  idea_name: string;
  idea_type: string;
  emoji: string;
  one_liner: string;
  why_better: string;
  death_vectors_avoided: string[];
  target_customer: string;
  revenue_model: string;
  estimated_monthly_revenue: string;
  startup_cost: string;
  time_to_first_revenue: string;
  founder_fit_reason: string;
  lateral_connection?: string;
  first_week_sprint: string[];
  tools_2026: string[];
  survival_probability: number;
  _isWildcard?: boolean;
}

interface Clarification {
  original_input: string;
  interpreted_as: string;
  confidence: string;
  gaps_filled: string[];
}

interface AutopsyResults {
  dna: {
    startup_dna: {
      name_or_concept: string;
      one_liner: string;
      market_category: string;
      target_customer: string;
      value_proposition: string;
      revenue_model: string;
      key_assumptions: string[];
      tech_complexity: string;
      network_effects: boolean;
      regulatory_risk: string;
      capital_intensity: string;
      competitive_landscape: string;
      moat_type: string;
    };
    founder_context: {
      relevant_skills: string[];
      domain_expertise_level: string;
      unfair_advantages: string[];
      blind_spots: string[];
    };
    critical_vectors: string[];
  };
  dead: {
    dead_startups: DeadStartup[];
    pattern_analysis: {
      most_common_death_cause: string;
      graveyard_density: string;
      survivor_traits: string[];
      timing_signal: string;
    };
  };
  playbook: {
    death_score: {
      overall_survival_probability: number;
      strength_factors?: string[];
      vectors: RiskVector[];
      non_obvious_kills: NonObviousKill[];
    };
    dont_die_playbook: {
      survival_thesis: string;
      anti_patterns: AntiPattern[];
      playbook_phases: PlaybookPhase[];
      pivot_triggers: PivotTrigger[];
      competitive_immunization: {
        if_big_tech_copies_you: string;
        if_funded_competitor_appears: string;
        if_market_shifts: string;
      };
      founder_warnings: string[];
    };
    verdict: {
      go_no_go: string;
      confidence: number;
      one_line_verdict: string;
      if_you_must_do_this: string;
    };
    better_alternatives?: BetterAlternative[];
  };
  alternatives?: Alternative[];
  clarification?: Clarification | null;
}

interface StartupAutopsyCardProps {
  report: any;
  country?: string;
}

// ═══ COLLAPSIBLE SECTION ═══
function CollapsibleSection({ title, icon: Icon, accent, defaultOpen = false, children }: {
  title: string;
  icon: React.ElementType;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${open ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${accent}`} />
          <span className="text-sm font-bold text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══ ANIMATED BAR ═══
function RiskBar({ level, delay = 0 }: { level: number; delay?: number }) {
  const color = level >= 7 ? 'bg-destructive' : level >= 4 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${level * 10}%` }}
        transition={{ duration: 0.8, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

// ═══ GAUGE ═══
function SurvivalGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const size = 100;
  const r = (size - 8) / 2;
  const circ = Math.PI * r;
  const pct = Math.min(value / 100, 1);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path
          d={`M 4 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2 + 4}`}
          fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeLinecap="round"
        />
        <motion.path
          d={`M 4 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2 + 4}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${circ * pct} ${circ}` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" className="text-xl font-black" fill={color}>
          {value}%
        </text>
      </svg>
      <span className="text-[10px] text-muted-foreground font-medium text-center">{label}</span>
    </div>
  );
}

// ═══ TRUST-BUILDING LOADING STAGES ═══
const AUTOPSY_LOADING_STEPS = [
  { icon: Scan, label: 'Decomposing idea into structural DNA', detail: 'Market category, moat type, assumptions, risk vectors' },
  { icon: Brain, label: 'Mapping founder-idea fit', detail: 'Domain expertise × blind spots × unfair advantages' },
  { icon: Search, label: 'Scanning startup graveyard', detail: 'YC postmortems, CrunchBase shutdowns, pivot histories' },
  { icon: Database, label: 'Cross-referencing failure patterns', detail: '10,000+ startup autopsies in knowledge graph' },
  { icon: FileSearch, label: 'Analyzing root causes of death', detail: 'Not "ran out of money" — the REAL reason' },
  { icon: Microscope, label: 'Scoring death vectors against your idea', detail: 'Each failure mode rated 1-10 with evidence' },
  { icon: Network, label: 'Building competitive immunization plan', detail: 'Big Tech, funded competitors, market shifts' },
  { icon: Activity, label: 'Generating Don\'t Die playbook', detail: '3-phase execution plan with kill switches' },
  { icon: Shield, label: 'Running anti-pattern validation', detail: 'Matching YOUR blind spots to THEIR mistakes' },
  { icon: Target, label: 'Calibrating survival probability', detail: 'Ensemble scoring across all failure vectors' },
];

function AutopsyLoadingSteps({ stage }: { stage: string }) {
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    setCompletedSteps(0);
    const interval = setInterval(() => {
      setCompletedSteps(prev => {
        if (prev >= AUTOPSY_LOADING_STEPS.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 8000); // ~80s total spread across 10 steps
    return () => clearInterval(interval);
  }, []);

  // Accelerate when stage changes
  useEffect(() => {
    if (stage === 'autopsy' && completedSteps < 3) setCompletedSteps(3);
    if (stage === 'score' && completedSteps < 6) setCompletedSteps(6);
  }, [stage]);

  return (
    <div className="space-y-2 max-w-md mx-auto">
      {AUTOPSY_LOADING_STEPS.map((step, i) => {
        const isDone = i < completedSteps;
        const isActive = i === completedSteps;
        const isFuture = i > completedSteps;
        const StepIcon = step.icon;

        if (isFuture && i > completedSteps + 2) return null; // Only show next 2 upcoming

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isFuture ? 0.3 : 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`flex items-start gap-3 p-2.5 rounded-lg transition-all ${
              isActive ? 'bg-primary/5 border border-primary/20' : ''
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
              isDone ? 'bg-emerald-100 text-emerald-600' :
              isActive ? 'bg-primary/10 text-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {isDone ? (
                <Check className="w-3.5 h-3.5" />
              ) : isActive ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <StepIcon className="w-3.5 h-3.5" />
                </motion.div>
              ) : (
                <StepIcon className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${isDone ? 'text-emerald-700' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              {(isActive || isDone) && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-[10px] text-muted-foreground mt-0.5"
                >
                  {step.detail}
                </motion.p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ═══ STAGE INDICATORS ═══
const STAGES = [
  { key: 'decompose', icon: '🔬', label: 'Decompose DNA' },
  { key: 'autopsy', icon: '💀', label: 'Find Dead Clones' },
  { key: 'score', icon: '⚖️', label: 'Score & Playbook' },
  { key: 'alternatives', icon: '🚀', label: '3 Better Ideas' },
];

function StageProgress({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);
  return (
    <div className="flex gap-3 justify-center py-4">
      {STAGES.map((s, i) => {
        const isDone = currentIdx > i || currentStage === 'done';
        const isActive = currentStage === s.key;
        return (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg border transition-all ${
              isDone ? 'bg-emerald-50 border-emerald-200' :
              isActive ? 'bg-amber-50 border-amber-200 animate-pulse' :
              'bg-muted/30 border-border opacity-40'
            }`}>
              {isDone ? <Check className="w-5 h-5 text-emerald-600" /> : s.icon}
            </div>
            <span className={`text-[10px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══ MAIN COMPONENT ═══
const StartupAutopsyCard = React.forwardRef<HTMLDivElement, StartupAutopsyCardProps>(({ report, country }, ref) => {
  const [idea, setIdea] = useState('');
  const [stage, setStage] = useState<'idle' | 'decompose' | 'autopsy' | 'score' | 'alternatives' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<AutopsyResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = idea.trim().length > 10;
  const isRunning = ['decompose', 'autopsy', 'score', 'alternatives'].includes(stage);

  const run = useCallback(async () => {
    if (!canRun) return;
    setError(null);
    setResults(null);
    setStage('decompose');

    // Simulate stage progression while waiting for response
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(s => s === 'decompose' ? 'autopsy' : s), 12000));
    timers.push(setTimeout(() => setStage(s => s === 'autopsy' ? 'score' : s), 40000));
    timers.push(setTimeout(() => setStage(s => s === 'score' ? 'alternatives' : s), 70000));

    try {
      // Build founder profile from existing report — use verbatim role
      const verbatimRole = getVerbatimRole(report);
      const founderProfile = {
        role: verbatimRole,
        company: report?.linkedin_company || '',
        industry: report?.industry || '',
        yearsExp: report?.years_experience || '',
        skills: report?.all_skills || [],
        moatSkills: report?.moat_skills || [],
      };

      const { data, error: fnError } = await supabase.functions.invoke('startup-autopsy', {
        body: { idea, founderProfile },
      });

      timers.forEach(clearTimeout);

      if (fnError) {
        throw new Error(fnError.message || 'Analysis failed');
      }

      if (!data?.dna || !data?.playbook) {
        throw new Error(data?.error || 'Incomplete analysis result');
      }

      setResults(data);
      setStage('done');
    } catch (err: any) {
      timers.forEach(clearTimeout);
      console.error('[StartupAutopsy] Error:', err);
      setError(err.message || 'Failed to analyze');
      setStage('error');
    }
  }, [idea, report, canRun]);

  const reset = () => {
    setStage('idle');
    setResults(null);
    setError(null);
  };

  // ═══ VERDICT COLOR ═══
  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'GO': return { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', emoji: '🟢' };
      case 'CAUTIOUS_GO': return { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', emoji: '🟡' };
      case 'PIVOT_FIRST': return { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', emoji: '🟠' };
      default: return { color: 'text-destructive', bg: 'bg-red-50 border-red-200', emoji: '🔴' };
    }
  };

  const getSimilarityStyle = (sim: string) => {
    switch (sim) {
      case 'near_identical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  return (
    <div ref={ref} className="space-y-4">
      {/* ═══ INPUT CARD ═══ */}
      {(stage === 'idle' || stage === 'error') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <Skull className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Startup Autopsy</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Find startups like yours that died. Get a battle-tested "Don't Die" playbook.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Your Startup Idea *
                </label>
                <Textarea
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  placeholder={"Describe your startup idea — even a rough concept works!\n\nExamples:\n• \"AI tool that helps lawyers review contracts faster\"\n• \"Marketplace for Indian artisans to sell globally\"\n• \"App for remote teams to do async standups\"\n\nWe'll structure it, stress-test it, and suggest 3 better alternatives."}
                  className="min-h-[140px] text-sm"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  ⚠️ {error}
                </div>
              )}

              <Button
                onClick={run}
                disabled={!canRun || isRunning}
                className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                <Skull className="w-4 h-4" />
                Run Startup Autopsy
              </Button>

              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-[10px] text-muted-foreground font-mono leading-relaxed space-y-0.5">
                  <div><strong className="text-foreground/60">STAGE 0:</strong> Interpret vague input → structure into startup DNA (even "I want to build X" works)</div>
                  <div><strong className="text-foreground/60">STAGE 1:</strong> Decompose idea → key assumptions + founder blind spots</div>
                  <div><strong className="text-foreground/60">STAGE 2:</strong> Search startup graveyard → find real startups that tried this and died</div>
                  <div><strong className="text-foreground/60">STAGE 3:</strong> Score survival + generate 3 better alternatives (incl. lateral wildcard 🎲)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ PROCESSING — TRUST-BUILDING LOADING ═══ */}
      {isRunning && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                  <h3 className="text-lg font-bold text-foreground">Forensic Analysis in Progress</h3>
                </div>
                <p className="text-xs text-muted-foreground">3-stage pipeline running — not a single prompt</p>
              </div>

              <StageProgress currentStage={stage} />

              {/* Trust-building step-by-step */}
              <AutopsyLoadingSteps stage={stage} />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="flex items-center justify-center gap-2 pt-2"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <p className="text-[10px] text-amber-700 font-medium">
                    Takes 90–150 seconds. Quality over speed.
                  </p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ RESULTS ═══ */}
      {stage === 'done' && results && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* ── CLARIFICATION NOTICE ── */}
          {results.clarification && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">🧠 AI Interpretation</div>
                <p className="text-xs text-blue-800 mb-1.5">
                  You said: <em className="text-blue-600">"{results.clarification.original_input}"</em>
                </p>
                <p className="text-xs text-foreground font-medium">{results.clarification.interpreted_as}</p>
                {results.clarification.gaps_filled?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {results.clarification.gaps_filled.map((g: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[11px] bg-blue-100/50 text-blue-600 border-blue-200">{g}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── VERDICT BANNER ── */}
          {results.playbook.verdict && (() => {
            const v = results.playbook.verdict;
            const style = getVerdictStyle(v.go_no_go);
            return (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`${style.bg} border shadow-sm`}>
                  <CardContent className="py-8 text-center">
                    <div className="text-4xl mb-3">{style.emoji}</div>
                    <div className={`text-2xl font-black ${style.color} mb-2`}>
                      {v.go_no_go?.replace(/_/g, ' ')}
                    </div>
                    <p className="text-sm text-foreground/70 max-w-md mx-auto mb-6">{v.one_line_verdict}</p>
                    <div className="flex justify-center gap-8">
                      <SurvivalGauge
                        value={results.playbook.death_score?.overall_survival_probability || 0}
                        label="Survival Probability"
                        color="#10b981"
                      />
                      <SurvivalGauge
                        value={v.confidence || 0}
                        label="Analysis Confidence"
                        color={v.go_no_go === 'GO' ? '#10b981' : v.go_no_go === 'CAUTIOUS_GO' ? '#f59e0b' : '#ef4444'}
                      />
                    </div>
                    {(results.playbook.death_score?.strength_factors?.length ?? 0) > 0 && (
                      <div className="mt-5 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-left">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">✅ What's working in your favor</div>
                        <ul className="space-y-1">
                          {results.playbook.death_score!.strength_factors!.map((sf: string, i: number) => (
                            <li key={i} className="text-xs text-emerald-800 flex items-start gap-1.5">
                              <span className="text-emerald-500 mt-0.5">•</span>
                              {sf}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {v.if_you_must_do_this && (
                      <div className="mt-4 p-3 rounded-lg bg-background/60 border border-border text-sm text-muted-foreground">
                        💡 <strong className="text-foreground">First move:</strong> {v.if_you_must_do_this}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          {/* ── 3 BETTER ALTERNATIVES (ALWAYS SHOWN) ── */}
          {results.alternatives && results.alternatives.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="border-emerald-200 shadow-sm overflow-hidden bg-gradient-to-b from-emerald-50/80 to-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">🚀 3 Better Ideas For You</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Built from graveyard lessons + your skills — including a lateral wildcard
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {results.alternatives.map((alt: Alternative, i: number) => {
                    const isWildcard = alt.idea_type === 'lateral_wildcard' || alt._isWildcard;
                    const typeLabel = alt.idea_type === 'safer_bet' ? '🛡️ Safer Bet' : alt.idea_type === 'adjacent' ? '↗️ Adjacent Pivot' : '🎲 Lateral Wildcard';
                    const typeBorder = isWildcard ? 'border-amber-300 bg-amber-50/30' : alt.idea_type === 'safer_bet' ? 'border-emerald-200' : 'border-blue-200';
                    
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className={`p-4 rounded-xl border ${typeBorder} bg-background hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${isWildcard ? 'bg-amber-100 border border-amber-300' : 'bg-emerald-100 border border-emerald-200'}`}>
                            {alt.emoji || (i + 1)}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-foreground">{alt.idea_name}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">{alt.one_liner}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Badge variant="outline" className={`text-[11px] ${isWildcard ? 'bg-amber-100 text-amber-700 border-amber-300 font-bold' : 'bg-secondary text-secondary-foreground'}`}>
                                  {typeLabel}
                                </Badge>
                                {alt.survival_probability > 0 && (
                                  <span className="text-[10px] font-mono font-bold text-emerald-600">{alt.survival_probability}% survival</span>
                                )}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                              <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Why this survives</div>
                              <p className="text-xs text-emerald-800">{alt.why_better}</p>
                            </div>

                            {isWildcard && alt.lateral_connection && (
                              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                                <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">🎲 The Lateral Leap</div>
                                <p className="text-xs text-amber-800">{alt.lateral_connection}</p>
                              </div>
                            )}

                            {alt.founder_fit_reason && (
                              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                                <div className="text-[10px] font-semibold text-purple-700 mb-0.5">🎯 Why you specifically</div>
                                <p className="text-xs text-purple-800">{alt.founder_fit_reason}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-2 rounded-lg bg-muted/30 border border-border">
                                <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">💰 Revenue</div>
                                <p className="text-[10px] text-foreground">{alt.estimated_monthly_revenue}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-muted/30 border border-border">
                                <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">⏱️ Time</div>
                                <p className="text-[10px] text-foreground">{alt.time_to_first_revenue}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-muted/30 border border-border">
                                <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">💸 Cost</div>
                                <p className="text-[10px] text-foreground">{alt.startup_cost}</p>
                              </div>
                            </div>

                            {alt.first_week_sprint?.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-foreground">🏃 First Week Sprint</div>
                                {alt.first_week_sprint.map((step: string, si: number) => (
                                  <div key={si} className="text-[10px] text-muted-foreground pl-3 border-l-2 border-emerald-200 py-0.5">{step}</div>
                                ))}
                              </div>
                            )}

                            {alt.tools_2026?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {alt.tools_2026.map((t: string, ti: number) => (
                                  <Badge key={ti} variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">{t}</Badge>
                                ))}
                              </div>
                            )}

                            {alt.death_vectors_avoided?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[11px] text-muted-foreground font-medium">Avoids:</span>
                                {alt.death_vectors_avoided.map((dv: string, di: number) => (
                                  <Badge key={di} variant="outline" className="text-[11px] bg-red-50 text-red-600 border-red-200 line-through">{dv}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── STARTUP DNA ── */}
          {results.dna?.startup_dna && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧬</span>
                    <CardTitle className="text-base">Startup DNA</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-foreground">{results.dna.startup_dna.name_or_concept}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{results.dna.startup_dna.one_liner}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">{results.dna.startup_dna.market_category}</Badge>
                    <Badge variant="outline" className="text-xs">{results.dna.startup_dna.revenue_model}</Badge>
                    <Badge variant="outline" className={`text-xs ${results.dna.startup_dna.competitive_landscape === 'dominated' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {results.dna.startup_dna.competitive_landscape?.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                      Moat: {results.dna.startup_dna.moat_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {results.dna.startup_dna.capital_intensity?.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {/* Target Customer & Value Prop */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Target Customer</div>
                      <div className="text-xs text-foreground">{results.dna.startup_dna.target_customer}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Value Proposition</div>
                      <div className="text-xs text-foreground">{results.dna.startup_dna.value_proposition}</div>
                    </div>
                  </div>

                  {/* Extra DNA badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      Tech: {results.dna.startup_dna.tech_complexity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {results.dna.startup_dna.network_effects ? '✅ Network Effects' : '❌ No Network Effects'}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${results.dna.startup_dna.regulatory_risk === 'high' ? 'bg-red-50 text-red-700 border-red-200' : ''}`}>
                      Regulatory: {results.dna.startup_dna.regulatory_risk}
                    </Badge>
                  </div>

                  {/* Key Assumptions */}
                  <CollapsibleSection title="Key Assumptions (must be true)" icon={Target} accent="text-amber-600" defaultOpen={false}>
                    {results.dna.startup_dna.key_assumptions?.map((a, i) => (
                      <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-amber-300 py-0.5">{a}</div>
                    ))}
                  </CollapsibleSection>

                  {/* Critical Vectors */}
                  {results.dna.critical_vectors?.length > 0 && (
                    <CollapsibleSection title="Critical Kill Vectors" icon={AlertTriangle} accent="text-red-600" defaultOpen={false}>
                      {results.dna.critical_vectors.map((v, i) => (
                        <div key={i} className="text-sm text-red-600 pl-3 border-l-2 border-red-300 py-0.5">⚡ {v}</div>
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* Founder Analysis */}
                  {results.dna.founder_context && (
                    <CollapsibleSection title="Founder Analysis" icon={Crosshair} accent="text-purple-600" defaultOpen={false}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-purple-600 font-semibold">Domain expertise:</span>
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                            {results.dna.founder_context.domain_expertise_level}
                          </Badge>
                        </div>
                        {results.dna.founder_context.relevant_skills?.length > 0 && (
                          <div>
                            <span className="text-xs text-blue-600 font-semibold block mb-1">Relevant skills:</span>
                            <div className="flex flex-wrap gap-1">
                              {results.dna.founder_context.relevant_skills.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {results.dna.founder_context.unfair_advantages?.length > 0 && (
                          <div>
                            <span className="text-xs text-emerald-600 font-semibold block mb-1">Unfair advantages:</span>
                            <div className="flex flex-wrap gap-1">
                              {results.dna.founder_context.unfair_advantages.map((a, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{a}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {results.dna.founder_context.blind_spots?.length > 0 && (
                          <div>
                            <span className="text-xs text-red-600 font-semibold block mb-1">Blind spots:</span>
                            <div className="flex flex-wrap gap-1">
                              {results.dna.founder_context.blind_spots.map((b, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{b}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── THE GRAVEYARD ── */}
          {results.dead?.dead_startups?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💀</span>
                      <CardTitle className="text-base">The Graveyard</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">
                      {results.dead.dead_startups.length} dead clones
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0 p-0">
                  {results.dead.dead_startups.map((ds, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className={`px-6 py-4 ${i < results.dead.dead_startups.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-sm font-bold text-foreground">{ds.name}</span>
                          <Badge variant="outline" className={`text-[10px] ml-2 ${getSimilarityStyle(ds.similarity_to_your_idea)}`}>
                            {ds.similarity_to_your_idea} similarity
                          </Badge>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {ds.funding_raised && <div className="text-[10px] text-muted-foreground font-mono">{ds.funding_raised}</div>}
                          {ds.years_active && <div className="text-[10px] text-muted-foreground">{ds.years_active}</div>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{ds.what_they_did}</p>
                      <div className="text-xs text-red-600 font-medium mb-1">☠️ Root cause: {ds.root_cause_of_death}</div>
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                        {ds.failure_category?.replace(/_/g, ' ')}
                      </Badge>
                      {ds.warning_signs_they_missed?.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-2">Warning signs: {ds.warning_signs_they_missed.join(' • ')}</p>
                      )}
                      <p className="text-[10px] text-amber-600 mt-1 italic">📎 Lesson: {ds.key_lesson}</p>
                    </motion.div>
                  ))}

                  {/* Pattern Analysis */}
                  {results.dead.pattern_analysis && (
                    <div className="px-6 py-4 bg-red-50/50 border-t border-border">
                      <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2 font-mono">PATTERN ANALYSIS</div>
                      <div className="text-xs text-foreground/70 space-y-1">
                        <div>Most common killer: <strong className="text-red-600">{results.dead.pattern_analysis.most_common_death_cause}</strong></div>
                        <div className="flex items-center gap-1.5">
                          Graveyard density:
                          <Badge variant="outline" className={`text-[10px] ${results.dead.pattern_analysis.graveyard_density === 'mass_extinction' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {results.dead.pattern_analysis.graveyard_density?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {results.dead.pattern_analysis.timing_signal && (
                          <div className="flex items-center gap-1.5">
                            Timing: <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                              {results.dead.pattern_analysis.timing_signal?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {results.dead.pattern_analysis.survivor_traits?.length > 0 && (
                        <div className="mt-2">
                          <span className="text-[10px] text-emerald-600 font-semibold">Survivors did differently:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {results.dead.pattern_analysis.survivor_traits.map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── DEATH VECTOR SCORING ── */}
          {results.playbook.death_score?.vectors?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚖️</span>
                    <CardTitle className="text-base">Death Vector Scoring</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {results.playbook.death_score.vectors.map((v, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">{v.vector}</span>
                        <span className={`text-sm font-black font-mono ${v.risk_level >= 7 ? 'text-red-600' : v.risk_level >= 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {v.risk_level}/10
                        </span>
                      </div>
                      <RiskBar level={v.risk_level} delay={i * 0.05} />
                      {v.dead_startup_reference && (
                        <p className="text-[10px] text-muted-foreground">📎 <em>{v.dead_startup_reference}</em></p>
                      )}
                      <p className="text-[10px] text-red-500">Exposure: {v.your_exposure}</p>
                      <p className="text-[10px] text-emerald-600">✅ Mitigation: {v.mitigation}</p>
                    </div>
                  ))}

                  {/* Non-obvious kills */}
                  {results.playbook.death_score.non_obvious_kills?.length > 0 && (
                    <div className="mt-3 p-4 rounded-xl bg-purple-50 border border-purple-200">
                      <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-3 font-mono">🔮 NON-OBVIOUS KILLS</div>
                      {results.playbook.death_score.non_obvious_kills.map((nk, i) => (
                        <div key={i} className="mb-3 last:mb-0 pl-3 border-l-2 border-purple-300">
                          <div className="text-xs font-bold text-purple-800">{nk.threat}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">Why hidden: {nk.why_hidden}</div>
                          <div className="text-[10px] text-amber-600 mt-0.5">Detect early: {nk.how_to_detect_early}</div>
                          <div className="text-[10px] text-emerald-600 mt-0.5">Escape: {nk.escape_plan}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── DON'T DIE PLAYBOOK ── */}
          {results.playbook.dont_die_playbook && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <CardTitle className="text-base">Don't Die Playbook</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Survival Thesis */}
                  {results.playbook.dont_die_playbook.survival_thesis && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 italic leading-relaxed">
                      "{results.playbook.dont_die_playbook.survival_thesis}"
                    </div>
                  )}

                  {/* Anti-Patterns */}
                  <CollapsibleSection title="Anti-Patterns — Don't Repeat Their Mistakes" icon={AlertTriangle} accent="text-red-600" defaultOpen={true}>
                    {results.playbook.dont_die_playbook.anti_patterns?.map((ap, i) => (
                      <div key={i} className="pl-3 border-l-2 border-red-300 py-1 space-y-0.5">
                        <div className="text-xs font-semibold text-red-700">What killed them: {ap.pattern}</div>
                        <div className="text-xs text-amber-600">⚠️ Your version: {ap.your_version}</div>
                        <div className="text-xs text-emerald-600">💊 Antidote: {ap.antidote}</div>
                      </div>
                    ))}
                  </CollapsibleSection>

                  {/* Phased Execution */}
                  <CollapsibleSection title="Phased Execution Plan" icon={BookOpen} accent="text-blue-600" defaultOpen={true}>
                    {results.playbook.dont_die_playbook.playbook_phases?.map((phase, pi) => {
                      const phaseColors = ['text-blue-600', 'text-purple-600', 'text-emerald-600'];
                      const phaseBgs = ['bg-blue-50 border-blue-200', 'bg-purple-50 border-purple-200', 'bg-emerald-50 border-emerald-200'];
                      return (
                        <div key={pi} className="mb-4 last:mb-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border ${phaseBgs[pi]} ${phaseColors[pi]}`}>
                              {pi + 1}
                            </div>
                            <div className="text-sm font-bold text-foreground">{phase.phase}</div>
                          </div>
                          {phase.objective && (
                            <p className="text-[10px] text-muted-foreground ml-9 mb-2">🎯 {phase.objective}</p>
                          )}
                          {phase.actions?.map((a, j) => (
                            <div key={j} className="ml-9 mb-2 pl-3 border-l-2 border-border">
                              <div className="text-xs text-foreground font-medium">{a.action}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {a.tool_or_method && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{a.tool_or_method}</Badge>
                                )}
                                {a.success_metric && (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">✓ {a.success_metric}</Badge>
                                )}
                              </div>
                              {a.dead_startup_lesson && (
                                <p className="text-[11px] text-muted-foreground italic mt-0.5">📎 {a.dead_startup_lesson}</p>
                              )}
                            </div>
                          ))}
                          {phase.kill_switch && (
                            <div className="ml-9 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-700">
                              🔴 <strong>Kill switch:</strong> {phase.kill_switch}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CollapsibleSection>

                  {/* Pivot Triggers */}
                  {results.playbook.dont_die_playbook.pivot_triggers?.length > 0 && (
                    <CollapsibleSection title="Pivot Triggers" icon={TrendingUp} accent="text-orange-600" defaultOpen={false}>
                      {results.playbook.dont_die_playbook.pivot_triggers.map((pt, i) => (
                        <div key={i} className="pl-3 border-l-2 border-orange-300 py-1 space-y-0.5">
                          <div className="text-xs text-foreground font-medium">📊 Signal: {pt.signal}</div>
                          <div className="text-[10px] text-amber-600">Threshold: {pt.threshold}</div>
                          <div className="text-[10px] text-emerald-600">→ Pivot to: {pt.pivot_direction}</div>
                        </div>
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* Competitive Immunization */}
                  {results.playbook.dont_die_playbook.competitive_immunization && (
                    <CollapsibleSection title="Competitive Immunization" icon={Shield} accent="text-purple-600" defaultOpen={false}>
                      <div className="space-y-2">
                        {results.playbook.dont_die_playbook.competitive_immunization.if_big_tech_copies_you && (
                          <div className="pl-3 border-l-2 border-purple-300">
                            <div className="text-[10px] text-purple-700 font-semibold">If Big Tech copies you:</div>
                            <div className="text-xs text-muted-foreground">{results.playbook.dont_die_playbook.competitive_immunization.if_big_tech_copies_you}</div>
                          </div>
                        )}
                        {results.playbook.dont_die_playbook.competitive_immunization.if_funded_competitor_appears && (
                          <div className="pl-3 border-l-2 border-purple-300">
                            <div className="text-[10px] text-purple-700 font-semibold">If funded competitor appears:</div>
                            <div className="text-xs text-muted-foreground">{results.playbook.dont_die_playbook.competitive_immunization.if_funded_competitor_appears}</div>
                          </div>
                        )}
                        {results.playbook.dont_die_playbook.competitive_immunization.if_market_shifts && (
                          <div className="pl-3 border-l-2 border-purple-300">
                            <div className="text-[10px] text-purple-700 font-semibold">If market shifts:</div>
                            <div className="text-xs text-muted-foreground">{results.playbook.dont_die_playbook.competitive_immunization.if_market_shifts}</div>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Founder Warnings */}
                  {results.playbook.dont_die_playbook.founder_warnings?.length > 0 && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2 font-mono">⚠️ PERSONAL FOUNDER WARNINGS</div>
                      {results.playbook.dont_die_playbook.founder_warnings.map((w, i) => (
                        <div key={i} className="text-xs text-red-700 mb-1.5 last:mb-0 pl-3 border-l-2 border-red-300 leading-relaxed">{w}</div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── ANALYZE ANOTHER ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center pt-2">
            <Button variant="outline" onClick={reset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Analyze Another Idea
            </Button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
});

StartupAutopsyCard.displayName = 'StartupAutopsyCard';

export default StartupAutopsyCard;
