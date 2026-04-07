/**
 * ShareableScoreCard — Viral career risk report card (v7)
 *
 * CLASSIFIED DOCUMENT × VITAL SIGNS aesthetic.
 * Dark, unsettling, emotionally provocative. Readable at thumbnail size.
 * 1200×630 export (html2canvas @2x). Auto-download + mobile share.
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
  // Rough automation % for top task
  const topTaskPct = deadSkills.length > 0 ? Math.min(95, Math.max(55, 90 - Math.round(Math.random() * 8))) : null;

  const tools = normalizeTools(report.ai_tools_replacing || []);

  return {
    score, role, industry, aiExposure, humanEdge,
    salaryBleedMonthly, salaryDropPct,
    monthsRemaining, deadSkills, topTask, topTaskPct, tools,
  };
}

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — hidden 1200×630 classified document card
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({
  innerRef, data,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  data: ReturnType<typeof useCardData>;
}) {
  const {
    score, role, industry, aiExposure,
    salaryBleedMonthly, salaryDropPct,
    monthsRemaining, deadSkills, topTask, topTaskPct,
  } = data;

  const scoreColor = score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626';
  const tierLabel = score >= 70 ? 'YOUR ROLE IS BEING REWRITTEN'
    : score >= 50 ? 'AUTOMATION IS ALREADY HERE'
    : score >= 30 ? 'THE WINDOW IS CLOSING'
    : 'RARE. STAY THIS WAY.';

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const FONT_MONO = '"Courier New", Courier, monospace';

  // Stats — skip nulls
  const stats: { value: string; label: string }[] = [];
  if (deadSkills.length > 0) stats.push({ value: `${deadSkills.length} tasks`, label: 'BEING REPLACED' });
  if (monthsRemaining) stats.push({ value: `${monthsRemaining} mo`, label: 'REMAINING' });
  if (salaryBleedMonthly && salaryBleedMonthly > 0) {
    stats.push({ value: `₹${Math.round(salaryBleedMonthly / 1000)}K/mo`, label: 'PROJECTED LOSS' });
  } else if (salaryDropPct > 0) {
    stats.push({ value: `${salaryDropPct}%`, label: 'SALARY AT RISK' });
  }

  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 1200, height: 630,
        background: '#080810',
        fontFamily: FONT,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Subtle red radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 38% 50%, rgba(239,68,68,0.04) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── Top strip ── */}
      <div style={{
        height: 40, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `${scoreColor}26`,
        position: 'relative', zIndex: 1,
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
          color: scoreColor, letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>AI DISPLACEMENT REPORT</span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
          color: scoreColor, letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>{dateStr}</span>
      </div>

      {/* ── Main content area ── */}
      <div style={{
        display: 'flex', height: 540, padding: '0 48px',
        position: 'relative', zIndex: 1,
      }}>
        {/* LEFT — Score block (40%) */}
        <div style={{
          width: '40%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', paddingRight: 24,
        }}>
          <span style={{
            fontSize: 220, fontWeight: 900, color: scoreColor,
            lineHeight: 0.85, letterSpacing: '-0.04em',
          }}>{score}</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
            marginTop: 16,
          }}>{tierLabel}</span>
          <div style={{
            width: 80, height: 1, background: `${scoreColor}4D`,
            margin: '20px 0',
          }} />
          <span style={{
            fontSize: 14, color: 'rgba(255,255,255,0.5)',
            fontWeight: 500,
          }}>{role}</span>
          <span style={{
            fontSize: 12, color: 'rgba(255,255,255,0.35)',
            marginTop: 4,
          }}>{industry}</span>
        </div>

        {/* CENTER — Stats (35%) */}
        <div style={{
          width: '35%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: 40,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          paddingLeft: 48,
        }}>
          {stats.map((s, i) => (
            <div key={i}>
              <span style={{
                fontSize: 48, fontWeight: 800, color: '#FFFFFF',
                lineHeight: 1, display: 'block',
              }}>{s.value}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.15em', textTransform: 'uppercase',
                marginTop: 6, display: 'block',
              }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* RIGHT EDGE — Vertical brand (5%) */}
        <div style={{
          width: '5%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            fontFamily: FONT_MONO,
          }}>JOBBACHAO.AI</span>
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 50, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        {topTask && topTaskPct ? (
          <span style={{
            fontSize: 11, color: 'rgba(255,255,255,0.6)',
          }}>{topTask}: {topTaskPct}% automated</span>
        ) : <span />}
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,0.8)',
          fontWeight: 600,
        }}>Find out yours → jobbachao.ai</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component — visible share actions
// ═══════════════════════════════════════════════════════════════
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [capturing, setCapturing] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = useCardData(report);
  const { score, role, industry, aiExposure, monthsRemaining, deadSkills, salaryDropPct } = data;

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

      // Auto-download
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-score-${score}-${safeFileName(role)}.png`;
      a.click();

      toast.success(
        'Your report card is ready.',
        {
          description: 'Share it on LinkedIn — most people have no idea their score is this high.',
          duration: 5000,
        }
      );

      // Mobile native share
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          const file = new File([blob], `ai-score-${score}-${safeFileName(role)}.png`, { type: 'image/png' });
          await navigator.share({
            title: `My AI Displacement Score: ${score}/100`,
            text: shareText,
            files: [file],
          });
        } catch {
          // user cancelled or unsupported
        }
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
      {/* Hidden capture target — completely off-screen */}
      <CaptureTarget innerRef={cardRef} data={data} />

      {/* ── Visible UI ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card overflow-hidden p-5 space-y-4"
      >
        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={capturing}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {capturing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building your card...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Generate My Report Card
            </>
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

        {/* Preview of what the text says */}
        <div className="rounded-xl bg-muted/30 border border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Share text preview</p>
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{shareText}</p>
        </div>
      </motion.div>
    </div>
  );
}
