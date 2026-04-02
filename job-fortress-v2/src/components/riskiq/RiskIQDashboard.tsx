import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, BarChart3, AlertTriangle, Shield, TrendingUp, Flame, Share2,
  Radar, RefreshCw, Clock, Check, Copy, ExternalLink, ChevronRight, Zap,
  FileText, Loader2, MessageCircle, Briefcase, Sparkles, MapPin,
  GraduationCap, ArrowUpRight, Building2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RiskIQResult, RiskIQForm, DimensionScore, ThreatItem, PivotRole, SurvivalPhase } from "./RiskIQTypes";
import { getTierColor, getTierBg, getTierHsl } from "./RiskIQTypes";
import { getCoursesForSkills, getDefaultCourses, type CourseRecommendation } from "@/lib/india-course-map";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

// ═══ Shared UI ═══
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${className}`} style={{ boxShadow: "var(--shadow-sm)" }}>{children}</div>;
}

function Label({ children, color = "text-primary" }: { children: React.ReactNode; color?: string }) {
  return <p className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${color}`}>{children}</p>;
}

function AnimBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay, ease: "easeOut" as const }} />
    </div>
  );
}

function LoadingCard({ title, subtitle, steps }: { title: string; subtitle: string; steps?: string[] }) {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const defaultSteps = [
    "Parsing your profile signals…",
    "Cross-referencing industry data…",
    "Building personalized analysis…",
  ];
  const allSteps = steps || defaultSteps;

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i <= allSteps.length) setVisibleSteps(i);
      else clearInterval(timer);
    }, 1800);
    return () => clearInterval(timer);
  }, [allSteps.length]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <Card className="py-10 px-6">
          <div className="flex items-center justify-center gap-3 mb-5">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <h3 className="text-lg font-black text-foreground">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground text-center mb-6">{subtitle}</p>
          <div className="max-w-sm mx-auto space-y-2.5">
            {allSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i < visibleSteps ? 1 : 0.25, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className="flex items-center gap-2.5 text-sm"
              >
                {i < visibleSteps - 1 ? (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                ) : i === visibleSteps - 1 ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                )}
                <span className={i < visibleSteps ? 'text-foreground' : 'text-muted-foreground'}>
                  {step}
                </span>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
      <motion.div variants={fadeUp} className="space-y-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </motion.div>
    </motion.div>
  );
}

// ═══ Tab Content ═══

