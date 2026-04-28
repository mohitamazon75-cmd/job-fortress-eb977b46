/**
 * Tone-lint — post-LLM mechanical check for verdict-narration-standards.
 *
 * Pure module. No I/O. Used to flag (not auto-rewrite) LLM outputs that
 * violate the "smart friend over coffee" tone contract.
 *
 * Rules enforced (per mem://style/verdict-narration-standards):
 *   1. No banned jargon words (case-insensitive, whole-word match).
 *   2. No sentence longer than MAX_WORDS_PER_SENTENCE words.
 *   3. No trailing question (insights must end on a statement).
 *
 * Returns a structured result so callers can decide: warn, block, or rewrite.
 * Does NOT mutate input. Does NOT call an LLM.
 */

export const MAX_WORDS_PER_SENTENCE = 12;

// Exhaustive banned list per mem://style/verdict-narration-standards.
// Keep this list in sync with that memory file. Whole-word, case-insensitive.
export const BANNED_WORDS: readonly string[] = [
  'depreciating',
  'leverage',
  'AI-driven systems',
  'rapidly evolving',
  'competitive landscape',
  'facilitate',
  'holistic',
  'comprehensive',
  'utilize',
  'synthesize',
  "today's landscape",
  'competitive package',
  'unique qualities',
  'valuable experience',
];

export interface ToneViolation {
  type: 'banned_word' | 'sentence_too_long' | 'trailing_question';
  detail: string;
  sentenceIndex: number; // 0-based index into splitSentences(text)
}

export interface ToneLintResult {
  ok: boolean;
  violations: ToneViolation[];
  sentences: string[];
}

/**
 * Split text into sentences. Uses naive boundary on `.`, `!`, `?` followed
 * by whitespace or end-of-string. Adequate for short LLM verdicts; not a
 * full NLP tokenizer (intentionally — Karpathy filter, no over-engineering).
 */
export function splitSentences(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Word count using whitespace split. Strips trailing punctuation per token. */
export function wordCount(sentence: string): number {
  if (!sentence) return 0;
  return sentence
    .split(/\s+/)
    .filter((tok) => tok.replace(/[^\p{L}\p{N}]/gu, '').length > 0).length;
}

/** Case-insensitive whole-phrase match. Escapes regex metachars in phrase. */
export function containsBannedPhrase(sentence: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Word boundary at start; for end allow phrase to end on letter, digit,
  // or apostrophe-containing token (e.g., "today's landscape").
  const re = new RegExp(`(^|\\s|[(\\[])${escaped}(?=$|[\\s.,!?;:)\\]])`, 'i');
  return re.test(sentence);
}

/**
 * Run the full lint. Returns ok=false if any violation is present.
 * Caller decides whether to log, block, or attach as metadata.
 */
export function lintTone(
  text: string,
  opts: { maxWords?: number; banned?: readonly string[] } = {},
): ToneLintResult {
  const maxWords = opts.maxWords ?? MAX_WORDS_PER_SENTENCE;
  const banned = opts.banned ?? BANNED_WORDS;
  const sentences = splitSentences(text);
  const violations: ToneViolation[] = [];

  sentences.forEach((sentence, i) => {
    const wc = wordCount(sentence);
    if (wc > maxWords) {
      violations.push({
        type: 'sentence_too_long',
        detail: `${wc} words (cap ${maxWords}): "${sentence}"`,
        sentenceIndex: i,
      });
    }
    for (const phrase of banned) {
      if (containsBannedPhrase(sentence, phrase)) {
        violations.push({
          type: 'banned_word',
          detail: `banned phrase "${phrase}" in: "${sentence}"`,
          sentenceIndex: i,
        });
      }
    }
    if (sentence.trim().endsWith('?')) {
      violations.push({
        type: 'trailing_question',
        detail: `insight ends on a question: "${sentence}"`,
        sentenceIndex: i,
      });
    }
  });

  return { ok: violations.length === 0, violations, sentences };
}
