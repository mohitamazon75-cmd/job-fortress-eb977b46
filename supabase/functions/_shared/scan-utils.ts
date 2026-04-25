/**
 * @fileoverview Pure utility functions for the scan pipeline.
 * Zero external dependencies — no I/O, no DB, no fetch calls.
 * Used by: process-scan/index.ts, process-scan/scan-enrichment.ts
 */

// ── Profile Completeness ──

const HIGH_VALUE_FIELDS = [
  'current_role',
  'experience_years',
  'primary_skills',
  'estimated_monthly_salary_inr',
  'industry',
  'current_company',
  'city',
] as const;

export function computeProfileCompleteness(profile: Record<string, unknown>): {
  profile_completeness_pct: number;
  profile_gaps: string[];
} {
  const gaps: string[] = [];
  let filled = 0;
  for (const field of HIGH_VALUE_FIELDS) {
    const val = profile[field];
    const present = val !== null && val !== undefined &&
                    val !== '' &&
                    !(Array.isArray(val) && val.length === 0);
    if (present) filled++;
    else gaps.push(field);
  }
  return {
    profile_completeness_pct: Math.round((filled / HIGH_VALUE_FIELDS.length) * 100),
    profile_gaps: gaps,
  };
}

// ── LinkedIn Utilities ──

const NOISY_PROFILE_SOURCE_REGEX = /(scribd|slideshare|poshmark|tripadvisor|naukri|indeed|glassdoor|quora|pinterest|reddit|facebook|instagram)/i;

export function extractLinkedinSlug(linkedinUrl: string): string {
  const slugMatch = linkedinUrl.match(/\/in\/([\w-]+)/i);
  return slugMatch ? slugMatch[1].toLowerCase() : "";
}

/**
 * Strips unverified financial/metric claims from text.
 * Prevents hallucinated numbers from entering the scoring pipeline.
 */
export function stripUnverifiedNumbers(text: string): string {
  return text
    .replace(/[\$₹€£]\s*[\d,.]+\s*[KMBT]?\b/gi, "[amount]")
    .replace(/\b\d{2,}\+?\s*(investors?|employees?|clients?|companies|customers?|users?|members?|offices?|countries)\b/gi, "[metric]")
    .replace(/(raised|funded|revenue of|worth|valued at)\s*[\$₹€£]?\s*[\d,.]+\s*[KMBT]?\b/gi, "[financial claim]");
}

/**
 * Sanitizes evidence snippets for safe inclusion in prompts.
 * Strips whitespace, removes unverified numbers, truncates.
 */
export function sanitizeEvidenceSnippet(text: string, maxLength = 500): string {
  // Import sanitizeInput inline from scan-helpers to avoid circular dependency
  const cleaned = text.replace(/\s+/g, " ").trim();
  return stripUnverifiedNumbers(cleaned).slice(0, maxLength);
}

/**
 * Determines if a search result is a trusted LinkedIn profile match.
 * Filters out noisy aggregator sites and validates slug/name overlap.
 */
export function isTrustedLinkedinResult(
  urlInput: string,
  titleInput: string,
  contentInput: string,
  slug: string,
): boolean {
  const url = String(urlInput || "").toLowerCase();
  const title = String(titleInput || "").toLowerCase();
  const content = String(contentInput || "").toLowerCase();

  if (!url.includes("linkedin.com/in/")) return false;
  if (NOISY_PROFILE_SOURCE_REGEX.test(url)) return false;

  if (slug) {
    const slugTokens = slug.split(/[-_]+/).filter((token) => token.length >= 3);
    const exactSlugMatch = url.includes(`/in/${slug}`);
    const tokenMatches = slugTokens.filter(
      (token) => url.includes(token) || title.includes(token) || content.includes(token),
    ).length;
    return exactSlugMatch || (slugTokens.length > 0 && tokenMatches >= Math.min(2, slugTokens.length));
  }

  return title.includes("linkedin") || content.includes("linkedin");
}

/** Generate a stable 31-bit positive integer seed from stable input content. */
export function deterministicSeedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

/**
 * Backwards-compatible scanId seed helper. Prefer deterministicSeedFromString()
 * with resume/profile content when reproducibility must survive across scans.
 */
export function deterministicSeedFromScanId(scanId: string): number {
  return deterministicSeedFromString(scanId);
}
