/**
 * kg-category-map.ts — Fix A from Expert Panel Audit 2026-04-30
 *
 * The job_taxonomy table is keyed by `category` strings ("Marketing & Advertising",
 * "IT & Software", "Other", "business" …). When a user picks an industry like
 * "Sales" or "Sales & Business Development", no row matches `category = 'Sales'`,
 * so process-scan falls back to a random `limit(20)` grab-bag and the role-token
 * matcher pairs "Manager" with whatever `*_manager` family appears first
 * (observed bug: "Senior Manager – Business Development" → `supply_chain_manager`).
 *
 * This module provides a deterministic mapping from user-facing industry strings
 * to ordered candidate KG categories. Pure, no IO.
 *
 * RULES:
 *  - Always return a non-empty list (least-bad fallback at the tail).
 *  - First entry wins for the primary `category =` query; tail entries are
 *    used only when the first returns no rows.
 *  - Match is case-insensitive on a normalised industry string.
 */

const CATEGORY_PRIORITY: Array<{ test: RegExp; categories: string[] }> = [
  // Sales / BD: no native category exists. Pull from "Other" (sales_executive,
  // business_analyst, management_consultant, recruiter, operations_manager, …)
  // and "business" (sdr_bdr).
  { test: /\b(sales|business\s*development|bd|account\s*management|revenue\s*ops|revops)\b/i,
    categories: ["Other", "business"] },

  // Marketing — case variants exist in the DB.
  { test: /\b(marketing|advertising|growth|brand|seo|sem|martech|content)\b/i,
    categories: ["Marketing & Advertising", "marketing & advertising", "Media"] },

  // Tech / Engineering / Data / Product
  { test: /\b(software|engineering|developer|tech|data|ml|ai|product\s*manage|qa|devops|cloud|cyber)\b/i,
    categories: ["IT & Software", "it & software"] },

  { test: /\b(finance|banking|accounting|audit|tax|fintech|bfsi|investment)\b/i,
    categories: ["Finance & Banking"] },

  { test: /\b(health|medical|hospital|pharma|clinical|biotech)\b/i,
    categories: ["Healthcare"] },

  { test: /\b(legal|law|attorney|paralegal|compliance)\b/i,
    categories: ["Legal"] },

  { test: /\b(creative|design|art|video|graphic|illustrat|photograph)\b/i,
    categories: ["Creative & Design", "Media"] },

  { test: /\b(education|edtech|teaching|teacher|curriculum|tutor)\b/i,
    categories: ["Education"] },

  { test: /\b(manufactur|production|industrial|mechanical|civil|quality)\b/i,
    categories: ["Manufacturing"] },

  { test: /\b(logistic|supply\s*chain|warehouse|fleet|customs)\b/i,
    categories: ["Logistics", "Manufacturing"] },

  { test: /\b(hospitality|hotel|travel|chef|aviation)\b/i,
    categories: ["Hospitality"] },

  { test: /\b(real\s*estate|property|broker|realtor)\b/i,
    categories: ["Real Estate"] },

  { test: /\b(government|policy|civil\s*service|public\s*sector|urban\s*plan)\b/i,
    categories: ["Government"] },

  { test: /\b(media|journal|editor|broadcast|film|sound)\b/i,
    categories: ["Media", "Creative & Design"] },

  { test: /\b(agriculture|farm|agronom|food\s*tech)\b/i,
    categories: ["Agriculture"] },

  // HR / People / Recruitment — falls into "Other" (recruiter, hr_generalist).
  { test: /\b(human\s*resources|hr|talent|recruit|people\s*ops|l&d)\b/i,
    categories: ["Other"] },

  // Customer support / BPO — split between "it & software" (bpo_l1_support) and "Other" (customer_support).
  { test: /\b(customer\s*support|customer\s*success|csm|bpo|call\s*cent)\b/i,
    categories: ["Other", "it & software"] },

  // Operations / consulting / generic management — pull "Other" first (operations_manager, management_consultant).
  { test: /\b(operations|consult|strategy|management|project\s*manage|programme?\s*manage)\b/i,
    categories: ["Other"] },
];

/**
 * Returns ordered list of `category` strings to query in `job_taxonomy`.
 * Always returns at least one entry.
 *
 * Pass the raw industry the user selected (e.g. "Sales", "Sales & Business
 * Development", "Marketing", "IT & Software"). Optional `roleHint` is used
 * only as a tiebreaker — currently unused by the matcher but accepted now to
 * keep the call site stable.
 */
export function getCategoryCandidates(
  industry: string | null | undefined,
  _roleHint?: string | null,
): string[] {
  const raw = (industry || "").trim();
  if (!raw) return ["Other"];

  // Direct exact match — preserve current happy path for already-correct values.
  // (Returns the input as-is so the original .eq() query still works.)
  const direct = raw;

  for (const { test, categories } of CATEGORY_PRIORITY) {
    if (test.test(raw)) {
      // Put the direct match first only if it doesn't duplicate a mapped entry,
      // so an exact "Marketing & Advertising" still wins on its own row.
      if (!categories.some((c) => c.toLowerCase() === direct.toLowerCase())) {
        return [direct, ...categories];
      }
      return categories;
    }
  }

  // No semantic mapping found — try the literal value first, then "Other" as
  // the deterministic safety net (avoids the random `limit(20)` grab-bag).
  return direct ? [direct, "Other"] : ["Other"];
}

/**
 * Convenience: fetch job_taxonomy rows by trying candidate categories in order.
 * Returns the first non-empty result. Pure-ish — accepts a fetcher so the
 * module stays IO-free and Vitest-friendly.
 */
export async function fetchTaxonomyByCandidates<T>(
  candidates: ReadonlyArray<string>,
  fetcher: (category: string) => Promise<T[]>,
): Promise<{ rows: T[]; matchedCategory: string | null }> {
  for (const cat of candidates) {
    const rows = await fetcher(cat);
    if (rows && rows.length > 0) return { rows, matchedCategory: cat };
  }
  return { rows: [], matchedCategory: null };
}
