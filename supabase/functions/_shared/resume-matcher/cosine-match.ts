// ═══════════════════════════════════════════════════════════════
// Cosine similarity + skill-gap delta
//
// cosine(a,b) = (a · b) / (||a|| * ||b||)
//
// Returns a similarity score in [0, 1] where:
//   1.0 = identical term distribution
//   0.0 = no shared terms
//
// Skill-gap delta = JD terms (top-K by tfidf weight) NOT present in
// the resume's tokenized stream. This is the "missing keywords" list
// that drives the Weaponizer's STAR-rewrite suggestions.
// ═══════════════════════════════════════════════════════════════

import type { TermVector } from "./tfidf";

/** Cosine similarity between two sparse term vectors. Returns [0, 1]. */
export function cosineSimilarity(a: TermVector, b: TermVector): number {
  if (a.size === 0 || b.size === 0) return 0;

  // Iterate the smaller map for the dot product
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  if (dot === 0) return 0;

  let normA = 0;
  for (const w of a.values()) normA += w * w;
  let normB = 0;
  for (const w of b.values()) normB += w * w;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  // Clamp against floating-point overshoot
  return Math.min(1, Math.max(0, dot / denom));
}

export interface KeywordGap {
  /** Terms present in the JD with high weight that are MISSING from the resume. */
  missing: Array<{ term: string; weight: number }>;
  /** Terms present in BOTH the JD and the resume. */
  matched: Array<{ term: string; jdWeight: number; resumeWeight: number }>;
}

/**
 * Compute the keyword gap between a JD vector and a resume vector.
 *
 * Pure. Deterministic. Sort is stable: by weight DESC, then term ASC
 * to keep test snapshots reproducible across runs.
 */
export function keywordGap(
  jdVector: TermVector,
  resumeVector: TermVector,
  opts: { topMissing?: number; topMatched?: number } = {},
): KeywordGap {
  const { topMissing = 20, topMatched = 20 } = opts;

  const missingArr: Array<{ term: string; weight: number }> = [];
  const matchedArr: Array<{ term: string; jdWeight: number; resumeWeight: number }> = [];

  for (const [term, jdWeight] of jdVector) {
    const resumeWeight = resumeVector.get(term);
    if (resumeWeight === undefined) {
      missingArr.push({ term, weight: jdWeight });
    } else {
      matchedArr.push({ term, jdWeight, resumeWeight });
    }
  }

  const cmpDesc = (a: { weight?: number; jdWeight?: number; term: string }, b: typeof a) => {
    const wa = (a.weight ?? a.jdWeight ?? 0);
    const wb = (b.weight ?? b.jdWeight ?? 0);
    if (wb !== wa) return wb - wa;
    return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
  };

  missingArr.sort(cmpDesc);
  matchedArr.sort(cmpDesc);

  return {
    missing: missingArr.slice(0, topMissing),
    matched: matchedArr.slice(0, topMatched),
  };
}
