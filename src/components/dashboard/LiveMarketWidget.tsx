import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Loader2, BarChart3, Briefcase, IndianRupee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ScanReport } from '@/lib/scan-engine';

interface LiveMarketData {
  salary_range_lpa: { min: number; max: number; median: number };
  job_postings_trend: 'growing' | 'declining' | 'stable';
  posting_change_pct: number;
  ai_disruption_level: 'LOW' | 'MEDIUM' | 'HIGH';
  key_findings: string[];
  top_hiring_companies: string[];
  in_demand_skills: string[];
}

interface LiveMarketWidgetProps {
  report: ScanReport;
}

export default function LiveMarketWidget({ report }: LiveMarketWidgetProps) {
  const [data, setData] = useState<LiveMarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const role = report.role;
  const industry = report.industry;
  const metroTier = 'tier1';

  useEffect(() => {
    if (!role && !industry) { setLoading(false); return; }

    // 30-minute sessionStorage cache
    const cacheKey = `jb_widget_livemarket_${role}_${industry}`.toLowerCase().replace(/\s+/g, '_');
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
      body: { signal_type: 'market', role, industry, metroTier },
    }).then(({ data: result, error: err }) => {
      if (!err && result && !result.error) {
        setData(result);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() })); } catch {}
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [role, industry, metroTier]);

  if (error || (!loading && !data)) return null;

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Live Market Intelligence</h3>
            <p className="text-xs text-muted-foreground">Fetching real-time data for {role}...</p>
          </div>
          <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}
        </div>
      </motion.div>
    );
  }

  const trendIcon = data!.job_postings_trend === 'growing'
    ? <TrendingUp className="w-4 h-4 text-prophet-green" />
    : data!.job_postings_trend === 'declining'
    ? <TrendingDown className="w-4 h-4 text-prophet-red" />
    : <Minus className="w-4 h-4 text-muted-foreground" />;

  const trendColor = data!.job_postings_trend === 'growing' ? 'text-prophet-green' : data!.job_postings_trend === 'declining' ? 'text-prophet-red' : 'text-prophet-gold';

  const disruptionColors = {
    LOW: 'bg-prophet-green/10 text-prophet-green border-prophet-green/30',
    MEDIUM: 'bg-prophet-gold/10 text-prophet-gold border-prophet-gold/30',
    HIGH: 'bg-prophet-red/10 text-prophet-red border-prophet-red/30',
  };

  // Moat skills the user has that are in-demand
  const moatSkills = report.moat_skills || [];
  const inDemand = data!.in_demand_skills || [];
  const matchingSkills = moatSkills.filter(s => 
    inDemand.some(d => d.toLowerCase().includes(s.toLowerCase().split(' ')[0]) || s.toLowerCase().includes(d.toLowerCase().split(' ')[0]))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="mb-6"
    >
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">📊 Job Market for {role}</h3>
                <p className="text-xs text-muted-foreground">Salary, hiring trends & demand signals in {industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" />
              <span className="text-xs font-semibold text-prophet-green">LIVE</span>
            </div>
          </div>
        </div>

        {/* Market Salary Range — from live web data only */}
        <div className="px-5 pb-3">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Market Salary Range (LPA)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Low</p>
                <p className="text-lg font-black text-foreground">{data!.salary_range_lpa.min}L</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Median</p>
                <p className="text-lg font-black text-primary">{data!.salary_range_lpa.median}L</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">High</p>
                <p className="text-lg font-black text-foreground">{data!.salary_range_lpa.max}L</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 italic">Source: Live web data from job postings · Glassdoor · AmbitionBox · ≤6 months old</p>
          </div>
        </div>

        {/* Market Signals */}
        <div className="px-5 pb-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {trendIcon}
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Job Trend</span>
            </div>
            <p className={`text-lg font-black capitalize ${trendColor}`}>{data!.job_postings_trend}</p>
            <p className="text-[10px] text-muted-foreground">{data!.posting_change_pct > 0 ? '+' : ''}{data!.posting_change_pct}% YoY</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">AI Disruption</span>
            <span className={`text-sm font-black px-2 py-0.5 rounded-full border ${disruptionColors[data!.ai_disruption_level]}`}>
              {data!.ai_disruption_level}
            </span>
          </div>
        </div>

        {/* Key Findings */}
        {data!.key_findings?.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Key Findings</p>
            <div className="space-y-1.5">
              {data!.key_findings.slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <span className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Skills vs Market */}
        {matchingSkills.length > 0 && (
          <div className="px-5 pb-3">
            <div className="rounded-lg border border-prophet-green/20 bg-prophet-green/[0.03] p-3">
              <p className="text-[10px] font-black text-prophet-green uppercase tracking-wider mb-1.5">✓ Your Skills That Market Wants</p>
              <div className="flex flex-wrap gap-1">
                {matchingSkills.map((s, i) => (
                  <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-prophet-green/10 text-prophet-green">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Companies & Skills */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border/50 grid grid-cols-2 gap-4">
          {data!.top_hiring_companies?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Top Hiring
              </p>
              <div className="flex flex-wrap gap-1">
                {data!.top_hiring_companies.slice(0, 4).map((c, i) => (
                  <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c}</span>
                ))}
              </div>
            </div>
          )}
          {inDemand.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">🔥 In-Demand Skills</p>
              <div className="flex flex-wrap gap-1">
                {inDemand.slice(0, 4).map((s, i) => (
                  <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-prophet-gold/10 text-prophet-gold">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
