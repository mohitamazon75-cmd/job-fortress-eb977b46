// ═══════════════════════════════════════════════════════════════
// SHARED: Unified Skill Classification Engine
// Single source of truth for skill categorization across ALL cards.
// Both KGPeerCard and AITimelineCard MUST use this.
// ═══════════════════════════════════════════════════════════════

import { type ScanReport, type SkillThreatIntel, normalizeTools } from '@/lib/scan-engine';
import { inferSeniorityTier } from '@/lib/seniority-utils';

// Deterministic hash for stable fallback percentages
function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

export interface ClassifiedSkill {
  name: string;
  risk: number;
  status: 'automated' | 'at-risk' | 'safe';
  replacedBy: string | null;
  weight?: number;
  estimatedMonths: number;
  actionTag: string;
  /** Deep threat intelligence from Agent 2A — null for safe/unmatched skills */
  threatIntel?: SkillThreatIntel | null;
  /** Whether this skill was directly extracted from the resume or inferred from role profile */
  source: 'extracted' | 'inferred';
}

function riskToMonths(risk: number): number {
  if (risk >= 85) return 6;
  if (risk >= 70) return 12;
  if (risk >= 55) return 24;
  if (risk >= 40) return 36;
  if (risk >= 25) return 60;
  return 84;
}

function classifyStatus(risk: number): 'automated' | 'at-risk' | 'safe' {
  if (risk >= 75) return 'automated';
  if (risk >= 40) return 'at-risk';
  return 'safe';
}

function actionTag(risk: number): string {
  if (risk >= 75) return '🔄 Learn the tool';
  if (risk >= 60) return '⚠️ Reduce exposure';
  if (risk >= 40) return '🤖 Augment';
  return '💪 Double down';
}

/** Build a lookup map from skill_threat_intel for O(1) matching */
function buildThreatIntelMap(intel: SkillThreatIntel[] | null | undefined): Map<string, SkillThreatIntel> {
  const map = new Map<string, SkillThreatIntel>();
  if (!intel) return map;
  for (const entry of intel) {
    if (entry.skill) {
      map.set(entry.skill.toLowerCase().trim(), entry);
    }
  }
  return map;
}

/**
 * Returns the CANONICAL list of classified skills for a report.
 * Every UI component must use this — no independent classification.
 */
export function classifySkills(report: ScanReport): ClassifiedSkill[] {
  const skillAdjustments = [...(report.score_breakdown?.skill_adjustments || [])].sort((a, b) => a.skill_name.localeCompare(b.skill_name));
  const tools = normalizeTools(report.ai_tools_replacing || []);
  const deadSkills = [...(report.execution_skills_dead || [])].sort();
  const moatSkills = [...(report.moat_skills || [])].sort();
  const allSkills = [...((report as any).all_skills || [])].sort();
  const executionSkills = [...((report as any).execution_skills || report.execution_skills_dead || [])].sort();
  const di = report.determinism_index || 50;

  // Build threat intel lookup from Agent 2A output
  const threatIntelMap = buildThreatIntelMap(report.skill_threat_intel);

  // Build tool lookup
  const toolMap = new Map<string, string>();
  for (const t of tools) {
    if (t.automates_task && t.automates_task !== 'Various tasks' && t.automates_task !== 'Various execution tasks') {
      toolMap.set(t.automates_task.toLowerCase(), t.tool_name);
    }
  }
  deadSkills.forEach((ds, i) => {
    if (!toolMap.has(ds.toLowerCase()) && tools[i]) {
      toolMap.set(ds.toLowerCase(), tools[i].tool_name);
    }
  });

  const results: ClassifiedSkill[] = [];
  const seenSkills = new Set<string>();

  /** Find threat intel for a skill name (fuzzy match) */
  function findThreatIntel(skillName: string): SkillThreatIntel | null {
    const key = skillName.toLowerCase().trim();
    // Exact match
    if (threatIntelMap.has(key)) return threatIntelMap.get(key)!;
    // Substring match (e.g. "SEO Optimization" matches "SEO")
    for (const [intelKey, intel] of threatIntelMap) {
      if (key.includes(intelKey) || intelKey.includes(key)) return intel;
    }
    return null;
  }

  // Priority 1: skill_adjustments (highest fidelity)
  for (const sa of skillAdjustments) {
    const key = sa.skill_name.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    const isDead = deadSkills.some(d => d.toLowerCase() === key);
    const intel = findThreatIntel(sa.skill_name);
    const toolName = intel?.threat_tool || toolMap.get(key) || (isDead ? (tools[0]?.tool_name || 'AI Tools') : null);
    results.push({
      name: sa.skill_name,
      risk: intel?.risk_pct ?? sa.automation_risk,
      status: classifyStatus(intel?.risk_pct ?? sa.automation_risk),
      replacedBy: toolName,
      weight: sa.weight,
      estimatedMonths: riskToMonths(intel?.risk_pct ?? sa.automation_risk),
      actionTag: actionTag(intel?.risk_pct ?? sa.automation_risk),
      threatIntel: intel,
      source: 'extracted',
    });
  }

  // Priority 2: dead skills not already covered
  for (const ds of deadSkills) {
    const key = ds.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    const intel = findThreatIntel(ds);
    const baseRisk = intel?.risk_pct ?? (75 + (stableHash(ds) % 15));
    results.push({
      name: ds,
      risk: baseRisk,
      status: classifyStatus(baseRisk),
      replacedBy: intel?.threat_tool || toolMap.get(key) || tools[0]?.tool_name || 'AI Agents',
      estimatedMonths: riskToMonths(baseRisk),
      actionTag: actionTag(baseRisk),
      threatIntel: intel,
      source: 'extracted',
    });
  }

  // Priority 3: moat skills
  for (const ms of moatSkills) {
    const key = ms.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    const baseRisk = 8 + (stableHash(ms) % 20);
    results.push({
      name: ms,
      risk: baseRisk,
      status: 'safe',
      replacedBy: null,
      estimatedMonths: riskToMonths(baseRisk),
      actionTag: '💪 Double down',
      threatIntel: null,
    });
  }

  // Priority 4: all_skills fallback (if sparse data)
  if (results.length < 4 && allSkills.length > 0) {
    const isExecSkill = (s: string) => executionSkills.some((e: string) => e.toLowerCase() === s.toLowerCase());
    for (const skill of allSkills) {
      if (results.length >= 10) break;
      const key = skill.toLowerCase();
      if (seenSkills.has(key)) continue;
      seenSkills.add(key);
      const intel = findThreatIntel(skill);
      const baseRisk = intel?.risk_pct ?? (isExecSkill(skill) ? Math.min(90, di + 10) : Math.max(10, Math.min(80, di)));
      results.push({
        name: skill,
        risk: baseRisk,
        status: classifyStatus(baseRisk),
        replacedBy: intel?.threat_tool || (baseRisk >= 40 ? (tools[0]?.tool_name || null) : null),
        estimatedMonths: riskToMonths(baseRisk),
        actionTag: actionTag(baseRisk),
        threatIntel: intel,
      });
    }
  }

  return results;
}

/** Convenience: get counts by status */
export function getSkillCounts(skills: ClassifiedSkill[]) {
  return {
    automated: skills.filter(s => s.status === 'automated').length,
    atRisk: skills.filter(s => s.status === 'at-risk').length,
    safe: skills.filter(s => s.status === 'safe').length,
  };
}
