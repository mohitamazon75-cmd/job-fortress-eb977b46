/**
 * role-normalizer.ts (Sprint 0, 2026-04-29)
 *
 * Background: Agent1 returns role_detected as a verbose human description
 * (e.g. "Digital Marketing Manager | Growth & Performance"). KG joins
 * (skill_risk_matrix.role_family, market_signals.job_family, cohort tables)
 * key on snake_case enums (e.g. "digital_marketing_manager"). The mismatch
 * causes silent join misses → empty Knowledge Graph + 0% cohort hit-rate.
 *
 * This module is the single normalization step. Pure function, no IO,
 * deterministic, fully tested. Use everywhere a detected role is about to
 * be compared against a KG enum.
 *
 * Trade-off (accepted): we strip qualifiers after the first separator
 * ("|", "·", "—", "-", ":", "/", ","). "Senior Product Manager - SaaS"
 * becomes "senior_product_manager", not "senior_product_manager_saas".
 * The KG enum set is qualifier-free; over-specific keys would never match.
 */

const SEPARATOR_RE = /[|·—:/,]| - | – | — /;

/**
 * Convert a free-text role string to a snake_case enum candidate.
 * Returns "" for unusable input (null/empty/whitespace-only).
 *
 * Rules:
 *   1. Trim, take the segment before the first separator.
 *   2. Lowercase, replace non-alphanumerics with underscores, collapse runs.
 *   3. Strip leading/trailing underscores.
 *   4. Cap at 60 chars (safety; longest legitimate enum is ~40 chars).
 */
export function normalizeRole(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";
  const head = trimmed.split(SEPARATOR_RE)[0]?.trim() ?? "";
  if (head.length === 0) return "";
  const slug = head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug;
}

/**
 * Try multiple variants of a role and return the first that matches a known
 * set. Useful when we have both Agent1's raw output and a parsed LinkedIn
 * title — try both before giving up.
 */
export function pickFirstNormalizedMatch(
  candidates: Array<string | null | undefined>,
  knownEnums: Set<string>,
): string | null {
  for (const c of candidates) {
    const n = normalizeRole(c);
    if (n && knownEnums.has(n)) return n;
  }
  return null;
}
