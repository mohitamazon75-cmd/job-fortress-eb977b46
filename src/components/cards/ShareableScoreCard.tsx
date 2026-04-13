/**
 * ShareableScoreCard — Viral career risk report card (v11)
 *
 * AUDIT HARDENING:
 * - Months: null-safe, converts >24 to years format
 * - DI: null→50, 0→"< 5%", 100→"95+"
 * - Tasks: null/0 hidden, capped at 8+
 * - Salary: null/0/negative hidden, capped at 60%+
 * - "Still yours": only shown if 20-85%
 * - Role/industry: fallback chains, truncation, filename sanitization
 * - Hero stat: graceful degradation for all-null data
 *
 * COLOR SEPARATION (intentional):
 *   - Score NUMBER color = from composite stability score (getCompositeColor)
 *   - Tier label + headline = from determinism_index (DI)
 *   These are SEPARATE scales and can differ. A user can have
 *   a green composite score (safe overall) but orange DI (moderate exposure).
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

// ── Utility: clamp a value between min and max ──
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Utility: safe string sanitization ──
function sanitize(str: string | null | undefined, maxLen = 60): string {
  if (!str) return '';
  return str.replace(/[\x00-\x1f\x7f\r\n\t]/g, ' ').replace(/[<>"']/g, '').trim().substring(0, maxLen);
}

// ── Utility: filename-safe string ──
// Handles: special chars, spaces, non-ASCII (Hindi etc), very long strings
// Max total filename length controlled by caller (50 chars max for role portion)
function safeFileName(str: string | null | undefined): string {
  if (!str) return 'career';
  return str
    .replace(/[^\w\s-]/g, '')  // strip non-word chars (removes non-ASCII)
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')    // collapse multiple dashes into one
    .replace(/^-+|-+$/g, '')   // trim leading/trailing dashes
    .toLowerCase()
    .substring(0, 50) || 'career';
}

// ── Utility: format months for display ──
// Under 24 → "X months" (urgent, keep specific)
// 24-35 → "2 yrs", 36-47 → "3 yrs", etc.
// 60+ → "5+ yrs"
// null/undefined/0 → null (caller must handle)
function formatMonths(months: number | null | undefined): string | null {
  if (months == null || months <= 0) return null;
  if (months < 24) return `${months} months`;
  if (months < 36) return '2 yrs';
  if (months < 48) return '3 yrs';
  if (months < 60) return '4 yrs';
  return '5+ yrs';
}

// Short format for stat blocks
function formatMonthsStat(months: number | null | undefined): string | null {
  if (months == null || months <= 0) return null;
  if (months < 24) return `${months} mo`;
  if (months < 36) return '2 yrs';
  if (months < 48) return '3 yrs';
  if (months < 60) return '4 yrs';
  return '5+ yrs';
}

// ── Score color from COMPOSITE stability score ──
// composite >= 70 → green (safe)
// composite 40-69 → orange (mid-risk)
// composite < 40 → red (high risk)
function getCompositeColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

// ── DI-based tier label (from determinism_index, NOT composite) ──
function getTierLabel(di: number): string {
  if (di >= 70) return 'YOUR ROLE IS BEING REWRITTEN';
  if (di >= 50) return 'AUTOMATION IS ALREADY HERE';
  if (di >= 30) return 'THE WINDOW IS CLOSING';
  return 'RARE. STAY THIS WAY.';
}

// ── DI-based headline (first-person FOMO for viewers) ──
function getHeadline(di: number): string {
  if (di >= 70) return 'My job is being automated faster than I thought.';
  if (di >= 50) return 'Half of what I do daily is already automated.';
  if (di >= 30) return 'AI is already inside my role. I checked.';
  return 'I checked my AI displacement score. You should too.';
}

// ── Format DI for display (handles 0 and 100 edge cases) ──
function formatDI(di: number): string {
  if (di <= 0) return '< 5';
  if (di >= 100) return '95+';
  return `${di}`;
}

function useCardData(report: ScanReport) {
  const score = computeStabilityScore(report);

  // Role fallback chain: matched_job_family → role → agent1.current_role → "Professional"
  const rawRole = report.matched_job_family
    || report.role
    || (report as any).agent_1_disruption?.current_role
    || 'Professional';
  const role = sanitize(rawRole, 50);

  // Industry fallback
  const rawIndustry = report.industry || null;
  const industry = rawIndustry ? sanitize(rawIndustry, 40) : null;

  // DI: null/undefined → 50 (honest mid-risk default)
  const rawDI = report.determinism_index;
  const aiExposure = rawDI != null ? clamp(Math.round(rawDI), 0, 100) : 50;
  const diIsDefault = rawDI == null;

  // "Still yours" = 100 - DI, but only meaningful in 20-85% range
  const humanEdgeRaw = Math.max(0, 100 - aiExposure);

  // Salary logic
  const salaryBleedMonthly = (report.salary_bleed_monthly != null && report.salary_bleed_monthly > 0)
    ? report.salary_bleed_monthly : null;
  const rawSalaryDropPct = report.career_shock_simulator?.salary_drop_percentage
    ?? (report.score_breakdown?.salary_bleed_breakdown?.final_rate
      ? Math.round(report.score_breakdown.salary_bleed_breakdown.final_rate * 100)
      : Math.round(aiExposure * 0.4));
  // Validate: null/0/negative → null; cap at 60
  const salaryDropPct = (rawSalaryDropPct != null && rawSalaryDropPct > 0)
    ? Math.min(60, rawSalaryDropPct) : null;

  // Months: null-safe
  const monthsRemaining = (report.months_remaining != null && report.months_remaining > 0)
    ? report.months_remaining : null;

  // Dead skills: null-safe, cap display at 8
  const deadSkills = report.execution_skills_dead || [];
  const taskCount = deadSkills.length > 0 ? Math.min(deadSkills.length, 8) : 0;
  const taskCountDisplay = deadSkills.length > 8 ? '8+' : `${taskCount}`;

  // Top task: deterministic % based on DI (not random)
  const topTask = deadSkills[0] ? sanitize(deadSkills[0], 35) : null;
  const topTaskPct = topTask ? Math.min(95, aiExposure + 15) : null;

  const tools = normalizeTools(report.ai_tools_replacing || []);

  return {
    score, role, industry, aiExposure, diIsDefault,
    humanEdgeRaw, salaryBleedMonthly, salaryDropPct,
    monthsRemaining, deadSkills, taskCount, taskCountDisplay,
    topTask, topTaskPct, tools,
  };
}

type CardData = ReturnType<typeof useCardData>;

type StatBlock = { value: string; label: string };

/**
 * Build stats array, filtering out any with null/invalid data.
 * Then split into hero (most alarming) + rest.
 *
 * Hero priority:
 * 1. months_remaining (if under 36) — most visceral
 * 2. tasks being replaced — concrete
 * 3. salary at risk % — financial fear
 * 4. still yours % (only if under 40%) — alarming
 * 5. DI % as fallback hero if everything else is missing
 */
