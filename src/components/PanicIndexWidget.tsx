import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Activity, AlertTriangle, BarChart3, Newspaper, Zap, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';

interface PersonalizedArticle {
  title: string;
  summary: string;
  source: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
  category: 'layoffs' | 'ai_adoption' | 'hiring' | 'salary' | 'policy' | 'skills';
}

interface RoleContext {
  rank: number;
  total: number;
  percentile: number;
  your_posting_change: number;
  your_ai_mentions: number;
  your_market_health: string;
}

interface LivePulse {
  articles: PersonalizedArticle[];
  headlines: string[];
  sentiment: string | null;
  ai_evidence: string | null;
  hiring_pulse: string | null;
  salary_direction: string | null;
  most_threatened_task: string | null;
  key_insight: string | null;
  citations: string[];
}

interface PanicData {
  panic_level: string;
  jobs_at_risk_this_week: number;
  trend: string;
  avg_posting_change: number;
  avg_ai_mentions: number;
  declining_roles: { role: string; decline_pct: number; ai_mentions: number; market_health: string }[];
  growing_roles: { role: string; growth_pct: number }[];
  overall: { total_roles_tracked: number; roles_declining: number; roles_booming: number };
  seniority_tier?: string;
  role_context?: RoleContext | null;
  live_pulse?: LivePulse | null;
  generated_at: string;
}

const PANIC_COLORS: Record<string, string> = {
  critical: 'text-prophet-red',
  high: 'text-prophet-red',
  moderate: 'text-prophet-gold',
  low: 'text-prophet-green',
};

const PANIC_BG: Record<string, string> = {
  critical: 'bg-prophet-red/10 border-prophet-red/30',
  high: 'bg-prophet-red/5 border-prophet-red/20',
  moderate: 'bg-prophet-gold/5 border-prophet-gold/20',
  low: 'bg-prophet-green/5 border-prophet-green/20',
};

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-prophet-red/10 text-prophet-red border-prophet-red/20',
  medium: 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  layoffs: { icon: '🚨', label: 'Layoffs' },
  ai_adoption: { icon: '🤖', label: 'AI Adoption' },
  hiring: { icon: '📈', label: 'Hiring' },
  salary: { icon: '💰', label: 'Salary' },
  policy: { icon: '📋', label: 'Policy' },
  skills: { icon: '🎯', label: 'Skills' },
};

interface PanicIndexWidgetProps {
  industry?: string;
  role?: string;
}

