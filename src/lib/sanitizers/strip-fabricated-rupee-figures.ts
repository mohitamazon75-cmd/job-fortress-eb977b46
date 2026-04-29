/**
 * Pure mirror of the sanitizer used in supabase/functions/market-radar/index.ts.
 *
 * WHY THIS EXISTS:
 * The market-radar edge function asks Gemini to write personalised market signals.
 * Despite explicit prompt rules forbidding it, the model occasionally writes
 * specific rupee deltas (e.g. "₹8L–12L on the table as RevOps Architect") with
 * no source. These are credibility-killers — every one of them is fabricated
 * because the function does NOT pass user CTC into the prompt.
 *
 * This sanitizer is a belt-and-braces guard that runs AFTER LLM parsing and
 * strips any sentence containing a ₹/lakh/L/cr figure unless the same sentence
 * also names a recognisable source. It is exported here as a pure function so
 * we can unit-test it without spinning up Deno.
 *
 * The Deno copy in market-radar/index.ts is byte-for-byte equivalent (modulo
 * import-style differences). If you change one, change the other.
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
