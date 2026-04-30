/**
 * Phase 1.A — analysis-context invariants.
 *
 * These tests lock the deterministic shape of AnalysisContext and the two
 * eligibility helpers that Phase 1.B will wire into process-scan and Card 4.
 *
 * Each block restates the invariant it pins so future heuristic changes
 * cannot rot the test silently (BL-036 lesson).
 */
import { describe, expect, it } from 'vitest';
import {
  buildAnalysisContext,
  computeSeniorityFloor,
  filterEligiblePivots,
  filterNovelSkillRecommendations,
} from '@/lib/analysis-context';

const FROZEN_NOW = () => new Date('2026-04-30T12:00:00.000Z');

const baseInput = {
  role_family: 'marketing',
  market_health: 'declining',
  matched_skill_count: 11,
  total_skill_count: 14,
  existing_skills: ['SEO', 'Google Analytics', 'Email Marketing'],
  seniority_tier: 'MID',
  metro_tier: 'tier1',
  has_user_ctc: true,
  kg_version: 'kg-v1',
  prompt_version: 'p-v1',
  engine_version: 'e-v1',
  now: FROZEN_NOW,
};

describe('buildAnalysisContext — deterministic shape', () => {
  it('rounds match pct to 0–100 (11/14 → 79)', () => {
    // Locks Phase 1.A invariant: skill_kg_match_pct is integer percent, never NaN.
    const ctx = buildAnalysisContext(baseInput);
    expect(ctx.user_skill_kg_match_pct).toBe(79);
  });

  it('handles zero total skills without divide-by-zero', () => {
    // Locks: empty profile → 0% match, no NaN/Infinity propagating to UI.
    const ctx = buildAnalysisContext({ ...baseInput, matched_skill_count: 0, total_skill_count: 0 });
    expect(ctx.user_skill_kg_match_pct).toBe(0);
  });

  it('lower-cases and dedupes existing_skills_set', () => {
    // Locks: case-insensitive comparison so "SEO" vs "seo" cannot create false novelty.
    const ctx = buildAnalysisContext({ ...baseInput, existing_skills: ['SEO', 'seo', '  Email Marketing ', null, ''] });
    expect(ctx.user_existing_skills_set).toEqual(['seo', 'email marketing']);
  });

  it('flags SENIOR_LEADER and EXECUTIVE as is_exec, MID as not', () => {
    // Locks: exec persona detection so K1 audit fix can rely on a single field.
    expect(buildAnalysisContext({ ...baseInput, seniority_tier: 'EXECUTIVE' }).user_is_exec).toBe(true);
    expect(buildAnalysisContext({ ...baseInput, seniority_tier: 'SENIOR_LEADER' }).user_is_exec).toBe(true);
    expect(buildAnalysisContext({ ...baseInput, seniority_tier: 'MID' }).user_is_exec).toBe(false);
  });

  it('normalizes invalid market_health to "unknown" (no silent "stable" assumption)', () => {
    // Locks: zero-hallucination — unknown health must surface as unknown, not faked stable.
    const ctx = buildAnalysisContext({ ...baseInput, market_health: 'gibberish' as any });
    expect(ctx.user_role_market_health).toBe('unknown');
  });

  it('salary_provenance reflects has_user_ctc flag', () => {
    // Locks: salary tag pipeline (C2.1) reads this field to gate ₹ rendering.
    expect(buildAnalysisContext({ ...baseInput, has_user_ctc: true }).salary_provenance).toBe('USER_PROVIDED');
    expect(buildAnalysisContext({ ...baseInput, has_user_ctc: false }).salary_provenance).toBe('ESTIMATED');
  });

  it('stamps version + computed_at deterministically when clock injected', () => {
    // Locks: every persisted scan can be replayed against the engine that built it.
    const ctx = buildAnalysisContext(baseInput);
    expect(ctx.kg_version).toBe('kg-v1');
    expect(ctx.prompt_version).toBe('p-v1');
    expect(ctx.engine_version).toBe('e-v1');
    expect(ctx.computed_at).toBe('2026-04-30T12:00:00.000Z');
  });
});

