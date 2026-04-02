import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, BookOpen, Target, ChevronDown, ChevronUp, ExternalLink, Clock, DollarSign, Loader2, AlertTriangle, Sparkles, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';
import { toast } from 'sonner';

interface SkillArbitrageWidgetProps {
  report: ScanReport;
  scanId?: string;
}

interface ArbitrageResult {
  top_skill: {
    name: string;
    category: string;
    why_this_skill: string;
    roi_score: number;
    current_gap_severity: string;
    salary_uplift_pct: number;
    salary_uplift_range: string;
    demand_trend: string;
    time_to_competency_weeks: number;
    market_evidence: string;
  };
  runner_ups: Array<{
    name: string;
    roi_score: number;
    salary_uplift_pct: number;
    one_liner: string;
  }>;
  learning_plan: {
    phase_1: Phase;
    phase_2: Phase;
    phase_3: Phase;
  };
  arbitrage_insight: string;
  anti_skills: string[];
  _market_sources?: Array<{ title: string; url: string }>;
}

interface Phase {
  title: string;
  actions: string[];
  resources: Array<{ name: string; type: string; url_hint: string; cost: string }>;
  milestone: string;
}

export default function SkillArbitrageWidget({ report, scanId }: SkillArbitrageWidgetProps) {
  const [data, setData] = useState<ArbitrageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>('phase_1');
  const [showAntiSkills, setShowAntiSkills] = useState(false);

  const fetchArbitrage = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('skill-arbitrage', {
        body: { report, scanId },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      console.error('[SkillArbitrage] Error:', err);
      if (err?.message?.includes('429') || err?.status === 429) {
        toast.error('Rate limited — please try again in a minute');
      } else if (err?.message?.includes('402') || err?.status === 402) {
        toast.error('AI credits exhausted — contact support');
      } else {
        toast.error('Failed to analyze skill arbitrage');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'HIGH': return 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/20';
      case 'MODERATE': return 'text-primary bg-primary/10 border-primary/20';
      default: return 'text-prophet-green bg-prophet-green/10 border-prophet-green/20';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'SURGING': return '🚀';
      case 'GROWING': return '📈';
      case 'STABLE': return '➡️';
      default: return '📉';
    }
  };

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.02] p-6 text-center"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-base font-black text-foreground mb-1">Skill Arbitrage Engine</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
          Find the single highest-ROI skill to learn based on your profile, live market demand, and salary uplift data.
        </p>
        <button
          onClick={fetchArbitrage}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-bold text-sm hover:bg-foreground/90 transition-all disabled:opacity-50 min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing market data...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Find My Highest-ROI Skill
            </>
          )}
        </button>
      </motion.div>
    );
  }

  const { top_skill, runner_ups, learning_plan, arbitrage_insight, anti_skills } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Skill Arbitrage Engine</h3>
          <p className="text-[10px] text-muted-foreground">Live market intelligence · personalized ROI analysis</p>
        </div>
      </div>

      {/* Top Skill Card — Hero */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.06] to-transparent p-5"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-widest text-primary">#1 Highest ROI Skill</span>
            </div>
            <h4 className="text-xl font-black text-foreground">{top_skill.name}</h4>
            <span className="text-[10px] font-bold text-muted-foreground">{top_skill.category}</span>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary">{top_skill.roi_score}</p>
            <p className="text-[11px] font-bold text-muted-foreground uppercase">ROI Score</p>
          </div>
        </div>

        <p className="text-sm text-foreground/80 mb-4 leading-relaxed">{top_skill.why_this_skill}</p>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.05] p-2.5 text-center">
            <DollarSign className="w-3.5 h-3.5 text-prophet-green mx-auto mb-0.5" />
            <p className="text-sm font-black text-prophet-green">+{top_skill.salary_uplift_pct}%</p>
            <p className="text-[10px] text-muted-foreground">{top_skill.salary_uplift_range}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-2.5 text-center">
            <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
            <p className="text-sm font-black text-primary">{top_skill.time_to_competency_weeks}w</p>
            <p className="text-[10px] text-muted-foreground">To competency</p>
          </div>
          <div className={`rounded-xl border p-2.5 text-center ${getSeverityColor(top_skill.current_gap_severity)}`}>
            <AlertTriangle className="w-3.5 h-3.5 mx-auto mb-0.5" />
            <p className="text-[10px] font-black">{top_skill.current_gap_severity}</p>
            <p className="text-[10px] text-muted-foreground">Gap severity</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-2.5 text-center">
            <span className="text-sm">{getTrendIcon(top_skill.demand_trend)}</span>
            <p className="text-[10px] font-black text-foreground">{top_skill.demand_trend}</p>
            <p className="text-[10px] text-muted-foreground">Market trend</p>
          </div>
        </div>

        {top_skill.market_evidence && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Market Evidence</p>
            <p className="text-[11px] text-foreground/70">{top_skill.market_evidence}</p>
          </div>
        )}
      </motion.div>

      {/* Arbitrage Insight */}
      {arbitrage_insight && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-prophet-gold/20 bg-prophet-gold/[0.04] p-4"
        >
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-prophet-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-prophet-gold mb-1">Market Inefficiency Detected</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{arbitrage_insight}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 90-Day Learning Plan */}
      <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-black text-foreground uppercase tracking-tight">90-Day Learning Plan</h4>
          </div>
        </div>

        {(['phase_1', 'phase_2', 'phase_3'] as const).map((phaseKey, i) => {
          const phase = learning_plan[phaseKey];
          if (!phase) return null;
          const isOpen = expandedPhase === phaseKey;
          const phaseColors = [
            'border-primary/30 bg-primary/[0.03]',
            'border-prophet-gold/30 bg-prophet-gold/[0.03]',
            'border-prophet-green/30 bg-prophet-green/[0.03]',
          ];

          return (
            <div key={phaseKey} className="border-b border-border last:border-b-0">
              <button
                onClick={() => setExpandedPhase(isOpen ? null : phaseKey)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-foreground text-background">
                    {i + 1}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{phase.title}</p>
                    <p className="text-[10px] text-muted-foreground">{phase.milestone}</p>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`mx-4 mb-4 rounded-xl border ${phaseColors[i]} p-4 space-y-3`}>
                      {/* Actions */}
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Daily Actions</p>
                        <ul className="space-y-1">
                          {phase.actions.map((action, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
                              <span className="text-primary mt-0.5">▸</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Resources */}
                      {phase.resources && phase.resources.length > 0 && (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Resources</p>
                          <div className="space-y-1">
                            {phase.resources.map((res, j) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">{res.type}</span>
                                  <span className="font-medium text-foreground">{res.name}</span>
                                  <span className="text-muted-foreground">· {res.url_hint}</span>
                                </div>
                                <span className={`text-[10px] font-bold ${res.cost === 'Free' ? 'text-prophet-green' : 'text-foreground'}`}>
                                  {res.cost}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Milestone */}
                      <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-prophet-green mb-0.5">✓ Milestone</p>
                        <p className="text-xs text-foreground/80">{phase.milestone}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Runner-ups */}
      {runner_ups && runner_ups.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">Also Worth Considering</p>
          <div className="space-y-2">
            {runner_ups.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-muted-foreground">#{i + 2}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.one_liner}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-prophet-green">+{r.salary_uplift_pct}%</p>
                  <p className="text-[11px] text-muted-foreground">ROI: {r.roi_score}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anti-skills */}
      {anti_skills && anti_skills.length > 0 && (
        <div>
          <button
            onClick={() => setShowAntiSkills(!showAntiSkills)}
            className="flex items-center gap-2 text-xs font-bold text-destructive/70 hover:text-destructive transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            {showAntiSkills ? 'Hide' : 'Show'} Skills NOT to Invest In ({anti_skills.length})
          </button>
          <AnimatePresence>
            {showAntiSkills && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 rounded-xl border border-destructive/15 bg-destructive/[0.03] p-3 space-y-1.5"
              >
                {anti_skills.map((skill, i) => (
                  <p key={i} className="text-xs text-destructive/70 flex items-start gap-1.5">
                    <span className="mt-0.5">✗</span> {skill}
                  </p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Market sources provenance */}
      {data._market_sources && data._market_sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data._market_sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-2.5 h-2.5" /> {s.title.slice(0, 50)}
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
}
