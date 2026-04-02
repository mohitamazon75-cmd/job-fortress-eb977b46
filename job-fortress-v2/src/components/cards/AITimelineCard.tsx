import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { classifySkills, getSkillCounts } from '@/lib/unified-skill-classifier';
import DataProvenance from '@/components/cards/DataProvenance';

export default function AITimelineCard({ report }: { report: ScanReport }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const kgMatched = report.computation_method?.kg_skills_matched ?? (report.score_breakdown?.skill_adjustments || []).length;

  const classified = classifySkills(report);
  const { automated: automatedCount, atRisk: atRiskCount, safe: safeCount } = getSkillCounts(classified);

  const rows = [...classified].sort((a, b) => a.estimatedMonths - b.estimatedMonths);
  const displayRows = showAll ? rows : rows.slice(0, 5);

  const getRiskColor = (risk: number) => {
    if (risk >= 75) return { text: 'text-destructive', dot: '🔴' };
    if (risk >= 50) return { text: 'text-prophet-gold', dot: '🟠' };
    if (risk >= 30) return { text: 'text-prophet-gold', dot: '🟡' };
    return { text: 'text-prophet-green', dot: '🟢' };
  };

  const getTimeLabel = (months: number) => {
    if (months <= 6) return { text: '< 6 months', color: 'text-destructive font-black' };
    if (months <= 12) return { text: '~1 year', color: 'text-destructive' };
    if (months <= 24) return { text: '~2 years', color: 'text-prophet-gold' };
    if (months <= 36) return { text: '~3 years', color: 'text-prophet-gold' };
    if (months <= 60) return { text: '5+ years', color: 'text-muted-foreground' };
    return { text: '7+ years', color: 'text-prophet-green' };
  };

  const getLearningCurveLabel = (curve?: string) => {
    if (curve === 'low') return '~20 hours';
    if (curve === 'medium') return '~40 hours';
    if (curve === 'high') return '~80 hours';
    return '~40 hours';
  };

  const getAdjacentPivots = (skillName: string): string[] => {
    const pivots: Record<string, string[]> = {
      'python': ['Go', 'Rust', 'TypeScript'],
      'sql': ['Data Visualization', 'Excel Analytics', 'BI Tools'],
      'project management': ['Stakeholder Communication', 'Agile Coaching', 'Product Strategy'],
      'excel': ['Power Query', 'VBA Automation', 'SQL'],
      'communication': ['Presentation Skills', 'Documentation', 'Mentoring'],
      'data analysis': ['Statistics', 'Data Visualization', 'SQL'],
      'leadership': ['Strategic Planning', 'Team Development', 'Risk Management'],
    };
    const key = skillName.toLowerCase();
    if (pivots[key]) return pivots[key];
    return ['Domain Specialization', 'Tool Mastery', 'Soft Skills'];
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-xl border-2 border-destructive/20 bg-destructive/[0.04] p-3 text-center">
          <p className="text-2xl font-black text-destructive">{automatedCount}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">Already Automated</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border-2 border-prophet-gold/20 bg-prophet-gold/[0.04] p-3 text-center">
          <p className="text-2xl font-black text-prophet-gold">{atRiskCount}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">Augmentation Zone</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl border-2 border-prophet-green/20 bg-prophet-green/[0.04] p-3 text-center">
          <p className="text-2xl font-black text-prophet-green">{safeCount}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">Human-Only</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-[1fr_70px_60px] gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground px-2">
        <span>Your Skill</span>
        <span className="text-center">When</span>
        <span className="text-center">Risk</span>
      </div>

      <div className="space-y-1.5">
        {displayRows.map((row, i) => {
          const color = getRiskColor(row.risk);
          const time = getTimeLabel(row.estimatedMonths);
          const isExpanded = expandedSkill === row.name;
          const adjacentPivots = getAdjacentPivots(row.name);
          const replacements = row.replacedBy ? [row.replacedBy] : (tools.length > 0 ? tools.slice(0, 3).map(t => t.tool_name) : ['AI automation tools']);
          const learningTime = getLearningCurveLabel(undefined);

          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-lg border border-border bg-card/50 overflow-hidden">

              {/* Main row */}
              <button
                onClick={() => setExpandedSkill(isExpanded ? null : row.name)}
                className="w-full px-3 py-2.5 hover:bg-card/70 transition-colors flex items-center gap-1"
              >
                <div className="grid grid-cols-[1fr_70px_60px] gap-1 items-center w-full">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs flex-shrink-0">{color.dot}</span>
                      <span className="text-sm font-semibold text-foreground truncate">{row.name}</span>
                      <motion.div initial={false} animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      </motion.div>
                    </div>
                    {row.replacedBy && !isExpanded && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-5 truncate">→ {row.replacedBy}</p>
                    )}
                  </div>
                  <span className={`text-xs text-center ${time.color}`}>{time.text}</span>
                  <span className={`text-sm font-black text-center tabular-nums ${color.text}`}>{row.risk}%</span>
                </div>
              </button>

              {/* Action tag */}
              <div className="px-3 pb-2.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground">
                  {row.actionTag}
                </span>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border bg-muted/20 px-3 py-3 space-y-3 overflow-hidden"
                  >
                    {/* Replacing tools */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Replacing Tools</p>
                      <div className="flex flex-wrap gap-1">
                        {replacements.map((tool, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Adjacent pivots */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Lower-Risk Pivots</p>
                      <div className="flex flex-wrap gap-1">
                        {adjacentPivots.map((pivot, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-1 rounded bg-prophet-green/10 text-prophet-green border border-prophet-green/20 font-medium">
                            {pivot}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Reskill time */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Reskill Time</p>
                      <p className="text-xs text-foreground font-semibold">{learningTime}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {rows.length > 5 && !showAll && (
        <button onClick={() => setShowAll(true)}
          className="w-full text-center text-xs font-bold text-primary flex items-center justify-center gap-1.5 py-2 hover:underline">
          <ChevronDown className="w-3 h-3" /> Show all {rows.length} skills
        </button>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-xl border-2 border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-center space-y-1">
        <p className="text-sm font-black text-foreground">
          <span className="text-destructive">{automatedCount}/{rows.length} skills</span> already have AI replacements
        </p>
        <p className="text-xs text-muted-foreground">
          {automatedCount > 0
            ? `Earliest impact: ${rows[0]?.estimatedMonths <= 12 ? 'within the next year' : 'within 2 years'}`
            : 'No skills at immediate automation risk'}
          {safeCount > 0 ? ` · ${safeCount} remain human-exclusive` : ''}
        </p>
      </motion.div>

      <DataProvenance skillsMatched={kgMatched} toolsTracked={tools.length}
        kgCoverage={report.data_quality?.kg_coverage} source={report.source} compact />
    </div>
  );
}
