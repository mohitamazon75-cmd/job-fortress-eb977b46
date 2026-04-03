import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL as SUPABASE_URL_CONFIG, SUPABASE_PUBLISHABLE_KEY as SUPABASE_KEY_CONFIG } from '@/lib/supabase-config';
import { ArrowRight, Sparkles, Zap, Shield, Brain, TrendingUp, TrendingDown, Minus, Swords, Target, Search, Database, BarChart3, Globe, Lock, Bot, Loader2, ChevronDown } from 'lucide-react';
import { computeStabilityScore, computeScoreBreakdown } from '@/lib/stability-score';
import { getVerbatimRole, deflateRoleInText } from '@/lib/role-guard';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import { useLiveEnrichment } from '@/hooks/use-live-enrichment';
import DataProvenance from '@/components/cards/DataProvenance';
import WhyThisScore from '@/components/cards/WhyThisScore';
import FreeActionCard from '@/components/cards/FreeActionCard';

// ═══════════════════════════════════════════════════════════════
// MERGED: Score Reveal + Intelligence Profile in one scrollable view
// ═══════════════════════════════════════════════════════════════

interface AIDossierRevealProps {
  report: ScanReport;
  onComplete: () => void;
  scanId?: string;
  isProUser?: boolean;
}

// ── Intelligence Profile Vibe (from JobSafetyCard) ──
type Vibe = {
  emoji: string; label: string; color: string; bg: string; border: string;
  headline: string; body: string; replaceability: string; bullets: string[];
  warmIntro?: string;
};

function getVibe(score: number, report: ScanReport): Vibe {
  const tier = inferSeniorityTier(report.seniority_tier);
  const tierLabel = tier.replace('_', ' ').toLowerCase();
  const moatSkills = (report.moat_skills || []).length;
  const rawDemandTrend = report.market_position_model?.demand_trend ?? 'Stable';
  const demandLabel = (() => {
    const d = rawDemandTrend.toLowerCase().trim();
    if (d.includes('rising') || d.includes('growing') || d.includes('high')) return 'strong';
    if (d.includes('stable') || d.includes('steady')) return 'steady';
    if (d.includes('declining') || d.includes('falling') || d.includes('weak')) return 'softening';
    if (d.includes('pressure') || d.includes('competitive')) return 'under pressure';
    return 'steady'; // Safe fallback — prevents "demand demand" text bug
  })();
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const roleName = getVerbatimRole(report);
  const talentDensity = report.market_position_model?.talent_density ?? 'moderate';

  if (score >= 70) return {
    emoji: '🛡️', label: 'Safe Zone', color: 'text-prophet-green', bg: 'bg-prophet-green/[0.06]', border: 'border-prophet-green/20',
    headline: "Strong today — but the ground is shifting fast.",
    warmIntro: `Right now, you're ahead. But AI capability is doubling every 8-12 months. The ${roleName}s who stay safe are the ones who see what's coming next.`,
    body: `Only ~${Math.round(automationRisk)}% of your work overlaps with AI today — that's genuinely good. But 18 months ago, that number was under ${Math.max(5, Math.round(automationRisk * 0.5))}%. The tools replacing parts of your role are getting better quietly, and the professionals who lose ground are almost always the ones who assumed their position was permanent.`,
    replaceability: "Today, replacing you would be hard. But AI-augmented competitors are learning to do 80% of what you do at 20% of the cost — your edge needs active maintenance.",
    bullets: [
      `Hiring demand is ${demandLabel} now — but ${demandLabel === 'strong' ? 'companies are already piloting AI alternatives for this exact role' : 'AI tools are eating into this category faster than hiring trends show'}`,
      moatSkills >= 3 ? `${moatSkills} of your skills are still hard to automate — but 2 of them weren't at risk 2 years ago either. The "safe" list is shrinking.` : "Your judgment-heavy work protects you — but AI agents are starting to handle nuanced decisions too",
      `Your defense plan maps exactly which ${moatSkills >= 1 ? 'of your moat skills have the shortest shelf life' : 'capabilities to build'} — so you stay ahead of the curve, not react to it`,
    ],
  };
  if (score >= 50) return {
    emoji: '⚡', label: 'Stay Sharp', color: 'text-primary', bg: 'bg-primary/[0.06]', border: 'border-primary/20',
    headline: "You're in the danger zone where most people feel fine — until they're not.",
    warmIntro: "This is the trickiest score range. You feel secure, your manager hasn't flagged anything — but this is exactly where silent displacement happens.",
    body: `About ${Math.round(automationRisk)}% of ${roleName} tasks can be handled by AI today. That number was lower last quarter. The gap between 'doing fine' and 'being replaced by someone who uses AI' is closing faster than most people realize.`,
    replaceability: "You're valued — but a younger professional who's mastered AI tools can now deliver your output in half the time. That's the real competition.",
    bullets: [
      `Market demand is ${demandLabel} — but companies are hiring fewer people for more output. AI-augmented teams are the new baseline.`,
      moatSkills > 0 ? `${moatSkills} of your strengths are hard to replicate today — but without active investment, that number drops to zero within 2 years` : "You don't have a clear 'irreplaceable' skill yet — and that's the single biggest risk factor we flag",
      "Your defense plan identifies the exact 1-2 moves that shift you from 'replaceable' to 'essential' — most people in your score range only need 90 days",
    ],
  };
  if (score >= 30) return {
    emoji: '🔥', label: 'Heads Up', color: 'text-prophet-gold', bg: 'bg-prophet-gold/[0.06]', border: 'border-prophet-gold/20',
    headline: "Your role is more exposed than most — but you have a window.",
    body: `Around ${Math.round(automationRisk)}% of ${roleName} tasks are exactly what AI is getting good at. The good news: you're seeing this before most people in your role even think about it.`,
    replaceability: "This role could be backfilled faster than you'd like. But that's precisely why seeing it clearly now changes everything.",
    bullets: [
      'A significant portion of your daily work follows patterns AI can learn quickly',
      moatSkills > 0 ? `You have ${moatSkills} unique strengths — lean into these hard, they're your margin` : "Right now, it's hard to point to one thing that makes you irreplaceable — let's fix that",
      'Your defense plan shows the fastest path to making yourself irreplaceable — most people in your range can shift their score in 60-90 days',
    ],
  };
  return {
    emoji: '🚨', label: 'Act Now', color: 'text-destructive', bg: 'bg-destructive/[0.06]', border: 'border-destructive/20',
    warmIntro: "You're not alone in this. 1 in 3 tech professionals in India scored under 40 this year. The ones who turned it around started with exactly this kind of honest picture.",
    headline: "This is the warning your company won't give you.",
    body: `Most ${roleName} day-to-day work maps onto what AI already does well — that's the structural reality. But knowing this puts you 6 months ahead of most people in your role.`,
    replaceability: "This seat could be filled quickly. But you're here, looking at this clearly — and that's the whole point of doing this now.",
    bullets: [
      `~${Math.round(automationRisk)}% of your tasks overlap with AI capability — among the highest we see`,
      "High talent supply means you're competing with more people and faster tools — the window to differentiate is now",
      'Your defense plan is your 90-day escape route — it maps exactly how to pivot from "at risk" to "in demand"',
    ],
  };
}

