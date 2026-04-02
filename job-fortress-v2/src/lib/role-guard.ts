// ═══════════════════════════════════════════════════════════════
// Verbatim Role Guard — prevents LLM title inflation
// 
// The LLM often "upgrades" titles (Manager → Director, Engineer → 
// Architect, Writer → Editor-in-Chief). This utility ensures we
// always use the EXACT title from the user's profile.
// ═══════════════════════════════════════════════════════════════

// Common LLM inflation patterns: { actual_keyword: [inflated versions] }
const INFLATION_MAP: Record<string, string[]> = {
  "manager": [
    "director", "head of", "vp of", "vice president", "chief", "senior director",
    "group head", "department head", "general manager",
  ],
  "engineer": [
    "principal engineer", "staff engineer", "distinguished engineer",
    "engineering director", "head of engineering", "vp engineering", "architect",
  ],
  "analyst": [
    "senior analyst", "lead analyst", "analytics director", "head of analytics",
    "data science lead", "analytics manager",
  ],
  "designer": [
    "design director", "head of design", "creative director", "vp design",
    "principal designer", "design lead",
  ],
  "writer": [
    "editor-in-chief", "editorial director", "head of content",
    "content director", "vp content", "chief content officer",
  ],
  "executive": [
    "c-suite", "cxo", "managing director", "president", "founder",
  ],
  "coordinator": [
    "manager", "director", "lead", "head of",
  ],
  "associate": [
    "senior", "lead", "principal", "manager",
  ],
  "specialist": [
    "senior specialist", "lead specialist", "manager", "director",
  ],
  "assistant": [
    "manager", "coordinator", "specialist", "lead",
  ],
};

/**
 * Extract the verbatim (non-inflated) role from a scan report.
 * Priority: role_detected > role > industry fallback
 */
export function getVerbatimRole(report: any): string {
  // role_detected is set by our scan engine from the actual profile
  const detected = report?.role_detected;
  const role = report?.role;
  
  // Prefer role_detected as it comes directly from parsing
  if (detected && typeof detected === 'string' && detected.length > 0 && detected.length < 80) {
    return detected;
  }
  
  if (role && typeof role === 'string' && role.length > 0 && role.length < 80) {
    // Guard: if it looks like a sentence, it's not a role title
    if (role.includes('.') || role.startsWith('I ') || role.startsWith('As a')) {
      return report?.industry ? `${report.industry} Professional` : 'Professional';
    }
    return role;
  }
  
  return report?.industry ? `${report.industry} Professional` : 'Professional';
}

/**
 * Sanitize LLM-generated text by replacing inflated titles with the verbatim role.
 * Use this on any LLM output before rendering.
 */
export function deflateRoleInText(text: string, verbatimRole: string): string {
  if (!text || !verbatimRole) return text;
  
  const roleLower = verbatimRole.toLowerCase();
  let fixed = text;
  
  for (const [keyword, inflations] of Object.entries(INFLATION_MAP)) {
    if (roleLower.includes(keyword)) {
      for (const inflation of inflations) {
        // Don't deflate if the inflation IS the verbatim role
        if (roleLower.includes(inflation.toLowerCase())) continue;
        
        // Case-insensitive word-boundary replacement
        const escaped = inflation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        fixed = fixed.replace(regex, verbatimRole);
      }
    }
  }
  
  return fixed;
}
