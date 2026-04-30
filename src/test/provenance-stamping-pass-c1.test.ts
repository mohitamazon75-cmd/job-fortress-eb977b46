/**
 * Pass C1 (Expert Panel Audit, 2026-04-30) — provenance & moat-visibility helpers.
 *
 * Calibrated against:
 *  - src/lib/provenance-stamping.ts confidence_label thresholds (HIGH≥70, MED≥40, LOW<40).
 *  - The audit's Phase 2 #4–#7 contract (KG badge, version stamp, citation_basis, empty states).
 *
 * Each test below restates the heuristic condition it is locking in. If you
 * change the thresholds or empty-state copy, update the test FIRST, then code.
 */
import { describe, expect, it } from 'vitest';
import {
  computeKgMatchBadge,
  buildProvenanceBlock,
  attachPivotCitationBasis,
  deriveJobsEmptyState,
  deriveDefensePlanEmptyState,
} from '@/lib/provenance-stamping';
import type { AnalysisContext } from '@/lib/analysis-context';

const baseCtx: AnalysisContext = {
  user_role_family: 'sales',
  user_role_market_health: 'declining',
  user_skill_kg_match_pct: 75,
  user_existing_skills_set: ['negotiation', 'salesforce'],
  user_seniority_tier: 'SENIOR_LEADER',
  user_is_exec: true,
  user_metro_tier: 'tier1',
  user_notice_period_days: 60,
  salary_provenance: 'USER_PROVIDED',
  kg_version: 'kg-v1',
  prompt_version: 'p-v1',
  engine_version: 'e-v1',
  computed_at: '2026-04-30T18:00:00.000Z',
};

describe('Pass C1.1 — KG match-rate badge', () => {
  // Total=0 → null badge. Without skills extracted there is nothing to match.
  it('returns null when total skill count is zero', () => {
    expect(computeKgMatchBadge(baseCtx, 0)).toBeNull();
  });
  // Total=0 must win even when pct>0 (degenerate input from a malformed scan).
  it('returns null when total=0 even if pct>0', () => {
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 80 }, 0)).toBeNull();
  });
  // pct≥70 → HIGH. 75% × 12 skills = 9 matched.
  it('labels HIGH at >=70%', () => {
    const b = computeKgMatchBadge({ user_skill_kg_match_pct: 75 }, 12);
    expect(b).toEqual({ matched_count: 9, total_count: 12, pct: 75, confidence_label: 'HIGH' });
  });
  // pct=70 is the inclusive boundary — must still be HIGH (off-by-one regression guard).
  it('labels HIGH exactly at 70% boundary', () => {
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 70 }, 10)?.confidence_label).toBe('HIGH');
  });
  // 40 ≤ pct < 70 → MEDIUM.
  it('labels MEDIUM at 40-69%', () => {
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 55 }, 10)?.confidence_label).toBe('MEDIUM');
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 40 }, 10)?.confidence_label).toBe('MEDIUM');
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 69 }, 10)?.confidence_label).toBe('MEDIUM');
  });
  // pct<40 → LOW. Caller may suppress the badge but the value is honest.
  it('labels LOW at <40%', () => {
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 39 }, 10)?.confidence_label).toBe('LOW');
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 0 }, 10)?.confidence_label).toBe('LOW');
  });
  // Out-of-range pct must clamp, not throw or wrap.
  it('clamps pct to [0,100]', () => {
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: 150 }, 10)?.pct).toBe(100);
    expect(computeKgMatchBadge({ user_skill_kg_match_pct: -10 }, 10)?.pct).toBe(0);
  });
});

