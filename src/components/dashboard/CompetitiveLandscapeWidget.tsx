import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Compass, ArrowRight, TrendingUp, TrendingDown, Minus, Clock, Sparkles, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CompetitiveLandscapeWidgetProps {
  currentRole: string;
  industry: string;
  currentDI: number;
  skills?: string[];
  country?: string | null;
}

interface Transition {
  role: string;
  is_current: boolean;
  skill_overlap_pct: number;
  demand_trend: string;
  ai_risk_pct?: number; // deprecated — legacy scans only
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  transition_difficulty: string;
  why_viable: string;
  salary_delta: string;
  time_to_transition: string;
}

/** Map risk_level enum to a numeric proxy for backward-compatible rendering */
function transitionRiskNumeric(t: Transition): number {
  if (t.risk_level) {
    if (t.risk_level === 'HIGH') return 75;
    if (t.risk_level === 'MEDIUM') return 45;
    return 20; // LOW
  }
  return t.ai_risk_pct ?? 50;
}

/** Risk level label + color */
function transitionRiskBadge(t: Transition): { label: string; color: string } {
  const level = t.risk_level ?? (t.ai_risk_pct != null ? (t.ai_risk_pct >= 60 ? 'HIGH' : t.ai_risk_pct >= 35 ? 'MEDIUM' : 'LOW') : 'MEDIUM');
  if (level === 'HIGH') return { label: 'HIGH', color: 'text-destructive' };
  if (level === 'MEDIUM') return { label: 'MEDIUM', color: 'text-prophet-gold' };
  return { label: 'LOW', color: 'text-prophet-green' };
}

interface LandscapeData {
  transitions: Transition[];
  strategy_insight: string;
  citations: string[];
}

const SESSION_KEY_PREFIX = 'jb_landscape_';

export default function CompetitiveLandscapeWidget({ currentRole, industry, currentDI, skills, country }: CompetitiveLandscapeWidgetProps) {
  const [data, setData] = useState<LandscapeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionKey = `${SESSION_KEY_PREFIX}${currentRole}_${industry}`;
    let cancelled = false;

    const run = async () => {
      // Session cache
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const p = JSON.parse(cached);
          if (p?.data && Date.now() - (p.ts || 0) < 30 * 60 * 1000) {
            if (!cancelled) { setData(p.data); setLoading(false); }
            return;
          }
        }
      } catch {}

      try {
        const { data: result, error } = await supabase.functions.invoke('market-signals', {
          body: { signal_type: 'landscape', role: currentRole, industry, skills, currentDI, country },
        });

        if (!error && result && !result.error && !cancelled) {
          setData(result as LandscapeData);
          try { sessionStorage.setItem(sessionKey, JSON.stringify({ data: result, ts: Date.now() })); } catch {}
        }
      } catch {}

      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [currentRole, industry]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Compass className="w-4 h-4 text-primary animate-spin" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.transitions?.length) return null;

  const getDemandIcon = (trend: string) => {
    if (trend === 'booming' || trend === 'growing') return <TrendingUp className="w-3.5 h-3.5 text-prophet-green" />;
    if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const getDemandColor = (trend: string) => {
    if (trend === 'booming') return 'text-prophet-green bg-prophet-green/10';
    if (trend === 'growing') return 'text-prophet-green/80 bg-prophet-green/8';
    if (trend === 'declining') return 'text-destructive bg-destructive/10';
    return 'text-prophet-gold bg-prophet-gold/10';
  };

  const getDifficultyStyle = (d: string) => {
    if (d === 'easy') return { label: 'Easy', color: 'text-prophet-green', bg: 'bg-prophet-green/10' };
    if (d === 'hard') return { label: 'Hard', color: 'text-destructive', bg: 'bg-destructive/10' };
    return { label: 'Moderate', color: 'text-prophet-gold', bg: 'bg-prophet-gold/10' };
  };

  const getRiskBarColor = (risk: number) => {
    if (risk >= 60) return 'bg-destructive';
    if (risk >= 35) return 'bg-prophet-gold';
    return 'bg-prophet-green';
  };

  const escapeZones = data.transitions.filter(t => !t.is_current && transitionRiskNumeric(t) < currentDI && t.demand_trend !== 'declining');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5 md:p-6 mb-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Compass className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Lateral Transition Map</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> AI-Analyzed
            </span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4 ml-11">
        Realistic lateral moves based on your skill overlap · Sorted by transition feasibility
      </p>

      {/* Escape Zones Banner */}
      {escapeZones.length > 0 && (
        <div className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.04] p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-prophet-green">
              🎯 {escapeZones.length} Lower-Risk Transition{escapeZones.length > 1 ? 's' : ''} Found
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {escapeZones.slice(0, 4).map(t => (
              <span key={t.role} className="text-[11px] px-2.5 py-1 rounded-lg bg-prophet-green/10 text-prophet-green font-semibold">
                {t.role} <span className="text-prophet-green/60">({t.salary_delta})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Transition Cards */}
      <div className="space-y-2">
        {data.transitions.map((t, i) => {
          const diff = getDifficultyStyle(t.transition_difficulty);
          return (
            <motion.div
              key={t.role}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`relative rounded-xl border overflow-hidden transition-colors ${
                t.is_current
                  ? 'border-primary/30 bg-primary/[0.04] ring-1 ring-primary/20'
                  : 'border-border bg-background hover:border-primary/20'
              }`}
            >
              {/* AI Risk micro-bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-muted">
                <div className={`h-full ${getRiskBarColor(t.ai_risk_pct)}`} style={{ width: `${t.ai_risk_pct}%` }} />
              </div>

              <div className="p-3 pt-3.5">
                <div className="flex items-start gap-3">
                  {/* Skill overlap ring */}
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        stroke={t.is_current ? 'hsl(var(--primary))' : t.skill_overlap_pct >= 60 ? 'hsl(var(--prophet-green))' : 'hsl(var(--prophet-gold))'}
                        strokeWidth="3"
                        strokeDasharray={`${t.skill_overlap_pct * 0.975} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-foreground">
                      {t.skill_overlap_pct}%
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{t.role}</span>
                      {t.is_current && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider">You</span>
                      )}
                      {!t.is_current && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${diff.bg} ${diff.color}`}>
                          {diff.label}
                        </span>
                      )}
                    </div>

                    {/* Metrics row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        {getDemandIcon(t.demand_trend)}
                        <span className={`text-[10px] font-bold capitalize ${getDemandColor(t.demand_trend).split(' ')[0]}`}>
                          {t.demand_trend}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        AI Risk: <span className={`font-bold ${t.ai_risk_pct >= 50 ? 'text-destructive' : 'text-prophet-green'}`}>{t.ai_risk_pct}%</span>
                      </span>
                      {!t.is_current && (
                        <>
                          <span className="text-[10px] font-bold text-prophet-green">{t.salary_delta}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" /> {t.time_to_transition}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Why viable */}
                    {!t.is_current && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                        <ArrowRight className="w-3 h-3 inline text-primary mr-0.5" />
                        {t.why_viable}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Strategy Insight */}
      {data.strategy_insight && (
        <div className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Strategic Recommendation</p>
          <p className="text-xs text-foreground leading-relaxed">{data.strategy_insight}</p>
        </div>
      )}

      {/* Citations */}
      {data.citations?.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground/50">Sources:</span>
          {data.citations.slice(0, 4).map((c, i) => (
            <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground/50 hover:text-primary underline underline-offset-2 flex items-center gap-0.5">
              [{i + 1}] <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
}
