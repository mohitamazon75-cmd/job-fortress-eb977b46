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
  /**
   * Fix B (Audit 2026-04-30) — deterministic seniority floor inputs.
   * If supplied, the floor can ONLY raise the LLM-supplied seniority_tier,
   * never lower it. Both fields are optional; when absent the LLM tier is used as-is.
   *
   * - experience_years_raw: scans.years_experience format ("0-2", "3-5", "6-10", "10+", or numeric).
   * - current_title: best-known role string (detectedRole / resolvedRoleHint / agent1.current_role).
   */
  experience_years_raw?: string | number | null;
  current_title?: string | null;
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

// ── Fix B (Audit 2026-04-30): deterministic seniority floor ─────────────────
// Title and years signals are unambiguous and should NEVER be undercut by the
// LLM-emitted seniority_tier. We compute a floor and take max(LLM tier, floor).
// Pure, no IO. Tested in src/test/analysis-context.test.ts.

const TIER_RANK: Record<SeniorityTier, number> = {
  JUNIOR: 0,
  MID: 1,
  SENIOR: 2,
  SENIOR_LEADER: 3,
  EXECUTIVE: 4,
};
const TIER_BY_RANK: SeniorityTier[] = ['JUNIOR', 'MID', 'SENIOR', 'SENIOR_LEADER', 'EXECUTIVE'];

// Word-boundaried executive/leader patterns. Matched against a normalised title.
const EXECUTIVE_TITLE_RE = /\b(ceo|cto|cfo|coo|cmo|cpo|chro|cro|cdo|ciso|cio|chief\s+\w+\s+officer|founder|co[\s-]?founder|managing\s+director|managing\s+partner|president|owner)\b/i;
const SENIOR_LEADER_TITLE_RE = /\b(vp|vice\s+president|svp|evp|senior\s+vice\s+president|executive\s+vice\s+president|head\s+of|director|senior\s+director|partner|principal)\b/i;
// "Senior Manager" / "General Manager" / "Group Manager" — clear above-IC management track.
const SENIOR_MANAGER_TITLE_RE = /\b(senior\s+manager|sr\.?\s+manager|general\s+manager|group\s+manager|associate\s+director|practice\s+lead|engineering\s+lead|tech\s+lead)\b/i;

