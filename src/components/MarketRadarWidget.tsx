import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, AlertTriangle, Briefcase,
  Cpu, Newspaper, DollarSign, Flame, ChevronRight, RefreshCw,
  Sparkles, Target, TrendingUp, Share2, Check, Users,
  ExternalLink, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Signal {
  category: string;
  urgency: string;
  headline: string;
  body: string;
  source_hint?: string; // legacy
  source?: string; // new grounded source
  action_item: string;
  relevance_score?: number; // legacy, no longer generated
  urgency_reason?: string;
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

interface ClosingVerdict {
  status: string;
  message: string;
  share_hook: string;
}

interface RadarData {
  briefing_date: string;
  threat_level: string;
  threat_level_reason: string;
  signals: Signal[];
  hot_skill_of_the_week: HotSkill;
  market_pulse: MarketPulse;
  closing_verdict?: ClosingVerdict;
  one_liner: string;
  citations?: string[];
  generated_at?: string;
}

interface Props {
  role: string;
  industry: string;
  skills: string[];
  country?: string;
  scanId?: string;
  onComplete?: () => void;
}

const CACHE_KEY_PREFIX = 'jb_market_radar';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function buildCacheKey(role: string, industry: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  return `${CACHE_KEY_PREFIX}_${clean(role)}_${clean(industry || 'tech')}`;
}

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

const urgencyBorderColors: Record<string, string> = {
  HIGH: 'border-l-4 border-l-red-400',
  MEDIUM: 'border-l-4 border-l-amber-400',
  LOW: 'border-l-4 border-l-border',
};

const verdictColors: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  AHEAD: { bg: 'from-emerald-500/10 to-green-500/5', border: 'border-emerald-500/20', text: 'text-emerald-700', emoji: '🏆' },
  ON_TRACK: { bg: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-500/20', text: 'text-blue-700', emoji: '✅' },
  AT_RISK: { bg: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/20', text: 'text-amber-700', emoji: '⚠️' },
};

function getTimeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

const MarketRadarWidget: React.FC<Props> = ({ role, industry, skills, country, scanId, onComplete }) => {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Fetch real scan count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('scans')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', thirtyDaysAgo);
        if (count !== null && count >= 10) {
          setScanCount(Math.floor(count / 10) * 10);
        }
      } catch {}
    };
    fetchCount();
  }, []);

  const cacheKey = buildCacheKey(role, industry);

  const fetchRadar = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setIsCached(false);

    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - (parsed.ts || 0) < CACHE_TTL) {
            setData(parsed.data);
            setIsCached(true);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    try {
      // Pass 2.5: prefer 7-day weekly cache via refresh-peripheral-tabs.
      // Falls back to direct invoke if cache call fails or returns no payload.
      let result: RadarData | null = null;
      if (scanId) {
        try {
          const { data: cacheRes, error: cacheErr } = await supabase.functions.invoke('refresh-peripheral-tabs', {
            body: {
              scanId,
              surfaces: ['market_radar'],
              extra: { skills: skills.slice(0, 8) },
            },
          });
          if (!cacheErr && cacheRes?.surfaces?.market_radar?.payload) {
            result = cacheRes.surfaces.market_radar.payload as RadarData;
          }
        } catch { /* fall through to direct */ }
      }

      if (!result) {
        const { data: direct, error: fnErr } = await supabase.functions.invoke('market-radar', {
          body: { role, industry, skills: skills.slice(0, 8), country, scanId },
        });
        if (fnErr) throw new Error(fnErr.message);
        if (direct?.error) throw new Error(direct.error);
        result = direct as RadarData;
      }

      setData(result);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() }));
      } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load radar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [role, industry, skills, country, scanId, cacheKey]);

  useEffect(() => {
    if (role) fetchRadar();
  }, [role, fetchRadar]);

  const handleShare = async () => {
    const shareText = `🔍 Just got my personalized AI career intelligence report from JobBachao — the Market Radar card alone is worth it.\n\nMy role (${role}) threat level: ${data?.threat_level}\nHot skill this week: ${data?.hot_skill_of_the_week?.skill}\n\nGet yours free → ${window.location.origin}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JobBachao Market Radar', text: shareText });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        toast.success('Copied! Share it with your team');
        setTimeout(() => setCopied(false), 3000);
      } catch {}
    }
  };

  if (loading) {
    return (
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center"
              >
                <Radar className="w-8 h-8 text-primary" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-2xl border-2 border-primary/30"
              />
            </div>
            <div className="space-y-1.5 text-center">
              <p className="text-sm font-black text-foreground">Building Your Live Market Radar</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Scanning AI releases, hiring signals & salary shifts for <span className="font-semibold text-foreground">{role}</span>
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
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
  const verdict = data.closing_verdict;
  const verdictStyle = verdictColors[verdict?.status || 'ON_TRACK'] || verdictColors.ON_TRACK;
  const generatedAt = data.generated_at;
  const hasCitations = (data.citations || []).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Header */}
      <Card className="border-border/40 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-500/[0.04]" />
        <CardContent className="pt-5 pb-4 relative">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/25">
                <Radar className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground tracking-tight">Live Market Radar</h3>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Intelligence for <span className="text-foreground font-semibold">{role}</span> · {data.briefing_date}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={`${threatColors[threat]} border text-[10px] font-bold px-2.5 py-0.5`}>
                {threat === 'LOW' ? '🟢' : threat === 'MEDIUM' ? '🟡' : threat === 'HIGH' ? '🟠' : '🔴'} {threat}
              </Badge>
              {/* Freshness indicator */}
              <div className="flex items-center gap-1">
                {generatedAt && (
                  <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {getTimeAgo(generatedAt)}
                    {isCached && ' (cached)'}
                  </span>
                )}
                {isCached && (
                  <button
                    onClick={() => fetchRadar(true)}
                    className="text-[9px] text-primary font-semibold hover:underline"
                  >
                    Refresh
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{data.threat_level_reason}</p>

          {/* Fortune cookie */}
          <div className="rounded-xl bg-gradient-to-r from-primary/[0.06] via-violet-500/[0.04] to-primary/[0.06] border border-primary/10 px-4 py-2.5">
            <p className="text-[13px] font-bold text-foreground italic leading-snug">💡 "{data.one_liner}"</p>
          </div>
        </CardContent>
      </Card>

      {/* Signals — with urgency-based left border */}
      <div className="space-y-2.5">
        {(data.signals || []).map((signal, i) => {
          const config = categoryConfig[signal.category] || categoryConfig.INDUSTRY_NEWS;
          const Icon = config.icon;
          const isExpanded = expandedSignal === i;
          const urgencyBorder = urgencyBorderColors[signal.urgency] || urgencyBorderColors.LOW;
          const signalSource = signal.source || signal.source_hint;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className={`${urgencyBorder} border-border/40 cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 group ${isExpanded ? 'ring-1 ring-primary/20 shadow-md' : ''}`}
                onClick={() => setExpandedSignal(isExpanded ? null : i)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-border/60">
                          {config.label}
                        </Badge>
                        {signal.urgency === 'HIGH' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
                            <Flame className="w-3 h-3" /> URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
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
                            <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                              {signal.body}
                            </p>
                            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/10 px-3.5 py-2.5">
                              <div className="flex items-start gap-2">
                                <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Do this today</p>
                                  <p className="text-xs font-semibold text-foreground">{signal.action_item}</p>
                                </div>
                              </div>
                            </div>
                            {signalSource && (
                              <p className="text-[10px] text-muted-foreground/60 mt-2 italic">
                                📎 {signalSource}
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground/40 transition-transform flex-shrink-0 mt-1.5 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Hot Skill + Market Pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.hot_skill_of_the_week && (
          <Card className="border-border/40 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.05] to-transparent" />
            <CardContent className="py-4 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                  <Flame className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-black text-foreground tracking-tight">🔥 HOT SKILL</span>
              </div>
              <p className="text-lg font-black text-foreground mb-1.5">{data.hot_skill_of_the_week.skill}</p>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold mb-2.5">
                {data.hot_skill_of_the_week.demand_change}
              </Badge>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{data.hot_skill_of_the_week.why_now}</p>
              <p className="text-[11px] text-primary font-bold">📚 {data.hot_skill_of_the_week.learn_signal}</p>
            </CardContent>
          </Card>
        )}

        {data.market_pulse && (
          <Card className="border-border/40 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] to-transparent" />
            <CardContent className="py-4 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Briefcase className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-black text-foreground tracking-tight">📊 MARKET PULSE</span>
              </div>
              <div className="space-y-2.5">
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
                  <span className="text-[11px] text-muted-foreground font-medium block mb-1">Top Hiring</span>
                  <div className="flex flex-wrap gap-1">
                    {(data.market_pulse.top_hiring_companies || []).map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-semibold">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1.5">
                  <span className="text-[10px] text-muted-foreground">Emerging role: </span>
                  <span className="text-[10px] font-bold text-foreground">{data.market_pulse.emerging_role}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Citations — real sources from Tavily */}
      {hasCitations && (
        <Card className="border-border/40">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📎 Sources</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {data.citations!.map((url, i) => {
                let domain = '';
                try { domain = new URL(url).hostname.replace('www.', ''); } catch { domain = url; }
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary/70 hover:text-primary hover:underline flex items-center gap-0.5 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {domain}
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closing Verdict — The Grand Finale */}
      {verdict && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
        >
          <Card className={`border ${verdictStyle.border} overflow-hidden relative`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${verdictStyle.bg}`} />
            <CardContent className="py-6 relative">
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 15 }}
                  className="text-4xl"
                >
                  {verdictStyle.emoji}
                </motion.div>

                <div>
                  <Badge className={`${verdictStyle.border} border ${verdictStyle.text} bg-transparent text-xs font-black px-3 py-0.5 mb-3`}>
                    YOUR MARKET STATUS: {verdict.status?.replace('_', ' ')}
                  </Badge>
                  <p className={`text-sm font-bold ${verdictStyle.text} leading-relaxed max-w-md mx-auto`}>
                    {verdict.message}
                  </p>
                </div>

                {/* Share hook */}
                <div className="pt-2 border-t border-border/30 mt-4">
                  <p className="text-xs text-muted-foreground italic mb-3 max-w-sm mx-auto">
                    💬 {verdict.share_hook}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      onClick={handleShare}
                      size="sm"
                      className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/20 text-xs font-bold px-5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Share with a colleague'}
                    </Button>
                  </div>
                </div>

                {/* Real social proof */}
                {scanCount !== null && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    {scanCount}+ professionals scanned their careers this month
                  </motion.p>
                )}

                {/* Continue CTA */}
                {onComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="pt-4"
                  >
                    <Button onClick={onComplete} size="lg" className="w-full gap-2 text-base font-bold">
                      Complete Your Report
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MarketRadarWidget;
