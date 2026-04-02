import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, ChevronDown, ChevronUp, Lightbulb, Target, BookOpen, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { ScanReport } from '@/lib/scan-engine';

interface Props {
  report: ScanReport;
  country?: string | null;
}

interface MicroTask {
  task: string;
  status: 'Defensible' | 'Vulnerable';
  impact: number;
}

const MARKETS: Record<string, string> = {
  IN: 'Focus: GCC transition. Shift from process-execution to AI-orchestration roles.',
  US: 'Focus: Enterprise SaaS co-pilots. Maximize individual output with AI augmentation.',
  AE: 'Focus: Top-down government AI mandates and rapid infrastructure scaling.',
};

/** Derive micro-tasks from report skill data */
function deriveTasks(report: ScanReport): MicroTask[] {
  const dead = report.execution_skills_dead || [];
  const moat = report.moat_skills || report.moat_indicators || [];
  const totalWeight = dead.length + moat.length || 1;

  const vulnerable: MicroTask[] = dead.slice(0, 4).map((s, i) => ({
    task: s,
    status: 'Vulnerable',
    impact: Math.round((1 / totalWeight) * 100 * (dead.length - i) / dead.length),
  }));

  const defensible: MicroTask[] = moat.slice(0, 4).map((s, i) => ({
    task: s,
    status: 'Defensible',
    impact: Math.round((1 / totalWeight) * 100 * (moat.length - i) / moat.length),
  }));

  const tasks = [...vulnerable, ...defensible];
  // Normalize to 100
  const sum = tasks.reduce((a, t) => a + t.impact, 0) || 1;
  return tasks.map(t => ({ ...t, impact: Math.round((t.impact / sum) * 100) }));
}

function getSignalMessage(report: ScanReport, tone: 'therapeutic' | 'ambitious'): { headline: string; action: string } {
  const di = report.determinism_index ?? 50;
  const role = report.role || 'your role';
  const topThreat = report.primary_ai_threat_vector || 'AI automation tools';

  if (tone === 'therapeutic') {
    if (di > 65) {
      return {
        headline: `${topThreat} can now handle routine tasks in ${role} workflows.`,
        action: `Your strategic thinking is irreplaceable. Focus on the tasks AI cannot do — edge-case judgment, stakeholder alignment, and creative problem-solving.`,
      };
    }
    return {
      headline: `AI augmentation is creating new opportunities in ${role} workflows.`,
      action: `You're in a strong position. Channel your moat skills to lead AI adoption in your team.`,
    };
  }
  // ambitious
  if (di > 65) {
    return {
      headline: `Routine execution in ${role} is fully automatable, freeing 40%+ of bandwidth.`,
      action: `Master AI orchestration today to become the person who deploys these tools — not the one replaced by them.`,
    };
  }
  return {
    headline: `AI co-pilots are amplifying top performers in ${role} by 3-5x.`,
    action: `Use this leverage gap aggressively. Every week you delay, competitors widen the moat.`,
  };
}

