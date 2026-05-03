/**
 * resume-grounded-rupee-verifier.ts (Path C v3, 2026-05-03)
 *
 * WHY THIS EXISTS
 * ===============
 * Path C v2.5 stress test (96 scans) showed:
 *   - Pipeline success: 99.0% ✅
 *   - Per-scan figure hallucination rate: ~16% if measured naively
 *   - True hallucination rate after Pattern A/B exclusion: 2-5 figures across
 *     219 figures emitted, all in narrative-flavor fields like
 *     `immediate_next_step.action`, `dead_end_narrative`, `moat_narrative`.
 *
 * The existing `stripFabricatedRupeeFigures` is sentence-keyword based and is
 * **gated off** when the user provided CTC (because the prompt is then
 * permitted to do personalised ₹ math). That gate is exactly where the
 * remaining hallucinations slip through: the LLM restates user CTC in a
 * grounded way 7 times AND fabricates a value-add figure 2 times in the same
 * scan, and we let both pass.
 *
 * This module is the always-on, numerically-aware second layer. It runs
 * AFTER LLM parsing on every scan output regardless of CTC presence.
 *
 * CONTRACT
 * --------
 * A sentence containing a ₹/lakh/L/cr figure is KEPT iff at least one is true:
 *   1. The sentence carries a provenance tag we recognise:
 *        [RESUME-ANCHOR], [USER-PROVIDED], [ESTIMATED],
 *        [Deterministic Engine], [DETERMINISTIC ENGINE]
 *   2. The sentence carries a source citation (existing keyword/outlet check).
 *   3. Every numeric figure in the sentence can be grounded against the
 *      provided context (resume raw text + user monthly CTC).
 *
 * Otherwise the sentence is DROPPED. If every sentence is dropped, return a
 * safe directional fallback (NEVER an empty string — would render as a blank
 * UI block).
 *
 * "Grounding" rules for rule 3:
 *   - User monthly CTC `m` (rupees) grounds these annualised figures (in L):
 *       round1(m*12/1e5), round1(m*24/1e5), round1(m*36/1e5)
 *     and the same in cr for high earners. Tolerance ±0.5 L.
 *   - User monthly CTC also grounds the literal monthly rupee figure
 *     (e.g. "₹2,03,700/month") within ±5%.
 *   - Resume raw text grounds any figure whose canonical token (e.g. "16.8",
 *     "16.8L", "16.8 lakh", "1.68 cr") appears verbatim (case-insensitive,
 *     whitespace-normalised) in the resume text.
 *
 * DESIGN NOTES (Karpathy: verify-before-scale)
 * --------------------------------------------
 * - Pure function. No IO. Fully deterministic. Fully tested.
 * - Fail-CLOSED: any figure we cannot ground is removed. Better to drop a
 *   true sentence than to ship a fabricated one. This is a credibility
 *   product; one bad ₹ figure costs more than ten missing ones.
 * - Skip-keys list mirrors the existing sanitizer (band labels are role-tier
 *   bands, not personal claims, and must be preserved).
 * - The Deno mirror lives at supabase/functions/_shared/resume-grounded-rupee-verifier.ts
 *   and MUST stay byte-equivalent. CI does not yet check this; do it manually.
 */

const SOURCE_KEYWORDS_RE =
  /\b(per |according to |as per |source: |sources?:|report\b|study\b|survey\b|index\b)/i;

const NAMED_OUTLETS_RE =
  /\b(mercer|aon|deloitte|naukri|linkedin|economic times|et\b|business standard|mint\b|nasscom|aim\b|inc42|moneycontrol|reuters|bloomberg|forbes|techcrunch)\b/i;

// Provenance tags emitted by our own prompts/det engine. Presence of any tag
// means upstream has stamped this figure as grounded — we trust and pass.
const PROVENANCE_TAG_RE =
  /\[(RESUME-ANCHOR|USER-PROVIDED|ESTIMATED|DETERMINISTIC ENGINE|Deterministic Engine)\]/;

// Captures any rupee-shaped figure. Three forms we care about:
//   ₹16.8L, ₹2,03,700, 16.8 L, 16.8 lakh, 1.68 cr, 100Cr
// Group 1: numeric token (with optional Indian comma grouping or decimal)
// Group 2: optional unit (L/lakh/cr)
const RUPEE_FIGURE_GLOBAL_RE =
  /(?:₹\s*)?(\d+(?:[,\d]*\d)?(?:\.\d+)?)\s*(L|lakh|lakhs|cr|crore|crores)?\b/gi;

// Used only to short-circuit "does this sentence contain a ₹ thing at all".
const RUPEE_FIGURE_RE = /(₹\s*\d|\d+\s*(?:L|lakh|lakhs|cr|crore|crores)\b)/i;

const SKIP_KEYS = new Set([
  "current_band",
  "pivot_year1",
  "director_band",
  "salary_range",
  "salary",
  "band",
  "negotiation_anchor",
  "negotiation_anchors",
  // Role-tier band rows: deterministic seniority anchors, not personal claims.
  // The `range` strings (e.g., "₹18-28L") are pre-computed role-level bands and
  // must NOT be sentence-stripped by the grounding verifier (it has no way to
  // ground them against resume/CTC and would replace them with SAFE_FALLBACK).
  "salary_bands",
  "range",
]);

const SAFE_FALLBACK =
  "Compensation signals are mixed at this seniority; check the Negotiation Anchors in your action plan for level-matched ranges.";

