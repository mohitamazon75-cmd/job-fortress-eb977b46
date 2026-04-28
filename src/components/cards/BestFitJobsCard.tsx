import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Briefcase, ChevronDown, ExternalLink, Loader2, RefreshCw, Shield, TrendingUp } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';

export interface RealJobListing {
  title: string;
  company: string;
  url: string;
  skill_match_pct: number;
  ai_safety_score: number;
  salary_range?: string;
  location?: string;
  why_good_fit: string;
  skills_matched: string[];
  skills_to_learn?: string[];
  fit_level: 'STRONG' | 'GOOD' | 'STRETCH';
}

export default function BestFitJobsCard({ report }: { report: ScanReport }) {
  const [jobs, setJobs] = useState<RealJobListing[]>([]);
  const [marketInsight, setMarketInsight] = useState('');
  const [totalFound, setTotalFound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<number | null>(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const role = report.role || 'Your Role';
  const industry = report.industry || 'Your Industry';

  const fetchLiveJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000); // 18s max
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Anonymous users: show a friendly message instead of a broken spinner
      if (!session?.access_token) {
        setError('auth_required');
        return;
      }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/best-fit-jobs`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          role: report.role,
          industry: report.industry,
          skills: report.all_skills || [],
          moatSkills: report.moat_skills || [],
          seniority: report.seniority_tier || 'PROFESSIONAL',
          country: (report as ScanReport & { country?: string }).country || 'IN',
          determinismIndex: report.determinism_index,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        if (resp.status === 429) throw new Error('Rate limited — please wait a moment and retry.');
        if (resp.status === 402) throw new Error('Credits exhausted.');
        throw new Error(errData.error || `Service unavailable (${resp.status})`);
      }

      const data = await resp.json();
      setJobs(data.jobs || []);
      setMarketInsight(data.market_insight || '');
      setTotalFound(data.total_found || 0);
      setHasLoaded(true);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        setError('timeout');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [report]);

  useEffect(() => {
    if (!hasLoaded && !loading) {
      fetchLiveJobs();
    }
  }, [hasLoaded, loading, fetchLiveJobs]);

  // Fit level definitions shown as tooltips
  const FIT_DEFINITIONS: Record<string, string> = {
    STRONG: '80%+ skill match — you meet most requirements right now',
    GOOD: '60–79% match — a solid application with minor gaps to address',
    STRETCH: 'Under 60% match — higher upside but requires skill development',
  };

  const fitBadge = (level: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      STRONG: { bg: 'bg-prophet-green/10', text: 'text-prophet-green', label: 'Strong Fit' },
      GOOD: { bg: 'bg-prophet-cyan/10', text: 'text-prophet-cyan', label: 'Good Fit' },
      STRETCH: { bg: 'bg-prophet-gold/10', text: 'text-prophet-gold', label: 'Stretch' },
    };
    const c = config[level] || config.GOOD;
    const definition = FIT_DEFINITIONS[level] || '';
    return (
      <span
        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded cursor-help ${c.bg} ${c.text}`}
        title={definition}
        aria-label={`${c.label}: ${definition}`}
      >
        {c.label}
      </span>
    );
  };

  // A–F Fit Grade — deterministic derivation from skill_match_pct.
  // Calibrated to align with fit_level cutoffs (STRONG ≥80, GOOD 60–79, STRETCH <60).
  const fitGrade = (pct: number): { letter: string; label: string; bg: string; text: string; ring: string } => {
    if (pct >= 85) return { letter: 'A',  label: 'Apply now',        bg: 'bg-prophet-green/15', text: 'text-prophet-green', ring: 'ring-prophet-green/40' };
    if (pct >= 75) return { letter: 'A−', label: 'Strong shot',       bg: 'bg-prophet-green/10', text: 'text-prophet-green', ring: 'ring-prophet-green/30' };
    if (pct >= 65) return { letter: 'B',  label: 'Worth applying',    bg: 'bg-prophet-cyan/15',  text: 'text-prophet-cyan',  ring: 'ring-prophet-cyan/40'  };
    if (pct >= 55) return { letter: 'B−', label: 'Decent fit',        bg: 'bg-prophet-cyan/10',  text: 'text-prophet-cyan',  ring: 'ring-prophet-cyan/30'  };
    if (pct >= 45) return { letter: 'C',  label: 'Stretch — prep first', bg: 'bg-prophet-gold/15', text: 'text-prophet-gold', ring: 'ring-prophet-gold/40' };
    return            { letter: 'D',  label: 'Long shot',         bg: 'bg-destructive/10',   text: 'text-destructive',   ring: 'ring-destructive/30'  };
  };

  const aiSafetyLabel = (score: number): { label: string; color: string } => {
    if (score >= 75) return { label: 'Low AI Risk', color: 'text-prophet-green' };
    if (score >= 50) return { label: 'Medium AI Risk', color: 'text-prophet-gold' };
    return { label: 'Higher AI Risk', color: 'text-destructive' };
  };

  const extractDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  };

  if (loading && !hasLoaded) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-5 text-center space-y-3">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Searching live job postings for {role}…</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Scanning Naukri, LinkedIn & more · usually takes 10–15 seconds
            </p>
          </div>
          <div className="flex justify-center gap-1">
            {[0,1,2,3,4].map(i => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg">
            Tip: swipe to the next card — results will appear here when ready
          </p>
        </motion.div>
      </div>
    );
  }

  if (error && !hasLoaded) {
    // Special cases
    if (error === 'auth_required') {
      return (
        <div className="rounded-xl border-2 border-border bg-muted/20 p-5 text-center space-y-3">
          <p className="text-sm font-bold text-foreground">Sign in to see your best-fit jobs</p>
          <p className="text-xs text-muted-foreground">Get personalized job recommendations based on your scan.</p>
          <a href="/auth" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
            Sign In
          </a>
        </div>
      );
    }
    if (error === 'timeout') {
      return (
        <div className="rounded-xl border-2 border-border bg-muted/30 p-5 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 text-prophet-gold mx-auto" />
          <div>
            <p className="text-sm font-semibold text-foreground">Live job search timed out</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              The job board took too long to respond. Hit retry — it usually works on the second attempt.
            </p>
          </div>
          <button onClick={fetchLiveJobs}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-3 h-3" /> Retry Search
          </button>
        </div>
      );
    }
    return (
      <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-sm text-destructive font-medium">{error}</p>
        <button onClick={fetchLiveJobs}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-xs font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-3 h-3" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-prophet-green/20 bg-prophet-green/[0.04] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              <Briefcase className="w-4 h-4 inline mr-1.5 text-prophet-green" />
              {totalFound > 0 ? `${totalFound} live openings found` : 'Real job listings'} for{' '}
              <span className="text-primary">{role}</span> · AI-ranked by your skill fit
            </p>
            {marketInsight && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{marketInsight}</p>
            )}
          </div>
          <button onClick={fetchLiveJobs} disabled={loading}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors" title="Refresh job listings">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {jobs.length === 0 && hasLoaded && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
          <p className="text-sm text-muted-foreground">No matching jobs found right now. New listings appear daily — try refreshing later.</p>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((job, i) => {
          const isExpanded = expandedJob === i;
          const domain = extractDomain(job.url);
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border-2 bg-card transition-all ${isExpanded ? 'border-primary/30 shadow-sm' : 'border-border hover:border-primary/20'}`}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedJob(isExpanded ? null : i)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const g = fitGrade(job.skill_match_pct);
                        return (
                          <span
                            className={`inline-flex flex-col items-center justify-center min-w-[34px] h-[34px] rounded-md ring-1 ${g.bg} ${g.text} ${g.ring} leading-none`}
                            title={`Fit grade ${g.letter} · ${g.label} (${job.skill_match_pct}% skill match)`}
                            aria-label={`Fit grade ${g.letter}: ${g.label}`}
                          >
                            <span className="text-[14px] font-black tracking-tight">{g.letter}</span>
                            <span className="text-[7px] font-bold uppercase opacity-70 mt-[1px]">Fit</span>
                          </span>
                        );
                      })()}
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${i === 0 ? 'bg-prophet-green/15 text-prophet-green' : 'bg-muted text-muted-foreground'}`}>
                        #{i + 1}
                      </span>
                      <h4 className="text-sm font-black text-foreground">{job.title}</h4>
                      {fitBadge(job.fit_level)}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-foreground/70">{job.company}</span>
                      {job.location && <span className="text-[10px] text-muted-foreground">📍 {job.location}</span>}
                      {domain && <span className="text-[11px] text-muted-foreground/60">via {domain}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> ~{job.skill_match_pct}% match
                      </span>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${aiSafetyLabel(job.ai_safety_score).color}`}>
                        <Shield className="w-3 h-3" /> {aiSafetyLabel(job.ai_safety_score).label}
                      </span>
                      <span className={`text-sm font-semibold flex items-center gap-1 ${job.salary_range ? 'text-primary' : 'text-xs text-muted-foreground'}`}>
                        {job.salary_range ? (
                          <>
                            ₹ {job.salary_range}
                          </>
                        ) : (
                          'Salary not listed'
                        )}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          <span className="font-bold text-foreground">Why apply: </span>{job.why_good_fit}
                        </p>
                        {(job.skills_matched?.length ?? 0) > 0 && (
                          <p className="text-[11px] text-muted-foreground mb-1">
                            Matched <span className="font-bold text-foreground">{job.skills_matched.length} of your skills</span> to this role's requirements.
                          </p>
                        )}
                        {(job.skills_matched?.length ?? 0) > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green/80 mb-1">✓ Your Matching Skills</p>
                            <div className="flex flex-wrap gap-1">
                              {job.skills_matched.map((skill, j) => (
                                <span key={j} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-prophet-green/20 bg-prophet-green/5 text-prophet-green">{skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {job.skills_to_learn && job.skills_to_learn.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-prophet-gold/80 mb-1">⚡ Skills to Pick Up</p>
                            <div className="flex flex-wrap gap-1">
                              {job.skills_to_learn.map((skill, j) => (
                                <span key={j} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-prophet-gold/20 bg-prophet-gold/5 text-prophet-gold">{skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(() => {
                          // Build a targeted search URL as fallback if the original URL is a generic listing page
                          const buildTargetedUrl = (url: string, title: string, company: string) => {
                            try {
                              const u = new URL(url);
                              const host = u.hostname;
                              // Check if URL is a specific job post
                              if (host.includes('naukri.com') && /\/job-listing|\/job\/|jobId=/.test(u.pathname + u.search)) return url;
                              if (host.includes('linkedin.com') && /\/jobs\/view\/|\/jobs\/\d+/.test(u.pathname)) return url;
                              if (host.includes('indeed') && /\/viewjob|\/rc\/clk|[?&]jk=/.test(u.pathname + u.search)) return url;
                              // Generic URL — build a targeted search instead
                              const query = `${title} ${company}`.trim();
                              if (host.includes('naukri.com')) {
                                return `https://www.naukri.com/jobs-in-india?k=${encodeURIComponent(query).replace(/%20/g, '+')}`;
                              }
                              if (host.includes('linkedin.com')) {
                                return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&f_TPR=r604800&sortBy=DD`;
                              }
                              if (host.includes('indeed')) {
                                return `https://www.indeed.co.in/jobs?q=${encodeURIComponent(query)}`;
                              }
                            } catch { /* fall through */ }
                            return url;
                          };
                          const targetUrl = buildTargetedUrl(job.url, job.title, job.company);
                          const isDirectLink = targetUrl === job.url;
                          return (
                            <a href={targetUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-colors">
                              {isDirectLink ? 'Apply Now' : 'Search This Role'} <ExternalLink className="w-3 h-3" />
                            </a>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Job listings sourced from real boards · Match scores are AI estimates · Verify before applying
      </p>
    </div>
  );
}
