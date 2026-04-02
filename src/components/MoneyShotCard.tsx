import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Share2, Swords, MessageCircle, IndianRupee, ChevronRight } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVerbatimRole } from '@/lib/role-guard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface MoneyShotCardProps {
  report: ScanReport;
  onContinue: () => void;
  scanId?: string;
}

// ═══════════════════════════════════════════════════════════════
// THE REPLACEMENT INVOICE
// "Here's what it costs to replace you with AI."
// One devastating comparison nobody expects.
// ═══════════════════════════════════════════════════════════════

// Slider range: 1–120 LPA (lakh per annum). Covers most Indian roles.
const SALARY_MIN_LPA = 1;
const SALARY_MAX_LPA = 120;
const SALARY_STEP = 0.5;

// Estimate monthly salary from report data or industry defaults (INR)
function estimateSalary(report: ScanReport): number {
  if (report.estimated_monthly_salary_inr && report.estimated_monthly_salary_inr > 0) {
    return report.estimated_monthly_salary_inr;
  }
  // Fallback: estimate from seniority + industry
  const base: Record<string, number> = {
    EXECUTIVE: 350000, SENIOR_LEADER: 200000, MANAGER: 120000, PROFESSIONAL: 70000, ENTRY: 35000,
  };
  return base[report.seniority_tier || 'PROFESSIONAL'] || 70000;
}

// Estimate AI tool cost to cover automatable portion (INR/month)
function estimateAICost(automationPct: number, toolCount: number): number {
  // Average AI tool subscription: ~$25/mo = ₹2100. Most roles need 2-4 tools.
  const toolsNeeded = Math.max(1, Math.min(toolCount, 4));
  const baseCostPerTool = 2100; // INR/month
  // Scale by automation coverage — more automation = more tool usage
  const utilizationFactor = 0.6 + (automationPct / 100) * 0.4;
  return Math.round(toolsNeeded * baseCostPerTool * utilizationFactor);
}

