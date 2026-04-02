/**
 * ShareableScoreCard — compact share & challenge card (v2)
 *
 * No longer shows the full score card inline (users already saw it).
 * Instead: a tight "challenge a friend" CTA with auto-generated share image.
 * The capture target is hidden off-screen for html2canvas only.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, MessageCircle, Users, Sparkles } from 'lucide-react';
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
    label: 'SAFE ZONE', sublabel: 'Your career is well-positioned',
    hex: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', ring: 'rgba(34,197,94,0.25)',
  };
  if (score >= 50) return {
    label: 'HEADS UP', sublabel: 'Some risk — action advised',
    hex: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', ring: 'rgba(245,158,11,0.25)',
  };
  return {
    label: 'ACT NOW', sublabel: 'High AI exposure — pivot fast',
    hex: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', ring: 'rgba(239,68,68,0.25)',
  };
}

function sanitizeStr(str: string, maxLen = 60): string {
  return str.replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ').replace(/[<>"']/g, '').trim().substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50) || 'career';
}

// ── Hidden capture target (off-screen, inline styles for html2canvas) ────────
function CaptureTarget({
  innerRef, score, tier, role, industry, moatSkills, aiExposure, humanEdge, date,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  score: number; tier: Tier; role: string; industry: string;
  moatSkills: string[]; aiExposure: number; humanEdge: number; date: string;
}) {
  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 380,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b2e 55%, #0f172a 100%)',
        borderRadius: 20, border: `1.5px solid ${tier.border}`,
        padding: '28px 24px 22px',
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: tier.ring, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ marginBottom: 18 }}>
        <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>Career Risk Assessment</p>
        <p style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.3 }}>{role}</p>
        <p style={{ color: '#64748b', fontSize: 11, fontWeight: 500, margin: '2px 0 0' }}>{industry}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', border: `3px solid ${tier.hex}`, background: tier.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 24px ${tier.ring}` }}>
          <span style={{ color: tier.hex, fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>{score}</span>
          <span style={{ color: '#475569', fontSize: 10, fontWeight: 600, marginTop: 1 }}>/100</span>
        </div>
        <div>
          <div style={{ display: 'inline-block', background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 6, padding: '3px 10px', marginBottom: 6 }}>
            <span style={{ color: tier.hex, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em' }}>{tier.label}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{tier.sublabel}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[{ label: 'Human Edge', value: `${humanEdge}%`, color: '#22c55e' }, { label: 'AI Exposure', value: `${aiExposure}%`, color: '#ef4444' }].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
            <p style={{ color, fontSize: 22, fontWeight: 900, margin: '2px 0 0', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {moatSkills.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ color: '#475569', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 6px' }}>Top Moat Skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {moatSkills.map(skill => (
              <span key={skill} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{skill}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 700, margin: 0 }}>jobbachao.com</p>
        <p style={{ color: '#334155', fontSize: 10, fontWeight: 500, margin: 0 }}>{date}</p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const score = computeStabilityScore(report);
  const tier = getTier(score);
  const moatSkills = (report.moat_skills ?? []).slice(0, 3);
  const aiExposure = Math.round(report.determinism_index ?? 50);
  const humanEdge = Math.max(0, 100 - aiExposure);
  const role = sanitizeStr(report.role || 'Professional', 50);
  const industry = sanitizeStr(report.industry || '', 50);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  // Auto-generate image on mount
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!cardRef.current || !mountedRef.current) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (!mountedRef.current) return;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: null, scale: 2, useCORS: true, logging: false,
          width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight,
        });
        if (!mountedRef.current) return;
        setImageUrl(canvas.toDataURL('image/png'));
      } catch {
        // Silent — share buttons will trigger manual capture
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const ensureImage = useCallback(async (): Promise<string | null> => {
    if (imageUrl) return imageUrl;
    if (!cardRef.current) return null;
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null, scale: 2, useCORS: true, logging: false,
        width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight,
      });
      const url = canvas.toDataURL('image/png');
      setImageUrl(url);
      return url;
    } catch {
      setShareError('Could not generate image. Try again.');
      return null;
    } finally {
      setCapturing(false);
    }
  }, [imageUrl]);

  const handleDownload = useCallback(async () => {
    const url = await ensureImage();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-score-${safeFileName(role)}.png`;
    a.click();
  }, [ensureImage, role]);

  const handleWhatsApp = useCallback(async () => {
    const shareText = `I scored ${score}/100 on JobBachao's AI Career Assessment 🛡️\n\nWhat's YOUR score? Check free → jobbachao.com`;
    const waText = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener,noreferrer');
  }, [score]);

  const handleShare = useCallback(async () => {
    const url = await ensureImage();
    if (!url) return;

    const shareText = tier.label === 'SAFE ZONE'
      ? `✅ Safe Zone: ${score}/100 AI-readiness. What's yours? → jobbachao.com`
      : tier.label === 'HEADS UP'
      ? `⚠️ Heads Up: ${score}/100 AI-readiness. Check yours → jobbachao.com`
      : `🚀 ${score}/100 AI-readiness. Time to act. Check yours → jobbachao.com`;

    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], `career-score-${score}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'My Career Score', text: shareText, files: [file] });
          return;
        }
      } catch { /* fall through */ }
    }

    const waText = encodeURIComponent(`${shareText}\n\n(Save the image and attach it)`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener noreferrer');
  }, [ensureImage, score, tier.label]);

  // Tier-aware accent
  const tierAccent = score >= 70 ? 'prophet-green' : score >= 50 ? 'prophet-gold' : 'destructive';

  return (
    <div className="space-y-4">
      {/* Hidden capture target */}
      <CaptureTarget
        innerRef={cardRef} score={score} tier={tier} role={role}
        industry={industry} moatSkills={moatSkills} aiExposure={aiExposure}
        humanEdge={humanEdge} date={date}
      />

      {/* ── Challenge Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        {/* Score summary row */}
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full border-2 border-${tierAccent} bg-${tierAccent}/10 flex items-center justify-center flex-shrink-0`}>
            <span className={`text-2xl font-black text-${tierAccent}`}>{score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-foreground leading-tight">
              Challenge your colleagues
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Share your score card and see who's more AI-proof. The image is auto-generated and ready to send.
            </p>
          </div>
        </div>

        {/* Preview thumbnail (if available) */}
        <AnimatePresence>
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl overflow-hidden border border-border"
            >
              <img src={imageUrl} alt={`Career score card for ${role}`} className="w-full" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={capturing}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20BA5A] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={capturing}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>

        {shareError && <p className="text-xs text-destructive text-center">{shareError}</p>}
      </motion.div>

      {/* Social proof nudge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-2 py-2"
      >
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">12,400+</span> cards shared this week
        </p>
      </motion.div>
    </div>
  );
}
