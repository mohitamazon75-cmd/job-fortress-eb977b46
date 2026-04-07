/**
 * ShareableScoreCard — Viral career risk report card (v10)
 *
 * CHANGE 1: First-person FOMO headlines (DI-based)
 * CHANGE 2: Hero stat pattern — one dominant stat + smaller row
 * CHANGE 3: AI Exposure threat bar in left panel
 * CHANGE 4: Score-color CTA in bottom strip
 * CHANGE 5: "Dare" line above generate button
 * CHANGE 6: Square (1080x1080) format for WhatsApp/Instagram
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

function getScoreColor(score: number): string {
  if (score >= 70) return '#EF4444';
  if (score >= 50) return '#F97316';
  if (score >= 30) return '#EAB308';
  return '#22C55E';
}

function getTierLabel(di: number): string {
  if (di >= 70) return 'YOUR ROLE IS BEING REWRITTEN';
  if (di >= 50) return 'AUTOMATION IS ALREADY HERE';
  if (di >= 30) return 'THE WINDOW IS CLOSING';
  return 'RARE. STAY THIS WAY.';
}

/** CHANGE 1: First-person FOMO headlines */
function getHeadline(di: number): string {
  if (di >= 70) return 'My job is being automated faster than I thought.';
  if (di >= 50) return 'Half of what I do daily is already automated.';
  if (di >= 30) return 'AI is already inside my role. I checked.';
  return 'I checked my AI displacement score. You should too.';
}

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
  return { score, role, industry, aiExposure, humanEdge, salaryBleedMonthly, salaryDropPct, monthsRemaining, deadSkills, topTask, topTaskPct, tools };
}

type CardData = ReturnType<typeof useCardData>;

type StatBlock = { value: string; label: string };

