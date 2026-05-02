// ═══════════════════════════════════════════════════════════════
// TF-IDF vector builder
//
// Classic formulation:
//   tf(t,d)  = count(t in d) / total tokens in d
//   idf(t)   = log( (N + 1) / (df(t) + 1) ) + 1     (smoothed, sklearn-style)
//   tfidf(t,d) = tf(t,d) * idf(t)
//
// We treat "documents" as the corpus = [resume, jd] for a 2-doc
// match. The smoothing prevents idf=0 / div-by-zero on tokens that
// appear in every doc.
//
// Pure. Deterministic. No deps.
// ═══════════════════════════════════════════════════════════════

export type TermVector = Map<string, number>;

/** Term-frequency vector for a single tokenized document. */
export function termFrequency(tokens: string[]): TermVector {
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const total = tokens.length;
  if (total === 0) return new Map();
  const tf: TermVector = new Map();
  for (const [term, count] of counts) {
    tf.set(term, count / total);
  }
  return tf;
}

/** Document-frequency map across a corpus of tokenized docs. */
export function documentFrequency(corpusTokens: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const docTokens of corpusTokens) {
    const seen = new Set(docTokens);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return df;
}

/**
 * Smoothed IDF (sklearn TfidfVectorizer default).
 * idf(t) = ln((N+1)/(df+1)) + 1
 */
export function inverseDocumentFrequency(
  totalDocs: number,
  df: Map<string, number>,
): Map<string, number> {
  const idf = new Map<string, number>();
  for (const [term, dfVal] of df) {
    idf.set(term, Math.log((totalDocs + 1) / (dfVal + 1)) + 1);
  }
  return idf;
}

/** Combine tf + idf into the final tf-idf vector for one doc. */
export function tfidfVector(
  tokens: string[],
  idf: Map<string, number>,
): TermVector {
  const tf = termFrequency(tokens);
  const out: TermVector = new Map();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 0;
    if (idfVal === 0) continue;
    out.set(term, tfVal * idfVal);
  }
  return out;
}

/** Build tf-idf vectors for an entire corpus in one shot. */
export function buildCorpus(corpusTokens: string[][]): {
  vectors: TermVector[];
  idf: Map<string, number>;
} {
  const df = documentFrequency(corpusTokens);
  const idf = inverseDocumentFrequency(corpusTokens.length, df);
  const vectors = corpusTokens.map((tokens) => tfidfVector(tokens, idf));
  return { vectors, idf };
}
