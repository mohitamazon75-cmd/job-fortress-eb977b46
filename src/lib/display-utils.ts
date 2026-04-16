/**
 * display-utils.ts — Pure display formatting utilities for scan output.
 *
 * Extracted from SevenCardReveal.tsx where they previously lived as
 * private functions. Centralising them:
 *   1. Makes them importable by any component that renders scan data.
 *   2. Makes them independently testable without rendering anything.
 *   3. Prevents the snake_case / third-person regressions that caused
 *      the 5.2/10 user satisfaction score from recurring silently.
 */

/**
 * Formats a skill name from LLM/database snake_case to human-readable Title Case.
 * Preserves known acronyms (AI, API, SEO, SQL, CRM, ERP, HR, RPA).
 *
 * @example fmtSkill("academic_writing")   → "Academic Writing"
 * @example fmtSkill("seo_content")        → "SEO Content"
 * @example fmtSkill("api_development")    → "API Development"
 * @example fmtSkill("")                   → ""
 */
export function fmtSkill(s: string): string {
  if (!s) return s;
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bSeo\b/g, 'SEO')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bCrm\b/g, 'CRM')
    .replace(/\bErp\b/g, 'ERP')
    .replace(/\bHr\b/g, 'HR')
    .replace(/\bRpa\b/g, 'RPA');
}

/**
 * Cleans LLM-generated advice text from third-person to second-person.
 * Strips "this professional," and "the professional," prefixes that LLMs
 * emit when the display name is not injected into the prompt correctly.
 *
 * @example cleanAdvice("this professional, integrate ChatGPT") → "Integrate ChatGPT"
 * @example cleanAdvice("The professional should upskill in AI") → "You should upskill in AI"
 * @example cleanAdvice("You should act now.")                  → "You should act now."
 */
export function cleanAdvice(text: string): string {
  if (!text) return text;
  return text
    .replace(/^this professional,?\s*/i, '')
    .replace(/^the professional,?\s*/i, '')
    .replace(/\bthis professional\b/gi, 'you')
    .replace(/\bthe professional\b/gi, 'you')
    .replace(/^([a-z])/, c => c.toUpperCase());
}