describe('Pass C1.2 — provenance / version stamp', () => {
  // Happy path: every field flows through unchanged.
  it('passes through versions and computed_at', () => {
    expect(buildProvenanceBlock(baseCtx)).toEqual({
      kg_version: 'kg-v1',
      prompt_version: 'p-v1',
      engine_version: 'e-v1',
      computed_at: '2026-04-30T18:00:00.000Z',
    });
  });
  // Legacy / corrupt context — never throw, never produce undefined fields.
  it('substitutes "unknown" for missing version strings', () => {
    const out = buildProvenanceBlock({
      kg_version: '', prompt_version: '', engine_version: '', computed_at: '',
    });
    expect(out.kg_version).toBe('unknown');
    expect(out.prompt_version).toBe('unknown');
    expect(out.engine_version).toBe('unknown');
    // Empty computed_at becomes epoch — non-null, parseable.
    expect(new Date(out.computed_at).toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('Pass C1.3 — Card 4 pivot citation inheritance', () => {
  // Same family as user → kg_family_match (this happens for execs after Pivot
  // Coherence relaxation, where vertical pivots are valid).
  it('marks same-family pivot as kg_family_match', () => {
    const out = attachPivotCitationBasis(
      { job_family: 'sales', market_health: 'booming', salary_provenance: 'USER_PROVIDED' },
      baseCtx,
    );
    expect(out.citation_basis.family_match).toBe('kg_family_match');
    expect(out.citation_basis.market_health_grounded).toBe(true);
    expect(out.citation_basis.salary_provenance).toBe('USER_PROVIDED');
  });
  // Cross-family pivot still gets stamped — the basis is honest, not flattering.
  it('marks cross-family pivot as cross_family_inferred', () => {
    const out = attachPivotCitationBasis(
      { job_family: 'product_design', market_health: 'stable' },
      baseCtx,
    );
    expect(out.citation_basis.family_match).toBe('cross_family_inferred');
  });
  // Missing job_family → unknown, never silently mapped to anything else.
  it('marks pivot with no job_family as unknown', () => {
    const out = attachPivotCitationBasis(
      { market_health: 'booming' },
      baseCtx,
    );
    expect(out.citation_basis.family_match).toBe('unknown');
  });
  // Garbage market_health → grounded=false. Off-enum strings count as ungrounded.
  it('flags ungrounded market_health when value is off-enum', () => {
    const out = attachPivotCitationBasis(
      { job_family: 'sales', market_health: 'rising' },
      baseCtx,
    );
    expect(out.citation_basis.market_health_grounded).toBe(false);
  });
  // Pivot-level salary_provenance wins over context-level fallback.
  it('honors pivot-level salary_provenance over ctx fallback', () => {
    const out = attachPivotCitationBasis(
      { job_family: 'sales', salary_provenance: 'ESTIMATED' },
      baseCtx, // ctx says USER_PROVIDED
    );
    expect(out.citation_basis.salary_provenance).toBe('ESTIMATED');
  });
});

describe('Pass C1.4 — honest empty states', () => {
  // Empty array → marker. Caller renders the `reason` instead of [].map().
  it('flags Best-Fit Jobs empty when array is empty', () => {
    const m = deriveJobsEmptyState([], 'Mumbai');
    expect(m?.is_empty).toBe(true);
    expect(m?.reason).toMatch(/0 verified roles/);
    expect(m?.suggestion).toContain('Mumbai');
  });
  // Null/undefined input → marker. Same outcome as [].
  it('flags Best-Fit Jobs empty when array is null/undefined', () => {
    expect(deriveJobsEmptyState(null, 'Pune')?.is_empty).toBe(true);
    expect(deriveJobsEmptyState(undefined, null)?.is_empty).toBe(true);
  });
  // All-fake jobs (no http URL) → marker. Stops "Listed by Naukri Search" filler
  // from passing as a real opportunity.
  it('flags Best-Fit Jobs empty when no entry has a real URL', () => {
    const out = deriveJobsEmptyState(
      [{ search_url: '' }, { url: 'not-a-url' }, { search_url: null }],
      'Mumbai',
    );
    expect(out?.is_empty).toBe(true);
    expect(out?.reason).toMatch(/No live job URLs/);
  });
  // Even one real URL → null marker, surface the real list.
  it('returns null marker when at least one real URL exists', () => {
    const out = deriveJobsEmptyState(
      [{ search_url: 'https://www.naukri.com/jobs?k=sales' }, { url: 'placeholder' }],
      'Mumbai',
    );
    expect(out).toBeNull();
  });
  // Defense Plan empty list → honest framing, not "no data". The reason is
  // CALIBRATED to be flattering when the list is empty (means user is current).
  it('flags Defense Plan empty array with positive framing', () => {
    const out = deriveDefensePlanEmptyState([]);
    expect(out?.is_empty).toBe(true);
    expect(out?.reason).toMatch(/stack is current/);
    expect(out?.suggestion).toMatch(/60 days/);
  });
  // Non-empty list → null marker; let the actual skills render.
  it('returns null when defense plan has at least one skill', () => {
    expect(deriveDefensePlanEmptyState(['langchain'])).toBeNull();
  });
});
