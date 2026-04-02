import { lazy, Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import MicroFeedback from '@/components/dashboard/MicroFeedback';
import HinglishTooltip from '@/components/dashboard/HinglishTooltip';
import { Eye, Flame, Zap, Database, Radio, AlertCircle } from 'lucide-react';
import { normalizeTools } from '@/lib/scan-engine';
import PanicIndexWidget from '@/components/PanicIndexWidget';
import CompanyBenchmarkWidget from '@/components/CompanyBenchmarkWidget';
import SkillDecayRadar from '@/components/dashboard/SkillDecayRadar';
import AIAugmentationWidget from '@/components/dashboard/AIAugmentationWidget';
import FooterSection from '@/components/dashboard/FooterSection';
import IntelSignalCard from '@/components/dashboard/IntelSignalCard';
import IntelWatchlist from '@/components/dashboard/IntelWatchlist';
import type { DashboardSharedProps } from '@/components/dashboard/DashboardTypes';

interface RoleIntelSignal {
  id: string;
  headline: string;
  summary: string;
  relevance_score: number;
  relevance_reason: string;
  signal_type: 'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary';
  action_prompt?: string;
  source_url?: string;
  published_at: string;
  stale?: boolean;
  fallback?: boolean;
}

const CompanyNewsWidget = lazy(() => import('@/components/dashboard/CompanyNewsWidget'));
const CareerShockSimulatorWidget = lazy(() => import('@/components/dashboard/CareerShockSimulatorWidget'));
const WeeklyBriefWidget = lazy(() => import('@/components/dashboard/WeeklyBriefWidget'));

export default function IntelTab({ props }: { props: DashboardSharedProps }) {
  const {
    report, scanId, country, userId,
    displayRole, clampedRisk,
    executionSkillsDead, moatSkills, tools,
    kgMatched, kgLastRefresh,
    enrichment, normalizedCareerShock,
    locale, strings,
  } = props;

  const [signals, setSignals] = useState<RoleIntelSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSignals();
  }, [report.role, report.industry]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await supabase.functions.invoke('role-intel', {
        body: {
          role: report.role || (report as any).detected_role,
          industry: report.industry,
          company: (report as any).company_name,
          skills: report.moat_skills || [],
          city: (report as any).city || (report as any).location,
          score: report.determinism_index,
        },
      });

      if (response.error) {
        setError('Unable to load signals');
        setLoading(false);
        return;
      }

      const data = response.data as any;
      setSignals(data.signals || []);
      setIsStale(data.isStale || false);
      setIsFallback(data.isFallback || false);
      setFetchedAt(data.fetchedAt || new Date().toISOString());

      // Load watchlist
      if (userId) {
        loadWatchlist();
      }
    } catch (err) {
      console.error('[IntelTab] Fetch error:', err);
      setError('Unable to load signals. Showing cached data.');
    } finally {
      setLoading(false);
    }
  };

  const loadWatchlist = async () => {
    try {
      const { data, error: err } = await supabase
        .from('intel_watchlist' as any)
        .select('signal_json')
      .eq('user_id', userId!);

      if (!err && data) {
        const ids = new Set((data as any[]).map((item: any) => item.signal_json?.id).filter(Boolean));
        setWatchlistIds(ids);
      }
    } catch (err) {
      console.error('[IntelTab] Watchlist load error:', err);
    }
  };

  const handleAddToWatchlist = async (signal: RoleIntelSignal) => {
    if (!userId) return;

    try {
      const { error: err } = await supabase
        .from('intel_watchlist' as any)
        .insert({
          user_id: userId,
          signal_json: signal as any,
        } as any);

      if (err) throw err;

      setWatchlistIds(new Set([...watchlistIds, signal.id]));

      // Check if limit exceeded
      const { count } = await supabase
        .from('intel_watchlist' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if ((count || 0) > 50) {
        // Toast would go here - using console for now
        console.warn('Watchlist full (50/50). Remove items to add more.');
      }
    } catch (err) {
      console.error('[IntelTab] Add to watchlist error:', err);
    }
  };

  // Group signals by relevance tier
  const highImpact = signals.filter(s => s.relevance_score >= 80);
  const watchThese = signals.filter(s => s.relevance_score >= 50 && s.relevance_score < 80);
  const opportunities = signals.filter(s => s.relevance_score >= 20 && s.relevance_score < 50);

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 py-8">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div>}>
      <motion.div
        key="intel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">{locale === 'hi' ? strings.intel_title : 'Market Intelligence'}</h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              Real-time signals for {displayRole} in {report.industry}
              <HinglishTooltip en={strings.tooltip_career_shock} hi={locale === 'hi' ? strings.tooltip_career_shock : undefined} locale={locale} />
            </p>
          </div>
        </div>

        {/* Role-Intel Signal Feed */}
        {userId && (
          <>
            {/* Watchlist */}
            <IntelWatchlist userId={userId} onWatchlistChange={loadWatchlist} />

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3 mb-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-24 rounded-xl bg-muted" />
                ))}
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="rounded-lg border border-prophet-gold/30 bg-prophet-gold/[0.05] p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-prophet-gold flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {/* Fallback indicator */}
            {isFallback && !loading && (
              <div className="rounded-lg border border-prophet-gold/30 bg-prophet-gold/[0.05] p-4 mb-6">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-prophet-gold">📊 Showing skill-based insights</span> — live signals unavailable for your role
                </p>
              </div>
            )}

            {/* Stale indicator */}
            {isStale && !loading && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 mb-6">
                <p className="text-xs text-muted-foreground">
                  Signals from {new Date(fetchedAt).toLocaleDateString()}. Refreshing...
                </p>
              </div>
            )}

            {/* Signal Feed */}
            {!loading && signals.length > 0 && (
              <div className="space-y-6">
                {/* High Impact */}
                {highImpact.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-prophet-red uppercase tracking-wider mb-3">
                      🔴 High Impact
                    </h3>
                    <div className="space-y-3">
                      {highImpact.map(signal => (
                        <IntelSignalCard
                          key={signal.id}
                          signal={signal}
                          onAddToWatchlist={handleAddToWatchlist}
                          isWatchlisted={watchlistIds.has(signal.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Watch These */}
                {watchThese.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-prophet-gold uppercase tracking-wider mb-3">
                      🟡 Watch These
                    </h3>
                    <div className="space-y-3">
                      {watchThese.map(signal => (
                        <IntelSignalCard
                          key={signal.id}
                          signal={signal}
                          onAddToWatchlist={handleAddToWatchlist}
                          isWatchlisted={watchlistIds.has(signal.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities */}
                {opportunities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-prophet-green uppercase tracking-wider mb-3">
                      🟢 Opportunities
                    </h3>
                    <div className="space-y-3">
                      {opportunities.map(signal => (
                        <IntelSignalCard
                          key={signal.id}
                          signal={signal}
                          onAddToWatchlist={handleAddToWatchlist}
                          isWatchlisted={watchlistIds.has(signal.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && signals.length === 0 && !error && (
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">No signals available at this time.</p>
              </div>
            )}
          </>
        )}

        {/* Weekly Brief */}
        <div className="mt-8">
          <WeeklyBriefWidget scanId={scanId} />
        </div>

        {/* Career Shock Simulator */}
        {normalizedCareerShock && (
          <div className="mt-6">
            <CareerShockSimulatorWidget data={normalizedCareerShock} />
          </div>
        )}

        {/* AI Disruption Analysis */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">AI Disruption Analysis</h3>
              <p className="text-[11px] text-muted-foreground">Which of your skills are most exposed?</p>
            </div>
            {kgMatched > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
                {kgMatched} skills analyzed
              </span>
            )}
          </div>

          {clampedRisk > 80 && (
            <div className="rounded-xl border border-prophet-gold/30 bg-prophet-gold/[0.05] p-4 mb-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-prophet-gold">⚠️ High risk score detected:</span> This score reflects macro-level industry trends and may not capture your unique strengths, network, or niche expertise.
              </p>
            </div>
          )}

          {enrichment.data?.threat_summary && (
            <div className="rounded-xl border border-prophet-red/20 bg-prophet-red/[0.02] p-4 mb-5">
              <p className="text-sm text-foreground leading-relaxed">{enrichment.data.threat_summary}</p>
              {enrichment.data.threat_citations?.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Sources: {enrichment.data.threat_citations.slice(0, 3).map((c: string, i: number) => (
                    <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground mr-2">[{i + 1}]</a>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* Dead End Skills */}
          <div className="rounded-2xl border border-border bg-card p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-prophet-red" />
              <p className="text-xs font-black text-prophet-red uppercase tracking-[0.15em]">
                {report.linkedin_company ? `What This Means For You at ${report.linkedin_company}` : `What This Means For ${displayRole}s in ${report.industry}`}
              </p>
              {enrichment.data && (
                <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-prophet-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" /> Live enriched
                </span>
              )}
            </div>

            <div className="space-y-4">
              {executionSkillsDead.map((skill, i) => {
                const kgTools = tools.filter(t =>
                  t.automates_task?.toLowerCase() === skill.toLowerCase() ||
                  t.automates_task?.toLowerCase().includes(skill.toLowerCase()) ||
                  skill.toLowerCase().includes(t.automates_task?.toLowerCase().split(' ')[0])
                );
                const liveTools = (enrichment.data?.tool_threats || []).filter((t: any) =>
                  t.automates?.toLowerCase().includes(skill.toLowerCase().split(' ')[0]) ||
                  skill.toLowerCase().includes(t.automates?.toLowerCase().split(' ')[0])
                );
                const kgNames = new Set(kgTools.map(t => t.tool_name.toLowerCase()));
                const uniqueLive = liveTools.filter((t: any) => !kgNames.has(t.tool_name.toLowerCase()));

                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-prophet-red/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-prophet-red font-black text-sm">✕</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{skill}</p>
                      {(kgTools.length > 0 || uniqueLive.length > 0) ? (
                        <div className="mt-1 space-y-1">
                          {kgTools.map((t, ti) => (
                            <p key={`kg-${ti}`} className="text-xs text-muted-foreground leading-relaxed">
                              <span className="font-semibold text-foreground">{t.tool_name}</span>
                              <span className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${t.adoption_stage === 'Mainstream' ? 'bg-prophet-red/10 text-prophet-red' : t.adoption_stage === 'Growing' ? 'bg-prophet-gold/10 text-prophet-gold' : 'bg-muted text-muted-foreground'}`}>{t.adoption_stage}</span>
                              <span className="ml-1 text-[11px] text-muted-foreground">KG</span>
                            </p>
                          ))}
                          {uniqueLive.map((t: any, ti: number) => (
                            <div key={`live-${ti}`}>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                <span className="font-semibold text-foreground">{t.tool_name}</span>
                                <span className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${t.adoption === 'Mainstream' ? 'bg-prophet-red/10 text-prophet-red' : t.adoption === 'Growing' ? 'bg-prophet-gold/10 text-prophet-gold' : 'bg-muted text-muted-foreground'}`}>{t.adoption}</span>
                                <span className="ml-1 text-[11px] text-prophet-green font-semibold">LIVE</span>
                              </p>
                              {t.evidence && <p className="text-[10px] text-muted-foreground mt-0.5 pl-0 italic">{t.evidence}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          AI automation is actively targeting this capability across {report.industry}.
                        </p>
                      )}
                      {report.linkedin_company && i === 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                          At {report.linkedin_company}, this likely means restructuring in your department.
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {enrichment.data?.tool_threats && enrichment.data.tool_threats.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-prophet-green animate-pulse" />
                    <p className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Live Threat Radar
                    </p>
                    <span className="text-[11px] font-semibold text-prophet-green ml-auto">Tavily-grounded · &lt;14d old</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {enrichment.data.tool_threats
                      .filter((t: any) => !executionSkillsDead.some(s =>
                        t.automates?.toLowerCase().includes(s.toLowerCase().split(' ')[0])
                      ))
                      .slice(0, 6)
                      .map((t: any, i: number) => {
                        const threatLevel = t.adoption === 'Mainstream' ? 90 : t.adoption === 'Growing' ? 55 : 25;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className="relative rounded-xl border border-border bg-background p-3 overflow-hidden group hover:border-primary/30 transition-colors"
                          >
                            <div className="absolute top-0 left-0 right-0 h-0.5">
                              <div
                                className={`h-full ${t.adoption === 'Mainstream' ? 'bg-prophet-red' : t.adoption === 'Growing' ? 'bg-prophet-gold' : 'bg-muted-foreground/40'}`}
                                style={{ width: `${threatLevel}%` }}
                              />
                            </div>
                            <div className="flex items-start gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                t.adoption === 'Mainstream' ? 'bg-prophet-red/10' : t.adoption === 'Growing' ? 'bg-prophet-gold/10' : 'bg-muted'
                              }`}>
                                <Zap className={`w-3.5 h-3.5 ${t.adoption === 'Mainstream' ? 'text-prophet-red' : t.adoption === 'Growing' ? 'text-prophet-gold' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-foreground truncate">{t.tool_name}</p>
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                                    t.adoption === 'Mainstream' ? 'bg-prophet-red/15 text-prophet-red' : t.adoption === 'Growing' ? 'bg-prophet-gold/15 text-prophet-gold' : 'bg-muted text-muted-foreground'
                                  }`}>{t.adoption}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">Targets: {t.automates}</p>
                                {t.evidence && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">{t.evidence}</p>}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {tools.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Knowledge Graph Arsenal
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {tools.length} tools tracked
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tools.map((t, i) => {
                    const threatPct = t.adoption_stage === 'Mainstream' ? 85 : t.adoption_stage === 'Growing' ? 50 : 20;
                    return (
                      <div key={i} className="relative rounded-xl border border-border bg-background p-3 overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted">
                          <div
                            className={`h-full transition-all ${t.adoption_stage === 'Mainstream' ? 'bg-prophet-red/60' : t.adoption_stage === 'Growing' ? 'bg-prophet-gold/60' : 'bg-muted-foreground/30'}`}
                            style={{ width: `${threatPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                            t.adoption_stage === 'Mainstream' ? 'bg-prophet-red/10' : t.adoption_stage === 'Growing' ? 'bg-prophet-gold/10' : 'bg-muted'
                          }`}>
                            <span className={`text-[10px] font-black ${
                              t.adoption_stage === 'Mainstream' ? 'text-prophet-red' : t.adoption_stage === 'Growing' ? 'text-prophet-gold' : 'text-muted-foreground'
                            }`}>{threatPct}%</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{t.tool_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">Targets: {t.automates_task}</p>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                            t.adoption_stage === 'Mainstream' ? 'bg-prophet-red/15 text-prophet-red' : t.adoption_stage === 'Growing' ? 'bg-prophet-gold/15 text-prophet-gold' : 'bg-muted text-muted-foreground'
                          }`}>{t.adoption_stage}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  KG: {kgMatched} skills matched · Updated with live web intelligence
                </p>
              </div>
            )}
          </div>
        </div>

        {/* [REMOVED] Company News Widget */}
        {/* [REMOVED] Live Market Widget */}
        {/* [REMOVED] Competitive Landscape Widget */}
        {/* [REMOVED] Monitoring Widget */}

        {/* Industry Pulse */}
        <div className="mt-6">
          <PanicIndexWidget industry={report.industry} role={report.role} />
        </div>

        {/* Company Risk */}
        <div className="mt-6">
          <CompanyBenchmarkWidget industry={report.industry} role={report.role} userCompany={report.linkedin_company} />
        </div>

        {/* Skill Decay Radar */}
        <div className="mt-6">
          <SkillDecayRadar allSkills={report.all_skills || [...executionSkillsDead, ...moatSkills]} role={report.role} />
        </div>

        {/* AI Augmentation Score */}
        <div className="mt-6">
          <AIAugmentationWidget allSkills={report.all_skills || [...executionSkillsDead, ...moatSkills]} role={report.role} />
        </div>

        {/* Micro feedback */}
        <div className="mt-4 flex justify-end">
          <MicroFeedback scanId={scanId} cardId="intel_tab" label="Was this intelligence useful?" />
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
    </Suspense>
  );
}
