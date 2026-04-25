// ═══════════════════════════════════════════════════════════════
// Forbidden-phrase scrubber — last-mile safety net
//
// Why: agent prompts forbid deterministic doom phrases like
// "by 2027 your employer will fire you", but LLMs occasionally
// leak them anyway. This is a deterministic post-processing pass
// that walks the final JSON report, finds string fields, and
// rewrites known-bad patterns into liability-safe alternatives.
//
// Keep patterns conservative — false positives hurt copy quality.
// ═══════════════════════════════════════════════════════════════

interface ScrubRule {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const RULES: ScrubRule[] = [
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

export interface ScrubResult {
  scrubbed: number;
  hits: { label: string; count: number }[];
}

/**
 * Run all rules against a single string. Returns the scrubbed string
 * and the count of replacements made (per rule).
 */
export function scrubString(input: string): { output: string; hits: Map<string, number> } {
  const hits = new Map<string, number>();
  let output = input;
  for (const rule of RULES) {
    const before = output;
    output = output.replace(rule.pattern, rule.replacement);
    if (before !== output) {
      // Count by counting matches in the pre-replacement string
      const matches = before.match(rule.pattern);
      if (matches) hits.set(rule.label, (hits.get(rule.label) ?? 0) + matches.length);
    }
  }
  return { output, hits };
}

// ───────────────────────────────────────────────────────────────
// Tool-name pattern detection
//
// Hardcoded LLM/tool product names (e.g. "GPT-5", "Claude 4 Opus",
// "Midjourney v7") rot fast and look stale within months. When a
// catalog of currently-relevant tool names is provided, replace
// any matched product-name patterns NOT in the catalog with neutral
// category language.
//
// Patterns are conservative on purpose. We do NOT match a generic
// "capability suffix" (Pro/AI/Studio/Workspace) — too high a false
// positive rate on legitimate copy.
// ───────────────────────────────────────────────────────────────

interface ToolPattern {
  pattern: RegExp;
  // Returns the replacement category phrase given the matched name.
  category: (match: string) => string;
  label: string;
}

// Category mapper — keep deliberately small and generic.
function categorize(name: string): string {
  const n = name.toLowerCase();
  if (/(midjourney|dall[- ]?e|firefly|stable\s*diffusion|imagen|flux)/i.test(n)) {
    return "image-generation tools";
  }
  if (/(runway|sora|pika|veo|kling)/i.test(n)) {
    return "video-generation tools";
  }
  if (/(devin|cursor|copilot|codeium|windsurf|cline)/i.test(n)) {
    return "AI coding assistants";
  }
  if (/(gpt|claude|gemini|llama|mistral|grok|qwen|deepseek|opus|sonnet|haiku)/i.test(n)) {
    return "frontier LLMs";
  }
  if (/(v0|bolt|lovable|replit\s*agent)/i.test(n)) {
    return "AI app builders";
  }
  return "current AI tools";
}

const TOOL_PATTERNS: ToolPattern[] = [
  // "<Name> v<digits>" or "<Name> Gen-<digits>" e.g. "Midjourney v7", "Runway Gen-4"
  {
    pattern: /\b([A-Z][A-Za-z0-9]{2,20})\s+(?:v|Gen-?)\d+(?:\.\d+)?\b/g,
    category: (m) => categorize(m),
    label: "versioned_tool_name",
  },
  // Frontier-LLM family names with version e.g. "GPT-5", "Claude 4 Opus", "Gemini 3 Pro", "Llama 4"
  {
    pattern: /\b(?:GPT-\d+(?:\.\d+)?(?:\s*(?:mini|nano|turbo))?|Claude\s+\d+(?:\.\d+)?\s*(?:Opus|Sonnet|Haiku)?|Gemini\s+\d+(?:\.\d+)?\s*(?:Pro|Flash|Ultra)?|Llama\s+\d+(?:\.\d+)?|Mistral\s+(?:Large|Medium|Small)\s+\d*|Grok-?\d+)\b/g,
    category: (m) => categorize(m),
    label: "frontier_llm_versioned",
  },
  // Standalone known-stale product names that don't carry a version suffix
  // (kept tight — only names that are unambiguously product names in context)
  {
    pattern: /\b(?:Devin|Sora|Midjourney|Runway|Firefly|DALL-?E|Cursor|Windsurf|Codeium|v0\.dev|Bolt\.new)\b/g,
    category: (m) => categorize(m),
    label: "known_tool_name",
  },
];

export interface ScrubAllOptions {
  catalog?: { tools: string[] };
}

/**
 * Returns true if the matched name is in the allow-list catalog.
 * Case-insensitive whole-name match.
 */
function inCatalog(match: string, catalog: { tools: string[] } | undefined): boolean {
  if (!catalog || !catalog.tools.length) return false;
  const m = match.trim().toLowerCase();
  return catalog.tools.some((t) => t.trim().toLowerCase() === m);
}

/**
 * Like scrubString, but also scrubs tool-name patterns absent from
 * the provided catalog. If no catalog is provided, behaves identically
 * to scrubString (only phrase rules apply).
 */
export function scrubStringAll(
  input: string,
  opts: ScrubAllOptions = {},
): { output: string; hits: Map<string, number> } {
  // First: phrase rules (unchanged).
  const phrase = scrubString(input);
  let output = phrase.output;
  const hits = new Map<string, number>(phrase.hits);

  // Second: tool-name rules (only if a catalog is supplied; without
  // one we have no way to distinguish stale-but-OK from fresh).
  if (opts.catalog) {
    for (const rule of TOOL_PATTERNS) {
      output = output.replace(rule.pattern, (match) => {
        if (inCatalog(match, opts.catalog)) return match;
        hits.set(rule.label, (hits.get(rule.label) ?? 0) + 1);
        return rule.category(match);
      });
    }
  }

  return { output, hits };
}

/**
 * Recursively walk a JSON-like value, applying `transform` to every
 * string leaf. If transform returns hits.size > 0, the parent is
 * mutated in place with the rewritten string.
 *
 * Returns aggregate hit-count map and total scrub count for the
 * caller to assemble into a ScrubResult.
 */
function walkStrings(
  node: unknown,
  transform: (s: string) => { output: string; hits: Map<string, number> },
): { aggregate: Map<string, number>; total: number } {
  const aggregate = new Map<string, number>();
  let total = 0;

  function visit(n: unknown, parent?: Record<string, unknown> | unknown[], key?: string | number): void {
    if (typeof n === "string") {
      const { output, hits } = transform(n);
      if (hits.size > 0) {
        for (const [label, count] of hits) {
          aggregate.set(label, (aggregate.get(label) ?? 0) + count);
          total += count;
        }
        if (parent !== undefined && key !== undefined) {
          // deno-lint-ignore no-explicit-any
          (parent as any)[key] = output;
        }
      }
      return;
    }
    if (Array.isArray(n)) {
      for (let i = 0; i < n.length; i++) visit(n[i], n, i);
      return;
    }
    if (n && typeof n === "object") {
      for (const k of Object.keys(n as Record<string, unknown>)) {
        visit((n as Record<string, unknown>)[k], n as Record<string, unknown>, k);
      }
    }
  }

  visit(node);
  return { aggregate, total };
}

/**
 * Recursively walk a JSON-like value and scrub all string leaves in place.
 * Mutates objects/arrays. Returns aggregate stats.
 */
export function scrubReport(report: unknown): ScrubResult {
  const { aggregate, total } = walkStrings(report, scrubString);
  return {
    scrubbed: total,
    hits: [...aggregate.entries()].map(([label, count]) => ({ label, count })),
  };
}

/**
 * Like scrubReport, but additionally scrubs tool-name patterns absent
 * from the provided catalog. Behaves identically to scrubReport when
 * no catalog is supplied.
 */
export function scrubAll(report: unknown, opts: ScrubAllOptions = {}): ScrubResult {
  const { aggregate, total } = walkStrings(report, (s) => scrubStringAll(s, opts));
  return {
    scrubbed: total,
    hits: [...aggregate.entries()].map(([label, count]) => ({ label, count })),
  };
}
