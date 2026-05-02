// Deno mirror of src/lib/clean-role-for-search.ts
// Keep these two files byte-equivalent below the comment header.
// See src/test/clean-role-for-search.test.ts for the canonical tests.

const SPLIT_RE = /[|/&\\-–—(\\[,]/;

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

export function cleanRoleForSearch(
  raw: unknown,
  fallback: string = "professional",
): string {
  if (typeof raw !== "string") return fallback;
  let s = raw.split(SPLIT_RE)[0] ?? "";
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return fallback;
  const tokens = s.split(" ");
  const last = tokens[tokens.length - 1]?.toLowerCase().replace(/[^a-z]/g, "");
  if (last && DECORATION_WORDS.has(last) && tokens.length > 1) {
    tokens.pop();
    s = tokens.join(" ");
  }
  s = s.trim();
  if (!s || s.length < 2) return fallback;
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s;
}
