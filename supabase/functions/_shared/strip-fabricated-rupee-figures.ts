/**
 * Deno mirror of src/lib/sanitizers/strip-fabricated-rupee-figures.ts
 *
 * WHY THIS EXISTS:
 * Several edge functions (market-radar, get-model-b-analysis) ask Gemini to
 * write personalised market signals. Even with explicit prompt rules, the
 * model occasionally writes specific rupee deltas (e.g. "₹8L–12L on the table
 * as RevOps Architect") with no source. These are credibility-killers because
 * we cannot prove the figure.
 *
 * This is a belt-and-braces guard that runs AFTER LLM parsing and strips any
 * sentence containing a ₹/lakh/L/cr figure unless the same sentence also names
 * a recognisable source.
 *
 * MUST stay byte-equivalent to src/lib/sanitizers/strip-fabricated-rupee-figures.ts
 * (which is unit-tested under vitest). If you change one, change the other.
 */

const SOURCE_KEYWORDS_RE =
  /\b(per |according to |as per |source: |sources?:|report\b|study\b|survey\b|index\b)/i;

const NAMED_OUTLETS_RE =
  /\b(mercer|aon|deloitte|naukri|linkedin|economic times|et\b|business standard|mint\b|nasscom|aim\b|inc42|moneycontrol|reuters|bloomberg|forbes|techcrunch)\b/i;

const RUPEE_FIGURE_RE = /(₹\s*\d|\d+\s*(?:L|lakh|lakhs|cr|crore|crores)\b)/i;

export function hasSourceCitation(text: string): boolean {
  return SOURCE_KEYWORDS_RE.test(text) || NAMED_OUTLETS_RE.test(text.toLowerCase());
}

export function stripFabricatedRupeeFigures(text: string | undefined): string {
  if (!text || typeof text !== "string") return text || "";
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const hasRupeeFigure = RUPEE_FIGURE_RE.test(s);
    if (!hasRupeeFigure) return true;
    return hasSourceCitation(s);
  });
  if (kept.length === 0) {
    return "Compensation signals are mixed at this seniority; check the Negotiation Anchors in your action plan for level-matched ranges.";
  }
  return kept.join(" ").trim();
}

/**
 * Walk an arbitrary JSON tree and apply stripFabricatedRupeeFigures to every
 * string leaf. Mutates in place. Skips keys that legitimately carry rupee
 * band labels (current_band/pivot_year1/director_band/salary_range/salary)
 * because those are role-tier bands the user expects to see, not personal
 * "you'll lose ₹X" claims.
 *
 * IMPORTANT: only call this when has_user_ctc === false. When the user has
 * provided CTC, personalised ₹ math is grounded and we must NOT strip it.
 */
const SKIP_KEYS = new Set([
  "current_band",
  "pivot_year1",
  "director_band",
  "salary_range",
  "salary",
  "band",
  "negotiation_anchor",
  "negotiation_anchors",
]);

export function stripRupeeFromCardData(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) stripRupeeFromCardData(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = obj[key];
    if (typeof v === "string") {
      obj[key] = stripFabricatedRupeeFigures(v);
    } else if (v && typeof v === "object") {
      stripRupeeFromCardData(v);
    }
  }
}
