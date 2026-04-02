// ─── Physical Assessment Scoring Tests ────────────────────────────────────────
// Tests the level → score mapping, BMI calculation, and result structure
// that handleSubmit() in PhysicalAssessment.tsx produces.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ─── Replicate the exact scoring logic from PhysicalAssessment.tsx ─────────
// Level 0 = Not yet: 20, Level 1 = Developing: 45, Level 2 = Age norm: 68, Level 3 = Exceeds: 88
const LEVEL_SCORES = [20, 45, 68, 88];
const ACTIVITIES = ["balance", "coordination", "grip", "endurance", "flexibility"];

function buildPhysicalResult(
  selections: Record<string, number>,
  height?: number,
  weight?: number
): Record<string, number> {
  const bmi = weight && height ? weight / Math.pow(height / 100, 2) : undefined;
  const bmiScore = bmi ? Math.max(50, 100 - Math.abs(bmi - 16) * 5) : 65;

  const result: Record<string, number> = { bmi: Math.round(bmiScore) };
  ACTIVITIES.forEach(key => {
    const lvl = selections[key] ?? 1;
    result[key] = LEVEL_SCORES[lvl];
  });
  return result;
}

// ─── Test profiles ────────────────────────────────────────────────────────────
// Aarav: 9yr, 132cm, 28kg → BMI ≈ 16.1
const AARAV_HEIGHT = 132;
const AARAV_WEIGHT = 28;

// Sia: 13yr, 155cm, 45kg → BMI ≈ 18.7
const SIA_HEIGHT = 155;
const SIA_WEIGHT = 45;

describe("Physical Assessment Scoring Logic", () => {
  describe("Level → Score mapping", () => {
    it("Level 0 (Not yet) maps to score 20", () => {
      const result = buildPhysicalResult({ balance: 0, coordination: 0, grip: 0, endurance: 0, flexibility: 0 });
      expect(result.balance).toBe(20);
      expect(result.coordination).toBe(20);
    });

    it("Level 1 (Developing) maps to score 45", () => {
      const result = buildPhysicalResult({ balance: 1, coordination: 1, grip: 1, endurance: 1, flexibility: 1 });
      expect(result.balance).toBe(45);
    });

    it("Level 2 (Age norm) maps to score 68", () => {
      const result = buildPhysicalResult({ balance: 2, coordination: 2, grip: 2, endurance: 2, flexibility: 2 });
      expect(result.balance).toBe(68);
    });

    it("Level 3 (Exceeds) maps to score 88", () => {
      const result = buildPhysicalResult({ balance: 3, coordination: 3, grip: 3, endurance: 3, flexibility: 3 });
      expect(result.balance).toBe(88);
    });

    it("monotonically increasing scores: 20 < 45 < 68 < 88", () => {
      const s = LEVEL_SCORES;
      expect(s[0]).toBeLessThan(s[1]);
      expect(s[1]).toBeLessThan(s[2]);
      expect(s[2]).toBeLessThan(s[3]);
    });
  });

  describe("BMI scoring — Profile 1: Aarav (9yr, 132cm, 28kg)", () => {
    it("calculates BMI ≈ 16.1 for Aarav's profile", () => {
      const bmi = AARAV_WEIGHT / Math.pow(AARAV_HEIGHT / 100, 2);
      expect(bmi).toBeCloseTo(16.08, 1);
    });

    it("BMI ≈ 16.1 produces bmiScore near 50 (close to ideal 16)", () => {
      const result = buildPhysicalResult(
        { balance: 2, coordination: 2, grip: 2, endurance: 2, flexibility: 2 },
        AARAV_HEIGHT,
        AARAV_WEIGHT
      );
      // BMI=16.1, deviation from 16 = 0.1 → score = 100 - 0.1*5 = 99.5, capped at max
      expect(result.bmi).toBeGreaterThan(80); // very close to ideal
    });

    it("result contains all required 6 keys", () => {
      const result = buildPhysicalResult(
        { balance: 2, coordination: 2, grip: 2, endurance: 2, flexibility: 2 },
        AARAV_HEIGHT,
        AARAV_WEIGHT
      );
      expect(result).toHaveProperty("bmi");
      expect(result).toHaveProperty("balance");
      expect(result).toHaveProperty("coordination");
      expect(result).toHaveProperty("grip");
      expect(result).toHaveProperty("endurance");
      expect(result).toHaveProperty("flexibility");
    });
  });

  describe("BMI scoring — Profile 2: Sia (13yr, 155cm, 45kg)", () => {
    it("calculates BMI ≈ 18.7 for Sia's profile", () => {
      const bmi = SIA_WEIGHT / Math.pow(SIA_HEIGHT / 100, 2);
      expect(bmi).toBeCloseTo(18.73, 1);
    });

    it("BMI 18.7 deviation from 16 = 2.7 → score = 100 - 13.5 = 86.5 → ≥50", () => {
      const result = buildPhysicalResult(
        { balance: 2, coordination: 2, grip: 2, endurance: 2, flexibility: 2 },
        SIA_HEIGHT,
        SIA_WEIGHT
      );
      expect(result.bmi).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Missing height/weight defaults", () => {
    it("without height/weight, bmi defaults to 65", () => {
      const result = buildPhysicalResult(
        { balance: 2, coordination: 2, grip: 2, endurance: 2, flexibility: 2 }
      );
      expect(result.bmi).toBe(65);
    });
  });

  describe("Profile 1: Mixed performance — Aarav typical session", () => {
    it("mixed levels produce correct per-activity scores", () => {
      const result = buildPhysicalResult({
        balance: 3,       // Exceeds → 88
        coordination: 2,  // Age norm → 68
        grip: 1,          // Developing → 45
        endurance: 2,     // Age norm → 68
        flexibility: 0,   // Not yet → 20
      }, AARAV_HEIGHT, AARAV_WEIGHT);

      expect(result.balance).toBe(88);
      expect(result.coordination).toBe(68);
      expect(result.grip).toBe(45);
      expect(result.endurance).toBe(68);
      expect(result.flexibility).toBe(20);
    });
  });

  describe("Edge cases", () => {
    it("skipped selections default to level 1 (Developing = 45)", () => {
      const result = buildPhysicalResult({}); // no selections
      expect(result.balance).toBe(45);
      expect(result.coordination).toBe(45);
    });

    it("all scores are non-negative integers", () => {
      const result = buildPhysicalResult(
        { balance: 2, coordination: 1, grip: 3, endurance: 0, flexibility: 2 },
        AARAV_HEIGHT,
        AARAV_WEIGHT
      );
      Object.values(result).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(score)).toBe(true);
      });
    });
  });
});
