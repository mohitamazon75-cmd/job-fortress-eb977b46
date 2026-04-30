/**
 * analysis-context.ts — Phase 1.A (Expert Panel Audit 2026-04-30)
 *
 * The single deterministic context object that every card MUST read from
 * to eliminate cross-card contradictions (P1–P7 in the panel audit).
 *
 * RULES:
 *  - PURE function, zero IO. All inputs are passed in.
 *  - Computed ONCE per scan, after the deterministic engine runs.
 *  - All downstream consumers (LLM prompts, eligibility filters, UI badges)
 *    read from this object — they do NOT recompute.
 *  - This module is mirrored at supabase/functions/_shared/analysis-context.ts
 *    for Deno consumption. Keep the two in sync.
 *
 * Phase 1.A scope: module + types + tests ONLY.
 * Phase 1.B (next pass) wires it into process-scan and Card 4 eligibility.
 */

export type SeniorityTier =
  | 'JUNIOR'
  | 'MID'
  | 'SENIOR'
  | 'SENIOR_LEADER'
  | 'EXECUTIVE';

export type MetroTier = 'tier1' | 'tier2' | 'tier3' | 'unknown';

export type SalaryProvenance = 'USER_PROVIDED' | 'ESTIMATED' | 'UNKNOWN';

/** Deterministic, KG-grounded context shared by every card in the report. */
export interface AnalysisContext {
  /** snake_case job-family key as stored in job_taxonomy.job_family. May be null if no KG match. */
  user_role_family: string | null;
  /** market_signals.market_health for the user's family. 'unknown' when no row. */
  user_role_market_health: 'booming' | 'stable' | 'declining' | 'unknown';
  /** % of user's claimed skills that matched a row in skill_risk_matrix. 0–100. */
  user_skill_kg_match_pct: number;
  /** Lower-cased, deduped set of the user's existing skills. Used to prevent Defense Plan from
   *  recommending what they already have. */
  user_existing_skills_set: string[];
  user_seniority_tier: SeniorityTier;
  user_is_exec: boolean;
  user_metro_tier: MetroTier;
  /** Self-reported notice period in days. null if unknown. */
  user_notice_period_days: number | null;
  /** Whether the salary on which dependent metrics are anchored came from the user. */
  salary_provenance: SalaryProvenance;
  /** Version stamps so a stored report can be re-validated against the engine that built it. */
  kg_version: string;
  prompt_version: string;
  engine_version: string;
  /** ISO-8601 timestamp of when this context was computed. */
  computed_at: string;
}

export interface AnalysisContextInput {
  role_family: string | null | undefined;
  market_health: string | null | undefined;
  matched_skill_count: number;
  total_skill_count: number;
  existing_skills: ReadonlyArray<string | null | undefined>;
  seniority_tier: string | null | undefined;
  metro_tier: string | null | undefined;
  notice_period_days?: number | null;
  has_user_ctc: boolean;
  kg_version: string;
  prompt_version: string;
  engine_version: string;
  /** Optional clock injection for deterministic tests. */
  now?: () => Date;
}

const VALID_HEALTH = new Set(['booming', 'stable', 'declining']);
const VALID_METRO = new Set<MetroTier>(['tier1', 'tier2', 'tier3', 'unknown']);

const EXEC_TIERS = new Set<SeniorityTier>(['SENIOR_LEADER', 'EXECUTIVE']);

function normalizeSeniority(raw: string | null | undefined): SeniorityTier {
  const v = (raw || '').toUpperCase().trim();
  switch (v) {
    case 'JUNIOR':
    case 'MID':
    case 'SENIOR':
    case 'SENIOR_LEADER':
    case 'EXECUTIVE':
      return v;
    case 'LEADER':
    case 'SR_LEADER':
      return 'SENIOR_LEADER';
    case 'EXEC':
      return 'EXECUTIVE';
    default:
      return 'MID';
  }
}

function normalizeMetro(raw: string | null | undefined): MetroTier {
  const v = (raw || '').toLowerCase().trim();
  return VALID_METRO.has(v as MetroTier) ? (v as MetroTier) : 'unknown';
}

function normalizeHealth(raw: string | null | undefined): AnalysisContext['user_role_market_health'] {
  const v = (raw || '').toLowerCase().trim();
  return VALID_HEALTH.has(v) ? (v as any) : 'unknown';
}

function dedupeSkills(skills: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    if (!raw) continue;
    const s = String(raw).toLowerCase().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Build the deterministic AnalysisContext. Pure — no IO, no Date.now() unless `now` omitted.
 */
export function buildAnalysisContext(input: AnalysisContextInput): AnalysisContext {
  const matchPct =
    input.total_skill_count > 0
      ? Math.round((input.matched_skill_count / input.total_skill_count) * 100)
      : 0;

  const existing = dedupeSkills(input.existing_skills);
  const seniority = normalizeSeniority(input.seniority_tier);
  const now = input.now ? input.now() : new Date();

  return {
    user_role_family: input.role_family ? String(input.role_family).toLowerCase().trim() || null : null,
    user_role_market_health: normalizeHealth(input.market_health),
    user_skill_kg_match_pct: Math.max(0, Math.min(100, matchPct)),
    user_existing_skills_set: existing,
    user_seniority_tier: seniority,
    user_is_exec: EXEC_TIERS.has(seniority),
    user_metro_tier: normalizeMetro(input.metro_tier),
    user_notice_period_days:
      typeof input.notice_period_days === 'number' && input.notice_period_days >= 0
        ? Math.round(input.notice_period_days)
        : null,
    salary_provenance: input.has_user_ctc ? 'USER_PROVIDED' : 'ESTIMATED',
    kg_version: input.kg_version || 'unknown',
    prompt_version: input.prompt_version || 'unknown',
    engine_version: input.engine_version || 'unknown',
    computed_at: now.toISOString(),
  };
}

// ── Eligibility helpers (used by Phase 1.B consumers; pure today, locked by tests) ────

export interface PivotCandidate {
  job_family?: string | null;
  market_health?: string | null;
  // anything else passes through untouched
  [key: string]: unknown;
}

/**
 * Drop pivot candidates that violate cross-card invariants:
 *  - same family as the user (would not be a "pivot")
 *  - declining market_health (cannot recommend a sinking role)
 * Kills audit-finding P1.
 */
export function filterEligiblePivots<T extends PivotCandidate>(
  pivots: ReadonlyArray<T>,
  ctx: Pick<AnalysisContext, 'user_role_family'>,
): T[] {
  const userFamily = (ctx.user_role_family || '').toLowerCase().trim();
  return pivots.filter((p) => {
    const fam = (p.job_family || '').toString().toLowerCase().trim();
    if (userFamily && fam && fam === userFamily) return false;
    const health = (p.market_health || '').toString().toLowerCase().trim();
    if (health === 'declining') return false;
    return true;
  });
}

/**
 * Drop skill recommendations the user already has.
 * Kills audit-finding P7.
 */
export function filterNovelSkillRecommendations(
  recommendations: ReadonlyArray<string | null | undefined>,
  ctx: Pick<AnalysisContext, 'user_existing_skills_set'>,
): string[] {
  const have = new Set(ctx.user_existing_skills_set);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of recommendations) {
    if (!raw) continue;
    const norm = String(raw).toLowerCase().trim();
    if (!norm || have.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(String(raw).trim());
  }
  return out;
}
