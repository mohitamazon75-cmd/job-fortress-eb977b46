import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, TrendingUp, Shield, Zap, ArrowRight,
  ChevronRight, CheckCircle2, Target, Clock,
  BookOpen, Wrench, BarChart3, X, Briefcase
} from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { normalizeThreatTimeline } from '@/lib/threat-timeline';
import { computeStabilityScore } from '@/lib/stability-score';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface SkillCrisisResponseCenterProps {
  report: ScanReport;
  onComplete: () => void;
}

// ═══ ALERT CLASSIFICATION ENGINE ═══
interface Alert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  icon: React.ReactNode;
  stat: string;
  description: string;
  detail: string;
}

interface VulnerableSkill {
  name: string;
  risk: number;
  replacedBy: string;
}

interface ProposedAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  completed: boolean;
}

function classifyAlerts(report: ScanReport): Alert[] {
  const skills = report.score_breakdown?.skill_adjustments || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const marketPercentile = report.market_position_model?.market_percentile ?? 50;
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;

  const highRiskSkills = skills.filter(s => s.automation_risk >= 70);
  const toolOverlapCount = tools.filter(t => t.adoption_stage === 'Mainstream' || t.adoption_stage === 'Growing').length;

  const alerts: Alert[] = [];

  // Alert 1: Automation Progress
  const autoSeverity = highRiskSkills.length >= 5 ? 'critical' : highRiskSkills.length >= 3 ? 'high' : highRiskSkills.length >= 1 ? 'moderate' : 'low';
  alerts.push({
    id: 'automation',
    title: 'Automation Progress',
    severity: autoSeverity,
    icon: <Zap className="w-5 h-5" />,
    stat: `${highRiskSkills.length} skills exceed 70% automation risk.`,
    description: `${highRiskSkills.length} of your ${skills.length} tracked skills are in the critical automation zone.`,
    detail: highRiskSkills.length > 0 
      ? `Most exposed: ${highRiskSkills.slice(0, 3).map(s => `${s.skill_name} (${s.automation_risk}%)`).join(', ')}. These skills have mature AI alternatives actively being adopted in ${report.industry || 'your industry'}.`
      : 'None of your tracked skills currently exceed the 70% critical threshold. Maintain vigilance as AI capabilities evolve rapidly.',
  });

  // Alert 2: Tool Overlap Risk
  const toolSeverity = toolOverlapCount >= 4 ? 'critical' : toolOverlapCount >= 3 ? 'high' : toolOverlapCount >= 1 ? 'moderate' : 'low';
  alerts.push({
    id: 'tools',
    title: 'Tool Overlap Risk',
    severity: toolSeverity,
    icon: <Wrench className="w-5 h-5" />,
    stat: `${toolOverlapCount} key tools have AI alternatives overlapping 85%+.`,
    description: `${toolOverlapCount} AI tools are actively replacing tasks in your workflow.`,
    detail: tools.length > 0 
      ? `Key threats: ${tools.slice(0, 4).map(t => `${t.tool_name} (automates: ${t.automates_task})`).join('; ')}.`
      : 'No specific tool threats identified for your current skill profile.',
  });

  // Alert 3: Market Position
  const marketSeverity = marketPercentile > 70 ? 'high' : marketPercentile > 50 ? 'moderate' : 'low';
  alerts.push({
    id: 'market',
    title: 'Market Competition',
    severity: marketSeverity,
    icon: <BarChart3 className="w-5 h-5" />,
    stat: `You rank at the ${marketPercentile}th percentile in talent density.`,
    description: `Your role is at ${marketPercentile}% saturation vs. industry average.`,
    detail: `Market position: ${report.market_position_model?.competitive_tier || 'Balanced'}. ${report.market_position_model?.demand_trend || 'Stable demand'} in ${report.industry || 'your sector'}. ${marketPercentile > 60 ? 'High competition means standing out is critical.' : 'Lower competition gives you time to build your unique edge.'}`,
  });

  // Alert 4: Urgency Score
  const urgency = report.urgency_score ?? Math.round(automationRisk * 0.8);
  const urgencySeverity = urgency >= 70 ? 'critical' : urgency >= 50 ? 'high' : urgency >= 30 ? 'moderate' : 'low';
  alerts.push({
    id: 'urgency',
    title: 'Disruption Velocity',
    severity: urgencySeverity,
    icon: <AlertTriangle className="w-5 h-5" />,
    stat: `Urgency index: ${urgency}/100 — action window narrowing.`,
    description: `Industry adoption rate suggests a ${report.months_remaining || 18}-month action window for proactive repositioning.`,
    detail: `Based on ${report.industry || 'industry'} AI adoption curves and your seniority level (${inferSeniorityTier(report.seniority_tier)}), the window for proactive skill adjustment is ${urgency >= 60 ? 'narrowing rapidly' : 'still open but should not be ignored'}.`,
  });

  return alerts;
}

