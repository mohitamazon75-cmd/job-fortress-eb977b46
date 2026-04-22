/**
 * prompt-safety.ts — Client-side input sanitization for any free-text field
 * that gets concatenated into an LLM prompt.
 *
 * This is defense-in-depth, NOT the only layer. The edge functions still
 * apply server-side guards. The goal here is to:
 *   1. Strip control characters and zero-width unicode (used to hide payloads).
 *   2. Collapse common prompt-injection phrases ("ignore previous instructions",
 *      "you are now", system-role markers, fake tool calls, etc.).
 *   3. Hard-cap length so a user cannot stuff 50KB into a "job title" field.
 *
 * Use `sanitizePromptInput(value, { maxLength })` in onChange handlers OR
 * just before submitting to the analysis pipeline.
 */

/** Phrases commonly used in prompt-injection attacks. Case-insensitive. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|the)\s+(instructions?|prompts?|rules?)/gi,
  /disregard\s+(all\s+)?(previous|prior|above|the)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(everything|all|previous)/gi,
  /you\s+are\s+now\s+(a\s+)?[a-z]/gi,
  /act\s+as\s+(a\s+)?(jailbroken|uncensored|dan|developer)/gi,
  /system\s*:\s*you\s+are/gi,
  /\bsystem\s+prompt\b/gi,
  /<\|?\s*(system|assistant|user|im_start|im_end)\s*\|?>/gi,
  /\[INST\]|\[\/INST\]/gi,
  /###\s*(system|instruction|response)/gi,
  /pretend\s+(you|to\s+be)/gi,
  /roleplay\s+as/gi,
];

/** Zero-width / invisible unicode often used to hide prompts. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

/** Control characters except common whitespace. */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export interface SanitizeOptions {
  /** Hard cap on output length. Default 200. */
  maxLength?: number;
  /** Collapse newlines/tabs to single spaces. Default true. */
  collapseWhitespace?: boolean;
}

/**
 * Sanitize a free-text input destined for an LLM prompt.
 * Returns a cleaned string safe to render and to ship to the model.
 */
export function sanitizePromptInput(
  raw: string | null | undefined,
  options: SanitizeOptions = {},
): string {
  if (!raw) return '';
  const { maxLength = 200, collapseWhitespace = true } = options;

  let s = String(raw);

  // 1. Strip invisible & control chars
  s = s.replace(INVISIBLE_CHARS, '').replace(CONTROL_CHARS, '');

  // 2. Neutralize injection phrases (replace with [filtered] so we don't
  //    silently drop content — the user sees their input was changed)
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[filtered]');
  }

  // 3. Collapse whitespace
  if (collapseWhitespace) {
    s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  }

  // 4. Trim and cap length
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);

  return s;
}

/**
 * Returns true if the raw input contains a likely prompt-injection signal.
 * Useful for showing a soft warning in the UI without hard-blocking.
 */
export function looksLikePromptInjection(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return INJECTION_PATTERNS.some(p => {
    p.lastIndex = 0; // reset stateful /g flag
    return p.test(raw);
  });
}
