import { useState, useMemo, useCallback } from 'react';
import DataQualityBadge from '@/components/dashboard/DataQualityBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Shield, FileText, Copy, Check, Clock, Zap } from 'lucide-react';
import { type ScanReport, normalizeTools, formatCurrency } from '@/lib/scan-engine';
import { type SeniorityTier, isExecutiveTier, inferSeniorityTier } from '@/lib/seniority-utils';
import { type LiveEnrichment } from '@/hooks/use-live-enrichment';
import { getVerbatimRole } from '@/lib/role-guard';
import { computeStabilityScore } from '@/lib/stability-score';

interface StrategicDossierProps {
  report: ScanReport;
  scanId: string;
  enrichment?: LiveEnrichment | null;
  enrichmentLoading?: boolean;
  country?: string | null;
}

// ═══════════════════════════════════════════════════════════════
// SENIORITY-ADAPTIVE VOCABULARY
// ═══════════════════════════════════════════════════════════════

type TierVocab = {
  positionLabel: string;
  windowLabel: string;
  strengthLabel: string;
  actionSectionTitle: string;
  planTitle: string;
  riskFraming: 'position' | 'risk';
  moatTitle: string;
  exposureTitle: string;
};

function getVocabulary(tier: SeniorityTier): TierVocab {
  if (isExecutiveTier(tier)) {
    return {
      positionLabel: 'Strategic Position',
      windowLabel: 'Transition Window',
      strengthLabel: 'Competitive Moat',
      actionSectionTitle: 'This Week\'s Move',
      planTitle: '30-Day Strategic Plan',
      riskFraming: 'position',
      moatTitle: 'Your Strategic Leverage',
      exposureTitle: 'Organizational Exposure',
    };
  }
  if (tier === 'MANAGER') {
    return {
      positionLabel: 'Career Position',
      windowLabel: 'Action Window',
      strengthLabel: 'Your Strengths',
      actionSectionTitle: 'Priority Action This Week',
      planTitle: '30-Day Career Plan',
      riskFraming: 'risk',
      moatTitle: 'What Makes You Valuable',
      exposureTitle: 'Skills Under Pressure',
    };
  }
  return {
    positionLabel: 'Career Risk',
    windowLabel: 'Time to Act',
    strengthLabel: 'Your Protection',
    actionSectionTitle: 'Do This First',
    planTitle: '4-Week Action Plan',
    riskFraming: 'risk',
    moatTitle: 'Your Unfair Advantage',
    exposureTitle: 'What AI Is Targeting',
  };
}

// ═══════════════════════════════════════════════════════════════
// METRO TIER CONTEXT
// ═══════════════════════════════════════════════════════════════

function getMetroContext(metroTier?: string | null): string {
  if (metroTier === 'tier1') return 'Tier-1 metro (BLR/DEL/MUM/HYD)';
  if (metroTier === 'tier2') return 'Tier-2 city';
  return '';
}

