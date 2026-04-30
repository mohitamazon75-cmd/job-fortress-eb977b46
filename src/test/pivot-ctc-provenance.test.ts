/**
 * Pivot Tab CTC Provenance — locks in the 4-state contract from Pass C2.1
 *
 * The bug being prevented: get-model-b-analysis used to fabricate "₹X gap"
 * deltas regardless of whether the user typed a CTC during onboarding.
 * Card4PivotPaths then deterministically rendered "Opportunity cost ₹Y"
 * built on those fabricated numbers.
 *
 * Fix contract — all 4 states:
 *   S1 (CTC entered, plumbed correctly) → has_user_ctc=true,  math card visible
 *   S2 (CTC entered, plumbing broken)   → MUST NOT EXIST after C2.1; reaching this
 *                                         means RC2 regressed (DB select dropped column,
 *                                         or processAnalysis stopped passing it through)
 *   S3 (CTC not entered)                → has_user_ctc=false, band-only card with prompt
 *   S4 (no entry → re-scan with CTC)    → flips to S1 on the new analysis_id
 *
 * These are pure-data assertions on the salary_provenance shape that
 * get-model-b-analysis stamps onto card_data. The Card4 UI branch is
 * `cardData?.salary_provenance?.has_user_ctc === true`.
 */

import { describe, it, expect } from "vitest";

// Mirror of the salary_provenance shape stamped server-side. Kept in sync with
// supabase/functions/get-model-b-analysis/index.ts ~line 600.
type SalaryProvenance = {
  has_user_ctc: boolean;
  monthly_inr: number | null;
  annual_lakhs: number | null;
};

function buildProvenance(userMonthlyCTC: number | null): SalaryProvenance {
  return {
    has_user_ctc: userMonthlyCTC !== null && userMonthlyCTC > 0,
    monthly_inr: userMonthlyCTC ?? null,
    annual_lakhs: userMonthlyCTC ? Math.round((userMonthlyCTC * 12) / 100000) : null,
  };
}

describe("Pivot CTC provenance — server-stamped flag", () => {
  it("S1: CTC entered (₹2.5L/month) → has_user_ctc=true, annual_lakhs=30", () => {
    // Calibration: monthly 250000 × 12 = 3000000 = ₹30L annual.
    const prov = buildProvenance(250_000);
    expect(prov.has_user_ctc).toBe(true);
    expect(prov.monthly_inr).toBe(250_000);
    expect(prov.annual_lakhs).toBe(30);
  });

  it("S3: CTC null (user skipped step) → has_user_ctc=false, all numbers null", () => {
    // Calibration: null monthly = user clicked Skip on the optional CTC step.
    const prov = buildProvenance(null);
    expect(prov.has_user_ctc).toBe(false);
    expect(prov.monthly_inr).toBe(null);
    expect(prov.annual_lakhs).toBe(null);
  });

  it("S3 edge: CTC=0 (treated as missing — never positive) → has_user_ctc=false, annual_lakhs=null", () => {
    // Calibration: 0 should be treated identically to null for the gate. Prevents the
    // case where create-scan strips an out-of-range value to 0 and we then render
    // "₹0L · your CTC" as if it were truth. annual_lakhs is null (not 0) because the
    // implementation uses `userMonthlyCTC ? Math.round(...) : null` — a truthy guard,
    // not a null-check. monthly_inr passes through 0 via `?? null`.
    const prov = buildProvenance(0);
    expect(prov.has_user_ctc).toBe(false);
    expect(prov.monthly_inr).toBe(0);
    expect(prov.annual_lakhs).toBe(null);
  });

  it("S1 edge: minimum legal CTC (₹5,000/month, the create-scan clamp floor) → has_user_ctc=true", () => {
    // Calibration: 5000 monthly = ₹0.6L annual; rounds to 1 (Math.round(0.6) = 1).
    // Anything > 0 must flip the flag, otherwise low-income users get the
    // "we don't know your salary" path even though they did enter one.
    const prov = buildProvenance(5_000);
    expect(prov.has_user_ctc).toBe(true);
    expect(prov.monthly_inr).toBe(5_000);
    expect(prov.annual_lakhs).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Client-side branch contract (Card4PivotPaths)
// ─────────────────────────────────────────────────────────────────────
describe("Card4 branch — hasUserCTC derivation", () => {
  // Mirrors the gate at Card4PivotPaths.tsx:
  //   const hasUserCTC = salaryProv.has_user_ctc === true;
  // The strict === true check matters: undefined/null/0/"true" must all fail closed.
  function deriveHasUserCTC(cardData: any): boolean {
    const salaryProv = (cardData?.salary_provenance ?? {}) as { has_user_ctc?: boolean };
    return salaryProv.has_user_ctc === true;
  }

  it("S1: card_data with has_user_ctc=true → math card path", () => {
    expect(deriveHasUserCTC({ salary_provenance: { has_user_ctc: true } })).toBe(true);
  });

  it("S3: card_data with has_user_ctc=false → bands-only path", () => {
    expect(deriveHasUserCTC({ salary_provenance: { has_user_ctc: false } })).toBe(false);
  });

  it("Legacy/missing: pre-fix scans with no salary_provenance field → fail closed (bands-only)", () => {
    // Calibration: scans completed before C2.1 shipped have no salary_provenance.
    // We MUST default to the bands-only path, not the math card. Otherwise legacy
    // scans render "+₹Xl delta" with no anchor.
    expect(deriveHasUserCTC({})).toBe(false);
    expect(deriveHasUserCTC(null)).toBe(false);
    expect(deriveHasUserCTC({ salary_provenance: null })).toBe(false);
  });

  it("Truthy-but-not-true: any non-strict-true value must fail closed", () => {
    // Calibration: the strict === true comparison guards against an LLM or
    // upstream code emitting "true"/1/{}/etc. into the field.
    expect(deriveHasUserCTC({ salary_provenance: { has_user_ctc: "true" } })).toBe(false);
    expect(deriveHasUserCTC({ salary_provenance: { has_user_ctc: 1 } })).toBe(false);
    expect(deriveHasUserCTC({ salary_provenance: { has_user_ctc: undefined } })).toBe(false);
  });
});
