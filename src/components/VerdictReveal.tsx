import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ScanReport } from '@/lib/scan-engine';
import { ArrowRight, Shield, BarChart3, Sparkles, Users, TrendingDown, BrainCircuit, Gem, Banknote, Star, AlertTriangle, Clock } from 'lucide-react';
import { inferSeniorityTier, isExecutiveTier } from '@/lib/seniority-utils';
import { computeStabilityScore, computeScoreBreakdown } from '@/lib/stability-score';
import { getVerbatimRole } from '@/lib/role-guard';

interface VerdictRevealProps {
  report: ScanReport;
  onComplete: () => void;
}

function getPlainEnglishVerdict(score: number, report: ScanReport, isExec: boolean) {
  const roleName = getVerbatimRole(report);
  const displayRole = (!roleName || roleName === 'Unknown') ? `${report.industry || 'IT'} Professional` : roleName;
  const firstName = report.linkedin_name?.split(' ')[0] || '';

  if (score >= 70) return {
    headline: `You're in the safe zone.`,
    body: `${score}% probability — no immediate threat to your job from AI. Your ${displayRole} role has strong human-only components that are hard to automate.`,
    hope: `Your unique skills put you ahead of most professionals. Now's the time to turn this advantage into a package upgrade.`,
    papa: `${firstName ? firstName + ', ' : ''}tumhara job safe hai. AI se filhaal koi khatra nahi. Tumhare paas aise skills hain jo machine nahi kar sakti — like ${report.moat_skills?.[0] || 'strategic thinking'}. Bas aise hi strong rehna.`,
    color: 'text-prophet-green',
    glow: 'hsl(var(--prophet-green))',
    label: 'SAFE ZONE',
    labelClass: 'bg-prophet-green/20 text-prophet-green',
  };
  if (score >= 55) return {
    headline: `You're in a decent spot, but stay sharp.`,
    body: `${score}% career position score — your ${displayRole} position is defensible today, but parts of your work are starting to overlap with AI. Now is the time to strengthen your edge.`,
    hope: `You're better positioned than most. A few targeted skill upgrades could push your score above 70 — and unlock a ₹2-4L package premium.`,
    papa: `${firstName ? firstName + ', ' : ''}abhi job theek hai but dhyan rakhna padega. AI kuch kaam kar sakti hai jo tum karte ho. Lekin agar agle 3-6 months mein naye tools seekh lo, toh bahut aage nikal jaoge.`,
    color: 'text-primary',
    glow: 'hsl(var(--primary))',
    label: 'MODERATE RISK',
    labelClass: 'bg-primary/20 text-primary',
  };
  if (score >= 40) return {
    headline: `Your job has real exposure — but you have a clear path forward.`,
    body: `Only ${score}% safety score — a significant chunk of ${displayRole} tasks can already be done by AI tools. The good news? Knowing this now puts you ahead of most people.`,
    hope: `90% of people in your position don't even know this yet. Your awareness is your biggest edge — and the action plan below is built specifically for your profile.`,
    papa: `${firstName ? firstName + ', ' : ''}kuch kaam hai jo AI already kar sakti hai, toh prepare rehna chahiye. But tension mat lo — tumhe pata chal gaya yeh baat, baaki logon ko abhi pata bhi nahi. Neeche action plan hai — follow karo.`,
    color: 'text-prophet-gold',
    glow: 'hsl(var(--prophet-gold))',
    label: 'HIGH EXPOSURE',
    labelClass: 'bg-prophet-gold/20 text-prophet-gold',
  };
  return {
    headline: `Your role is exposed — but this is your head start.`,
    body: `${score}% safety score — most of what a ${displayRole} does daily already has AI alternatives. But knowing this puts you ahead of 90% of people who'll find out too late.`,
    hope: `Most people won't know until it's too late. You found out today — and your personalized defense plan is ready below. Awareness + action is the formula.`,
    papa: `${firstName ? firstName + ', ' : ''}seedhi baat — AI bahut kuch kar sakti hai jo tum abhi karte ho. But yeh bura news nahi hai, yeh early warning hai. Jo log aaj prepare hote hain, unka career sabse strong hota hai. Neeche poora plan ready hai.`,
    color: 'text-prophet-red',
    glow: 'hsl(var(--prophet-red))',
    label: 'TAKE ACTION',
    labelClass: 'bg-prophet-red/20 text-prophet-red',
  };
}

