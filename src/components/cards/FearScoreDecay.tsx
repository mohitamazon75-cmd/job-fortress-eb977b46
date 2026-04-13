import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, AlertTriangle, Clock, Zap, Bot, Loader2, ExternalLink } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVerbatimRole } from '@/lib/role-guard';
import type { LiveEnrichment } from '@/hooks/use-live-enrichment';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fear-driven emotional hook card.
 * Shows current score vs projected 6-month "no action" score.
 * All projections are deterministic — no LLM dependency.
 * Pulls live scary news from enrichment data.
 * STEP 4: Also shows real score drift vs previous scan (score_history table).
 */

function projectScoreDecay(currentScore: number, automationRisk: number, deadSkillCount: number): number {
  // Deterministic projection: automation risk compounds ~10-18% annually
  // depending on how many of your skills are already at risk
  const riskVelocity = automationRisk >= 60 ? 0.18 : automationRisk >= 40 ? 0.13 : 0.08;
  const skillDecayPenalty = Math.min(12, deadSkillCount * 3); // each at-risk skill costs ~3 points
  const sixMonthDrop = Math.round(currentScore * riskVelocity * 0.5) + Math.round(skillDecayPenalty * 0.5);
  return Math.max(5, currentScore - sixMonthDrop);
}

interface Props {
  report: ScanReport;
  enrichment: {
    data: LiveEnrichment | null;
    loading: boolean;
  };
}

