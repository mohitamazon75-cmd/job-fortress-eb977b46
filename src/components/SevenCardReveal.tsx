/**
 * SevenCardReveal — Unified 7-card experience
 *
 * Replaces the split Model A (dossier) → Model B (7 cards) choice.
 * Uses Model A's deterministic, KG-anchored data in Model B's proven
 * swipeable card format with Fear → Tough Love → Hope arc.
 *
 * Cards:
 *   1. Risk Mirror    — Score + urgency_horizon + confrontation line (FEAR)
 *   2. Skills vs AI   — Dead skills vs moat skills, Doom Clock (FEAR → PIVOT)
 *   3. Skill Shield   — cognitive_moat + moat_narrative (HOPE RECOVERY)
 *   4. Your Market    — Salary vs market, posting trend (CONTEXT + LOSS)
 *   5. Pivot Path     — Specific role, ₹ uplift, transferable skill (ACTION)
 *   6. Blind Spots    — free_advice + skill gaps, tough love (ACCOUNTABILITY)
 *   7. Your 90-Day Mission — immediate_next_step + coach opt-in (HOPE + CLOSE)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScanReport } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { getVerbatimRole } from '@/lib/role-guard';
import { detectPersona, getPersonaConfig } from '@/lib/persona-detect';
import '@/styles/model-b-tokens.css';

// ── Design system from Model B (reused) ──────────────────────────
function Badge({ label, variant = 'amber' }: { label: string; variant?: 'amber' | 'navy' | 'green' | 'red' | 'teal' }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    amber: { bg: 'var(--mb-amber-tint)', color: 'var(--mb-amber)', border: 'rgba(139,90,0,0.25)' },
    navy:  { bg: 'var(--mb-navy-tint)',  color: 'var(--mb-navy)',  border: 'var(--mb-navy-tint2)' },
    green: { bg: 'var(--mb-green-tint)', color: 'var(--mb-green)', border: 'rgba(26,107,60,0.25)' },
    red:   { bg: 'var(--mb-red-tint)',   color: 'var(--mb-red)',   border: 'rgba(174,40,40,0.25)' },
    teal:  { bg: 'var(--mb-teal-tint)',  color: 'var(--mb-teal)',  border: 'rgba(14,102,85,0.25)' },
  };
  const c = colors[variant] ?? colors.amber;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </span>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--mb-rule)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}>
      {children}
    </div>
  );
}

function CardHead({ badges, title, sub }: { badges: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ padding: '28px 28px 22px', borderBottom: '2px solid var(--mb-rule)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 16 }}>{badges}</div>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 900, color: 'var(--mb-ink)', marginBottom: 10, lineHeight: 1.25, letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: 'var(--mb-ink2)', lineHeight: 1.7, fontWeight: 500, margin: '10px 0 0', letterSpacing: '0.01em' }}>{sub}</p>
    </div>
  );
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '24px 28px 28px' }}>{children}</div>;
}

function EmotionStrip({ bgColor, borderColor, icon, textColor, message }: { bgColor: string; borderColor: string; icon: string; textColor: string; message: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 14, marginBottom: 20, background: bgColor, border: `1.5px solid ${borderColor}` }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, lineHeight: 1.75, color: textColor, letterSpacing: '0.005em' }}>{message}</span>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mb-ink3)' }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1.5, background: 'var(--mb-rule)' }} />
    </div>
  );
}

function StatRow({ label, value, sub, color = 'var(--mb-navy)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--mb-rule)' }}>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', fontWeight: 500 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 800, color }}>{value}</div>
        {sub && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'var(--mb-ink3)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Nav bar ────────────────────────────────────────────────────────
function CardNav({ current, total, onBack, onNext, nextLabel = 'Next →', isLast = false, onComplete }: {
  current: number; total: number; onBack?: () => void; onNext?: () => void;
  nextLabel?: string; isLast?: boolean; onComplete?: () => void;
}) {
  return (
    <div style={{ padding: '18px 28px 24px', borderTop: '2px solid var(--mb-rule)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: i === current ? 20 : 7, height: 7, borderRadius: 4, background: i <= current ? 'var(--mb-navy)' : 'var(--mb-rule)', transition: 'all 300ms ease' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: onBack ? 'space-between' : 'flex-end', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--mb-ink2)', background: 'none', border: '1.5px solid var(--mb-rule)', borderRadius: 12, padding: '12px 22px', cursor: 'pointer', minHeight: 48 }}>
            ← Back
          </button>
        )}
        {isLast ? (
          <button onClick={onComplete} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 800, color: 'white', background: 'var(--mb-green)', border: 'none', borderRadius: 12, padding: '12px 28px', cursor: 'pointer', minHeight: 48, boxShadow: '0 3px 12px rgba(26,107,60,0.3)', flex: 1 }}>
            See Full Report →
          </button>
        ) : (
          <button onClick={onNext} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 800, color: 'white', background: 'var(--mb-navy)', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', minHeight: 48, boxShadow: '0 3px 12px rgba(27,47,85,0.25)', letterSpacing: '0.02em' }}>
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 1 — RISK MIRROR (Fear trigger: loss aversion + score reality)
// ════════════════════════════════════════════════════════════════════
function Card1RiskMirror({ report, score, onNext }: { report: ScanReport; score: number; onNext: () => void }) {
  const role = getVerbatimRole(report);
  const persona = detectPersona(report);
  const personaConfig = getPersonaConfig(persona);
  const di = report.determinism_index ?? 50;
  const isHigh = score < 50;
  const months = report.months_remaining ?? 24;
  const monthsLabel = months <= 6 ? '< 6 months' : months <= 12 ? '~1 year' : months <= 24 ? '~2 years' : months <= 36 ? '~3 years' : '3+ years';
  const indiaPct = Math.round(di);

  const confrontation = report.dead_end_narrative
    ? report.dead_end_narrative.split('.')[0] + '.'
    : report.urgency_horizon
    ? report.urgency_horizon
    : `${indiaPct}% of your daily work is automatable at current AI adoption rates.`;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="01 · Risk Mirror" variant={isHigh ? 'red' : 'amber'} /><Badge label="Deterministic" variant="navy" /></>}
        title={isHigh ? `Your role is in the risk zone.` : `You have a window. Use it.`}
        sub={`Career Position Score for ${role.length > 40 ? role.slice(0, 40) + '…' : role}`}
      />
      <CardBody>
        {/* Big score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, padding: '20px 24px', borderRadius: 16, background: isHigh ? 'var(--mb-red-tint)' : 'var(--mb-green-tint)', border: `1.5px solid ${isHigh ? 'rgba(174,40,40,0.2)' : 'rgba(26,107,60,0.2)'}` }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 64, fontWeight: 900, lineHeight: 1, color: isHigh ? 'var(--mb-red)' : 'var(--mb-green)' }}>{score}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--mb-ink3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>out of 100</div>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 800, color: isHigh ? 'var(--mb-red)' : 'var(--mb-green)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{personaConfig.urgencyLabel}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.6, color: 'var(--mb-ink2)', fontWeight: 500 }}>
              Adaptation window: <strong style={{ color: 'var(--mb-ink)' }}>{monthsLabel}</strong>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.6, color: 'var(--mb-ink2)', fontWeight: 500 }}>
              Automation exposure: <strong style={{ color: 'var(--mb-ink)' }}>{indiaPct}%</strong>
            </div>
          </div>
        </div>

        {/* Confrontation */}
        <EmotionStrip
          bgColor="var(--mb-amber-tint)"
          borderColor="rgba(139,90,0,0.2)"
          icon="💡"
          textColor="var(--mb-ink)"
          message={confrontation}
        />

        {report.urgency_horizon && report.urgency_horizon !== confrontation && (
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-ink2)', lineHeight: 1.7, padding: '14px 18px', background: 'var(--mb-navy-tint)', borderRadius: 12, border: '1px solid var(--mb-navy-tint2)' }}>
            ⏱ {report.urgency_horizon}
          </div>
        )}
      </CardBody>
      <CardNav current={0} total={7} onNext={onNext} nextLabel="See your skills →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 2 — SKILLS VS AI (At-risk vs moat, Doom Clock)
