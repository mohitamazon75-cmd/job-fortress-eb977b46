/**
 * tool-task-capability-map.ts — Hallucination guard for AI tool/task pairings.
 *
 * Why: The honesty audit caught the engine pairing tools with tasks they cannot
 * perform (e.g. "Playwright automates M&A modeling", "Figma replaces SQL queries").
 * Each pairing is technically sourced from the KG (Playwright IS in the skill_risk
 * matrix; M&A IS an execution skill of an exec) but the cross-product is nonsense.
 *
 * Strategy: Additive whitelist applied AFTER extractReplacingTools returns. Each
 * tool is tagged with the capability buckets it can plausibly automate; if the
 * paired task doesn't fall in those buckets, the pairing is dropped. Conservative:
 * unknown tools pass through (we don't want to delete real signal we haven't mapped).
 *
 * This file does NOT modify agent-prompts.ts (Rule 3) or det-scoring.ts.
 */

export type Capability =
  | "qa_testing"
  | "code_generation"
  | "data_analysis"
  | "writing"
  | "design"
  | "scheduling"
  | "spreadsheet"
  | "research"
  | "translation"
  | "image_video"
  | "voice"
  | "general_assistant"
  | "rpa"
  | "marketing"
  | "support";

// Tool → capability buckets it can plausibly automate.
// Lowercased keys; matched via includes() so "GitHub Copilot X" still matches "github copilot".
const TOOL_CAPABILITIES: Record<string, Capability[]> = {
  // QA / browser automation
  "playwright": ["qa_testing"],
  "selenium": ["qa_testing"],
  "cypress": ["qa_testing"],
  "puppeteer": ["qa_testing"],
  // Code-gen
  "github copilot": ["code_generation", "qa_testing"],
  "copilot": ["code_generation"],
  "cursor": ["code_generation"],
  "codeium": ["code_generation"],
  "tabnine": ["code_generation"],
  "replit": ["code_generation"],
  // General assistants
  "chatgpt": ["writing", "research", "code_generation", "general_assistant"],
  "gpt-4": ["writing", "research", "code_generation", "general_assistant"],
  "claude": ["writing", "research", "code_generation", "general_assistant"],
  "gemini": ["writing", "research", "general_assistant"],
  "perplexity": ["research"],
  // Design
  "figma ai": ["design"],
  "figma": ["design"],
  "midjourney": ["design", "image_video"],
  "dall-e": ["design", "image_video"],
  "canva": ["design", "marketing"],
  "stable diffusion": ["image_video", "design"],
  // Video / voice
  "runway": ["image_video"],
  "synthesia": ["image_video", "voice"],
  "elevenlabs": ["voice"],
  "descript": ["voice", "image_video"],
  // Data / spreadsheet
  "excel copilot": ["spreadsheet", "data_analysis"],
  "google sheets ai": ["spreadsheet", "data_analysis"],
  "tableau gpt": ["data_analysis"],
  "power bi copilot": ["data_analysis"],
  // RPA
  "uipath": ["rpa", "data_analysis"],
  "microsoft power automate": ["rpa"],
  "power automate": ["rpa"],
  "automation anywhere": ["rpa"],
  "blue prism": ["rpa"],
  "zapier": ["rpa", "scheduling"],
  // Writing / marketing
  "jasper": ["writing", "marketing"],
  "copy.ai": ["writing", "marketing"],
  "grammarly": ["writing"],
  "notion ai": ["writing", "general_assistant"],
  // Support
  "intercom fin": ["support"],
  "zendesk ai": ["support"],
  // Translation
  "deepl": ["translation", "writing"],
};

// Task/skill → capability buckets it requires from a tool.
// Matched against the lowercased task string; first match wins.
const TASK_CAPABILITIES: Array<{ pattern: RegExp; caps: Capability[] }> = [
  { pattern: /\b(unit test|integration test|e2e|qa|test automation|regression test)\b/i, caps: ["qa_testing"] },
  { pattern: /\b(boilerplate code|code review|code generation|refactor|debugging|programming|coding)\b/i, caps: ["code_generation"] },
  { pattern: /\b(data analysis|sql|reporting|dashboard|etl|analytics|excel|spreadsheet)\b/i, caps: ["data_analysis", "spreadsheet"] },
  { pattern: /\b(copywriting|content writing|blog|email writing|documentation|writing)\b/i, caps: ["writing"] },
  { pattern: /\b(visual design|ui design|graphic|illustration|wireframe|mockup)\b/i, caps: ["design"] },
  { pattern: /\b(scheduling|calendar|meeting|appointment)\b/i, caps: ["scheduling"] },
  { pattern: /\b(research|literature|competitive analysis|market research)\b/i, caps: ["research"] },
  { pattern: /\b(translation|localization|interpret)\b/i, caps: ["translation"] },
  { pattern: /\b(image|video|photo|render|animation)\b/i, caps: ["image_video"] },
  { pattern: /\b(voice|narration|podcast|audio)\b/i, caps: ["voice"] },
  { pattern: /\b(data entry|invoice processing|form filling|ticket logging|claims processing)\b/i, caps: ["rpa"] },
  { pattern: /\b(marketing|seo|sem|social media|campaign|brand)\b/i, caps: ["marketing"] },
  { pattern: /\b(customer support|helpdesk|ticket triage|first response)\b/i, caps: ["support"] },
];

function lookupToolCaps(toolName: string): Capability[] | null {
  const key = toolName.toLowerCase().trim();
  // Exact match first
  if (TOOL_CAPABILITIES[key]) return TOOL_CAPABILITIES[key];
  // Fuzzy: any registered key contained in the tool name
  for (const k of Object.keys(TOOL_CAPABILITIES)) {
    if (key.includes(k)) return TOOL_CAPABILITIES[k];
  }
  return null;
}

function lookupTaskCaps(taskName: string): Capability[] | null {
  for (const { pattern, caps } of TASK_CAPABILITIES) {
    if (pattern.test(taskName)) return caps;
  }
  return null;
}

/**
 * Returns true if the tool/task pairing is plausible.
 * Conservative: returns true when either tool or task is unknown to us
 * (we'd rather keep weak signal than delete real signal we haven't mapped).
 */
export function isPlausibleToolTaskPair(toolName: string, taskName: string): boolean {
  const toolCaps = lookupToolCaps(toolName);
  const taskCaps = lookupTaskCaps(taskName);
  if (!toolCaps || !taskCaps) return true; // unknown → keep
  return toolCaps.some((c) => taskCaps.includes(c));
}

/**
 * Filters a list of {tool_name, automates_task} pairings, dropping any
 * that fail the capability check. Logs dropped pairings for observability.
 */
export function filterImplausiblePairings<T extends { tool_name: string; automates_task: string }>(
  pairings: T[],
  context?: string,
): T[] {
  const kept: T[] = [];
  const dropped: Array<{ tool: string; task: string }> = [];
  for (const p of pairings) {
    if (isPlausibleToolTaskPair(p.tool_name, p.automates_task)) {
      kept.push(p);
    } else {
      dropped.push({ tool: p.tool_name, task: p.automates_task });
    }
  }
  if (dropped.length) {
    console.log(`[tool-task-guard] Dropped ${dropped.length} implausible pairing(s)${context ? ` [${context}]` : ""}:`, dropped);
  }
  return kept;
}