export default function PanicIndexWidget({ industry, role }: PanicIndexWidgetProps) {
  const [data, setData] = useState<PanicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPanic() {
      try {
        const params = new URLSearchParams();
        if (industry) params.set('industry', industry);
        if (role) params.set('role', role);

        const url = `${SUPABASE_URL}/functions/v1/panic-index?${params.toString()}`;
        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
        });

        if (resp.ok) {
          setData(await resp.json());
        }
      } catch (e) {
        console.error('Panic index fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchPanic();
  }, [industry, role]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-4" />
        <div className="h-8 bg-muted rounded w-1/2 mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    );
  }

  if (!data) return null;

  const panicColor = PANIC_COLORS[data.panic_level] || 'text-muted-foreground';
  const panicBg = PANIC_BG[data.panic_level] || 'bg-muted border-border';
  const articles = data.live_pulse?.articles || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-prophet-red" />
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
          Your Industry Pulse {role && <span className="normal-case font-medium">— {role}</span>}
        </h2>
        <span className="flex h-2 w-2 relative ml-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-prophet-red opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-prophet-red" />
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3 ml-6">
        Hyper-personalized intelligence for your exact role. Updated in real-time from live market data and industry sources.
      </p>

      <div className={`rounded-2xl border-2 ${panicBg} p-5 md:p-6`}>
        {/* Personal Role Context Banner */}
        {data.role_context && (
          <div className="mb-4 rounded-xl bg-background border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Your Role's Position</p>
                <p className="text-sm text-foreground">
                  <span className="font-black text-primary">#{data.role_context.rank}</span>
                  <span className="text-muted-foreground"> of {data.role_context.total} roles by risk</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className={`font-bold ${data.role_context.percentile > 70 ? 'text-prophet-green' : data.role_context.percentile > 40 ? 'text-prophet-gold' : 'text-prophet-red'}`}>
                    Safer than {data.role_context.percentile}% of tracked roles
                  </span>
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-black px-2 py-1 rounded-full ${
                  data.role_context.your_market_health === 'booming' ? 'bg-prophet-green/10 text-prophet-green' :
                  data.role_context.your_market_health === 'declining' ? 'bg-prophet-red/10 text-prophet-red' :
                  'bg-prophet-gold/10 text-prophet-gold'
                } uppercase`}>
                  {data.role_context.your_market_health}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center rounded-lg bg-muted/50 py-2">
                <p className="text-[10px] text-muted-foreground">Your Postings Trend</p>
                <p className={`text-sm font-black ${data.role_context.your_posting_change < 0 ? 'text-prophet-red' : 'text-prophet-green'}`}>
                  {data.role_context.your_posting_change > 0 ? '+' : ''}{data.role_context.your_posting_change}%
                </p>
              </div>
              <div className="text-center rounded-lg bg-muted/50 py-2">
                <p className="text-[10px] text-muted-foreground">Your AI Exposure</p>
                <p className="text-sm font-black text-prophet-gold">{data.role_context.your_ai_mentions}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Key Insight Banner */}
        {data.live_pulse?.key_insight && (
          <div className="mb-4 rounded-xl bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-foreground leading-relaxed">{data.live_pulse.key_insight}</p>
            </div>
          </div>
        )}

        {/* Top row: panic level + stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Market Panic Level</p>
            <p className={`text-3xl font-black uppercase ${panicColor}`}>
              {data.panic_level}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trend</p>
            <div className="flex items-center gap-1.5">
              {data.trend === 'growing' ? (
                <TrendingUp className="w-4 h-4 text-prophet-green" />
              ) : (
                <TrendingDown className="w-4 h-4 text-prophet-red" />
              )}
              <span className={`text-sm font-bold ${
                data.trend === 'growing' ? 'text-prophet-green' : 'text-prophet-red'
              }`}>
                {data.trend}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-background p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">Postings</p>
            <p className={`text-lg font-black ${(data.avg_posting_change ?? 0) < 0 ? 'text-prophet-red' : 'text-prophet-green'}`}>
              {(data.avg_posting_change ?? 0) > 0 ? '+' : ''}{data.avg_posting_change ?? 0}%
            </p>
          </div>
          <div className="rounded-xl bg-background p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">AI Mentions</p>
            <p className="text-lg font-black text-prophet-gold">{data.avg_ai_mentions ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-background p-3 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              {data.live_pulse?.salary_direction === 'rising' ? '📈 Salary' : data.live_pulse?.salary_direction === 'declining' ? '📉 Salary' : '➡️ Salary'}
            </p>
            <p className={`text-lg font-black capitalize ${
              data.live_pulse?.salary_direction === 'rising' ? 'text-prophet-green' :
              data.live_pulse?.salary_direction === 'declining' ? 'text-prophet-red' : 'text-foreground'
            }`}>
              {data.live_pulse?.salary_direction || 'N/A'}
            </p>
          </div>
        </div>

        {/* Live Threat Indicators */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {data.live_pulse?.hiring_pulse && (
            <div className="rounded-lg bg-background border border-border p-3">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Hiring Pulse</p>
              <p className="text-xs text-foreground leading-relaxed">{data.live_pulse.hiring_pulse}</p>
            </div>
          )}
          {data.live_pulse?.most_threatened_task && (
            <div className="rounded-lg bg-prophet-red/5 border border-prophet-red/10 p-3">
              <p className="text-[10px] text-prophet-red font-bold uppercase tracking-wide mb-1">Most At-Risk Task</p>
              <p className="text-xs text-foreground leading-relaxed">{data.live_pulse.most_threatened_task}</p>
            </div>
          )}
        </div>

        {/* ═══ PERSONALIZED INTELLIGENCE FEED ═══ */}
        {articles.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-primary" />
              <p className="text-xs font-black text-primary uppercase tracking-widest">
                Your Personalized Intelligence Feed
              </p>
              <span className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" />
            </div>

            <div className="space-y-2.5">
              {articles.map((article, i) => {
                const cat = CATEGORY_LABELS[article.category] || { icon: '📰', label: article.category };
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4 + i * 0.08 }}
                    className="rounded-xl bg-background border border-border p-3.5 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                        article.impact === 'high' ? 'bg-prophet-red/10' :
                        article.impact === 'medium' ? 'bg-prophet-gold/10' : 'bg-muted'
                      }`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded border ${IMPACT_STYLES[article.impact]}`}>
                            {article.impact} impact
                          </span>
                          <span className="text-[11px] text-muted-foreground font-semibold">{cat.label}</span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">{article.date}</span>
                        </div>
                        <p className="text-sm font-bold text-foreground leading-tight mb-1">{article.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">{article.source}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Evidence */}
        {data.live_pulse?.ai_evidence && (
          <p className="text-[10px] text-muted-foreground italic mb-3">
            🤖 {data.live_pulse.ai_evidence}
          </p>
        )}

        {/* Citations */}
        {data.live_pulse && data.live_pulse.citations.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-muted-foreground font-semibold mb-1">Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {data.live_pulse.citations.slice(0, 5).map((c, i) => (
                <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-primary/70 hover:text-primary px-1.5 py-0.5 rounded bg-primary/5 hover:bg-primary/10 transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />
                  [{i + 1}]
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{data.overall?.roles_declining ?? 0} declining</span>
            <span>•</span>
            <span>{data.overall?.roles_booming ?? 0} booming</span>
            {data.live_pulse && <span className="text-prophet-green font-semibold">• Live data</span>}
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
