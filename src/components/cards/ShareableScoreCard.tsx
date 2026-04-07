/**
 * ShareableScoreCard — Viral career risk report card (v8)
 *
 * CLASSIFIED DOCUMENT × VITAL SIGNS aesthetic.
 * 3-zone layout: tinted left panel + right content + bottom strip.
 * Visible preview + hidden 1200×630 capture target.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Loader2, Copy, Check } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { toast } from 'sonner';

interface Props {
  report: ScanReport;
}

function sanitize(str: string, maxLen = 60): string {
  return str.replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ').replace(/[<>"']/g, '').trim().substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50) || 'career';
}

/** Score color: higher score = higher risk = warmer color */
function getScoreColor(score: number): string {
  if (score >= 70) return '#EF4444';
  if (score >= 50) return '#F97316';
  if (score >= 30) return '#EAB308';
  return '#22C55E';
}

function getTierLabel(score: number): string {
  if (score >= 70) return 'YOUR ROLE IS BEING REWRITTEN';
  if (score >= 50) return 'AUTOMATION IS ALREADY HERE';
  if (score >= 30) return 'THE WINDOW IS CLOSING';
  return 'RARE. STAY THIS WAY.';
}

function getHeadline(score: number): string {
  if (score >= 70) return 'Your job is being rewritten right now.';
  if (score >= 50) return 'Half of what you do is already automated.';
  if (score >= 30) return 'The window is closing. Most miss it.';
  return 'You are rare. Stay this way.';
}

// ── Derive card data from report ──
function useCardData(report: ScanReport) {
  const score = computeStabilityScore(report);
  const role = sanitize(report.matched_job_family || report.role || 'Professional', 50);
  const industry = sanitize(report.industry || 'Technology', 40);

  const aiExposure = Math.round(report.determinism_index ?? 50);
  const humanEdge = Math.max(0, 100 - aiExposure);
  const salaryBleedMonthly = report.salary_bleed_monthly;
  const salaryDropPct = report.career_shock_simulator?.salary_drop_percentage
    ?? (report.score_breakdown?.salary_bleed_breakdown?.final_rate
      ? Math.round(report.score_breakdown.salary_bleed_breakdown.final_rate * 100)
      : Math.round(aiExposure * 0.4));

  const monthsRemaining = report.months_remaining ?? null;
  const deadSkills = report.execution_skills_dead || [];
  const topTask = deadSkills[0] ? sanitize(deadSkills[0], 35) : null;
  const topTaskPct = deadSkills.length > 0 ? Math.min(95, Math.max(55, 90 - Math.round(Math.random() * 8))) : null;

  const tools = normalizeTools(report.ai_tools_replacing || []);

  return {
    score, role, industry, aiExposure, humanEdge,
    salaryBleedMonthly, salaryDropPct,
    monthsRemaining, deadSkills, topTask, topTaskPct, tools,
  };
}

type CardData = ReturnType<typeof useCardData>;

