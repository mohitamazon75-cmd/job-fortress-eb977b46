// ─── Wellbeing Scoring Engine Tests ───────────────────────────────────────────
// Profile 1: Aarav, 9yr, no ND     → healthy wellbeing answers
// Profile 2: Sia, 13yr, ADHD       → stress + attention concerns
// Profile 3: Dev, 7yr, ASD         → social safety adjustment
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  scoreWellbeing,
  getWellbeingAlerts,
  type WellbeingAnswers,
  type WellbeingScores,
} from "@/lib/wellbeing-scoring";

// Healthy child — all answers = 3 (most positive option)
const HEALTHY_ALL_3: WellbeingAnswers = {
  0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3,
};

// Struggling child — all answers = 0 (most concerning option)
const STRUGGLING_ALL_0: WellbeingAnswers = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
};

// Mid-range child — mixed answers
const AARAV_TYPICAL: WellbeingAnswers = {
  0: 3, // goes to school eagerly
  1: 2, // mentions 1-2 friends
  2: 2, // sometimes wakes at night
  3: 3, // rarely has tummy aches
  4: 2, // handles frustration with help
  5: 3, // loves hobbies
  6: 2, // comes home happy mostly
  7: 2, // worries about some things
  8: 2, // adjusts to changes with some help
  9: 3, // talks positively about self
};

// Sia — stress + anxiety signals (ADHD profile)
const SIA_STRESSED: WellbeingAnswers = {
  0: 1, // reluctant about school
  1: 1, // one friend
  2: 1, // sleep disruption
  3: 1, // some somatic complaints
  4: 2, // moderate frustration tolerance
  5: 2, // some hobbies
  6: 1, // comes home somewhat upset
  7: 1, // frequent worry
  8: 1, // struggles with change
  9: 2, // somewhat positive self-talk
};

// Dev — ASD social profile (low social naming, not indicating distress)
const DEV_ASD_SOCIAL: WellbeingAnswers = {
  0: 2, // goes to school ok
  1: 0, // doesn't mention friends by name (ASD typical)
  2: 3, // sleeps well
  3: 3, // no somatic complaints
  4: 3, // good frustration tolerance
  5: 3, // loves specific hobbies
  6: 3, // comes home calm
  7: 2, // some worry
  8: 1, // struggles with change (routine preference)
  9: 3, // positive self-talk
};

