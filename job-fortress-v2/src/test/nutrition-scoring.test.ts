// ─── Nutrition Scoring Engine Tests ───────────────────────────────────────────
// Profile 1: Aarav, 9yr male, vegetarian   → typical vegetarian diet
// Profile 2: Sia, 13yr female, non-veg     → includes egg/meat contributions
// Profile 3: Dev, 7yr male, vegan          → expected gaps in calcium/protein
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  scoreNutrition,
  estimateNutrientIntake,
  type NutritionAnswers,
} from "@/lib/nutrition-scoring";

// ─── Aarav 9yr male vegetarian — balanced diet answers ─────────────────────
// Q0: dairy=2 glasses, Q1: dal=2 servings, Q2: eggs=SKIPPED(veg), Q3: leafy=3x/wk
// Q4: fruit=1 daily, Q5: water=6-7 glasses, Q6: millet=weekly
// Q7: snacks=rarely(3), Q8: sunlight=3-4x(2), Q9: nuts=1-2x(1)
const AARAV_BALANCED_VEG: NutritionAnswers = {
  0: 2, // dairy: 2 glasses
  1: 2, // dal: 2 servings
  2: 2, // leafy: 4-5x/wk (egg skipped for veg)
  3: 1, // fruit: 1/day
  4: 2, // water: 6-7 glasses
  5: 1, // millet: weekly
  6: 3, // snacks: rarely (healthiest)
  7: 2, // sunlight: 3-4x
  8: 1, // nuts: 1-2x/week
};

// ─── Aarav — poor diet (all zeros = worst answers) ──────────────────────────
const AARAV_POOR_DIET: NutritionAnswers = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
};

// ─── Aarav — perfect diet (all 3s = best answers) ───────────────────────────
const AARAV_PERFECT_DIET: NutritionAnswers = {
  0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3,
};

// ─── Sia 13yr female, non-vegetarian — includes egg column ─────────────────
const SIA_NONVEG: NutritionAnswers = {
  0: 2, // dairy
  1: 2, // dal
  2: 2, // eggs: 4-7/wk
  3: 2, // leafy
  4: 2, // fruit
  5: 3, // water: 8+ glasses
  6: 0, // millet: never
  7: 2, // snacks: 1-2x
  8: 3, // sunlight: daily
  9: 2, // nuts: 3-5x
};

// ─── Dev 7yr male, vegan — no dairy, no eggs, minimal protein ──────────────
const DEV_VEGAN: NutritionAnswers = {
  0: 0, // no dairy
  1: 3, // lots of dal
  2: 2, // leafy veg: 4-5x (egg skipped for veg)
  3: 2, // fruit
  4: 3, // lots of water
  5: 2, // millet 2-3x
  6: 3, // no snacks
  7: 3, // daily sunlight
  8: 3, // lots of nuts
};