describe('filterEligiblePivots — kills P1 contradiction', () => {
  it('drops pivots with the same job_family as user (case-insensitive)', () => {
    // Locks audit P1: Card 4 cannot suggest the user's own family back to them.
    const out = filterEligiblePivots(
      [
        { role: 'Brand Manager', job_family: 'MARKETING', market_health: 'stable' },
        { role: 'Product Manager', job_family: 'product_design', market_health: 'stable' },
      ],
      { user_role_family: 'marketing' },
    );
    expect(out.map((p) => p.role)).toEqual(['Product Manager']);
  });

  it('drops pivots whose own market_health is declining', () => {
    // Locks audit P1: Card 1 declining + Card 4 recommending cannot coexist.
    const out = filterEligiblePivots(
      [
        { role: 'A', job_family: 'finance_ops', market_health: 'declining' },
        { role: 'B', job_family: 'data_analytics', market_health: 'booming' },
      ],
      { user_role_family: 'marketing' },
    );
    expect(out.map((p) => p.role)).toEqual(['B']);
  });

  it('passes through unknown/missing fields without false positives', () => {
    // Locks: missing data must NOT be treated as declining — empty-handed != red-flag.
    const out = filterEligiblePivots(
      [{ role: 'A' }, { role: 'B', market_health: '' }],
      { user_role_family: 'marketing' },
    );
    expect(out).toHaveLength(2);
  });

  // ── Pivot Coherence Pass — Bug 1 fix (2026-04-30) ─────────────────────
  // Calibration: when user_is_exec=true, the same-family drop is INVERTED
  // because exec careers ladder vertically inside one family (Sr Manager →
  // Director → VP → Chief). For non-execs, same-family is still dropped.
  // Declining-market filter applies to BOTH execs and non-execs — sinking
  // markets are sinking regardless of seniority.
  it('exec mode: keeps same-family pivots (vertical ladder is the realistic path)', () => {
    const out = filterEligiblePivots(
      [
        { role: 'VP of Sales', job_family: 'sales', market_health: 'stable' },
        { role: 'Chief Revenue Officer', job_family: 'sales', market_health: 'booming' },
        { role: 'Director Marketing', job_family: 'marketing', market_health: 'stable' },
      ],
      { user_role_family: 'sales', user_is_exec: true },
    );
    expect(out.map((p) => p.role).sort()).toEqual(
      ['Chief Revenue Officer', 'Director Marketing', 'VP of Sales'].sort(),
    );
  });

  it('exec mode: still drops declining-market pivots (sinking is sinking)', () => {
    const out = filterEligiblePivots(
      [
        { role: 'VP Print Sales', job_family: 'sales', market_health: 'declining' },
        { role: 'VP SaaS Sales', job_family: 'sales', market_health: 'booming' },
      ],
      { user_role_family: 'sales', user_is_exec: true },
    );
    expect(out.map((p) => p.role)).toEqual(['VP SaaS Sales']);
  });

  it('non-exec (default): same-family drop still applies (no exec flag → old behaviour)', () => {
    // Calibration: omitting user_is_exec must behave exactly like before the fix.
    // This pins backwards-compatibility for legacy callers and non-exec scans.
    const out = filterEligiblePivots(
      [
        { role: 'Senior Marketer', job_family: 'marketing', market_health: 'stable' },
        { role: 'Product Manager', job_family: 'product_design', market_health: 'stable' },
      ],
      { user_role_family: 'marketing' },
    );
    expect(out.map((p) => p.role)).toEqual(['Product Manager']);
  });

  it('non-exec with explicit user_is_exec=false: same-family drop applies', () => {
    const out = filterEligiblePivots(
      [
        { role: 'Senior Marketer', job_family: 'marketing', market_health: 'stable' },
        { role: 'Product Manager', job_family: 'product_design', market_health: 'stable' },
      ],
      { user_role_family: 'marketing', user_is_exec: false },
    );
    expect(out.map((p) => p.role)).toEqual(['Product Manager']);
  });
});

