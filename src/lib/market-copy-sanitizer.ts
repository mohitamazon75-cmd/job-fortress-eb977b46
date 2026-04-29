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
  const WEEKDAY_DEADLINE = /\bby\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    if (PERCENTILE.test(s)) return false;
    if (PREMIUM.test(s)) return false;
    if (WEEKDAY_DEADLINE.test(s)) return false;
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
 * Filter sector news items: drop entries whose headline contains a year marker
 * older than the freshness window (default: current year and current-1).
 * Keeps items with no year marker (we trust the live-market function dated them).
 */
export function filterFreshSectorNews<T extends { headline?: string }>(
  items: T[] | undefined | null,
  nowYear: number = new Date().getUTCFullYear(),
): T[] {
  if (!Array.isArray(items)) return [];
  const minYear = nowYear - 1;
  return items.filter((it) => {
    const h = it?.headline || "";
    const m = h.match(/\((\d{4})\)/);
    if (!m) return true;
    const yr = parseInt(m[1], 10);
    if (Number.isNaN(yr)) return true;
    return yr >= minYear;
  });
}
