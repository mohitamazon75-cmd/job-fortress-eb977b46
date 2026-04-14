import { motion } from 'framer-motion';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { ArrowRight, Cpu, Shield, TrendingUp, Copy, Check, Zap, Info } from 'lucide-react';
import { useState, useCallback } from 'react';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import DataProvenance from '@/components/cards/DataProvenance';

/**
 * SkillRepositioningCard — 100% deterministic, zero LLM calls.
 * WS4: Role-specific verbs, quantitative placeholders, "why this framing" explanation.
 */

function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

// Role-specific verb pools
const ROLE_VERBS: Record<string, string[]> = {
  engineering: ['Architected', 'Engineered', 'Scaled', 'Optimized', 'Deployed'],
  finance: ['Modeled', 'Optimized', 'Audited', 'Forecasted', 'Structured'],
  marketing: ['Launched', 'Measured', 'Repositioned', 'Drove', 'Orchestrated'],
  sales: ['Negotiated', 'Closed', 'Cultivated', 'Expanded', 'Secured'],
  design: ['Designed', 'Prototyped', 'Validated', 'Crafted', 'Iterated'],
  hr: ['Recruited', 'Aligned', 'Developed', 'Transformed', 'Advised'],
  legal: ['Drafted', 'Negotiated', 'Assessed', 'Structured', 'Advised'],
  healthcare: ['Diagnosed', 'Implemented', 'Coordinated', 'Evaluated', 'Optimized'],
  operations: ['Streamlined', 'Automated', 'Scaled', 'Optimized', 'Redesigned'],
  default: ['Spearheaded', 'Delivered', 'Transformed', 'Pioneered', 'Led'],
};

function getRoleCategory(role: string, industry: string): string {
  const r = (role + ' ' + industry).toLowerCase();
  if (r.includes('engineer') || r.includes('developer') || r.includes('software') || r.includes('tech')) return 'engineering';
  if (r.includes('financ') || r.includes('account') || r.includes('banking')) return 'finance';
  if (r.includes('market') || r.includes('brand') || r.includes('content')) return 'marketing';
  if (r.includes('sales') || r.includes('business dev')) return 'sales';
  if (r.includes('design') || r.includes('creative') || r.includes('ux')) return 'design';
  if (r.includes('hr') || r.includes('recruit') || r.includes('people')) return 'hr';
  if (r.includes('legal') || r.includes('law') || r.includes('compliance')) return 'legal';
  if (r.includes('health') || r.includes('medical') || r.includes('doctor')) return 'healthcare';
  if (r.includes('operat') || r.includes('supply') || r.includes('logistics')) return 'operations';
  return 'default';
}

interface RepositioningRow {
  currentSkill: string;
  automationRisk: number;
  repositionedAs: string;
  tool: string | null;
  strategy: 'learn-tool' | 'augment' | 'double-down';
  resumeBullet: string;
  whyThisFraming: string;
}

