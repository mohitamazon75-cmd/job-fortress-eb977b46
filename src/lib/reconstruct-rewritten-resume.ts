// ═══════════════════════════════════════════════════════════════
// Reconstruct Rewritten Resume — pure helper for B2.2.1
//
// The Resume Weaponizer LLM returns a structured JSON (headline,
// summary, skills, bullets, etc.) — NOT a single resume string.
//
// To compare apples-to-apples against the LLM's self-reported
// jd_match_analysis.match_pct, we need to feed the deterministic
// matcher the SAME text the LLM was implicitly scoring: the
// rewritten output, flattened into resume-like text.
//
// This module owns ZERO state, never throws, and returns "" for
// any malformed input (caller treats empty as "skip det score").
// ═══════════════════════════════════════════════════════════════

export interface WeaponizerResult {
  linkedin_headline?: unknown;
  professional_summary?: unknown;
  key_skills_section?: {
    headline_skills?: unknown;
    strategic_keywords?: unknown;
  };
  experience_bullets?: unknown;
  new_sections_to_add?: unknown;
  cover_letter_hook?: unknown;
}

/** Coerce a value to a non-empty trimmed string, else empty. */
function safeStr(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t;
}

/** Coerce a value to an array of non-empty strings. */
function safeStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(safeStr).filter((s) => s.length > 0);
}

/**
 * Flatten a Weaponizer result into a single resume-like text blob.
 * Pure. Deterministic. Never throws. Returns "" if no usable content.
 */
export function reconstructRewrittenResume(result: WeaponizerResult | null | undefined): string {
  if (!result || typeof result !== "object") return "";

  const parts: string[] = [];

  const headline = safeStr(result.linkedin_headline);
  if (headline) parts.push(headline);

  const summary = safeStr(result.professional_summary);
  if (summary) parts.push(summary);

  // Skills section — flatten headline + strategic keywords
  const skills = result.key_skills_section;
  if (skills && typeof skills === "object") {
    const headlineSkills = safeStrArr((skills as any).headline_skills);
    const strategic = safeStrArr((skills as any).strategic_keywords);
    if (headlineSkills.length) parts.push(headlineSkills.join(", "));
    if (strategic.length) parts.push(strategic.join(", "));
  }

  // Experience bullets — use weaponized_bullet (the rewritten text)
  if (Array.isArray(result.experience_bullets)) {
    for (const b of result.experience_bullets) {
      if (!b || typeof b !== "object") continue;
      const bullet = safeStr((b as any).weaponized_bullet);
      const ctx = safeStr((b as any).context);
      if (bullet) {
        parts.push(ctx ? `${ctx}: ${bullet}` : bullet);
      }
    }
  }

  // New sections — include sample entries (they describe the user's positioning)
  if (Array.isArray(result.new_sections_to_add)) {
    for (const s of result.new_sections_to_add) {
      if (!s || typeof s !== "object") continue;
      const title = safeStr((s as any).section_title);
      const entries = safeStrArr((s as any).sample_entries);
      if (title && entries.length) {
        parts.push(`${title}: ${entries.join("; ")}`);
      }
    }
  }

  const hook = safeStr(result.cover_letter_hook);
  if (hook) parts.push(hook);

  return parts.join("\n").trim();
}
