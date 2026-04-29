/**
 * market-copy-sanitizer.ts
 *
 * Round-5 trust fixes (2026-04-29). Pure functions, no LLM, fully deterministic.
 *
 * Strips two classes of hallucinations from LLM-generated market copy:
 *   1. Numeric salary claims that contradict the live salary band (Bug C).
 *      e.g. key_insight says "₹30L+ averages" while live band shows median ₹15L.
 *   2. Fake percentile / percentage-premium / weekday-deadline noise (Bug H).
 *      e.g. "top 15th percentile", "missing out on 25% premium",
 *      "Update your LinkedIn by Wednesday".
 *
 * Conservative philosophy: when in doubt, KEEP the sentence. Only strip when
 * we have high confidence the sentence is contradicting source-of-truth data
 * or matches a known hallucination pattern.
 */

export interface LiveBand {
  min: number;
  max: number;
  median: number;
}

// NOTE: every regex below is intentionally created LOCAL to the function that
// uses it. Module-level /g regexes carry .lastIndex state across calls and
// silently skip matches when reused — caused a "should drop ₹30L+" false-pass
// during round-5 dev. Don't lift these to module scope.

/**
 * Strip sentences whose absolute ₹ amount is >2× the live band's median.
 * E.g. with median ₹15L, "₹30L+ averages" gets dropped because 30 > 15*2 = 30.
 * Threshold uses strict `>=` so 2× exactly is also dropped (the contradiction
 * is loudest when the LLM doubles the median to invent a "premium").
 */
export function suppressContradictorySalary(text: string, band: LiveBand | undefined | null): string {
  if (!text || !band || !band.median || band.median <= 0) return text || "";
  const ceiling = Math.max(band.max, band.median * 2);
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const re = /(?:₹|Rs\.?\s?|INR\s?)\s?(\d+(?:\.\d+)?)\s?(L|LPA|Lakh|Cr)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const amount = parseFloat(m[1]);
      const unit = (m[2] || "").toLowerCase();
      if (!unit.startsWith("l")) continue; // ignore "Cr" or unitless mentions
      if (amount >= ceiling) return false;
    }
    return true;
  });
  return kept.join(" ").trim();
}

/** Strip known hallucination patterns. Returns sanitised text (may be empty). */
export function stripHallucinations(text: string): string {
  if (!text) return "";
  // Patterns are local (not module-level) — /g regexes carry .lastIndex state
  // across calls and silently skip matches. Don't lift them out.
  const PERCENTILE = /\btop\s+\d+(?:st|nd|rd|th)?\s+percentile\b/i;
  const PREMIUM = /\b(?:missing out on|missing)\s+(?:a\s+)?\d+%\s+(?:salary\s+)?premium\b/i;
  const WEEKDAY_DEADLINE = /\bby\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?\b/i;
  // Round-6: "Inaction costs you ₹5L in annual growth" — fabricated cost claim.
  const INACTION_COST = /\b(?:inaction\s+costs?|costing\s+you|losing\s+you)\s+(?:you\s+)?(?:₹|Rs\.?\s?|INR\s?)?\s?\d+(?:\.\d+)?\s?(?:L|LPA|Lakh|Cr|crore|%)/i;
  // Round-6: "missing out on the 67% growth in AI-integrated marketing roles"
  // — fabricated growth-percentage claim. Only strip when paired with "missing".
  const MISSING_GROWTH = /\bmissing(?:\s+out)?\s+(?:on\s+)?(?:the\s+)?\d+%\s+growth\b/i;
  // Round-6: "command(s) a (significant) premium" — qualitative invented claim.
  const QUALITATIVE_PREMIUM = /\bcommand[s]?\s+(?:a\s+)?(?:significant\s+|substantial\s+|notable\s+)?premium\b/i;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    if (PERCENTILE.test(s)) return false;
    if (PREMIUM.test(s)) return false;
    if (WEEKDAY_DEADLINE.test(s)) return false;
    if (INACTION_COST.test(s)) return false;
    if (MISSING_GROWTH.test(s)) return false;
    if (QUALITATIVE_PREMIUM.test(s)) return false;
    return true;
  });
  return kept.join(" ").trim();
}

/** Compose: strip both, in order. */
export function sanitiseMarketCopy(text: string | undefined | null, band?: LiveBand | null): string {
  if (!text) return "";
  return stripHallucinations(suppressContradictorySalary(text, band));
}

/**
 * Filter sector news items.
 *
 * Round-6 (2026-04-29): tighten freshness — was only filtering by year marker
 * in the headline, which let "(2025)" items render under a "LAST 21 DAYS" label
 * even when 8+ months old. Now:
 *   1. If item has `published_at` (ISO date) → drop if > maxAgeDays.
 *   2. Else if headline has "(YYYY)" marker → drop if year < currentYear.
 *      (Stricter than before: must be the SAME year, not currentYear-1.)
 *   3. Else keep (we trust the live-market function dated it within window).
 */
export function filterFreshSectorNews<T extends { headline?: string; published_at?: string | null }>(
  items: T[] | undefined | null,
  nowYear: number = new Date().getUTCFullYear(),
  maxAgeDays: number = 30,
  now: Date = new Date(),
): T[] {
  if (!Array.isArray(items)) return [];
  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter((it) => {
    if (it?.published_at) {
      const t = Date.parse(it.published_at);
      if (!Number.isNaN(t)) return t >= cutoffMs;
    }
    const h = it?.headline || "";
    const m = h.match(/\((\d{4})\)/);
    if (m) {
      const yr = parseInt(m[1], 10);
      if (!Number.isNaN(yr)) return yr >= nowYear;
    }
    return true;
  });
}

/**
 * Pick the freshness label that honestly matches the items being shown.
 * If items carry `published_at`, returns the actual oldest-item age.
 * Otherwise falls back to the caller's default label.
 */
export function freshnessLabel<T extends { published_at?: string | null }>(
  items: T[] | undefined | null,
  fallback: string = "RECENT",
  now: Date = new Date(),
): string {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  let oldestMs = Infinity;
  for (const it of items) {
    if (it?.published_at) {
      const t = Date.parse(it.published_at);
      if (!Number.isNaN(t) && t < oldestMs) oldestMs = t;
    }
  }
  if (oldestMs === Infinity) return fallback;
  const days = Math.max(1, Math.ceil((now.getTime() - oldestMs) / (24 * 60 * 60 * 1000)));
  return `LAST ${days} DAYS`;
}