function formatINR(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${Math.round(n)}`;
}

// Animated number counter
function Counter({ target, duration = 1500, prefix = '', suffix = '', className, style }: {
  target: number; duration?: number; prefix?: string; suffix?: string; className?: string; style?: React.CSSProperties;
}) {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const steps = 40;
    const inc = target / steps;
    let cur = 0;
    const interval = setInterval(() => {
      cur += inc;
      if (cur >= target) {
        setVal(target);
        clearInterval(interval);
      } else {
        setVal(Math.round(cur));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);

  return <span className={className} style={style}>{prefix}{val.toLocaleString('en-IN')}{suffix}</span>;
}

export default function MoneyShotCard({ report, onContinue, scanId }: MoneyShotCardProps) {
  useEffect(() => {
    console.debug('[MoneyShotCard] MOUNTED');
    return () => console.debug('[MoneyShotCard] UNMOUNTED');
  }, []);

  const [phase, setPhase] = useState<'invoice' | 'multiplier' | 'ready'>('invoice');
  const [canContinue, setCanContinue] = useState(false);
  const hasAnimated = useRef(false);
  // Salary state: null = use market estimate, number = user-set LPA
  const [salaryLPA, setSalaryLPA] = useState<number | null>(null);
  const [salaryInputStr, setSalaryInputStr] = useState<string>('');

  const careerScore = computeStabilityScore(report);
  const roleName = getVerbatimRole(report);
  const displayRole = (!roleName || roleName === 'Unknown') ? `${report.industry || 'IT'} Professional` : roleName;
  const firstName = report.linkedin_name?.split(' ')[0] || '';
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const automationRisk = report.automation_risk ?? report.determinism_index ?? 50;

  // THE MATH — uses user-set LPA if available, falls back to market estimate
  const estimatedSalary = estimateSalary(report);
  const estimatedLPA = Math.round(estimatedSalary * 12 / 100000 * 2) / 2; // round to nearest 0.5
  const activeLPA = salaryLPA ?? estimatedLPA;
  const monthlySalary = Math.round(activeLPA * 100000 / 12);
  const salaryIsCustomised = salaryLPA !== null;
  const hourlyYou = Math.round(monthlySalary / 160); // 160 working hours/month
  const monthlyAICost = estimateAICost(automationRisk, tools.length);
  const hourlyAI = Math.round(monthlyAICost / 160);
  const automationPct = Math.round(automationRisk);
  // Guard: if AI cost is 0 (no matching tools found) we cannot compute a meaningful multiplier.
  // Show null so the UI can render an honest "insufficient data" state instead of a
  // division-by-zero fallback of 99x that looks dramatic but means nothing.
  const multiplier = hourlyAI > 0 ? Math.round((hourlyYou / hourlyAI) * 10) / 10 : null;
  // effectiveMultiplier (multiplier adjusted by automationPct) was computed but never rendered — removed

  // Top AI tools for display
  const topTools = tools.slice(0, 3).map(t => t.tool_name);

  // Phase timing
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    setTimeout(() => {
      const prefersMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersMotion) {
        try { navigator?.vibrate?.([100, 60, 150]); } catch {}
        try {
          confetti({ particleCount: 40, spread: 60, origin: { x: 0.5, y: 0.5 }, colors: ['#ef4444', '#000', '#666'], gravity: 1.6, scalar: 0.7, ticks: 40, disableForReducedMotion: true });
        } catch {}
      }
      setPhase('multiplier');
    }, 2200);

    setTimeout(() => setPhase('ready'), 3800);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') { setCanContinue(false); return; }
    const t = setTimeout(() => setCanContinue(true), 700);
    return () => clearTimeout(t);
  }, [phase]);

  const shareText = multiplier !== null
    ? `My boss's math:\nI cost ₹${hourlyYou}/hr\nAI costs ₹${hourlyAI}/hr for ${automationPct}% of my work\n\nI need to be ${multiplier}x better than AI to keep my job.\n\nWhat's YOUR replacement cost? → jobbachao.com`
    : `I just ran my career through an AI risk analysis. Score: ${careerScore}/100.\n\nFind out where you stand → jobbachao.com`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'My Replacement Invoice', text: shareText }); } catch {}
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Copied to clipboard!');
    }
  };

  const [challengeLoading, setChallengeLoading] = useState(false);
  const handleChallenge = async () => {
    setChallengeLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !scanId) { toast.error('Please sign in first'); return; }
      const { data, error } = await (supabase.from('challenges' as any) as any)
        .insert({ challenger_scan_id: scanId, challenger_user_id: user.id })
        .select('challenge_code')
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/share/challenge/${data.challenge_code}`;
      const msg = `I scored ${careerScore}/100 on my AI Career Safety test. Think you can beat me? 💪 ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err) {
      console.error('Challenge failed:', err);
      toast.error('Failed to create challenge');
    } finally {
      setChallengeLoading(false);
    }
  };

  const showMultiplier = phase === 'multiplier' || phase === 'ready';
  const showReady = phase === 'ready';

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-background">
      <div className="max-w-[440px] mx-auto px-4 py-10 sm:py-14">

        {/* Subtle header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">
            What your manager sees
          </p>
          <h1 className="text-[20px] sm:text-[22px] font-black text-foreground leading-tight">
            Your Replacement Invoice
          </h1>
        </motion.div>

        {/* ═══ THE INVOICE ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl overflow-hidden mb-5 border border-border bg-card"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {/* Invoice header bar */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-border bg-muted/40">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Cost Comparison
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {displayRole}
            </span>
          </div>

          {/* YOU row */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="px-5 py-5 flex items-center justify-between border-b border-dashed border-border"
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">You</div>
              <div className="text-[11px] text-muted-foreground">
                {firstName || 'Employee'} · {displayRole}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[32px] sm:text-[36px] font-black text-foreground leading-none tabular-nums" style={{ fontFeatureSettings: "'tnum'" }}>
                <Counter key={hourlyYou} target={hourlyYou} prefix="₹" suffix="/hr" />
              </div>
              <div className="flex items-center gap-1 justify-end mt-1">
                <span className="text-[11px] text-muted-foreground">{formatINR(monthlySalary)}/month</span>
                {!salaryIsCustomised && (
                  <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">· est. <ChevronRight className="w-2.5 h-2.5" /></span>
                )}
              </div>
            </div>
          </motion.div>

          {/* AI row */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="px-5 py-5 flex items-center justify-between border-b border-border"
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">AI Stack</div>
              <div className="text-[11px] text-muted-foreground">
                {topTools.length > 0 ? topTools.join(' + ') : 'GPT + Copilot + Agents'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[32px] sm:text-[36px] font-black text-destructive leading-none tabular-nums" style={{ fontFeatureSettings: "'tnum'" }}>
                <Counter key={hourlyAI} target={hourlyAI} duration={1200} prefix="₹" suffix="/hr" />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{formatINR(monthlyAICost)}/month</div>
            </div>
          </motion.div>

          {/* Coverage line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="px-5 py-3 flex items-center justify-between bg-destructive/5"
          >
            <span className="text-[11px] font-bold text-destructive/80">
              AI covers {automationPct}% of your daily work
            </span>
            <span className="text-[11px] font-black text-destructive">
              {Math.round((1 - hourlyAI / hourlyYou) * 100)}% cheaper
            </span>
          </motion.div>
        </motion.div>

        {/* ═══ SALARY PICKER — Appears after invoice, before multiplier ═══ */}
        <AnimatePresence>
          {showMultiplier && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-4 rounded-2xl border border-border bg-card p-4 space-y-3"
            >
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Your Annual CTC
                  </p>
                </div>
                {!salaryIsCustomised && (
                  <span className="text-[10px] text-muted-foreground/60 italic">using market estimate — slide to personalise</span>
                )}
                {salaryIsCustomised && (
                  <button
                    onClick={() => { setSalaryLPA(null); setSalaryInputStr(''); }}
                    className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline"
                  >
                    reset
                  </button>
                )}
              </div>

              {/* Big value display + typed input */}
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-1 bg-muted/50 rounded-xl px-4 py-2.5 border border-border min-w-[140px] justify-center">
                  <span className="text-[17px] font-black text-muted-foreground">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={salaryInputStr !== '' ? salaryInputStr : activeLPA.toFixed(1)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setSalaryInputStr(raw);
                      const v = parseFloat(raw);
                      if (!isNaN(v) && v >= SALARY_MIN_LPA && v <= SALARY_MAX_LPA) {
                        setSalaryLPA(v);
                      }
                    }}
                    onBlur={() => {
                      if (salaryLPA !== null) setSalaryInputStr(salaryLPA.toFixed(1));
                      else setSalaryInputStr('');
                    }}
                    className="w-16 bg-transparent text-center text-[22px] font-black text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder={activeLPA.toFixed(1)}
                    min={SALARY_MIN_LPA}
                    max={SALARY_MAX_LPA}
                    step={SALARY_STEP}
                  />
                  <span className="text-[13px] font-bold text-muted-foreground">L/yr</span>
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={SALARY_MIN_LPA}
                  max={SALARY_MAX_LPA}
                  step={SALARY_STEP}
                  value={activeLPA}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setSalaryLPA(v);
                    setSalaryInputStr(v.toFixed(1));
                  }}
                  className="w-full h-2.5 rounded-full cursor-pointer accent-primary"
                  style={{ background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((activeLPA - SALARY_MIN_LPA) / (SALARY_MAX_LPA - SALARY_MIN_LPA)) * 100}%, hsl(var(--muted)) ${((activeLPA - SALARY_MIN_LPA) / (SALARY_MAX_LPA - SALARY_MIN_LPA)) * 100}%, hsl(var(--muted)) 100%)` }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/50 font-medium">
                  <span>₹1L</span>
                  <span>₹120L</span>
                </div>
              </div>

              {salaryIsCustomised && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-[11px] text-primary font-semibold text-center">
                  ✓ Numbers updated for ₹{activeLPA.toFixed(1)}L CTC
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ THE MULTIPLIER — The real gut punch ═══ */}
        <AnimatePresence>
          {showMultiplier && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl p-6 mb-5 text-center border border-border bg-card"
              style={{ boxShadow: 'var(--shadow-md)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Your manager's math: you must be
              </p>

              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              >
                {/* Null-guard: only render a number when we have enough data to compute it honestly */}
                {multiplier !== null ? (
                  <span className="text-[64px] sm:text-[76px] font-black leading-none tabular-nums"
                    style={{
                      fontFeatureSettings: "'tnum'",
                      color: careerScore >= 70 ? 'hsl(var(--prophet-green))' : multiplier >= 15 ? 'hsl(var(--destructive))' : multiplier >= 8 ? 'hsl(var(--prophet-gold))' : 'hsl(var(--prophet-green))',
                    }}>
                    {multiplier}x
                  </span>
                ) : (
                  <span className="text-[40px] sm:text-[48px] font-black leading-none text-muted-foreground">
                    —
                  </span>
                )}
              </motion.div>

              <p className="text-[13px] font-bold text-muted-foreground mt-2 mb-4">
                {multiplier !== null ? 'better than AI at what you do' : 'AI cost comparison unavailable for your role'}
              </p>

              <div className={`rounded-xl p-3 border ${
                multiplier === null ? 'bg-muted/20 border-muted/30' :
                careerScore >= 70 ? 'bg-prophet-green/5 border-prophet-green/20' :
                multiplier >= 15 ? 'bg-destructive/5 border-destructive/20' :
                multiplier >= 8 ? 'bg-prophet-gold/5 border-prophet-gold/20' :
                'bg-prophet-green/5 border-prophet-green/20'
              }`}>
                <p className={`text-[12px] leading-relaxed ${
                  multiplier === null ? 'text-muted-foreground' :
                  careerScore >= 70 ? 'text-prophet-green' :
                  multiplier >= 15 ? 'text-destructive/80' :
                  multiplier >= 8 ? 'text-prophet-gold' :
                  'text-prophet-green'
                }`}>
                  {multiplier === null
                    ? `No matching AI tools were found for your specific role — this makes computing a cost comparison unreliable. Your overall score is ${careerScore}/100. The plan below focuses on the skills that matter most.`
                    : careerScore >= 70
                    ? `You're already proving it. ${100 - automationPct}% of your work has no AI equivalent — that's the gap your salary reflects. Your score: ${careerScore}/100.`
                    : multiplier >= 15
                    ? `At ${multiplier}x, this gap needs defending. Your score is ${careerScore}/100 — the plan below closes it.`
                    : multiplier >= 8
                    ? `At ${multiplier}x, you're manageable today — but every AI update narrows this. The math shifts quarter by quarter.`
                    : `At ${multiplier}x, you have solid breathing room. Keep building on your human strengths.`
                  }
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ THE QUESTION ═══ */}
        <AnimatePresence>
          {showReady && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center mb-6"
            >
              <p className="text-[14px] font-bold text-muted-foreground leading-relaxed">
                {multiplier !== null
                  ? <>{firstName ? `${firstName}, can` : 'Can'} you prove you're{' '}
                      <span className="font-black text-foreground">{multiplier}x better</span>
                      {' '}than AI?</>
                  : <>{firstName ? `${firstName}, here` : 'Here'}'s your personalised{' '}
                      <span className="font-black text-foreground">AI defence plan</span></>
                }
              </p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">
                We built a plan that makes the case for you.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ CTAs — Share at peak emotion ═══ */}
        <AnimatePresence>
          {showReady && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              {/* PRIMARY: WhatsApp share — big green button */}
              <motion.button
                onClick={handleWhatsApp}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-[14px] transition-all text-white"
                style={{ background: '#25D366', boxShadow: '0 4px 16px rgba(37, 211, 102, 0.3)' }}
              >
                <MessageCircle className="w-5 h-5" />
                Send to a Friend on WhatsApp
              </motion.button>

              {/* SECONDARY: Challenge a colleague */}
              <motion.button
                onClick={handleChallenge}
                disabled={challengeLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] border-2 border-border bg-card text-foreground transition-all hover:border-primary/30 hover:bg-primary/[0.03] disabled:opacity-50"
              >
                <Swords className="w-4 h-4" />
                {challengeLoading ? 'Creating...' : 'Challenge a Colleague'}
              </motion.button>

              {/* TERTIARY: Continue to defense plan */}
              <motion.button
                onClick={() => canContinue && onContinue()}
                disabled={!canContinue}
                whileHover={canContinue ? { scale: 1.01, y: -1 } : {}}
                whileTap={canContinue ? { scale: 0.98 } : {}}
                animate={canContinue
                  ? { boxShadow: ['0 4px 16px hsl(222 47% 11% / 0.15)', '0 8px 32px hsl(222 47% 11% / 0.3)', '0 4px 16px hsl(222 47% 11% / 0.15)'] }
                  : {}}
                transition={canContinue ? { duration: 2, repeat: Infinity } : {}}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-[14px] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground"
                style={{ background: 'var(--gradient-primary)' }}
              >
                Show Me How to Prove It
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              {/* Generic share fallback */}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copy to clipboard / Share
              </button>

              <p className="text-center text-[11px] text-muted-foreground/50 italic pt-1">
                {salaryIsCustomised
                  ? `Based on your ₹${activeLPA.toFixed(1)}L CTC · AI tool pricing · task automation analysis`
                  : 'Using market salary estimate · slide the CTC bar above to personalise'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watermark */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          className="text-center text-[10px] font-medium mt-8 uppercase tracking-[0.15em] text-muted-foreground/30"
        >
          jobbachao.com · AI Career Intelligence
        </motion.p>
      </div>
    </div>
  );
}