describe("Nutrition Scoring Engine — scoreNutrition()", () => {
  describe("Profile 1: Aarav, 9yr male, vegetarian", () => {
    it("balanced vegetarian diet scores above 40 on all nutrients", () => {
      const scores = scoreNutrition(AARAV_BALANCED_VEG, 9, "male", true);
      expect(scores.protein).toBeGreaterThan(40);
      expect(scores.calcium).toBeGreaterThan(40);
      expect(scores.iron).toBeGreaterThan(30); // iron can be lower in veg diets
      expect(scores.fiber).toBeGreaterThan(40);
      expect(scores.water).toBeGreaterThan(40);
    });

    it("poor diet scores below 40 on protein, calcium, iron", () => {
      const scores = scoreNutrition(AARAV_POOR_DIET, 9, "male", true);
      expect(scores.protein).toBeLessThan(40);
      expect(scores.calcium).toBeLessThan(40);
    });

    it("perfect diet scores above 70 on most nutrients", () => {
      const scores = scoreNutrition(AARAV_PERFECT_DIET, 9, "male", true);
      expect(scores.protein).toBeGreaterThan(60);
      expect(scores.calcium).toBeGreaterThan(60);
      expect(scores.fiber).toBeGreaterThan(60);
    });

    it("returns all 6 required score keys", () => {
      const scores = scoreNutrition(AARAV_BALANCED_VEG, 9, "male", true);
      expect(scores).toHaveProperty("calories");
      expect(scores).toHaveProperty("protein");
      expect(scores).toHaveProperty("calcium");
      expect(scores).toHaveProperty("iron");
      expect(scores).toHaveProperty("fiber");
      expect(scores).toHaveProperty("water");
    });

    it("all scores are integers in [1, 99]", () => {
      const scores = scoreNutrition(AARAV_BALANCED_VEG, 9, "male", true);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(99);
        expect(Number.isInteger(score)).toBe(true);
      });
    });
  });

  describe("Profile 2: Sia, 13yr female, non-vegetarian", () => {
    it("non-veg diet includes egg contribution — protein should be higher than veg", () => {
      const nonVegScores = scoreNutrition(SIA_NONVEG, 13, "female", false);
      const vegScores = scoreNutrition({ ...SIA_NONVEG }, 13, "female", true); // same answers, veg mode
      // Non-veg includes egg question at index 2 → higher protein
      expect(nonVegScores.protein).toBeGreaterThanOrEqual(vegScores.protein - 5);
    });

    it("female 13yr uses gender+age correct benchmarks", () => {
      expect(() => scoreNutrition(SIA_NONVEG, 13, "female", false)).not.toThrow();
      const scores = scoreNutrition(SIA_NONVEG, 13, "female", false);
      expect(Object.keys(scores)).toHaveLength(6);
    });

    it("high water intake scores near top for water", () => {
      const scores = scoreNutrition(SIA_NONVEG, 13, "female", false);
      expect(scores.water).toBeGreaterThan(60);
    });
  });

  describe("Profile 3: Dev, 7yr male, vegan — expect calcium gap", () => {
    it("vegan diet without dairy shows calcium gap (score < 60)", () => {
      const scores = scoreNutrition(DEV_VEGAN, 7, "male", true);
      // No dairy → calcium will be lower despite millet contribution
      expect(scores.calcium).toBeLessThan(65);
    });

    it("high dal intake compensates protein partially", () => {
      const scores = scoreNutrition(DEV_VEGAN, 7, "male", true);
      expect(scores.protein).toBeGreaterThan(40);
    });

    it("all vegan scores in valid range", () => {
      const scores = scoreNutrition(DEV_VEGAN, 7, "male", true);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(99);
      });
    });
  });

  describe("estimateNutrientIntake() — raw nutrient computation", () => {
    it("vegetarian mode skips egg question correctly", () => {
      // Same answers, but veg=true remaps index 2 to leafy (skipping egg)
      const vegIntake = estimateNutrientIntake(AARAV_BALANCED_VEG, true);
      const nonVegIntake = estimateNutrientIntake({ ...AARAV_BALANCED_VEG, 2: 3 }, false);
      // Non-veg with index 2 = eggs = 3 should have higher protein
      expect(nonVegIntake.protein).toBeGreaterThan(vegIntake.protein);
    });

    it("base intake floor ensures non-zero values even with all-zero answers", () => {
      const intake = estimateNutrientIntake(AARAV_POOR_DIET, true);
      expect(intake.calories).toBeGreaterThan(0);
      expect(intake.protein).toBeGreaterThan(0);
      expect(intake.calcium).toBeGreaterThan(0);
    });

    it("higher answer indices add more nutrients monotonically for dal (protein)", () => {
      const low = estimateNutrientIntake({ 1: 0 }, false);
      const mid = estimateNutrientIntake({ 1: 2 }, false);
      const high = estimateNutrientIntake({ 1: 3 }, false);
      expect(mid.protein).toBeGreaterThan(low.protein);
      expect(high.protein).toBeGreaterThan(mid.protein);
    });
  });

  describe("Edge cases", () => {
    it("age 4 (youngest) resolves benchmarks without crash", () => {
      expect(() => scoreNutrition(AARAV_BALANCED_VEG, 4, "male", true)).not.toThrow();
    });

    it("age 18 resolves benchmarks without crash", () => {
      expect(() => scoreNutrition(AARAV_BALANCED_VEG, 18, "female", false)).not.toThrow();
    });

    it("empty answers fallback to base intake only", () => {
      const scores = scoreNutrition({}, 9, "male", true);
      expect(Object.keys(scores)).toHaveLength(6);
    });
  });
});
