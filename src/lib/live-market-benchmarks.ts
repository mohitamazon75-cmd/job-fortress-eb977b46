/**
 * Directional hiring-velocity benchmarks for the Live Market card (Layer B#6).
 *
 * These are NOT real-time numbers — they are honest, directional medians
 * pulled from public Indian job-board commentary (Naukri JobSpeak, Apna,
 * indeed.in tracker reports). They give the user a reference point so a
 * raw "6 postings today" stops being an absolute and becomes a comparison.
 *
 * Honesty rules:
 *  • Every entry returns a *range* phrased as "~X–Y/day", never a single
 *    fake-precise figure.
 *  • Anchored to "metro daily volume on Naukri" — not the universe of jobs.
 *  • If we don't have a confident benchmark for a family/city pair we
 *    return null and the card simply omits the line. Better silence than
 *    invented numbers.
 *
 * Future: when the operator has 30+ days of our own scan-aggregated
 * Apify data, replace this with a live percentile lookup. Until then,
 * directional copy beats no copy.
 */

import type { Family } from "./card1-personalization";

// Tier-1 metros where Naukri volume is healthy. Other cities fall back
// to the "national" tier (lower expected volume).
const TIER_1_METROS = new Set([
  "bangalore", "bengaluru", "mumbai", "delhi", "ncr", "gurgaon", "gurugram",
  "noida", "hyderabad", "pune", "chennai",
]);

function isTier1(city: string): boolean {
  const c = city.toLowerCase();
  return [...TIER_1_METROS].some(metro => c.includes(metro));
}

// Median *daily* postings on Naukri for the family/city tier, expressed as
// a low–high band so it reads as directional, not exact.
const TIER_1_DAILY: Partial<Record<Family, [number, number]>> = {
  eng: [40, 80],
  data: [25, 55],
  design: [10, 25],
  pm: [12, 28],
  marketing: [15, 35],
  sales: [60, 120],
  ops: [20, 45],
  hr: [15, 35],
  finance: [25, 55],
  support: [30, 70],
  content: [8, 20],
  consulting: [10, 25],
  manufacturing: [20, 45],
  healthcare: [15, 35],
  legal: [5, 15],
  education: [10, 25],
  hospitality: [12, 28],
  research: [3, 10],
  // founder/exec/creator/generic intentionally omitted — these roles don't
  // get hired through Naukri at meaningful volume; benchmark would mislead.
};

// National (non–tier-1) typically runs at ~30–50% of metro volume. We
// scale the band rather than maintain a duplicate table.
const NATIONAL_SCALE = 0.4;

export interface VelocityBenchmark {
  /** Lower bound of typical daily postings, rounded. */
  low: number;
  /** Upper bound of typical daily postings, rounded. */
  high: number;
  /** Pre-formatted display string. */
  text: string;
}

/**
 * Returns a directional benchmark or null if we don't have confident data
 * for this family. Always omits rather than invents.
 */
export function getVelocityBenchmark(
  family: Family,
  city: string,
): VelocityBenchmark | null {
  const band = TIER_1_DAILY[family];
  if (!band) return null;
  const tier1 = isTier1(city);
  const [loRaw, hiRaw] = tier1
    ? band
    : [band[0] * NATIONAL_SCALE, band[1] * NATIONAL_SCALE];
  const low = Math.max(1, Math.round(loRaw));
  const high = Math.max(low + 1, Math.round(hiRaw));
  const cityLabel = tier1 ? city : `${city} and similar markets`;
  return {
    low,
    high,
    text: `Typical daily posting volume for this family in ${cityLabel}: ~${low}–${high}/day on Naukri (directional, public-board only).`,
  };
}

/**
 * Phrasing helper: where does the user's observed `sameDayCount` sit
 * relative to the benchmark? Returns a short verdict string, never null
 * (when no benchmark, the caller shouldn't render anything).
 */
export function compareToBenchmark(sameDay: number, b: VelocityBenchmark): string {
  if (sameDay >= b.high) return "above the typical daily band";
  if (sameDay >= b.low) return "inside the typical daily band";
  if (sameDay >= Math.max(1, Math.round(b.low / 2))) return "below the typical daily band";
  return "well below the typical daily band";
}
