import { ATLAS_EXPOSURE_META, ATLAS_KG_EXPOSURE } from "./occupation-exposure-data.ts";

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

export interface AcademicExposureResult {
  kind: "mapped";
  job_family: string;
  risk_tier: AcademicRiskTier;
  consensus_score: number;
  source_count: number;
  converged: boolean;
  disagreement: number | null;
  occupations: AcademicExposureRow[];
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

function average(values: Array<number | null>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : 0;
}

function weightedConsensus(rows: AcademicExposureRow[]): number {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(1, row.n_sources || 1), 0);
  return totalWeight <= 0 ? 0 : rows.reduce((sum, row) => sum + (row.consensus_score || 0) * Math.max(1, row.n_sources || 1), 0) / totalWeight;
}

export function getAcademicOccupationExposure(jobFamily: unknown): AcademicExposureLookup {
  const normalized = normalizeFamily(jobFamily);
  if (!normalized) return { kind: "unmapped", job_family: null, message: "Academic exposure data not yet mapped for this role" };
  const rows = ([...((ATLAS_KG_EXPOSURE as unknown as Record<string, readonly AcademicExposureRow[]>)[normalized] || [])])
    .filter((row) => typeof row.consensus_score === "number");
  if (!rows.length) return { kind: "unmapped", job_family: normalized, message: "Academic exposure data not yet mapped for this role" };
  const consensus = weightedConsensus(rows);
  const sourceCount = Math.max(...rows.map((r) => r.n_sources || 0));
  const disagreements = rows.map((r) => r.disagreement).filter((d): d is number => typeof d === "number");
  const disagreement = disagreements.length ? average(disagreements) : null;
  return {
    kind: "mapped",
    job_family: normalized,
    risk_tier: academicRiskTier(consensus),
    consensus_score: consensus,
    source_count: sourceCount,
    converged: sourceCount >= 3 && (disagreement == null || disagreement <= 0.5),
    disagreement,
    occupations: rows,
    badge_label: sourceCount >= 3 && (disagreement == null || disagreement <= 0.5) ? "Cross-validated academic exposure" : "Academic exposure mapped",
  };
}
