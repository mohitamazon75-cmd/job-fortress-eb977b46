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
