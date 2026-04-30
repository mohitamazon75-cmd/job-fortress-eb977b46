/**
 * provenance-stamping.ts — Pass C1 (Expert Panel Audit, 2026-04-30)
 *
 * Single shared helper that makes the moat *visible* in every report:
 *  1. KG match-rate badge on Card 1 (audit Phase 2 #4)
 *  2. Engine/prompt/KG version trace on every report (audit Phase 2 #5)
 *  3. Card 4 pivot citation inheritance (audit Phase 2 #7)
 *  4. Honest empty states on Best-Fit Jobs + Defense Plan (audit Phase 2 #6)
 *
 * RULES:
 *  - PURE — no IO, no Date.now() unless `now` injected. Tested deterministically.
 *  - SAFE — fail-open. If analysisContext is null/legacy, return cardData unchanged.
 *  - NON-DESTRUCTIVE — only ADDS new fields (kg_match, _provenance, citation_basis,
 *    is_empty/reason). Never overwrites existing LLM output that's already grounded.
 *  - This module is mirrored at supabase/functions/_shared/provenance-stamping.ts
 *    for Deno consumption. Keep the two in sync.
 */

import type { AnalysisContext } from './analysis-context';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KgMatchBadge {
  matched_count: number;
  total_count: number;
  pct: number;
  /**
   * Confidence label rendered on the badge. Calibrated against real KG rows:
   *  HIGH   — ≥70% of skills matched a KG row
   *  MEDIUM — 40–69%
   *  LOW    — <40% (caller may choose to suppress the badge entirely)
   */
  confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProvenanceBlock {
  kg_version: string;
  prompt_version: string;
  engine_version: string;
  computed_at: string;
}

export interface PivotCitationBasis {
  /**
   * Why this pivot was deemed eligible for THIS user. Lets the UI render
   * "Based on KG family match (sales)" instead of LLM vibes.
   */
  family_match: 'kg_family_match' | 'cross_family_inferred' | 'unknown';
  /** Provenance of any salary figure on the pivot. Mirrors Pass C2.1 stamp. */
  salary_provenance: 'USER_PROVIDED' | 'ESTIMATED' | 'UNKNOWN';
  /** True if the pivot's market_health was sourced from market_signals (vs LLM guess). */
  market_health_grounded: boolean;
}

export interface EmptyStateMarker {
  is_empty: true;
  /** User-facing copy. Concrete and actionable — never "no data available". */
  reason: string;
  /** Optional structured suggestion for the UI to render as a CTA. */
  suggestion?: string;
}

// ── 1. KG match-rate badge ─────────────────────────────────────────────────────

export function computeKgMatchBadge(
  ctx: Pick<AnalysisContext, 'user_skill_kg_match_pct'>,
  totalSkillCount: number,
): KgMatchBadge | null {
  const total = Math.max(0, Math.floor(totalSkillCount));
  if (total === 0) return null; // No skills extracted → no badge to show.
  const pct = Math.max(0, Math.min(100, Math.round(ctx.user_skill_kg_match_pct)));
  const matched = Math.round((pct / 100) * total);
  const confidence_label: KgMatchBadge['confidence_label'] =
    pct >= 70 ? 'HIGH' : pct >= 40 ? 'MEDIUM' : 'LOW';
  return { matched_count: matched, total_count: total, pct, confidence_label };
}

// ── 2. Provenance / version stamp ──────────────────────────────────────────────

export function buildProvenanceBlock(
  ctx: Pick<AnalysisContext, 'kg_version' | 'prompt_version' | 'engine_version' | 'computed_at'>,
): ProvenanceBlock {
  return {
    kg_version: ctx.kg_version || 'unknown',
    prompt_version: ctx.prompt_version || 'unknown',
    engine_version: ctx.engine_version || 'unknown',
    computed_at: ctx.computed_at || new Date(0).toISOString(),
  };
}

// ── 3. Card 4 pivot citation inheritance ───────────────────────────────────────

interface PivotInput {
  job_family?: string | null;
  market_health?: string | null;
  current_band?: string | null;
  pivot_band?: string | null;
  // Existing C2.1 stamp from get-model-b-analysis. Optional.
  salary_provenance?: 'USER_PROVIDED' | 'ESTIMATED' | 'UNKNOWN';
  [key: string]: unknown;
}

export function attachPivotCitationBasis<T extends PivotInput>(
  pivot: T,
  ctx: Pick<AnalysisContext, 'user_role_family' | 'salary_provenance'>,
): T & { citation_basis: PivotCitationBasis } {
  const userFamily = (ctx.user_role_family || '').toLowerCase().trim();
  const pivotFamily = (pivot.job_family || '').toString().toLowerCase().trim();
  const family_match: PivotCitationBasis['family_match'] =
    !pivotFamily ? 'unknown'
      : pivotFamily === userFamily ? 'kg_family_match'
        : 'cross_family_inferred';
  const health = (pivot.market_health || '').toString().toLowerCase().trim();
  const market_health_grounded = ['booming', 'stable', 'declining'].includes(health);
  const salary_provenance =
    pivot.salary_provenance ?? ctx.salary_provenance ?? 'UNKNOWN';
  return {
    ...pivot,
    citation_basis: { family_match, salary_provenance, market_health_grounded },
  };
}

// ── 4. Honest empty states ─────────────────────────────────────────────────────

/**
 * Best-Fit Jobs: if job_matches is empty OR every entry lacks a real URL,
 * return the empty marker. Caller swaps it in instead of letting the LLM
 * fabricate placeholder rows.
 */
export interface JobMatchInput {
  search_url?: string | null;
  url?: string | null;
  verified_live?: boolean;
  [key: string]: unknown;
}
export function deriveJobsEmptyState(
  matches: ReadonlyArray<JobMatchInput> | null | undefined,
  cityHint: string | null | undefined,
): EmptyStateMarker | null {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      is_empty: true,
      reason: '0 verified roles match — try widening city or relaxing seniority.',
      suggestion: cityHint ? `Try "${cityHint} OR Bengaluru OR Remote"` : 'Try adding 2-3 nearby cities.',
    };
  }
  const anyReal = matches.some((m) => {
    const u = (m.search_url || m.url || '').toString().trim();
    return u.length > 0 && /^https?:\/\//i.test(u);
  });
  if (!anyReal) {
    return {
      is_empty: true,
      reason: 'No live job URLs verified — placeholder roles hidden.',
      suggestion: 'Re-scan in 24h to refresh live listings.',
    };
  }
  return null;
}

/**
 * Defense Plan: if the actionable skill list is empty after eligibility filters
 * (Phase 1.B already drops skills the user has), return an honest marker.
 */
export function deriveDefensePlanEmptyState(
  skillsToAdd: ReadonlyArray<unknown> | null | undefined,
): EmptyStateMarker | null {
  if (!Array.isArray(skillsToAdd) || skillsToAdd.length === 0) {
    return {
      is_empty: true,
      reason: 'No skill gaps detected vs. our threat graph — your stack is current.',
      suggestion: 'Re-scan in 60 days to track drift as new AI tools land.',
    };
  }
  return null;
}
