import { motion } from 'framer-motion';
import { Compass, CheckCircle, Sparkles, ArrowRight, Briefcase, Loader2, ExternalLink } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import type { ScanReport } from '@/lib/scan-engine';
import { optimizePivotsRemote, buildAIRMMState, buildPivotOptions, type RankedPivot, type OptimizationResult } from '@/lib/airmm-optimizer';
import { type LiveEnrichment } from '@/hooks/use-live-enrichment';

interface PivotOptimizerWidgetProps {
  report: ScanReport;
  enrichment?: LiveEnrichment | null;
  enrichmentLoading?: boolean;
}

function readinessColor(p: number) {
  if (p >= 65) return 'text-prophet-green';
  if (p >= 40) return 'text-prophet-gold';
  return 'text-prophet-red';
}

function readinessBg(p: number) {
  if (p >= 65) return 'bg-prophet-green';
  if (p >= 40) return 'bg-prophet-gold';
  return 'bg-prophet-red';
}

function getGuidance(ranked: RankedPivot, report: ScanReport): string {
  const skillMatch = Math.round(ranked.pivot.skillMatch * 100);
  const months = ranked.pivot.learningMonths;

  if (skillMatch >= 80) {
    return `Your skills transfer directly. Focus on positioning — update your portfolio and target companies already adopting AI-augmented workflows.`;
  }
  if (skillMatch >= 60) {
    return `Strong overlap with your current expertise. ${months}-month upskilling sprint needed — prioritize the top skill gap and build a project portfolio.`;
  }
  if (skillMatch >= 40) {
    return `Moderate pivot — requires dedicated learning. Your strategic skills carry over, but you'll need to build technical credibility in ${months} months.`;
  }
  return `Ambitious pivot with high reward potential. Consider a bridge role first, then transition fully once you've built proof of competence.`;
}

function getWhyThisPivot(ranked: RankedPivot, report: ScanReport): string {
  const moat = report.cognitive_moat || 'strategic thinking';
  if (ranked.pivot.id === 'pivot-recommended') {
    return `Leverages your ${moat} while moving into a growing market. Highest demand trajectory.`;
  }
  if (ranked.pivot.id === 'pivot-augmented') {
    return `Lowest friction — stay in your domain but become the person who uses AI, not the person replaced by it.`;
  }
  if (ranked.pivot.id === 'pivot-upskill') {
    return `Fills your most critical skill gap. Companies pay a premium for this specific capability in ${report.industry}.`;
  }
  if (ranked.pivot.id === 'pivot-geo') {
    return `Same skills, dramatically higher compensation. Geographic arbitrage is your fastest path to income growth.`;
  }
  return `Adjacent move that reduces concentration risk while preserving your experience value.`;
}

function buildJobBoardLinks(roleName: string) {
  const encoded = encodeURIComponent(roleName);
  return [
    { label: 'LinkedIn Jobs', url: `https://www.linkedin.com/jobs/search/?keywords=${encoded}&location=India`, icon: '🔗' },
    { label: 'Naukri', url: `https://www.naukri.com/${roleName.toLowerCase().replace(/\s+/g, '-')}-jobs`, icon: '🇮🇳' },
    { label: 'Indeed', url: `https://www.indeed.co.in/jobs?q=${encoded}`, icon: '🔍' },
  ];
}