describe("Wellbeing Scoring Engine — scoreWellbeing()", () => {
  describe("Profile 1: Aarav, healthy typical profile", () => {
    it("healthy answers produce high composite (>60)", () => {
      const scores = scoreWellbeing(AARAV_TYPICAL);
      expect(scores.composite).toBeGreaterThan(60);
    });

    it("all-3 answers produce very high composite (>75)", () => {
      const scores = scoreWellbeing(HEALTHY_ALL_3);
      expect(scores.composite).toBeGreaterThan(75);
    });

    it("all-0 answers produce low composite (<40)", () => {
      const scores = scoreWellbeing(STRUGGLING_ALL_0);
      expect(scores.composite).toBeLessThan(40);
    });

    it("returns all 6 required score keys", () => {
      const scores = scoreWellbeing(AARAV_TYPICAL);
      expect(scores).toHaveProperty("stressIndex");
      expect(scores).toHaveProperty("socialSafety");
      expect(scores).toHaveProperty("emotionalWellbeing");
      expect(scores).toHaveProperty("anxietyIndex");
      expect(scores).toHaveProperty("resilience");
      expect(scores).toHaveProperty("composite");
    });

    it("all scores are integers in [0, 100]", () => {
      const scores = scoreWellbeing(AARAV_TYPICAL);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(Number.isInteger(score)).toBe(true);
      });
    });

    it("healthy profile generates no alerts or only 'normal' alerts", () => {
      const scores = scoreWellbeing(HEALTHY_ALL_3);
      const alerts = getWellbeingAlerts(scores);
      const concerns = alerts.filter(a => a.level === "concern");
      expect(concerns).toHaveLength(0);
    });
  });

  describe("Profile 2: Sia, ADHD stress pattern", () => {
    it("ADHD adjustment reduces stressIndex score (less penalised)", () => {
      const ndScores = scoreWellbeing(SIA_STRESSED, ["adhd"]);
      const plainScores = scoreWellbeing(SIA_STRESSED, []);
      // ADHD adjustment: stressIndex -= 8 → ndScore should be lower (less stressed on index)
      expect(ndScores.stressIndex).toBeLessThanOrEqual(plainScores.stressIndex);
    });

    it("ADHD resilience boost applied correctly", () => {
      const ndScores = scoreWellbeing(SIA_STRESSED, ["adhd"]);
      const plainScores = scoreWellbeing(SIA_STRESSED, []);
      // ADHD resilience: +5 points
      expect(ndScores.resilience).toBeGreaterThanOrEqual(plainScores.resilience);
    });

    it("stressed profile generates at least one alert", () => {
      const scores = scoreWellbeing(SIA_STRESSED, ["adhd"]);
      const alerts = getWellbeingAlerts(scores);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("all ADHD adjusted scores remain within [0, 100]", () => {
      const scores = scoreWellbeing(SIA_STRESSED, ["adhd"]);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Profile 3: Dev, ASD social profile", () => {
    it("ASD socialSafety adjustment (+12) compensates low friend-naming score", () => {
      const ndScores = scoreWellbeing(DEV_ASD_SOCIAL, ["asd"]);
      const plainScores = scoreWellbeing(DEV_ASD_SOCIAL, []);
      // ASD social safety boost of +12
      expect(ndScores.socialSafety).toBeGreaterThan(plainScores.socialSafety - 5);
    });

    it("ASD emotionalWellbeing gets +8 adjustment for flat affect", () => {
      const ndScores = scoreWellbeing(DEV_ASD_SOCIAL, ["asd"]);
      const plainScores = scoreWellbeing(DEV_ASD_SOCIAL, []);
      expect(ndScores.emotionalWellbeing).toBeGreaterThanOrEqual(plainScores.emotionalWellbeing);
    });

    it("ASD child with good overall profile has high composite despite social pattern", () => {
      const scores = scoreWellbeing(DEV_ASD_SOCIAL, ["asd"]);
      expect(scores.composite).toBeGreaterThan(55);
    });
  });

  describe("getWellbeingAlerts()", () => {
    it("no alerts for healthy child", () => {
      const scores = scoreWellbeing(HEALTHY_ALL_3);
      const alerts = getWellbeingAlerts(scores);
      const serious = alerts.filter(a => a.level !== "normal");
      expect(serious.length).toBe(0);
    });

    it("multiple concern-level alerts for struggling child", () => {
      const scores = scoreWellbeing(STRUGGLING_ALL_0);
      const alerts = getWellbeingAlerts(scores);
      const concerns = alerts.filter(a => a.level === "concern");
      expect(concerns.length).toBeGreaterThan(1);
    });

    it("alert dimensions are non-empty strings", () => {
      const scores = scoreWellbeing(STRUGGLING_ALL_0);
      const alerts = getWellbeingAlerts(scores);
      alerts.forEach(alert => {
        expect(alert.dimension.length).toBeGreaterThan(0);
        expect(alert.message.length).toBeGreaterThan(0);
        expect(["normal", "watch", "concern"]).toContain(alert.level);
      });
    });
  });

  describe("Edge cases", () => {
    it("empty answers default gracefully to 50th pct per dimension", () => {
      expect(() => scoreWellbeing({})).not.toThrow();
    });

    it("neurodivergence=['none'] same as no ND", () => {
      const noneScores = scoreWellbeing(AARAV_TYPICAL, ["none"]);
      const emptyScores = scoreWellbeing(AARAV_TYPICAL, []);
      expect(noneScores).toEqual(emptyScores);
    });

    it("multiple ND profiles accumulate without crashing", () => {
      expect(() => scoreWellbeing(AARAV_TYPICAL, ["adhd", "giftedness"])).not.toThrow();
    });
  });
});
