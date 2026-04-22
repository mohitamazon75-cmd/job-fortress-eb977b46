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

/**
 * Recursively walk a JSON-like value and scrub all string leaves in place.
 * Mutates objects/arrays. Returns aggregate stats.
 */
export function scrubReport(report: unknown): ScrubResult {
  const aggregate = new Map<string, number>();
  let totalScrubbed = 0;

  function walk(node: unknown, parent?: Record<string, unknown> | unknown[], key?: string | number): void {
    if (typeof node === "string") {
      const { output, hits } = scrubString(node);
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