// ════════════════════════════════════════════════════════════════════
function Card2SkillsVsAI({ report, onBack, onNext }: { report: ScanReport; onBack: () => void; onNext: () => void }) {
  const deadSkills = report.execution_skills_dead?.slice(0, 4) ?? [];
  const moatSkills = report.moat_skills?.slice(0, 4) ?? [];
  const tools = (report.ai_tools_replacing ?? []).slice(0, 3);

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="02 · Skills vs AI" variant="red" /><Badge label="KG-matched" variant="navy" /></>}
        title="Here's what AI is taking — and what it can't."
        sub="Every skill matched against the Knowledge Graph. Red = being automated. Green = your protection."
      />
      <CardBody>
        {deadSkills.length > 0 && (
          <>
            <SectionLabel label="Skills AI is replacing" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {deadSkills.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--mb-red-tint)', border: '1px solid rgba(174,40,40,0.15)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--mb-red)' }}>{s}</div>
                    {tools[i] && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'var(--mb-ink3)', marginTop: 2 }}>Being replaced by {tools[i]}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {moatSkills.length > 0 && (
          <>
            <SectionLabel label="Your moat — AI can't replicate these" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {moatSkills.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--mb-green-tint)', border: '1px solid rgba(26,107,60,0.15)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🛡️</span>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--mb-green)' }}>{s}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {deadSkills.length === 0 && moatSkills.length === 0 && (
          <EmotionStrip bgColor="var(--mb-amber-tint)" borderColor="rgba(139,90,0,0.2)" icon="⚠️" textColor="var(--mb-ink)"
            message="We need your full profile to map specific skills. Upload your resume for the complete skill-by-skill breakdown."
          />
        )}
      </CardBody>
      <CardNav current={1} total={7} onBack={onBack} onNext={onNext} nextLabel="Your strengths →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 3 — SKILL SHIELD (cognitive_moat + moat_narrative — HOPE)
