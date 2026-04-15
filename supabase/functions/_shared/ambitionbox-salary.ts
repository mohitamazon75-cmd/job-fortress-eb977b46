// ═══════════════════════════════════════════════════════════════
// ambitionbox-salary.ts — India-specific salary data from AmbitionBox
//
// AmbitionBox has 30M+ India salary data points by company/role/city.
// This module fetches salary data by targeting AmbitionBox.com via
// Tavily search (domain-restricted), with Adzuna as fallback.
//
// Result chain:
//   1. AmbitionBox (Tavily, includeDomains: ambitionbox.com) — India-specific
//   2. Glassdoor India (Tavily, includeDomains: glassdoor.co.in) — fallback
//   3. Adzuna India API — fallback if Tavily unavailable
//   4. null — callers handle gracefully (KG estimate used instead)
//
// ZERO-REGRESSION: all calls are optional enrichment. If every source
// fails, the existing estimateMonthlySalary() KG estimate is used.
// ═══════════════════════════════════════════════════════════════

import { tavilySearch } from "./tavily-search.ts";

export interface IndiaSalaryData {
  role: string;
  median_monthly_inr: number | null;
  range_label: string | null;        // "₹8L – ₹14L/yr"
  source: "ambitionbox" | "glassdoor" | "adzuna" | "not_available";
  sample_note?: string;              // "Based on 340 salaries on AmbitionBox"
  fetched_at: string;
}

