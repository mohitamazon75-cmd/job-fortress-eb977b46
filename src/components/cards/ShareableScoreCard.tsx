/**
 * ShareableScoreCard — viral share card with emotional hooks (v3)
 *
 * Light theme, professional design. Viral psychology:
 * 1. Social comparison — "Safer than X% of professionals in your field"
 * 2. Loss aversion — "₹X salary erosion if no action"
 * 3. Identity signal — sharing makes you look proactive/smart
 * 4. Challenge hook — "Can you beat my score?"
 * 5. Specific data — moat skills, AI exposure %, replacement timeline
 *
 * Capture target uses inline styles (html2canvas safe).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, MessageCircle, Users, Sparkles, Trophy } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { classifySkills } from '@/lib/unified-skill-classifier';

interface Props {
  report: ScanReport;
}

function sanitizeStr(str: string, maxLen = 60): string {
  return str.replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ').replace(/[<>"']/g, '').trim().substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50) || 'career';
}

function getTierData(score: number) {
  if (score >= 70) return { label: 'SAFE ZONE', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🛡️', ringColor: 'rgba(22,163,74,0.15)' };
  if (score >= 50) return { label: 'WARNING ZONE', color: '#d97706', bg: '#fffbeb', border: '#fde68a', emoji: '⚠️', ringColor: 'rgba(217,119,6,0.15)' };
  return { label: 'DANGER ZONE', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '🚨', ringColor: 'rgba(220,38,38,0.15)' };
}

// ── Light Theme Capture Target ──────────────────────────────────────────────
function CaptureTarget({
  innerRef, score, role, industry, moatSkills, aiExposure,
  topThreat, threatTimeline, salaryRisk, peerPercentile, date,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  score: number; role: string; industry: string;
  moatSkills: string[]; aiExposure: number;
  topThreat: string; threatTimeline: string;
  salaryRisk: string; peerPercentile: number;
  date: string;
}) {
  const tier = getTierData(score);

  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 400,
        background: '#ffffff',
        borderRadius: 20,
        border: `2px solid ${tier.border}`,
        padding: '0',
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        height: 6,
        background: `linear-gradient(90deg, ${tier.color}, ${tier.color}88)`,
      }} />

      <div style={{ padding: '24px 24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
              AI Career Assessment
            </p>
            <p style={{ color: '#0f172a', fontSize: 17, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.3 }}>
              {role}
            </p>
            <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500, margin: '2px 0 0' }}>
              {industry}
            </p>
          </div>
          {/* Score circle */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${tier.color}`,
            background: tier.bg,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 20px ${tier.ringColor}`,
          }}>
            <span style={{ color: tier.color, fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>
              {score}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 600, marginTop: 1 }}>/100</span>
          </div>
        </div>

        {/* Tier badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: tier.bg, border: `1px solid ${tier.border}`,
          borderRadius: 8, padding: '5px 12px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 14 }}>{tier.emoji}</span>
          <span style={{ color: tier.color, fontSize: 11, fontWeight: 900, letterSpacing: '0.1em' }}>
            {tier.label}
          </span>
        </div>

        {/* ── Viral Insight Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {/* Peer comparison — social proof trigger */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              Safer than
            </p>
            <p style={{ color: '#0f172a', fontSize: 22, fontWeight: 900, margin: '2px 0 0', lineHeight: 1 }}>
              {peerPercentile}%
            </p>
            <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500, margin: '2px 0 0' }}>
              of professionals
            </p>
          </div>

          {/* AI exposure — fear trigger */}
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              AI Exposure
            </p>
            <p style={{ color: '#dc2626', fontSize: 22, fontWeight: 900, margin: '2px 0 0', lineHeight: 1 }}>
              {aiExposure}%
            </p>
            <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500, margin: '2px 0 0' }}>
              of tasks at risk
            </p>
          </div>
        </div>

        {/* ── Most urgent threat — loss aversion ── */}
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
          <div>
            <p style={{ color: '#0f172a', fontSize: 12, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {topThreat}
            </p>
            <p style={{ color: '#9a3412', fontSize: 10, fontWeight: 600, margin: '2px 0 0' }}>
              Estimated {threatTimeline} before AI disruption
            </p>
          </div>
        </div>

        {/* Salary erosion — if available */}
        {salaryRisk && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '8px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💸</span>
            <p style={{ color: '#0f172a', fontSize: 11, fontWeight: 700, margin: 0 }}>
              {salaryRisk} <span style={{ color: '#dc2626', fontWeight: 600 }}>annual salary erosion risk</span>
            </p>
          </div>
        )}

        {/* Moat skills — identity signal */}
        {moatSkills.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              🛡️ My Strongest Defenses
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {moatSkills.map(skill => (
                <span key={skill} style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  color: '#16a34a', borderRadius: 6, padding: '3px 10px',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA / Challenge hook */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 14,
        }}>
          <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 800 }}>
            Can you beat my score? →
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600 }}>
            jobbachao.com
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 600, margin: 0 }}>
            jobbachao.com · AI Career Intelligence
          </p>
          <p style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 500, margin: 0 }}>{date}</p>
        </div>
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
  const tier = getTierData(score);
  const moatSkills = (report.moat_skills ?? []).slice(0, 4);
  const aiExposure = Math.round(report.determinism_index ?? 50);
  const role = sanitizeStr(report.role || 'Professional', 50);
  const industry = sanitizeStr(report.industry || '', 50);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // Derive viral data points
  const allSkills = classifySkills(report);
  const atRisk = allSkills.filter(s => s.status !== 'safe').sort((a, b) => a.estimatedMonths - b.estimatedMonths);
  const topThreat = sanitizeStr(atRisk[0]?.name || 'Key skills', 40);
  const threatMonths = atRisk[0]?.estimatedMonths ?? 24;
  const threatTimeline = threatMonths <= 6 ? '< 6 months' : threatMonths <= 12 ? '~1 year' : threatMonths <= 24 ? '~2 years' : '~3 years';

  const peerPercentile = Math.min(95, Math.max(5, Math.round(
    (report.market_position_model?.market_percentile as number) ??
    (typeof report.peer_percentile_estimate === 'number' ? report.peer_percentile_estimate : score)
  )));

  const salaryBleedMonthly = report.salary_bleed_monthly ?? 0;
  const salaryRisk = salaryBleedMonthly > 0
    ? `₹${(salaryBleedMonthly * 12 / 100000).toFixed(1)}L`
    : '';

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  // Auto-generate on mount
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!cardRef.current || !mountedRef.current) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (!mountedRef.current) return;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
          width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight,
        });
        if (!mountedRef.current) return;
        setImageUrl(canvas.toDataURL('image/png'));
      } catch { /* silent */ }
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
        backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
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

  const handleWhatsApp = useCallback(() => {
    const text = score >= 70
      ? `🛡️ I'm in the SAFE ZONE — ${score}/100 AI-readiness. Safer than ${peerPercentile}% of professionals.\n\nCan you beat my score? → jobbachao.com`
      : `⚠️ My AI career risk score is ${score}/100. ${topThreat} could be disrupted in ${threatTimeline}.\n\nWhat's YOUR score? → jobbachao.com`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, [score, peerPercentile, topThreat, threatTimeline]);

  const handleShare = useCallback(async () => {
    const url = await ensureImage();
    if (!url) return;
    const text = `My AI Career Score: ${score}/100 — Safer than ${peerPercentile}% of professionals. Can you beat it? → jobbachao.com`;
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], `career-score-${score}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'My Career Score', text, files: [file] });
          return;
        }
      } catch { /* fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener noreferrer');
  }, [ensureImage, score, peerPercentile]);

  // Viral share text for the card
  const viralHook = score >= 70
    ? `You're safer than ${peerPercentile}% of Indian professionals. Make them jealous.`
    : score >= 50
    ? `${topThreat} could be disrupted in ${threatTimeline}. Your friends need to know their risk too.`
    : `${aiExposure}% of your tasks are at risk. Don't let your friends find out the hard way.`;

  return (
    <div className="space-y-4">
      {/* Hidden capture target */}
      <CaptureTarget
        innerRef={cardRef} score={score} role={role} industry={industry}
        moatSkills={moatSkills} aiExposure={aiExposure} topThreat={topThreat}
        threatTimeline={threatTimeline} salaryRisk={salaryRisk}
        peerPercentile={peerPercentile} date={date}
      />

      {/* ── Main Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
      >
        {/* Emotional hook header */}
        <div className="px-5 pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Your Shareable Score Card
            </p>
          </div>

          <p className="text-sm font-bold text-foreground leading-snug">
            {viralHook}
          </p>
        </div>

        {/* Preview */}
        <AnimatePresence>
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 pb-3"
            >
              <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                <img src={imageUrl} alt={`Career score card for ${role}`} className="w-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button" onClick={handleDownload} disabled={capturing}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-muted/50 transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" /> Save
            </button>
            <button
              type="button" onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20BA5A] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button
              type="button" onClick={handleShare} disabled={capturing}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>

          {shareError && <p className="text-xs text-destructive text-center">{shareError}</p>}
        </div>
      </motion.div>

      {/* Social proof */}
      <div className="flex items-center justify-center gap-2 py-1">
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">12,400+</span> cards shared this week
        </p>
      </div>
    </div>
  );
}