/** Build all stats, then split into hero + rest */
function buildStatsWithHero(data: CardData): { hero: StatBlock; rest: StatBlock[] } {
  const { deadSkills, monthsRemaining, salaryBleedMonthly, salaryDropPct, humanEdge } = data;
  const all: StatBlock[] = [];

  if (monthsRemaining)
    all.push({ value: `${monthsRemaining} mo`, label: 'UNTIL DISRUPTION' });
  if (deadSkills.length > 0)
    all.push({ value: `${deadSkills.length} tasks`, label: 'BEING REPLACED' });
  if (salaryBleedMonthly && salaryBleedMonthly >= 8000) {
    all.push({ value: `₹${Math.round(salaryBleedMonthly / 1000)}K/mo`, label: 'MONTHLY LOSS' });
  } else if (salaryDropPct > 0) {
    all.push({ value: `${salaryDropPct}%`, label: 'SALARY AT RISK' });
  }
  if (humanEdge > 0 && humanEdge < 100)
    all.push({ value: `${humanEdge}%`, label: 'STILL YOURS' });

  if (all.length === 0) {
    return { hero: { value: '—', label: 'NO DATA' }, rest: [] };
  }

  // Pick hero: months<36 first, then tasks, then salary, then humanEdge<40
  let heroIdx = 0;
  if (monthsRemaining && monthsRemaining <= 36) {
    heroIdx = all.findIndex(s => s.label === 'UNTIL DISRUPTION');
  } else if (monthsRemaining && monthsRemaining > 48 && deadSkills.length > 0) {
    heroIdx = all.findIndex(s => s.label === 'BEING REPLACED');
  } else if (deadSkills.length === 0) {
    const salIdx = all.findIndex(s => s.label === 'SALARY AT RISK' || s.label === 'MONTHLY LOSS');
    if (salIdx >= 0) heroIdx = salIdx;
  }
  if (heroIdx < 0) heroIdx = 0;

  const hero = all[heroIdx];
  const rest = all.filter((_, i) => i !== heroIdx);
  return { hero, rest };
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = '"Courier New", Courier, monospace';

// ── Shared sub-components for both capture targets ──

/** AI Exposure bar (CHANGE 3) */
function ExposureBarInline({ di, scoreColor, style }: { di: number; scoreColor: string; style?: React.CSSProperties }) {
  return (
    <div style={{ width: '100%', marginTop: 24, ...style }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
        AI EXPOSURE
      </span>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ width: `${di}%`, height: '100%', borderRadius: 4, background: scoreColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{di}% automated</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{100 - di}% human</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — hidden 1200×630 (landscape)
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getScoreColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next 2-3 years';
  const roleStr = role || 'your role';

  return (
    <div ref={innerRef as React.RefObject<HTMLDivElement>} style={{ position: 'absolute', left: -9999, top: -9999, width: 1200, height: 630, background: '#080810', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* LEFT PANEL (38%) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '38%', height: '100%', background: `${scoreColor}14`, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px 32px 32px', boxSizing: 'border-box' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: scoreColor, letterSpacing: '0.1em', textTransform: 'uppercase', position: 'absolute', top: 32, left: 32, whiteSpace: 'nowrap' }}>AI DISPLACEMENT REPORT</span>
        <span style={{ fontSize: 200, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{score}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 18, maxWidth: 340 }}>{tierLabel}</span>
        <div style={{ width: 60, height: 1, background: `${scoreColor}88`, margin: '16px 0' }} />
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{role}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 4 }}>{industry}</span>
        {/* CHANGE 3: Threat bar */}
        <ExposureBarInline di={aiExposure} scoreColor={scoreColor} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', position: 'absolute', bottom: 24, left: 32 }}>{dateStr}</span>
      </div>

      {/* RIGHT PANEL (62%) */}
      <div style={{ position: 'absolute', left: '38%', top: 0, width: '62%', height: 578, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* Headline */}
        <div style={{ flex: '0 0 40%', padding: '40px 48px 16px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>{headline}</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.6, maxWidth: 440, fontWeight: 500 }}>
            {aiExposure}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
          </span>
        </div>

        {/* CHANGE 2: Hero stat + smaller rest */}
        <div style={{ flex: 1, padding: '0 48px 24px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {/* Hero stat */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${scoreColor}`, borderRadius: 6, padding: '28px 28px 24px' }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, display: 'block' }}>{hero.value}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>{hero.label}</span>
          </div>
          {/* Rest stats row */}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length}, 1fr)`, gap: 12 }}>
              {rest.map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderTop: `2px solid ${scoreColor}66`, borderRadius: 4, padding: '16px 16px 14px' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6, display: 'block' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CHANGE 4: Bottom strip with score-color CTA */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 52, padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {topTask && topTaskPct ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{topTask}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>→ jobbachao.ai</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CaptureTargetSquare — hidden 1080×1080 (CHANGE 6)
// ═══════════════════════════════════════════════════════════════
function CaptureTargetSquare({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getScoreColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next 2-3 years';
  const roleStr = role || 'your role';

  return (
    <div ref={innerRef as React.RefObject<HTMLDivElement>} style={{ position: 'absolute', left: -9999, top: -9999, width: 1080, height: 1080, background: '#080810', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* TOP PANEL — score + identity (400px) */}
      <div style={{ height: 400, background: `${scoreColor}14`, padding: '36px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: scoreColor, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>AI DISPLACEMENT REPORT</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 8 }}>
          <span style={{ fontSize: 180, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{score}</span>
          <div style={{ paddingBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block' }}>{tierLabel}</span>
            <div style={{ width: 50, height: 1, background: `${scoreColor}88`, margin: '12px 0' }} />
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'block' }}>{role}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', display: 'block', marginTop: 4 }}>{industry}</span>
          </div>
        </div>
        <ExposureBarInline di={aiExposure} scoreColor={scoreColor} style={{ marginTop: 20 }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{dateStr}</span>
      </div>

      {/* BOTTOM PANEL — headline + stats (680px) */}
      <div style={{ height: 628, padding: '32px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>{headline}</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 1.6, maxWidth: 500, fontWeight: 500 }}>
          {aiExposure}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
        </span>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${scoreColor}`, borderRadius: 6, padding: '28px 28px 24px' }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, display: 'block' }}>{hero.value}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>{hero.label}</span>
          </div>
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length}, 1fr)`, gap: 12 }}>
              {rest.map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderTop: `2px solid ${scoreColor}66`, borderRadius: 4, padding: '16px 16px 14px' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6, display: 'block' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 52, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {topTask && topTaskPct ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{topTask}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>→ jobbachao.ai</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CardPreviewVisible — responsive in-page preview
// ═══════════════════════════════════════════════════════════════
function CardPreviewVisible({ data }: { data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getScoreColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next 2-3 years';
  const roleStr = role || 'your role';

  return (
    <div className="rounded-xl overflow-hidden border border-border/40" style={{ background: '#080810' }}>
      <div className="flex flex-col sm:flex-row">
        {/* LEFT PANEL */}
        <div className="sm:w-[38%] w-full py-8 px-6 flex flex-col items-start justify-center" style={{ background: `${scoreColor}14` }}>
          <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.1em] uppercase whitespace-nowrap" style={{ color: scoreColor, fontFamily: FONT_MONO }}>AI DISPLACEMENT REPORT</span>
          <span className="text-[80px] sm:text-[100px] font-black leading-[0.85] tracking-tighter mt-2" style={{ color: scoreColor }}>{score}</span>
          <span className="text-[10px] sm:text-[12px] font-extrabold tracking-[0.15em] uppercase mt-3" style={{ color: 'rgba(255,255,255,0.9)' }}>{tierLabel}</span>
          <div className="w-10 h-px my-3" style={{ background: `${scoreColor}88` }} />
          <span className="text-xs sm:text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{role}</span>
          <span className="text-[10px] sm:text-xs italic mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{industry}</span>
          {/* CHANGE 3: Exposure bar */}
          <div className="w-full mt-5">
            <span className="text-[8px] font-bold tracking-[0.15em] uppercase block mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>AI EXPOSURE</span>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: `${aiExposure}%`, background: scoreColor }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{aiExposure}% automated</span>
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{100 - aiExposure}% human</span>
            </div>
          </div>
          <span className="text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{dateStr}</span>
        </div>

        {/* RIGHT PANEL */}
        <div className="sm:w-[62%] w-full p-5 sm:p-6 flex flex-col gap-3">
          <div>
            <p className="text-base sm:text-lg font-extrabold leading-snug" style={{ color: '#FFFFFF' }}>{headline}</p>
            <p className="text-xs mt-2 leading-relaxed font-medium" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 400 }}>
              {aiExposure}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
            </p>
          </div>

          {/* CHANGE 2: Hero stat */}
          <div className="rounded-md p-4" style={{ background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${scoreColor}` }}>
            <span className="text-3xl sm:text-4xl font-black block" style={{ color: '#FFFFFF' }}>{hero.value}</span>
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase block mt-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{hero.label}</span>
          </div>

          {/* Smaller stats row */}
          {rest.length > 0 && (
            <div className={`grid gap-2 grid-cols-${rest.length}`} style={{ gridTemplateColumns: `repeat(${rest.length}, 1fr)` }}>
              {rest.map((s, i) => (
                <div key={i} className="rounded p-2.5 sm:p-3" style={{ background: 'rgba(255,255,255,0.03)', borderTop: `2px solid ${scoreColor}66` }}>
                  <span className="text-base sm:text-lg font-extrabold block" style={{ color: '#FFFFFF' }}>{s.value}</span>
                  <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.1em] uppercase block mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CHANGE 4: Bottom strip with score-color CTA */}
      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-1.5">
          {topTask && topTaskPct ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: scoreColor }} />
              <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{topTask}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span className="text-sm font-extrabold" style={{ color: scoreColor }}>→ jobbachao.ai</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export default function ShareableScoreCard({ report }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const squareRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [capturing, setCapturing] = useState<'landscape' | 'square' | null>(null);
  const [copied, setCopied] = useState(false);

  const data = useCardData(report);
  const { score, role, aiExposure, monthsRemaining } = data;

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  const monthsStr = monthsRemaining ? `${monthsRemaining} months` : 'the next few years';
  const shareText = `I just ran my AI displacement report.\nMy score: ${score}/100. ${aiExposure}% of my role is being automated.\nI have ${monthsStr} before it hits my compensation.\n\nCheck yours (it's free): jobbachao.ai\n\n#AIDisplacement #FutureOfWork #CareerRisk`;

  const captureCard = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, w: number, h: number, suffix: string) => {
    if (!ref.current) return;
    setCapturing(suffix === '' ? 'landscape' : 'square');
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!mountedRef.current) return;
      const canvas = await html2canvas(ref.current, { backgroundColor: '#080810', scale: 2, useCORS: true, logging: false, width: w, height: h });
      if (!mountedRef.current) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-score-${score}-${safeFileName(role)}${suffix}.png`;
      a.click();
      toast.success('Your report card is ready.', { description: 'Share it — most people have no idea their score is this high.', duration: 5000 });

      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          const file = new File([blob], `ai-score-${score}-${safeFileName(role)}${suffix}.png`, { type: 'image/png' });
          await navigator.share({ title: `My AI Displacement Score: ${score}/100`, text: shareText, files: [file] });
        } catch { /* cancelled */ }
      }
    } catch {
      toast.error("Auto-capture failed. Screenshot this screen and share it — it works just as well.");
    } finally {
      if (mountedRef.current) setCapturing(null);
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
      {/* Hidden capture targets */}
      <CaptureTarget innerRef={cardRef} data={data} />
      <CaptureTargetSquare innerRef={squareRef} data={data} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card overflow-hidden p-5 space-y-4"
      >
        {/* Preview */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Your shareable report card</p>
          <CardPreviewVisible data={data} />
        </div>

        {/* CHANGE 5: Dare line */}
        <p className="text-xs text-center italic" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Most people who see this card check their own score within 24 hours.
        </p>

        {/* CHANGE 6: Two download buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => captureCard(cardRef, 1200, 630, '')}
            disabled={capturing !== null}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-foreground text-background font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
          >
            {capturing === 'landscape' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            LinkedIn (landscape)
          </button>
          <button
            type="button"
            onClick={() => captureCard(squareRef, 1080, 1080, '-square')}
            disabled={capturing !== null}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-foreground text-background font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
          >
            {capturing === 'square' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            WhatsApp (square)
          </button>
        </div>

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
