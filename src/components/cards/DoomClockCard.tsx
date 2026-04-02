/**
 * DoomClockCard — viral hook card
 *
 * Shows the top 3 most-at-risk skills as ticking countdown clocks.
 * Designed to be screenshot-and-shared. Uses the unified skill classifier
 * so the data is consistent with AITimelineCard (which gives the full list).
 *
 * html2canvas capture target uses inline hex/rgba — no CSS custom properties —
 * so the image renders faithfully across all devices.
 */
import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, AlertTriangle, Zap, MessageCircle } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { classifySkills, type ClassifiedSkill } from '@/lib/unified-skill-classifier';
import CohortInsightBadge from '@/components/cards/CohortInsightBadge';
import { useTrack } from '@/hooks/use-track';

interface Props {
  report: ScanReport;
  scanId?: string;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function monthsLabel(m: number): { text: string; color: string; urgency: 'critical' | 'high' | 'medium' } {
  if (m <= 6)  return { text: '< 6 months',  color: '#ef4444', urgency: 'critical' };
  if (m <= 12) return { text: '~1 year',      color: '#ef4444', urgency: 'high' };  // high, not critical
  if (m <= 24) return { text: '~2 years',     color: '#f59e0b', urgency: 'high' };
  if (m <= 36) return { text: '~3 years',     color: '#f59e0b', urgency: 'medium' };
  return       { text: '3+ years',            color: '#94a3b8', urgency: 'medium' };
}

/** Strip control characters and limit length for safe rendering + sharing */
function sanitize(str: string, maxLen = 60): string {
  return str
    .replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ')  // control chars → space
    .replace(/[<>"']/g, '')                    // strip HTML-ish chars (defence-in-depth)
    .trim()
    .substring(0, maxLen);
}

/** Build a filesystem-safe filename segment */
function safeFileName(str: string): string {
  return str
    .replace(/[^\w\s-]/g, '')   // keep only word chars, spaces, hyphens
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50) || 'career';
}

/** Deterministic fill percentage for the circular arc (visual only) */
function clockFill(months: number): number {
  if (months <= 6)  return 92;
  if (months <= 12) return 78;
  if (months <= 24) return 58;
  if (months <= 36) return 40;
  return 22;
}

/** SVG circle clock — purely decorative countdown arc */
function ClockArc({ months, hex }: { months: number; hex: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = clockFill(months);
  const dash = (fill / 100) * circ;
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" aria-hidden="true">
      {/* track */}
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      {/* arc — starts at top */}
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke={hex}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 26 26)"
        style={{ filter: `drop-shadow(0 0 4px ${hex}88)` }}
      />
      {/* centre dot */}
      <circle cx={26} cy={26} r={3} fill={hex} />
    </svg>
  );
}

// ── Capture target (inline styles — html2canvas safe) ────────────────────────
function CaptureTarget({
  innerRef,
  role,
  industry,
  skills,
  date,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  role: string;
  industry: string;
  skills: ClassifiedSkill[];
  date: string;
}) {
  return (
    <div
      ref={innerRef}
      style={{
        width: 380,
        background: 'linear-gradient(150deg, #0d1117 0%, #1a0f0f 60%, #0d1117 100%)',
        border: '1.5px solid rgba(239,68,68,0.3)',
        borderRadius: 20,
        padding: '24px 22px 20px',
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* glow blob */}
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 160,
        borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>⏳</span>
          <p style={{ color: '#ef4444', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
            Career AI Timeline — estimated
          </p>
        </div>
        <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>
          {role} · {industry}
        </p>
        <p style={{ color: '#475569', fontSize: 11, margin: '3px 0 0' }}>
          Estimated AI adoption curve for each skill (role &amp; industry baseline)
        </p>
      </div>

      {/* skill rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {skills.slice(0, 3).map((skill) => {
          const ml = monthsLabel(skill.estimatedMonths);
          const safeSkillName = sanitize(skill.name, 40);
          const safeReplacement = skill.replacedBy ? sanitize(skill.replacedBy, 40) : null;
          return (
            <div key={skill.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${ml.color}30`,
              borderRadius: 12,
              padding: '12px 14px',
            }}>
              {/* arc */}
              <ClockArc months={skill.estimatedMonths} hex={ml.color} />
              {/* labels */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  {safeSkillName}
                </p>
                {safeReplacement && (
                  <p style={{ color: '#475569', fontSize: 10, margin: '2px 0 0' }}>
                    → replaced by {safeReplacement}
                  </p>
                )}
              </div>
              {/* countdown */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: ml.color, fontSize: 13, fontWeight: 900, margin: 0 }}>{ml.text}</p>
                <p style={{ color: '#334155', fontSize: 9, fontWeight: 700, margin: '2px 0 0' }}>est. remaining</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

      {/* footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 700, margin: 0 }}>jobbachao.com</p>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 500, margin: 0 }}>{date}</p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function DoomClockCard({ report, scanId }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [lastCaptureMs, setLastCaptureMs] = useState(0);
  const { track } = useTrack(scanId);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => { mountedRef.current = false };
  }, []);

  // ── Auto-capture on mount — removes the "Generate" friction step ──────────
  // We wait 800ms for the DOM + fonts to fully paint before capturing.
  // If capture fails silently (e.g. CSP, old browser), the manual button still works.
  React.useEffect(() => {
    if (topSkills.length === 0) return; // nothing to capture
    const timer = setTimeout(async () => {
      if (!cardRef.current || !mountedRef.current) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (!mountedRef.current) return;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
          width: cardRef.current.offsetWidth,
          height: cardRef.current.offsetHeight,
        });
        if (!mountedRef.current) return;
        setImageUrl(canvas.toDataURL('image/png'));
        setShowPreview(true);
      } catch {
        // Silent failure — manual "Generate" button remains visible as fallback
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [topSkills]); // re-fire if skills change (fixes stale closure bug)

  // Get skills sorted by urgency (lowest months = highest risk = first)
  const allSkills = classifySkills(report);
  const atRisk = allSkills
    .filter(s => s.status !== 'safe')
    .sort((a, b) => a.estimatedMonths - b.estimatedMonths);

  const topSkills = atRisk.slice(0, 3);
  const totalAtRisk = atRisk.length;
  const mostUrgentMonths = topSkills[0]?.estimatedMonths ?? 24;
  const mostUrgentLabel = monthsLabel(mostUrgentMonths);

  // Sanitize user-controlled strings at derivation time
  const role = sanitize(report.role || 'Professional', 50);
  const industry = sanitize(report.industry || '', 50);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── capture ──────────────────────────────────────────────────────────────
  const CAPTURE_COOLDOWN_MS = 1500;

  const handleCapture = useCallback(async () => {
    if (!cardRef.current) return;
    // Rate limit: ignore rapid clicks
    const now = Date.now();
    if (now - lastCaptureMs < CAPTURE_COOLDOWN_MS) return;
    setLastCaptureMs(now);

    setCapturing(true);
    setShareError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!mountedRef.current) return;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      });
      if (!mountedRef.current) return;
      setImageUrl(canvas.toDataURL('image/png'));
      setShowPreview(true);
    } catch {
      // Do not log the error object — it may contain auth/network details
      console.error('[DoomClockCard] image capture failed');
      if (!mountedRef.current) return;
      setShareError('Could not generate image. Try again.');
    } finally {
      if (!mountedRef.current) return;
      setCapturing(false);
    }
  }, [lastCaptureMs]);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `doom-clock-${safeFileName(role)}.png`;
    a.click();
  }, [imageUrl, role]);

  const handleShare = useCallback(async () => {
    if (!imageUrl) return;

    // Sanitize skill name — strip newlines / control chars before embedding in URLs
    const skillName = sanitize(topSkills[0]?.name || 'My top skill', 60);

    // Tier-aware share copy
    const urgency = mostUrgentLabel.urgency;
    const text = urgency === 'critical'
      ? `⏳ CRITICAL: ${skillName} faces AI automation in ${mostUrgentLabel.text}. What's your risk? → jobbachao.com`
      : urgency === 'high'
      ? `⚠️ HIGH RISK: ${skillName} has ~${mostUrgentLabel.text} before widespread AI adoption. Check yours → jobbachao.com`
      : `📊 My Career AI Timeline: ${skillName} timeline is ${mostUrgentLabel.text}. What's yours? → jobbachao.com`;

    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], 'doom-clock.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'My Career AI Timeline', text, files: [file] });
          return;
        }
      } catch { /* fall through to WhatsApp */ }
    }

    // WhatsApp fallback — noopener noreferrer (space-separated per spec)
    const waText = encodeURIComponent(`${text}\n\n(Save the image & attach it in WhatsApp)`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener noreferrer');
  }, [imageUrl, topSkills, mostUrgentLabel, role]);

  const handleWhatsAppShare = useCallback(() => {
    const appUrl = window.location.origin;
    const shareUrl = scanId ? `${appUrl}/share/${scanId}` : appUrl;
    const score = Math.round(report.determinism_index ?? 50);
    const roleText = report.role || 'Professional';
    const message = encodeURIComponent(
      `I just checked my AI job risk — I scored ${score}/100 on JobBachao 🛡️\n\nAre YOU safe? Check your score free:\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
    track('whatsapp_share', { score, role: roleText, scan_id: scanId });
  }, [report, scanId, track]);

  // ── no at-risk skills ────────────────────────────────────────────────────
  if (topSkills.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-prophet-green/25 bg-prophet-green/5 p-5 text-center space-y-2"
      >
        <p className="text-3xl">🛡️</p>
        <p className="text-base font-black text-prophet-green">No immediate skill threats detected</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your skill profile shows strong resilience. Check the AI Timeline in the deep-dive section for a full breakdown.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Urgency headline */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.05] p-4"
      >
        <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground leading-tight">
            {totalAtRisk} skill{totalAtRisk !== 1 ? 's' : ''} approaching AI automation
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Your most at-risk skill — <span className="font-bold text-foreground">{sanitize(topSkills[0]?.name, 40)}</span> —
            estimated <span style={{ color: mostUrgentLabel.color }} className="font-black">{mostUrgentLabel.text}</span>{' '}
            before widespread adoption.
          </p>
        </div>
      </motion.div>

      {/* Live card preview (always visible) */}
      <div className="flex justify-center">
        <CaptureTarget
          innerRef={cardRef}
          role={role}
          industry={industry}
          skills={topSkills}
          date={date}
        />
      </div>

      {shareError && (
        <p className="text-xs text-destructive text-center">{shareError}</p>
      )}

      {/* Interactive skill rows (styled for live view) */}
      <div className="space-y-2">
        {topSkills.map((skill, i) => {
          const ml = monthsLabel(skill.estimatedMonths);
          return (
            <motion.div
              key={`skill-${skill.name.replace(/\s+/g, '-')}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 rounded-xl border bg-card/60 p-3"
              style={{ borderColor: `${ml.color}28` }}
            >
              {/* mini arc */}
              <div className="flex-shrink-0">
                <ClockArc months={skill.estimatedMonths} hex={ml.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{skill.name}</p>
                {skill.replacedBy && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    → {sanitize(skill.replacedBy, 50)}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black" style={{ color: ml.color }}>{ml.text}</p>
                <p className="text-[10px] text-muted-foreground">est. remaining</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Share section — pre-rendered image shown instantly; manual button as fallback */}
      {!showPreview ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleCapture}
          disabled={capturing}
          className="w-full py-4 rounded-xl bg-destructive text-destructive-foreground font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive transition-all"
        >
          {capturing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Preparing your share card…
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Generate Share Card
            </>
          )}
        </motion.button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="rounded-xl overflow-hidden border border-border">
              <img
                src={imageUrl!}
                alt={`Career AI timeline showing automation risk for ${role} skills`}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-destructive/30 bg-destructive/[0.06] text-destructive font-black text-sm hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#25D366] text-white font-black text-sm hover:bg-[#20BA5A] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366] transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-black text-sm hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setShowPreview(false); setImageUrl(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors py-1"
            >
              ↺ Regenerate
            </button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Cohort peer comparison — IP #1 */}
      {scanId && (
        <CohortInsightBadge scanId={scanId} variant="doom" />
      )}

      {/* Context footnote */}
      <div className="rounded-xl bg-muted/30 border border-border/50 p-3 flex items-start gap-2">
        <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Timelines are estimates based on current AI adoption curves for your role and industry.
          Margins vary ±6–18 months depending on skill specificity.
          See <span className="text-foreground font-bold">AI Timeline</span> in the deep-dive for every skill.
        </p>
      </div>
    </div>
  );
}