export default function SkillRepositioningCard({ report }: { report: ScanReport }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const moatSkills = report.moat_skills || [];
  const judoStrategy = report.judo_strategy;
  const seniorityTier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(seniorityTier);
  const role = report.role || '';
  const industry = report.industry || '';
  const roleCategory = getRoleCategory(role, industry);
  const verbs = ROLE_VERBS[roleCategory] || ROLE_VERBS.default;
  const kgMatched = report.computation_method?.kg_skills_matched ?? skillAdjustments.length;

  // Build tool lookup
  const toolMap = new Map<string, string>();
  tools.forEach(t => {
    if (t.automates_task && t.automates_task !== 'Various tasks') {
      toolMap.set(t.automates_task.toLowerCase(), t.tool_name);
    }
  });

  const rows: RepositioningRow[] = [];
  const sorted = [...skillAdjustments].sort((a, b) => b.automation_risk - a.automation_risk);

  for (const sa of sorted.slice(0, 6)) {
    const key = sa.skill_name.toLowerCase();
    const matchedTool = tools.find(t =>
      t.automates_task?.toLowerCase().includes(key.split(' ')[0])
    )?.tool_name || toolMap.get(key) || null;
    const variant = stableHash(sa.skill_name) % verbs.length;
    const verb = verbs[variant];
    const riskDelta = Math.round(sa.automation_risk * 0.3); // estimated efficiency gain

    let strategy: RepositioningRow['strategy'];
    let repositionedAs: string;
    let resumeBullet: string;
    let whyThisFraming: string;

    if (sa.automation_risk >= 75 && matchedTool) {
      strategy = 'learn-tool';
      repositionedAs = variant % 2 === 0
        ? `${matchedTool}-augmented ${sa.skill_name} specialist`
        : `${sa.skill_name} + ${matchedTool} hybrid operator`;
      resumeBullet = `${verb} ${matchedTool}-powered ${sa.skill_name.toLowerCase()} workflows, reducing cycle time by ~${riskDelta}% while redirecting capacity toward high-judgment decisions`;
      whyThisFraming = `Positions you as the human who controls ${matchedTool}, not the human it replaced`;
    } else if (sa.automation_risk >= 40) {
      strategy = 'augment';
      const toolName = matchedTool || 'AI tools';
      repositionedAs = variant % 2 === 0
        ? `${sa.skill_name} strategist with ${toolName} fluency`
        : `Human-in-the-loop ${sa.skill_name} expert`;
      resumeBullet = `${verb} ${sa.skill_name.toLowerCase()} outcomes by integrating ${toolName} for routine execution, focusing personal bandwidth on edge cases and strategic decisions`;
      whyThisFraming = `Shows you amplify AI output with domain judgment — the hybrid role companies actually need`;
    } else {
      strategy = 'double-down';
      repositionedAs = variant % 2 === 0
        ? `${sa.skill_name} authority (AI-resistant specialization)`
        : `Senior ${sa.skill_name} advisor — judgment-intensive`;
      resumeBullet = `${verb} ${sa.skill_name.toLowerCase()} decisions in high-stakes scenarios requiring contextual judgment, stakeholder alignment, and adaptive reasoning beyond current AI capabilities`;
      whyThisFraming = `This skill is hard to automate — framing it as judgment-intensive signals irreplaceability`;
    }

    rows.push({ currentSkill: sa.skill_name, automationRisk: sa.automation_risk, repositionedAs, tool: matchedTool, strategy, resumeBullet, whyThisFraming });
  }

  const handleCopy = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const strategyConfig = {
    'learn-tool': { icon: <Cpu className="w-3.5 h-3.5" />, label: 'Learn the tool', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    'augment': { icon: <Zap className="w-3.5 h-3.5" />, label: 'Augment', color: 'text-prophet-gold', bg: 'bg-prophet-gold/10', border: 'border-prophet-gold/20' },
    'double-down': { icon: <Shield className="w-3.5 h-3.5" />, label: 'Double down', color: 'text-prophet-green', bg: 'bg-prophet-green/10', border: 'border-prophet-green/20' },
  };

  if (rows.length === 0) return null;

  return (
    <div className="space-y-5">
      {/* Header with KG provenance */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5 text-center"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
          {isExec ? '🎯 Strategic Repositioning Map' : '🎭 Skill Repositioning Map'}
        </p>
        <p className="text-sm text-muted-foreground">
          Each repositioning below is derived from your <span className="font-bold text-foreground">{skillAdjustments.length} KG-matched skills</span> × <span className="font-bold text-foreground">{tools.length} AI tools</span>
        </p>
      </motion.div>

      {/* Repositioning rows */}
      <div className="space-y-3">
        {rows.map((row, i) => {
          const config = strategyConfig[row.strategy];
          return (
            <motion.div
              key={row.currentSkill}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className={`rounded-xl border-2 ${config.border} ${config.bg.replace('/10', '/[0.03]')} p-4`}
            >
              {/* Strategy tag */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border} flex items-center gap-1`}>
                  {config.icon} {config.label}
                </span>
                <span className={`text-[11px] font-bold ${row.automationRisk >= 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {row.automationRisk}% automatable
                </span>
              </div>

              {/* Before → After */}
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] font-black text-destructive/60 mt-0.5 flex-shrink-0 w-8">NOW</span>
                  <p className="text-sm text-muted-foreground line-through">{row.currentSkill}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[11px] font-black text-prophet-green mt-0.5 flex-shrink-0 w-8">NEW</span>
                  <p className="text-sm font-bold text-foreground">{row.repositionedAs}</p>
                </div>
              </div>

              {/* Resume bullet — copy-able */}
              <button
                onClick={() => handleCopy(row.resumeBullet, i)}
                className="mt-2 w-full text-left group rounded-md border border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">📋 Resume bullet</span>
                  {copiedIndex === i ? (
                    <Check className="w-3 h-3 text-prophet-green" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed mt-1 italic">"{row.resumeBullet}"</p>
              </button>

              {/* Why this framing — NEW */}
              <div className="mt-1.5 flex items-start gap-1.5 px-1">
                <Info className="w-3 h-3 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground/70 italic">{row.whyThisFraming}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Data provenance */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <DataProvenance
          skillsMatched={kgMatched}
          toolsTracked={tools.length}
          kgCoverage={report.data_quality?.kg_coverage}
          source={report.source}
          confidence={report.data_quality?.overall ?? null}
        />
      </motion.div>
    </div>
  );
}