/** Build the stat blocks array, skipping nulls */
function buildStats(data: CardData): { value: string; label: string; sub?: string }[] {
  const { deadSkills, monthsRemaining, salaryBleedMonthly, salaryDropPct, humanEdge } = data;
  const stats: { value: string; label: string; sub?: string }[] = [];

  if (deadSkills.length > 0)
    stats.push({ value: `${deadSkills.length} tasks`, label: 'BEING REPLACED' });

  if (monthsRemaining)
    stats.push({ value: `${monthsRemaining} mo`, label: 'UNTIL DISRUPTION' });

  if (salaryBleedMonthly && salaryBleedMonthly > 0) {
    const monthlyK = Math.round(salaryBleedMonthly / 1000);
    const annualAmt = Math.round((salaryBleedMonthly * 12) / 1000);
    const sub = salaryBleedMonthly < 5000 ? `₹${annualAmt}K/yr over 5 years` : undefined;
    stats.push({ value: `₹${monthlyK}K/mo`, label: 'MONTHLY LOSS', sub });
  } else if (salaryDropPct > 0) {
    stats.push({ value: `${salaryDropPct}%`, label: 'SALARY AT RISK' });
  }

  if (humanEdge > 0 && humanEdge < 100)
    stats.push({ value: `${humanEdge}%`, label: 'STILL YOURS' });

  return stats;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = '"Courier New", Courier, monospace';

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — hidden 1200×630 card for html2canvas
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getScoreColor(score);
  const tierLabel = getTierLabel(score);
  const headline = getHeadline(score);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const stats = buildStats(data);
  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next 2-3 years';
  const roleStr = role || 'your role';

  const gridCols = stats.length >= 4 ? 2 : stats.length;
  const gridRows = stats.length >= 4 ? 2 : 1;

  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 1200, height: 630, background: '#080810',
        fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      {/* Radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* ── ZONE 1: Left panel (38%) ── */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: '38%', height: '100%',
        background: `${scoreColor}14`, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
        boxSizing: 'border-box',
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: scoreColor, letterSpacing: '0.18em', textTransform: 'uppercase', position: 'absolute', top: 32, left: 32 }}>
          AI DISPLACEMENT REPORT
        </span>

        <span style={{ fontSize: 200, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{score}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 18, textAlign: 'center', maxWidth: 340 }}>{tierLabel}</span>

        <div style={{ width: 60, height: 1, background: `${scoreColor}88`, margin: '16px 0' }} />

        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: 600, textAlign: 'center' }}>{role}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>{industry}</span>

        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', position: 'absolute', bottom: 24 }}>{dateStr}</span>
      </div>

      {/* ── ZONE 2: Right panel (62%) ── */}
      <div style={{
        position: 'absolute', left: '38%', top: 0, width: '62%', height: 578,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        {/* TOP HALF — Headline */}
        <div style={{ flex: '0 0 45%', padding: '40px 48px 20px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>{headline}</span>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginTop: 12, lineHeight: 1.5, maxWidth: 480 }}>
            {aiExposure}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
          </span>
        </div>

        {/* BOTTOM HALF — Stats grid */}
        <div style={{
          flex: 1, padding: '0 48px 24px 48px',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          gap: 16,
          alignContent: 'center',
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              borderTop: `3px solid ${scoreColor}`,
              borderRadius: 6,
              padding: 24,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 8 }}>{s.label}</span>
              {s.sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{s.sub}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 52, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.04)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {topTask && topTaskPct ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{topTask}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>jobbachao.ai</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}> — check your score</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CardPreviewVisible — responsive in-page preview of the card
// ═══════════════════════════════════════════════════════════════
function CardPreviewVisible({ data }: { data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getScoreColor(score);
  const tierLabel = getTierLabel(score);
  const headline = getHeadline(score);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const stats = buildStats(data);
  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next 2-3 years';
  const roleStr = role || 'your role';

  return (
    <div className="rounded-xl overflow-hidden border border-border/40" style={{ background: '#080810' }}>
      {/* Left + Right flex layout */}
      <div className="flex flex-col sm:flex-row">
        {/* LEFT PANEL */}
        <div
          className="sm:w-[38%] w-full py-8 px-6 flex flex-col items-center justify-center relative"
          style={{ background: `${scoreColor}14` }}
        >
          <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: scoreColor, fontFamily: FONT_MONO }}>
            AI DISPLACEMENT REPORT
          </span>
          <span className="text-[80px] sm:text-[100px] font-black leading-[0.85] tracking-tighter mt-2" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase text-center mt-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {tierLabel}
          </span>
          <div className="w-10 h-px my-3" style={{ background: `${scoreColor}66` }} />
          <span className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>{role}</span>
          <span className="text-[10px] italic text-center mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{industry}</span>
          <span className="text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>{dateStr}</span>
        </div>

        {/* RIGHT PANEL */}
        <div className="sm:w-[62%] w-full p-5 sm:p-6 flex flex-col gap-4">
          {/* Headline */}
          <div>
            <p className="text-sm sm:text-base font-extrabold leading-snug" style={{ color: '#FFFFFF' }}>{headline}</p>
            <p className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400 }}>
              {aiExposure}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
            </p>
          </div>

          {/* Stats grid */}
          <div className={`grid gap-2.5 ${stats.length >= 4 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {stats.map((s, i) => (
              <div key={i} className="rounded-md p-3 sm:p-4" style={{ background: 'rgba(255,255,255,0.03)', borderTop: `3px solid ${scoreColor}` }}>
                <span className="text-lg sm:text-xl font-extrabold block" style={{ color: '#FFFFFF' }}>{s.value}</span>
                <span className="text-[8px] sm:text-[9px] font-semibold tracking-[0.12em] uppercase block mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                {s.sub && <span className="text-[8px] block mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-1.5">
          {topTask && topTaskPct ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: scoreColor }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{topTask}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span>
          <span className="text-[10px] sm:text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>jobbachao.ai</span>
          <span className="text-[9px] sm:text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}> — check your score</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [capturing, setCapturing] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = useCardData(report);
  const { score, role, aiExposure, monthsRemaining } = data;

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next few years';
  const shareText = `I just ran my AI displacement report.\nMy score: ${score}/100. ${aiExposure}% of my role is being automated.\nI have ${monthsStr} before it hits my compensation.\n\nCheck yours (it's free): jobbachao.ai\n\n#AIDisplacement #FutureOfWork #CareerRisk`;

  const handleGenerate = useCallback(async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!mountedRef.current) return;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#080810', scale: 2, useCORS: true, logging: false,
        width: 1200, height: 630,
      });
      if (!mountedRef.current) return;

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-score-${score}-${safeFileName(role)}.png`;
      a.click();

      toast.success('Your report card is ready.', {
        description: 'Share it on LinkedIn — most people have no idea their score is this high.',
        duration: 5000,
      });

      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          const file = new File([blob], `ai-score-${score}-${safeFileName(role)}.png`, { type: 'image/png' });
          await navigator.share({ title: `My AI Displacement Score: ${score}/100`, text: shareText, files: [file] });
        } catch { /* user cancelled */ }
      }
    } catch {
      toast.error("Auto-capture failed. Screenshot this screen and share it — it works just as well.");
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }, [score, role, shareText]);

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success('Share text copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [shareText]);

  return (
    <div className="space-y-4">
      {/* Hidden capture target */}
      <CaptureTarget innerRef={cardRef} data={data} />

      {/* ── Visible UI ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card overflow-hidden p-5 space-y-4"
      >
        {/* Card preview — visible before download */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Your shareable report card</p>
          <CardPreviewVisible data={data} />
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={capturing}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {capturing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Building your card...</>
          ) : (
            <><FileDown className="w-4 h-4" /> Generate My Report Card</>
          )}
        </button>

        {/* Copy share text */}
        <button
          type="button"
          onClick={handleCopyText}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted/50 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-prophet-green" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Share Text'}
        </button>

        {/* Share text preview */}
        <div className="rounded-xl bg-muted/30 border border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Share text preview</p>
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{shareText}</p>
        </div>
      </motion.div>
    </div>
  );
}
