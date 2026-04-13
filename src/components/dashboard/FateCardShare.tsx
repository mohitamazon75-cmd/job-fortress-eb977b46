import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Twitter, Linkedin, Copy, Check, MessageCircle } from 'lucide-react';
import { ScanReport } from '@/lib/scan-engine';

interface FateCardShareProps {
  report: ScanReport;
  scanId: string;
  sticky?: boolean;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFateCard(canvas: HTMLCanvasElement, report: ScanReport) {
  const ctx = canvas.getContext('2d')!;
  const w = 1080;
  const h = 1350;
  canvas.width = w;
  canvas.height = h;

  const roleRisk = report.determinism_index;
  const personalResilience = report.survivability?.score ?? 50;
  const careerRisk = Math.min(99, Math.max(5, Math.round(roleRisk * 0.65 + (100 - personalResilience) * 0.35)));
  const isCritical = careerRisk > 60;
  const accent = isCritical ? '#dc2626' : '#16a34a';
  const accentLight = isCritical ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)';
  const accentMed = isCritical ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)';

  // ── Background: warm off-white with subtle noise ──
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0, 0, w, h);

  // Decorative top accent bar
  const barGrad = ctx.createLinearGradient(0, 0, w, 0);
  barGrad.addColorStop(0, accent);
  barGrad.addColorStop(0.5, isCritical ? '#f97316' : '#22d3ee');
  barGrad.addColorStop(1, accent);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, w, 8);

  // ── Header section ──
  const pad = 72;

  // Brand mark
  ctx.fillStyle = '#18181b';
  ctx.font = '700 32px "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('JOB BACHAO', pad, 72);

  // Tagline pill
  roundRect(ctx, pad, 88, 210, 28, 14);
  ctx.fillStyle = accentLight;
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = '700 12px "SF Pro Display", system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('AI CAREER INTELLIGENCE', pad + 14, 107);

  // Status badge (top right)
  const statusText = isCritical ? '⚠ HIGH RISK' : '✓ RESILIENT';
  const badgeW = isCritical ? 170 : 160;
  roundRect(ctx, w - pad - badgeW, 52, badgeW, 40, 20);
  ctx.fillStyle = accentMed;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = '700 16px "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, w - pad - badgeW / 2, 78);

  // ── Divider ──
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, 140); ctx.lineTo(w - pad, 140); ctx.stroke();

  // ── Role & Industry ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#18181b';
  ctx.font = '700 52px "SF Pro Display", system-ui, sans-serif';
  const roleText = report.role.length > 28 ? report.role.slice(0, 28) + '…' : report.role;
  ctx.fillText(roleText, w / 2, 210);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '400 22px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText(report.industry, w / 2, 248);

  // ── Score ring ──
  const cx = w / 2, cy = 420, r = 140;

  // Outer glow
  const glowGrad = ctx.createRadialGradient(cx, cy, r - 20, cx, cy, r + 40);
  glowGrad.addColorStop(0, accentLight);
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(cx, cy, r + 40, 0, Math.PI * 2); ctx.fill();

  // Track ring
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  // Progress arc
  const progress = careerRisk / 100;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * progress);
  const arcGrad = ctx.createConicGradient(startAngle, cx, cy);
  arcGrad.addColorStop(0, accent);
  arcGrad.addColorStop(progress * 0.8, isCritical ? '#f97316' : '#22d3ee');
  arcGrad.addColorStop(progress, accent);
  arcGrad.addColorStop(progress + 0.01, 'transparent');
  arcGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, endAngle); ctx.stroke();
  ctx.lineCap = 'butt';

  // Score text
  ctx.fillStyle = '#18181b';
  ctx.font = '800 108px "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${careerRisk}`, cx, cy + 30);

  ctx.fillStyle = '#71717a';
  ctx.font = '500 18px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('CAREER RISK SCORE', cx, cy + 62);

  // ── Stats cards row ──
  const statsY = 610;
  const cardW = (w - pad * 2 - 32) / 3;
  const cardH = 90;
  const moatScore = report.moat_score;
  const urgencyScore = (report as any).urgency_score;
  const stats = [
    { label: 'ACT BY (MO)', value: `${report.months_remaining}`, icon: '⏱' },
    { label: moatScore ? 'UNIQUENESS' : 'AI THREATS', value: moatScore ? `${moatScore}%` : `${(report.ai_tools_replacing || []).length}`, icon: moatScore ? '🛡' : '🤖' },
    { label: urgencyScore ? 'AI SPEED' : 'RESILIENCE', value: urgencyScore ? `${urgencyScore}%` : `${personalResilience}%`, icon: urgencyScore ? '⚡' : '🛡' },
  ];

  stats.forEach((s, i) => {
    const sx = pad + i * (cardW + 16);
    roundRect(ctx, sx, statsY, cardW, cardH, 16);
    ctx.fillStyle = '#f4f4f5';
    ctx.fill();
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '400 24px "SF Pro Display", system-ui, sans-serif';
    ctx.fillText(s.icon, sx + cardW / 2, statsY + 32);

    ctx.fillStyle = '#18181b';
    ctx.font = '800 28px "SF Pro Display", system-ui, sans-serif';
    ctx.fillText(s.value, sx + cardW / 2, statsY + 60);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 11px "SF Pro Display", system-ui, sans-serif';
    ctx.fillText(s.label, sx + cardW / 2, statsY + 80);
  });

  // ── Two-column skills section ──
  const skillsY = 740;
  const colW = (w - pad * 2 - 24) / 2;

  // Threats column
  roundRect(ctx, pad, skillsY, colW, 200, 16);
  ctx.fillStyle = 'rgba(220,38,38,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,38,38,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#dc2626';
  ctx.font = '700 14px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('⚠  SKILLS AT RISK', pad + 20, skillsY + 32);

  report.execution_skills_dead.slice(0, 3).forEach((skill, i) => {
    ctx.fillStyle = '#3f3f46';
    ctx.font = '400 19px "SF Pro Display", system-ui, sans-serif';
    ctx.fillText(`›  ${skill}`, pad + 24, skillsY + 70 + i * 38);
  });

  // Moat column
  const col2X = pad + colW + 24;
  roundRect(ctx, col2X, skillsY, colW, 200, 16);
  ctx.fillStyle = 'rgba(22,163,74,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(22,163,74,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#16a34a';
  ctx.font = '700 14px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('✓  YOUR MOAT', col2X + 20, skillsY + 32);

  report.moat_skills.slice(0, 3).forEach((skill, i) => {
    ctx.fillStyle = '#3f3f46';
    ctx.font = '400 19px "SF Pro Display", system-ui, sans-serif';
    ctx.fillText(`›  ${skill}`, col2X + 24, skillsY + 70 + i * 38);
  });

  // ── Recommended Pivot ──
  const pivotY = 980;
  const pivotH = 100;
  roundRect(ctx, pad, pivotY, w - pad * 2, pivotH, 20);
  const pivotGrad = ctx.createLinearGradient(pad, pivotY, w - pad, pivotY);
  pivotGrad.addColorStop(0, isCritical ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)');
  pivotGrad.addColorStop(1, isCritical ? 'rgba(249,115,22,0.06)' : 'rgba(34,211,238,0.06)');
  ctx.fillStyle = pivotGrad;
  ctx.fill();
  ctx.strokeStyle = accentMed;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 13px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('RECOMMENDED CAREER PIVOT', w / 2, pivotY + 36);

  ctx.fillStyle = '#18181b';
  ctx.font = '700 30px "SF Pro Display", system-ui, sans-serif';
  const pivotText = report.arbitrage_role.length > 32 ? report.arbitrage_role.slice(0, 32) + '…' : report.arbitrage_role;
  ctx.fillText(pivotText, w / 2, pivotY + 72);

  // ── Cognitive Moat banner ──
  const moatBannerY = 1110;
  ctx.fillStyle = '#f4f4f5';
  roundRect(ctx, pad, moatBannerY, w - pad * 2, 60, 12);
  ctx.fill();

  ctx.fillStyle = '#71717a';
  ctx.font = '500 14px "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('YOUR COGNITIVE MOAT', pad + 20, moatBannerY + 26);

  ctx.fillStyle = '#18181b';
  ctx.font = '600 18px "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'right';
  const moatText = report.cognitive_moat.length > 35 ? report.cognitive_moat.slice(0, 35) + '…' : report.cognitive_moat;
  ctx.fillText(moatText, w - pad - 20, moatBannerY + 42);

  // ── Footer ──
  // Divider
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h - 100); ctx.lineTo(w - pad, h - 100); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#71717a';
  ctx.font = '500 18px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('Get your AI career scan', w / 2, h - 62);

  ctx.fillStyle = '#18181b';
  ctx.font = '700 22px "SF Pro Display", system-ui, sans-serif';
  ctx.fillText('jobbachao.in', w / 2, h - 34);
}

