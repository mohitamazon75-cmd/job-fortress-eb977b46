// ═══════════════════════════════════════════════════════════════
// Tokenizer — text → cleaned unigram + bigram tokens
//
// Mirrors the spirit of Resume-Matcher's textacy-based extraction
// (https://github.com/srbhr/Resume-Matcher) but in pure TS so it runs
// in both browser and Deno edge functions with zero deps.
//
// Pipeline:
//   1. Lowercase
//   2. Strip URLs, emails, phone numbers (resume noise)
//   3. Normalize unicode whitespace
//   4. Split on non-alphanumeric (keep + and # for "C++", "C#", "Node.js")
//   5. Drop pure-number tokens, single chars (except those allowlisted)
//   6. Drop stopwords
//   7. Generate bigrams from the surviving stream
//
// Why bigrams: "machine learning", "product manager", "go to market"
// are single concepts. Unigram-only loses the most important resume
// signals.
// ═══════════════════════════════════════════════════════════════

import { isStopword } from "./stopwords.ts";

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;

// Single-char tokens that ARE meaningful in resume/JD context
const ALLOWLIST_SINGLE = new Set(["c", "r", "go"]);

export interface TokenizeOptions {
  /** Include bigrams in addition to unigrams. Default: true. */
  bigrams?: boolean;
  /** Drop tokens shorter than this many chars (after the allowlist check). Default: 2. */
  minLength?: number;
}

/** Lowercase, strip URLs/emails/phones, normalize whitespace. Pure. */
export function normalizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(URL_RE, " ")
    .replace(EMAIL_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split normalized text into raw tokens, keeping +, #, and . inside words. */
export function rawSplit(normalized: string): string[] {
  if (!normalized) return [];
  // Keep alphanumerics + a few skill-bearing punctuation marks, treat
  // everything else as a separator.
  const out: string[] = [];
  let buf = "";
  for (const ch of normalized) {
    const isWord =
      (ch >= "a" && ch <= "z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "+" || ch === "#" || ch === ".";
    if (isWord) {
      buf += ch;
    } else if (buf) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  // Trim trailing dots ("node.js." → "node.js")
  return out.map((t) => t.replace(/\.+$/, "")).filter(Boolean);
}

/** Drop pure-number tokens, length-filtered, stopword-filtered. */
export function filterTokens(tokens: string[], minLength = 2): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (!t) continue;
    // Pure number? drop
    if (/^[0-9.]+$/.test(t)) continue;
    // Length filter, with allowlist exception
    if (t.length < minLength && !ALLOWLIST_SINGLE.has(t)) continue;
    if (isStopword(t)) continue;
    out.push(t);
  }
  return out;
}

/** Generate adjacent bigrams from a token stream. */
export function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

/**
 * Full pipeline: text → cleaned token stream (unigrams + optional bigrams).
 * Pure. Deterministic. No side effects.
 */
export function tokenize(text: string, opts: TokenizeOptions = {}): string[] {
  const { bigrams: includeBigrams = true, minLength = 2 } = opts;
  const normalized = normalizeText(text);
  const raw = rawSplit(normalized);
  const filtered = filterTokens(raw, minLength);
  if (!includeBigrams) return filtered;
  return [...filtered, ...bigrams(filtered)];
}
