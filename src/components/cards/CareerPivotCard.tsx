import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, TrendingUp, Shield, Clock, DollarSign, Loader2, ChevronDown, ChevronUp, Zap, Target, Sparkles, X, Lock, Check, Rocket, BarChart3 } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import type { PivotEngineOutput, PivotRecommendation, SkillGap } from '@/types/pivot-engine.types';
import { useSubscription } from '@/hooks/use-subscription';
import ProUpgradeModal from '@/components/ProUpgradeModal';

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors = {
    Easy: 'bg-prophet-green/15 text-prophet-green border-prophet-green/30',
    Medium: 'bg-prophet-gold/15 text-prophet-gold border-prophet-gold/30',
    Hard: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors[difficulty as keyof typeof colors] || colors.Medium}`}>
      {difficulty}
    </span>
  );
}

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-prophet-green' : pct >= 40 ? 'bg-prophet-gold' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] font-bold text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.2 }} className={`h-full rounded-full ${color}`} />
      </div>
      <span className="text-[10px] font-mono font-bold text-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function SkillGapsList({ gaps }: { gaps: SkillGap[] }) {
  if (!gaps.length) return null;
  return (
    <div className="space-y-2 mt-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Skill Gaps</p>
      {gaps.map((gap, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className={`shrink-0 text-[11px] font-black uppercase px-1.5 py-0.5 rounded ${gap.importance === 'core' ? 'bg-red-500/15 text-red-400' : 'bg-muted text-muted-foreground'}`}>
            {gap.importance}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-foreground">{gap.skill_name}</p>
            <p className="text-muted-foreground text-xs">{gap.proof_suggestion}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadinessTimeline({ readiness }: { readiness: PivotRecommendation['readiness'] }) {
  const paces = [
    { label: 'Light', hours: '4 hrs/wk', weeks: readiness.light_weeks, icon: '🚶' },
    { label: 'Steady', hours: '7 hrs/wk', weeks: readiness.steady_weeks, icon: '🏃' },
    { label: 'Aggressive', hours: '12 hrs/wk', weeks: readiness.aggressive_weeks, icon: '🚀' },
  ];
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Time to Readiness</p>
      {paces.map(p => (
        <div key={p.label} className="flex items-center gap-2 text-xs">
          <span className="text-sm">{p.icon}</span>
          <span className="font-bold text-foreground w-20">{p.label}</span>
          <span className="text-muted-foreground">{p.hours}</span>
          <span className="ml-auto font-mono font-bold text-primary">{p.weeks} wks</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Role Card
// ═══════════════════════════════════════════════════════════════

function RoleCard({ role, rank, isStretch }: { role: PivotRecommendation; rank: number; isStretch?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1, duration: 0.4 }}
      className={`rounded-xl border-2 p-4 transition-all ${isStretch ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isStretch && <Sparkles className="w-4 h-4 text-primary shrink-0" />}
            <span className="text-[10px] font-mono font-bold text-muted-foreground">#{rank + 1}</span>
            <DifficultyBadge difficulty={role.difficulty} />
          </div>
          <h3 className="text-base font-black text-foreground leading-tight">{role.target_role}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-primary">{role.skill_match_pct}%</p>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Match</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-1.5 mb-3">
        <ScoreBar label="Demand" value={role.scores.demand} icon={TrendingUp} />
        <ScoreBar label="Safety" value={role.scores.safety} icon={Shield} />
        <ScoreBar label="Readiness" value={role.scores.feasibility} icon={Clock} />
        <ScoreBar label="Salary" value={role.scores.salary} icon={DollarSign} />
      </div>

      {/* Salary band */}
      <div className="flex items-center gap-2 text-xs mb-2">
        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          {role.salary_band.currency} {role.salary_band.min_lpa}–{role.salary_band.max_lpa} LPA
        </span>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${role.salary_band.confidence === 'high' ? 'bg-green-500/15 text-green-400' : role.salary_band.confidence === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
          {role.salary_band.confidence} conf.
        </span>
      </div>

      {/* Why it fits */}
      {role.why_it_fits?.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Why This Fits</p>
          {role.why_it_fits.map((reason, i) => (
            <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
              <Target className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              {reason}
            </p>
          ))}
        </div>
      )}

      {/* Why safer */}
      {role.why_its_safer?.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Why It's Safer</p>
          {role.why_its_safer.map((reason, i) => (
            <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
              <Shield className="w-3 h-3 text-prophet-green shrink-0 mt-0.5" />
              {reason}
            </p>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors mt-1 min-h-[44px]"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {expanded ? 'Hide Details' : 'View Transition Plan'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <SkillGapsList gaps={role.skill_gaps} />
            <ReadinessTimeline readiness={role.readiness} />

            {/* Transition plan */}
            {role.transition_plan?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transition Steps</p>
                {role.transition_plan.map((step, i) => (
                  <p key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                    <span className="font-mono font-bold text-primary shrink-0">{i + 1}.</span>
                    {step}
                  </p>
                ))}
              </div>
            )}

            {/* Sample companies */}
            {role.sample_companies?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Hiring Companies</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.sample_companies.map((c, i) => (
                    <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Card Component
// ═══════════════════════════════════════════════════════════════

export default function CareerPivotCard({ report }: { report: ScanReport }) {
  const { isActive } = useSubscription();
  const [data, setData] = useState<PivotEngineOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showProModal, setShowProModal] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in to analyze career pivots.');

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!baseUrl) throw new Error('VITE_SUPABASE_URL is not configured');
      const resp = await fetch(`${baseUrl}/functions/v1/run-pivot-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          role: report.role,
          industry: report.industry,
          skills: report.all_skills || [],
          moatSkills: report.moat_skills || [],
          country: report.country || 'IN',
          yearsExperience: report.years_experience || '',
          metroTier: report.metro_tier || 'tier1',
          determinismIndex: report.determinism_index,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(errData.error || 'Analysis failed');
      }

      const result = await resp.json();
      setData(result);
      setHasLoaded(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [report]);

  // ── Pro gate: show upgrade teaser ────────────────────────────
  if (!isActive) {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Pro Feature</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Career Pivot Analysis is a Pro feature. Unlock it to discover 3 adjacent pivots and a bold stretch role, each with skill gaps, timelines and transition plans tailored to your profile.
            </p>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {[
              '3 adjacent pivots with lower risk',
              '1 bold stretch role for higher upside',
              'Skill gaps & readiness timelines',
              'Salary bands & hiring companies',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />
                <span className="text-xs text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowProModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Unlock Pro — from ₹300/mo
          </button>
          <p className="text-[11px] text-muted-foreground">
            One upgrade · unlocks all 4 Pro cards in this report
          </p>
        </motion.div>
        <ProUpgradeModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
        />
      </>
    );
  }

  // ── Not loaded yet — show CTA ──
  if (!hasLoaded && !loading) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-5 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground mb-2">
            Based on your scan results, we can identify <span className="text-primary">safer career pivots</span> with higher demand, better salary potential, and lower automation risk.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            3 adjacent moves + 1 bold stretch role, each with skill gaps, timelines & transition plans.
          </p>
          <button
            onClick={analyze}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-black text-sm hover:bg-foreground/90 transition-all min-h-[44px]"
          >
            <Zap className="w-4 h-4" /> Analyze My Career Pivots
          </button>
        </motion.div>

        <p className="text-[10px] text-center text-muted-foreground italic">
          Safer relative to your current role based on market and skill signals. Not a guarantee.
        </p>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-border bg-card p-8 text-center">
          <Loader2 className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
          <p className="text-sm font-bold text-foreground">Analyzing career transitions...</p>
          <p className="text-xs text-muted-foreground mt-1">Scoring transferability, safety, demand & feasibility</p>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse rounded-xl border-2 border-border bg-card p-4 space-y-3">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-2 bg-muted rounded w-full" />
            <div className="h-2 bg-muted rounded w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ──
  if (error && !data) {
    return (
      <div className="rounded-xl border-2 border-border bg-muted/20 p-5 text-center space-y-3">
        <p className="text-sm font-bold text-foreground">Pivot analysis unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">
          Could not generate career pivots for this profile right now.
        </p>
        <button onClick={analyze} className="text-xs font-black text-primary hover:underline uppercase tracking-wider">
          Try Again
        </button>
      </div>
    );
  }

  // ── Results ──
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Current role context */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Role</p>
            <p className="text-sm font-bold text-foreground">{data.current_role_summary.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Safety</p>
            <p className={`text-lg font-black ${data.current_role_summary.safety_score >= 0.6 ? 'text-green-400' : data.current_role_summary.safety_score >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
              {Math.round(data.current_role_summary.safety_score * 100)}%
            </p>
          </div>
        </div>
      </motion.div>

      {/* Adjacent roles */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adjacent Pivots — Easier Transitions</p>
        </div>
        <div className="space-y-3">
          {data.adjacent_roles.map((role, i) => (
            <RoleCard key={i} role={role} rank={i} />
          ))}
        </div>
      </div>

      {/* Stretch role */}
      {data.stretch_role && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bold Stretch — Higher Upside</p>
          </div>
          <RoleCard role={data.stretch_role} rank={3} isStretch />
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-center text-muted-foreground italic px-4">
        {data.disclaimer}
      </p>

      {/* Re-analyze */}
      <div className="text-center">
        <button onClick={analyze} className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors min-h-[44px]">
          ↻ Re-analyze with latest data
        </button>
      </div>
    </div>
  );
}