// ── Dossier Loading Steps ──
const TRUST_STEPS = [
  { icon: Database, label: 'Matching your skills against Knowledge Graph', detail: '95 job families × 147 skill vectors' },
  { icon: Search, label: 'Checking live market signals for your role', detail: 'Demand trends, salary trajectory, talent density' },
  { icon: Brain, label: 'Running AI disruption analysis', detail: 'Mapping your tasks against 200+ AI tools' },
  { icon: BarChart3, label: 'Modeling career trajectory scenarios', detail: 'Seniority-calibrated risk projection' },
  { icon: Globe, label: 'Applying geo-market calibration', detail: 'Adjusting for your metro tier and industry' },
  { icon: Shield, label: 'Building defense strategies', detail: 'Personalized to your moat skills' },
  { icon: Lock, label: 'Computing AIRMM™ resilience dimensions', detail: '5-factor career resilience framework' },
  { icon: Target, label: 'Finalizing personalized dossier', detail: 'Grounded in your actual profile data' },
];

function DossierLoadingSteps() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActiveStep(prev => (prev + 1) % TRUST_STEPS.length), 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-xl border border-border/60 bg-muted/30 p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Deep analysis in progress</span>
      </div>
      {TRUST_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < activeStep || (activeStep === 0 && i === TRUST_STEPS.length - 1 && activeStep !== 0);
        const isActive = i === activeStep;
        const isPending = !isDone && !isActive;
        return (
          <motion.div key={step.label} initial={{ opacity: 0.4 }}
            animate={{ opacity: isActive ? 1 : isDone ? 0.7 : 0.35 }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 border border-primary/20' : ''}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : isDone ? 'text-prophet-green' : 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <p className={`text-xs font-bold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
              {isActive && <p className="text-[10px] text-muted-foreground mt-0.5">{step.detail}</p>}
            </div>
            {isDone && <span className="ml-auto text-prophet-green text-xs">✓</span>}
            {isActive && <span className="ml-auto w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ── Intelligence Profile Section ──
function IntelligenceProfile({ report, scanId, isProUser, onUpgrade }: { report: ScanReport; scanId?: string; isProUser?: boolean; onUpgrade?: () => void }) {
  const score = computeStabilityScore(report);
  const breakdown = computeScoreBreakdown(report);
  const vibe = getVibe(score, report);
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const rawFamily = getVerbatimRole(report);
  const matchedFamily = (rawFamily.length > 50 || rawFamily.includes('.') || rawFamily.startsWith('I '))
    ? (report.industry || 'Your Role') : rawFamily;
  const kgMatched = report.computation_method?.kg_skills_matched ?? skillAdjustments.length;
  const tier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(tier);

  const allSkills = [...(report.moat_skills || []), ...(report.execution_skills_dead || []), ...(report.strategic_skills || [])].slice(0, 8);
  const enrichment = useLiveEnrichment(
    report.role, report.industry, allSkills, report.moat_skills || [],
    ((report as any).defense_plan?.pivot_options || []).map((p: any) => p.role || p.title).filter(Boolean),
    scanId, report.country
  );
  const liveTools = (enrichment.data?.tool_threats || []).slice(0, 3);

  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const moatSkills = report.moat_skills || [];
  const deadSkills = report.execution_skills_dead || [];
  const companyName = report.linkedin_company;
  const topMoats = moatSkills.slice(0, 3);
  const topThreats = deadSkills.slice(0, 2);
  const survivability = report.survivability;
  const execImpact = report.executive_impact;

  const profileSummary = (() => {
    const parts: string[] = [];
    if (companyName) parts.push(`at ${companyName}`);
    if (isExec && execImpact?.geographic_scope?.length) parts.push(`across ${execImpact.geographic_scope.join(', ')}`);
    const riskLevel = automationRisk >= 60 ? 'high AI exposure' : automationRisk >= 35 ? 'moderate AI exposure' : 'low AI exposure';
    parts.push(`with ${riskLevel} (${Math.round(automationRisk)}%)`);
    return `${matchedFamily} ${parts.join(', ')}`;
  })();

  // AIRMM dimensions — projections derived from actual gap data, not hardcoded %
  const atRiskSkillCount = (report.execution_skills_dead || []).length;
  const totalSkillCount = (report.all_skills || []).length || 1;
  const gapRatio = Math.min(1, atRiskSkillCount / totalSkillCount); // 0-1: how many skills are at risk
  // Projection boost is proportional to gap: more at-risk skills = more room for improvement
  const dynamicBoost = (base: number, maxBoost: number) => {
    const boost = maxBoost * gapRatio; // larger gap = larger potential improvement
    return Math.min(95, Math.round(base + (100 - base) * boost));
  };
  const airmm = [
    { label: 'AI Resistance', current: breakdown.rawAiResistance, projected: dynamicBoost(breakdown.rawAiResistance, 0.35), icon: <Shield className="w-3 h-3" /> },
    { label: 'Income Resilience', current: breakdown.rawIncomeStability, projected: dynamicBoost(breakdown.rawIncomeStability, 0.15), icon: <TrendingUp className="w-3 h-3" /> },
    { label: 'Role Moat', current: breakdown.rawHumanEdge, projected: dynamicBoost(breakdown.rawHumanEdge, 0.25), icon: <Zap className="w-3 h-3" /> },
    { label: 'Market Mobility', current: breakdown.rawMarketPosition, projected: dynamicBoost(breakdown.rawMarketPosition, 0.12), icon: <BarChart3 className="w-3 h-3" /> },
    { label: 'Seniority Shield', current: breakdown.rawSeniorityShield, projected: breakdown.rawSeniorityShield, icon: <Shield className="w-3 h-3" /> },
  ];

  const getBarColor = (v: number) => v >= 65 ? 'bg-prophet-green' : v >= 40 ? 'bg-prophet-gold' : 'bg-destructive';
  const getTextColor = (v: number) => v >= 65 ? 'text-prophet-green' : v >= 40 ? 'text-prophet-gold' : 'text-destructive';

  const marketModel = report.market_position_model;

  // Peer bar: parse "top 48% est. percentile" → 48
  const peerRaw = survivability?.peer_percentile_estimate ?? '';
  const peerMatch = peerRaw.match(/(\d+)/);
  const peerPct = peerMatch ? parseInt(peerMatch[1]) : null;
  const peerBarWidth = peerPct ?? 50;
  const peerBarColor = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : score >= 30 ? 'bg-orange-400' : 'bg-red-400';

  // At-risk tasks for free tease: top 3 skills by automation risk from skillAdjustments
  const topAtRisk: string[] = useMemo(() => {
    const fromSkills = [...skillAdjustments]
      .sort((a, b) => ((b as any).automation_risk ?? 0) - ((a as any).automation_risk ?? 0))
      .map((s: any) => s.skill_name as string)
      .filter(Boolean)
      .slice(0, 3);
    if (fromSkills.length > 0) return fromSkills;
    // fallback: use primary_vulnerability + dead skills
    const fallback: string[] = [];
    if (survivability?.primary_vulnerability) fallback.push(survivability.primary_vulnerability);
    deadSkills.slice(0, 2).forEach(s => { if (!fallback.includes(s)) fallback.push(s); });
    return fallback.slice(0, 3);
  }, [skillAdjustments, survivability, deadSkills]);

  // Freshness label: "Apr 2025"
  const freshnessLabel = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const demandIcon = (() => {
    const d = (marketModel?.demand_trend || '').toLowerCase();
    if (d.includes('rising') || d.includes('growing')) return <TrendingUp className="w-3.5 h-3.5 text-prophet-green" />;
    if (d.includes('declining') || d.includes('falling')) return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  })();

  return (
    <div className="space-y-4">
      {/* Intelligence Profile Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-2">Your Intelligence Profile</p>
        <p className="text-sm font-bold text-foreground leading-snug mb-3">{profileSummary}</p>

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

        {isProUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topMoats.length > 0 && (
              <div className="min-w-0 rounded-lg border border-prophet-green/20 bg-prophet-green/[0.04] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-prophet-green mb-1">🛡️ Your Moat</p>
                <div className="space-y-0.5">
                  {topMoats.map((s, i) => <p key={i} className="text-[11px] text-foreground/80 leading-snug break-words">• {s}</p>)}
                </div>
              </div>
            )}
            {topThreats.length > 0 && (
              <div className="min-w-0 rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1">⚡ At Risk</p>
                <div className="space-y-0.5">
                  {topThreats.map((s, i) => <p key={i} className="text-[11px] text-foreground/80 leading-snug break-words">• {s}</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live AI Tools — Pro only */}
        {isProUser && (
          <div className="mt-2">
            {enrichment.loading ? (
              <div className="rounded-lg border border-border bg-card/50 px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Searching latest AI tools competing with your skills...</p>
              </div>
            ) : liveTools.length > 0 ? (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bot className="w-3 h-3 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">AI Tools Gunning For Your Job</p>
                  <span className="ml-auto text-[7px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Live · last 30 days</span>
                </div>
                <div className="space-y-2 mt-2">
                  {liveTools.map((tool, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="rounded-lg border border-border bg-card/60 px-3 py-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-primary">{tool.tool_name}</span>
                        <span className={`flex-shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          tool.adoption === 'Mainstream' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                          tool.adoption === 'Growing' ? 'bg-prophet-gold/10 text-prophet-gold border border-prophet-gold/20' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>{tool.adoption}</span>
                      </div>
                      <p className="text-[10px] text-foreground/70 leading-relaxed">{tool.automates}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{tier.replace('_', ' ')}</span> · {report.industry}
          </span>
          {kgMatched > 0 && <span className="text-[11px] text-muted-foreground">· {kgMatched} skills cross-referenced</span>}
          <span className="text-[11px] text-muted-foreground ml-auto">India · {freshnessLabel}</span>
        </div>

        {/* Peer comparison bar — always shown when data available */}
        {peerPct !== null && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">
                Safer than <span className="font-bold text-foreground">{peerPct}% of {matchedFamily}s</span> in India
              </span>
              <span className="text-muted-foreground">Role avg: 52</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-visible">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${peerBarWidth}%` }}
                transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${peerBarColor}`}
              />
              {/* Average marker at 52% */}
              <div className="absolute top-[-4px] h-[18px] w-[2px] bg-muted-foreground/50 rounded-full" style={{ left: '52%' }} />
              <span className="absolute text-[9px] text-muted-foreground font-semibold" style={{ left: '48%', top: '14px' }}>avg</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Narrative Verdict — blurred for free users */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className={`rounded-2xl border-2 ${vibe.border} ${vibe.bg} p-5 ${!isProUser ? 'relative overflow-hidden' : ''}`}>
        <div className={!isProUser ? 'blur-[5px] select-none pointer-events-none' : ''}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{vibe.emoji}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${vibe.color}`}>{vibe.label}</span>
          </div>
          {vibe.warmIntro && (
            <p className="text-sm text-foreground/70 leading-relaxed mb-3 italic border-l-2 border-border pl-3">
              {vibe.warmIntro}
            </p>
          )}
          <h3 className={`text-lg font-black leading-snug ${vibe.color} mb-2`}>{vibe.headline}</h3>
          <p className="text-sm text-foreground/85 leading-relaxed">{vibe.body}</p>

          {isProUser && (
            <>
              <div className="rounded-lg border border-border bg-card/50 px-4 py-3 mt-4 mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">Replaceability</p>
                <p className="text-sm text-foreground/80 leading-relaxed italic">{vibe.replaceability}</p>
              </div>
              <ul className="space-y-2">
                {vibe.bullets.map((bullet, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }} className="flex items-start gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${vibe.color.replace('text-', 'bg-')}`} />
                    <span className="text-sm text-foreground/80">{bullet}</span>
                  </motion.li>
                ))}
              </ul>
            </>
          )}
        </div>
        {!isProUser && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 border border-border shadow-sm">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Detailed analysis in Pro</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Why This Score accordion — blurred for free users */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
        className={!isProUser ? 'relative overflow-hidden rounded-2xl' : ''}>
        <div className={!isProUser ? 'blur-[5px] select-none pointer-events-none' : ''}>
          <WhyThisScore
            score={score}
            automationRisk={automationRisk}
            demandTrend={marketModel?.demand_trend ?? 'Stable'}
            moatSkillCount={moatSkills.length}
            talentDensity={marketModel?.talent_density ?? 'moderate'}
            seniorityTier={report.seniority_tier ?? 'PROFESSIONAL'}
            defaultOpen={true}
          />
        </div>
        {!isProUser && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 border border-border shadow-sm">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Score breakdown in Pro</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* AIRMM Framework — Pro only */}
      {isProUser && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AIRMM™ Framework</p>
          </div>
          <p className="text-[10px] text-muted-foreground mb-4">Current position → projected after closing your top skill gaps · assumes full gap closure · individual results vary</p>
          <div className="space-y-3">
            {airmm.map((dim, i) => {
              const gain = dim.projected - dim.current;
              return (
                <motion.div key={dim.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }} className="space-y-1">
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
                    {gain > 0 && (
                      <motion.div initial={{ width: 0 }} animate={{ width: `${dim.projected}%` }}
                        transition={{ delay: 0.35 + i * 0.06, duration: 0.7 }}
                        className="absolute h-full rounded-full bg-prophet-green/25" />
                    )}
                    <motion.div initial={{ width: 0 }} animate={{ width: `${dim.current}%` }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.6 }}
                      className={`h-full rounded-full relative z-10 ${getBarColor(dim.current)}`} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Market Context — Pro only */}
      {isProUser && marketModel && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-xl border-2 border-border bg-card p-4">
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

      {/* AI Impact Snapshot — free users: auto-opened, top 2 sections with pills */}
      {!isProUser && (topAtRisk.length > 0 || moatSkills.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-2xl border-2 border-border bg-card p-5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">AI Impact Snapshot</p>

          {/* Section 1: At Risk */}
          {topAtRisk.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-destructive">⚠️ What's at risk in your role right now</p>
              <div className="flex flex-wrap gap-1.5">
                {topAtRisk.slice(0, 3).map((skill, i) => (
                  <span key={i} className="bg-destructive/10 text-destructive border border-destructive/20 rounded-full text-xs font-bold px-3 py-1">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Safe Zones */}
          {moatSkills.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-prophet-green">🛡️ Your safe zones</p>
              <div className="flex flex-wrap gap-1.5">
                {moatSkills.slice(0, 3).map((skill, i) => (
                  <span key={i} className="bg-prophet-green/10 text-prophet-green border border-prophet-green/20 rounded-full text-xs font-bold px-3 py-1">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fade-out teaser */}
          <div className="pt-2 border-t border-border/50 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-semibold">Full dossier in your defense plan →</span>
          </div>
        </motion.div>
      )}

      {/* Free Action Card — "#1 Move This Month" */}
      {!isProUser && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <FreeActionCard
            score={score}
            roleName={matchedFamily}
            moatSkills={moatSkills}
            primaryVulnerability={survivability?.primary_vulnerability}
            onUpgrade={onUpgrade ?? (() => {})}
          />
        </motion.div>
      )}

      {/* Data Provenance */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <DataProvenance skillsMatched={kgMatched} toolsTracked={tools.length}
          kgCoverage={report.data_quality?.kg_coverage} source={report.source} />
      </motion.div>
    </div>
  );
}

// ── Collapsible Dossier Section ──
function DossierCollapsible({ dossierText, streamComplete, streamError, markdownComponents }: {
  dossierText: string; streamComplete: boolean; streamError: string; markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-black uppercase tracking-[0.15em] text-foreground">AI Impact Dossier</span>
          {!streamComplete && <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin ml-1" />}
          {streamComplete && !streamError && (
            <span className="text-[10px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">Ready</span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-primary/10">
              {streamError ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">{streamError}</p>
                </div>
              ) : (
                <article className="dossier-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {dossierText}
                  </ReactMarkdown>
                </article>
              )}
              {!streamComplete && !streamError && <DossierLoadingSteps />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ──
export default function AIDossierReveal({ report, onComplete, scanId, isProUser }: AIDossierRevealProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [scoreReady, setScoreReady] = useState(false);
  const [rawDossierText, setRawDossierText] = useState('');
  const verbatimRole = getVerbatimRole(report);
  const dossierText = useMemo(() => {
    if (!verbatimRole || !rawDossierText) return rawDossierText;
    return deflateRoleInText(rawDossierText, verbatimRole);
  }, [rawDossierText, verbatimRole]);
  const [streamComplete, setStreamComplete] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [allowContinue, setAllowContinue] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamStarted = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const careerScore = computeStabilityScore(report);

  const scoreColor = careerScore >= 70 ? 'text-prophet-green'
    : careerScore >= 50 ? 'text-primary'
    : careerScore >= 30 ? 'text-prophet-gold'
    : 'text-destructive';

  const scoreBg = careerScore >= 70 ? 'bg-prophet-green/[0.06] border-prophet-green/20'
    : careerScore >= 50 ? 'bg-primary/[0.06] border-primary/20'
    : careerScore >= 30 ? 'bg-prophet-gold/[0.06] border-prophet-gold/20'
    : 'bg-destructive/[0.06] border-destructive/20';

  const scoreLabel = careerScore >= 70 ? 'SAFE ZONE'
    : careerScore >= 50 ? 'STAY SHARP'
    : careerScore >= 30 ? 'HEADS UP'
    : 'ACT NOW';

  // Animate score count-up on mount
  useEffect(() => {
    let frame = 0;
    const totalFrames = 60;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const interval = setInterval(() => {
      frame++;
      const p = Math.min(frame / totalFrames, 1);
      setDisplayScore(Math.round(ease(p) * careerScore));
      if (frame >= totalFrames) {
        clearInterval(interval);
        setScoreReady(true);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [careerScore]);

  // Safety: never block flow progression behind dossier streaming
  useEffect(() => {
    if (!scoreReady) return;
    const timer = window.setTimeout(() => setAllowContinue(true), 1200);
    return () => window.clearTimeout(timer);
  }, [scoreReady]);

  // Start dossier streaming immediately (with hard timeout so UI can never hang)
  const startStreaming = useCallback(async () => {
    const baseUrl = SUPABASE_URL_CONFIG;
    const CHAT_URL = `${baseUrl}/functions/v1/ai-dossier`;
    const STREAM_TIMEOUT_MS = 25000;
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || SUPABASE_KEY_CONFIG;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          apikey: SUPABASE_KEY_CONFIG,
        },
        body: JSON.stringify({ report }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setStreamError('Analysis details temporarily unavailable.');
        setStreamComplete(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;

        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setRawDossierText(accumulated);
            }
          } catch {
            buffer = `${line}\n${buffer}`;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;

          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setRawDossierText(accumulated);
            }
          } catch {
            // ignore malformed tail chunk
          }
        }
      }

      setStreamComplete(true);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        console.warn('Dossier stream timed out; allowing flow to continue');
        setStreamError('Detailed dossier is taking longer than expected. You can continue now.');
      } else {
        console.error('Dossier fetch error:', err);
        setStreamError('Analysis details temporarily unavailable.');
      }
      setStreamComplete(true);
    } finally {
      window.clearTimeout(timeoutId);
      streamAbortRef.current = null;
    }
  }, [report]);

  // Start streaming on mount
  useEffect(() => {
    if (!streamStarted.current) {
      streamStarted.current = true;
      startStreaming();
    }

    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, [startStreaming]);

  // Section icon mapping for dossier markdown
  const sectionIcon = (text: string) => {
    if (text.includes('AUTOMATION RESISTANCE')) return <Shield className="w-5 h-5 text-prophet-green" />;
    if (text.includes('HUMAN MOAT') || text.includes('PIVOT POINT')) return <Brain className="w-5 h-5 text-prophet-cyan" />;
    if (text.includes('MARKET DEMAND')) return <TrendingUp className="w-5 h-5 text-prophet-gold" />;
    if (text.includes('vs.') || text.includes('Head-to-Head')) return <Swords className="w-5 h-5 text-destructive" />;
    if (text.includes('SURVIVAL ROADMAP')) return <Target className="w-5 h-5 text-primary" />;
    if (text.includes('VERDICT') || text.includes('ALGORITHM')) return <Zap className="w-5 h-5 text-primary" />;
    return null;
  };

  const markdownComponents = useMemo(() => ({
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-2 mt-0 leading-tight" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => {
      const text = String(children);
      const icon = sectionIcon(text);
      const isAutomationResistance = text.includes('AUTOMATION RESISTANCE');
      return (
        <div className="mt-10 mb-4">
          <div className="flex items-center gap-2.5">
            {icon && <div className="flex-shrink-0 p-1.5 rounded-lg bg-muted">{icon}</div>}
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground uppercase" {...props}>{children}</h2>
          </div>
          {isAutomationResistance && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-prophet-green/[0.06] border border-prophet-green/20">
              <p className="text-[11px] text-foreground/70 leading-relaxed">
                <span className="font-bold text-prophet-green">Context:</span> Your overall role sits in the <span className="font-bold text-foreground">{scoreLabel}</span> ({careerScore}/100) — this analysis breaks down the specific execution skills within the vulnerable portion of your work. High risk on individual tasks ≠ high risk on your overall position.
              </p>
            </div>
          )}
        </div>
      );
    },
    h3: ({ children, ...props }: any) => {
      const text = String(children);
      const pctMatch = text.match(/(\d+)%/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : null;
      const pctColor = pct !== null
        ? pct >= 80 ? 'text-prophet-green bg-prophet-green/10 border-prophet-green/20'
        : pct >= 50 ? 'text-primary bg-primary/10 border-primary/20'
        : pct >= 30 ? 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/20'
        : 'text-destructive bg-destructive/10 border-destructive/20' : '';
      if (pct !== null) {
        const cleanText = text.replace(/:\s*\d+%/, '').trim();
        return (
          <div className="flex items-center justify-between gap-3 mt-6 mb-3 p-3.5 rounded-xl bg-muted/60 border border-border/60">
            <h3 className="text-sm sm:text-base font-black tracking-wide text-foreground" {...props}>{cleanText}</h3>
            <span className={`flex-shrink-0 text-xl sm:text-2xl font-black tabular-nums px-3 py-1 rounded-lg border ${pctColor}`}>{pct}%</span>
          </div>
        );
      }
      return <h3 className="text-base font-black tracking-tight text-foreground mt-6 mb-2" {...props}>{children}</h3>;
    },
    p: ({ children, ...props }: any) => {
      const text = String(children);
      if (text.startsWith('Profile Analysis:') || text.startsWith('**Profile Analysis:**')) {
        return <div className="mb-3 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-primary"><p className="text-[15px] sm:text-base leading-relaxed text-foreground/90 font-medium" {...props}>{children}</p></div>;
      }
      if (text.startsWith('Market Status:') || text.startsWith('**Market Status:**')) {
        return <div className="mb-4"><p className="text-sm font-black uppercase tracking-widest text-primary" {...props}>{children}</p></div>;
      }
      if (text.startsWith('Verdict:') || text.startsWith('**Verdict:**')) {
        return <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"><p className="text-lg sm:text-xl font-black text-primary tracking-wide text-center" {...props}>{children}</p></div>;
      }
      return <p className="text-[15px] sm:text-base leading-[1.8] text-foreground/85 mb-4" {...props}>{children}</p>;
    },
    strong: ({ children, ...props }: any) => {
      const text = String(children);
      if (text.endsWith(':') || text === 'The Reality Check:' || text === 'Where your true value lies:' || text.startsWith('What the current market')) {
        return <strong className="text-foreground font-black text-[15px]" {...props}>{children}</strong>;
      }
      return <strong className="text-foreground font-bold" {...props}>{children}</strong>;
    },
    em: ({ children, ...props }: any) => <em className="text-primary font-medium not-italic" {...props}>{children}</em>,
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="my-6 border-l-4 border-primary bg-primary/5 rounded-r-xl py-5 px-6 text-foreground/95 font-medium leading-[1.8] text-[15px] sm:text-base not-italic" {...props}>{children}</blockquote>
    ),
    table: ({ children, ...props }: any) => <div className="my-6 overflow-x-auto rounded-xl border border-border/60 shadow-sm"><table className="w-full border-collapse text-sm" {...props}>{children}</table></div>,
    thead: ({ children, ...props }: any) => <thead className="bg-muted" {...props}>{children}</thead>,
    th: ({ children, ...props }: any) => <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-foreground border-b border-border/60" {...props}>{children}</th>,
    tr: ({ children, ...props }: any) => <tr className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors" {...props}>{children}</tr>,
    td: ({ children, ...props }: any) => <td className="px-4 py-3.5 text-sm text-foreground/85 leading-relaxed" {...props}>{children}</td>,
    hr: () => <div className="my-8 flex items-center gap-3"><div className="flex-1 h-px bg-border/60" /><div className="w-1.5 h-1.5 rounded-full bg-primary/40" /><div className="flex-1 h-px bg-border/60" /></div>,
    ul: ({ children, ...props }: any) => <ul className="space-y-2 my-4 pl-0 list-none" {...props}>{children}</ul>,
    li: ({ children, ...props }: any) => <li className="flex items-start gap-2 text-[15px] text-foreground/85 leading-relaxed" {...props}><span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" /><span>{children}</span></li>,
  }), []);

  return (
    <div className="fixed inset-0 z-[200] bg-background overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">AI Impact Dossier</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black uppercase tracking-wider ${scoreColor}`}>{scoreLabel}</span>
          <span className={`text-lg font-black tabular-nums ${scoreColor}`}>{displayScore}<span className="text-xs text-muted-foreground">/100</span></span>
        </div>
      </div>

      {/* Single scrollable view — score at top, intelligence profile below, dossier at bottom */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

          {/* ═══ HERO SCORE — inline, not a separate phase ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`rounded-2xl border-2 ${scoreBg} p-6 text-center`}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-3">
              Career Position Score
            </p>
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.1 }}
              className={`text-[72px] sm:text-[96px] font-black leading-none ${scoreColor} tabular-nums`}
            >
              {displayScore}
              <span className="text-[22px] sm:text-[30px] text-muted-foreground">/100</span>
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mt-2"
            >
              how safe is your job from AI
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-foreground/60 text-[13px] leading-relaxed mt-3 max-w-xs mx-auto"
            >
              {careerScore >= 70
                ? `${careerScore} out of 100 — you're protected today, but this number was higher last year. AI capability is accelerating, and even safe roles are seeing erosion. Your defense plan shows exactly what's coming.`
                : careerScore >= 50
                ? `${careerScore} out of 100 — you're in the zone where most people feel fine until it's too late. AI-augmented professionals are already competing for roles like yours. Time to act.`
                : careerScore >= 30
                ? `${careerScore} out of 100 — a significant chunk of your role is vulnerable to automation. You'll want to act on the plan below.`
                : `${careerScore} out of 100 — your role has high overlap with AI capabilities. The good news: the steps below can change this.`
              }
            </motion.p>
            {report.linkedin_name && report.linkedin_name !== 'Professional' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-foreground/60 text-sm mt-3"
              >
                {report.linkedin_name.split(' ')[0]}, here's your complete analysis
              </motion.p>
            )}
          </motion.div>

          {/* ═══ INTELLIGENCE PROFILE — appears with staggered delay ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <IntelligenceProfile report={report} scanId={scanId} isProUser={isProUser} onUpgrade={onComplete} />
          </motion.div>

          {/* ═══ AI DOSSIER — collapsible section, Pro only ═══ */}
          {isProUser && (dossierText || !streamComplete) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}>
              <DossierCollapsible
                dossierText={dossierText}
                streamComplete={streamComplete}
                streamError={streamError || ''}
                markdownComponents={markdownComponents}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom CTA — only shown for Pro users */}
      {isProUser && (
        <AnimatePresence>
          {allowContinue && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4"
            >
              <div className="max-w-lg mx-auto">
                <motion.button
                  onClick={onComplete}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-primary-foreground font-black text-base tracking-wide transition-all min-h-[52px]"
                  style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
                >
                  See Your Full Defense Plan
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  {streamComplete
                    ? `${(report.score_breakdown?.skill_adjustments || []).length} skills analyzed · real market data`
                    : 'Detailed dossier loading in background…'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}