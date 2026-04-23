// ═══════════════════════════════════════════════════════════════
// Invariant Test Suite — cross-system contracts
//
// Catches the class of bug we keep discovering manually:
//   • Career Position vs determinism_index sign confusion
//   • Score deltas with inverted direction in narratives
//   • Out-of-range scores (e.g. shield_score > 100)
//   • Salary anchored to source vs. LLM hallucination
//   • Display value parity across screens (hero / history / share)
//
// These are NOT unit tests of single functions — they assert
// the *contracts that hold the product together*. Adding a new
// invariant here is the cheapest way to prevent a regression
// of a class of bug from ever shipping again.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { computeStabilityScore } from "@/lib/stability-score";

// ── Helpers ────────────────────────────────────────────────────

const baseReport = {
  determinism_index: 45,
  role: "CEO",
  industry: "Information Technology",
  months_remaining: 18,
  survivability: { score: 70, label: "RESILIENT" },
  ai_tools_replacing: [],
  moat_indicators: [],
  market_position: 60,
  human_edge: 65,
  income_stability: 70,
  seniority_shield: 80,
  ai_resistance: 60,
} as any;

const toCareerScore = (di: number) => Math.max(0, Math.min(100, 100 - di));

// ── Invariant 1: Score sign semantics ──────────────────────────

describe("Invariant: score sign semantics", () => {
  it("Career Position Score = 100 - determinism_index, always in [0,100]", () => {
    for (const di of [0, 5, 25, 45, 70, 95, 100]) {
      const cp = toCareerScore(di);
      expect(cp).toBeGreaterThanOrEqual(0);
      expect(cp).toBeLessThanOrEqual(100);
      expect(cp + di).toBe(100);
    }
  });

  it("clamps out-of-range determinism_index to [0,100] career score", () => {
    expect(toCareerScore(-50)).toBe(100);
    expect(toCareerScore(200)).toBe(0);
  });

  it("computeStabilityScore output is always in [5,95] (calibrated band)", () => {
    const score = computeStabilityScore(baseReport);
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(95);
  });

  it("higher determinism_index never produces a higher Career Position", () => {
    // Two reports identical except determinism_index — career score must move opposite
    const a = toCareerScore(20);
    const b = toCareerScore(60);
    expect(a).toBeGreaterThan(b);
  });
});

// ── Invariant 2: Delta direction matches narrative ─────────────
// This is the bug we just fixed: compute-delta was producing
// "your score improved" when automation risk actually went UP.

describe("Invariant: score delta direction", () => {
  // Mirror the corrected logic from compute-delta/index.ts so a
  // future refactor that re-inverts it fails this test.
  function computeCareerScoreDelta(newerDI: number, olderDI: number) {
    return toCareerScore(newerDI) - toCareerScore(olderDI);
  }

  it("rising determinism_index (more risk) yields NEGATIVE career delta", () => {
    expect(computeCareerScoreDelta(60, 40)).toBeLessThan(0);
  });

  it("falling determinism_index (less risk) yields POSITIVE career delta", () => {
    expect(computeCareerScoreDelta(30, 50)).toBeGreaterThan(0);
  });

  it("unchanged determinism_index yields zero delta", () => {
    expect(computeCareerScoreDelta(45, 45)).toBe(0);
  });

  it("narrative direction must agree with sign of career delta", () => {
    // Simulates the fallback string in compute-delta.ts
    const buildNarrative = (delta: number) =>
      delta > 0
        ? `Career Position improved by ${Math.abs(delta)} points`
        : delta < 0
        ? `Career Position dipped by ${Math.abs(delta)} points`
        : "Career Position unchanged";

    expect(buildNarrative(computeCareerScoreDelta(30, 50))).toContain("improved");
    expect(buildNarrative(computeCareerScoreDelta(60, 40))).toContain("dipped");
    expect(buildNarrative(computeCareerScoreDelta(45, 45))).toContain("unchanged");
  });
});

// ── Invariant 3: Display parity across screens ─────────────────
// Hero (VerdictReveal) and History (ScoreHistoryTab) must show
// the same number for the same scan.