// ═══════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateSummary(
  report: ScanReport,
  tier: SeniorityTier,
  riskScore: number,
  metroContext: string
): string {
  const name = report.linkedin_name || 'Based on your profile';
  const role = getVerbatimRole(report);
  const industry = report.industry || 'your industry';
  const moat = report.moat_indicators?.[0] || report.moat_skills?.[0] || 'strategic judgment';
  const company = report.linkedin_company;
  const months = report.months_remaining;

  const namePrefix = report.linkedin_name ? `${report.linkedin_name}, your` : 'Your';

  if (isExecutiveTier(tier)) {
    const position = 100 - riskScore;
    if (position >= 60) {
      return `${namePrefix} combination of ${moat.toLowerCase()} expertise and ${industry} leadership${company ? ` at ${company}` : ''} positions you in the upper tier of professionals in this market${metroContext ? ` (${metroContext})` : ''}. Your primary consideration is not replacement — it's ensuring your strategic value is visible as organizations restructure around AI. Window to strengthen position: ${months} months.`;
    }
    return `${namePrefix} ${role} experience${company ? ` at ${company}` : ''} provides a foundation, but the ${industry} landscape is shifting${metroContext ? ` across ${metroContext} markets` : ''}. Organizational restructuring is consolidating roles like yours. Your ${moat.toLowerCase()} expertise is your strongest lever — but it needs to be more visible. Repositioning window: ${months} months.`;
  }

  if (tier === 'MANAGER') {
    if (riskScore <= 40) {
      return `${namePrefix} ${role} profile in ${industry}${company ? ` at ${company}` : ''} shows moderate protection${metroContext ? ` in the ${metroContext} market` : ''}. Your ${moat.toLowerCase()} skills are in demand. The next ${months} months are about converting your experience into a stronger position before AI-augmented peers pull ahead.`;
    }
    return `${namePrefix} ${role} role in ${industry}${company ? ` at ${company}` : ''} faces meaningful pressure${metroContext ? ` in ${metroContext} markets` : ''}. ${Math.round(riskScore * 0.5)}% of your current tasks overlap with emerging AI tools. Your ${moat.toLowerCase()} capability is your best asset — the plan below focuses on deepening it. Action window: ${months} months.`;
  }

  // PROFESSIONAL / ENTRY
  if (riskScore <= 40) {
    return `${namePrefix} ${role} skills in ${industry}${metroContext ? ` (${metroContext})` : ''} have solid protection right now. Your strength in ${moat.toLowerCase()} keeps you valuable. But the market is shifting — staying still is the biggest risk. Here's exactly what to focus on in the next ${months} months.`;
  }
  if (riskScore <= 65) {
    return `${namePrefix} ${role} role in ${industry}${metroContext ? ` (${metroContext})` : ''} has some real pressure points. AI tools are already handling parts of what you do. But you have ${report.moat_skills?.length || 0} skills that AI can't touch — and the roles replacing yours actually pay more. Here's how to close the gap in ${months} months.`;
  }
  return `${namePrefix} ${role} work in ${industry}${metroContext ? ` (${metroContext})` : ''} is under significant pressure from AI automation. This isn't about panic — it's about timing. You have ${months} months and ${report.moat_skills?.length || 0} transferable strengths. The plan below is specific to your profile. Start this week.`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StrategicDossier({ report, scanId, enrichment, enrichmentLoading, country }: StrategicDossierProps) {
  const [supportingOpen, setSupportingOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const tier = inferSeniorityTier(report.seniority_tier);
  const vocab = getVocabulary(tier);
  const isExec = isExecutiveTier(tier);

  const COMMODITY_SKILL_PATTERNS = /^(email|calendar|scheduling|filing|data_entry|typing|note_taking|phone|travel|expense|report_writing|powerpoint|spreadsheet|word_processing|basic_copywriting|copywriting|internet_research|meeting)/i;
  const moatSkills = report.moat_skills || [];
  const executionSkillsDead = (report.execution_skills_dead || []).filter(s => !COMMODITY_SKILL_PATTERNS.test(s.replace(/[\s\-]+/g, '_')));
  const tools = normalizeTools(report.ai_tools_replacing || []);

  // Use the same unified Career Position Score as VerdictReveal
  const careerPositionScore = computeStabilityScore(report);
  // For internal logic that needs a risk-like value, invert from the position score
  const clampedRisk = Math.min(95, Math.max(5, 100 - careerPositionScore));

  // Always show the unified Career Position Score (higher = better)
  const displayScore = careerPositionScore;
  const scoreLabel = `${displayScore}/100`;

  const metroContext = getMetroContext(report.industry ? null : null); // We'll infer from report
  const displayRole = getVerbatimRole(report);
  const summary = generateSummary(report, tier, clampedRisk, metroContext);

  // Score color — unified: higher score = better = green
  const scoreColor = displayScore >= 60 ? 'text-dossier-position' : displayScore >= 40 ? 'text-dossier-fg' : 'text-dossier-signal';

  const strengthScore = report.survivability?.score ?? 50;
  const strengthColor = strengthScore >= 60 ? 'text-dossier-position' : strengthScore >= 40 ? 'text-dossier-fg' : 'text-dossier-signal';

  // Weekly action plan — adaptive naming
  const weeklyActions = report.weekly_action_plan || [];

  // Immediate action
  const immediateStep = report.immediate_next_step;

  // Market signals from enrichment
  const threatSummary = enrichment?.threat_summary;

  return (
    <div className="bg-dossier-bg min-h-[60vh] max-w-full overflow-hidden">
      {/* Data Quality Badge */}
      {report.data_quality && (
        <div className="mb-6">
          <DataQualityBadge quality={report.data_quality} source={report.source} />
        </div>
      )}

      {/* ─── TL;DR (3 BULLETS) ─── */}
      <section className="mb-8 rounded-lg border border-dossier-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          TL;DR — Quick Brief
        </p>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2.5 text-sm text-dossier-fg leading-relaxed">
            <span className="text-dossier-position font-bold flex-shrink-0">1.</span>
            Your {displayRole} role has a <span className="font-semibold">{report.months_remaining}-month window</span> before significant market shift in {report.industry}.
          </li>
          <li className="flex items-start gap-2.5 text-sm text-dossier-fg leading-relaxed">
            <span className="text-dossier-position font-bold flex-shrink-0">2.</span>
            {moatSkills.length > 0
              ? <>Your moat is <span className="font-semibold">{moatSkills.slice(0, 2).join(' + ')}</span> — {executionSkillsDead.length > 0 ? `but ${executionSkillsDead.length} skills are being automated.` : 'and these are hard for AI to replicate.'}</>
              : <>Focus on building human-judgment skills that AI cannot replicate.</>
            }
          </li>
          <li className="flex items-start gap-2.5 text-sm text-dossier-fg leading-relaxed">
            <span className="text-dossier-position font-bold flex-shrink-0">3.</span>
            {report.judo_strategy
              ? <>This weekend: Learn <span className="font-semibold">{report.judo_strategy.recommended_tool}</span> — it boosts your protection to {report.judo_strategy.survivability_after_judo}/100.</>
              : immediateStep
              ? <><span className="font-semibold">{immediateStep.action}</span> — {immediateStep.time_required}.</>
              : <>Start upskilling in AI-augmented workflows this weekend to stay ahead.</>
            }
          </li>
        </ul>
      </section>

      {/* ─── 15-MINUTE SATURDAY MISSION ─── */}
      <section className="mb-8 rounded-lg border-2 border-dossier-position/20 bg-dossier-position/[0.03] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-dossier-position" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-position">
            15-Minute Saturday Mission
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-dossier-fg leading-relaxed">
            {report.judo_strategy
              ? `Open YouTube → search "${report.judo_strategy.recommended_tool} tutorial for ${report.role || 'beginners'}" → watch the first 10 minutes → try one thing it shows you. Done. You just jumped ahead of 80% of peers who won't.`
              : immediateStep
              ? `${immediateStep.action}. Deliverable: ${immediateStep.deliverable}. ${immediateStep.time_required}.`
              : `Search "${report.role} AI tools ${new Date().getFullYear()}" → pick one free tool → complete the sign-up → run your first task. You're now in the top 20% of your peers for AI fluency.`
            }
          </p>
          <p className="text-[10px] text-dossier-muted-fg italic">
            ☕ Do this with your Saturday morning chai. No excuses.
          </p>
        </div>
      </section>

      {/* ─── EXECUTIVE SUMMARY ─── */}
      <section className="mb-10">
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
          Executive Summary
        </p>
        <p className="text-[15px] text-dossier-fg leading-[1.8] max-w-2xl">
          {summary}
        </p>
      </section>

      {/* ─── STRATEGIC POSITION ─── */}
      <section className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-5">
          Strategic Position
        </p>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-[11px] text-dossier-muted-fg mb-1">{vocab.positionLabel}</p>
            <p className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>
              {scoreLabel}
            </p>
            {report.score_variability && !isExec && (
              <p className="text-[10px] text-dossier-muted-fg mt-0.5">
                Range: {report.score_variability.di_range.low}–{report.score_variability.di_range.high}%
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-dossier-muted-fg mb-1">{vocab.windowLabel}</p>
            <p className="text-2xl font-semibold tabular-nums text-dossier-fg">
              {report.months_remaining}<span className="text-sm ml-0.5">months</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-dossier-muted-fg mb-1">{vocab.strengthLabel}</p>
            <p className={`text-2xl font-semibold tabular-nums ${strengthColor}`}>
              {strengthScore}<span className="text-sm">/100</span>
            </p>
            {report.survivability?.peer_percentile_estimate && (
              <p className="text-[10px] text-dossier-muted-fg mt-0.5">
                {report.survivability.peer_percentile_estimate}
              </p>
            )}
          </div>
        </div>

        {/* Moat */}
        <div className="border-l-2 border-dossier-position pl-4 mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-position mb-1.5">
            {vocab.moatTitle}
          </p>
          <p className="text-sm text-dossier-fg mb-2">{report.cognitive_moat}</p>
          <div className="flex flex-wrap gap-1.5">
            {moatSkills.map((skill, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded border border-dossier-border text-dossier-fg">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Exposure */}
        {executionSkillsDead.length > 0 && (
          <div className="border-l-2 border-dossier-border pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-exposure mb-1.5">
              {vocab.exposureTitle}
            </p>
            <div className="space-y-1.5">
              {executionSkillsDead.slice(0, 4).map((skill, i) => {
                const matchedTool = tools.find(t =>
                  t.automates_task?.toLowerCase().includes(skill.toLowerCase().split(' ')[0]) ||
                  skill.toLowerCase().includes(t.automates_task?.toLowerCase().split(' ')[0])
                );
                return (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-dossier-fg">{skill}</span>
                    {matchedTool && (
                      <span className="text-[10px] text-dossier-muted-fg">
                        → {matchedTool.tool_name} ({matchedTool.adoption_stage})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── IF YOU DO NOTHING ─── */}
      <section className="mb-10 bg-dossier-muted rounded-lg p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-muted-fg mb-2">
          {isExec ? 'Inaction Scenario' : 'If You Do Nothing'}
        </p>
        <p className="text-sm text-dossier-muted-fg leading-[1.8]">
          {clampedRisk > 65
            ? `Within ${report.months_remaining} months, ${Math.round(clampedRisk * 0.6)}% of current ${displayRole} tasks will be automated in ${report.industry}. Monthly earning pressure: ${formatCurrency(report.salary_bleed_monthly, country)}. ${report.total_5yr_loss_inr ? `5-year cumulative impact: ${formatCurrency(report.total_5yr_loss_inr, country)}.` : `5-year impact: ${formatCurrency(report.salary_bleed_monthly * 60, country)}.`} ${isExec ? 'Organizational restructuring will consolidate your function.' : 'Companies are already consolidating teams.'}`
            : clampedRisk > 40
            ? `Your role has a ${report.months_remaining}-month window before meaningful market shift. Monthly earning erosion: ${formatCurrency(report.salary_bleed_monthly, country)}. The risk is not sudden replacement — it's gradual irrelevance as AI-augmented ${isExec ? 'peers and restructured orgs' : 'peers'} outperform.`
            : `Your position is currently stable, but ${report.industry} is shifting. Monthly salary pressure: ${formatCurrency(report.salary_bleed_monthly, country)}. ${isExec ? 'Complacency at the leadership level is the primary risk — organizations that adopt AI governance early will restructure around those leaders.' : 'Complacency is the primary risk — peers who upskill will pull ahead.'}`
          }
        </p>
      </section>

      {/* ─── THIS WEEK'S MOVE ─── */}
      {immediateStep && (
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
            {vocab.actionSectionTitle}
          </p>
          <div className="border border-dossier-border rounded-lg p-5">
            <p className="text-sm font-semibold text-dossier-fg mb-1">{immediateStep.action}</p>
            <p className="text-sm text-dossier-muted-fg mb-3">{immediateStep.rationale}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold text-dossier-fg">Deliverable:</span>
              <span className="text-sm text-dossier-muted-fg">{immediateStep.deliverable}</span>
            </div>
            <p className="text-[10px] text-dossier-muted-fg mt-2">{immediateStep.time_required}</p>
          </div>
        </section>
      )}

      {/* ─── JUDO STRATEGY (if available) ─── */}
      {report.judo_strategy && (
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
            {isExec ? 'AI Leverage Opportunity' : 'Weekend Defense Move'}
          </p>
          <div className="border border-dossier-border rounded-lg p-5">
            <p className="text-sm font-semibold text-dossier-fg mb-1">
              {isExec ? `Position yourself as the ${report.judo_strategy.recommended_tool} champion in your org` : `Learn ${report.judo_strategy.recommended_tool} this weekend`}
            </p>
            <p className="text-sm text-dossier-muted-fg mb-2">{report.judo_strategy.pitch}</p>
            <div className="flex gap-4 text-[11px] text-dossier-muted-fg">
              <span>Protection after: <span className="font-semibold text-dossier-position">{report.judo_strategy.survivability_after_judo}/100</span></span>
              <span>Months gained: <span className="font-semibold text-dossier-fg">+{report.judo_strategy.months_gained}</span></span>
            </div>
          </div>
        </section>
      )}

      {/* ─── 30-DAY / 4-WEEK PLAN ─── */}
      {weeklyActions.length > 0 && (
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
            {vocab.planTitle}
          </p>
          <div className="space-y-4">
            {weeklyActions.map((action, i) => {
              // Get resources — from action or enrichment
              const booksPerWeek = enrichment?.books ? Math.ceil(enrichment.books.length / weeklyActions.length) : 0;
              const coursesPerWeek = enrichment?.courses ? Math.ceil(enrichment.courses.length / weeklyActions.length) : 0;
              const weekBooks = action.books?.length ? action.books :
                enrichment?.books?.slice(i * booksPerWeek, (i + 1) * booksPerWeek) || [];
              const weekCourses = action.courses?.length ? action.courses :
                enrichment?.courses?.slice(i * coursesPerWeek, (i + 1) * coursesPerWeek) || [];

              return (
                <div key={i} className="border border-dossier-border rounded-lg p-5">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-[11px] font-semibold text-dossier-muted-fg uppercase tracking-wider">
                      Week {action.week}
                    </span>
                    <span className="text-sm font-semibold text-dossier-fg">{action.theme}</span>
                    <span className="text-[10px] text-dossier-muted-fg ml-auto">{action.effort_hours}h</span>
                  </div>
                  <p className="text-sm text-dossier-fg mb-2">{action.action}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-dossier-fg">Deliverable:</span>
                    <span className="text-sm text-dossier-muted-fg">{action.deliverable}</span>
                  </div>
                  {action.fallback_action && (
                    <p className="text-[10px] text-dossier-muted-fg italic mt-1">Fallback: {action.fallback_action}</p>
                  )}

                  {/* Resources — quiet list */}
                  {(weekBooks.length > 0 || weekCourses.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-dossier-border space-y-1.5">
                      {weekBooks.slice(0, 2).map((b: any, bi: number) => (
                        <p key={`b-${bi}`} className="text-[11px] text-dossier-muted-fg">
                          📖 <span className="font-medium text-dossier-fg">{b.title}</span> — {b.author_or_platform || b.author}
                        </p>
                      ))}
                      {weekCourses.slice(0, 2).map((c: any, ci: number) => (
                        <p key={`c-${ci}`} className="text-[11px] text-dossier-muted-fg">
                          🎓 <span className="font-medium text-dossier-fg">{c.title}</span> — {c.author_or_platform || c.platform}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── MARKET SIGNAL ─── */}
      {(threatSummary || report.linkedin_company) && (
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
            Market Signal
          </p>
          {threatSummary && (
            <p className="text-sm text-dossier-fg leading-relaxed mb-3">{threatSummary}</p>
          )}
          {enrichment?.threat_citations && enrichment.threat_citations.length > 0 && (
            <p className="text-[10px] text-dossier-muted-fg">
              Sources: {enrichment.threat_citations.slice(0, 3).map((c: string, i: number) => (
                <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-dossier-fg mr-2">[{i + 1}]</a>
              ))}
            </p>
          )}
          {report.skill_gap_map && report.skill_gap_map.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold text-dossier-muted-fg uppercase tracking-wider">
                {isExec ? 'Capability Gaps to Close' : 'Skills to Build'}
              </p>
              {report.skill_gap_map.slice(0, 3).map((gap, i) => (
                <div key={i} className="flex items-baseline justify-between text-sm border-b border-dossier-border pb-2">
                  <span className="text-dossier-fg">{gap.missing_skill}</span>
                  <span className="text-[10px] text-dossier-muted-fg">
                    {gap.weeks_to_proficiency}wk · {gap.fastest_path} · +{formatCurrency(gap.salary_unlock_inr_monthly, country)}/mo
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── CAREER PIVOTS (brief) ─── */}
      {report.arbitrage_role && (
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
            {isExec ? 'Adjacent Positioning Options' : 'Career Pivot Options'}
          </p>
          <div className="border border-dossier-border rounded-lg p-5">
            <p className="text-sm text-dossier-fg mb-1">
              <span className="font-semibold">{report.arbitrage_role}</span>
              {report.arbitrage_companies_count > 0 && (
                <span className="text-dossier-muted-fg"> · {report.arbitrage_companies_count} companies hiring</span>
              )}
            </p>
            {report.geo_arbitrage && (
              <p className="text-[11px] text-dossier-muted-fg mt-1">
                Geo opportunity: {report.geo_arbitrage.target_market} · +{formatCurrency(report.geo_arbitrage.probability_adjusted_delta_inr, country)}/mo probability-adjusted
              </p>
            )}
          </div>
        </section>
      )}

      {/* ─── SUPPORTING ANALYSIS (collapsed) ─── */}
      <section className="mb-6">
        <button
          onClick={() => setSupportingOpen(!supportingOpen)}
          className="flex items-center gap-2 text-sm font-medium text-dossier-muted-fg hover:text-dossier-fg transition-colors w-full"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${supportingOpen ? 'rotate-180' : ''}`} />
          Supporting Analysis
        </button>

        <AnimatePresence>
          {supportingOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-6">
                {/* Score Methodology */}
                {report.score_breakdown && (
                  <div className="border border-dossier-border rounded-lg p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-muted-fg mb-3">Score Computation</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-dossier-muted-fg">Base score ({report.role} family)</span>
                        <span className="text-dossier-fg tabular-nums">{report.score_breakdown.base_score}</span>
                      </div>
                      {report.score_breakdown.weighted_skill_average !== null && (
                        <div className="flex justify-between">
                          <span className="text-dossier-muted-fg">Weighted skill average</span>
                          <span className="text-dossier-fg tabular-nums">{Math.round(report.score_breakdown.weighted_skill_average)}</span>
                        </div>
                      )}
                      {report.score_breakdown.market_pressure !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-dossier-muted-fg">Market AI pressure</span>
                          <span className="text-dossier-signal tabular-nums">+{report.score_breakdown.market_pressure}</span>
                        </div>
                      )}
                      {report.score_breakdown.experience_reduction > 0 && (
                        <div className="flex justify-between">
                          <span className="text-dossier-muted-fg">Experience reduction</span>
                          <span className="text-dossier-position tabular-nums">-{report.score_breakdown.experience_reduction}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-dossier-border">
                        <span className="font-semibold text-dossier-fg">Final</span>
                        <span className="font-semibold text-dossier-fg tabular-nums">{report.score_breakdown.final_clamped}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Protection Breakdown */}
                {report.survivability && (
                  <div className="border border-dossier-border rounded-lg p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-muted-fg mb-3">
                      {isExec ? 'Competitive Moat Breakdown' : 'Protection Score Breakdown'}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(report.survivability.breakdown).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-lg font-semibold text-dossier-position tabular-nums">+{value}</p>
                          <p className="text-[10px] text-dossier-muted-fg capitalize">{key.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                    {report.survivability.primary_vulnerability && (
                      <p className="text-xs text-dossier-signal mt-3">
                        Primary gap: {report.survivability.primary_vulnerability}
                      </p>
                    )}
                  </div>
                )}

                {/* All AI Tools */}
                {tools.length > 0 && (
                  <div className="border border-dossier-border rounded-lg p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-muted-fg mb-3">
                      AI Tools Mapped ({tools.length})
                    </p>
                    <div className="space-y-2">
                      {tools.map((t, i) => (
                        <div key={i} className="flex items-baseline justify-between text-sm gap-2">
                          <span className="text-dossier-fg truncate">{t.tool_name}</span>
                          <span className="text-[10px] text-dossier-muted-fg whitespace-nowrap flex-shrink-0">{t.automates_task} · {t.adoption_stage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Obsolescence Timeline */}
                {report.obsolescence_timeline && (
                  <div className="border border-dossier-border rounded-lg p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dossier-muted-fg mb-3">Timeline</p>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-dossier-position tabular-nums">{report.obsolescence_timeline.purple_zone_months}mo</p>
                        <p className="text-[10px] text-dossier-muted-fg">Safe</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-dossier-fg tabular-nums">{report.obsolescence_timeline.yellow_zone_months}mo</p>
                        <p className="text-[10px] text-dossier-muted-fg">Transition</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-dossier-signal tabular-nums">{report.obsolescence_timeline.orange_zone_months}mo</p>
                        <p className="text-[10px] text-dossier-muted-fg">Pressure</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-dossier-exposure tabular-nums">{report.obsolescence_timeline.red_zone_months}mo</p>
                        <p className="text-[10px] text-dossier-muted-fg">Critical</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── SEND TO MANAGER EMAIL ─── */}
      <section className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dossier-muted-fg mb-4">
          📧 Send This to Your Manager
        </p>
        <div className="border border-dossier-border rounded-lg p-5 relative">
          <button
            onClick={() => {
              const emailText = `Hi [Manager Name],\n\nI've been researching how AI is impacting ${report.industry}, specifically roles like ${displayRole}. A few things I found:\n\n• ${executionSkillsDead.length > 0 ? `${executionSkillsDead.length} of our team's routine skills (${executionSkillsDead.slice(0, 2).join(', ')}) now have AI tool alternatives` : 'Several routine workflows in our domain now have AI alternatives'}\n• ${report.judo_strategy ? `Tools like ${report.judo_strategy.recommended_tool} could boost our team's productivity significantly` : 'AI-augmented workflows could boost our team productivity significantly'}\n• Teams that adopt these tools early are seeing 30-40% efficiency gains\n\nI'd like to propose a small pilot — I'll spend ${report.judo_strategy ? `a weekend learning ${report.judo_strategy.recommended_tool}` : 'time this month learning one AI tool'} and report back on how we could apply it.\n\nWould you be open to a 15-minute chat about this?\n\nBest,\n[Your Name]`;
              navigator.clipboard.writeText(emailText).then(() => {
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 3000);
              });
            }}
            className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-bold text-dossier-muted-fg hover:text-dossier-fg transition-colors"
          >
            {emailCopied ? <><Check className="w-3 h-3 text-dossier-position" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy email</>}
          </button>
          <div className="text-sm text-dossier-fg leading-relaxed space-y-2 font-mono max-w-full overflow-hidden break-words">
            <p className="text-dossier-muted-fg text-xs">Subject: Quick idea — AI tools for our team</p>
            <p>Hi [Manager Name],</p>
            <p>I've been researching how AI is impacting {report.industry}, specifically roles like {displayRole}. A few things I found:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>{executionSkillsDead.length > 0 ? `${executionSkillsDead.length} of our team's routine skills (${executionSkillsDead.slice(0, 2).join(', ')}) now have AI tool alternatives` : 'Several routine workflows in our domain now have AI alternatives'}</li>
              <li>{report.judo_strategy ? `Tools like ${report.judo_strategy.recommended_tool} could boost our team's productivity significantly` : 'AI-augmented workflows could boost our team productivity significantly'}</li>
              <li>Teams that adopt these tools early are seeing 30-40% efficiency gains</li>
            </ul>
            <p>I'd like to propose a small pilot — I'll spend {report.judo_strategy ? `a weekend learning ${report.judo_strategy.recommended_tool}` : 'time this month learning one AI tool'} and report back on how we could apply it.</p>
            <p>Would you be open to a 15-minute chat about this?</p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-dossier-border pt-4 mt-8">
        <div className="flex items-center gap-2 text-[10px] text-dossier-muted-fg">
          <Shield className="w-3 h-3" />
          <span>JobBachao Engine v3.2</span>
          <span>·</span>
          <span>Numbers: 100% Algorithmic</span>
          <span>·</span>
          <span>Strategy: AI-Assisted</span>
          {(report.computation_method?.kg_skills_matched ?? 0) > 0 && (
            <>
              <span>·</span>
              <span>{report.computation_method?.kg_skills_matched} skills matched in Knowledge Graph</span>
            </>
          )}
        </div>
        <p className="text-[11px] text-dossier-muted-fg mt-2 leading-relaxed">
          This analysis uses algorithmic models and AI-assisted interpretation. All scores indicate estimated trends, not certainties. Individual outcomes vary significantly. This is not financial, legal, or career advice.
        </p>
      </footer>
    </div>
  );
}
