import { ATLAS_EXPOSURE_META, ATLAS_KG_EXPOSURE } from "./det-occupation-exposure-data";

export type AcademicRiskTier = "HIGH" | "MEDIUM" | "LOW";

export interface AcademicExposureRow {
  atlas_title: string;
  soc: string;
  consensus_score: number | null;
  n_sources: number;
  disagreement: number | null;
  karpathy: number | null;
  openai: number | null;
  anthropic: number | null;
  frey_osborne: number | null;
}

export interface AcademicExposureSource {
  name: "Atlas consensus" | "Karpathy" | "OpenAI" | "Anthropic" | "Frey-Osborne";
  year: 2026 | 2023 | 2025 | 2017;
  score: number;
}

export interface AcademicExposureResult {
  kind: "mapped";
  job_family: string;
  risk_tier: AcademicRiskTier;
  consensus_score: number;
  source_count: number;
  converged: boolean;
  disagreement: number | null;
  occupations: AcademicExposureRow[];
  sources: AcademicExposureSource[];
  badge_label: string;
}

export interface AcademicExposureEmptyState {
  kind: "unmapped";
  job_family: string | null;
  message: "Academic exposure data not yet mapped for this role";
}

export type AcademicExposureLookup = AcademicExposureResult | AcademicExposureEmptyState;

export const ACADEMIC_EXPOSURE_META = ATLAS_EXPOSURE_META;

function normalizeFamily(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function academicRiskTier(score: number): AcademicRiskTier {
  if (score >= 0.66) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

function weightedConsensus(rows: AcademicExposureRow[]): number {
  const usable = rows.filter((r) => typeof r.consensus_score === "number");
  const totalWeight = usable.reduce((sum, row) => sum + Math.max(1, row.n_sources || 1), 0);
  if (totalWeight <= 0) return 0;
  return usable.reduce((sum, row) => sum + (row.consensus_score as number) * Math.max(1, row.n_sources || 1), 0) / totalWeight;
}

function buildSources(rows: AcademicExposureRow[], consensus: number): AcademicExposureSource[] {
  const present = { karpathy: false, openai: false, anthropic: false, frey_osborne: false };
  rows.forEach((row) => {
    present.karpathy ||= typeof row.karpathy === "number";
    present.openai ||= typeof row.openai === "number";
    present.anthropic ||= typeof row.anthropic === "number";
    present.frey_osborne ||= typeof row.frey_osborne === "number";
  });
  const out: AcademicExposureSource[] = [{ name: "Atlas consensus", year: 2026, score: consensus }];
  if (present.karpathy) out.push({ name: "Karpathy", year: 2026, score: average(rows.map((r) => r.karpathy)) });
  if (present.openai) out.push({ name: "OpenAI", year: 2023, score: average(rows.map((r) => r.openai)) });
  if (present.anthropic) out.push({ name: "Anthropic", year: 2025, score: average(rows.map((r) => r.anthropic)) });
  if (present.frey_osborne) out.push({ name: "Frey-Osborne", year: 2017, score: average(rows.map((r) => r.frey_osborne)) });
  return out;
}

function average(values: Array<number | null>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return 0;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export function getAcademicOccupationExposure(jobFamily: unknown): AcademicExposureLookup {
  const normalized = normalizeFamily(jobFamily);
  if (!normalized) {
    return { kind: "unmapped", job_family: null, message: "Academic exposure data not yet mapped for this role" };
  }

  const rows = ([...((ATLAS_KG_EXPOSURE as unknown as Record<string, readonly AcademicExposureRow[]>)[normalized] || [])])
    .filter((row) => typeof row.consensus_score === "number");
  if (!rows.length) {
    return { kind: "unmapped", job_family: normalized, message: "Academic exposure data not yet mapped for this role" };
  }

  const consensus = weightedConsensus(rows);
  const sourceCount = Math.max(...rows.map((r) => r.n_sources || 0));
  const disagreements = rows.map((r) => r.disagreement).filter((d): d is number => typeof d === "number");
  const disagreement = disagreements.length ? average(disagreements) : null;
  const converged = sourceCount >= 3 && (disagreement == null || disagreement <= 0.5);

  return {
    kind: "mapped",
    job_family: normalized,
    risk_tier: academicRiskTier(consensus),
    consensus_score: consensus,
    source_count: sourceCount,
    converged,
    disagreement,
    occupations: rows,
    sources: buildSources(rows, consensus),
    badge_label: converged ? "Cross-validated academic exposure" : "Academic exposure mapped",
  };
}
