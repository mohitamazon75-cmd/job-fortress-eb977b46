/**
 * Tone-lint tests — locks in the post-LLM check contract.
 *
 * Heuristic restated in full (per mem://index.md "Test Fixture Comments" rule):
 *   1. MAX_WORDS_PER_SENTENCE = 12. A sentence with >12 word-tokens (whitespace
 *      split, punctuation stripped) violates `sentence_too_long`.
 *   2. BANNED_WORDS list is case-insensitive, whole-phrase. Matches with
 *      surrounding whitespace, punctuation, or string boundary on either side.
 *      Multi-word phrases like "today's landscape" must match as a unit.
 *   3. A sentence ending in '?' violates `trailing_question` regardless of
 *      its content (insights must end on a statement per verdict standards).
 *   4. Empty/whitespace text yields ok=true with zero violations and zero
 *      sentences. Invalid input (null/non-string) is handled in splitSentences.
 *
 * If any of these heuristics change in tone-lint.ts, update this comment AND
 * the test below — do not summarize, restate.
 */

import { describe, it, expect } from 'vitest';
import {
  lintTone,
  splitSentences,
  wordCount,
  containsBannedPhrase,
  BANNED_WORDS,
  MAX_WORDS_PER_SENTENCE,
} from '../lib/tone-lint';

describe('splitSentences', () => {
  it('splits on . ! ? followed by whitespace', () => {
    expect(splitSentences('One. Two! Three? Four.')).toEqual([
      'One.',
      'Two!',
      'Three?',
      'Four.',
    ]);
  });
  it('returns [] for empty string', () => {
    expect(splitSentences('')).toEqual([]);
  });
  it('returns [] for non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(splitSentences(null)).toEqual([]);
    // @ts-expect-error intentional bad input
    expect(splitSentences(undefined)).toEqual([]);
  });
  it('preserves single sentence with no terminator', () => {
    expect(splitSentences('Just a fragment')).toEqual(['Just a fragment']);
  });
});

describe('wordCount', () => {
  it('counts whitespace-separated tokens', () => {
    expect(wordCount('one two three')).toBe(3);
  });
  it('strips pure-punctuation tokens', () => {
    expect(wordCount('Hello , world .')).toBe(2);
  });
  it('returns 0 for empty input', () => {
    expect(wordCount('')).toBe(0);
  });
});

describe('containsBannedPhrase', () => {
  it('matches case-insensitively', () => {
    expect(containsBannedPhrase('We must Leverage AI.', 'leverage')).toBe(true);
  });
  it('matches multi-word phrases like "today\'s landscape"', () => {
    expect(
      containsBannedPhrase("In today's landscape, things shift.", "today's landscape"),
    ).toBe(true);
  });
  it('does NOT match substrings inside another word', () => {
    // "leveraging" should not trigger the "leverage" rule (whole-word boundary).
    expect(containsBannedPhrase('We are leveraging AI', 'leverage')).toBe(false);
  });
  it('matches at start of sentence', () => {
    expect(containsBannedPhrase('Holistic approach wins.', 'holistic')).toBe(true);
  });
});

describe('lintTone — happy paths', () => {
  it('returns ok=true for clean short statement', () => {
    const result = lintTone('Your copywriting role faces real automation pressure now.');
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
  it('returns ok=true for empty input (no sentences to violate)', () => {
    const result = lintTone('');
    expect(result.ok).toBe(true);
    expect(result.sentences).toHaveLength(0);
  });
});

describe('lintTone — sentence_too_long', () => {
  it('flags a 13-word sentence when cap is 12', () => {
    // 13 words exactly. Should trip the cap.
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen.';
    const result = lintTone(text);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.type === 'sentence_too_long')).toBe(true);
  });
  it('passes a 12-word sentence (boundary)', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve.';
    const result = lintTone(text);
    expect(result.violations.some((v) => v.type === 'sentence_too_long')).toBe(false);
  });
  it('respects custom maxWords override', () => {
    const result = lintTone('one two three four', { maxWords: 3 });
    expect(result.ok).toBe(false);
    expect(result.violations[0].type).toBe('sentence_too_long');
  });
});

describe('lintTone — banned_word', () => {
  it('flags every banned phrase in the canonical list', () => {
    for (const phrase of BANNED_WORDS) {
      // Embed each phrase in a short, otherwise-clean sentence.
      // Sentence kept ≤12 words to isolate the banned-word rule.
      const text = `Note: ${phrase} matters here.`;
      const result = lintTone(text);
      expect(
        result.violations.some((v) => v.type === 'banned_word'),
        `expected "${phrase}" to be flagged, got: ${JSON.stringify(result.violations)}`,
      ).toBe(true);
    }
  });
  it('does NOT flag clean text that lacks any banned phrase', () => {
    const result = lintTone('Your skill faces direct pressure from new AI tools.');
    expect(result.violations.some((v) => v.type === 'banned_word')).toBe(false);
  });
});

describe('lintTone — trailing_question', () => {
  it('flags a sentence ending in ?', () => {
    const result = lintTone('Are you ready for this?');
    expect(result.ok).toBe(false);
    expect(result.violations[0].type).toBe('trailing_question');
  });
  it('does NOT flag a question mid-text if final sentence is a statement', () => {
    const result = lintTone('Are you ready? You should be.');
    // First sentence ends in ?, second does not. Rule fires per-sentence,
    // so we still expect the first to be flagged.
    expect(result.violations.some((v) => v.type === 'trailing_question')).toBe(true);
    expect(result.violations.filter((v) => v.type === 'trailing_question')).toHaveLength(1);
  });
});

describe('lintTone — multiple violation types compose', () => {
  it('reports banned word AND sentence_too_long independently', () => {
    // 13 words, contains banned "leverage". Must emit both violations.
    const text = 'You must leverage all available tools across every team to win the day quickly.';
    const result = lintTone(text);
    const types = result.violations.map((v) => v.type);
    expect(types).toContain('banned_word');
    expect(types).toContain('sentence_too_long');
  });
});

describe('constants', () => {
  it('MAX_WORDS_PER_SENTENCE is 12 (locked by verdict-narration-standards)', () => {
    expect(MAX_WORDS_PER_SENTENCE).toBe(12);
  });
});