export default function PivotOptimizerWidget({ report, enrichment, enrichmentLoading }: PivotOptimizerWidgetProps) {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const state = useMemo(() => buildAIRMMState(report), [report]);
  const pivots = useMemo(() => buildPivotOptions(report), [report]);

  useEffect(() => {
    setLoading(true);
    optimizePivotsRemote(state, pivots).then(r => {
      setResult(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [state, pivots]);

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-card p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Optimizing career pivots...
      </div>
    );
  }

  if (!result?.ranked?.length) return null;

  const top3 = result.ranked.slice(0, 3);

  const getValidation = (pivotLabel: string) => {
    if (!enrichment?.pivot_validation) return null;
    return enrichment.pivot_validation.find(v =>
      v.role.toLowerCase().includes(pivotLabel.toLowerCase().split(' ')[0]) ||
      pivotLabel.toLowerCase().includes(v.role.toLowerCase().split(' ')[0])
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <Compass className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Career Pivots</h2>
        <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">AIRMM</span>
        {enrichment && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-prophet-green/10 text-prophet-green">+ LIVE</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-4 ml-6">
        Top 3 pivots ranked by skill match, market demand, and success probability
        {enrichment ? ' — validated with live job postings' : ''}
      </p>

      <div className="space-y-3">
        {top3.map((ranked, i) => {
          const readiness = Math.round(ranked.successProbability * 100);
          const skillMatch = Math.round(ranked.pivot.skillMatch * 100);
          const isBest = i === 0;
          const validation = getValidation(ranked.pivot.label);
          const jobLinks = buildJobBoardLinks(ranked.pivot.label);

          return (
            <motion.div
              key={ranked.pivot.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + i * 0.15 }}
              className={`rounded-xl border-2 p-5 ${
                isBest ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isBest ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {isBest ? (
                    <Sparkles className="w-4 h-4 text-primary" />
                  ) : (
                    <span className="text-xs font-black text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isBest && <span className="text-[11px] font-black text-primary uppercase tracking-widest">Best Match</span>}
                  <h3 className="text-base font-black text-foreground truncate">{ranked.pivot.label}</h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-black ${readinessColor(readiness)}`}>
                    {readiness}<span className="text-sm">%</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold">Readiness</p>
                </div>
              </div>

              {/* Readiness bar */}
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readiness}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 1.1 + i * 0.15 }}
                  className={`h-full rounded-full ${readinessBg(readiness)}`}
                />
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-prophet-green" />
                  {skillMatch}% skill match
                </span>
                <span>{ranked.pivot.learningMonths}mo ramp-up</span>
                {!ranked.feasible && (
                  <span className="text-prophet-red font-semibold">⚠ Constrained</span>
                )}
              </div>

              {/* Live validation from search intelligence */}
              {validation && (
                <div className="rounded-lg border border-prophet-green/20 bg-prophet-green/[0.03] p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Briefcase className="w-3 h-3 text-prophet-green" />
                    <span className="text-[11px] font-black text-prophet-green uppercase tracking-widest">Live Market Validation</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Active Postings</p>
                      <p className="font-bold text-foreground">{validation.active_postings_estimate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Salary Range</p>
                      <p className="font-bold text-foreground">{validation.salary_range_lpa}</p>
                    </div>
                  </div>
                  {Array.isArray(validation.top_companies_hiring) && validation.top_companies_hiring.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {validation.top_companies_hiring.slice(0, 4).map((c, ci) => (
                        <span key={ci} className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{String(c)}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">{validation.evidence}</p>
                </div>
              )}

              {enrichmentLoading && !validation && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Validating with live job data...
                </div>
              )}

              {/* Why this pivot */}
              <div className="rounded-lg bg-muted/50 p-3 mb-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Why This Pivot</p>
                <p className="text-xs text-foreground leading-relaxed">{getWhyThisPivot(ranked, report)}</p>
              </div>

              {/* What to do */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
                <ArrowRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{getGuidance(ranked, report)}</p>
              </div>

              {/* P1: Job board deep links */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {jobLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span>{link.icon}</span>
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">AIRMM Engine:</span>{' '}
          Pivots ranked by 60-month income trajectory. {enrichment ? 'Live-validated against current job postings.' : 'Calibrated to your Automation Risk score.'}
        </p>
        {enrichment?.pivot_citations && enrichment.pivot_citations.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Sources: {enrichment.pivot_citations.slice(0, 3).map((c, i) => (
              <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground mr-2">[{i + 1}]</a>
            ))}
          </p>
        )}
      </div>
    </motion.div>
  );
}
