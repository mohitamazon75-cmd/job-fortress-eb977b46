// ═══════════════════════════════════════════════════════════════
// SHARED: Unified Skill Classification Engine
// Single source of truth for skill categorization across ALL cards.
// Both KGPeerCard and AITimelineCard MUST use this.
// ═══════════════════════════════════════════════════════════════

import { type ScanReport, normalizeTools } from '@/lib/scan-engine';
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
}

// Power-curve formula mirroring server's OBSOLESCENCE_POWER_CURVE logic
// Produces smooth months instead of abrupt step-function jumps
const OBSOLESCENCE_BASE_MONTHS = 60;   // Max months at 0% risk
const OBSOLESCENCE_RANGE = 50;         // How many months the curve can subtract
const OBSOLESCENCE_POWER = 1.3;        // Non-linear exponent (matches server)
const AI_ACCELERATION_RATE = 0.12;     // 12% annual compression (matches server)
const AI_BASELINE_YEAR = 2025;

function riskToMonths(risk: number): number {
  const normalizedRisk = Math.max(0, Math.min(100, risk)) / 100;
  // Power curve: higher risk = steeper month reduction
  const baseCurve = OBSOLESCENCE_BASE_MONTHS - OBSOLESCENCE_RANGE * Math.pow(normalizedRisk, OBSOLESCENCE_POWER);
  // AI acceleration compounding from baseline year
  const yearsElapsed = Math.max(0, new Date().getFullYear() - AI_BASELINE_YEAR);
  const accelerationFactor = Math.pow(1 - AI_ACCELERATION_RATE, yearsElapsed);
  const months = Math.round(baseCurve * accelerationFactor);
  return Math.max(3, Math.min(84, months));
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

  // Priority 1: skill_adjustments (highest fidelity)
  for (const sa of skillAdjustments) {
    const key = sa.skill_name.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    const isDead = deadSkills.some(d => d.toLowerCase() === key);
    const toolName = toolMap.get(key) || (isDead ? (tools[0]?.tool_name || 'AI Tools') : null);
    results.push({
      name: sa.skill_name,
      risk: sa.automation_risk,
      status: classifyStatus(sa.automation_risk),
      replacedBy: toolName,
      weight: sa.weight,
      estimatedMonths: riskToMonths(sa.automation_risk),
      actionTag: actionTag(sa.automation_risk),
    });
  }

  // Priority 2: dead skills not already covered
  for (const ds of deadSkills) {
    const key = ds.toLowerCase();
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    const baseRisk = 75 + (stableHash(ds) % 15);
    results.push({
      name: ds,
      risk: baseRisk,
      status: classifyStatus(baseRisk),
      replacedBy: toolMap.get(key) || tools[0]?.tool_name || 'AI Agents',
      estimatedMonths: riskToMonths(baseRisk),
      actionTag: actionTag(baseRisk),
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
      const baseRisk = isExecSkill(skill) ? Math.min(90, di + 10) : Math.max(10, Math.min(80, di));
      results.push({
        name: skill,
        risk: baseRisk,
        status: classifyStatus(baseRisk),
        replacedBy: baseRisk >= 40 ? (tools[0]?.tool_name || null) : null,
        estimatedMonths: riskToMonths(baseRisk),
        actionTag: actionTag(baseRisk),
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
