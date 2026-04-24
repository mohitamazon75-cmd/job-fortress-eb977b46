export function normalizeCity(raw?: string | null): string {
  if (!raw) return "India";
  const cleaned = raw.replace(/\(.*?\)/g, "").replace(/\bAll Areas\b/gi, "").trim();
  const first = cleaned.split(/,|\//)[0]?.trim() || "India";
  if (!first || /tier-?\d/i.test(first)) return "India";
  return first;
}

export function slugifyRole(role?: string | null): string {
  return (role || "jobs")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") || "jobs";
}

export function buildBoardLinks(role?: string | null, city?: string | null, overrides?: Partial<{ naukri: string; linkedin: string }>) {
  const normalizedCity = normalizeCity(city);
  const safeRole = role?.trim() || "jobs";
  if (overrides?.naukri && overrides?.linkedin) {
    return { naukri: overrides.naukri, linkedin: overrides.linkedin };
  }

  return {
    naukri: overrides?.naukri || `https://www.naukri.com/${slugifyRole(safeRole)}-jobs-in-${slugifyRole(normalizedCity)}`,
    linkedin:
      overrides?.linkedin ||
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(safeRole)}&location=${encodeURIComponent(normalizedCity)}&f_TPR=r604800&sortBy=DD`,
  };
}

export function parsePostedDays(label?: string | null): number | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower.includes("today") || lower.includes("few hours")) return 0;
  const match = lower.match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return lower.includes("hour") ? 0 : value;
}

export function formatLiveTimestamp(iso?: string | null): string {
  if (!iso) return "Live now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Live now";
  return `Refreshed ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function getMatchTone(matchPct?: number | null) {
  const pct = Number(matchPct || 0);
  if (pct >= 85) return { label: "Strong fit", variant: "green" as const };
  if (pct >= 72) return { label: "Relevant", variant: "navy" as const };
  return { label: "Stretch", variant: "amber" as const };
}

const EXECUTIVE_HINTS = [
  "founder", "co-founder", "ceo", "cfo", "coo", "cto", "cmo", "chro",
  "chief executive", "chief financial", "chief operating", "chief technology",
  "chief marketing", "chief people", "chief revenue", "managing director",
  "president", "general partner", "venture partner", "country head",
];

export function detectExecutive(role?: string | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return EXECUTIVE_HINTS.some((hint) => lower.includes(hint));
}

/**
 * classifyJobUrl — determines whether a job URL points to a SPECIFIC posting
 * or a generic search/listing page. Used as a frontend safety-net so we never
 * promise "Open live listing" when the link actually dumps the user on a search
 * results page (a credibility-breaker).
 *
 * Returns:
 *   - kind: "specific" → leave URL + CTA alone
 *   - kind: "generic"  → relabel CTA, optionally swap to a targeted search URL
 *   - kind: "unknown"  → unrecognized host, treat as specific (don't break)
 */
export function classifyJobUrl(url?: string | null): {
  kind: "specific" | "generic" | "unknown";
  host: string;
} {
  if (!url) return { kind: "generic", host: "" };
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname;
    const search = u.search;

    if (host.includes("naukri.com")) {
      const isSpecific = /\/job-listings-|\/jd\/|jobId=/.test(path + search);
      return { kind: isSpecific ? "specific" : "generic", host };
    }
    if (host.includes("linkedin.com")) {
      const isSpecific = /\/jobs\/view\/|\/jobs\/\d{6,}/.test(path);
      return { kind: isSpecific ? "specific" : "generic", host };
    }
    if (host.includes("indeed")) {
      const isSpecific = /\/viewjob|\/rc\/clk|[?&]jk=/.test(path + search);
      return { kind: isSpecific ? "specific" : "generic", host };
    }
    if (host.includes("foundit.in") || host.includes("monsterindia")) {
      const isSpecific = /\/srp\/|\/job\/|\/jobs?\/[a-z0-9-]{8,}/i.test(path);
      return { kind: isSpecific ? "specific" : "generic", host };
    }
    return { kind: "unknown", host };
  } catch {
    return { kind: "generic", host: "" };
  }
}

export const EXECUTIVE_SEARCH_FIRMS: { name: string; url: string; focus: string }[] = [
  { name: "Egon Zehnder India", url: "https://www.egonzehnder.com/contact-us/india", focus: "Board, CEO and CXO mandates across BFSI, tech and consumer." },
  { name: "Heidrick & Struggles", url: "https://www.heidrick.com/en/locations/india", focus: "C-suite, board and senior functional leadership." },
  { name: "Spencer Stuart", url: "https://www.spencerstuart.com/locations/asia-pacific/india", focus: "CEO succession, board and digital leadership in India." },
  { name: "Vahura", url: "https://www.vahura.com/", focus: "General counsel, GC, compliance and senior legal leadership." },
  { name: "Native", url: "https://www.nativehire.com/", focus: "Founder, VP and senior tech / product mandates for funded startups." },
  { name: "Longhouse Consulting", url: "https://longhouse.in/", focus: "PE/VC portfolio CXO and operating partner placements." },
];
