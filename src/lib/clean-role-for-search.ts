/**
 * @fileoverview cleanRoleForSearch
 *
 * Strips LLM/profile decoration from a role string so it works as a search
 * keyword on Adzuna `what=`, LinkedIn `keywords=`, Naukri search etc.
 *
 * Background (P1-Fix-D, 2026-05-02 audit):
 *   role_detected often comes back from Agent 1 like:
 *     "Senior Manager – BD | Strategic Accounts (Pune)"
 *     "Software Engineer / Backend & Platform"
 *     "Marketing Manager - B2B SaaS"
 *   These dirty strings produce 0-result Adzuna queries (Card 7 demand "0")
 *   and break LinkedIn DM CTAs.
 *
 * Rule: take the first segment before any of: |, /, &, –, —, -, (, [, ,
 *       then strip role-decoration words and collapse whitespace.
 *
 * This is a pure module (no Deno/Node imports) so it can be:
 *   - imported by Vite (Card 3, debug pages)
 *   - imported by Deno edge functions via a thin re-export
 *   - tested under vitest
 */

const SPLIT_RE = /[|/&\-–—(\[,]/;

const DECORATION_WORDS = new Set([
  "professional",
  "specialist",
  "expert",
  "consultant",
  "general",
  "generalist",
  "individual contributor",
  "ic",
]);

/**
 * Clean a role string for use as a search keyword.
 *
 * @param raw Anything: undefined, "", "Senior Manager – BD | Strategic Accounts"
 * @param fallback returned when input is empty/unparseable. Default "professional".
 */
export function cleanRoleForSearch(
  raw: unknown,
  fallback: string = "professional",
): string {
  if (typeof raw !== "string") return fallback;

  // 1. take first segment
  let s = raw.split(SPLIT_RE)[0] ?? "";

  // 2. trim + collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return fallback;

  // 3. lowercase compare to drop decoration words at the tail (NOT at the head —
  //    "Specialist Counsel" is a real role, but "Marketing Specialist" → "Marketing"
  //    is too aggressive). We only drop a SINGLE trailing decoration token.
  const tokens = s.split(" ");
  const last = tokens[tokens.length - 1]?.toLowerCase().replace(/[^a-z]/g, "");
  if (last && DECORATION_WORDS.has(last) && tokens.length > 1) {
    tokens.pop();
    s = tokens.join(" ");
  }

  // 4. final guard
  s = s.trim();
  if (!s || s.length < 2) return fallback;

  // 5. cap length (Adzuna chokes on huge `what=` strings)
  if (s.length > 80) s = s.slice(0, 80).trim();

  return s;
}