// Waterfall bar component for score decomposition
function WaterfallBar({ label, value, maxAbs, color, delay }: { label: string; value: number; maxAbs: number; color: string; delay: number }) {
  const absWidth = maxAbs > 0 ? Math.abs(value) / maxAbs * 100 : 0;
  const isPositive = value >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-3"
    >
      <span className="text-[10px] font-bold text-background/60 w-28 text-right shrink-0 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-5 relative flex items-center">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, absWidth)}%` }}
          transition={{ delay: delay + 0.1, duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-sm ${color}`}
        />
        <span className={`ml-2 text-xs font-black tabular-nums ${isPositive ? 'text-prophet-green' : 'text-destructive'}`}>
          {isPositive ? '+' : ''}{value.toFixed(0)}
        </span>
      </div>
    </motion.div>
  );
}


// Peer percentile visualization
function PeerPercentileBar({ percentileText, score, role, industry }: { percentileText: string; score: number; role: string; industry: string }) {
  // Extract percentile number from text like "Top 34th percentile..."
  const match = percentileText.match(/(\d+)/);
  const percentile = match ? parseInt(match[1]) : 50;
  // Clamp position (lower percentile = better position on the left)
  const position = Math.min(95, Math.max(5, percentile));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-background/50" />
          <span className="text-[11px] font-bold text-background/70">
            Among {role} in {industry || 'your industry'}
          </span>
        </div>
      </div>
      {/* Distribution bar */}
      <div className="relative h-6 rounded-full bg-gradient-to-r from-prophet-green/20 via-prophet-gold/20 to-destructive/20 overflow-visible">
        {/* Labels */}
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-prophet-green/70">Safer</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-destructive/70">At Risk</span>
        {/* User marker */}
        <motion.div
          initial={{ left: '50%', opacity: 0 }}
          animate={{ left: `${position}%`, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8, type: 'spring' }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
        >
          <div className="w-5 h-5 rounded-full bg-primary border-2 border-background shadow-lg flex items-center justify-center">
            <span className="text-[7px] font-black text-primary-foreground">You</span>
          </div>
        </motion.div>
      </div>
      <p className="text-[10px] text-background/60 font-semibold text-center">
        {percentileText}
      </p>
    </div>
  );
}