function getVulnerableSkills(report: ScanReport): VulnerableSkill[] {
  const skills = report.score_breakdown?.skill_adjustments || [];
  const tools = normalizeTools(report.ai_tools_replacing || []);

  return skills
    .filter(s => s.automation_risk >= 60)
    .sort((a, b) => b.automation_risk - a.automation_risk)
    .slice(0, 5)
    .map(s => {
      const matchedTool = tools.find(t => 
        t.automates_task?.toLowerCase().includes(s.skill_name.toLowerCase().split('_')[0]) ||
        s.skill_name.toLowerCase().includes(t.tool_name.toLowerCase().split(' ')[0])
      );
      return {
        name: s.skill_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        risk: s.automation_risk,
        replacedBy: matchedTool?.tool_name || 'AI Alternatives',
      };
    });
}

function getProposedActions(report: ScanReport): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const moatSkills = report.moat_skills || [];
  const nextStep = report.immediate_next_step;
  const weeklyDiet = report.weekly_survival_diet;
  const judoTool = report.judo_strategy?.recommended_tool;

  if (nextStep) {
    actions.push({
      id: 'next-step',
      title: nextStep.action.length > 50 ? nextStep.action.slice(0, 50) + '…' : nextStep.action,
      subtitle: nextStep.rationale?.slice(0, 60) || 'Immediate priority action',
      icon: <Target className="w-4 h-4" />,
      completed: false,
    });
  }

  if (judoTool) {
    actions.push({
      id: 'judo',
      title: `Master ${judoTool} for AI leverage`,
      subtitle: report.judo_strategy?.pitch?.slice(0, 60) || 'Turn AI threats into advantages',
      icon: <Wrench className="w-4 h-4" />,
      completed: false,
    });
  }

  if (moatSkills.length > 0) {
    actions.push({
      id: 'moat',
      title: `Double down on ${moatSkills[0]?.replace(/_/g, ' ')}`,
      subtitle: 'Strengthen your hardest-to-replace strength',
      icon: <Shield className="w-4 h-4" />,
      completed: false,
    });
  }

  if (weeklyDiet) {
    actions.push({
      id: 'diet',
      title: `${weeklyDiet.read?.title || 'Weekly learning sprint'}`,
      subtitle: weeklyDiet.theme || 'Build resistance incrementally',
      icon: <BookOpen className="w-4 h-4" />,
      completed: false,
    });
  }

  return actions.slice(0, 4);
}

// ═══ SEVERITY STYLING ═══
const severityConfig = {
  critical: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive', badge: 'Critical', gradient: 'from-destructive/20 to-destructive/5' },
  high: { bg: 'bg-prophet-gold/10', border: 'border-prophet-gold/30', text: 'text-prophet-gold', badge: 'High', gradient: 'from-prophet-gold/20 to-prophet-gold/5' },
  moderate: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', badge: 'Moderate', gradient: 'from-primary/20 to-primary/5' },
  low: { bg: 'bg-prophet-green/10', border: 'border-prophet-green/30', text: 'text-prophet-green', badge: 'Low', gradient: 'from-prophet-green/20 to-prophet-green/5' },
};