export interface GroundingContext {
  /** Monthly CTC in rupees (e.g. 140000 for ₹1.4L/month). Optional. */
  userMonthlyCtcInr?: number | null;
  /** Resume raw text — used to verify any figure literally present in resume. */
  resumeRawText?: string | null;
}

export function hasSourceCitation(text: string): boolean {
  return SOURCE_KEYWORDS_RE.test(text) || NAMED_OUTLETS_RE.test(text.toLowerCase());
}

export function hasProvenanceTag(text: string): boolean {
  return PROVENANCE_TAG_RE.test(text);
}

/** Parse a numeric token like "16.8", "2,03,700", "1.68" into a plain number. */
function parseFigure(token: string): number | null {
  const cleaned = token.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Convert a parsed figure + unit into rupees. "16.8" + "L" → 1_680_000. */
function toRupees(value: number, unit: string | undefined): number {
  const u = (unit || "").toLowerCase();
  if (u.startsWith("l")) return value * 100_000;
  if (u.startsWith("c")) return value * 10_000_000;
  // No unit — treat as a literal rupee figure (e.g. "₹2,03,700").
  return value;
}

/** Approximate equality with relative tolerance (default ±5%). */
function approxEq(a: number, b: number, relTol = 0.05): boolean {
  if (a === 0 && b === 0) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= relTol;
}

/**
 * Decide whether a single ₹ figure is grounded against the given context.
 * Three independent grounding paths, ANY of which is sufficient:
 *   A. Matches user CTC × {12, 24, 36} (annualised), or matches monthly CTC,
 *      within tolerance.
 *   B. The numeric token (with or without unit) appears in the resume text.
 */
export function isFigureGrounded(
  rupees: number,
  rawToken: string,
  unit: string | undefined,
  ctx: GroundingContext,
): boolean {
  // Path A: user CTC math.
  const m = ctx.userMonthlyCtcInr;
  if (m && m > 0) {
    if (approxEq(rupees, m, 0.05)) return true;          // monthly literal
    if (approxEq(rupees, m * 12, 0.05)) return true;     // 1-year CTC
    if (approxEq(rupees, m * 24, 0.07)) return true;     // 2-year CTC (looser)
    if (approxEq(rupees, m * 36, 0.07)) return true;     // 3-year CTC (looser)
  }

  // Path B: resume text contains this exact token.
  const resume = ctx.resumeRawText;
  if (resume && resume.length > 0) {
    const haystack = resume.toLowerCase();
    const needles = [
      rawToken.toLowerCase(),
      `${rawToken}${unit ?? ""}`.toLowerCase(),
      `${rawToken} ${unit ?? ""}`.toLowerCase().trim(),
    ].filter((s) => s && s.length >= 2);
    for (const needle of needles) {
      if (haystack.includes(needle)) return true;
    }
  }

  return false;
}

/** Extract all rupee figures from a sentence. */
export function extractFigures(
  sentence: string,
): Array<{ rupees: number; rawToken: string; unit: string | undefined }> {
  const out: Array<{ rupees: number; rawToken: string; unit: string | undefined }> = [];
  const re = new RegExp(RUPEE_FIGURE_GLOBAL_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(sentence)) !== null) {
    const rawToken = match[1];
    const unit = match[2];
    // Filter out year-shaped tokens that aren't ₹ figures: e.g. "2026" with
    // no ₹ prefix and no L/cr suffix should NOT be treated as rupees.
    const hasRupeePrefix = /₹/.test(match[0]);
    if (!hasRupeePrefix && !unit) continue;
    const value = parseFigure(rawToken);
    if (value === null) continue;
    out.push({ rupees: toRupees(value, unit), rawToken, unit });
  }
  return out;
}

/** Sentence-level keep/drop decision under the verifier contract. */
export function shouldKeepSentence(sentence: string, ctx: GroundingContext): boolean {
  if (!RUPEE_FIGURE_RE.test(sentence)) return true;       // no ₹ → trivially keep
  if (hasProvenanceTag(sentence)) return true;            // tag → trust upstream
  if (hasSourceCitation(sentence)) return true;           // outlet/source → keep
  const figures = extractFigures(sentence);
  if (figures.length === 0) return true;                  // false alarm
  // Every figure must be grounded.
  return figures.every((f) => isFigureGrounded(f.rupees, f.rawToken, f.unit, ctx));
}

/**
 * Strip ungrounded ₹ sentences from a free-text string.
 * Always-on: callable regardless of whether user CTC is known.
 */
export function verifyAndStripText(text: string | undefined, ctx: GroundingContext): string {
  if (!text || typeof text !== "string") return text || "";
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => shouldKeepSentence(s, ctx));
  if (kept.length === 0) return SAFE_FALLBACK;
  return kept.join(" ").trim();
}

/**
 * Walk an arbitrary JSON tree and apply verifyAndStripText to every string
 * leaf. Mutates in place. Skips keys that carry role-tier band labels (those
 * are pre-computed bands, not personalised claims).
 *
 * Always-on (unlike the older stripRupeeFromCardData which was gated on
 * !has_user_ctc). Safe because the grounding context handles CTC-derived
 * figures explicitly via Path A.
 */
export function verifyAndStripCardData(node: unknown, ctx: GroundingContext): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) verifyAndStripCardData(item, ctx);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = obj[key];
    if (typeof v === "string") {
      obj[key] = verifyAndStripText(v, ctx);
    } else if (v && typeof v === "object") {
      verifyAndStripCardData(v, ctx);
    }
  }
}
