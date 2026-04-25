// ─────────────────────────────────────────────────────────────────────────
// BL-031: threat_timeline schema normalizer.
//
// Background: across the lifetime of the scan pipeline, three distinct
// shapes have been persisted into report.threat_timeline:
//   1) NEW (current Agent 2A prompt): an object with displacement-year fields
//        { partial_displacement_year, significant_displacement_year,
//          critical_displacement_year, primary_threat_tool, at_risk_task }
//   2) LEGACY (early v3 schema): a string (e.g. "2-3 years until significant
//        displacement"). This was even what the Zod schema declared until
//        2026-04-25.
//   3) UNRELATED ARRAY (scan-engine type union, unused in any consumer):
//        Array<{ period, risk_level, description }>.
//
// All UI consumers expect shape #1. Without normalization, older scans cause
// either a silently empty Displacement Timeline strip (best case) or a
// type-coercion error (worst case) when reading `.significant_displacement_year`
// off a string.
//
// This helper accepts any of the three shapes and returns a uniform object
// (or null when nothing usable is present). It is purely defensive: no LLM,
// no fabrication. Missing fields stay missing.
// ─────────────────────────────────────────────────────────────────────────

export type NormalizedThreatTimeline = {
  partial_displacement_year: number | null;
  significant_displacement_year: number | null;
  critical_displacement_year: number | null;
  primary_threat_tool: string | null;
  at_risk_task: string | null;
} | null;

const YEAR_RE = /(20\d{2})/g;

function asYear(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 2020 && v <= 2050) return Math.round(v);
  if (typeof v === "string") {
    const m = v.match(/(20\d{2})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function asStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export function normalizeThreatTimeline(input: unknown): NormalizedThreatTimeline {
  if (input == null) return null;

  // Shape #1: object form (current)
  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const out: NormalizedThreatTimeline = {
      partial_displacement_year: asYear(obj.partial_displacement_year),
      significant_displacement_year: asYear(obj.significant_displacement_year),
      critical_displacement_year: asYear(obj.critical_displacement_year),
      primary_threat_tool: asStr(obj.primary_threat_tool),
      at_risk_task: asStr(obj.at_risk_task),
    };
    // If literally everything is null, treat as absent.
    if (
      out.partial_displacement_year == null &&
      out.significant_displacement_year == null &&
      out.critical_displacement_year == null &&
      out.primary_threat_tool == null &&
      out.at_risk_task == null
    ) {
      return null;
    }
    return out;
  }

  // Shape #2: legacy string form. Try to extract the *first* future year as
  // significant_displacement_year so the UI can still render a useful badge.
  if (typeof input === "string") {
    const years = Array.from(input.matchAll(YEAR_RE)).map((m) => Number(m[1])).filter((n) => n >= 2020 && n <= 2050);
    if (years.length === 0) return null;
    years.sort((a, b) => a - b);
    return {
      partial_displacement_year: null,
      significant_displacement_year: years[0],
      critical_displacement_year: years[1] ?? null,
      primary_threat_tool: null,
      at_risk_task: null,
    };
  }

  // Shape #3 (defensive): array form. Pick first entry's first parsed year.
  if (Array.isArray(input) && input.length > 0) {
    const joined = input.map((e) => (typeof e === "object" && e ? Object.values(e).join(" ") : String(e ?? ""))).join(" ");
    return normalizeThreatTimeline(joined);
  }

  return null;
}
