import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus, BarChart3, Bot, Loader2 } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import { computeStabilityScore, computeScoreBreakdown } from '@/lib/stability-score';
import DataProvenance from '@/components/cards/DataProvenance';
import { getVerbatimRole } from '@/lib/role-guard';
import { useLiveEnrichment } from '@/hooks/use-live-enrichment';
import FearScoreDecay from '@/components/cards/FearScoreDecay';
import CohortInsightBadge from '@/components/cards/CohortInsightBadge';
import { getVibe } from '@/lib/get-vibe';

/**
 * Card 1: "What This Means For You" — narrative + AIRMM + intelligence profile.
 * NO score hero, NO pillar bars, NO 90-day path (those are in VerdictReveal).
 * Each piece of information here is NEW — not shown before.
 */

export default function JobSafetyCard({ report, scanId }: { report: ScanReport; scanId?: string }) {
  const score = computeStabilityScore(report);
  const breakdown = computeScoreBreakdown(report);
  const vibe = getVibe(score, report);
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const ci = report.score_variability;
  // Job family: use verbatim role guard
  const rawFamily = getVerbatimRole(report);
  const matchedFamily = (rawFamily.length > 50 || rawFamily.includes('.') || rawFamily.startsWith('I '))
    ? (report.industry || 'Your Role')
    : rawFamily;
  const kgMatched = report.computation_method?.kg_skills_matched ?? skillAdjustments.length;
  const tier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(tier);

  // Live AI tool threats from search + fine-tuned reasoning models (last 30 days)
  const allSkills = [...(report.moat_skills || []), ...(report.execution_skills_dead || []), ...(report.strategic_skills || [])].slice(0, 8);
  const enrichment = useLiveEnrichment(
    report.role, report.industry, allSkills, report.moat_skills || [],
    ((report.defense_plan as any)?.pivot_options || []).map((p: any) => p.role || p.title).filter(Boolean),
    scanId, report.country
  );
  const liveTools = (enrichment.data?.tool_threats || []).slice(0, 3);

  // AIRMM dimensions: current + projected after defense plan
  const topGapRisk = (() => {
    const risks = skillAdjustments.slice(0, 3).map(s => s.automation_risk);
    return risks.length > 0 ? Math.max(...risks) : 40;
  })();
  const projectionBoost = (base: number, boostPct: number) => Math.min(95, Math.round(base + (100 - base) * boostPct));

  const airmm = [
    { label: 'AI Resistance', current: breakdown.rawAiResistance, projected: projectionBoost(breakdown.rawAiResistance, 0.25), icon: <Shield className="w-3 h-3" /> },
    { label: 'Income Resilience', current: breakdown.rawIncomeStability, projected: projectionBoost(breakdown.rawIncomeStability, 0.12), icon: <TrendingUp className="w-3 h-3" /> },
    { label: 'Role Moat', current: breakdown.rawHumanEdge, projected: projectionBoost(breakdown.rawHumanEdge, 0.18), icon: <Zap className="w-3 h-3" /> },
    { label: 'Market Mobility', current: breakdown.rawMarketPosition, projected: projectionBoost(breakdown.rawMarketPosition, 0.10), icon: <BarChart3 className="w-3 h-3" /> },
    { label: 'Seniority Shield', current: breakdown.rawSeniorityShield, projected: breakdown.rawSeniorityShield, icon: <Shield className="w-3 h-3" /> },
  ];

  const getBarColor = (v: number) => v >= 65 ? 'bg-prophet-green' : v >= 40 ? 'bg-prophet-gold' : 'bg-destructive';
  const getTextColor = (v: number) => v >= 65 ? 'text-prophet-green' : v >= 40 ? 'text-prophet-gold' : 'text-destructive';

  // Market context
  const marketModel = report.market_position_model;
  const demandIcon = (() => {
    const d = (marketModel?.demand_trend || '').toLowerCase();
    if (d.includes('rising') || d.includes('growing')) return <TrendingUp className="w-3.5 h-3.5 text-prophet-green" />;
    if (d.includes('declining') || d.includes('falling')) return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  })();

  // Derive richer profile insights
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const moatSkills = report.moat_skills || [];
  const deadSkills = report.execution_skills_dead || [];
  const companyName = report.linkedin_company;
  const topMoats = moatSkills.slice(0, 3);
  const topThreats = deadSkills.slice(0, 2);
  const strategicSkills = report.strategic_skills || [];
  const survivability = report.survivability;
  const execImpact = report.executive_impact;

  // One-liner profile summary
  const profileSummary = (() => {
    const parts: string[] = [];
    if (companyName) parts.push(`at ${companyName}`);
    if (isExec && execImpact?.geographic_scope?.length) parts.push(`across ${execImpact.geographic_scope.join(', ')}`);
    const riskLevel = automationRisk >= 60 ? 'high AI exposure' : automationRisk >= 35 ? 'moderate AI exposure' : 'low AI exposure';
    parts.push(`with ${riskLevel} (${Math.round(automationRisk)}%)`);
    return `${matchedFamily} ${parts.join(', ')}`;
  })();

  return (
    <div className="space-y-5">
      {/* Fear-driven emotional hook — score decay projection */}
      <FearScoreDecay report={report} enrichment={enrichment} />

      {/* Intelligence Profile — compact summary */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-5"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-2">Your Intelligence Profile</p>
        <p className="text-sm font-bold text-foreground leading-snug mb-3">{profileSummary}</p>

        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-black text-foreground tabular-nums">{Math.round(automationRisk)}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Overlap with AI</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-black text-foreground tabular-nums">{moatSkills.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moat Skills</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-black text-foreground tabular-nums">{tools.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Tools Competing</p>
          </div>
        </div>

        {/* What makes you hard to replace vs what's at risk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topMoats.length > 0 && (
            <div className="min-w-0 rounded-lg border border-prophet-green/20 bg-prophet-green/[0.04] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-prophet-green mb-1">🛡️ Your Moat</p>
              <div className="space-y-0.5">
                {topMoats.map((s, i) => (
                  <p key={i} className="text-[11px] text-foreground/80 leading-snug break-words">• {s}</p>
                ))}
              </div>
            </div>
          )}
          {topThreats.length > 0 && (
            <div className="min-w-0 rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1">⚡ At Risk</p>
              <div className="space-y-0.5">
                {topThreats.map((s, i) => (
                  <p key={i} className="text-[11px] text-foreground/80 leading-snug break-words">• {s}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seniority & classification footer */}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{tier.replace('_', ' ')}</span> · {report.industry}
          </span>
          {kgMatched > 0 && (
            <span className="text-[11px] text-muted-foreground">· {kgMatched} skills cross-referenced</span>
          )}
          {survivability && (
            <span className="text-[11px] text-muted-foreground">· {survivability.peer_percentile_estimate} percentile</span>
          )}
        </div>
      </motion.div>

      {/* Narrative verdict — what the score MEANS */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl border-2 ${vibe.border} ${vibe.bg} p-5`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{vibe.emoji}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${vibe.color}`}>{vibe.label}</span>
        </div>
        <h3 className={`text-lg font-black leading-snug ${vibe.color} mb-2`}>{vibe.headline}</h3>
        <p className="text-sm text-foreground/85 leading-relaxed mb-4">{vibe.body}</p>

        {/* Replaceability statement */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 mb-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">Replaceability</p>
          <p className="text-sm text-foreground/80 leading-relaxed italic">{vibe.replaceability}</p>
        </div>

        {/* Bullet insights */}
        <ul className="space-y-2">
          {vibe.bullets.map((bullet, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="flex items-start gap-2.5"
            >
              <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${vibe.color.replace('text-', 'bg-')}`} />
              <span className="text-sm text-foreground/80">{bullet}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* AIRMM Framework — proprietary IP made visible */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border-2 border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AIRMM™ Framework</p>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1">
          <span className="font-bold">A</span>I Resistance · <span className="font-bold">I</span>ncome Resilience · <span className="font-bold">R</span>ole Moat · <span className="font-bold">M</span>arket Mobility · Seniority Shield
        </p>
        <p className="text-[10px] text-muted-foreground mb-4">Current position → projected after closing your top skill gaps</p>

        <div className="space-y-3">
          {airmm.map((dim, i) => {
            const gain = dim.projected - dim.current;
            return (
              <motion.div
                key={dim.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={getTextColor(dim.current)}>{dim.icon}</span>
                    <span className="text-[10px] font-bold text-foreground">{dim.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black tabular-nums ${getTextColor(dim.current)}`}>{Math.round(dim.current)}</span>
                    {gain > 0 && (
                      <>
                        <span className="text-[11px] text-muted-foreground">→</span>
                        <span className="text-xs font-black tabular-nums text-prophet-green">{Math.round(dim.projected)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden relative">
                  {/* Projected bar (background) */}
                  {gain > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dim.projected}%` }}
                      transition={{ delay: 0.35 + i * 0.06, duration: 0.7 }}
                      className="absolute h-full rounded-full bg-prophet-green/25"
                    />
                  )}
                  {/* Current bar (foreground) */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dim.current}%` }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.6 }}
                    className={`h-full rounded-full relative z-10 ${getBarColor(dim.current)}`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Market Context — under-expressed data now visible */}
      {marketModel && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl border-2 border-border bg-card p-4"
        >
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Market Context</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">{demandIcon}</div>
              <p className="text-[10px] font-bold text-foreground">{marketModel.demand_trend || 'Stable'}</p>
              <p className="text-[10px] text-muted-foreground">Demand</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-foreground">{marketModel.talent_density || 'Moderate'}</p>
              <p className="text-[10px] text-muted-foreground">Talent Supply</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-foreground">{marketModel.leverage_status || 'Neutral'}</p>
              <p className="text-[10px] text-muted-foreground">Your Leverage</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cohort peer comparison — IP #1 */}
      {scanId && (
        <CohortInsightBadge scanId={scanId} variant="stability" className="mt-1" />
      )}

      {/* Data provenance */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <DataProvenance
          skillsMatched={kgMatched}
          toolsTracked={tools.length}
          kgCoverage={report.data_quality?.kg_coverage}
          source={report.source}
        />
      </motion.div>
    </div>
  );
}
