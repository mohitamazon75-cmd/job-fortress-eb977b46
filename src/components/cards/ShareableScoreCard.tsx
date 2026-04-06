/**
 * ShareableScoreCard — Viral career risk report card (v5)
 *
 * Redesigned for maximum social-feed stopping power.
 * Dark, bold, emotionally provocative. Readable at thumbnail size.
 * html2canvas-safe: CaptureTarget uses inline styles only.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, MessageCircle, Linkedin } from 'lucide-react';
import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { classifySkills } from '@/lib/unified-skill-classifier';

interface Props {
  report: ScanReport;
}

function sanitize(str: string, maxLen = 60): string {
  return str.replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ').replace(/[<>"']/g, '').trim().substring(0, maxLen);
}

function safeFileName(str: string): string {
  return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50) || 'career';
}

// ── Color tokens (v6 — light, clean, professional) ──
const C = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceLight: '#F5F3EF',
  border: '#E5E2DB',
  borderLight: '#D9D5CC',
  danger: '#DC2626',
  dangerGlow: '#DC262615',
  safe: '#16A34A',
  safeGlow: '#16A34A15',
  warning: '#D97706',
  warningGlow: '#D9770615',
  gold: '#B45309',
  white: '#FFFFFF',
  offWhite: '#F8F7F4',
  muted: '#78756E',
  mutedLight: '#9B9890',
  text: '#1A1A1A',
  accent: '#EA580C',
};

// ── Derive card data from report ──
function useCardData(report: ScanReport) {
  const score = computeStabilityScore(report);
  const role = sanitize(report.matched_job_family || report.role || 'Professional', 50);
  const industry = sanitize(report.industry || 'Technology', 40);

  const allSkills = classifySkills(report);
  const atRisk = allSkills.filter(s => s.status !== 'safe').sort((a, b) => a.estimatedMonths - b.estimatedMonths);

  const aiExposure = Math.round(report.determinism_index ?? 50);
  const humanEdge = Math.max(0, 100 - aiExposure);
  const salaryDropPct = report.career_shock_simulator?.salary_drop_percentage
    ?? (report.score_breakdown?.salary_bleed_breakdown?.final_rate
      ? Math.round(report.score_breakdown.salary_bleed_breakdown.final_rate * 100)
      : Math.round(aiExposure * 0.4));
  const salaryRiskLabel = salaryDropPct > 0 ? `~${salaryDropPct}%` : '0%';

  const monthsRemaining = report.months_remaining ?? 24;

  const tools = normalizeTools(report.ai_tools_replacing || []);
  const taskRows = (report.execution_skills_dead || []).slice(0, 3).map((task, i) => ({
    name: sanitize(task, 30),
    pct: Math.min(95, Math.max(45, 90 - i * 10 - Math.round(Math.random() * 5))),
  }));
  if (taskRows.length === 0 && tools.length > 0) {
    tools.slice(0, 3).forEach((t, i) => {
      taskRows.push({ name: sanitize(t.automates_task || t.tool_name, 30), pct: 85 - i * 10 });
    });
  }

  const totalTasks = Math.max(taskRows.length, (report.execution_skills_dead?.length ?? 0) + (report.moat_skills?.length ?? 0));
  const automatedTasks = taskRows.length;
  const automationYear = new Date().getFullYear() + Math.max(1, Math.round(monthsRemaining / 12));

  const moatSkills = (report.moat_skills ?? []).slice(0, 3).map(s => sanitize(s, 22));
  const buildSkills = atRisk.slice(0, 3).map(s => sanitize(s.name, 22));
  if (buildSkills.length === 0 && report.execution_skills_dead?.length) {
    report.execution_skills_dead.slice(0, 3).forEach(s => buildSkills.push(sanitize(s, 22)));
  }

  return {
    score, role, industry, aiExposure, humanEdge,
    salaryRiskLabel, monthsRemaining,
    taskRows, totalTasks, automatedTasks, automationYear,
    moatSkills, buildSkills,
  };
}

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — rendered off-screen for html2canvas export
// v5: Bold dark design, fewer sections, maximum stopping power
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({
  innerRef, data,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  data: ReturnType<typeof useCardData>;
}) {
  const {
    score, role, industry, aiExposure, humanEdge,
    salaryRiskLabel, monthsRemaining,
    taskRows, totalTasks, automatedTasks, automationYear,
    moatSkills, buildSkills,
  } = data;

  const scoreColor = score >= 70 ? C.safe : score >= 40 ? C.warning : C.danger;
  const scoreGlow = score >= 70 ? C.safeGlow : score >= 40 ? C.warningGlow : C.dangerGlow;
  const riskLabel = score >= 70 ? 'SAFE — FOR NOW' : score >= 40 ? 'EXPOSED' : 'REPLACEABLE';

  // Emotional copy — fear → hope arc
  const headline = score >= 70
    ? 'I\'m harder to replace than most.'
    : score >= 40
    ? 'AI is coming for my job. I checked.'
    : 'I\'m already replaceable. Here\'s proof.';

  const verdictText = score >= 70
    ? `${humanEdge}% of what I do is still uniquely human. But ${automatedTasks} of my ${totalTasks || 5} tasks are already automatable by ${automationYear}. Even "safe" isn't permanent.`
    : score >= 40
    ? `${automatedTasks} of my ${totalTasks || 5} core tasks will be fully automated by ${automationYear}. The skills keeping me employed today are the exact ones AI learns next.`
    : `${automatedTasks} of my ${totalTasks || 5} tasks? Already automatable. ${salaryRiskLabel} of my salary is at risk. By ${automationYear}, this role looks completely different.`;

  const countdownCopy = monthsRemaining <= 18
    ? 'before this role is unrecognizable'
    : monthsRemaining <= 36
    ? 'before mass displacement hits'
    : 'before the next wave of cuts';

  const hopeLine = score >= 70
    ? `I know my edge. Do you know yours?`
    : score >= 40
    ? `At least now I know. Most people won't check until it's too late.`
    : `Scary? Yes. But now I have a plan. Most people won't even look.`;

  const FONT_HEADLINE = '"Playfair Display", Georgia, serif';
  const FONT_BODY = '"DM Sans", system-ui, sans-serif';
  const FONT_MONO = '"DM Mono", "Courier New", monospace';

  // Build arc path for the score ring
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      ref={innerRef as React.RefObject<HTMLDivElement>}
      style={{
        position: 'absolute', left: -9999, top: -9999,
        width: 560,
        background: C.bg,
        fontFamily: FONT_BODY,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
      }}
    >
      {/* ── 1. Top brand strip ── */}
      <div style={{
        padding: '14px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
          color: C.mutedLight, letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          JobBachao.com
        </span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
          color: C.danger, letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.danger, display: 'inline-block',
            boxShadow: `0 0 8px ${C.danger}`,
          }} />
          LIVE RESULT
        </span>
      </div>

      {/* ── 2. Emotional headline — the scroll stopper ── */}
      <div style={{
        padding: '28px 28px 8px', textAlign: 'center',
      }}>
        <p style={{
          fontFamily: FONT_HEADLINE, fontSize: 24, fontWeight: 900,
          color: C.text, lineHeight: 1.35, margin: 0,
          fontStyle: 'italic',
        }}>"{headline}"</p>
      </div>

      {/* ── 3. Hero: Score + Role ── */}
      <div style={{
        padding: '20px 28px 28px',
        textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 80%, ${scoreGlow} 0%, transparent 70%)`,
      }}>
        {/* Score ring via SVG */}
        <div style={{ display: 'inline-block', position: 'relative', width: 130, height: 130 }}>
          <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="65" cy="65" r={radius} fill="none" stroke={C.border} strokeWidth="6" />
            <circle
              cx="65" cy="65" r={radius} fill="none"
              stroke={scoreColor} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: FONT_HEADLINE, fontSize: 48, fontWeight: 900,
              color: scoreColor, lineHeight: 1,
            }}>{score}</span>
            <span style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>/100</span>
          </div>
        </div>

        {/* Risk badge */}
        <div style={{
          display: 'inline-block', marginTop: 14,
          background: `${scoreColor}18`, border: `1px solid ${scoreColor}40`,
          borderRadius: 6, padding: '5px 18px',
        }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
            color: scoreColor, letterSpacing: '0.12em',
          }}>{riskLabel}</span>
        </div>

        {/* Role & industry */}
        <p style={{
          fontFamily: FONT_HEADLINE, fontSize: 22, fontWeight: 900,
          color: C.text, lineHeight: 1.3, margin: '18px 0 0',
          wordBreak: 'break-word',
        }}>{role}</p>
        <p style={{
          fontSize: 13, color: C.muted, margin: '6px 0 0',
        }}>{industry}</p>
      </div>

      {/* ── 3. Emotional verdict line ── */}
      <div style={{
        margin: '0 28px', padding: '16px 20px',
        background: C.surface,
        borderRadius: 10,
        borderLeft: `3px solid ${scoreColor}`,
      }}>
        <p style={{
          fontSize: 14, color: C.text, lineHeight: 1.65, margin: 0,
          fontWeight: 500,
        }}>
          {verdictText}
        </p>
      </div>

      {/* ── 4. Three key metrics ── */}
      <div style={{
        display: 'flex', gap: 10, margin: '20px 28px 0',
      }}>
        {[
          { label: 'Human Edge', value: `${humanEdge}%`, color: C.safe, glow: C.safeGlow },
          { label: 'AI Exposure', value: `${aiExposure}%`, color: C.danger, glow: C.dangerGlow },
          { label: 'Salary Risk', value: salaryRiskLabel, color: C.warning, glow: C.warningGlow },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, padding: '18px 12px', textAlign: 'center',
            background: C.surface, borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}>
            <p style={{
              fontFamily: FONT_HEADLINE, fontSize: 26, fontWeight: 900,
              color: stat.color, margin: 0, lineHeight: 1,
            }}>{stat.value}</p>
            <p style={{
              fontFamily: FONT_MONO, fontSize: 8, fontWeight: 600,
              color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em',
              margin: '8px 0 0',
            }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── 5. Tasks AI is eating — visual bars ── */}
      {taskRows.length > 0 && (
        <div style={{ padding: '20px 28px 0' }}>
          <p style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
            color: C.muted, textTransform: 'uppercase', letterSpacing: '0.2em',
            margin: '0 0 14px',
          }}>
            Tasks being automated
          </p>
          {taskRows.map((task, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 5,
              }}>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{task.name}</span>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700,
                  color: C.danger,
                }}>{task.pct}%</span>
              </div>
              <div style={{
                width: '100%', height: 5, background: C.surfaceLight, borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${task.pct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${C.danger}, ${C.accent})`,
                  borderRadius: 3,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 6. Disruption countdown — dramatic center ── */}
      <div style={{
        margin: '20px 28px',
        padding: '22px',
        background: `linear-gradient(135deg, ${C.surfaceLight} 0%, ${C.surface} 100%)`,
        borderRadius: 12,
        border: `1px solid ${C.borderLight}`,
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
          color: C.muted, textTransform: 'uppercase', letterSpacing: '0.2em',
          margin: '0 0 10px',
        }}>Disruption window</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
          <span style={{
            fontFamily: FONT_HEADLINE, fontSize: 56, fontWeight: 900,
            color: C.danger, lineHeight: 1,
          }}>{monthsRemaining}</span>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700,
            color: C.danger, textTransform: 'uppercase', letterSpacing: '0.1em',
            opacity: 0.7,
          }}>months</span>
        </div>
        <p style={{
          fontSize: 12, color: C.muted, margin: '8px 0 0', lineHeight: 1.4,
        }}>{countdownCopy}</p>
      </div>

      {/* ── 7. Skills: Moat vs Build ── */}
      {(moatSkills.length > 0 || buildSkills.length > 0) && (
        <div style={{
          display: 'flex', gap: 10, padding: '0 28px 20px',
        }}>
          {moatSkills.length > 0 && (
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700,
                color: C.safe, textTransform: 'uppercase', letterSpacing: '0.15em',
                margin: '0 0 8px',
              }}>✓ What keeps me safe</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {moatSkills.map(s => (
                  <span key={s} style={{
                    background: `${C.safe}12`, border: `1px solid ${C.safe}25`,
                    color: C.safe, borderRadius: 6, padding: '5px 12px',
                    fontSize: 11, fontWeight: 600,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {buildSkills.length > 0 && (
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700,
                color: C.warning, textTransform: 'uppercase', letterSpacing: '0.15em',
                margin: '0 0 8px',
              }}>⚠ Learning next</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {buildSkills.map(s => (
                  <span key={s} style={{
                    background: `${C.warning}12`, border: `1px solid ${C.warning}25`,
                    color: C.warning, borderRadius: 6, padding: '5px 12px',
                    fontSize: 11, fontWeight: 600,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 8. Hope line — the emotional turn ── */}
      <div style={{
        margin: '0 28px 16px', padding: '14px 20px',
        background: `${C.safe}08`, borderRadius: 8,
        border: `1px solid ${C.safe}20`,
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 14, color: C.safe, fontWeight: 700,
          margin: 0, fontStyle: 'italic', lineHeight: 1.5,
        }}>{hopeLine}</p>
      </div>

      {/* ── 9. CTA footer ── */}
      <div style={{
        padding: '18px 28px',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{
            fontFamily: FONT_HEADLINE, fontSize: 16, fontWeight: 900,
            color: C.text, margin: 0, lineHeight: 1.3,
          }}>How safe is your job?</p>
          <p style={{
            fontSize: 11, color: C.muted, margin: '3px 0 0',
          }}>Free · 60 seconds · No sign-up</p>
        </div>
        <div style={{
          background: C.danger, borderRadius: 8, padding: '10px 20px',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: FONT_BODY, fontSize: 13, fontWeight: 800,
            color: '#FFFFFF', letterSpacing: '0.02em',
          }}>Check Now →</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component — visible card with share actions + caption
// ═══════════════════════════════════════════════════════════════
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const data = useCardData(report);
  const { score, role, automatedTasks, totalTasks, automationYear, salaryRiskLabel } = data;

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  // Auto-generate on mount
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!cardRef.current || !mountedRef.current) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        if (!mountedRef.current) return;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: C.bg, scale: 2, useCORS: true, logging: false,
          width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight,
        });
        if (!mountedRef.current) return;
        setImageUrl(canvas.toDataURL('image/png'));
      } catch { /* silent */ }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const ensureImage = useCallback(async (): Promise<string | null> => {
    if (imageUrl) return imageUrl;
    if (!cardRef.current) return null;
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: C.bg, scale: 2, useCORS: true, logging: false,
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

  const scoreEmoji = score >= 70 ? '🛡️' : score >= 40 ? '⚠️' : '🚨';
  const caption = `${scoreEmoji} I just checked how replaceable I am by AI.\n\nResult: ${score}/100. ${automatedTasks} of my ${totalTasks || 5} tasks are already automatable.\n\nScary? Yes. But at least now I know.\n\nHow safe is YOUR job? 👇\njobbachao.com`;

  const handleDownload = useCallback(async () => {
    const url = await ensureImage();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-scan-${safeFileName(role)}.png`;
    a.click();
  }, [ensureImage, role]);

  const handleWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer');
  }, [caption]);

  const handleLinkedIn = useCallback(() => {
    navigator.clipboard.writeText(caption).catch(() => {});
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://jobbachao.com')}`, '_blank');
  }, [caption]);

  return (
    <div className="space-y-4">
      {/* Hidden capture target */}
      <CaptureTarget innerRef={cardRef} data={data} />

      {/* ── Visible Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
      >
        {/* Preview image */}
        <AnimatePresence>
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3"
            >
              <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                <img src={imageUrl} alt={`Career risk report for ${role}`} className="w-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!imageUrl && (
          <div className="p-6 text-center">
            <div className="animate-pulse text-muted-foreground text-sm">
              Generating your share card...
            </div>
          </div>
        )}

        {shareError && (
          <p className="px-3 text-xs text-destructive text-center">{shareError}</p>
        )}

        {/* Share buttons */}
        <div className="px-3 pb-2 grid grid-cols-2 gap-2">
          <button
            type="button" onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#20BA5A] transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button
            type="button" onClick={handleLinkedIn}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0A66C2] text-white font-bold text-sm hover:bg-[#004182] transition-colors"
          >
            <Linkedin className="w-4 h-4" /> LinkedIn
          </button>
        </div>

        {/* Caption box */}
        <div className="mx-3 mb-3 p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Copy-paste caption
          </p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
            {scoreEmoji} <strong>I just checked how replaceable I am by AI.</strong>
            {'\n\n'}Result: {score}/100. {automatedTasks} of my {totalTasks || 5} tasks are already automatable.
            {'\n\n'}Scary? Yes. But at least now I know.
            {'\n\n'}How safe is YOUR job? 👇
            {'\n'}<span className="text-primary font-bold">jobbachao.com</span>
          </p>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(caption); }}
            className="mt-3 w-full py-2 rounded-lg border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            Copy Caption
          </button>
        </div>

        {/* Download */}
        <div className="px-3 pb-3">
          <button
            type="button" onClick={handleDownload} disabled={capturing || !imageUrl}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Download Card
          </button>
        </div>
      </motion.div>
    </div>
  );
}
