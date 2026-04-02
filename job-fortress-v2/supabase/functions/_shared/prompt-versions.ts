// ═══════════════════════════════════════════════════════════════
// Week 4 #8: Prompt versioning system.
// Tags every agent call with a prompt version for reproducibility.
// ═══════════════════════════════════════════════════════════════

export const PROMPT_VERSIONS: Record<string, string> = {
  "Agent1:Profiler": "v3.2.0",
  "Agent2A:Risk": "v2.1.0",
  "Agent2B:Plan": "v2.1.0",
  "Agent2C:Pivot": "v2.0.0",
  "JudoStrategy": "v1.3.0",
  "WeeklyDiet": "v1.2.0",
  "QualityEditor": "v1.1.0",
  "RiskIQ:Narrative": "v1.0.0",
  "RiskIQ:SkillExtract": "v1.0.0",
  "HindiTranslate": "v1.0.0",
};

/**
 * Get the current prompt version for an agent.
 * Falls back to "unknown" if not registered.
 */
export function getPromptVersion(agentName: string): string {
  // Strip model suffix like [gemini-3.1-pro-preview]
  const baseName = agentName.replace(/\[.*\]$/, "");
  return PROMPT_VERSIONS[baseName] || "unknown";
}

/**
 * Build a prompt metadata header to embed in report output.
 */
export function buildPromptMeta(agents: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const agent of agents) {
    meta[agent] = getPromptVersion(agent);
  }
  return meta;
}
