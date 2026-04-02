import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Download, Share2, X, Zap, Shield, TrendingDown, Trophy } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';

interface Props {
  report: ScanReport;
}

interface Tier {
  label: string;
  sublabel: string;
  hex: string;
  bg: string;
  border: string;
  ring: string;
}

function getTier(score: number): Tier {
  if (score >= 70) return {
    label: 'SAFE ZONE',
    sublabel: 'Your career is well-positioned',
    hex: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
    ring: 'rgba(34,197,94,0.25)',
  };
  if (score >= 50) return {
    label: 'HEADS UP',
    sublabel: 'Some risk — action advised',
    hex: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    ring: 'rgba(245,158,11,0.25)',
  };
  return {
    label: 'ACT NOW',
    sublabel: 'High AI exposure — pivot fast',
    hex: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    ring: 'rgba(239,68,68,0.25)',
  };
}

// ── The card that gets captured by html2canvas ──────────────────────────────
// All colours are inline hex/rgba — no CSS custom properties (var(--…)) —
// so html2canvas renders them faithfully even without the Tailwind theme.
function CaptureTarget({
  innerRef,
  score,
  tier,
  role,
  industry,
  moatSkills,
  aiExposure,
  humanEdge,
  date,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  score: number;
  tier: Tier;
  role: string;
  industry: string;
  moatSkills: string[];
  aiExposure: number;
  humanEdge: number;
  date: string;
}) {
  return (
    <div
      ref={innerRef}
      style={{
        width: 380,
        background: 'linear-gradient(135deg, #0d1117 0%, #161b27 55%, #0d1117 100%)',
        borderRadius: 20,
        border: `1.5px solid ${tier.border}`,
        padding: '28px 24px 22px',
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* subtle glow blob */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 200, height: 200,
        borderRadius: '50%',
        background: tier.ring,
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Header: role + industry */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
          Career Risk Assessment
        </p>
        <p style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.3 }}>
          {role}
        </p>
        <p style={{ color: '#64748b', fontSize: 11, fontWeight: 500, margin: '2px 0 0' }}>
          {industry}
        </p>
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        {/* Score circle */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          border: `3px solid ${tier.hex}`,
          background: tier.bg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 24px ${tier.ring}`,
        }}>
          <span style={{ color: tier.hex, fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>
            {score}
          </span>
          <span style={{ color: '#475569', fontSize: 10, fontWeight: 600, marginTop: 1 }}>/100</span>
        </div>

        {/* Tier badge + sublabel */}
        <div>
          <div style={{
            display: 'inline-block',
            background: tier.bg,
            border: `1px solid ${tier.border}`,
            borderRadius: 6,
            padding: '3px 10px',
            marginBottom: 6,
          }}>
            <span style={{ color: tier.hex, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em' }}>
              {tier.label}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
            {tier.sublabel}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 18,
      }}>
        {[
          { label: 'Human Edge', value: `${humanEdge}%`, color: '#22c55e' },
          { label: 'AI Exposure', value: `${aiExposure}%`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <p style={{ color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              {label}
            </p>
            <p style={{ color, fontSize: 22, fontWeight: 900, margin: '2px 0 0', lineHeight: 1 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Moat skills */}
      {moatSkills.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ color: '#475569', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Top Moat Skills
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {moatSkills.map(skill => (
              <span key={skill} style={{
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#22c55e',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
              }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 700, margin: 0 }}>
          jobbachao.com
        </p>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 500, margin: 0 }}>
          {date}
        </p>
      </div>
    </div>
  );
}

/** Strip control characters and limit length for safe rendering + sharing */
function sanitizeStr(str: string, maxLen = 60): string {
  return str
    .replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ')
    .replace(/[<>"']/g, '')
    .trim()
    .substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50) || 'career';
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [lastCaptureMs, setLastCaptureMs] = useState(0);

  const score = computeStabilityScore(report);
  const tier = getTier(score);
  const moatSkills = (report.moat_skills ?? []).slice(0, 3);
  const aiExposure = Math.round(report.determinism_index ?? 50);
  const humanEdge = Math.max(0, 100 - aiExposure);
  // Sanitize user-controlled strings before embedding in HTML or URLs
  const role = sanitizeStr(report.role || 'Professional', 50);
  const industry = sanitizeStr(report.industry || '', 50);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const CAPTURE_COOLDOWN_MS = 1500;

  const handleCapture = useCallback(async () => {
    if (!cardRef.current) return;
    const now = Date.now();
    if (now - lastCaptureMs < CAPTURE_COOLDOWN_MS) return;
    setLastCaptureMs(now);

    setCapturing(true);
    setShareError(null);
    try {
      // Dynamic import — keeps the html2canvas bundle out of the initial chunk
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      });
      setImageUrl(canvas.toDataURL('image/png'));
      setShowPreview(true);
    } catch {
      // Do not log the error object — may contain auth/network details
      console.error('[ShareableScoreCard] image capture failed');
      setShareError('Could not generate image. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [lastCaptureMs]);

  const handleDownload = useCallback(() => {
    if (downloading) return;
    if (!imageUrl) return;
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `career-score-${safeFileName(role)}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }, [imageUrl, role, downloading]);

  const handleShare = useCallback(async () => {
    if (!imageUrl) return;

    // Tier-aware copy — rocket emoji on SAFE ZONE contradicts "well-positioned" messaging
    const shareText =
      tier.label === 'SAFE ZONE'
        ? `✅ I'm in the Safe Zone: ${score}/100 AI-readiness. What's yours? → jobbachao.com`
        : tier.label === 'HEADS UP'
        ? `⚠️ HEADS UP: My AI-readiness is ${score}/100. Is yours ready? → jobbachao.com`
        : `🚀 ACT NOW: My AI-readiness is ${score}/100. Pivot fast. → jobbachao.com`;

    // Try native Web Share API (mobile-first)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `career-score-${score}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'My Career Score', text: shareText, files: [file] });
          return;
        }
      } catch { /* fall through to WhatsApp */ }
    }

    // WhatsApp fallback — noopener noreferrer (space-separated per spec)
    const waText = encodeURIComponent(`${shareText}\n\n(Save the image and attach it)`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener noreferrer');
  }, [imageUrl, score, tier.label]);

  return (
    <div className="space-y-5">
      {/* Live preview of the card (always visible so user sees what they'll share) */}
      <div className="flex justify-center">
        <CaptureTarget
          innerRef={cardRef}
          score={score}
          tier={tier}
          role={role}
          industry={industry}
          moatSkills={moatSkills}
          aiExposure={aiExposure}
          humanEdge={humanEdge}
          date={date}
        />
      </div>

      {/* Error */}
      {shareError && (
        <p className="text-xs text-destructive text-center">{shareError}</p>
      )}

      {/* Generate button */}
      {!showPreview && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleCapture}
          disabled={capturing}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all"
        >
          {capturing ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Generate Score Card
            </>
          )}
        </motion.button>
      )}

      {/* Preview + action buttons */}
      <AnimatePresence>
        {showPreview && imageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Generated image preview */}
            <div className="rounded-xl overflow-hidden border border-border">
              <img
                src={imageUrl}
                alt="Your career score card"
                className="w-full"
              />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-primary/30 bg-primary/[0.06] text-primary font-black text-sm hover:bg-primary/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all disabled:opacity-60"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>

            {/* Regenerate */}
            <button
              type="button"
              onClick={() => { setShowPreview(false); setImageUrl(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors py-1"
            >
              ↺ Regenerate
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust footnote */}
      <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
        Score of <span className="font-bold text-foreground">{score}/100</span> · {tier.label} ·{' '}
        Score calculated from: your skills · AI tool adoption data · role & industry risk benchmarks
      </p>
    </div>
  );
}
