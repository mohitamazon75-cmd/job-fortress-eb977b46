// ═══════════════════════════════════════════════════════════════
// Resume-Matcher (TS port) — public API
//
// Deterministic resume↔JD scoring engine ported from the algorithmic
// core of srbhr/Resume-Matcher (Apache-2.0). Runs in browser + Deno.
// Zero deps, zero LLM calls, zero ongoing cost.
//
// Use cases inside JobBachao (B2 plan):
//   B2.2 — shadow-score every parse vs Affinda for parity measurement
//   B2.3 — promote to primary parser/scorer once parity is proven
//   B2.4 — power Resume Weaponizer's keyword-gap step (saves LLM tokens)
//
// This module owns ZERO state and never throws on bad input — empty
// strings return zero-score, never errors. That keeps it safe to wire
// into the parsing critical path behind a feature flag.
// ═══════════════════════════════════════════════════════════════

import { tokenize, type TokenizeOptions } from "./tokenize";
import { buildCorpus } from "./tfidf";
import { cosineSimilarity, keywordGap, type KeywordGap } from "./cosine-match";

export interface MatchOptions extends TokenizeOptions {
  /** Top-N missing keywords to surface. Default 20. */
  topMissing?: number;
  /** Top-N matched keywords to surface. Default 20. */
  topMatched?: number;
}

export interface MatchResult {
  /** Cosine similarity in [0, 100], integer. */
  score: number;
  /** Raw cosine in [0, 1] for downstream use. */
  rawSimilarity: number;
  /** Keyword overlap + gap analysis. */
  keywords: KeywordGap;
  /** Total tokens after filter for each side — useful for sanity checks. */
  diagnostics: {
    resumeTokens: number;
    jdTokens: number;
  };
}

/** Empty/safe result returned when either input is empty. */
const EMPTY_RESULT: MatchResult = {
  score: 0,
  rawSimilarity: 0,
  keywords: { missing: [], matched: [] },
  diagnostics: { resumeTokens: 0, jdTokens: 0 },
};

/**
 * Score a resume against a job description. Pure. Deterministic.
 *
 * Returns a 0–100 score plus the keyword gap. NEVER throws — bad
 * input becomes a zero-score result so callers can wire this in
 * behind a feature flag without try/catch.
 */
export function matchResumeToJD(
  resumeText: string,
  jdText: string,
  opts: MatchOptions = {},
): MatchResult {
  if (!resumeText || !jdText || typeof resumeText !== "string" || typeof jdText !== "string") {
    return EMPTY_RESULT;
  }

  const resumeTokens = tokenize(resumeText, opts);
  const jdTokens = tokenize(jdText, opts);

  if (resumeTokens.length === 0 || jdTokens.length === 0) {
    return {
      ...EMPTY_RESULT,
      diagnostics: { resumeTokens: resumeTokens.length, jdTokens: jdTokens.length },
    };
  }

  const { vectors } = buildCorpus([resumeTokens, jdTokens]);
  const [resumeVec, jdVec] = vectors;

  const sim = cosineSimilarity(resumeVec, jdVec);
  const gap = keywordGap(jdVec, resumeVec, {
    topMissing: opts.topMissing,
    topMatched: opts.topMatched,
  });

  return {
    score: Math.round(sim * 100),
    rawSimilarity: sim,
    keywords: gap,
    diagnostics: {
      resumeTokens: resumeTokens.length,
      jdTokens: jdTokens.length,
    },
  };
}

// Re-exports for direct use
export { tokenize, normalizeText } from "./tokenize";
export { cosineSimilarity, keywordGap } from "./cosine-match";
export { buildCorpus, termFrequency } from "./tfidf";
export type { TermVector } from "./tfidf";
export type { KeywordGap } from "./cosine-match";
