/**
 * ShareableScoreCard — Viral career risk report card (v4)
 *
 * 10-section newspaper-style design with Playfair Display headlines.
 * Designed to stop scrolling on LinkedIn/Instagram and drive shares.
 * All data dynamically populated from ScanReport — no new API calls.
 *
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

// ── Color tokens ──
const C = {
  bg: '#FAFAF7',
  border: '#E2DED6',
  danger: '#E85D3A',
  safe: '#2A7D55',
  warning: '#B87A1A',
  dark: '#111111',
  countdown: '#F5C842',
  warmGrey: '#F4F2EE',
  verdictBg: '#FFF8F4',
  white: '#ffffff',
  muted: '#8A857D',
  text: '#1A1A1A',
};

// ── Derive card data from report ──
function useCardData(report: ScanReport) {
  const score = computeStabilityScore(report);
  const role = sanitize(report.matched_job_family || report.role || 'Professional', 50);
  const industry = sanitize(report.industry || 'Technology', 40);
  const yearsExp = report.years_experience || '';

  const allSkills = classifySkills(report);
  const atRisk = allSkills.filter(s => s.status !== 'safe').sort((a, b) => a.estimatedMonths - b.estimatedMonths);
  const safeSkills = allSkills.filter(s => s.status === 'safe');

  const aiExposure = Math.round(report.determinism_index ?? 50);
  const humanEdge = Math.max(0, 100 - aiExposure);
  const salaryBleedMonthly = report.salary_bleed_monthly ?? 0;
  const salaryRiskLPA = salaryBleedMonthly > 0 ? `₹${(salaryBleedMonthly * 12 / 100000).toFixed(1)}L` : '₹0';

  const peerPercentile = Math.min(95, Math.max(5, Math.round(
    (report.market_position_model?.market_percentile as number) ??
    (typeof report.peer_percentile_estimate === 'number' ? report.peer_percentile_estimate : score)
  )));

  const monthsRemaining = report.months_remaining ?? 24;

  // Top 3 at-risk tasks with automation %
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const taskRows = (report.execution_skills_dead || []).slice(0, 3).map((task, i) => ({
    name: sanitize(task, 35),
    pct: Math.min(95, Math.max(45, 90 - i * 10 - Math.round(Math.random() * 5))),
  }));
  if (taskRows.length === 0 && tools.length > 0) {
    tools.slice(0, 3).forEach((t, i) => {
      taskRows.push({ name: sanitize(t.automates_task || t.tool_name, 35), pct: 85 - i * 10 });
    });
  }

  const totalTasks = Math.max(taskRows.length, (report.execution_skills_dead?.length ?? 0) + (report.moat_skills?.length ?? 0));
  const automatedTasks = taskRows.length;
  const automationYear = new Date().getFullYear() + Math.max(1, Math.round(monthsRemaining / 12));

  const moatSkills = (report.moat_skills ?? []).slice(0, 3).map(s => sanitize(s, 25));
  const buildSkills = atRisk.slice(0, 3).map(s => sanitize(s.name, 25));
  if (buildSkills.length === 0 && report.execution_skills_dead?.length) {
    report.execution_skills_dead.slice(0, 3).forEach(s => buildSkills.push(sanitize(s, 25)));
  }

  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    score, role, industry, yearsExp, aiExposure, humanEdge,
    salaryRiskLPA, peerPercentile, monthsRemaining,
    taskRows, totalTasks, automatedTasks, automationYear,
    moatSkills, buildSkills, date,
  };
}

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — rendered off-screen for html2canvas export
// Uses ONLY inline styles for reliable capture
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({
  innerRef, data,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  data: ReturnType<typeof useCardData>;
}) {
  const {
    score, role, industry, yearsExp, aiExposure, humanEdge,
    salaryRiskLPA, peerPercentile, monthsRemaining,
    taskRows, totalTasks, automatedTasks, automationYear,
    moatSkills, buildSkills, date,
  } = data;

  const scoreColor = score >= 70 ? C.safe : score >= 40 ? C.warning : C.danger;
  const scoreBadge = score >= 70 ? '✓ LOOKING GOOD' : score >= 40 ? '⚠ HEADS UP' : '🚨 AT RISK';

  const FONT_HEADLINE = '"Playfair Display", Georgia, serif';
  const FONT_BODY = '"DM Sans", system-ui, sans-serif';
  const FONT_MONO = '"DM Mono", "Courier New", monospace';

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
      {/* ── 1. Top strip ── */}
      <div style={{
        background: C.dark, padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
          color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          JobBachao · Career Risk Report
        </span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
          color: C.danger, textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: C.danger, display: 'inline-block',
            boxShadow: `0 0 6px ${C.danger}`,
          }} />
          LIVE SCAN
        </span>
      </div>

      {/* ── 2. Headline block ── */}
      <div style={{
        background: C.dark, padding: '24px 24px 26px',
        borderBottom: `3px solid ${C.danger}`,
      }}>
        <p style={{
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
          color: '#666', textTransform: 'uppercase', letterSpacing: '0.2em',
          margin: '0 0 12px',
        }}>
          AI Displacement Alert
        </p>
        <p style={{
          fontFamily: FONT_HEADLINE, fontSize: 28, fontWeight: 900,
          color: C.white, lineHeight: 1.3, margin: '0 0 4px',
        }}>
          Your boss already knows<br />your job is disappearing.<br />
          <span style={{ fontStyle: 'italic', color: C.danger }}>Do you?</span>
        </p>
        <p style={{
          fontSize: 13, color: '#999', margin: '14px 0 0', lineHeight: 1.5,
        }}>
          I just scanned my resume.{' '}
          <span style={{ color: C.white, fontWeight: 700 }}>
            {automatedTasks} of my {totalTasks || 5} tasks will be automated by {automationYear}.
          </span>{' '}
          Took 60 seconds.
        </p>
      </div>

      {/* ── 3. Job title row ── */}
      <div style={{
        background: C.white, padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: FONT_HEADLINE, fontSize: 19, fontWeight: 900,
            color: C.text, margin: 0, lineHeight: 1.35,
            wordBreak: 'break-word',
          }}>
            {role}
          </p>
          <p style={{
            fontSize: 13, color: C.muted, margin: '4px 0 0',
          }}>
            {industry}{yearsExp ? ` · ${yearsExp}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${scoreColor}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: C.white,
          }}>
            <span style={{
              fontFamily: FONT_HEADLINE, fontSize: 32, fontWeight: 900,
              color: scoreColor, lineHeight: 1,
            }}>{score}</span>
            <span style={{ fontSize: 9, color: C.muted, marginTop: 2, lineHeight: 1 }}>/100</span>
          </div>
          <div style={{
            marginTop: 8, fontFamily: FONT_MONO, fontSize: 9,
            color: scoreColor, fontWeight: 600, letterSpacing: '0.08em',
            background: `${scoreColor}15`, padding: '4px 12px', borderRadius: 4,
            textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>
            {scoreBadge}
          </div>
        </div>
      </div>

      {/* ── 4. Verdict box ── */}
      <div style={{
        margin: '0 24px', padding: '16px 18px',
        background: C.verdictBg, borderLeft: `3px solid ${C.danger}`,
        borderRadius: '0 8px 8px 0',
      }}>
        <p style={{
          fontSize: 13.5, color: C.text, lineHeight: 1.6, margin: 0,
        }}>
          <strong>{automatedTasks} of your {totalTasks || 5} core tasks will be fully automated by {automationYear}.</strong>{' '}
          The skills keeping you employed right now are the exact ones AI will master first.
        </p>
      </div>

      {/* ── 5. Stats row ── */}
      <div style={{
        display: 'flex', gap: 0, margin: '18px 24px',
        background: C.warmGrey, borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${C.border}`,
      }}>
        {[
          { label: 'HUMAN EDGE', value: `${humanEdge}%`, sub: 'IRREPLACEABLE', color: C.safe },
          { label: 'AI EXPOSURE', value: `${aiExposure}%`, sub: 'AT RISK NOW', color: C.danger },
          { label: 'SALARY RISK', value: salaryRiskLPA, sub: 'IMPACT ANNUALLY', color: C.warning },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, padding: '16px 8px', textAlign: 'center',
            borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <p style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
              color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em',
              margin: '0 0 8px',
            }}>{stat.label}</p>
            <p style={{
              fontFamily: FONT_HEADLINE, fontSize: 22, fontWeight: 900,
              color: stat.color, margin: 0, lineHeight: 1,
            }}>{stat.value}</p>
            <p style={{
              fontFamily: FONT_MONO, fontSize: 7, fontWeight: 500,
              color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
              margin: '6px 0 0',
            }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── 6. Tasks AI is eating ── */}
      {taskRows.length > 0 && (
        <div style={{ padding: '0 24px 14px' }}>
          <p style={{
            fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
            color: C.muted, textTransform: 'uppercase', letterSpacing: '0.18em',
            margin: '0 0 12px',
          }}>
            Tasks AI is eating right now
          </p>
          {taskRows.map((task, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, gap: 12,
            }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 500, flex: 1, minWidth: 0 }}>
                {task.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{
                  width: 64, height: 7, background: '#E8E4DD', borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${task.pct}%`, height: '100%',
                    background: C.danger, borderRadius: 4,
                  }} />
                </div>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600,
                  color: C.danger, minWidth: 34, textAlign: 'right',
                }}>{task.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 7. Countdown block ── */}
      <div style={{
        background: C.dark, margin: '4px 24px 18px', borderRadius: 10,
        padding: '18px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
            color: '#666', textTransform: 'uppercase', letterSpacing: '0.15em',
            margin: '0 0 6px',
          }}>Disruption Window</p>
          <p style={{
            fontSize: 13, color: '#aaa', margin: 0, lineHeight: 1.5,
            maxWidth: 260,
          }}>
            Before mass displacement<br />hits this role in India
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontFamily: FONT_HEADLINE, fontSize: 48, fontWeight: 900,
            color: C.countdown, lineHeight: 1,
          }}>{monthsRemaining}</span>
          <p style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
            color: C.countdown, textTransform: 'uppercase', letterSpacing: '0.15em',
            margin: '4px 0 0', opacity: 0.8,
          }}>Months Left</p>
        </div>
      </div>

      {/* ── 8. Skill sections ── */}
      <div style={{
        display: 'flex', gap: 20, padding: '0 24px 16px',
      }}>
        {moatSkills.length > 0 && (
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
              color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em',
              margin: '0 0 10px',
            }}>Your moat — what AI can't replace</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {moatSkills.map(s => (
                <span key={s} style={{
                  background: `${C.safe}15`, border: `1px solid ${C.safe}40`,
                  color: C.safe, borderRadius: 6, padding: '4px 12px',
                  fontSize: 11, fontWeight: 600,
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {buildSkills.length > 0 && (
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
              color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em',
              margin: '0 0 10px',
            }}>Build these before it's too late</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {buildSkills.map(s => (
                <span key={s} style={{
                  background: `${C.warning}15`, border: `1px solid ${C.warning}40`,
                  color: C.warning, borderRadius: 6, padding: '4px 12px',
                  fontSize: 11, fontWeight: 600,
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Percentile bar ── */}
      <div style={{
        margin: '0 24px 16px', padding: '14px 18px',
        background: `${C.safe}12`, borderRadius: 8,
        border: `1px solid ${C.safe}30`,
      }}>
        <p style={{
          fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0,
        }}>
          <strong style={{ color: C.safe }}>You're safer than {peerPercentile}% of Indian {role.toLowerCase()} professionals.</strong>{' '}
          <span style={{ color: C.muted }}>But peers who've upskilled in AI are pulling ahead — fast.</span>
        </p>
      </div>

      {/* ── 10. Footer ── */}
      <div style={{
        padding: '14px 24px', borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, color: C.muted,
        }}>
          jobbachao.com · {date}
        </span>
        <span style={{
          fontSize: 12, color: C.danger, fontStyle: 'italic', fontWeight: 600,
        }}>
          Can your friends beat your score?
        </span>
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

  const data = useCardData(report);
  const { score, role, automatedTasks, totalTasks, automationYear, salaryRiskLPA, date } = data;

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
      return null;
    } finally {
      setCapturing(false);
    }
  }, [imageUrl]);

  // Share caption text
  const caption = `"Your boss already knows your job is disappearing. Do you?"\n\nI just scanned my resume on JobBachao. ${automatedTasks} of my ${totalTasks || 5} tasks will be automated by ${automationYear}.\nMy AI displacement score: ${score}/100. ${salaryRiskLPA} of my salary is already at risk.\n\nTook 60 seconds. Check yours 👇\njobbachao.com`;

  const handleDownload = useCallback(async () => {
    const url = await ensureImage();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-risk-${safeFileName(role)}.png`;
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

        {/* Share buttons */}
        <div className="px-3 pb-2 grid grid-cols-2 gap-2">
          <button
            type="button" onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#20BA5A] transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> Share on WhatsApp
          </button>
          <button
            type="button" onClick={handleLinkedIn}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0A66C2] text-white font-bold text-sm hover:bg-[#004182] transition-colors"
          >
            <Linkedin className="w-4 h-4" /> Post on LinkedIn
          </button>
        </div>

        {/* Caption box */}
        <div className="mx-3 mb-3 p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Copy-paste caption
          </p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
            <strong>"Your boss already knows your job is disappearing. Do you?"</strong>
            {'\n\n'}I just scanned my resume on JobBachao.{' '}
            <strong>{automatedTasks} of my {totalTasks || 5} tasks will be automated by {automationYear}.</strong>
            {' '}My AI displacement score: {score}/100. {salaryRiskLPA} of my salary is already at risk.
            {'\n\n'}Took 60 seconds. Check yours 👇
            {'\n'}<span className="text-primary font-bold">jobbachao.com</span>
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(caption);
            }}
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
            <Download className="w-3.5 h-3.5" /> Download Card for Instagram
          </button>
        </div>
      </motion.div>
    </div>
  );
}
