import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Zap, TrendingUp, TrendingDown, AlertTriangle, Briefcase,
  Cpu, Newspaper, DollarSign, Flame, ChevronRight, RefreshCw,
  Sparkles, Shield, ArrowUpRight, Clock, Target
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Signal {
  category: string;
  urgency: string;
  headline: string;
  body: string;
  source_hint: string;
  action_item: string;
  relevance_score: number;
}

interface HotSkill {
  skill: string;
  why_now: string;
  demand_change: string;
  learn_signal: string;
}

interface MarketPulse {
  hiring_sentiment: string;
  avg_salary_trend: string;
  top_hiring_companies: string[];
  emerging_role: string;
}

interface RadarData {
  briefing_date: string;
  threat_level: string;
  threat_level_reason: string;
  signals: Signal[];
  hot_skill_of_the_week: HotSkill;
  market_pulse: MarketPulse;
  one_liner: string;
}

interface Props {
  role: string;
  industry: string;
  skills: string[];
  country?: string;
}

const CACHE_KEY = 'jb_market_radar';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

const categoryConfig: Record<string, { icon: React.ElementType; gradient: string; label: string }> = {
  AI_TOOL: { icon: Cpu, gradient: 'from-violet-500 to-purple-600', label: 'AI Tool' },
  INDUSTRY_NEWS: { icon: Newspaper, gradient: 'from-blue-500 to-cyan-600', label: 'Industry' },
  SALARY_SHIFT: { icon: DollarSign, gradient: 'from-emerald-500 to-green-600', label: 'Salary' },
  SKILL_TREND: { icon: TrendingUp, gradient: 'from-amber-500 to-orange-600', label: 'Skill Trend' },
  LAYOFF_ALERT: { icon: AlertTriangle, gradient: 'from-red-500 to-rose-600', label: 'Alert' },
  OPPORTUNITY: { icon: Sparkles, gradient: 'from-indigo-500 to-blue-600', label: 'Opportunity' },
};

const threatColors: Record<string, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  HIGH: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CRITICAL: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const threatEmoji: Record<string, string> = {
  LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴',
};

const MarketRadarWidget: React.FC<Props> = ({ role, industry, skills, country }) => {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null);

  const fetchRadar = async (force = false) => {
    setLoading(true);
    setError(null);

    // Check cache
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - (parsed.ts || 0) < CACHE_TTL) {
            setData(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke('market-radar', {
        body: { role, industry, skills: skills.slice(0, 8), country },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (result?.error) throw new Error(result.error);

      setData(result as RadarData);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
      } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load radar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role) fetchRadar();
  }, [role]);

  if (loading) {
    return (
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Radar className="w-10 h-10 text-primary/60" />
            </motion.div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-bold text-foreground">Scanning Market Signals...</p>
              <p className="text-xs text-muted-foreground">Analyzing AI tools, hiring trends & salary shifts for {role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchRadar(true)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const threat = data.threat_level || 'MEDIUM';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <Card className="border-border/40 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-violet-500/[0.03]" />
        <CardContent className="pt-5 pb-4 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <Radar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground tracking-tight">Market Radar</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Live career intelligence · {data.briefing_date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${threatColors[threat]} border text-[10px] font-bold px-2 py-0.5`}>
                {threatEmoji[threat]} {threat}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => fetchRadar(true)}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{data.threat_level_reason}</p>

          {/* One-liner */}
          <div className="rounded-lg bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10 px-3 py-2">
            <p className="text-xs font-semibold text-foreground italic">💡 {data.one_liner}</p>
          </div>
        </CardContent>
      </Card>

      {/* Signals */}
      <div className="space-y-2.5">
        {(data.signals || []).map((signal, i) => {
          const config = categoryConfig[signal.category] || categoryConfig.INDUSTRY_NEWS;
          const Icon = config.icon;
          const isExpanded = expandedSignal === i;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card
                className={`border-border/40 cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 group ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}
                onClick={() => setExpandedSignal(isExpanded ? null : i)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-border/60">
                          {config.label}
                        </Badge>
                        {signal.urgency === 'HIGH' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
                            <Flame className="w-3 h-3" /> URGENT
                          </span>
                        )}
                        <span className="ml-auto text-[9px] text-muted-foreground font-mono">
                          {signal.relevance_score}%
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {signal.headline}
                      </p>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                              {signal.body}
                            </p>
                            <div className="mt-2.5 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                              <div className="flex items-start gap-1.5">
                                <Target className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                <p className="text-xs font-semibold text-foreground">{signal.action_item}</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-1.5 italic">
                              📎 {signal.source_hint}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground/50 transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom row: Hot Skill + Market Pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hot Skill */}
        {data.hot_skill_of_the_week && (
          <Card className="border-border/40 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent" />
            <CardContent className="py-4 relative">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-black text-foreground tracking-tight">🔥 HOT SKILL</span>
              </div>
              <p className="text-lg font-black text-foreground mb-1">{data.hot_skill_of_the_week.skill}</p>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold mb-2">
                {data.hot_skill_of_the_week.demand_change}
              </Badge>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.hot_skill_of_the_week.why_now}</p>
              <p className="text-[10px] text-primary font-semibold mt-2">📚 {data.hot_skill_of_the_week.learn_signal}</p>
            </CardContent>
          </Card>
        )}

        {/* Market Pulse */}
        {data.market_pulse && (
          <Card className="border-border/40 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent" />
            <CardContent className="py-4 relative">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-black text-foreground tracking-tight">📊 MARKET PULSE</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">Hiring</span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {data.market_pulse.hiring_sentiment === 'Expanding' ? '📈' :
                     data.market_pulse.hiring_sentiment === 'Contracting' ? '📉' : '➡️'} {data.market_pulse.hiring_sentiment}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">Salary</span>
                  <span className="text-[11px] font-bold text-foreground">{data.market_pulse.avg_salary_trend}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium block mb-1">Hiring Now</span>
                  <div className="flex flex-wrap gap-1">
                    {(data.market_pulse.top_hiring_companies || []).map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-semibold">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded bg-indigo-500/5 border border-indigo-500/10 px-2 py-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">Emerging: </span>
                  <span className="text-[10px] font-bold text-foreground">{data.market_pulse.emerging_role}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
};

export default MarketRadarWidget;
