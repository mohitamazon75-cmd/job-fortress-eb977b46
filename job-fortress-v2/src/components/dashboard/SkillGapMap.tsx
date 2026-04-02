import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { type SkillGap } from '@/lib/scan-engine';

interface SkillGapMapProps {
  skillGaps: SkillGap[];
}

export default function SkillGapMap({ skillGaps }: SkillGapMapProps) {
  if (!skillGaps?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="mb-6"
    >
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Skills You Need
      </h2>

      <div className="space-y-3">
        {skillGaps.map((gap, i) => {
          const upliftPct = gap.importance_for_pivot >= 0.8 ? '20–30%' : gap.importance_for_pivot >= 0.5 ? '10–20%' : '5–15%';

          return (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{gap.missing_skill}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{gap.fastest_path}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-black text-prophet-green">+{upliftPct} salary</p>
                  <p className="text-[10px] text-muted-foreground">{gap.weeks_to_proficiency} weeks</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-muted-foreground font-medium">Importance</span>
                <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${gap.importance_for_pivot * 100}%` }}
                    transition={{ duration: 0.8, delay: 1.1 + i * 0.1 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground">{Math.round(gap.importance_for_pivot * 100)}%</span>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Based on Knowledge Graph skill-risk matrix · LinkedIn/Naukri demand signals · Updated within last 6 months
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