export default function CareerResilienceEngine({ report, country }: Props) {
  const [tone, setTone] = useState<'therapeutic' | 'ambitious'>('therapeutic');
  const [sliderValue, setSliderValue] = useState(0);
  const [showRawData, setShowRawData] = useState(false);

  const market = country || 'IN';
  const marketContext = MARKETS[market] || MARKETS.IN;

  const tasks = useMemo(() => deriveTasks(report), [report]);

  const baseDefense = useMemo(() => {
    const defensible = tasks.filter(t => t.status === 'Defensible');
    return defensible.reduce((a, t) => a + t.impact, 0);
  }, [tasks]);

  const adjustedDefense = Math.min(95, baseDefense + sliderValue * 0.4);
  const adjustedVulnerable = 100 - adjustedDefense;

  const signal = useMemo(() => getSignalMessage(report, tone), [report, tone]);

  // Chart data for the defense grid
  const chartData = useMemo(() => {
    return tasks.map(t => {
      const boost = t.status === 'Defensible' ? (sliderValue * 0.4 / tasks.filter(x => x.status === 'Defensible').length) : 0;
      const reduction = t.status === 'Vulnerable' ? (sliderValue * 0.4 / tasks.filter(x => x.status === 'Vulnerable').length) : 0;
      return {
        name: t.task.length > 22 ? t.task.slice(0, 20) + '…' : t.task,
        fullName: t.task,
        value: Math.max(2, Math.round(t.impact + boost - reduction)),
        status: t.status,
      };
    });
  }, [tasks, sliderValue]);

  const upskillCards = useMemo(() => {
    const cards: { title: string; time: string; desc: string }[] = [];
    const weekly = report.weekly_action_plan?.[0];
    if (weekly) {
      cards.push({ title: weekly.theme, time: `${weekly.effort_hours}h`, desc: weekly.action });
    }
    if (report.immediate_next_step) {
      cards.push({ title: report.immediate_next_step.action, time: report.immediate_next_step.time_required, desc: report.immediate_next_step.rationale });
    }
    const gap = report.skill_gap_map?.[0];
    if (gap) {
      cards.push({ title: `Learn ${gap.missing_skill}`, time: `${gap.weeks_to_proficiency} weeks`, desc: gap.fastest_path });
    }
    return cards.slice(0, 3);
  }, [report]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(173_58%_39%)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tight">Career Resilience Engine</h2>
            <p className="text-xs text-muted-foreground">Micro-task defense analysis · {report.role}</p>
          </div>
        </div>
        {/* Tone Toggle */}
        <button
          onClick={() => setTone(t => t === 'therapeutic' ? 'ambitious' : 'therapeutic')}
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-colors"
        >
          {tone === 'therapeutic' ? '🧘 Calm' : '🚀 Ambitious'}
        </button>
      </div>

      {/* ─── Market Context Strip ─── */}
      <div className="rounded-lg border border-border bg-muted/50 p-3 flex items-start gap-2">
        <Target className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">{market === 'IN' ? '🇮🇳 India' : market === 'US' ? '🇺🇸 US' : '🇦🇪 UAE'}</span>{' '}
          — {marketContext}
        </p>
      </div>

      {/* ═══ SECTION 1: The Signal ═══ */}
      <Card className="border-[hsl(173_58%_39%_/_0.3)] bg-gradient-to-br from-card to-[hsl(173_58%_39%_/_0.04)] shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[hsl(173_58%_39%)]" />
            <CardTitle className="text-sm font-black uppercase tracking-wide">The Signal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground font-semibold leading-relaxed">{signal.headline}</p>
          <div className="rounded-lg bg-[hsl(173_58%_39%_/_0.08)] p-3 border border-[hsl(173_58%_39%_/_0.15)]">
            <p className="text-xs text-foreground leading-relaxed">
              <span className="font-bold text-[hsl(173_58%_39%)]">Action:</span> {signal.action}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION 2: Defense Grid (MTAI) ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
            <Zap className="w-4 h-4 text-[hsl(38_92%_50%)]" />
            Defense Grid — Micro-Task Automation Index
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Score summary bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[hsl(173_58%_39%)]">Defensible {Math.round(adjustedDefense)}%</span>
              <span className="text-[hsl(38_92%_50%)]">Transition {Math.round(adjustedVulnerable)}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <motion.div
                className="h-full rounded-l-full"
                style={{ backgroundColor: 'hsl(173, 58%, 39%)' }}
                animate={{ width: `${adjustedDefense}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <motion.div
                className="h-full rounded-r-full"
                style={{ backgroundColor: 'hsl(38, 92%, 50%)' }}
                animate={{ width: `${adjustedVulnerable}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          {/* Recharts bar chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg bg-card border border-border p-2 shadow-lg text-xs">
                        <p className="font-bold">{d.fullName}</p>
                        <p className={d.status === 'Defensible' ? 'text-[hsl(173_58%_39%)]' : 'text-[hsl(38_92%_50%)]'}>
                          {d.status} · {d.value}% impact
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={600}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.status === 'Defensible' ? 'hsl(173, 58%, 39%)' : 'hsl(38, 92%, 50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Defensibility Slider */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">🎛️ Defensibility Slider</label>
              <Badge variant="outline" className="text-[10px]">{sliderValue} new AI tools learned</Badge>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[sliderValue]}
              onValueChange={([v]) => setSliderValue(v)}
              className="w-full"
            />
            <AnimatePresence mode="wait">
              <motion.p
                key={sliderValue > 0 ? 'active' : 'zero'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-muted-foreground leading-relaxed"
              >
                {sliderValue > 0
                  ? `Learning ${sliderValue} tool${sliderValue > 1 ? 's' : ''} converts ${Math.round(sliderValue * 0.4)}% of your transition tasks into orchestrated workflows.`
                  : 'Move the slider to simulate the impact of learning new AI tools on your defense score.'}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Raw Data Toggle */}
          <button
            onClick={() => setShowRawData(p => !p)}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
          >
            {showRawData ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showRawData ? 'Hide' : 'View'} Raw Task Data
          </button>
          <AnimatePresence>
            {showRawData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-bold text-foreground">Task / Skill</th>
                      <th className="text-center py-2 font-bold text-foreground">Status</th>
                      <th className="text-right py-2 font-bold text-foreground">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 text-foreground">{t.task}</td>
                        <td className="py-1.5 text-center">
                          <Badge variant="outline" className={`text-[11px] ${t.status === 'Defensible' ? 'border-[hsl(173_58%_39%_/_0.4)] text-[hsl(173_58%_39%)]' : 'border-[hsl(38_92%_50%_/_0.4)] text-[hsl(38_92%_50%)]'}`}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono">{t.impact}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ═══ SECTION 3: The Next Move ═══ */}
      {upskillCards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[hsl(173_58%_39%)]" />
              Your Next Move — Synergy Roadmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {upskillCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="rounded-xl border border-border bg-muted/30 p-4 hover:border-[hsl(173_58%_39%_/_0.4)] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{card.time}</span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1.5 leading-snug">{card.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