export default function VerdictReveal({ report, onComplete }: VerdictRevealProps) {
  const [phase, setPhase] = useState<'dark' | 'methodology' | 'counting' | 'verdict' | 'done'>('dark');
  const [displayScore, setDisplayScore] = useState(0);

  const seniorityTier = inferSeniorityTier(report.seniority_tier);
  const isExec = isExecutiveTier(seniorityTier);
  const careerPositionScore = computeStabilityScore(report);
  const breakdown = computeScoreBreakdown(report);
  const verdict = getPlainEnglishVerdict(careerPositionScore, report, isExec);

  const skillAdjustments = report.score_breakdown?.skill_adjustments || [];
  const totalSkillsAnalyzed = skillAdjustments.length;
  const tools = (report.ai_tools_replacing || []);
  const toolCount = Array.isArray(tools) ? tools.length : 0;

  // Phase transitions: dark → methodology → counting → verdict
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('methodology'), 600);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 'methodology') return;
    const t2 = setTimeout(() => setPhase('counting'), 2500);
    return () => clearTimeout(t2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'counting') return;
    let frame = 0;
    const totalFrames = 70;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      setDisplayScore(Math.round(easeOut(progress) * careerPositionScore));
      if (frame >= totalFrames) {
        clearInterval(interval);
        setTimeout(() => setPhase('verdict'), 500);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [phase, careerPositionScore]);

  const userName = report.linkedin_name || 'Professional';

  // Prepare waterfall data
  const waterfallItems = [
    { label: 'AI Resistance', value: breakdown.aiResistance, color: breakdown.aiResistance >= 0 ? 'bg-prophet-green/70' : 'bg-destructive/70' },
    { label: 'Market Position', value: breakdown.marketPosition, color: breakdown.marketPosition >= 0 ? 'bg-prophet-green/70' : 'bg-destructive/70' },
    { label: 'Human Edge', value: breakdown.humanEdge, color: breakdown.humanEdge >= 0 ? 'bg-prophet-green/70' : 'bg-destructive/70' },
    { label: 'Income Stability', value: breakdown.incomeStability, color: breakdown.incomeStability >= 0 ? 'bg-prophet-green/70' : 'bg-destructive/70' },
    { label: 'Seniority Shield', value: breakdown.seniorityShield, color: 'bg-primary/70' },
  ];
  const maxAbs = Math.max(...waterfallItems.map(w => Math.abs(w.value)), 1);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: 'hsl(0 0% 4% / 0.97)' }}
        >
          {phase !== 'dark' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.12, scale: 1 }}
              className="absolute w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
              style={{ background: verdict.glow }}
            />
          )}

          <div className="text-center relative z-10 max-w-xl w-full">
            {/* Methodology disclosure — shown during pre-count phase */}
            <AnimatePresence>
              {phase === 'methodology' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-4"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-background/20 bg-background/10">
                    <BarChart3 className="w-3.5 h-3.5 text-background/70" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-background/70">
                      Computing Your Score
                    </span>
                  </div>
                  <p className="text-background/90 text-sm font-semibold">
                    Analyzing 5 weighted factors:
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-w-xs mx-auto text-left">
                    {[
                      { Icon: TrendingDown, iconColor: 'text-prophet-green', bgColor: 'bg-prophet-green/15', name: 'AI Resistance', weight: '30%', desc: 'How automatable your tasks are' },
                      { Icon: BarChart3, iconColor: 'text-primary', bgColor: 'bg-primary/15', name: 'Market Position', weight: '25%', desc: 'Demand for your skill set' },
                      { Icon: Gem, iconColor: 'text-prophet-gold', bgColor: 'bg-prophet-gold/15', name: 'Human Edge', weight: '20%', desc: 'Skills AI can\'t replicate' },
                      { Icon: Banknote, iconColor: 'text-prophet-green', bgColor: 'bg-prophet-green/15', name: 'Income Stability', weight: '15%', desc: 'Salary resilience under disruption' },
                      { Icon: Star, iconColor: 'text-primary', bgColor: 'bg-primary/15', name: 'Seniority Shield', weight: '10%', desc: 'Career-stage protection factor' },
                    ].map((factor, i) => (
                      <motion.div
                        key={factor.name}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-background/10 bg-background/5"
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${factor.bgColor}`}>
                          <factor.Icon className={`w-3.5 h-3.5 ${factor.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-background/80">{factor.name}</span>
                            <span className="text-[10px] font-black text-background/50">{factor.weight}</span>
                          </div>
                          <span className="text-[10px] text-background/50">{factor.desc}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <BarChart3 className="w-3 h-3 text-background/40" />
                    <span className="text-[10px] text-background/40 font-semibold">Deterministic — same input, same output. Zero AI-generated numbers.</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pre-label */}
            <AnimatePresence>
              {(phase === 'counting' || phase === 'verdict') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-background/20 bg-background/10">
                    <Shield className="w-3.5 h-3.5 text-background/70" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-background/70">
                      Career Position Score
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The big number */}
            <AnimatePresence>
              {(phase === 'counting' || phase === 'verdict') && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                >
                  <div className="flex items-baseline justify-center gap-1 flex-wrap">
                    <p className={`text-[90px] sm:text-[130px] md:text-[180px] font-black leading-none ${verdict.color} tabular-nums`}>
                      {displayScore}
                    </p>
                    {report.score_variability && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm text-muted-foreground font-medium self-start mt-2 group relative cursor-help"
                      >
                        ± {Math.max(2, Math.round((report.score_variability.di_range.high - report.score_variability.di_range.low) / 4))}
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-[10px] rounded whitespace-nowrap pointer-events-none z-50">
                          Score variability. Tighter with LinkedIn data.
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <p className={`text-[30px] sm:text-[44px] md:text-[60px] text-center ${verdict.color}`}>/100</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sub-label */}
            <AnimatePresence>
              {(phase === 'counting' || phase === 'verdict') && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ delay: 0.3 }}
                  className="text-background/80 text-sm font-bold uppercase tracking-[0.15em] mt-1"
                >
                  how safe is your job from AI
                </motion.p>
              )}
            </AnimatePresence>

            {/* Verdict details + Waterfall decomposition */}
            <AnimatePresence>
              {phase === 'verdict' && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6 }}
                  className="mt-8 space-y-5"
                >
                  {/* Name greeting */}
                  {userName !== 'Professional' && (
                    <p className="text-background/90 text-base font-medium">{userName.split(' ')[0]},</p>
                  )}

                  {/* Headline — plain English */}
                  <p className={`text-2xl sm:text-3xl font-black leading-tight ${verdict.color}`}>
                    {verdict.headline}
                  </p>

                  {/* Body — plain English explanation */}
                  <p className="text-background/95 text-base sm:text-lg leading-relaxed max-w-md mx-auto font-medium">
                    {verdict.body}
                  </p>

                  {/* ═══ HOPE SIGNAL — Sprint 3.2 ═══ */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="rounded-xl border border-prophet-green/20 bg-prophet-green/[0.06] backdrop-blur-sm px-4 py-3 max-w-md mx-auto"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-prophet-green flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-prophet-green/90 leading-relaxed font-medium text-left">
                        {verdict.hope}
                      </p>
                    </div>
                  </motion.div>

                  {/* ═══ WATERFALL SCORE DECOMPOSITION ═══ */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl border border-background/10 bg-background/5 backdrop-blur-sm p-4 max-w-md mx-auto"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-background/50 mb-3 text-left">
                      Why This Score
                    </p>
                    <div className="space-y-2">
                      {waterfallItems.map((item, i) => (
                        <WaterfallBar
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          maxAbs={maxAbs}
                          color={item.color}
                          delay={0.35 + i * 0.08}
                        />
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-background/10 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-background/50">Final Score</span>
                      <span className={`text-lg font-black tabular-nums ${verdict.color}`}>{careerPositionScore}/100</span>
                    </div>
                  </motion.div>

                  {report.survivability?.peer_percentile_estimate && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="rounded-xl border border-background/10 bg-background/5 backdrop-blur-sm p-4 max-w-md mx-auto"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-background/50 mb-3 text-left">
                        Where You Stand
                      </p>
                      <PeerPercentileBar
                        percentileText={report.survivability.peer_percentile_estimate}
                        score={careerPositionScore}
                        role={report.role || 'professionals'}
                        industry={report.industry || ''}
                      />
                    </motion.div>
                  )}

                  {/* ═══ "IN PLAIN ENGLISH" — Fix 3 ═══ */}
                  <div className="mt-4 rounded-xl border border-border bg-card/50 p-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">In Plain English</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {(() => {
                        const scoreLabel = (report.determinism_index ?? 0) >= 70
                          ? 'safe territory'
                          : (report.determinism_index ?? 0) >= 55
                          ? 'moderate territory'
                          : 'exposed territory';
                        const role = report.role || 'your role';
                        const topMoat = report.moat_skills?.[0] || null;
                        const topRisk = report.execution_skills_dead?.[0] || null;
                        return (
                          <>
                            Your Career Position Score of <strong>{report.determinism_index}</strong> means {role} sits in <strong>{scoreLabel}</strong> right now.
                            {topMoat && <> Your strongest protection is <strong>{topMoat}</strong>.</>}
                            {topRisk && <> Your biggest vulnerability is <strong>{topRisk}</strong>.</>}
                            {' '}The good news: this report gives you a clear path to improve.
                          </>
                        );
                      })()}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => {
                          const score = report.determinism_index ?? 0;
                          const text = `Just checked my AI career risk score on JobBachao — I scored ${score}/100. Find out yours: https://jobbachao.com`;
                          const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                          window.open(waUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/15 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Share on WhatsApp
                      </button>
                      <button
                        onClick={() => {
                          const score = report.determinism_index ?? 0;
                          const text = `Just checked my AI career risk score on JobBachao — I scored ${score}/100. Find out yours: https://jobbachao.com`;
                          navigator.clipboard.writeText(text).catch(() => {});
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:text-foreground hover:border-foreground/20 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* ═══ DISPLACEMENT TIMELINE CALLOUT ═══ */}
                  {(() => {
                    const timeline = (report as any).threat_timeline;
                    const significantYear = timeline?.significant_displacement_year;
                    const atRiskTask = timeline?.at_risk_task;
                    const primaryThreat = timeline?.primary_threat_tool;
                    if (!significantYear) return null;
                    const currentYear = new Date().getFullYear();
                    const yearsUntil = significantYear - currentYear;
                    const isUrgent = yearsUntil <= 2;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className={`rounded-xl border p-4 max-w-md mx-auto text-left ${isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-prophet-gold/25 bg-prophet-gold/5'}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${isUrgent ? 'bg-destructive/15' : 'bg-prophet-gold/15'}`}>
                            {isUrgent
                              ? <AlertTriangle className="w-4 h-4 text-destructive" />
                              : <Clock className="w-4 h-4 text-prophet-gold" />
                            }
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isUrgent ? 'text-destructive' : 'text-prophet-gold'}`}>
                              {isUrgent ? 'Displacement Window Active' : 'Displacement Timeline'}
                            </p>
                            <p className={`text-xs font-bold leading-snug ${isUrgent ? 'text-destructive/90' : 'text-prophet-gold/90'}`}>
                              By {significantYear} ({yearsUntil <= 0 ? 'now' : yearsUntil === 1 ? '~1 year' : `~${yearsUntil} years`}), 50%+ of your role's tasks will be automatable.
                            </p>
                            {atRiskTask && (
                              <p className="text-[11px] text-background/60 mt-1">
                                Most at-risk: <span className="font-semibold text-background/80">{atRiskTask}</span>
                                {primaryThreat && <> · Threat: <span className="font-semibold text-background/80">{primaryThreat}</span></>}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* Confidence interval + methodology note */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="inline-flex flex-col items-center gap-2 px-5 py-3 rounded-xl border border-background/10 bg-background/5 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${verdict.labelClass}`}>
                        {verdict.label}
                      </span>
                      <span className="text-[11px] font-bold text-background/70">
                        {report.score_variability ? (
                          <>Score: {careerPositionScore} ± {Math.max(2, Math.round((report.score_variability.di_range.high - report.score_variability.di_range.low) / 4))}</>
                        ) : (
                          <>Based on {totalSkillsAnalyzed > 0 ? `${totalSkillsAnalyzed} skills analyzed` : 'industry data'}</>
                        )}
                        {toolCount > 0 ? ` · ${toolCount} AI tools checked` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <BarChart3 className="w-3 h-3 text-background/40 flex-shrink-0" />
                      <p className="text-[10px] text-background/55 leading-relaxed max-w-xs">
                        Deterministic · Same input, same output · Skill risk data: O*NET + proprietary tracking
                      </p>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    onClick={() => { setPhase('done'); onComplete(); }}
                    className="mt-2 inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm sm:text-base tracking-wide hover:brightness-110 transition-all min-h-[48px]"
                  >
                    See Your Full Report <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Subtle scan lines */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="absolute w-full h-px bg-background" style={{ top: `${(i + 1) * 3.3}%` }} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
