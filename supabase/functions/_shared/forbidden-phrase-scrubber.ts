// ═══════════════════════════════════════════════════════════════
// Forbidden-phrase + tool-name scrubber — last-mile safety net
//
// Two passes per string leaf:
//   1. Phrase rules (deterministic doom, absolute predictions, etc.)
//   2. Tool-name patterns ("TitleCase vN", "TitleCase N.N",
//      "TitleCase Pro/AI/Workspace") matched against the live
//      tool catalog. Anything outside the catalog → "AI tools".
//
// Why pass 2: prompts now reference {{TOOL_CATALOG}} (see
// _shared/tool-catalog.ts), but LLMs still occasionally invent
// "Midjourney v9" or attach stale version suffixes. The scrubber
// rewrites those to plausible category prose so we never ship
// "[redacted]" tokens to users.
//
// Public API:
//   scrubAll(text|report, { catalog })   — combined pass
//   scrubForbiddenPhrases(text|report)   — back-compat: phrase-only
//   scrubString / scrubReport            — back-compat: phrase-only
// ═══════════════════════════════════════════════════════════════

interface ScrubRule {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const PHRASE_RULES: ScrubRule[] = [
  // "by 2027/2028 your employer/boss/company will [verb]" — deterministic doom
  {
    pattern: /\bby\s+20\d{2}[,]?\s+your\s+(employer|boss|company|manager|team)\s+will\b/gi,
    replacement: "your $1 may",
    label: "deterministic_employer_doom",
  },
  // "you will be fired/replaced/laid off/terminated" — absolute predictions
  {
    pattern: /\byou\s+will\s+(be\s+fired|be\s+replaced|be\s+laid\s+off|lose\s+your\s+job|be\s+terminated|be\s+made\s+redundant)\b/gi,
    replacement: "your role faces pressure",
    label: "deterministic_job_loss",
  },
  // "guaranteed/certain job loss/layoff/termination"
  {
    pattern: /\b(guaranteed|certain|inevitable)\s+(job\s+loss|layoff|termination|firing|redundancy)\b/gi,
    replacement: "elevated risk",
    label: "absolute_outcome",
  },
  // "AI will replace you" — direct second-person replacement claim
  {
    pattern: /\bAI\s+will\s+replace\s+you\b/gi,
    replacement: "AI may automate parts of your role",
    label: "ai_will_replace_you",
  },
  // "your job will disappear/vanish/be eliminated by [year]"
  {
    pattern: /\byour\s+job\s+will\s+(disappear|vanish|be\s+eliminated)(\s+by\s+20\d{2})?\b/gi,
    replacement: "your job faces structural change",
    label: "job_disappearance",
  },
  // "100%/completely automated within X" — false certainty
  {
    pattern: /\b(100\s*%|completely|fully)\s+automated\s+within\s+\d+\s+(months?|years?)\b/gi,
    replacement: "increasingly automatable",
    label: "false_certainty_automation",
  },
];

// ── Tool-name patterns ────────────────────────────────────────
//
// These are the shapes we want to *consider* — actual replacement
// happens only if the matched substring is NOT in the catalog.
// Each pattern captures the full token (e.g. "Midjourney v7").
//
// We deliberately require leading TitleCase so we don't grab
// arbitrary words like "the v2 release" or "iPhone 15 Pro".
const TOOL_NAME_PATTERNS: { pattern: RegExp; label: string }[] = [
  // "Midjourney v7", "Cursor v3", "Gen-4" — version-suffix style
  {
    pattern: /\b([A-Z][a-zA-Z0-9]+(?:[-\s][A-Z][a-zA-Z0-9]+)?)\s+v\d+(?:\.\d+)?\b/g,
    label: "tool_version_suffix_v",
  },
  // "Sora 2", "GPT 5", "Claude 4" — bare numeric suffix
  {
    pattern: /\b([A-Z][a-zA-Z]+)\s+(\d+(?:\.\d+)?)\b/g,
    label: "tool_numeric_suffix",
  },
  // "GPT-5", "Gen-4", "Claude-4" — hyphenated numeric
  {
    pattern: /\b([A-Z][a-zA-Z]+)-(\d+(?:\.\d+)?)\b/g,
    label: "tool_hyphen_numeric",
  },
  // "Notion AI", "Copilot Pro", "Workspace AI" — capability suffix
  {
    pattern: /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(Pro|AI|Workspace|Studio|Plus|Ultra|Max)\b/g,
    label: "tool_capability_suffix",
  },
];

// Standalone product names that we know are real "tools" but go
// stale fast (kept conservative — only rewrite if the catalog also
// excludes the bare name).
const KNOWN_BARE_NAMES = new Set<string>([
  "Midjourney",
  "Sora",
  "Devin",
  "Cursor",
  "GPT",
]);

export interface ScrubResult {
  scrubbed: number;
  hits: { label: string; count: number }[];
}

export interface ScrubOptions {
  /** Live tool catalog (canonical names). Pass empty array to force scrub of all version-suffixed tokens. */
  catalog?: string[];
}

/**
 * Backward-compat: phrase-only string scrub.
 */
export function scrubString(input: string): { output: string; hits: Map<string, number> } {
  return runStringScrub(input, undefined);
}

/**
 * Backward-compat: phrase-only report scrub.
 */
export function scrubReport(report: unknown): ScrubResult {
  return runReportScrub(report, undefined);
}

/**
 * Combined string scrub: phrases + tool-name catalog check.
 */
export function scrubStringAll(input: string, opts: ScrubOptions = {}): { output: string; hits: Map<string, number> } {
  return runStringScrub(input, opts.catalog);
}

/**
 * Combined report scrub: phrases + tool-name catalog check.
 * Mutates the input report in place. Returns aggregate stats.
 */
export function scrubAll(report: unknown, opts: ScrubOptions = {}): ScrubResult {
  return runReportScrub(report, opts.catalog);
}

/**
 * Backward-compat alias for callers that imported scrubReport
 * by a different name in older code.
 */
export const scrubForbiddenPhrases = scrubReport;

// ── Implementation ───────────────────────────────────────────

function runStringScrub(input: string, catalog: string[] | undefined): { output: string; hits: Map<string, number> } {
  const hits = new Map<string, number>();
  let output = input;

  // Pass 1: phrase rules
  for (const rule of PHRASE_RULES) {
    const before = output;
    output = output.replace(rule.pattern, rule.replacement);
    if (before !== output) {
      const matches = before.match(rule.pattern);
      if (matches) hits.set(rule.label, (hits.get(rule.label) ?? 0) + matches.length);
    }
  }

  // Pass 2: tool-name catalog check (skipped only when catalog is undefined → back-compat).
  if (catalog !== undefined) {
    const catalogSet = buildCatalogSet(catalog);
    for (const { pattern, label } of TOOL_NAME_PATTERNS) {
      output = output.replace(pattern, (match) => {
        if (isCatalogMatch(match, catalogSet)) return match; // exact match in catalog → preserve
        // Increment hit
        hits.set(label, (hits.get(label) ?? 0) + 1);
        return "AI tools";
      });
    }
  }

  return { output, hits };
}

function runReportScrub(report: unknown, catalog: string[] | undefined): ScrubResult {
  const aggregate = new Map<string, number>();
  let totalScrubbed = 0;

  function walk(node: unknown, parent?: Record<string, unknown> | unknown[], key?: string | number): void {
    if (typeof node === "string") {
      const { output, hits } = runStringScrub(node, catalog);
      if (hits.size > 0) {
        for (const [label, count] of hits) {
          aggregate.set(label, (aggregate.get(label) ?? 0) + count);
          totalScrubbed += count;
        }
        if (parent !== undefined && key !== undefined) {
          // deno-lint-ignore no-explicit-any
          (parent as any)[key] = output;
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], node, i);
      return;
    }
    if (node && typeof node === "object") {
      for (const k of Object.keys(node as Record<string, unknown>)) {
        walk((node as Record<string, unknown>)[k], node as Record<string, unknown>, k);
      }
    }
  }

  walk(report);

  return {
    scrubbed: totalScrubbed,
    hits: [...aggregate.entries()].map(([label, count]) => ({ label, count })),
  };
}

function buildCatalogSet(catalog: string[]): Set<string> {
  // Case-insensitive set
  const out = new Set<string>();
  for (const t of catalog) {
    if (typeof t === "string" && t.trim()) out.add(t.trim().toLowerCase());
  }
  return out;
}

function isCatalogMatch(match: string, catalogSet: Set<string>): boolean {
  const norm = match.trim().toLowerCase();
  if (catalogSet.has(norm)) return true;
  // Also accept when the catalog contains the bare name AND the match is
  // a known bare-name plus suffix that's actually in the catalog as one
  // token (e.g. catalog has "Cursor v3", match is "Cursor v3").
  return false;
}

// Mark KNOWN_BARE_NAMES as referenced so the linter doesn't strip it.
// It's kept as documentation of which bare names we'd consider scrubbing
// in a future stricter pass.
void KNOWN_BARE_NAMES;