export default function FearScoreDecay({ report, enrichment }: Props) {
  const currentScore = computeStabilityScore(report);
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;
  const deadSkills = report.execution_skills_dead || [];
  const projectedScore = projectScoreDecay(currentScore, automationRisk, deadSkills.length);
  const scoreDrop = currentScore - projectedScore;
  const roleName = getVerbatimRole(report);

  // STEP 4 (BUG-5 fix): Fetch prior scan score from score_history to show real drift.
  // Only runs for authenticated users (score_history skips anon scans).
  // VibeSec: query uses server-validated user_id from session — no IDOR risk.
  const [priorScore, setPriorScore] = useState<number | null>(null);
  const [priorDaysAgo, setPriorDaysAgo] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDrift() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('score_history')
          .select('determinism_index, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5); // fetch a few to find one with a different DI
        if (!cancelled && data && data.length > 1) {
          // Take the second most recent (first is likely the current scan)
          const prior = data[1];
          if (prior?.determinism_index != null) {
            // Convert server DI to client Career Position Score: 100 - DI
            const priorStabilityScore = Math.max(5, Math.min(95, 100 - prior.determinism_index));
            setPriorScore(priorStabilityScore);
            const days = Math.round((Date.now() - new Date(prior.created_at).getTime()) / 86_400_000);
            setPriorDaysAgo(days);
          }
        }
      } catch {
        // Non-fatal — drift badge is additive, not critical
      }
    }
    fetchDrift();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const driftDelta = priorScore != null ? currentScore - priorScore : null;
  const showDrift = driftDelta != null && Math.abs(driftDelta) >= 2; // only show meaningful delta

  const liveTools = (enrichment.data?.tool_threats || []).slice(0, 3);
  const threatSummary = enrichment.data?.threat_summary;
  const threatCitations = enrichment.data?.threat_citations || [];

  // Score zone colors
  const getScoreColor = (s: number) =>
    s >= 70 ? 'text-prophet-green' : s >= 50 ? 'text-primary' : s >= 30 ? 'text-prophet-gold' : 'text-destructive';
  const getScoreBg = (s: number) =>
    s >= 70 ? 'bg-prophet-green' : s >= 50 ? 'bg-primary' : s >= 30 ? 'bg-prophet-gold' : 'bg-destructive';

  const urgencyLabel = scoreDrop >= 15 ? 'CRITICAL' : scoreDrop >= 8 ? 'HIGH' : 'MODERATE';
  const urgencyColor = scoreDrop >= 15 ? 'text-destructive' : scoreDrop >= 8 ? 'text-prophet-gold' : 'text-primary';
  const urgencyBg = scoreDrop >= 15 ? 'bg-destructive/10' : scoreDrop >= 8 ? 'bg-prophet-gold/10' : 'bg-primary/10';

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20 }}
      className="rounded-2xl border-2 border-destructive/30 bg-gradient-to-b from-destructive/[0.06] to-card p-5 space-y-4"
    >
      {/* Urgency badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-destructive">
            What Happens If You Do Nothing
          </span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${urgencyBg} ${urgencyColor}`}>
          {urgencyLabel} URGENCY
        </span>
      </div>

      {/* STEP 4 (BUG-5 fix): Real score drift vs prior scan — most motivating retention signal.
          Shows only when: user is authenticated, prior scan exists, delta ≥ 2 points. */}
      {showDrift && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
            (driftDelta ?? 0) > 0
              ? 'bg-prophet-green/[0.06] border-prophet-green/20'
              : 'bg-destructive/[0.06] border-destructive/20'
          }`}
        >
          {(driftDelta ?? 0) > 0
            ? <TrendingUp className="w-3.5 h-3.5 text-prophet-green flex-shrink-0" />
            : <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          }
          <p className="text-[11px] leading-snug">
            <span className={`font-black ${(driftDelta ?? 0) > 0 ? 'text-prophet-green' : 'text-destructive'}`}>
              {(driftDelta ?? 0) > 0 ? `↑ +${driftDelta ?? 0} points` : `↓ ${driftDelta ?? 0} points`}
            </span>
            <span className="text-muted-foreground">
              {' '}since your last scan{priorDaysAgo != null ? ` (${priorDaysAgo}d ago)` : ''} —{' '}
              {(driftDelta ?? 0) > 0
                ? 'your actions are working. Keep going.'
                : 'AI adoption in your role is accelerating. Time to move.'}
            </span>
          </p>
        </motion.div>
      )}

      {/* Score decay visualization */}
      <div className="flex items-center justify-center gap-4 py-3">
        {/* Current score */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Today</p>
          <motion.p
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className={`text-4xl font-black tabular-nums ${getScoreColor(currentScore)}`}
          >
            {currentScore}
          </motion.p>
          <p className="text-[11px] text-muted-foreground">/100</p>
        </div>

        {/* Decay arrow */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-1"
        >
          <TrendingDown className="w-6 h-6 text-destructive" />
          <span className="text-[10px] font-black text-destructive">-{scoreDrop} pts</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">6 months</span>
          </div>
        </motion.div>

        {/* Projected score */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">If No Action</p>
          <motion.p
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className={`text-4xl font-black tabular-nums ${getScoreColor(projectedScore)}`}
          >
            {projectedScore}
          </motion.p>
          <p className="text-[11px] text-muted-foreground">/100</p>
        </div>
      </div>

      {/* Decay bar visualization */}
      <div className="space-y-1">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden relative">
          <motion.div
            initial={{ width: `${currentScore}%` }}
            animate={{ width: `${projectedScore}%` }}
            transition={{ delay: 0.6, duration: 1.5, ease: 'easeInOut' }}
            className={`h-full rounded-full ${getScoreBg(projectedScore)} relative`}
          >
            {/* Decay zone */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(scoreDrop / currentScore) * 100}%` }}
              transition={{ delay: 0.8, duration: 1 }}
              className="absolute right-0 top-0 h-full bg-destructive/40 rounded-r-full"
              style={{ marginRight: `-${(scoreDrop / currentScore) * 100}%` }}
            />
          </motion.div>
          {/* Ghost bar showing where you are now */}
          <div
            className="absolute top-0 h-full rounded-full border-2 border-dashed border-muted-foreground/30"
            style={{ width: `${currentScore}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          <span className="font-bold text-destructive">{Math.round(automationRisk)}%</span> of your daily tasks overlap with what AI already does — and it's getting better every month
        </p>
      </div>

      {/* Why it's dropping — fact-based bullets */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] px-4 py-3 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-destructive">Why Your Score Is Dropping</p>
        <ul className="space-y-1.5">
          {deadSkills.length > 0 && (
            <motion.li
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="flex items-start gap-2"
            >
              <Zap className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
              <span className="text-[11px] text-foreground/80">
                <span className="font-bold text-destructive">{deadSkills.length} of your skills</span> are being automated right now:{' '}
                {deadSkills.slice(0, 3).join(', ')}
              </span>
            </motion.li>
          )}
          <motion.li
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-start gap-2"
          >
            <Bot className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
            <span className="text-[11px] text-foreground/80">
              AI tool adoption for <span className="font-bold">{roleName}</span> roles is{' '}
              <span className="font-bold text-destructive">{automationRisk >= 60 ? 'accelerating rapidly' : automationRisk >= 40 ? 'growing steadily' : 'emerging'}</span> — new tools launch every quarter
            </span>
          </motion.li>
          <motion.li
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="flex items-start gap-2"
          >
            <TrendingDown className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
            <span className="text-[11px] text-foreground/80">
              {scoreDrop >= 12
                ? `At this pace, your action window for meaningful career repositioning is approximately ${report.months_remaining || 18} months`
                : `Without action, your competitive edge will erode as AI-augmented peers outperform`
              }
            </span>
          </motion.li>
        </ul>
      </div>

      {/* Live scary news — from Tavily enrichment */}
      {enrichment.loading ? (
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Scanning latest AI disruption news for your role...</p>
        </div>
      ) : (threatSummary || liveTools.length > 0) ? (
        <div className="rounded-xl border border-destructive/20 bg-card px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-widest text-destructive">Live Threat Intelligence</p>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full" aria-hidden="true">Last 30 days</span>
          </div>
          {threatSummary && (
            <p className="text-[11px] text-foreground/85 leading-relaxed font-medium">{threatSummary}</p>
          )}
          {liveTools.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {liveTools.map((tool, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <Bot className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-destructive">{tool.tool_name}</span>
                    <span className="text-[10px] text-foreground/70"> — {tool.automates}</span>
                  </div>
                  <span className={`ml-auto flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    tool.adoption === 'Mainstream' ? 'bg-destructive/10 text-destructive' :
                    tool.adoption === 'Growing' ? 'bg-prophet-gold/10 text-prophet-gold' :
                    'bg-muted text-muted-foreground'
                  }`} aria-hidden="true">{tool.adoption}</span>
                </motion.div>
              ))}
            </div>
          )}
          {threatCitations.length > 0 && (
            <div className="pt-1 border-t border-border mt-2">
              <div className="flex flex-wrap gap-2">
                {threatCitations.slice(0, 2).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-0.5 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    Source {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Bottom urgency CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-center pt-1"
      >
        <p className="text-[10px] text-muted-foreground">
          👇 <span className="font-bold text-foreground">Keep scrolling</span> — your defense plan is below
        </p>
      </motion.div>
    </motion.div>
  );
}
