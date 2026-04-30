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
