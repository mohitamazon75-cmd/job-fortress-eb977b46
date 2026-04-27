// ═══════════════════════════════════════════════════════════════════════════
// Presentation-layer quote attribution sanitiser
// ───────────────────────────────────────────────────────────────────────────
// The LLM occasionally returns market quotes with sources that look fabricated
// (e.g. generic titles like "AI Researcher" with no named person/publication,
// or invented institutions). Because we cannot verify these at fetch time,
// we apply a UI-layer sanity check before display.
//
// Decision matrix:
//   • Source matches a credible-publication / role pattern  → render as-is.
//   • Source is a bare generic title with no named entity   → DROP source line,
//                                                              keep the quote
//                                                              (treat as paraphrase).
//   • Quote itself looks fabricated (very specific stat with
//     no source at all)                                     → suppress entire block.
//
// We DO NOT touch the LLM payload — this is purely cosmetic. The full source
// remains in the DB for audit / future calibration.
// ═══════════════════════════════════════════════════════════════════════════

/** Publications, research firms, and institution patterns we trust to render as-is. */
const TRUSTED_SOURCE_PATTERNS: RegExp[] = [
  // Major analyst firms / consultancies
  /\b(McKinsey|Gartner|Forrester|Bain|BCG|Deloitte|PwC|KPMG|EY|Accenture)\b/i,
  // Tech research / banks
  /\b(Goldman Sachs|Morgan Stanley|JP ?Morgan|Nomura)\b/i,
  // Indian sources
  /\b(NASSCOM|Naukri|JobSpeak|Indeed|TeamLease|FICCI|CII|RBI|MEITY|MCA)\b/i,
  // Press / publications
  /\b(WSJ|Wall Street Journal|FT|Financial Times|Bloomberg|Reuters|Economist|Forbes|HBR|Harvard Business Review|MIT|Stanford|TechCrunch|The Hindu|Mint|ET|Economic Times|Business Standard|Moneycontrol|Times of India|Inc42|YourStory)\b/i,
  // Government / global bodies
  /\b(World Bank|IMF|WEF|World Economic Forum|OECD|UN |UNESCO|ILO)\b/i,
  // Universities & research
  /\b(MIT|Stanford|Harvard|Oxford|Cambridge|IIT|IIM|ISB)\b/i,
  // Big tech (when cited as source of a study/announcement)
  /\b(Google|Microsoft|OpenAI|Anthropic|Meta|Apple|Amazon|IBM|Salesforce|Adobe|LinkedIn) (Research|Study|Report|Workforce|Index)\b/i,
];

/**
 * Generic role titles that — when used WITHOUT a named person or publication —
 * are the LLM's hallmark of a fabricated attribution. e.g. "AI Researcher",
 * "Industry Analyst", "Tech Expert".
 */
const GENERIC_ROLE_ONLY = /^(an?\s+)?(senior\s+|lead\s+|chief\s+|principal\s+)?(ai|tech|industry|market|hr|workforce|talent|automation|software|cloud|data)\s+(researcher|analyst|expert|strategist|consultant|leader|specialist|commentator|observer|economist)\.?$/i;

/** Publication / firm name without a person — we keep these (they're verifiable). */
const PUBLICATION_LIKE = /^(report|study|survey|index|whitepaper|briefing|analysis)\b/i;

export interface AttributionDecision {
  /** Whether to render the quote at all. */
  showQuote: boolean;
  /** Whether to render the "— source" line under the quote. */
  showSource: boolean;
  /** The source string to render (may be normalised — e.g. trimmed). */
  source: string;
}

/**
 * Decide whether a quote and its source should be displayed.
 * Pure function — no side effects. Trivially unit-testable.
 */
export function decideAttribution(
  quote: string | undefined | null,
  source: string | undefined | null,
): AttributionDecision {
  const q = (quote || "").trim();
  const s = (source || "").trim();

  if (!q || q.length < 12) {
    // No quote or trivially short — suppress entirely.
    return { showQuote: false, showSource: false, source: "" };
  }

  if (!s) {
    // Quote with no source — keep quote (still useful as framing) but no fake "— "
    return { showQuote: true, showSource: false, source: "" };
  }

  // Trusted publication / firm / institution → render as-is.
  if (TRUSTED_SOURCE_PATTERNS.some((re) => re.test(s))) {
    return { showQuote: true, showSource: true, source: s };
  }

  // Looks like a publication-type label → keep.
  if (PUBLICATION_LIKE.test(s)) {
    return { showQuote: true, showSource: true, source: s };
  }

  // Generic-role-only attribution with no named person → drop source, keep quote.
  if (GENERIC_ROLE_ONLY.test(s)) {
    return { showQuote: true, showSource: false, source: "" };
  }

  // Heuristic: a credible attribution typically includes either
  //   (a) a comma (e.g. "Jane Doe, McKinsey") OR
  //   (b) a capitalised multi-word entity (likely a name or org).
  // Anything that's just one lowercase word like "experts" → drop source.
  const hasComma = s.includes(",");
  const hasNamedEntity = /[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(s);
  if (hasComma || hasNamedEntity) {
    return { showQuote: true, showSource: true, source: s };
  }

  // Fallback: source is too vague — keep quote, drop source line.
  return { showQuote: true, showSource: false, source: "" };
}