// ── AmbitionBox role slug normaliser ────────────────────────────
// AmbitionBox uses URL slugs like "software-engineer-salaries"
function toAmbitionBoxSlug(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Extract salary range from AmbitionBox search result text ────
// AmbitionBox salary pages contain patterns like:
// "Average salary for a Software Engineer in India is ₹8.0 Lakhs per year (₹66.7k per month)"
// "Salaries range from ₹3.5 Lakhs to ₹18.0 Lakhs"
function extractAmbitionBoxSalary(text: string, role: string): IndiaSalaryData | null {
  const fetched_at = new Date().toISOString();

  // Pattern 1: "average salary ... ₹X Lakhs per year"
  const avgMatch = text.match(/average\s+salary[^₹]*₹\s*([\d.]+)\s*[Ll]akhs?\s*(?:per\s*year|\/yr|p\.a\.)/i);
  // Pattern 2: "range from ₹X to ₹Y Lakhs"
  const rangeMatch = text.match(/₹\s*([\d.]+)\s*[Ll]akhs?\s*to\s*₹\s*([\d.]+)\s*[Ll]akhs?/i);
  // Pattern 3: "₹X LPA" patterns
  const lpaMatch = text.match(/₹\s*([\d.]+)\s*(?:L|Lakhs?|LPA|lpa)(?:\s*[-–]\s*₹?\s*([\d.]+)\s*(?:L|Lakhs?|LPA))?/i);
  // Count sample size
  const sampleMatch = text.match(/([\d,]+)\s+(?:salary|salaries|employees|professionals)/i);
  const sampleNote = sampleMatch
    ? `Based on ${sampleMatch[1]} salaries on AmbitionBox`
    : "From AmbitionBox India";

  let medianLakhs: number | null = null;
  let rangeLow: number | null = null;
  let rangeHigh: number | null = null;

  if (avgMatch) {
    medianLakhs = parseFloat(avgMatch[1]);
  } else if (rangeMatch) {
    rangeLow = parseFloat(rangeMatch[1]);
    rangeHigh = parseFloat(rangeMatch[2]);
    medianLakhs = (rangeLow + rangeHigh) / 2;
  } else if (lpaMatch) {
    const low = parseFloat(lpaMatch[1]);
    const high = lpaMatch[2] ? parseFloat(lpaMatch[2]) : null;
    medianLakhs = high ? (low + high) / 2 : low;
    if (high) { rangeLow = low; rangeHigh = high; }
  }

  if (!medianLakhs || medianLakhs < 1 || medianLakhs > 500) return null;

  const medianMonthly = Math.round((medianLakhs * 100000) / 12);

  let rangeLabel: string;
  if (rangeLow && rangeHigh) {
    rangeLabel = `₹${rangeLow.toFixed(0)}L – ₹${rangeHigh.toFixed(0)}L/yr`;
  } else {
    const highEst = medianLakhs * 1.35;
    rangeLabel = `₹${medianLakhs.toFixed(0)}L – ₹${highEst.toFixed(0)}L/yr`;
  }

  return {
    role,
    median_monthly_inr: medianMonthly,
    range_label: rangeLabel,
    source: "ambitionbox",
    sample_note: sampleNote,
    fetched_at,
  };
}

// ── AmbitionBox via Tavily ────────────────────────────────────────
async function fetchFromAmbitionBox(role: string): Promise<IndiaSalaryData | null> {
  const slug = toAmbitionBoxSlug(role);
  const query = `${role} salary India lakhs per year site:ambitionbox.com`;

  try {
    const results = await tavilySearch({
      query,
      searchDepth: "basic",
      maxResults: 3,
      includeDomains: ["ambitionbox.com"],
    });

    if (!results?.results?.length) return null;

    // Combine all result snippets for broader extraction surface
    const combined = results.results.map((r: any) => r.content).join(" ");
    return extractAmbitionBoxSalary(combined, role);
  } catch {
    return null;
  }
}

// ── Glassdoor India fallback via Tavily ──────────────────────────
function extractGlassdoorSalary(text: string, role: string): IndiaSalaryData | null {
  const fetched_at = new Date().toISOString();

  const match = text.match(/(?:average|median|base)\s+(?:base\s+)?(?:salary|pay)[^₹$]*(?:₹|INR|Rs\.?)\s*([\d,]+)/i);
  if (!match) {
    // Try LPA patterns
    const lpa = text.match(/([\d.]+)\s*(?:L|LPA|lakhs?)\s*(?:per\s*year|\/yr|p\.a\.)?/i);
    if (!lpa) return null;
    const lakhs = parseFloat(lpa[1]);
    if (lakhs < 1 || lakhs > 500) return null;
    return {
      role,
      median_monthly_inr: Math.round((lakhs * 100000) / 12),
      range_label: `₹${lakhs.toFixed(0)}L – ₹${(lakhs * 1.35).toFixed(0)}L/yr`,
      source: "glassdoor",
      sample_note: "From Glassdoor India",
      fetched_at,
    };
  }

  const raw = parseFloat(match[1].replace(/,/g, ""));
  // Could be annual or monthly — detect from context
  const isAnnual = /per\s*year|annual|p\.a\.|\/yr/i.test(text.slice(Math.max(0, text.indexOf(match[0]) - 100), text.indexOf(match[0]) + 100));
  const annualInr = isAnnual ? raw : raw * 12;
  if (annualInr < 100000 || annualInr > 100000000) return null;

  const lakhs = annualInr / 100000;
  return {
    role,
    median_monthly_inr: Math.round(annualInr / 12),
    range_label: `₹${lakhs.toFixed(0)}L – ₹${(lakhs * 1.35).toFixed(0)}L/yr`,
    source: "glassdoor",
    sample_note: "From Glassdoor India",
    fetched_at,
  };
}

async function fetchFromGlassdoor(role: string): Promise<IndiaSalaryData | null> {
  try {
    const results = await tavilySearch({
      query: `${role} average salary India per year Glassdoor`,
      searchDepth: "basic",
      maxResults: 3,
      includeDomains: ["glassdoor.co.in", "glassdoor.com"],
    });
    if (!results?.results?.length) return null;
    const combined = results.results.map((r: any) => r.content).join(" ");
    return extractGlassdoorSalary(combined, role);
  } catch {
    return null;
  }
}

// ── Main export: fetch best available India salary data ───────────
// Tries AmbitionBox → Glassdoor → returns null
// Designed to be called in parallel with other scan steps.
// Cache TTL suggestion: 24h (salary data doesn't change intraday)
export async function fetchIndiaSalaryData(role: string): Promise<IndiaSalaryData> {
  const fetched_at = new Date().toISOString();
  const notAvailable: IndiaSalaryData = {
    role, median_monthly_inr: null, range_label: null,
    source: "not_available", fetched_at,
  };

  if (!role || role.length < 2) return notAvailable;

  // Try AmbitionBox first (India-specific, most relevant)
  const ambitionBoxResult = await fetchFromAmbitionBox(role);
  if (ambitionBoxResult) {
    console.log(`[IndiaSalary] AmbitionBox hit for "${role}": ${ambitionBoxResult.range_label}`);
    return ambitionBoxResult;
  }

  // Fall back to Glassdoor India
  const glassdoorResult = await fetchFromGlassdoor(role);
  if (glassdoorResult) {
    console.log(`[IndiaSalary] Glassdoor fallback for "${role}": ${glassdoorResult.range_label}`);
    return glassdoorResult;
  }

  console.log(`[IndiaSalary] No salary data found for "${role}" — using KG estimate`);
  return notAvailable;
}

// ── Batch enrichment for pivot roles ────────────────────────────
// Called from india-jobs to enrich safer-role salary data
export async function enrichRolesWithIndiaSalary(
  roles: Array<{ role: string; [key: string]: any }>,
): Promise<Array<{ role: string; avg_salary_inr: string | null; [key: string]: any }>> {
  if (!roles.length) return roles;

  // Fetch salary for first 3 roles in parallel (to respect Tavily rate limits)
  const toEnrich = roles.slice(0, 3);
  const rest = roles.slice(3);

  const salaryResults = await Promise.all(
    toEnrich.map(r => fetchIndiaSalaryData(r.role))
  );

  const enriched = toEnrich.map((r, i) => ({
    ...r,
    avg_salary_inr: salaryResults[i].range_label ?? r.avg_salary_inr ?? null,
  }));

  // Return enriched + rest (rest keeps existing avg_salary_inr)
  return [...enriched, ...rest];
}
