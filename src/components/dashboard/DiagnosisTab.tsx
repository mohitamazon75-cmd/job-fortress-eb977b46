import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MicroFeedback from '@/components/dashboard/MicroFeedback';
import HinglishTooltip from '@/components/dashboard/HinglishTooltip';
import { AlertTriangle, CheckCircle, Brain, Clock, Shield, ShieldCheck, TrendingDown, ArrowRight, Flame, Eye, Zap, ChevronDown, Info, FlaskConical, ExternalLink, Swords, Database, ChevronUp, Cpu, UserCheck } from 'lucide-react';
import { getExecutiveLabel } from '@/lib/seniority-utils';
import { formatCurrency, normalizeTools, type SkillThreatIntel } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import MLWakingState from '@/components/MLWakingState';
import PanicIndexWidget from '@/components/PanicIndexWidget';
import CompanyBenchmarkWidget from '@/components/CompanyBenchmarkWidget';
import AIThreatCard from '@/components/dashboard/AIThreatCard';
import FeedbackButtons from '@/components/dashboard/FeedbackButtons';
import CountdownTimer from '@/components/dashboard/CountdownTimer';
import PeerComparison from '@/components/dashboard/PeerComparison';

// ── Skill Threat Intel Section ─────────────────────────────────────────────
// Per-skill breakdown: what AI does vs what human still owns.
// Previously only rendered in DoomClockCard (free tier).
// Now shown in full in the Pro DiagnosisTab.
function SkillThreatIntelSection({ intel, isExec }: { intel: SkillThreatIntel[]; isExec?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = [...intel].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.risk_level ?? 'MEDIUM'] ?? 1) - (order[b.risk_level ?? 'MEDIUM'] ?? 1);
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className="rounded-2xl border-2 border-border bg-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-destructive" />
          <p className="text-[10px] font-black uppercase tracking-widest text-destructive">
            {isExec ? 'Strategic Disruption Intelligence' : 'Skill-by-Skill AI Threat Analysis'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isExec ? 'How AI is reshaping your organisational function — and where human judgment still wins.' : 'Exactly which AI tool threatens each skill, and what you still own.'}
        </p>
      </div>
      <div className="divide-y divide-border/40">
        {sorted.map((item) => {
          const isOpen = expanded === item.skill;
          const riskColor = item.risk_level === 'HIGH'
            ? 'text-destructive bg-destructive/10 border-destructive/25'
            : item.risk_level === 'LOW'
            ? 'text-prophet-green bg-prophet-green/10 border-prophet-green/25'
            : 'text-amber-400 bg-amber-400/10 border-amber-400/25';
          const riskLabel = item.risk_level ?? 'MEDIUM';

          return (
            <div key={item.skill}>
              <button
                onClick={() => setExpanded(isOpen ? null : item.skill)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
              >
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${riskColor}`}>
                  {riskLabel}
                </span>
                <span className="flex-1 text-sm font-bold text-foreground truncate">{item.skill}</span>
                {item.threat_tool && (
                  <span className="text-[10px] text-muted-foreground hidden sm:block flex-shrink-0">→ {item.threat_tool}</span>
                )}
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Cpu className="w-2.5 h-2.5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-destructive mb-0.5">AI doing it now</p>
                          <p className="text-xs text-foreground/85 leading-relaxed">{item.what_ai_does}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-prophet-green/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <UserCheck className="w-2.5 h-2.5 text-prophet-green" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-prophet-green mb-0.5">What you still own</p>
                          <p className="text-xs text-foreground/85 leading-relaxed">{item.what_human_still_owns}</p>
                        </div>
                      </div>
                      {item.industry_proof && (
                        <div className="bg-muted/40 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-semibold text-muted-foreground italic leading-relaxed">{item.industry_proof}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
import FateCardShare from '@/components/dashboard/FateCardShare';
import PDFExport from '@/components/dashboard/PDFExport';
import LinkedInPostGenerator from '@/components/dashboard/LinkedInPostGenerator';
import ScoreBreakdownPanel from '@/components/dashboard/ScoreBreakdownPanel';
import FooterSection from '@/components/dashboard/FooterSection';
import KnowledgeGraphView from '@/components/dashboard/KnowledgeGraphView';
import { IndustryCalibrationCard, SeniorityProtectionCard, ConfidenceIntervalCard, DataSourceBadge } from '@/components/dashboard/IntelligenceProofCards';
import type { DashboardSharedProps } from '@/components/dashboard/DashboardTypes';

export default function DiagnosisTab({ props }: { props: DashboardSharedProps }) {
  const {
    report, scanId, country,
    displayScoreValue, clampedRisk, scoreColorClass, seniorityTier, isExec,
    userName, userCompany, displayRole, profileContext, isLinkedIn, isResume,
    toneTag, toneColors, executionSkillsDead, moatSkills, tools,
    deadEndNarrative, ci, kgMatched, kgLastRefresh,
    enrichment, setActiveScreen, source, locale, strings,
  } = props;

  const [riskMethodOpen, setRiskMethodOpen] = useState(false);

  return (
    <motion.div
      key="diagnosis"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile context bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm text-primary-foreground flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground leading-tight truncate">{profileContext}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {isLinkedIn ? '🔗 LinkedIn' : isResume ? '📄 Resume' : '📊 Industry'} · {report.industry} · {displayRole}
              {report.compound_role && report.role_components && (
                <span className="ml-1 text-primary font-semibold">({report.role_components.join(' + ')})</span>
              )}
              {report.company_tier && (
                <span className="ml-1 font-semibold">· {report.company_tier}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${toneColors[toneTag]}`}>
            {toneTag}
          </span>
          {report.data_quality && (
            <span className={`text-[11px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${
              report.data_quality.overall === 'HIGH' ? 'bg-prophet-green/10 text-prophet-green' :
              report.data_quality.overall === 'MEDIUM' ? 'bg-prophet-gold/10 text-prophet-gold' : 'bg-prophet-red/10 text-prophet-red'
            }`}>
              {report.data_quality.overall} · {kgMatched} skills
            </span>
          )}
        </div>
      </div>

      {/* KG Coverage Tip */}
      {report.data_quality && (report.data_quality.kg_coverage < 50 || (report.computation_method?.kg_skills_matched ?? 99) <= 2) && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 mb-5">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your report is ready</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We analyzed your profile using industry benchmarks and {kgMatched > 0 ? `${kgMatched} skill-specific data points` : 'broad market signals'}.
                {' '}For even sharper insights, try adding specific technical skills to your profile (e.g., "Data Pipeline Engineering" instead of "Data").
              </p>
              {report.score_breakdown?.skill_adjustments && report.score_breakdown.skill_adjustments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-semibold">Skills analyzed:</span>
                  {report.score_breakdown.skill_adjustments.map((adj, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{adj.skill_name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ML Waking / Timeout State */}
      {report.ml_timed_out && !report.ml_enhanced && (
        <div className="mb-5">
          <MLWakingState message="ML engine timed out — showing deterministic analysis" />
        </div>
      )}

      {/* THE HEADLINE */}
      <div className="rounded-2xl border-2 p-4 sm:p-6 md:p-8 mb-4 sm:mb-6" style={{ 
        borderColor: displayScoreValue >= 50 ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--prophet-gold) / 0.2)',
        background: displayScoreValue >= 50 
          ? 'linear-gradient(135deg, hsl(var(--primary) / 0.03), hsl(var(--background)))' 
          : 'linear-gradient(135deg, hsl(var(--prophet-gold) / 0.03), hsl(var(--background)))'
      }}>
        <div className="flex items-start gap-3 mb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${displayScoreValue >= 50 ? 'bg-primary/10' : 'bg-prophet-gold/10'}`}>
            {displayScoreValue >= 50 ? <Shield className="w-6 h-6 text-primary" /> : <AlertTriangle className="w-6 h-6 text-prophet-gold" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground leading-tight">
              {userName !== 'Professional' ? `${userName}, your` : 'Your'}{' '}
              <span className={isExec ? 'text-primary' : 'text-prophet-red'}>{displayRole}</span> role{' '}
              {isExec ? (
                <>
                  has a <span className="underline decoration-primary decoration-4 underline-offset-4">Career Position Score of {displayScoreValue}</span>{' '}
                  — your <span className="underline decoration-primary decoration-4 underline-offset-4">adaptation window opens within {report.months_remaining} months</span>.
                  {displayScoreValue >= 60 && ((report.moat_indicators?.length ?? 0) > 0 || moatSkills.length > 0) && (
                    <span className="text-prophet-green"> Your {report.moat_indicators?.[0] || moatSkills[0]} provides strong organizational leverage.</span>
                  )}
                </>
              ) : (
                <>
                  has a <span className={`underline decoration-4 underline-offset-4 ${displayScoreValue >= 50 ? 'decoration-primary' : 'decoration-prophet-gold'}`}>Career Position Score of {displayScoreValue}/100</span> — adaptation window{' '}
                  <span className="underline decoration-prophet-gold decoration-4 underline-offset-4">opens within {report.months_remaining} months</span>.
                  {displayScoreValue < 35 && moatSkills.length > 0 && (
                    <span className="text-prophet-green"> But the roles replacing yours pay more, and you already have {moatSkills.length} of the skills needed. Let's close the gap.</span>
                  )}
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-2xl">
              {deadEndNarrative || (
                userCompany
                  ? `Based on your profile at ${userCompany}, we've mapped your exact skill fingerprint against ${kgMatched} data points in our Knowledge Graph. Here's what the data says about your future.`
                  : `We've analyzed your ${report.industry} role against ${kgMatched || 'hundreds of'} skill-to-disruption mappings. The numbers are unambiguous.`
              )}
            </p>
          </div>
        </div>

        {/* The 3 Numbers That Matter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl border p-4 ${displayScoreValue >= 60 ? 'border-prophet-green/20' : displayScoreValue >= 40 ? 'border-primary/20' : 'border-prophet-gold/20'} bg-background`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className={`w-3.5 h-3.5 ${displayScoreValue >= 60 ? 'text-prophet-green' : displayScoreValue >= 40 ? 'text-primary' : 'text-prophet-gold'}`} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                {getExecutiveLabel('automation_risk', seniorityTier)}
              </span>
              <HinglishTooltip en={strings.tooltip_risk_score} hi={locale === 'hi' ? strings.tooltip_risk_score : undefined} locale={locale} />
              <DataSourceBadge type="computed" />
              {report.ml_enhanced && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-auto">Powered by Vector ML</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
              {isExec
                ? 'How strong your strategic position is against AI disruption'
                : 'Your overall career strength against AI disruption'}
            </p>
            <p className={`text-3xl font-black ${scoreColorClass}`}>
              {displayScoreValue}<span className="text-base">/100</span>
            </p>
            {ci && (
              <p className="text-[11px] text-muted-foreground mt-0.5 font-semibold">Range: {Math.min(100 - ci.di_range.high, 100 - ci.di_range.low)}–{Math.max(100 - ci.di_range.high, 100 - ci.di_range.low)}/100</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {displayScoreValue >= 70 ? 'Strong position — your skills are hard to replace' : displayScoreValue >= 50 ? 'Defensible position — keep strengthening your moat' : displayScoreValue >= 35 ? 'Exposed — proactive moves recommended' : 'Vulnerable — consider taking action soon'}
            </p>
            <button
              onClick={() => setRiskMethodOpen(!riskMethodOpen)}
              className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <FlaskConical className="w-3 h-3" />
              See Why
              <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${riskMethodOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {/* NARRATION-7 fix: months_remaining is the YELLOW ZONE start — the point at which
              you should have already begun adapting. It is NOT a role-expiry date.
              Framed as "action window opens in" to prevent the misleading "X months left" reading. */}
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-prophet-gold" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                Action Window
              </span>
              <HinglishTooltip en={strings.tooltip_months_remaining} hi={locale === 'hi' ? strings.tooltip_months_remaining : undefined} locale={locale} />
            </div>
            <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
              When meaningful AI-driven role changes begin — your preparation window starts now
            </p>
            <p className="text-3xl font-black text-prophet-gold">{report.months_remaining}<span className="text-base"> mo to adapt</span></p>
            {ci && (
              <p className="text-[11px] text-muted-foreground mt-0.5 font-semibold">
                Estimated range: {ci.months_range.low}–{ci.months_range.high} months
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {(report.months_remaining || 18) <= 12
                ? 'Urgent — adaptation window is narrow. Act now.'
                : (report.months_remaining || 18) <= 24
                ? 'Moderate — you have time, but the window is shrinking'
                : 'Longer runway — use it to build strategically ahead of the curve'}
            </p>
          </div>
          {report.survivability && (
            <div className="rounded-xl border border-prophet-green/20 bg-background p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-prophet-green" />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  {getExecutiveLabel('your_protection', seniorityTier)}
                </span>
                {report.ml_enhanced && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-auto">Vector ML</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">
                How hard you are to replace — based on experience, skills & location
              </p>
              <p className="text-3xl font-black text-prophet-green">{report.survivability.score}<span className="text-base">/100</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {report.survivability.score >= 70
                  ? 'Strong — your unique skills make you hard to replace'
                  : report.survivability.score >= 50
                  ? 'Moderate — some protection, but room to strengthen'
                  : 'Low — many others can do what you do right now'}
              </p>
              {/* Use score-derived peer positioning instead of raw agent estimate */}
              {(() => {
                const posScore = computeStabilityScore(report);
                const derivedPct = Math.min(95, Math.max(5, Math.round(((posScore - 5) / 90) * 100)));
                return (
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-semibold">
                    {derivedPct > 50
                      ? `Better protected than ${derivedPct}% of peers`
                      : `More exposed than ${100 - derivedPct}% of peers`}
                  </p>
                );
              })()}
            </div>
          )}
        </div>

        {/* Risk Methodology Panel */}
        <AnimatePresence>
          {riskMethodOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mt-4"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">How Career Position Score Is Calculated</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Role Automation Risk (65% weight)', desc: 'Baseline disruption score for your job family from our Knowledge Graph, adjusted by your specific skill risk profile. Each skill is weighted by importance and matched against 200+ automation risk ratings.' },
                      { label: 'Personal Protection (35% weight)', desc: 'Inverse of your Protection Score — accounts for experience depth, strategic skill moats, geographic advantage, and adaptability to AI-augmented workflows.' },
                      { label: 'Market Pressure Adjustment', desc: 'Real-time signal from job posting trends — if AI-related mentions in your role\'s postings exceed 15%, an additional pressure factor is applied.' },
                      { label: 'Experience Reduction', desc: 'Senior professionals (8+ years) receive a risk reduction of up to 12 points, reflecting leadership and judgment-based tasks that resist automation.' },
                    ].map((f) => (
                      <div key={f.label} className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-foreground">{f.label}: </span>
                          <span className="text-xs text-muted-foreground">{f.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-primary mb-1.5">Formula</p>
                  <p className="text-xs font-mono text-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Career Position = 100 − ((Role Automation Risk × 0.65) + ((100 − Protection Score) × 0.35))
                  </p>
                </div>

                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Research Sources</h4>
                  <div className="space-y-2.5">
                    {[
                      { org: 'World Economic Forum', year: '2025', finding: '23% of jobs globally will undergo structural change within 5 years, driven primarily by AI and automation.', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/' },
                      { org: 'McKinsey Global Institute', year: '2024', finding: 'Up to 30% of hours worked could be automated by 2030, with generative AI accelerating the timeline for knowledge workers.', url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai' },
                      { org: 'OECD Employment Outlook', year: '2024', finding: '27% of jobs in OECD countries are in occupations at high risk of automation, with AI amplifying exposure for white-collar roles.', url: 'https://www.oecd.org/en/publications/oecd-employment-outlook-2024_d5c28ab5-en.html' },
                    ].map((s) => (
                      <div key={s.org} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-foreground">{s.org} <span className="font-normal text-muted-foreground">({s.year})</span></p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.finding}</p>
                          </div>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded hover:bg-muted transition-colors" title="View source">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  All scores are computed deterministically from structured data — zero LLM-generated numbers. Results are estimates based on current market conditions.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score Breakdown */}
        {report.score_breakdown && (
          <ScoreBreakdownPanel breakdown={report.score_breakdown} role={report.role} matchedCount={kgMatched} />
        )}
      </div>

      {/* ═══ INTELLIGENCE EXPRESSION LAYER ═══ */}
      {/* Sprint 1.1: Knowledge Graph Position */}
      <div className="mb-6">
        <KnowledgeGraphView report={report} />
      </div>

      {/* Sprint 1.2 & 1.3 & 1.4: Intelligence Proof Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <IndustryCalibrationCard report={report} />
        <SeniorityProtectionCard report={report} />
      </div>
      {report.score_variability && (
        <div className="mb-6">
          <ConfidenceIntervalCard report={report} />
        </div>
      )}

      {/* Primary AI Threat */}
      <AIThreatCard
        threatVector={report.primary_ai_threat_vector}
        automatableRatio={report.automatable_task_ratio}
        moatIndicators={report.moat_indicators}
        isExec={isExec}
        userName={userName}
      />

      {/* Skill-by-Skill Threat Intelligence
          Previously: only shown in free DoomClockCard.
          Now: full per-skill breakdown in Pro DiagnosisTab where power users get most value. */}
      {report.skill_threat_intel && report.skill_threat_intel.length > 0 && (
        <SkillThreatIntelSection intel={report.skill_threat_intel} isExec={isExec} />
      )}

      {/* Countdown Timer */}
      <CountdownTimer monthsRemaining={report.months_remaining} />

      {/* Peer Comparison */}
      <PeerComparison 
        careerRisk={clampedRisk} 
        role={report.role} 
        industry={report.industry}
        survivabilityScore={report.survivability?.score ?? 50}
      />

      {/* "If You Do Nothing" Scenario */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider">
            {isExec ? 'If You Don\'t Adapt' : 'If You Do Nothing'}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isExec ? (
            // CRITICAL-9 fix: for exec tier the risk is NOT gradual monthly salary erosion —
            // it's a sudden restructuring event (severance + 12-24mo re-hire gap at lower comp).
            // The salary_bleed model applies task-automation math that is wrong for exec level.
            // Reframe to: what does a restructuring event actually cost?
            clampedRisk > 65
              ? `${userName !== 'Professional' ? userName + ', your' : 'Your'} function is at meaningful risk of being restructured under an AI-augmented leadership model within ${report.months_remaining} months. The financial exposure is not gradual — it is a single restructuring event: severance, plus 12–18 months of comp gap during your next search, at a salary potentially 20–30% below your current level. Competitors with AI-literate leadership will consolidate functions faster.`
              : clampedRisk > 40
              ? `Your ${report.months_remaining}-month adaptation window is real. The risk for ${seniorityTier.replace('_', ' ').toLowerCase()} leaders is not task replacement — it is being passed over for roles, board seats, and advisory positions in favour of AI-fluent peers. The financial consequence lands as a lump sum at career transition, not as monthly erosion.`
              : `Your strategic position is strong. The primary risk is opportunity cost — organisations that integrate AI at the leadership level are pulling ahead on operational efficiency. Staying visible as an AI transformation leader is your most effective hedge.`
          ) : (
            clampedRisk > 65
              ? `Within ${report.months_remaining} months, ${displayRole} roles in ${report.industry} will see ${Math.round(clampedRisk * 0.6)}% of current tasks automated. Your monthly earning potential drops by ${formatCurrency(report.salary_bleed_monthly, country)}/mo. In 5 years, cumulative loss reaches ${report.total_5yr_loss_inr ? formatCurrency(report.total_5yr_loss_inr, country) : formatCurrency(report.salary_bleed_monthly * 60, country)}. Companies are already consolidating teams.`
              : clampedRisk > 40
              ? `Your role has a ${report.months_remaining}-month window before meaningful restructuring. Monthly earning erosion: ${formatCurrency(report.salary_bleed_monthly, country)}. The risk is not replacement — it's gradual irrelevance as AI-augmented peers outperform.`
              : `Your position is currently stable, but ${report.industry} is shifting. Monthly salary pressure: ${formatCurrency(report.salary_bleed_monthly, country)}. Complacency is the primary risk — peers who upskill will pull ahead.`
          )}
        </p>
        {report.obsolescence_timeline && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {[
              { label: 'Safe Zone', months: report.obsolescence_timeline.purple_zone_months, color: 'bg-primary/10 text-primary' },
              { label: 'Pressure', months: report.obsolescence_timeline.yellow_zone_months, color: 'bg-prophet-gold/10 text-prophet-gold' },
              { label: 'Critical', months: report.obsolescence_timeline.red_zone_months, color: 'bg-prophet-red/10 text-prophet-red' },
            ].map(z => (
              <span key={z.label} className={`text-[10px] font-bold px-2 py-1 rounded-full ${z.color}`}>
                {z.label}: {z.months}mo
              </span>
            ))}
          </div>
        )}
      </div>

      {/* YOUR MOAT */}
      <div className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.02] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-prophet-green" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-prophet-green uppercase tracking-[0.15em]">
                {isExec ? 'Your Strategic Moat' : 'Your Unfair Advantage'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isExec ? 'What makes you irreplaceable at the leadership level' : 'What AI cannot replicate about you'}
              </p>
            </div>
            <FeedbackButtons scanId={scanId} cardName="moat_analysis" />
          </div>
        </div>

        {/* Irreplaceable Edge Card — cognitive_moat + moat_narrative
            Previously: one grey h3 text line. Now: a proper green bordered card
            that Pro users can actually read and act on. */}
        <div className="rounded-2xl border-2 border-prophet-green/20 bg-prophet-green/[0.04] p-5 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green mb-2">
            🛡️ Your irreplaceable edge
          </p>
          <h3 className="text-base font-black text-foreground leading-snug mb-2">
            {report.cognitive_moat}
          </h3>
          {report.moat_narrative ? (
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">{report.moat_narrative}</p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {report.survivability && report.survivability.score >= 60
                ? `Your work in ${moatSkills[0]?.toLowerCase() || 'strategic domains'} requires contextual judgment, ambiguity navigation, and stakeholder empathy that AI cannot replicate. Double down on this.`
                : `You have emerging strengths in ${moatSkills[0]?.toLowerCase() || 'certain areas'} — not deep enough yet. The next ${report.months_remaining} months are critical.`
              }
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {moatSkills.map((skill, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-prophet-green/10 text-prophet-green border border-prophet-green/20">
                <CheckCircle className="w-3 h-3" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Urgency + Personalised Actions — Pro users also deserve to see these.
          free_advice_1/2/3 are generated for every user but previously only shown
          in the !isProUser free dossier. Pro users going straight to the dashboard
          never saw them. Showing here below the moat card. */}
      {(report.urgency_horizon || report.free_advice_1) && (
        <div className="rounded-2xl border-2 border-primary/15 bg-primary/[0.03] p-5 space-y-3 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
            🎯 Your personalised actions
          </p>
          {report.urgency_horizon && (
            <div className="flex items-start gap-2.5 pb-3 border-b border-border/50">
              <span className="text-base flex-shrink-0 mt-0.5">⏱️</span>
              <p className="text-sm font-bold text-foreground leading-snug">{report.urgency_horizon}</p>
            </div>
          )}
          {report.free_advice_1 && (
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <p className="text-xs text-foreground/85 leading-relaxed">{report.free_advice_1}</p>
            </div>
          )}
          {report.free_advice_2 && (
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <p className="text-xs text-foreground/85 leading-relaxed">{report.free_advice_2}</p>
            </div>
          )}
          {report.free_advice_3 && (
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <p className="text-xs text-foreground/85 leading-relaxed">{report.free_advice_3}</p>
            </div>
          )}
        </div>
      )}

      {/* Skill Trajectory — 3-month path from executing to directing AI
          Newly generated field: for each HIGH-risk skill, shows the concrete
          path from "I do this" → "AI does this, I own the strategy" */}
      {report.skill_trajectory && report.skill_trajectory.length > 0 && (
        <div className="rounded-2xl border-2 border-border bg-card overflow-hidden mb-4">
          <div className="px-5 pt-4 pb-3 border-b border-border/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              🗺️ Your 3-month transition path
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              How to move from executing these skills to directing AI that executes them.
            </p>
          </div>
          <div className="divide-y divide-border/40">
            {report.skill_trajectory.map((t, i) => (
              <div key={i} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                    {t.skill}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="text-xs font-black text-prophet-green">{t.pivot_title}</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex gap-3">
                    <span className="text-[10px] font-black text-muted-foreground w-16 flex-shrink-0 mt-0.5">NOW</span>
                    <p className="text-xs text-foreground/70 leading-relaxed">{t.current_state}</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-black text-primary w-16 flex-shrink-0 mt-0.5">MONTH 1</span>
                    <p className="text-xs text-foreground/85 leading-relaxed">{t.month_1}</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-black text-prophet-green w-16 flex-shrink-0 mt-0.5">MONTH 3</span>
                    <p className="text-xs font-semibold text-foreground leading-relaxed">{t.month_3}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share & Export CTA */}
      <div className="flex items-center justify-center gap-2 py-2 flex-wrap mb-6">
        <FateCardShare report={report} scanId={scanId} />
        <PDFExport report={report} compact />
        <LinkedInPostGenerator report={report} compact />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`🚨 My AI Career Risk Score: ${clampedRisk}% for ${displayRole}\n\n${report.judo_strategy ? `💡 Judo Strategy: Learn ${report.judo_strategy.recommended_tool} this weekend\n\n` : ''}Check yours → https://jobbachao.com`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors text-xs font-bold text-[#25D366]"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.149-2.868.852.852-2.868-.149-.252A8 8 0 1112 20z"/></svg>
          WhatsApp
        </a>
      </div>

      {/* CTA to Defense Plan */}
      <button
        onClick={() => setActiveScreen('defense')}
        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 border-primary/30 hover:border-primary/50 transition-colors mb-6"
        style={{ background: 'var(--gradient-oracle)' }}
      >
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-primary" />
          <div className="text-left">
            <span className="text-sm font-black text-foreground block">
              {isExec ? 'Your Strategic Playbook Is Ready →' : 'Your Defense Plan Is Ready →'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isExec ? 'AI integration roadmap, strategic pivots & competitive positioning' : 'Immediate action, 4-week plan, career pivots & skill gaps'}
            </span>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-primary" />
      </button>

      {/* Career Genome Debate CTA */}
      <button
        onClick={() => setActiveScreen('dossier')}
        className="w-full mt-6 p-4 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-r from-red-500/5 via-amber-500/5 to-emerald-500/5 hover:border-primary/70 transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 via-amber-500/20 to-emerald-500/20 border border-primary/20 flex items-center justify-center text-xl flex-shrink-0">
            🧬
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-black text-foreground flex items-center gap-2">
              Career Genome Sequencer
              <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary uppercase tracking-wider">Live AI Debate</span>
            </span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              3 competing AI agents (Prosecutor, Defender, Judge) argue about your career fate in real-time. Watch the debate unfold live.
            </span>
          </div>
          <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>
      </button>

      {/* Micro feedback */}
      <div className="mt-4 flex justify-end">
        <MicroFeedback scanId={scanId} cardId="diagnosis_tab" label="Was this diagnosis useful?" />
      </div>

      {/* Footer */}
      <FooterSection 
        enrichment={enrichment} 
        kgLastRefresh={kgLastRefresh} 
        kgMatched={kgMatched} 
        scanId={scanId}
        report={report}
      />
    </motion.div>
  );
}