describe('filterNovelSkillRecommendations — kills P7 contradiction', () => {
  it('removes skills user already has (case-insensitive, trimmed)', () => {
    // Locks audit P7: Defense Plan cannot recommend "SEO" to a user whose profile lists "seo".
    const out = filterNovelSkillRecommendations(
      ['SEO', 'Prompt Engineering', '  email marketing  ', 'LangChain'],
      { user_existing_skills_set: ['seo', 'email marketing'] },
    );
    expect(out).toEqual(['Prompt Engineering', 'LangChain']);
  });

  it('dedupes within the recommendation list itself', () => {
    // Locks: a single recommendation list must not show the same skill twice.
    const out = filterNovelSkillRecommendations(
      ['LangChain', 'langchain', 'LangChain'],
      { user_existing_skills_set: [] },
    );
    expect(out).toEqual(['LangChain']);
  });
});

describe('computeSeniorityFloor — Fix B (Sales Sr Manager 11yr)', () => {
  it('CXO/Founder titles → EXECUTIVE regardless of years', () => {
    // Locks: title evidence dominates years (8-yr CFO is still EXECUTIVE).
    expect(computeSeniorityFloor('CFO at Acme', 8)).toBe('EXECUTIVE');
    expect(computeSeniorityFloor('Founder & CEO', 3)).toBe('EXECUTIVE');
    expect(computeSeniorityFloor('Co-Founder', null)).toBe('EXECUTIVE');
  });

  it('VP/Director/Head of → SENIOR_LEADER', () => {
    // Locks: leader-track titles do not get downgraded to SENIOR by the LLM.
    expect(computeSeniorityFloor('VP Sales', 10)).toBe('SENIOR_LEADER');
    expect(computeSeniorityFloor('Head of Marketing', 8)).toBe('SENIOR_LEADER');
    expect(computeSeniorityFloor('Senior Director', 12)).toBe('SENIOR_LEADER');
  });

  it('Senior Manager + 10+ years → SENIOR_LEADER (the actual bug case)', () => {
    // Locks: "Senior Manager – Business Development" (11yr) is no longer MID.
    expect(computeSeniorityFloor('Senior Manager – Business Development', 11)).toBe('SENIOR_LEADER');
    expect(computeSeniorityFloor('General Manager', 15)).toBe('SENIOR_LEADER');
  });

  it('Senior Manager + <10 years → SENIOR (not yet leader)', () => {
    // Locks: not all "Senior Manager" titles are leaders — years gate matters.
    expect(computeSeniorityFloor('Senior Manager', 6)).toBe('SENIOR');
  });

  it('Years-only floor: 15+ ⇒ SENIOR_LEADER, 10+ ⇒ SENIOR, 5+ ⇒ MID', () => {
    // Locks: pure years signal when title is generic/empty.
    expect(computeSeniorityFloor(null, 16)).toBe('SENIOR_LEADER');
    expect(computeSeniorityFloor(null, 11)).toBe('SENIOR');
    expect(computeSeniorityFloor('Analyst', 6)).toBe('MID');
    expect(computeSeniorityFloor('Analyst', 1)).toBe('JUNIOR');
  });
});

describe('buildAnalysisContext — floor never lowers LLM tier', () => {
  it('LLM says EXECUTIVE, floor says MID → result is EXECUTIVE', () => {
    // Locks: floor is a one-way ratchet upward.
    const ctx = buildAnalysisContext({
      ...baseInput,
      seniority_tier: 'EXECUTIVE',
      experience_years_raw: '0-2',
      current_title: 'Junior Analyst',
    });
    expect(ctx.user_seniority_tier).toBe('EXECUTIVE');
  });

  it('LLM says MID, title is "Senior Manager – BD" + 11yr → SENIOR_LEADER', () => {
    // Locks: the actual Sales-resume regression — was MID, now SENIOR_LEADER.
    const ctx = buildAnalysisContext({
      ...baseInput,
      seniority_tier: 'MID',
      experience_years_raw: '10+',
      current_title: 'Senior Manager – Business Development',
    });
    expect(ctx.user_seniority_tier).toBe('SENIOR_LEADER');
    expect(ctx.user_is_exec).toBe(true);
  });

  it('No title/years inputs → behaves identically to pre-Fix-B (LLM tier wins)', () => {
    // Locks: backward compat — call sites that don't pass new fields are unaffected.
    const ctx = buildAnalysisContext({ ...baseInput, seniority_tier: 'MID' });
    expect(ctx.user_seniority_tier).toBe('MID');
  });
});