function parseExperienceYears(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // Common bucket strings used by onboarding.
  if (s === '0-2') return 1;
  if (s === '3-5') return 4;
  if (s === '6-10') return 8;
  if (s === '10+' || s === '11+' || s === '15+') return 15;
  // Numeric prefix (e.g. "11", "12 years")
  const m = s.match(/^(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return null;
}

/**
 * Returns the deterministic minimum seniority tier implied by years + title.
 * NEVER lowers a higher LLM-supplied tier — caller takes the max.
 *
 * Title rules dominate years (an 8-year CFO is still EXECUTIVE).
 * Years rules: 15+ ⇒ at least SENIOR_LEADER, 10+ ⇒ at least SENIOR.
 */
export function computeSeniorityFloor(
  title: string | null | undefined,
  years: number | null,
): SeniorityTier {
  const t = (title || '').toLowerCase();
  if (t && EXECUTIVE_TITLE_RE.test(t)) return 'EXECUTIVE';
  if (t && SENIOR_LEADER_TITLE_RE.test(t)) return 'SENIOR_LEADER';
  if (t && SENIOR_MANAGER_TITLE_RE.test(t)) {
    // Senior/General Manager with 10+ years is a leader; below that, treat as SENIOR.
    return (years !== null && years >= 10) ? 'SENIOR_LEADER' : 'SENIOR';
  }
  if (years !== null) {
    if (years >= 15) return 'SENIOR_LEADER';
    if (years >= 10) return 'SENIOR';
    if (years >= 5) return 'MID';
  }
  return 'JUNIOR';
}

function maxTier(a: SeniorityTier, b: SeniorityTier): SeniorityTier {
  return TIER_BY_RANK[Math.max(TIER_RANK[a], TIER_RANK[b])];
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
  const llmTier = normalizeSeniority(input.seniority_tier);
  // Fix B (Audit 2026-04-30): apply deterministic floor from years + title.
  // Floor can ONLY raise the tier, never lower it.
  const years = parseExperienceYears(input.experience_years_raw ?? null);
  const floor = computeSeniorityFloor(input.current_title ?? null, years);
  const seniority = maxTier(llmTier, floor);
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
  role?: string | null;
  title?: string | null;
  // anything else passes through untouched
  [key: string]: unknown;
}

/**
 * String-token role→family inferer for cases where the LLM emits a `role`
 * but no `job_family` field. Pure, deterministic. Returns null if no match.
 *
 * Tokens deliberately overlap src/lib/role-family.ts SIGNAL_MAP — kept narrow
 * here because false positives are worse than false negatives in the eligibility
 * filter (a missed family blocks nothing; a wrong family blocks a valid pivot).
 */
const FAMILY_TOKENS: Array<{ family: string; tokens: string[] }> = [
  { family: 'marketing', tokens: ['marketing', 'brand manager', 'seo', 'sem ', 'ppc', 'growth marketer', 'demand gen', 'martech', 'performance marketer'] },
  { family: 'sales', tokens: ['sales', 'business development', 'account executive', 'account manager', 'sdr', 'bdr', 'revenue ops', 'revops'] },
  { family: 'engineering', tokens: ['software engineer', 'developer', 'devops', 'sre ', 'qa engineer', 'frontend', 'backend', 'full stack', 'fullstack', 'tech lead', 'principal engineer'] },
  { family: 'data_analytics', tokens: ['data scientist', 'data analyst', 'business analyst', 'data engineer', 'ml engineer', 'ai engineer', 'analytics manager'] },
  { family: 'finance_ops', tokens: ['finance', 'accountant', 'controller', 'auditor', 'fp&a', 'financial analyst', 'treasury'] },
  { family: 'product_design', tokens: ['product manager', 'product owner', 'ux designer', 'ui designer', 'product designer', 'design lead'] },
  { family: 'hr_people', tokens: ['human resource', 'talent acquisition', 'recruiter', 'l&d', 'hrbp', 'people partner'] },
  { family: 'creative_content', tokens: ['copywriter', 'content writer', 'editor', 'creative director', 'art director', 'video editor', 'animator'] },
  { family: 'legal_compliance', tokens: ['lawyer', 'attorney', 'paralegal', 'legal counsel', 'compliance officer'] },
  { family: 'customer_success', tokens: ['customer success', 'customer experience', 'csm ', 'support engineer', 'implementation specialist'] },
];

export function inferFamilyFromRole(role: string | null | undefined): string | null {
  const haystack = (role || '').toLowerCase();
  if (!haystack.trim()) return null;
  for (const { family, tokens } of FAMILY_TOKENS) {
    if (tokens.some((t) => haystack.includes(t))) return family;
  }
  return null;
}

/**
 * Drop pivot candidates that violate cross-card invariants:
 *  - same family as the user (would not be a "pivot")
 *  - declining market_health (cannot recommend a sinking role)
 * Kills audit-finding P1.
 *
 * If pivot.job_family is missing, infers it from pivot.role/title via
 * inferFamilyFromRole. If inference returns null we PASS the pivot (fail-open) —
 * blocking on missing data is worse than letting one slip through.
 */
export function filterEligiblePivots<T extends PivotCandidate>(
  pivots: ReadonlyArray<T>,
  ctx: Pick<AnalysisContext, 'user_role_family'>,
): T[] {
  const userFamily = (ctx.user_role_family || '').toLowerCase().trim();
  return pivots.filter((p) => {
    const explicitFam = (p.job_family || '').toString().toLowerCase().trim();
    const inferredFam = explicitFam || inferFamilyFromRole(p.role || p.title || '') || '';
    if (userFamily && inferredFam && inferredFam === userFamily) return false;
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
