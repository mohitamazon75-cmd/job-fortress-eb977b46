// ═══════════════════════════════════════════════════════════════
// SENIORITY-AWARE LABEL + COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════

export type SeniorityTier = 'EXECUTIVE' | 'SENIOR_LEADER' | 'MANAGER' | 'PROFESSIONAL' | 'ENTRY';

export function isExecutiveTier(tier?: SeniorityTier | string | null): boolean {
  return tier === 'EXECUTIVE' || tier === 'SENIOR_LEADER';
}

export function inferSeniorityTier(
  explicitTier?: SeniorityTier | string | null,
  experienceYears?: string | number | null
): SeniorityTier {
  if (explicitTier && ['EXECUTIVE', 'SENIOR_LEADER', 'MANAGER', 'PROFESSIONAL', 'ENTRY'].includes(explicitTier)) {
    return explicitTier as SeniorityTier;
  }

  const years = typeof experienceYears === 'number'
    ? experienceYears
    : experienceYears === '10+' ? 15
    : experienceYears === '6-10' ? 8
    : experienceYears === '3-5' ? 4
    : experienceYears === '0-2' ? 1
    : null;

  if (years === null) return 'PROFESSIONAL';
  if (years >= 15) return 'EXECUTIVE';
  if (years >= 10) return 'SENIOR_LEADER';
  if (years >= 5) return 'MANAGER';
  if (years >= 2) return 'PROFESSIONAL';
  return 'ENTRY';
}

/**
 * Returns executive-appropriate labels for dashboard metrics.
 * For EXECUTIVE/SENIOR_LEADER tiers, reframes fear-based language
 * into strategic, confidence-first language.
 */
export function getExecutiveLabel(
  key: string,
  tier: SeniorityTier
): string {
  // CRITICAL-6 fix: single canonical name for the core score across all tiers.
  // "Career Position Score" is the product-wide standard — no alternate names.
  // Only the *sub-label* (description below the number) differs by tier.
  if (!isExecutiveTier(tier)) {
    const defaults: Record<string, string> = {
      'automation_risk': 'Career Position Score',
      'time_left': 'Action Window',       // NARRATION-7: not "Time Left" (implies expiry)
      'your_protection': 'Your Protection',
      'career_risk_score': 'Career Position',
      'chapter_2_title': "Here's What To Do",
      'disruption_message': 'faces significant disruption risk',
      'chapter_1_title': 'Your Situation',
      'replaceability_title': '🧬 Replaceability Index™',
      'takeover_title': '🔥 AI Takeover Map™',
      'why_replaceable': 'Why Replaceable',
      'hard_to_replace': 'Hard-to-Replace Factors',
    };
    return defaults[key] || key;
  }

  const executiveLabels: Record<string, string> = {
    'automation_risk': 'Career Position Score',  // CRITICAL-6: same name, different sub-label in UI
    'time_left': 'Action Window',                // NARRATION-7: not "Transition Window"
    'your_protection': 'Strategic Moat Strength',
    'career_risk_score': 'Career Position',
    'chapter_2_title': 'Recommended Action',
    'disruption_message': 'has a market repositioning opportunity',
    'chapter_1_title': 'Strategic Assessment',
    'replaceability_title': '🎯 Strategic Leverage Assessment',
    'takeover_title': '📊 AI Impact on Your Organization',
    'why_replaceable': 'Organizational Exposure Points',
    'hard_to_replace': 'Strategic Leverage Factors',
  };
  return executiveLabels[key] || key;
}

/**
 * Always convert risk score to position score (higher = better).
 * Career Position Score = 100 - Risk Score for all tiers.
 */
export function getDisplayScore(riskScore: number, _tier: SeniorityTier): number {
  return 100 - riskScore;
}

/**
 * Returns score color based on Career Position Score (higher = better = green).
 * Consistent across all tiers.
 */
export function getScoreColor(riskScore: number, _tier: SeniorityTier): string {
  const position = 100 - riskScore;
  if (position >= 60) return 'text-prophet-green';
  if (position >= 40) return 'text-primary';
  if (position >= 25) return 'text-prophet-gold';
  return 'text-prophet-red';
}

/**
 * Returns the appropriate glow color for VerdictReveal.
 */
export function getGlowColor(riskScore: number, _tier: SeniorityTier): string {
  const position = 100 - riskScore;
  if (position >= 60) return 'hsl(var(--prophet-green))';
  if (position >= 40) return 'hsl(var(--primary))';
  if (position >= 25) return 'hsl(var(--prophet-gold))';
  return 'hsl(var(--prophet-red))';
}

/**
 * Executive verdict message — confidence-first framing.
 */
/**
 * Title-to-rank mapping for seniority comparisons.
 * Single source of truth — used by InsightCards and anywhere else that
 * needs to compare role seniority numerically.
 */
const SENIORITY_RANK: Record<string, number> = {
  'founder': 10, 'co-founder': 10, 'cofounder': 10, 'owner': 10, 'managing partner': 9,
  'ceo': 10, 'cto': 9, 'cfo': 9, 'coo': 9, 'cmo': 9, 'cpo': 9,
  'president': 9, 'vice president': 8, 'vp': 8, 'svp': 8, 'evp': 8,
  'director': 7, 'senior director': 7.5, 'head': 7, 'principal': 7,
  'senior manager': 6, 'manager': 5, 'lead': 5, 'senior': 4,
};

export function getSeniorityRank(title: string): number {
  const lower = title.toLowerCase();
  for (const [key, rank] of Object.entries(SENIORITY_RANK)) {
    if (lower.includes(key)) return rank;
  }
  return 3; // default for unranked titles
}

export function getVerdictMessage(
  riskScore: number,
  tier: SeniorityTier,
  monthsRemaining: number,
  moatSkills: string[]
): string {
  if (!isExecutiveTier(tier)) {
    if (riskScore > 60) return 'faces significant disruption ahead.';
    if (riskScore > 40) return 'has notable risk factors to address.';
    return 'has strong protection — keep building your moat.';
  }

  // Executive framing: confidence-first
  const position = 100 - riskScore;
  if (position >= 60) {
    return `is well-positioned strategically. Your ${moatSkills[0] || 'leadership'} moat provides strong organizational value.`;
  }
  if (position >= 40) {
    return `has a ${monthsRemaining}-month adaptation window. Strategic moves now will strengthen your organizational leverage.`;
  }
  return `has a ${monthsRemaining}-month window to act. The roles replacing yours require the organizational judgment you already possess.`;
}