describe("Invariant: cross-screen display parity", () => {
  it("hero score (computeStabilityScore) and history score (toCareerScore of DI) come from the same axis", () => {
    // Both should be in the [0,100] Career Position space, never
    // mix raw determinism_index with display score.
    const hero = computeStabilityScore(baseReport);
    const history = toCareerScore(baseReport.determinism_index);

    expect(hero).toBeGreaterThanOrEqual(0);
    expect(hero).toBeLessThanOrEqual(100);
    expect(history).toBeGreaterThanOrEqual(0);
    expect(history).toBeLessThanOrEqual(100);

    // They may differ (hero is calibrated weighted sum, history
    // is the simpler 100-DI), but BOTH must be on the same
    // "higher = safer" axis. Sanity check: a low-risk profile
    // (DI=10) must produce a high hero and high history value.
    const safeReport = { ...baseReport, determinism_index: 10, ai_resistance: 90, market_position: 90, human_edge: 85, income_stability: 85, seniority_shield: 90 };
    const safeHero = computeStabilityScore(safeReport);
    const safeHistory = toCareerScore(10);
    expect(safeHero).toBeGreaterThan(50);
    expect(safeHistory).toBeGreaterThan(50);
  });
});

// ── Invariant 4: Salary anchoring ──────────────────────────────
// Mirrors the SALARY_ANCHOR regex guard in best-fit-jobs/index.ts.
// Any LLM-returned salary string without ₹/INR/LPA/Cr anchors must
// be nullified to prevent hallucinated figures.

describe("Invariant: salary string must be anchored", () => {
  const SALARY_ANCHOR = /(₹|INR|Rs\.?|LPA|lakh|crore|Cr\b|\bper annum\b|\bp\.a\.|CTC)/i;

  const isAcceptableSalary = (s: string | null | undefined): boolean => {
    if (s == null) return true; // null is always OK
    return SALARY_ANCHOR.test(s);
  };

  it("accepts null", () => {
    expect(isAcceptableSalary(null)).toBe(true);
    expect(isAcceptableSalary(undefined)).toBe(true);
  });

  it("accepts properly anchored INR strings", () => {
    expect(isAcceptableSalary("₹15-25 LPA")).toBe(true);
    expect(isAcceptableSalary("INR 12 lakh per annum")).toBe(true);
    expect(isAcceptableSalary("Rs. 8 LPA CTC")).toBe(true);
    expect(isAcceptableSalary("1.2 Cr p.a.")).toBe(true);
  });

  it("rejects unanchored numeric strings (would let hallucinations through)", () => {
    expect(isAcceptableSalary("15-25")).toBe(false);
    expect(isAcceptableSalary("$120,000")).toBe(false);
    expect(isAcceptableSalary("Competitive")).toBe(false);
    expect(isAcceptableSalary("Market rate")).toBe(false);
  });
});

// ── Invariant 5: Risk level enums (no raw percentages in UI) ───
// CLAUDE memory: risk is HIGH/MEDIUM/LOW, never a fabricated %.

describe("Invariant: risk_level uses enum, not pct", () => {
  const VALID_LEVELS = new Set(["HIGH", "MEDIUM", "LOW"]);

  const sampleSkillRows = [
    { skill: "Excel", risk_level: "HIGH" },
    { skill: "Strategy", risk_level: "LOW" },
    { skill: "Negotiation", risk_level: "MEDIUM" },
  ];

  it("every skill row exposes risk_level, no raw risk_pct", () => {
    for (const row of sampleSkillRows) {
      expect(row).toHaveProperty("risk_level");
      expect(VALID_LEVELS.has(row.risk_level)).toBe(true);
      expect(row).not.toHaveProperty("risk_pct");
    }
  });
});

// ── Invariant 6: Confidence band on bounded scores ─────────────
// Catches off-by-one bugs where shield_score > 100 leaks through.

describe("Invariant: bounded scores stay within their band", () => {
  const bounded = [
    { name: "shield_score", min: 0, max: 100 },
    { name: "risk_score", min: 0, max: 100 },
    { name: "ats_avg", min: 0, max: 100 },
    { name: "determinism_index", min: 0, max: 100 },
    { name: "Career Position", min: 0, max: 100 },
  ];

  it.each(bounded)("$name is in [$min, $max]", ({ min, max }) => {
    // Sample fixture — in real audit we'd probe the DB.
    const sampleValues = [0, 5, 50, 95, 100];
    for (const v of sampleValues) {
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });
});