// ═══ POPUP OVERLAY ═══
function DetailPopup({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const config = severityConfig[alert.severity];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-popup-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.bg} ${config.text} flex items-center justify-center`}>
              {alert.icon}
            </div>
            <div>
              <h3 id="detail-popup-title" className="font-bold text-foreground">{alert.title}</h3>
              <span className={`text-xs font-semibold ${config.text} uppercase tracking-wider`}>{config.badge}</span>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed mb-3">{alert.description}</p>
        <div className={`p-3 rounded-lg ${config.bg} border ${config.border}`}>
          <p className="text-xs text-foreground/80 leading-relaxed">{alert.detail}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SkillDetailPopup({ skill, onClose }: { skill: VulnerableSkill; onClose: () => void }) {
  const riskColor = skill.risk >= 80 ? 'text-destructive' : skill.risk >= 60 ? 'text-prophet-gold' : 'text-primary';
  const riskBg = skill.risk >= 80 ? 'bg-destructive' : skill.risk >= 60 ? 'bg-prophet-gold' : 'bg-primary';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-popup-title"
      >
        <div className="flex items-start justify-between mb-4">
          <h3 id="skill-popup-title" className="font-bold text-foreground text-lg">{skill.name}</h3>
          <button type="button" autoFocus onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Automation Risk</span>
              <span className={`text-2xl font-black tabular-nums ${riskColor}`}>{skill.risk}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${skill.risk}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${riskBg}`} />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">Primary AI Replacement</p>
            <p className="text-sm font-semibold text-foreground">{skill.replacedBy}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {skill.risk >= 80 
              ? 'This skill is in the critical zone. AI tools can already perform 80%+ of associated tasks. Immediate pivot to augmentation strategy recommended.'
              : 'This skill is at elevated risk. AI alternatives are maturing. Consider upskilling to AI-augmented variants within the next 6 months.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══ MAIN COMPONENT ═══
export default function SkillCrisisResponseCenter({ report, onComplete }: SkillCrisisResponseCenterProps) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<VulnerableSkill | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const careerPosition = computeStabilityScore(report);
  const threatScore = 100 - careerPosition;
  const seniorityTier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(seniorityTier);
  const marketPercentile = report.market_position_model?.market_percentile ?? Math.max(5, Math.min(95, 100 - Math.round(report.determinism_index || 50)));
  const userName = report.linkedin_name || 'Professional';

  const alerts = useMemo(() => classifyAlerts(report), [report]);
  const vulnerableSkills = useMemo(() => getVulnerableSkills(report), [report]);
  const proposedActions = useMemo(() => getProposedActions(report), [report]);

  // Mitigation map data — project score improvement from actions
  const weekendDelta = report.immediate_next_step ? 5 : 3;
  const judoDelta = report.judo_strategy ? report.judo_strategy.months_gained > 6 ? 8 : 5 : 3;
  const moatDelta = (report.moat_skills || []).length > 2 ? 7 : 4;
  const totalDelta = weekendDelta + judoDelta + moatDelta;

  const mitigationData = [
    { name: 'Now', score: careerPosition, label: '' },
    { name: 'Week 1', score: careerPosition + weekendDelta, label: `+${weekendDelta}` },
    { name: 'Month 1', score: Math.min(95, careerPosition + weekendDelta + judoDelta), label: `+${judoDelta}` },
    { name: 'Month 3', score: Math.min(95, careerPosition + totalDelta), label: `+${moatDelta}` },
  ];

  // Score colors
  const threatLabel = threatScore >= 70 ? 'Critical Threat' : threatScore >= 50 ? 'High Threat' : threatScore >= 35 ? 'Moderate Threat' : 'Low Threat';
  const threatBadgeColor = threatScore >= 70 ? 'bg-destructive text-destructive-foreground' : threatScore >= 50 ? 'bg-prophet-gold text-foreground' : threatScore >= 35 ? 'bg-primary text-primary-foreground' : 'bg-prophet-green text-foreground';
  const positionLabel = careerPosition >= 70 ? 'Strong' : careerPosition >= 50 ? 'Defensible' : careerPosition >= 30 ? 'Exposed' : 'Vulnerable';
  const positionColor = careerPosition >= 70 ? 'text-prophet-green' : careerPosition >= 50 ? 'text-primary' : careerPosition >= 30 ? 'text-prophet-gold' : 'text-destructive';

  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-6">

        {/* ═══ HERO: Dual Score Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(222 47% 11%), hsl(221 83% 25%), hsl(199 89% 30%))' }}
        >
          <div className="p-5 sm:p-8">
            <div className="flex items-start justify-between mb-6 gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Skill Crisis Response Center</h1>
                <p className="text-white/60 text-xs sm:text-sm mt-1">AI Threat Assessment & Mitigation Plan</p>
                {(report.role_detected || report.role) && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Briefcase className="w-3 h-3 text-white/40 flex-shrink-0" />
                    <span className="text-[11px] text-white/50 font-medium truncate">{report.role_detected || report.role}</span>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/60 text-xs">Welcome, <span className="text-white font-semibold">{userName.split(' ')[0]}</span></p>
              </div>
            </div>

            {/* Dual Score Display */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {/* Threat Score (Shock) */}
              <div className="text-center">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">AI Threat Risk</p>
                <div className="text-5xl sm:text-7xl font-black text-white tabular-nums leading-none">{threatScore}</div>
                <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${threatBadgeColor}`}>
                  {threatLabel}
                </div>
              </div>
              {/* Career Position (Relief) */}
              <div className="text-center">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Career Position</p>
                <div className={`text-5xl sm:text-7xl font-black tabular-nums leading-none ${positionColor}`}>{careerPosition}</div>
                <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white">
                  {positionLabel}
                </div>
              </div>
            </div>

            {/* Percentile Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                <span>Benchmark: You rank in <span className="text-white font-bold">{100 - marketPercentile}th</span> percentile</span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, hsl(152 69% 41%), hsl(38 92% 50%), hsl(0 84% 60%))' }}>
                <motion.div
                  initial={{ left: '0%' }}
                  animate={{ left: `${Math.min(95, Math.max(5, 100 - marketPercentile))}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="absolute top-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"
                  style={{ transform: 'translateX(-50%)', top: '-2px' }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-white/40 mt-1">
                <span>Safer</span>
                <span>Scale 1 to 99</span>
                <span>Higher Risk</span>
              </div>
            </div>

            {/* Displacement Timeline Strip — only when Agent2A threat_timeline is present.
                BL-031: normalize across legacy string / new object / array shapes. */}
            {(() => {
              const tl = normalizeThreatTimeline((report as unknown as Record<string, unknown>).threat_timeline);
              if (!tl) return null;
              const sigYear = tl.significant_displacement_year;
              const yearsLeft = sigYear ? sigYear - new Date().getFullYear() : null;
              const isUrgent = yearsLeft !== null && yearsLeft <= 2;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className={`mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${isUrgent ? 'border-destructive/40 bg-destructive/10' : 'border-white/10 bg-white/5'}`}
                >
                  {isUrgent
                    ? <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                    : <Clock className="w-3.5 h-3.5 text-white/50 flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-wider ${isUrgent ? 'text-destructive' : 'text-white/70'}`}>
                      {isUrgent ? 'Urgent — Significant displacement ' : 'Significant displacement '}
                      {sigYear ? `by ${sigYear}` : 'timeline available'}
                      {yearsLeft !== null && ` (${yearsLeft} yr${yearsLeft !== 1 ? 's' : ''})`}
                    </p>
                    {tl.at_risk_task && (
                      <p className="text-[11px] text-white/40 mt-0.5 truncate">
                        Most at-risk: <span className="text-white/60 font-medium">{tl.at_risk_task}</span>
                        {tl.primary_threat_tool && <> · <span className="text-white/50">{tl.primary_threat_tool}</span></>}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </div>
        </motion.div>

        {/* ═══ BODY: Two Columns ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

          {/* LEFT: Alert Summary (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Alert Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {displayedAlerts.map((alert, i) => {
                const config = severityConfig[alert.severity];
                return (
                  <motion.button
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => setSelectedAlert(alert)}
                    className={`text-left p-4 rounded-xl border ${config.border} bg-gradient-to-br ${config.gradient} hover:shadow-md transition-all group cursor-pointer`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${config.text}`}>
                        {alert.title}
                      </span>
                      <span className={`${config.text}`}>{alert.icon}</span>
                    </div>
                    <span className={`text-xs font-bold ${config.text}`}>— {config.badge}</span>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{alert.stat}</p>
                    <span className="text-[11px] text-muted-foreground/60 mt-2 flex items-center gap-0.5 group-hover:text-primary transition-colors">Tap for details <ChevronRight className="w-2.5 h-2.5" /></span>
                  </motion.button>
                );
              })}
            </div>
            {alerts.length > 4 && !showAllAlerts && (
              <button type="button" onClick={() => setShowAllAlerts(true)} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                View All Alerts <ChevronRight className="w-3 h-3" />
              </button>
            )}

            {/* ═══ MITIGATION MAP ═══ */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 rounded-xl border border-border bg-card"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Mitigation Map:</h3>
                <span className="text-prophet-green font-black text-lg">+{totalDelta} Points</span>
                <span className="text-xs text-muted-foreground">Possible</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Improvements based on impact & timeline.</p>

              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mitigationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mitigationGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[Math.max(0, careerPosition - 10), Math.min(100, careerPosition + totalDelta + 10)]} hide />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value}/100`, 'Career Position']}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={3}
                      fill="url(#mitigationGradient)"
                      dot={{ fill: 'hsl(38 92% 50%)', r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Proposed Actions + Vulnerable Skills (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Proposed Actions */}
            <h2 className="text-lg font-bold text-foreground">Proposed Actions</h2>
            <div className="space-y-2.5">
              {proposedActions.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 rounded-xl border border-border bg-card">Complete your scan to unlock personalized action steps.</p>
              )}
              {proposedActions.map((action, i) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all group cursor-default"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">
                    {action.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{action.subtitle}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-1 group-hover:text-prophet-green/50 transition-colors" />
                </motion.div>
              ))}
            </div>

            {/* Vulnerable Skills */}
            <h2 className="text-lg font-bold text-foreground mt-6">Vulnerable Skills</h2>
            <div className="space-y-2.5">
              {vulnerableSkills.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 rounded-xl border border-border bg-card">No skills above 60% automation threshold detected.</p>
              )}
              {vulnerableSkills.map((skill, i) => {
                const riskColor = skill.risk >= 80 ? 'text-destructive' : skill.risk >= 60 ? 'text-prophet-gold' : 'text-primary';
                const riskBg = skill.risk >= 80 ? 'bg-destructive' : skill.risk >= 60 ? 'bg-prophet-gold' : 'bg-primary';
                return (
                  <motion.button
                    key={skill.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    onClick={() => setSelectedSkill(skill)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-all text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${riskBg}`} />
                        <p className="text-sm font-semibold text-foreground">{skill.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-4">Replaced by: <span className="text-primary font-medium">{skill.replacedBy}</span></p>
                    </div>
                    <span className={`text-lg font-black tabular-nums ${riskColor} flex-shrink-0 ml-2`}>{skill.risk}%</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ POINTS TRACKER (Bottom CTA) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                <TrendingUp className="w-4 h-4 text-prophet-green flex-shrink-0" />
                <span className="text-sm font-black uppercase tracking-wider text-foreground">Points Tracker</span>
              </div>
              <p className="text-sm text-foreground">
                {report.immediate_next_step
                  ? `Complete: ${report.immediate_next_step.action.slice(0, 60)}${report.immediate_next_step.action.length > 60 ? '…' : ''}`
                  : 'Start your first AI resistance project this weekend.'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Builds AI Resistance & shifts threat to advantage.
              </p>
            </div>
            
            {/* Gauge */}
            <div className="relative w-28 h-20 flex-shrink-0">
              <svg viewBox="0 0 120 70" className="w-full h-full">
                {/* Background arc */}
                <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" strokeLinecap="round" />
                {/* Filled arc — proportional to career position */}
                <path
                  d="M 10 65 A 50 50 0 0 1 110 65"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(careerPosition / 100) * 157} 157`}
                />
                <defs>
                  <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(152 69% 41%)" />
                    <stop offset="50%" stopColor="hsl(38 92% 50%)" />
                    <stop offset="100%" stopColor="hsl(0 84% 60%)" />
                  </linearGradient>
                </defs>
                <text x="60" y="55" textAnchor="middle" className="text-2xl font-black" fill="hsl(var(--foreground))" fontSize="22">{careerPosition}%</text>
              </svg>
            </div>
          </div>
        </motion.div>

        {/* ═══ CTA BUTTONS ═══ */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={onComplete}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-primary-foreground text-sm transition-all hover:shadow-lg min-h-[52px]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Open Full Dashboard <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* ═══ POPUPS ═══ */}
      <AnimatePresence>
        {selectedAlert && <DetailPopup alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {selectedSkill && <SkillDetailPopup skill={selectedSkill} onClose={() => setSelectedSkill(null)} />}
      </AnimatePresence>
    </div>
  );
}
