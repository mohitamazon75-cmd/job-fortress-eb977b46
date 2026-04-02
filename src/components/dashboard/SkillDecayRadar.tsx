import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache } from '@/lib/local-cache';

interface SkillDecayRadarProps {
  allSkills: string[];
  role: string;
}

interface SkillTrend {
  skill: string;
  trend: 'Rising' | 'Stable' | 'Declining';
  automation_risk: number;
}

export default function SkillDecayRadar({ allSkills, role }: SkillDecayRadarProps) {
  const [trends, setTrends] = useState<SkillTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allSkills.length) { setLoading(false); return; }

    const fetchTrends = async () => {
      const data = await fetchWithCache('skill_risk_matrix_trends', async () => {
        const { data } = await supabase
          .from('skill_risk_matrix')
          .select('skill_name, india_demand_trend, automation_risk');
        return data;
      });

      if (!data) { setLoading(false); return; }

      const matched: SkillTrend[] = [];
      for (const skill of allSkills) {
        const norm = skill.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = data.find(d => {
          const dbNorm = d.skill_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return dbNorm.includes(norm) || norm.includes(dbNorm);
        });
        if (match) {
          matched.push({
            skill: match.skill_name,
            trend: match.india_demand_trend as any || 'Stable',
            automation_risk: match.automation_risk,
          });
        }
      }
      setTrends(matched);
      setLoading(false);
    };

    fetchTrends();
  }, [allSkills]);

  if (loading || trends.length === 0) return null;

  const rising = trends.filter(t => t.trend === 'Rising').length;
  const declining = trends.filter(t => t.trend === 'Declining').length;

  const getTrendIcon = (trend: string) => {
    if (trend === 'Rising') return <TrendingUp className="w-4 h-4 text-prophet-green" />;
    if (trend === 'Declining') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-prophet-gold" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'Rising') return 'border-prophet-green/20 bg-prophet-green/[0.03]';
    if (trend === 'Declining') return 'border-destructive/20 bg-destructive/[0.03]';
    return 'border-prophet-gold/20 bg-prophet-gold/[0.03]';
  };

  const getTrendLabel = (trend: string) => {
    if (trend === 'Rising') return 'text-prophet-green';
    if (trend === 'Declining') return 'text-destructive';
    return 'text-prophet-gold';
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Skill Decay Radar</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">LIVE MARKET DATA</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-prophet-green/20 bg-prophet-green/[0.04] p-2 text-center">
          <p className="text-lg font-black text-prophet-green">{rising}</p>
          <p className="text-[11px] font-bold uppercase text-prophet-green/70">Rising</p>
        </div>
        <div className="rounded-lg border border-prophet-gold/20 bg-prophet-gold/[0.04] p-2 text-center">
          <p className="text-lg font-black text-prophet-gold">{trends.length - rising - declining}</p>
          <p className="text-[11px] font-bold uppercase text-prophet-gold/70">Stable</p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-2 text-center">
          <p className="text-lg font-black text-destructive">{declining}</p>
          <p className="text-[11px] font-bold uppercase text-destructive/70">Declining</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {trends.slice(0, 8).map((t, i) => (
          <motion.div
            key={t.skill}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${getTrendColor(t.trend)}`}
          >
            {getTrendIcon(t.trend)}
            <span className="text-sm font-semibold text-foreground flex-1 truncate">{t.skill}</span>
            <span className={`text-xs font-bold ${getTrendLabel(t.trend)}`}>{t.trend}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