export default function FateCardShare({ report, scanId, sticky = false }: FateCardShareProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const roleRisk = report.determinism_index;
  const personalResilience = report.survivability?.score ?? 50;
  const careerRisk = Math.min(99, Math.max(5, Math.round(roleRisk * 0.65 + (100 - personalResilience) * 0.35)));

  const generateCard = useCallback(() => {
    if (canvasRef.current) {
      drawFateCard(canvasRef.current, report);
    }
    setOpen(true);
  }, [report]);

  const downloadImage = useCallback(() => {
    if (!canvasRef.current) return;
    drawFateCard(canvasRef.current, report);
    const link = document.createElement('a');
    link.download = `jobbachao-fate-card-${report.role.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, [report]);

  const shareText = careerRisk > 60
    ? `🚨 My Career Risk Score: ${careerRisk}% — My ${report.role} role has ~${report.months_remaining} months before significant AI impact. What's YOUR score?`
    : `✅ My Career Risk Score: ${careerRisk}% — My career has a strong moat against AI. What's YOUR score?`;

  const shareUrl = 'https://jobbachao.in';

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n\nGet your score → ${shareUrl}`)}`, '_blank');
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=JobBachao,AICareer`, '_blank');
  };

  const shareLinkedin = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sticky floating action button
  if (sticky) {
    return (
      <>
        <canvas ref={canvasRef} className="hidden" />
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 2, type: 'spring', damping: 15 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={generateCard}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-primary-foreground shadow-xl"
          style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 30px hsl(221 83% 53% / 0.4)' }}
        >
          <Share2 className="w-6 h-6" />
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-foreground">Share Your Fate Card</h3>
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-border mb-4 bg-white">
                  <canvas
                    ref={(el) => {
                      if (el && canvasRef.current !== el) {
                        (canvasRef as any).current = el;
                      }
                      if (el) drawFateCard(el, report);
                    }}
                    className="w-full h-auto"
                    style={{ aspectRatio: '1080/1350' }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button
                    onClick={shareWhatsApp}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-prophet-green/30 bg-prophet-green/5 hover:bg-prophet-green/10 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5 text-prophet-green" />
                    <span className="text-[10px] font-bold text-prophet-green">WhatsApp</span>
                  </button>
                  <button
                    onClick={shareTwitter}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                  >
                    <Twitter className="w-5 h-5 text-foreground" />
                    <span className="text-[10px] text-muted-foreground">Twitter/X</span>
                  </button>
                  <button
                    onClick={shareLinkedin}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                  >
                    <Linkedin className="w-5 h-5 text-foreground" />
                    <span className="text-[10px] text-muted-foreground">LinkedIn</span>
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-prophet-green" /> : <Copy className="w-5 h-5 text-foreground" />}
                    <span className="text-[10px] text-muted-foreground">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <button
                  onClick={downloadImage}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Inline button (used right after score reveal)
  return (
    <>
      <canvas ref={canvasRef} className="hidden" />

      <button
        onClick={generateCard}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium shadow-sm"
      >
        <Share2 className="w-4 h-4" />
        Share Fate Card
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Share Your Fate Card</h3>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border border-border mb-4 bg-white">
                <canvas
                  ref={(el) => {
                    if (el && canvasRef.current !== el) {
                      (canvasRef as any).current = el;
                    }
                    if (el) drawFateCard(el, report);
                  }}
                  className="w-full h-auto"
                  style={{ aspectRatio: '1080/1350' }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                <button
                  onClick={shareWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-prophet-green/30 bg-prophet-green/5 hover:bg-prophet-green/10 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-prophet-green" />
                  <span className="text-[10px] font-bold text-prophet-green">WhatsApp</span>
                </button>
                <button
                  onClick={shareTwitter}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  <Twitter className="w-5 h-5 text-foreground" />
                  <span className="text-[10px] text-muted-foreground">Twitter/X</span>
                </button>
                <button
                  onClick={shareLinkedin}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  <Linkedin className="w-5 h-5 text-foreground" />
                  <span className="text-[10px] text-muted-foreground">LinkedIn</span>
                </button>
                <button
                  onClick={copyLink}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-prophet-green" /> : <Copy className="w-5 h-5 text-foreground" />}
                  <span className="text-[10px] text-muted-foreground">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <button
                onClick={downloadImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download Image
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
