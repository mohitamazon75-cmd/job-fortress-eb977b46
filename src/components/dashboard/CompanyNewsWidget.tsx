import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, AlertTriangle, CheckCircle, Minus, Loader2, Building2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyNewsItem {
  headline: string;
  summary: string;
  impact: 'positive' | 'negative' | 'neutral';
  relevance: 'high' | 'medium';
  skill_impact?: string | null;
  date_signal?: string | null;
}

interface CompanyNewsData {
  news: CompanyNewsItem[];
  ai_readiness_signal?: string;
  employee_risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  sources?: string[];
  is_industry_level?: boolean;
  fetched_at?: string;
  search_grounded?: boolean;
}

interface CompanyNewsWidgetProps {
  company: string;
  industry: string;
  role?: string;
  skills?: string[];
}

export default function CompanyNewsWidget({ company, industry, role, skills }: CompanyNewsWidgetProps) {
  const [data, setData] = useState<CompanyNewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }

    // 30-minute sessionStorage cache
    const cacheKey = `jb_widget_companynews_${company}_${industry}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 30 * 60 * 1000) {
          setData(parsed.data);
          setLoading(false);
          return;
        }
      }
    } catch {}

    supabase.functions.invoke('market-signals', {
      body: { signal_type: 'company', company, industry, role, skills },
    }).then(({ data: result, error: err }) => {
      if (!err && result?.news?.length > 0) {
        setData(result);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() })); } catch {}
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [company, industry, role]);

  if (!company || error) return null;

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{company} — AI Intelligence</h3>
            <p className="text-xs text-muted-foreground">Searching live news sources...</p>
          </div>
          <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
        </div>
      </motion.div>
    );
  }

  if (!data || data.news.length === 0) return null;

  const riskColors = {
    LOW: 'text-prophet-green bg-prophet-green/10 border-prophet-green/30',
    MEDIUM: 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/30',
    HIGH: 'text-prophet-red bg-prophet-red/10 border-prophet-red/30',
  };

  const impactIcons = {
    positive: <CheckCircle className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />,
    negative: <AlertTriangle className="w-3.5 h-3.5 text-prophet-red flex-shrink-0" />,
    neutral: <Minus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />,
  };

  const isIndustryLevel = data.is_industry_level;

  // Format freshness
  const getFreshnessLabel = () => {
    if (!data.fetched_at) return null;
    const fetchedDate = new Date(data.fetched_at);
    const now = new Date();
    const diffMs = now.getTime() - fetchedDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return fetchedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const freshness = getFreshnessLabel();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mb-6"
    >
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {isIndustryLevel ? <Building2 className="w-4 h-4 text-primary" /> : <Newspaper className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  {isIndustryLevel ? `📊 ${industry} — AI Trends` : `🔍 ${company} — AI Intelligence`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isIndustryLevel
                    ? `Industry trends affecting ${role || 'your role'} at companies like ${company}`
                    : `Real-time news about ${company}'s AI strategy`}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" />
                <span className="text-xs font-semibold text-prophet-green">LIVE</span>
              </div>
              {freshness && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{freshness}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Industry-level disclaimer */}
        {isIndustryLevel && (
          <div className="px-5 pb-2">
            <p className="text-[10px] text-muted-foreground italic">
              No company-specific news found for {company}. Showing {industry} industry AI trends relevant to your role.
            </p>
          </div>
        )}

        {/* AI Readiness Signal */}
        {data.ai_readiness_signal && (
          <div className="px-5 pb-3">
            <div className={`rounded-lg border p-3 ${riskColors[data.employee_risk_level || 'MEDIUM']}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {isIndustryLevel ? 'Industry Risk' : 'Employee Risk'}: {data.employee_risk_level}
                </span>
              </div>
              <p className="text-xs opacity-90">{data.ai_readiness_signal}</p>
            </div>
          </div>
        )}

        {/* News Items */}
        <div className="px-5 pb-4 space-y-3">
          {data.news.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="rounded-lg border border-border/50 p-3"
            >
              <div className="flex items-start gap-2">
                {impactIcons[item.impact]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground leading-tight">{item.headline}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.skill_impact && (
                      <p className="text-[10px] text-primary font-semibold">
                        ⚡ Affects your skill: {item.skill_impact}
                      </p>
                    )}
                    {item.date_signal && (
                      <span className="text-[11px] text-muted-foreground/70 font-medium">
                        📅 {item.date_signal}
                      </span>
                    )}
                  </div>
                </div>
                {item.relevance === 'high' && (
                  <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                    HIGH
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sources */}
        {data.sources && data.sources.length > 0 && (
          <div className="px-5 py-3 bg-muted/30 border-t border-border/50">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Sources: {data.sources.length} verified articles • Search-grounded intelligence</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