// ════════════════════════════════════════════════════════════════════
function Card3SkillShield({ report, onBack, onNext }: { report: ScanReport; onBack: () => void; onNext: () => void }) {
  const moatScore = report.moat_score ?? 50;
  const isStrong = moatScore >= 60;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="03 · Skill Shield" variant="green" /><Badge label="Your advantage" variant="teal" /></>}
        title={isStrong ? "Here's why you're not replaceable." : "Here's how you build your protection."}
        sub="Your irreplaceable edge — the skills, judgment, and experience AI cannot automate."
      />
      <CardBody>
        {/* Moat score ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 22px', borderRadius: 16, background: 'var(--mb-green-tint)', border: '1.5px solid rgba(26,107,60,0.2)', marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `conic-gradient(var(--mb-green) ${moatScore * 3.6}deg, var(--mb-rule) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--mb-green)' }}>{moatScore}</span>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--mb-green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Moat Score</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', lineHeight: 1.5, fontWeight: 500 }}>
              {isStrong ? 'Strong protection against AI displacement.' : 'Buildable — specific actions below close the gap.'}
            </div>
          </div>
        </div>

        {report.cognitive_moat && (
          <>
            <SectionLabel label="Your cognitive edge" />
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-ink2)', lineHeight: 1.8, padding: '14px 18px', background: 'var(--mb-navy-tint)', borderRadius: 12, border: '1px solid var(--mb-navy-tint2)', marginBottom: 16 }}>
              {report.cognitive_moat}
            </div>
          </>
        )}

        {report.moat_narrative && (
          <EmotionStrip bgColor="var(--mb-green-tint)" borderColor="rgba(26,107,60,0.2)" icon="💎" textColor="var(--mb-ink)" message={report.moat_narrative} />
        )}
      </CardBody>
      <CardNav current={2} total={7} onBack={onBack} onNext={onNext} nextLabel="Your market →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 4 — YOUR MARKET (Salary, posting trend, peer comparison)
// ════════════════════════════════════════════════════════════════════
function Card4YourMarket({ report, onBack, onNext }: { report: ScanReport; onBack: () => void; onNext: () => void }) {
  const monthly = report.estimated_monthly_salary_inr;
  const bleedMonthly = report.salary_bleed_monthly;
  const survivability = report.survivability?.score ?? 50;
  const peerPct = report.survivability?.peer_percentile_estimate ?? null;
  const marketPos = report.market_position_model;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="04 · Your Market" variant="amber" /><Badge label="India market data" variant="navy" /></>}
        title="Where you actually stand in the market."
        sub="Salary benchmarks, demand signals, and peer comparison — grounded in live India data."
      />
      <CardBody>
        {monthly && bleedMonthly && (
          <>
            <SectionLabel label="Salary intelligence" />
            <div style={{ marginBottom: 20 }}>
              <StatRow label="Current estimated CTC (monthly)" value={`₹${(monthly / 1000).toFixed(0)}K`} />
              <StatRow label="Estimated salary pressure (annual)" value={`₹${(bleedMonthly * 12 / 1000).toFixed(0)}K at risk`} color="var(--mb-red)" sub="If AI adoption continues at current pace" />
              <StatRow label="Survivability score" value={`${survivability}/100`} color={survivability >= 60 ? 'var(--mb-green)' : 'var(--mb-amber)'} sub={peerPct ? String(peerPct) : undefined} />
            </div>
          </>
        )}

        {marketPos && (
          <>
            <SectionLabel label="Market position" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Percentile', value: `${marketPos.market_percentile}th` },
                { label: 'Tier', value: marketPos.competitive_tier },
                { label: 'Demand', value: marketPos.demand_trend },
                { label: 'Leverage', value: marketPos.leverage_status },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--mb-navy-tint)', border: '1px solid var(--mb-navy-tint2)', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'var(--mb-ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-navy)', fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {!monthly && !marketPos && (
          <EmotionStrip bgColor="var(--mb-navy-tint)" borderColor="var(--mb-navy-tint2)" icon="📊" textColor="var(--mb-ink)"
            message="Upload your full resume to unlock salary benchmarks and live market data personalised to your role and city."
          />
        )}

        {report.geo_arbitrage && (
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'var(--mb-teal-tint)', border: '1px solid rgba(14,102,85,0.2)' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--mb-teal)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Geo Opportunity: {report.geo_arbitrage.target_market}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-ink2)', fontWeight: 500 }}>Expected uplift: ₹{(report.geo_arbitrage.expected_value_12mo_inr / 100000).toFixed(1)}L/yr · {report.geo_arbitrage.fastest_path_weeks}wk path</div>
          </div>
        )}
      </CardBody>
      <CardNav current={3} total={7} onBack={onBack} onNext={onNext} nextLabel="Your pivot path →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 5 — PIVOT PATH (Agent 2C output, specific role + ₹)
// ════════════════════════════════════════════════════════════════════
function Card5PivotPath({ report, onBack, onNext }: { report: ScanReport; onBack: () => void; onNext: () => void }) {
  const pivots = report.pivot_roles ?? [];
  const pivot = pivots[0] as any;
  const cultural = report.cultural_risk_assessment;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="05 · Pivot Path" variant="teal" /><Badge label="Matched to your profile" variant="navy" /></>}
        title="Your highest-probability career move."
        sub="The adjacent role with the most transferable skills, best salary uplift, and fastest time-to-offer."
      />
      <CardBody>
        {pivot ? (
          <>
            <div style={{ padding: '20px 22px', borderRadius: 16, background: 'var(--mb-teal-tint)', border: '1.5px solid rgba(14,102,85,0.2)', marginBottom: 20 }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--mb-teal)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Recommended pivot</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 900, color: 'var(--mb-ink)', marginBottom: 8 }}>{pivot.role || pivot.title || 'Adjacent Role'}</div>
              {pivot.pivot_rationale && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-ink2)', lineHeight: 1.7, fontWeight: 500 }}>{pivot.pivot_rationale}</div>
              )}
            </div>

            {pivot.skill_gap_map?.slice(0, 3).map((gap: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--mb-amber-tint)', border: '1px solid rgba(139,90,0,0.15)', marginBottom: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🎯</span>
                <div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--mb-amber)' }}>{gap.missing_skill}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'var(--mb-ink3)', marginTop: 2 }}>{gap.fastest_path} · {gap.weeks_to_proficiency}wks</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <EmotionStrip bgColor="var(--mb-teal-tint)" borderColor="rgba(14,102,85,0.2)" icon="🗺️" textColor="var(--mb-ink)"
            message="Pivot path analysis runs from your specific skill fingerprint. Upload your resume for a personalised pivot recommendation with ₹ salary bridge."
          />
        )}

        {cultural && (
          <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12, background: cultural.risk_level === 'LOW' ? 'var(--mb-green-tint)' : 'var(--mb-amber-tint)', border: `1px solid ${cultural.risk_level === 'LOW' ? 'rgba(26,107,60,0.2)' : 'rgba(139,90,0,0.2)'}` }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: cultural.risk_level === 'LOW' ? 'var(--mb-green)' : 'var(--mb-amber)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Family conversation guide</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', lineHeight: 1.7 }}>{cultural.family_conversation_script}</div>
          </div>
        )}
      </CardBody>
      <CardNav current={4} total={7} onBack={onBack} onNext={onNext} nextLabel="Honest feedback →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 6 — BLIND SPOTS (Tough love + free_advice, accountability)
// ════════════════════════════════════════════════════════════════════
function Card6BlindSpots({ report, onBack, onNext }: { report: ScanReport; onBack: () => void; onNext: () => void }) {
  const advice = [report.free_advice_1, report.free_advice_2].filter(Boolean) as string[];
  const gaps = report.skill_gap_map?.slice(0, 3) ?? [];
  const vulnerability = report.survivability?.primary_vulnerability;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="06 · Blind Spots" variant="red" /><Badge label="Specific to your profile" variant="red" /></>}
        title="Here's what's actually holding you back."
        sub="Honest analysis. No sugarcoating. These are the gaps between where you are and where you need to be."
      />
      <CardBody>
        {vulnerability && (
          <EmotionStrip bgColor="var(--mb-red-tint)" borderColor="rgba(174,40,40,0.2)" icon="⚡" textColor="var(--mb-ink)" message={vulnerability} />
        )}

        {advice.length > 0 && (
          <>
            <SectionLabel label="What to do about it" />
            {advice.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--mb-navy-tint)', border: '1px solid var(--mb-navy-tint2)', marginBottom: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--mb-navy)', color: 'white', fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--mb-ink2)', lineHeight: 1.7, fontWeight: 500 }}>{a}</span>
              </div>
            ))}
          </>
        )}

        {gaps.length > 0 && (
          <>
            <SectionLabel label="Critical gaps" />
            {gaps.map((g: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--mb-rule)', alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', fontWeight: 600 }}>{g.missing_skill}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8, background: 'var(--mb-red-tint)', color: 'var(--mb-red)' }}>
                  {g.weeks_to_proficiency}wk to fix
                </span>
              </div>
            ))}
          </>
        )}

        {advice.length === 0 && gaps.length === 0 && !vulnerability && (
          <EmotionStrip bgColor="var(--mb-amber-tint)" borderColor="rgba(139,90,0,0.2)" icon="🔍" textColor="var(--mb-ink)"
            message="Blind spot analysis requires your full resume. The more specific your profile, the more specific the feedback."
          />
        )}
      </CardBody>
      <CardNav current={5} total={7} onBack={onBack} onNext={onNext} nextLabel="Your 90-day plan →" />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARD 7 — 90-DAY MISSION (immediate_next_step + coach opt-in, HOPE)
// ════════════════════════════════════════════════════════════════════
function Card7Mission({ report, onBack, onComplete }: { report: ScanReport; onBack: () => void; onComplete: () => void }) {
  const nextStep = report.immediate_next_step;
  const weeklyPlan = report.weekly_action_plan?.slice(0, 3) ?? [];
  const diet = report.weekly_survival_diet;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="07 · Your Mission" variant="green" /><Badge label="Start today" variant="teal" /></>}
        title="Here's exactly what to do next."
        sub="Your 90-day adaptation plan. Week-by-week actions grounded in your specific skills and risk profile."
      />
      <CardBody>
        {nextStep && (
          <>
            <SectionLabel label="Your immediate next step" />
            <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--mb-green-tint)', border: '1.5px solid rgba(26,107,60,0.22)', marginBottom: 20 }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--mb-green)', marginBottom: 6 }}>{nextStep.action}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', lineHeight: 1.6, fontWeight: 500 }}>{nextStep.rationale}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'var(--mb-ink3)', marginTop: 8 }}>Time needed: {nextStep.time_required}</div>
            </div>
          </>
        )}

        {weeklyPlan.length > 0 && (
          <>
            <SectionLabel label="90-day plan (first 3 actions)" />
            {weeklyPlan.map((w: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--mb-rule)', alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mb-navy)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 900 }}>W{i + 1}</div>
                <div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--mb-ink)', marginBottom: 2 }}>{w.action || w.week_label}</div>
                  {w.tasks?.[0] && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'var(--mb-ink3)', lineHeight: 1.5 }}>{w.tasks[0]}</div>}
                </div>
              </div>
            ))}
          </>
        )}

        {diet && (
          <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12, background: 'var(--mb-teal-tint)', border: '1px solid rgba(14,102,85,0.2)' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--mb-teal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>This week: {diet.theme}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[{ icon: '📖', item: diet.read }, { icon: '▶️', item: diet.watch }, { icon: '🎧', item: diet.listen }].map(({ icon, item }) => (
                <div key={icon} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink2)', display: 'flex', gap: 8 }}>
                  <span>{icon}</span><span>{item.title} · {item.time_commitment}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
      <CardNav current={6} total={7} onBack={onBack} isLast onComplete={onComplete} />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN CONTAINER — Swipeable 7-card sequence
// ════════════════════════════════════════════════════════════════════
interface SevenCardRevealProps {
  report: ScanReport;
  onComplete: () => void;   // → Pro dashboard or thank-you
  scanId?: string;
}

export default function SevenCardReveal({ report, onComplete }: SevenCardRevealProps) {
  const [current, setCurrent] = useState(0);
  const score = computeStabilityScore(report);

  const goNext = useCallback(() => setCurrent(c => Math.min(c + 1, 6)), []);
  const goBack = useCallback(() => setCurrent(c => Math.max(c - 1, 0)), []);

  const cards = [
    <Card1RiskMirror    key={0} report={report} score={score} onNext={goNext} />,
    <Card2SkillsVsAI   key={1} report={report} onBack={goBack} onNext={goNext} />,
    <Card3SkillShield  key={2} report={report} onBack={goBack} onNext={goNext} />,
    <Card4YourMarket   key={3} report={report} onBack={goBack} onNext={goNext} />,
    <Card5PivotPath    key={4} report={report} onBack={goBack} onNext={goNext} />,
    <Card6BlindSpots   key={5} report={report} onBack={goBack} onNext={goNext} />,
    <Card7Mission      key={6} report={report} onBack={goBack} onComplete={onComplete} />,
  ];

  return (
    <div className="mb-root" style={{ minHeight: '100vh', background: 'var(--mb-bg)', padding: '0 0 40px' }}>
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--mb-rule)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 900, fontSize: 17, color: 'var(--mb-ink)', letterSpacing: '-0.02em' }}>JobBachao</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--mb-ink3)', fontWeight: 600 }}>
          {current + 1} of 7
        </span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 0' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {cards[current]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