function buildStatsWithHero(data: CardData): { hero: StatBlock; rest: StatBlock[] } {
  const { monthsRemaining, taskCount, taskCountDisplay, salaryBleedMonthly,
    salaryDropPct, humanEdgeRaw, aiExposure } = data;

  const all: StatBlock[] = [];

  // Months stat — only if we have valid data
  const monthsStat = formatMonthsStat(monthsRemaining);
  if (monthsStat) {
    all.push({ value: monthsStat, label: 'ACT BY' });
  }

  // Tasks stat — only if > 0
  if (taskCount > 0) {
    all.push({ value: `${taskCountDisplay} tasks`, label: 'BEING REPLACED' });
  }

  // Salary stat
  if (salaryBleedMonthly && salaryBleedMonthly >= 8000) {
    all.push({ value: `₹${Math.round(salaryBleedMonthly / 1000)}K/mo`, label: 'MONTHLY LOSS' });
  } else if (salaryDropPct && salaryDropPct > 0) {
    const displayPct = salaryDropPct >= 60 ? '60%+' : `${salaryDropPct}%`;
    all.push({ value: displayPct, label: 'SALARY AT RISK' });
  }

  // "Still Yours" — show if between 20-90%
  // For safe users (DI < 30): always show if fewer than 2 stats available
  const isSafeTier = aiExposure < 30;
  const stillYoursInRange = humanEdgeRaw >= 20 && humanEdgeRaw <= 90;
  const needsStillYoursForMinStats = isSafeTier && all.length < 2 && humanEdgeRaw > 0;
  if (stillYoursInRange || needsStillYoursForMinStats) {
    all.push({ value: `${humanEdgeRaw}%`, label: 'STILL YOURS' });
  }

  // Graceful degradation: if NO stats at all, use DI as the only stat
  if (all.length === 0) {
    return {
      hero: { value: `${formatDI(aiExposure)}%`, label: 'AI EXPOSURE' },
      rest: [],
    };
  }

  // Pick hero by alarm priority
  let heroIdx = 0;
  if (monthsRemaining && monthsRemaining <= 36) {
    const idx = all.findIndex(s => s.label === 'ACT BY');
    if (idx >= 0) heroIdx = idx;
  } else if (taskCount > 0 && (!monthsRemaining || monthsRemaining > 48)) {
    const idx = all.findIndex(s => s.label === 'BEING REPLACED');
    if (idx >= 0) heroIdx = idx;
  } else if (taskCount === 0 && salaryDropPct && salaryDropPct > 0) {
    const idx = all.findIndex(s => s.label === 'SALARY AT RISK' || s.label === 'MONTHLY LOSS');
    if (idx >= 0) heroIdx = idx;
  } else if (humanEdgeRaw < 40 && humanEdgeRaw >= 20) {
    const idx = all.findIndex(s => s.label === 'STILL YOURS');
    if (idx >= 0) heroIdx = idx;
  }

  const hero = all[heroIdx];
  const rest = all.filter((_, i) => i !== heroIdx);
  return { hero, rest };
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = '"Courier New", Courier, monospace';

// ── Truncated role for card display (max ~40 chars with ellipsis) ──
function truncateRole(role: string, max = 40): string {
  if (role.length <= max) return role;
  return role.substring(0, max - 1) + '…';
}

// ── Shared sub-components ──

function ExposureBarInline({ di, scoreColor, style }: { di: number; scoreColor: string; style?: React.CSSProperties }) {
  const diDisplay = formatDI(di);
  const humanDisplay = di >= 100 ? '< 5' : di <= 0 ? '95+' : `${100 - di}`;
  return (
    <div style={{ width: '100%', marginTop: 24, ...style }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
        AI EXPOSURE
      </span>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ width: `${clamp(di, 2, 98)}%`, height: '100%', borderRadius: 4, background: scoreColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{diDisplay}% automated</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{humanDisplay}% human</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CaptureTarget — hidden 1200×630 (landscape)
// ═══════════════════════════════════════════════════════════════
function CaptureTarget({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getCompositeColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = formatMonths(monthsRemaining) || 'the next 2–3 years';
  const roleStr = role || 'your role';
  const industryStr = industry || 'your industry';
  const diDisplay = formatDI(aiExposure);
  const displayRole = truncateRole(role || 'Professional', 40);
  const topTaskName = topTask || 'Core execution tasks';

  return (
    <div ref={innerRef as React.RefObject<HTMLDivElement>} style={{ position: 'absolute', left: -9999, top: -9999, width: 1200, height: 630, background: '#080810', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* LEFT PANEL (38%) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '38%', height: '100%', background: `${scoreColor}14`, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px 32px 32px', boxSizing: 'border-box' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: scoreColor, letterSpacing: '0.1em', textTransform: 'uppercase', position: 'absolute', top: 32, left: 32, whiteSpace: 'nowrap' }}>AI DISPLACEMENT REPORT</span>
        <span style={{ fontSize: 200, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{score}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 18, maxWidth: 340 }}>{tierLabel}</span>
        <div style={{ width: 60, height: 1, background: `${scoreColor}88`, margin: '16px 0' }} />
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }}>{displayRole}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 4 }}>{industryStr}</span>
        <ExposureBarInline di={aiExposure} scoreColor={scoreColor} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', position: 'absolute', bottom: 24, left: 32 }}>{dateStr}</span>
      </div>

      {/* RIGHT PANEL (62%) */}
      <div style={{ position: 'absolute', left: '38%', top: 0, width: '62%', height: 578, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ flex: '0 0 40%', padding: '40px 48px 16px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>{headline}</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.6, maxWidth: 440, fontWeight: 500 }}>
            {diDisplay}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
          </span>
        </div>

        <div style={{ flex: 1, padding: '0 48px 24px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
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
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 52, padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {topTaskPct ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{topTaskName}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>→ jobbachao.com</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CaptureTargetSquare — hidden 1080×1080
// ═══════════════════════════════════════════════════════════════
function CaptureTargetSquare({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getCompositeColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = formatMonths(monthsRemaining) || 'the next 2–3 years';
  const roleStr = role || 'your role';
  const industryStr = industry || 'your industry';
  const diDisplay = formatDI(aiExposure);
  const displayRole = truncateRole(role || 'Professional', 40);
  const topTaskName = topTask || 'Core execution tasks';

  return (
    <div ref={innerRef as React.RefObject<HTMLDivElement>} style={{ position: 'absolute', left: -9999, top: -9999, width: 1080, height: 1080, background: '#080810', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* TOP PANEL (400px) */}
      <div style={{ height: 400, background: `${scoreColor}14`, padding: '36px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, color: scoreColor, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>AI DISPLACEMENT REPORT</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 8 }}>
          <span style={{ fontSize: 180, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{score}</span>
          <div style={{ paddingBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block' }}>{tierLabel}</span>
            <div style={{ width: 50, height: 1, background: `${scoreColor}88`, margin: '12px 0' }} />
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{displayRole}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', display: 'block', marginTop: 4 }}>{industryStr}</span>
          </div>
        </div>
        <ExposureBarInline di={aiExposure} scoreColor={scoreColor} style={{ marginTop: 20 }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{dateStr}</span>
      </div>

      {/* BOTTOM PANEL (628px) */}
      <div style={{ height: 628, padding: '32px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>{headline}</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 1.6, maxWidth: 500, fontWeight: 500 }}>
          {diDisplay}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
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
          {topTaskPct ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{topTaskName}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>→ jobbachao.com</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CardPreviewVisible — responsive in-page preview
// ═══════════════════════════════════════════════════════════════
function CardPreviewVisible({ data }: { data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getCompositeColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = formatMonths(monthsRemaining) || 'the next 2–3 years';
  const roleStr = role || 'your role';
  const industryStr = industry || 'your industry';
  const diDisplay = formatDI(aiExposure);
  const displayRole = truncateRole(role || 'Professional', 40);
  const topTaskName = topTask || 'Core execution tasks';

  return (
    <div className="rounded-xl overflow-hidden border border-border/40" style={{ background: '#080810' }}>
      <div className="flex flex-col sm:flex-row">
        {/* LEFT PANEL */}
        <div className="sm:w-[38%] w-full py-8 px-6 flex flex-col items-start justify-center" style={{ background: `${scoreColor}14` }}>
          <span className="text-[7px] sm:text-[8px] font-bold tracking-[0.1em] uppercase whitespace-nowrap" style={{ color: scoreColor, fontFamily: FONT_MONO }}>AI DISPLACEMENT REPORT</span>
          <span className="text-[80px] sm:text-[100px] font-black leading-[0.85] tracking-tighter mt-2" style={{ color: scoreColor }}>{score}</span>
          <span className="text-[10px] sm:text-[12px] font-extrabold tracking-[0.15em] uppercase mt-3" style={{ color: 'rgba(255,255,255,0.9)' }}>{tierLabel}</span>
          <div className="w-10 h-px my-3" style={{ background: `${scoreColor}88` }} />
          <span className="text-xs sm:text-sm font-medium truncate max-w-full block" style={{ color: 'rgba(255,255,255,0.85)' }}>{displayRole}</span>
          <span className="text-[10px] sm:text-xs italic mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{industryStr}</span>
          {/* Exposure bar */}
          <div className="w-full mt-5">
            <span className="text-[8px] font-bold tracking-[0.15em] uppercase block mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>AI EXPOSURE</span>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: `${clamp(aiExposure, 2, 98)}%`, background: scoreColor }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{diDisplay}% automated</span>
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{aiExposure >= 100 ? '< 5' : aiExposure <= 0 ? '95+' : `${100 - aiExposure}`}% human</span>
            </div>
          </div>
          <span className="text-[9px] mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{dateStr}</span>
        </div>

        {/* RIGHT PANEL */}
        <div className="sm:w-[62%] w-full p-5 sm:p-6 flex flex-col gap-3">
          <div>
            <p className="text-base sm:text-lg font-extrabold leading-snug" style={{ color: '#FFFFFF' }}>{headline}</p>
            <p className="text-xs mt-2 leading-relaxed font-medium" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 400 }}>
              {diDisplay}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
            </p>
          </div>

          <div className="rounded-md p-4" style={{ background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${scoreColor}` }}>
            <span className="text-3xl sm:text-4xl font-black block" style={{ color: '#FFFFFF' }}>{hero.value}</span>
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase block mt-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{hero.label}</span>
          </div>

          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length}, 1fr)`, gap: 8 }}>
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

      {/* Bottom strip */}
      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-1.5">
          {topTaskPct ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: scoreColor }} />
              <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{topTaskName}: {topTaskPct}% automated</span>
            </>
          ) : <span />}
        </div>
        <span className="text-sm font-extrabold" style={{ color: scoreColor }}>→ jobbachao.com</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CaptureTargetPortrait — hidden 1080×1920 (story format)
// ═══════════════════════════════════════════════════════════════
function CaptureTargetPortrait({ innerRef, data }: { innerRef: React.RefObject<HTMLDivElement | null>; data: CardData }) {
  const { score, role, industry, aiExposure, monthsRemaining, topTask, topTaskPct } = data;
  const scoreColor = getCompositeColor(score);
  const tierLabel = getTierLabel(aiExposure);
  const headline = getHeadline(aiExposure);
  const { hero, rest } = buildStatsWithHero(data);
  const monthsStr = formatMonths(monthsRemaining) || 'the next 2–3 years';
  const roleStr = role || 'your role';
  const industryStr = industry || 'your industry';
  const diDisplay = formatDI(aiExposure);
  const displayRole = truncateRole(role || 'Professional', 35);

  // Combine hero + rest into a flat array for 2x2 grid
  const allStats = [hero, ...rest].slice(0, 4);
  // Pad to even number for grid
  while (allStats.length < 2) allStats.push({ value: `${diDisplay}%`, label: 'AI EXPOSURE' });

  return (
    <div ref={innerRef as React.RefObject<HTMLDivElement>} style={{ position: 'absolute', left: -9999, top: -9999, width: 1080, height: 1920, background: '#080810', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%, rgba(239,68,68,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* TOP ZONE — score + identity (640px) */}
      <div style={{ height: 640, background: `${scoreColor}14`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', boxSizing: 'border-box' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: scoreColor, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>AI DISPLACEMENT REPORT</span>
        <span style={{ fontSize: 280, fontWeight: 900, color: scoreColor, lineHeight: 0.85, letterSpacing: '-0.04em', marginTop: 8 }}>{score}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 24, textAlign: 'center' }}>{tierLabel}</span>
        <div style={{ width: 60, height: 1, background: `${scoreColor}88`, margin: '20px 0' }} />
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{displayRole}</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 6, textAlign: 'center' }}>{industryStr}</span>
      </div>

      {/* MIDDLE ZONE — headline + stats (860px) */}
      <div style={{ height: 860, padding: '48px 64px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, textAlign: 'center', maxWidth: 900 }}>{headline}</span>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginTop: 24, lineHeight: 1.6, maxWidth: 800, textAlign: 'center', fontWeight: 500 }}>
          {diDisplay}% of {roleStr} tasks are being automated. You have {monthsStr} before it hits your pay.
        </span>

        {/* 2x2 stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 48, width: '100%', maxWidth: 800 }}>
          {allStats.map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${scoreColor}`, borderRadius: 8, padding: '32px 24px 28px', textAlign: 'center', minHeight: 120 }}>
              <span style={{ fontSize: i === 0 ? 56 : 48, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, display: 'block' }}>{s.value}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 12, display: 'block' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM ZONE — CTA (420px) */}
      <div style={{ height: 420, background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', boxSizing: 'border-box' }}>
        {/* AI Exposure bar */}
        <div style={{ width: '100%', maxWidth: 800 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8, textAlign: 'center' }}>AI EXPOSURE</span>
          <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ width: `${clamp(aiExposure, 2, 98)}%`, height: '100%', borderRadius: 5, background: scoreColor }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{diDisplay}% automated</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{aiExposure >= 100 ? '< 5' : aiExposure <= 0 ? '95+' : `${100 - aiExposure}`}% human</span>
          </div>
        </div>

        <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor, marginTop: 48, textAlign: 'center' }}>→ jobbachao.com</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 12, textAlign: 'center' }}>Check your AI displacement score</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16, textAlign: 'center' }}>#AIDisplacement #FutureOfWork</span>
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
  const portraitRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const hasDownloadedRef = useRef(false);
  const nudgeDismissedRef = useRef(false);
  const [capturing, setCapturing] = useState<'landscape' | 'square' | 'portrait' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  const data = useCardData(report);
  const { score, role, aiExposure, monthsRemaining } = data;
  const scoreColor = getCompositeColor(score);

  useEffect(() => { return () => { mountedRef.current = false }; }, []);

  // Timed nudge: show after 12s if no download triggered
  useEffect(() => {
    const showTimer = setTimeout(() => {
      if (!mountedRef.current || hasDownloadedRef.current || nudgeDismissedRef.current) return;
      setShowNudge(true);
    }, 12000);
    return () => clearTimeout(showTimer);
  }, []);

  // Auto-dismiss nudge after 8s
  useEffect(() => {
    if (!showNudge) return;
    const hideTimer = setTimeout(() => {
      if (mountedRef.current) setShowNudge(false);
    }, 8000);
    return () => clearTimeout(hideTimer);
  }, [showNudge]);

  // Share text: use natural language for edge DI values (not "< 5%" or "95+%")
  const shareTextDI = aiExposure <= 5 ? 'Less than 5%' : aiExposure >= 95 ? 'Over 95%' : `${aiExposure}%`;
  const _diDisplay = formatDI(aiExposure); // used by sub-components via data prop
  const monthsStr = formatMonths(monthsRemaining) || 'the next few years';
  const shareText = `I just ran my AI displacement report.\nMy score: ${score}/100. ${shareTextDI} of my role is being automated.\nI have ${monthsStr} before it hits my compensation.\n\nCheck yours (it's free): jobbachao.com\n\n#AIDisplacement #FutureOfWork #CareerRisk`;

  const captureCard = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, w: number, h: number, suffix: string) => {
    if (!ref.current) return;
    hasDownloadedRef.current = true;
    setShowNudge(false);
    setCapturing(suffix === '' ? 'landscape' : suffix === '-square' ? 'square' : 'portrait');
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!mountedRef.current) return;
      const opts: Record<string, unknown> = { backgroundColor: '#080810', scale: 2, useCORS: true, logging: false, width: w, height: h };
      // Portrait cards are very tall — hint html2canvas to avoid clipping
      if (h > 1200) { opts.windowWidth = w; opts.windowHeight = h; }
      const canvas = await html2canvas(ref.current, opts);
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

  const dismissNudge = useCallback(() => {
    nudgeDismissedRef.current = true;
    setShowNudge(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Hidden capture targets */}
      <CaptureTarget innerRef={cardRef} data={data} />
      <CaptureTargetSquare innerRef={squareRef} data={data} />
      <CaptureTargetPortrait innerRef={portraitRef} data={data} />

      {/* Timed nudge banner */}
      {showNudge && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-xl overflow-hidden flex items-center gap-3 px-4 py-3"
          style={{ background: '#0C0C18', borderLeft: `4px solid ${scoreColor}` }}
        >
          <span className="text-sm flex-1">
            <span className="mr-1.5">📊</span>
            <span className="font-semibold text-foreground">Your displacement card is ready to share</span>
          </span>
          <button
            type="button"
            onClick={() => captureCard(cardRef, 1200, 630, '')}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${scoreColor}22`, color: scoreColor }}
          >
            Generate My Card →
          </button>
          <button
            type="button"
            onClick={dismissNudge}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-sm leading-none p-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </motion.div>
      )}

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

        {/* Dare line */}
        <p className="text-xs text-center italic" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Most people who see this card check their own score within 24 hours.
        </p>

        {/* Three download buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => captureCard(cardRef, 1200, 630, '')}
            disabled={capturing !== null}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-foreground text-background font-bold text-[11px] hover:opacity-90 transition-all disabled:opacity-50"
          >
            {capturing === 'landscape' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
            LinkedIn
          </button>
          <button
            type="button"
            onClick={() => captureCard(squareRef, 1080, 1080, '-square')}
            disabled={capturing !== null}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-foreground text-background font-bold text-[11px] hover:opacity-90 transition-all disabled:opacity-50"
          >
            {capturing === 'square' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => captureCard(portraitRef, 1080, 1920, '-story')}
            disabled={capturing !== null}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-foreground text-background font-bold text-[11px] hover:opacity-90 transition-all disabled:opacity-50"
          >
            {capturing === 'portrait' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
            Story
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
