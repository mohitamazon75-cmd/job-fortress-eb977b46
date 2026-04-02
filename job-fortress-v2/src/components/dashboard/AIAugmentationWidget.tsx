import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithCache } from '@/lib/local-cache';

interface AIAugmentationWidgetProps {
  allSkills: string[];
  role: string;
}

interface AugmentableSkill {
  skill: string;
  augmentation_potential: number;
  tools: string[];
}

export default function AIAugmentationWidget({ allSkills, role }: AIAugmentationWidgetProps) {
  const [skills, setSkills] = useState<AugmentableSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allSkills.length) { setLoading(false); return; }

    const fetch = async () => {
      const data = await fetchWithCache('skill_risk_matrix_augmentation', async () => {
        const { data } = await supabase
          .from('skill_risk_matrix')
          .select('skill_name, ai_augmentation_potential, replacement_tools');
        return data;
      });

      if (!data) { setLoading(false); return; }

      const matched: AugmentableSkill[] = [];
      for (const skill of allSkills) {
        const norm = skill.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = data.find(d => {
          const dbNorm = d.skill_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return dbNorm.includes(norm) || norm.includes(dbNorm);
        });
        if (match && match.ai_augmentation_potential > 0) {
          matched.push({
            skill: match.skill_name,
            augmentation_potential: match.ai_augmentation_potential,
            tools: match.replacement_tools || [],
          });
        }
      }
      matched.sort((a, b) => b.augmentation_potential - a.augmentation_potential);
      setSkills(matched);
      setLoading(false);
    };

    fetch();
  }, [allSkills]);

  if (loading || skills.length === 0) return null;

  const avgAugmentation = Math.round(skills.reduce((s, sk) => s + sk.augmentation_potential, 0) / skills.length);
  const highAugCount = skills.filter(s => s.augmentation_potential >= 60).length;

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.02] p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground">AI Augmentation Score</h3>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-center mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-1">Skills AI Can AMPLIFY</p>
        <p className="text-4xl font-black text-primary">{avgAugmentation}%</p>
        <p className="text-xs text-muted-foreground mt-1">
          {highAugCount} of your skills become <span className="font-bold text-primary">more valuable</span> with AI tools
        </p>
      </div>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Not all AI impact is negative. These skills become <span className="font-semibold text-foreground">more powerful</span> when paired with AI tools — making you harder to replace, not easier.
      </p>

      <div className="space-y-2">
        {skills.slice(0, 6).map((s, i) => (
          <motion.div
            key={s.skill}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-foreground">{s.skill}</span>
              <span className="text-xs font-black text-primary">{s.augmentation_potential}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.augmentation_potential}%` }}
                transition={{ delay: i * 0.05 + 0.3, duration: 0.5 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            {s.tools.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Zap className="w-3 h-3 text-muted-foreground" />
                {s.tools.slice(0, 3).map((tool, j) => (
                  <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tool}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