function ScoreTab({ r }: { r: RiskIQResult }) {
  const tc = getTierColor(r.risk_tier);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      {/* Score hero */}
      <motion.div variants={fadeUp}>
        <Card className="text-center py-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(ellipse at 50% 30%, hsl(${getTierHsl(r.risk_tier)}) 0%, transparent 70%)` }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3 relative">AI Displacement Risk</p>
          <div className={`text-7xl sm:text-8xl font-black leading-none relative ${tc}`}>{r.risk_score}</div>
          <p className="text-sm text-muted-foreground mt-2 relative">/100 · <span className={`font-black ${tc}`}>{r.risk_tier}</span></p>
          <p className="text-xs text-muted-foreground/60 mt-3 relative">Confidence: {Math.round(r.confidence * 100)}% · {r.data_sources.length} data sources</p>
        </Card>
      </motion.div>

      {/* Key metrics */}
      <motion.div variants={stagger} className="grid grid-cols-3 gap-2.5">
        {[
          { icon: <Clock className="w-4 h-4 text-prophet-gold" />, value: `${r.viral.doomsday_days}`, sub: "days left", label: "Doomsday Clock" },
          { icon: <Shield className="w-4 h-4 text-prophet-green" />, value: r.viral.survival_rating, sub: "rating", label: "Survival Grade" },
          { icon: <Target className="w-4 h-4 text-primary" />, value: `${r.peer_comparison.percentile}%`, sub: "safer than", label: "Peer Ranking" },
        ].map(m => (
          <motion.div key={m.label} variants={fadeUp}>
            <Card className="text-center p-4">
              <div className="flex justify-center mb-2">{m.icon}</div>
              <div className="text-2xl font-black text-foreground">{m.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">{m.sub}</div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Summary */}
      {r.summary && (
        <motion.div variants={fadeUp}>
          <Card>
            <Label>Your Situation</Label>
            <p className="text-sm text-foreground/80 leading-7">{r.summary}</p>
          </Card>
        </motion.div>
      )}

      {/* Skills */}
      {r.extracted_skills?.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <Label color="text-prophet-gold">Skills Detected</Label>
            <div className="flex flex-wrap gap-1.5">
              {r.extracted_skills.slice(0, 15).map(s => (
                <span key={s} className="text-xs py-1.5 px-3 rounded-full bg-muted border border-border text-muted-foreground font-medium">{s}</span>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Timeline */}
      <motion.div variants={fadeUp}>
        <Card>
          <Label>Displacement Timeline</Label>
          {[
            { label: "Partial", value: r.timeline.partial, pct: Math.round(r.risk_score * 0.55), color: "hsl(var(--primary))" },
            { label: "Significant", value: r.timeline.significant, pct: Math.round(r.risk_score * 0.78), color: "hsl(var(--prophet-gold))" },
            { label: "Critical", value: r.timeline.critical, pct: r.risk_score, color: "hsl(var(--destructive))" },
          ].map((t, i) => (
            <div key={t.label} className="mb-4 last:mb-0">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium">{t.label} · {t.value}</span>
                <span className="text-xs font-black text-foreground">{t.pct}%</span>
              </div>
              <AnimBar pct={t.pct} color={t.color} delay={i * 0.15} />
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Strengths */}
      <motion.div variants={fadeUp}>
        <Card>
          <Label color="text-prophet-green">Your Human Advantages</Label>
          {r.strengths.map((s, i) => (
            <div key={i} className={`flex gap-3.5 ${i < r.strengths.length - 1 ? "mb-4 pb-4 border-b border-border" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-prophet-green/10 border border-prophet-green/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-prophet-green" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{s.title} <span className="text-[11px] font-normal text-muted-foreground ml-1">· {s.durability}</span></div>
                <div className="text-sm text-muted-foreground leading-relaxed mt-0.5">{s.detail}</div>
              </div>
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Live signals */}
      {r.live_signals && (
        <motion.div variants={fadeUp}>
          <Card className="bg-prophet-gold/[0.04] border-prophet-gold/15">
            <Label color="text-prophet-gold">🔴 Live Market Signals</Label>
            {r.live_signals.market_trend && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { l: "Trend", v: r.live_signals.market_trend },
                  { l: "Salary", v: r.live_signals.salary_trend },
                  { l: "AI Adoption", v: r.live_signals.ai_adoption_rate },
                ].filter(x => x.v).map(x => (
                  <div key={x.l} className="rounded-lg bg-background/60 border border-border p-2.5">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{x.l}</div>
                    <div className="text-xs font-bold text-foreground mt-1 truncate">{x.v}</div>
                  </div>
                ))}
              </div>
            )}
            {r.live_signals.recent_layoffs && (
              <p className="text-sm text-muted-foreground leading-relaxed">{r.live_signals.recent_layoffs}</p>
            )}
            {r.live_signals.citations && r.live_signals.citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-prophet-gold/10">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Sources</p>
                {r.live_signals.citations.slice(0, 3).map((c, i) => (
                  <a key={i} href={c} target="_blank" rel="noopener" className="text-xs text-primary hover:underline block truncate">{c}</a>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function DimensionsTab({ r }: { r: RiskIQResult }) {
  const risks = r.dimensions.filter(d => d.weighted_contribution >= 0).sort((a, b) => b.weighted_contribution - a.weighted_contribution);
  const shields = r.dimensions.filter(d => d.weighted_contribution < 0).sort((a, b) => a.weighted_contribution - b.weighted_contribution);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">12-Dimensional Breakdown</h3>
        <p className="text-sm text-muted-foreground mb-4">Every dimension calibrated against Oxford, McKinsey, and O*NET data.</p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label color="text-destructive">Risk Amplifiers</Label>
              {risks.map((d, i) => (
                <div key={i} className="mb-3.5">
                  <div className="flex justify-between mb-1"><span className="text-xs text-muted-foreground">{d.name}</span><span className="text-xs font-black text-destructive">+{d.weighted_contribution.toFixed(1)}</span></div>
                  <AnimBar pct={d.score} color="hsl(var(--destructive) / 0.6)" delay={i * 0.05} />
                </div>
              ))}
            </div>
            <div>
              <Label color="text-prophet-green">Protective Shields</Label>
              {shields.map((d, i) => (
                <div key={i} className="mb-3.5">
                  <div className="flex justify-between mb-1"><span className="text-xs text-muted-foreground">{d.name}</span><span className="text-xs font-black text-prophet-green">{d.weighted_contribution.toFixed(1)}</span></div>
                  <AnimBar pct={d.score} color="hsl(var(--prophet-green) / 0.6)" delay={i * 0.05} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <Label>Full Dimension Detail</Label>
          {r.dimensions.map((d, i) => (
            <div key={i} className={i < r.dimensions.length - 1 ? "pb-3.5 mb-3.5 border-b border-border" : ""}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold text-foreground">{d.name} <span className="text-xs font-normal text-muted-foreground">w: {Math.abs(d.weight).toFixed(2)}</span></span>
                <span className={`text-sm font-black ${d.weighted_contribution >= 0 ? "text-destructive" : "text-prophet-green"}`}>
                  {d.weighted_contribution >= 0 ? "+" : ""}{d.weighted_contribution.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.explanation}</p>
            </div>
          ))}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ThreatsTab({ r }: { r: RiskIQResult }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">AI Threat Vectors</h3>
        <p className="text-sm text-muted-foreground mb-4">Specific AI capabilities actively targeting your role</p>
      </motion.div>
      {r.threats.map((t, i) => (
        <motion.div key={i} variants={fadeUp}>
          <Card>
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-black text-foreground flex-1">{t.name}</span>
              <div className="flex gap-[3px] ml-3 shrink-0">
                {[...Array(10)].map((_, j) => <div key={j} className={`w-2 h-2 rounded-sm ${j < t.severity ? "bg-destructive" : "bg-muted"}`} />)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t.detail}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Severity: <strong className="text-foreground">{t.severity}/10</strong></span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/15 text-destructive">ETA: {t.eta}</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

function PlanTab({ r }: { r: RiskIQResult }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <Card className="bg-prophet-gold/[0.04] border-prophet-gold/15">
          <Label color="text-prophet-gold">🎯 Your Secret Weapon</Label>
          <p className="text-sm text-foreground/80 leading-7">{r.secret_weapon}</p>
        </Card>
      </motion.div>
      {r.survival_plan.map((phase, pi) => {
        const colors = ["text-prophet-gold", "text-primary", "text-prophet-green"];
        const bgs = ["bg-prophet-gold/10 border-prophet-gold/20", "bg-primary/10 border-primary/20", "bg-prophet-green/10 border-prophet-green/20"];
        return (
          <motion.div key={pi} variants={fadeUp}>
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-black ${bgs[pi]} ${colors[pi]}`}>{pi + 1}</div>
                <div>
                  <div className="text-sm font-black text-foreground">{phase.label}</div>
                  <div className="text-[10px] text-muted-foreground">{phase.timeframe}</div>
                </div>
              </div>
              {phase.actions.map((a, ai) => (
                <div key={ai} className={`flex gap-3 ${ai < phase.actions.length - 1 ? "mb-3.5 pb-3.5 border-b border-border" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0 mt-0.5">{ai + 1}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
              {phase.focus_skills?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-1.5">
                  {phase.focus_skills.map(s => <span key={s} className="text-[10px] font-bold py-1 px-2.5 rounded-full bg-primary/8 text-primary border border-primary/15">{s}</span>)}
                </div>
              )}
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function PivotTab({ r }: { r: RiskIQResult }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">Career Pivot Intelligence</h3>
        <p className="text-sm text-muted-foreground mb-4">Roles where your skills compound with AI — not against it</p>
      </motion.div>
      {r.pivot_roles.map((p, i) => (
        <motion.div key={i} variants={fadeUp}>
          <Card>
            <div className="flex justify-between items-start mb-3">
              <span className="text-base font-black text-foreground">{p.role}</span>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xl font-black text-prophet-green">{p.fit_score}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">fit</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{p.why}</p>
            <div className="mb-2"><AnimBar pct={p.fit_score} color="hsl(var(--prophet-green))" delay={i * 0.1} /></div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold py-1 px-2.5 rounded-full bg-prophet-green/10 border border-prophet-green/15 text-prophet-green">Salary {p.salary_shift}</span>
              <span className="text-xs font-bold py-1 px-2.5 rounded-full bg-primary/10 border border-primary/15 text-primary">Risk: {p.risk_score_of_pivot}</span>
              <span className="text-xs font-bold py-1 px-2.5 rounded-full bg-muted border border-border text-muted-foreground">{p.time_to_transition}</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ═══ Bluff Your Boss Tab (LIVE search-grounded data) ═══

function BluffBossTab({ data, loading }: { data: any; loading: boolean }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (loading || !data) {
    return <LoadingCard title="Generating Bluff Intelligence" subtitle="Scanning real-time sources for your industry" steps={[
      "Searching latest AI news for your industry…",
      "Identifying key buzzwords and tool names…",
      "Building meeting-ready scripts…",
      "Grounding insights in real sources…",
    ]} />;
  }

  const buzzwords = data.buzzwords || [];
  const terms = data.mustKnowTerms || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">Bluff Your Boss 🎯</h3>
        <p className="text-sm text-muted-foreground mb-1">Search-grounded AI intelligence for your next meeting</p>
        {data.search_grounded && (
          <p className="text-[10px] font-bold text-prophet-green uppercase tracking-widest">✓ Grounded in live web search · {new Date(data.generatedAt).toLocaleDateString()}</p>
        )}
      </motion.div>

      {/* Buzzwords with meeting scripts */}
      {buzzwords.map((bw: any, i: number) => (
        <motion.div key={i} variants={fadeUp}>
          <Card>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-foreground">{bw.aiBuzzword}</span>
                  <span className="text-xs font-bold text-prophet-gold">🔥 {bw.confidenceScore}%</span>
                </div>
                <p className="text-xs text-muted-foreground">{bw.trendSource}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{bw.plainEnglishTranslation}</p>

            {bw.realStory && (
              <div className="rounded-lg p-3 bg-primary/[0.04] border border-primary/10 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Real Story</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{bw.realStory}</p>
              </div>
            )}

            {bw.latestToolName && (
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3 h-3 text-prophet-gold shrink-0" />
                <span className="text-xs text-muted-foreground">Key Tool: <strong className="text-foreground">{bw.latestToolName}</strong></span>
              </div>
            )}

            <div className="rounded-lg p-3 bg-prophet-gold/[0.04] border border-prophet-gold/15">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-prophet-gold">Meeting Script</p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(bw.meetingScript); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copiedIdx === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-sm italic text-foreground/80 leading-relaxed">{bw.meetingScript}</p>
            </div>
          </Card>
        </motion.div>
      ))}

      {/* Must-know terms */}
      {terms.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <Label color="text-primary">Must-Know Terms</Label>
            {terms.map((t: any, i: number) => (
              <div key={i} className={`${i < terms.length - 1 ? "pb-4 mb-4 border-b border-border" : ""}`}>
                <div className="text-sm font-black text-foreground mb-1">{t.term}</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-1">{t.meaning}</p>
                <p className="text-xs text-foreground/70"><strong>Why now:</strong> {t.whyItMatters}</p>
                {t.realWorldExample && <p className="text-xs text-muted-foreground mt-1">📌 {t.realWorldExample}</p>}
                {t.toolToTry && (
                  <p className="text-xs mt-1">
                    <span className="font-bold text-prophet-gold">Try:</span> <span className="text-foreground/80">{t.toolToTry}</span>
                  </p>
                )}
              </div>
            ))}
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══ Fake It Tab (LIVE personalized data) ═══

function FakeItTab({ data, loading }: { data: any; loading: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);

  if (loading || !data) {
    return <LoadingCard title="Building Your Upgrade Plan" subtitle="Crafting a personalized repositioning strategy" steps={[
      "Mapping your current skills to AI-native equivalents…",
      "Scoring credibility of each upgrade path…",
      "Generating LinkedIn-ready headlines…",
      "Building your transformation roadmap…",
    ]} />;
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">Fake It Till You Make It 🔥</h3>
        <p className="text-sm text-muted-foreground mb-4">Your personalized AI-native profile upgrade — grounded in your actual skills</p>
      </motion.div>

      {/* Title upgrade */}
      <motion.div variants={fadeUp}>
        <Card className="bg-primary/[0.02] border-primary/15">
          <Label color="text-primary">Title Upgrade</Label>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Now</p>
              <p className="text-sm text-muted-foreground line-through">{data.currentTitle}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-prophet-green font-bold mb-1">Upgraded</p>
              <p className="text-sm font-bold text-foreground">{data.upgradedTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <motion.div className="h-full rounded-full bg-prophet-green" initial={{ width: 0 }} animate={{ width: `${data.credibilityScore}%` }} transition={{ duration: 1, ease: "easeOut" }} />
            </div>
            <span className="text-xs font-black text-prophet-green">{data.credibilityScore}% credible</span>
          </div>
        </Card>
      </motion.div>

      {/* Before/After skills */}
      <motion.div variants={fadeUp}>
        <Card>
          <Label>Skill Repositioning</Label>
          {(data.beforeAfter || []).map((ba: any, i: number) => (
            <div key={i} className={`${i < (data.beforeAfter?.length || 0) - 1 ? "pb-4 mb-4 border-b border-border" : ""}`}>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Before</p>
                  <p className="text-xs text-muted-foreground">{ba.currentSkill}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-prophet-green font-bold mb-1">After</p>
                  <p className="text-xs font-bold text-foreground">{ba.upgradedVersion}</p>
                </div>
              </div>
              <div className="rounded-lg p-2.5 bg-prophet-gold/[0.04] border border-prophet-gold/10">
                <p className="text-[10px] font-bold text-prophet-gold mb-0.5">How to back it up:</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{ba.howToBackItUp}</p>
              </div>
            </div>
          ))}
        </Card>
      </motion.div>

      {/* LinkedIn upgrade */}
      <motion.div variants={fadeUp}>
        <Card>
          <Label color="text-primary">LinkedIn Headline</Label>
          <div className="space-y-3">
            <div className="rounded-lg p-3 bg-muted/50 border border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Now (boring)</p>
              <p className="text-sm text-muted-foreground">{data.linkedinHeadlineNow}</p>
            </div>
            <div className="rounded-lg p-3 bg-prophet-green/[0.04] border border-prophet-green/15">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] uppercase tracking-widest text-prophet-green font-bold">Upgraded</p>
                <button
                  onClick={() => copyText(data.linkedinHeadlineUpgrade, "headline")}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "headline" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <p className="text-sm font-bold text-foreground">{data.linkedinHeadlineUpgrade}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Weekend project */}
      <motion.div variants={fadeUp}>
        <Card className="bg-prophet-gold/[0.04] border-prophet-gold/15">
          <Label color="text-prophet-gold">⚡ Weekend Project (≤ 4 hours)</Label>
          <p className="text-sm text-foreground/80 leading-7 mb-3">{data.weekendProject}</p>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-prophet-gold shrink-0" />
            <span className="text-xs text-muted-foreground">Tools: <strong className="text-foreground">{data.weekendProjectTools}</strong></span>
          </div>
        </Card>
      </motion.div>

      {/* Elevator pitch */}
      <motion.div variants={fadeUp}>
        <Card>
          <div className="flex justify-between items-start mb-3">
            <Label color="text-primary">Elevator Pitch</Label>
            <button
              onClick={() => copyText(data.elevatorPitch, "pitch")}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {copied === "pitch" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <p className="text-sm italic text-foreground/80 leading-7">"{data.elevatorPitch}"</p>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══ Jobs Tab (India-first, lazy-loaded) ═══

function JobsTab({ form, result }: { form: RiskIQForm; result: RiskIQResult }) {
  const [jobData, setJobData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchJobs = useCallback((forceRefresh = false) => {
    setLoading(true);
    supabase.functions.invoke("india-jobs", {
      body: {
        role: form.role,
        industry: form.industry,
        skills: result.extracted_skills?.slice(0, 8) || [],
        city: form.city,
        risk_score: result.risk_score,
        ...(forceRefresh ? { force_refresh: true } : {}),
      },
    }).then(({ data, error }) => {
      if (!error && data && !data.error) setJobData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [form, result]);

  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    fetchJobs();
  }, [fetched, fetchJobs]);

  if (loading || !jobData) {
    return <LoadingCard title="Finding Safer Roles" subtitle="Searching India's job market for your escape routes" steps={[
      "Matching your skills to safer career paths…",
      "Scanning Naukri, LinkedIn, Foundit listings…",
      "Ranking by AI-resistance + salary potential…",
    ]} />;
  }

  const upskillRoles = jobData.upskill_roles || [];
  const searchUrls = jobData.search_urls || {};
  const jobs = jobData.jobs || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-black text-foreground mb-1">🇮🇳 Safer Roles Hiring Now</h3>
            <p className="text-sm text-muted-foreground mb-1">
              Career moves where your skills transfer + AI risk drops
            </p>
            {result.risk_score > 60 && (
              <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">
                ⚠️ Your risk score is {result.risk_score}% — these transitions are time-sensitive
              </p>
            )}
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 shrink-0 mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {jobData?.cached && (
          <p className="text-[10px] text-muted-foreground mt-1">📦 Cached results · tap Refresh for latest</p>
        )}
      </motion.div>

      {/* Upskill roles — deterministic, always available */}
      {upskillRoles.map((role: any, i: number) => (
        <motion.div key={i} variants={fadeUp}>
          <Card>
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <span className="text-base font-black text-foreground">{role.role}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold py-0.5 px-2 rounded-full bg-prophet-green/10 border border-prophet-green/15 text-prophet-green">
                    {role.skill_overlap_pct}% skill overlap
                  </span>
                  {role.avg_salary_inr && (
                    <span className="text-[10px] font-bold py-0.5 px-2 rounded-full bg-primary/10 border border-primary/15 text-primary">
                      {role.avg_salary_inr}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xs font-bold text-muted-foreground">{role.transition_time}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{role.why_safer}</p>
            <a
              href={role.search_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> View open positions on Naukri
            </a>
          </Card>
        </motion.div>
      ))}

      {/* Live job listings from Tavily/Adzuna */}
      {jobs.length > 0 && (
        <>
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                🔴 Live Listings · {jobData.source === "tavily" ? "Web Search" : jobData.source === "adzuna" ? "Adzuna" : "Matched"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </motion.div>
          {jobs.slice(0, 10).map((job: any, i: number) => (
            <motion.div key={i} variants={fadeUp}>
              <Card className="hover:bg-muted/20 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-foreground flex-1">{job.title}</span>
                  {job.posted_days_ago !== undefined && job.posted_days_ago <= 7 && (
                    <span className="text-[11px] font-bold py-0.5 px-2 rounded-full bg-prophet-green/10 text-prophet-green border border-prophet-green/15 shrink-0 ml-2">New</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {job.company}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                </div>
                {(job.salary_range || job.salary_min) && (
                  <p className="text-xs font-bold text-prophet-green mb-2">
                    {job.salary_range || `₹${(job.salary_min / 100000).toFixed(1)}L - ₹${(job.salary_max / 100000).toFixed(1)}L`}
                  </p>
                )}
                {job.description_snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{job.description_snippet}</p>
                )}
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  View & Apply <ArrowUpRight className="w-3 h-3" />
                </a>
              </Card>
            </motion.div>
          ))}
        </>
      )}

      {/* Search links */}
      <motion.div variants={fadeUp}>
        <Card className="bg-primary/[0.02] border-primary/15">
          <Label color="text-primary">🔍 Search All Platforms</Label>
          <div className="space-y-2">
            {[
              { name: "Naukri", url: searchUrls.naukri, color: "text-[#4A90D9]" },
              { name: "LinkedIn Jobs", url: searchUrls.linkedin, color: "text-[#0A66C2]" },
              { name: "Foundit (Monster)", url: searchUrls.foundit, color: "text-[#6E46AE]" },
            ].filter(s => s.url).map(s => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted transition-colors`}
              >
                <span className={`text-sm font-bold ${s.color}`}>{s.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <p className="text-[10px] text-center text-muted-foreground">
          {jobData.source === "adzuna" ? "Live listings via Adzuna · " : ""}
          Roles matched deterministically from your skill profile · Updated {new Date(jobData.generated_at).toLocaleDateString()}
        </p>
      </motion.div>
    </motion.div>
  );
}

// ═══ Upskill Tab (India Course Affiliate Engine) ═══

function UpskillTab({ result }: { result: RiskIQResult }) {
  const skills = result.extracted_skills || [];
  const recommendations = skills.length > 0 ? getCoursesForSkills(skills) : getDefaultCourses();

  if (recommendations.length === 0) {
    // Fallback to defaults
    const defaults = getDefaultCourses();
    return <UpskillContent recommendations={defaults} />;
  }

  return <UpskillContent recommendations={recommendations} />;
}

function UpskillContent({ recommendations }: { recommendations: CourseRecommendation[] }) {
  const demandColors = {
    hot: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/15", label: "🔥 Hot Demand" },
    growing: { bg: "bg-prophet-gold/10", text: "text-prophet-gold", border: "border-prophet-gold/15", label: "📈 Growing" },
    stable: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "Stable" },
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">📚 Upskill for ₹ Growth</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Courses matched to your skill gaps — from India's top platforms
        </p>
        <p className="text-[10px] font-bold text-prophet-green uppercase tracking-widest">
          ✓ CTC bump estimates based on Naukri salary data
        </p>
      </motion.div>

      {recommendations.map((rec, ri) => {
        const demand = demandColors[rec.demand_signal];
        return (
          <motion.div key={rec.skill} variants={fadeUp}>
            <Card>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-sm font-black text-foreground capitalize">{rec.skill}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] font-bold py-0.5 px-2 rounded-full ${demand.bg} ${demand.text} border ${demand.border}`}>
                      {demand.label}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-lg font-black text-prophet-green">{rec.ctc_bump}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">CTC Bump</div>
                </div>
              </div>

              <div className="space-y-2">
                {rec.courses.map((course, ci) => (
                  <a
                    key={ci}
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{course.platform}</span>
                        {course.price === "Free" || course.price === "Free audit" ? (
                          <span className="text-[10px] font-bold py-0.5 px-1.5 rounded bg-prophet-green/10 text-prophet-green border border-prophet-green/15">FREE</span>
                        ) : null}
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{course.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{course.duration}</span>
                        <span className="text-[10px] text-muted-foreground">{course.price}</span>
                        {course.rating && <span className="text-[10px] text-prophet-gold">⭐ {course.rating}</span>}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </Card>
          </motion.div>
        );
      })}

      <motion.div variants={fadeUp}>
        <Card className="bg-prophet-gold/[0.04] border-prophet-gold/15 text-center py-6">
          <GraduationCap className="w-8 h-8 text-prophet-gold mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground mb-1">90-Day Career Upgrade Path</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Start with the free courses, get certified in 6-8 weeks, then update your LinkedIn headline.
            Average result: <span className="font-bold text-prophet-green">₹2-5L CTC bump</span> within 6 months.
          </p>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <p className="text-[10px] text-center text-muted-foreground">
          Courses from Coursera, Google, Simplilearn, UpGrad, Scaler · Prices may vary · CTC estimates from Naukri salary data
        </p>
      </motion.div>
    </motion.div>
  );
}


  function ShareTab({ r, form }: { r: RiskIQResult; form: RiskIQForm }) {
  const [copied, setCopied] = useState(false);
  const text = `My AI job risk score: ${r.risk_score}/100 (${r.risk_tier}) 🤖\n\n"${r.viral.share_headline}"\n\nCheck yours → https://jobbachao.com/advanced-beta`;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <h3 className="text-xl font-black text-foreground mb-1">Share Your Fate Card</h3>
        <p className="text-sm text-muted-foreground mb-4">Make your colleagues nervous. Make your network curious.</p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-primary/15">
          {/* Card preview */}
          <div className="rounded-lg p-6 mb-4 text-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground) / 0.85) 100%)` }}>
            <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at 50% 30%, hsl(${getTierHsl(r.risk_tier)}) 0%, transparent 60%)` }} />
            <p className="text-[10px] uppercase tracking-[0.3em] text-background/40 font-bold mb-2 relative">RiskIQ Advanced Beta</p>
            <div className="text-5xl font-black text-background relative mb-1">{r.risk_score}</div>
            <p className="text-xs text-background/40 relative mb-4">/100 · {r.risk_tier} Risk</p>
            <p className="text-sm italic text-background/60 leading-relaxed relative max-w-xs mx-auto">"{r.viral.share_headline}"</p>
            <p className="text-[10px] text-background/25 mt-4 relative">{form.role} · {form.city}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                copied ? "bg-prophet-green text-background" : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all bg-[#25D366]"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 rounded-lg text-sm font-bold text-background flex items-center justify-center gap-2 hover:opacity-90 transition-all bg-[#1DA1F2]"
            >
              <ExternalLink className="w-4 h-4" /> X
            </a>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <Label>Full Report Stats</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Risk Score", `${r.risk_score}/100`], ["Risk Tier", r.risk_tier],
              ["Survival Rating", r.viral.survival_rating], ["Safer Than", `${r.peer_comparison.percentile}% of peers`],
              ["Doomsday", r.viral.doomsday_date], ["Industry 2030", `${r.viral.industry_extinction_pct}% at risk`],
              ["Confidence", `${Math.round(r.confidence * 100)}%`], ["Engine", r.engine_version || "v2.4"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg p-3 bg-muted/40 border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">{l}</div>
                <div className="text-sm font-black text-foreground">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══ Dossier Tab ═══

function DossierTabContent({ dossier, loading }: { dossier: string; loading: boolean }) {
  if (loading && !dossier) {
    return <LoadingCard
      title="Generating AI Impact Dossier"
      subtitle="Our AI agents are building a deep, personalized career intelligence report"
      steps={[
        "Extracting role-specific vulnerability patterns…",
        "Mapping your skills against 94 AI threat vectors…",
        "Analyzing industry disruption timeline…",
        "Cross-referencing live market intelligence…",
        "Building personalized defense strategies…",
        "Generating your strategic dossier…",
      ]}
    />;
  }

  if (!dossier) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={fadeUp}>
          <Card className="text-center py-12">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-black text-foreground mb-2">Dossier Unavailable</h3>
            <p className="text-sm text-muted-foreground">The AI dossier couldn't be generated. Try refreshing the page.</p>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp}>
        <h3 className="text-2xl font-black text-foreground mb-1">AI Impact Dossier</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Deep strategic analysis of your career trajectory
          {loading && <span className="ml-2 text-primary animate-pulse font-semibold">● Streaming...</span>}
        </p>
      </motion.div>
      <motion.div variants={fadeUp}>
        <Card className="p-6 sm:p-8">
          <div className="dossier-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {dossier}
            </ReactMarkdown>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══ Main Dashboard ═══

const TABS = [
  { id: "score", label: "Score", icon: Target },
  { id: "dossier", label: "Dossier", icon: FileText },
  { id: "dimensions", label: "12D Matrix", icon: BarChart3 },
  { id: "threats", label: "Threats", icon: AlertTriangle },
  { id: "plan", label: "Survival", icon: Shield },
  { id: "pivot", label: "Pivots", icon: TrendingUp },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "upskill", label: "Upskill", icon: GraduationCap },
  { id: "bluff", label: "Bluff Boss", icon: Sparkles },
  { id: "fake", label: "Fake It", icon: Flame },
  { id: "share", label: "Share", icon: Share2 },
];

interface Props {
  result: RiskIQResult;
  form: RiskIQForm;
  onReset: () => void;
  dossier?: string;
  dossierLoading?: boolean;
  bluffData?: any;
  bluffLoading?: boolean;
  fakeItData?: any;
  fakeItLoading?: boolean;
}

export default function RiskIQDashboard({
  result, form, onReset,
  dossier = "", dossierLoading = false,
  bluffData = null, bluffLoading = false,
  fakeItData = null, fakeItLoading = false,
}: Props) {
  const [tab, setTab] = useState("score");
  const tc = getTierColor(result.risk_tier);
  const tb = getTierBg(result.risk_tier);

  // Count loading tabs for indicator
  const loadingTabs = new Set<string>();
  if (dossierLoading && !dossier) loadingTabs.add("dossier");
  if (bluffLoading) loadingTabs.add("bluff");
  if (fakeItLoading) loadingTabs.add("fake");

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky nav */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center shrink-0">
                <Radar className="w-3.5 h-3.5 text-prophet-gold" />
              </div>
              <span className="text-sm font-bold text-foreground truncate hidden sm:inline">{form.role}</span>
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${tb} ${tc}`}>
                {result.risk_score}/100
              </span>
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> New scan
            </button>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto scrollbar-hide -mb-px gap-0.5">
            {TABS.map(t => {
              const Icon = t.icon;
              const isLoading = loadingTabs.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 py-2.5 px-3 whitespace-nowrap text-[11px] font-bold border-b-2 transition-all ${
                    tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" /> {t.label}
                  {isLoading && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Headline bar */}
      {result.headline && (
        <div className="border-b border-primary/8 bg-primary/[0.02]">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-start gap-3">
            <div className="w-[3px] rounded-full bg-primary shrink-0 self-stretch min-h-[20px]" />
            <p className="text-sm text-foreground italic leading-relaxed">"{result.headline}"</p>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="max-w-3xl mx-auto px-5 py-6 pb-20">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {tab === "score" && <ScoreTab r={result} />}
            {tab === "dossier" && <DossierTabContent dossier={dossier} loading={dossierLoading} />}
            {tab === "dimensions" && <DimensionsTab r={result} />}
            {tab === "threats" && <ThreatsTab r={result} />}
            {tab === "plan" && <PlanTab r={result} />}
            {tab === "pivot" && <PivotTab r={result} />}
            {tab === "jobs" && <JobsTab form={form} result={result} />}
            {tab === "upskill" && <UpskillTab result={result} />}
            {tab === "bluff" && <BluffBossTab data={bluffData} loading={bluffLoading} />}
            {tab === "fake" && <FakeItTab data={fakeItData} loading={fakeItLoading} />}
            {tab === "share" && <ShareTab r={result} form={form} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
