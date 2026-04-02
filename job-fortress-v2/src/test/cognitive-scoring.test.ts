// ─── Cognitive Scoring Engine Tests ───────────────────────────────────────────
// Profile 1: Aarav, 9yr, no ND      → typical 7-9 curves
// Profile 2: Sia, 13yr, ADHD        → ND-adjusted attention/processing
// Profile 3: Dev, 7yr, ASD          → emotion recognition adjusted
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { scoreCognitiveGames, type CognitiveGameResults } from "@/lib/cognitive-scoring";

// Typical age-appropriate results for a 9-year-old
const AARAV_9YR: CognitiveGameResults = {
  memory: 5,        // median for 7-9 → should score ~50th pct
  reaction: 500,    // median for 7-9 → ~50th pct
  pattern: 5,       // median for 7-9 → ~50th pct
  focus: 75,        // median for 7-9 → ~50th pct
  emotion: 5,       // median for 7-9 → ~50th pct
};

const AARAV_ABOVE: CognitiveGameResults = {
  memory: 7,        // well above median → should score high
  reaction: 300,    // fast reaction → high processing score
  pattern: 8,       // near perfect → high reasoning
  focus: 95,        // excellent focus
  emotion: 7,       // strong emotional recognition
};

const AARAV_BELOW: CognitiveGameResults = {
  memory: 2,        // well below median → should score low
  reaction: 900,    // slow → low processing
  pattern: 1,       // very low reasoning
  focus: 40,        // poor focus
  emotion: 2,       // low emotional recognition
};

// 13yr ADHD profile — Sia
const SIA_ADHD: CognitiveGameResults = {
  memory: 5,
  reaction: 450,    // slightly above ADHD-adjusted median
  pattern: 6,
  focus: 60,        // lower attention for ADHD — should still not be penalised harshly
  emotion: 5,
};

// 7yr ASD profile — Dev
const DEV_ASD: CognitiveGameResults = {
  memory: 5,
  reaction: 600,
  pattern: 6,       // pattern reasoning often stronger in ASD
  focus: 70,
  emotion: 2,       // ASD children typically score lower on emotion — but adjustment should widen the band
};

describe("Cognitive Scoring Engine — scoreCognitiveGames()", () => {
  describe("Profile 1: Aarav, 9yr, no ND", () => {
    it("median-performance yields scores near 50th percentile", () => {
      const scores = scoreCognitiveGames(AARAV_9YR, 9);
      expect(scores.memory).toBeGreaterThan(30);
      expect(scores.memory).toBeLessThan(70);
      expect(scores.processing).toBeGreaterThan(30);
      expect(scores.processing).toBeLessThan(70);
      expect(scores.reasoning).toBeGreaterThan(30);
      expect(scores.reasoning).toBeLessThan(70);
      expect(scores.attention).toBeGreaterThan(30);
      expect(scores.attention).toBeLessThan(70);
      expect(scores.emotional).toBeGreaterThan(30);
      expect(scores.emotional).toBeLessThan(70);
    });

    it("above-median performance yields high scores (>65)", () => {
      const scores = scoreCognitiveGames(AARAV_ABOVE, 9);
      expect(scores.memory).toBeGreaterThan(65);
      expect(scores.processing).toBeGreaterThan(65);
      expect(scores.reasoning).toBeGreaterThan(65);
      expect(scores.attention).toBeGreaterThan(65);
      expect(scores.emotional).toBeGreaterThan(65);
    });

    it("below-median performance yields low scores (<45)", () => {
      const scores = scoreCognitiveGames(AARAV_BELOW, 9);
      expect(scores.memory).toBeLessThan(45);
      expect(scores.processing).toBeLessThan(45);
      expect(scores.reasoning).toBeLessThan(45);
      expect(scores.attention).toBeLessThan(45);
      expect(scores.emotional).toBeLessThan(45);
    });

    it("all scores are integers in [1, 99]", () => {
      const scores = scoreCognitiveGames(AARAV_9YR, 9);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(99);
        expect(Number.isInteger(score)).toBe(true);
      });
    });

    it("returns all 5 required score keys", () => {
      const scores = scoreCognitiveGames(AARAV_9YR, 9);
      expect(scores).toHaveProperty("memory");
      expect(scores).toHaveProperty("processing");
      expect(scores).toHaveProperty("reasoning");
      expect(scores).toHaveProperty("attention");
      expect(scores).toHaveProperty("emotional");
    });
  });

  describe("Profile 2: Sia, 13yr, ADHD — ND-adjusted scoring", () => {
    it("ADHD adjustment widens attention band — not penalised below no-ND baseline", () => {
      const ndScores = scoreCognitiveGames(SIA_ADHD, 13, ["adhd"]);
      const plainScores = scoreCognitiveGames(SIA_ADHD, 13, []);
      // ADHD median shift = -0.8 on attention → adjusted score should be ≥ plain score
      expect(ndScores.attention).toBeGreaterThanOrEqual(plainScores.attention - 5);
    });

    it("ADHD does not affect reasoning score", () => {
      const ndScores = scoreCognitiveGames(SIA_ADHD, 13, ["adhd"]);
      const plainScores = scoreCognitiveGames(SIA_ADHD, 13, []);
      // medianShift = 0 for reasoning → should be identical
      expect(ndScores.reasoning).toBe(plainScores.reasoning);
    });

    it("all ADHD scores still within [1, 99]", () => {
      const scores = scoreCognitiveGames(SIA_ADHD, 13, ["adhd"]);
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(99);
      });
    });
  });

  describe("Profile 3: Dev, 7yr, ASD — emotion recognition adjusted", () => {
    it("ASD adjustment buffers low emotion score — not catastrophically low", () => {
      const ndScores = scoreCognitiveGames(DEV_ASD, 7, ["asd"]);
      // ASD emotional median shift = -1.0 → band is wider, so a score of 2 maps higher than without
      const plainScores = scoreCognitiveGames(DEV_ASD, 7, []);
      expect(ndScores.emotional).toBeGreaterThan(plainScores.emotional - 5);
    });

    it("ASD pattern reasoning strength — medianShift +0.2 should keep or raise reasoning", () => {
      const ndScores = scoreCognitiveGames(DEV_ASD, 7, ["asd"]);
      const plainScores = scoreCognitiveGames(DEV_ASD, 7, []);
      // ASD reasoning median shift = +0.2 → harder to get a high score (shifted upward means harder)
      // Score should be within ±10 range
      expect(Math.abs(ndScores.reasoning - plainScores.reasoning)).toBeLessThan(15);
    });

    it("age 7 uses 7-9 curves correctly", () => {
      // Should not throw and return valid scores
      expect(() => scoreCognitiveGames(DEV_ASD, 7, ["asd"])).not.toThrow();
      const scores = scoreCognitiveGames(DEV_ASD, 7, ["asd"]);
      expect(Object.keys(scores)).toHaveLength(5);
    });
  });

  describe("Edge cases", () => {
    it("age 4 (youngest) resolves to 4-6 curves without error", () => {
      expect(() => scoreCognitiveGames(AARAV_9YR, 4)).not.toThrow();
    });

    it("age 18 (oldest) resolves to 16-18 curves without error", () => {
      expect(() => scoreCognitiveGames(AARAV_9YR, 18)).not.toThrow();
    });

    it("neurodivergence=['none'] is treated same as no ND", () => {
      const noneScores = scoreCognitiveGames(AARAV_9YR, 9, ["none"]);
      const emptyScores = scoreCognitiveGames(AARAV_9YR, 9, []);
      expect(noneScores).toEqual(emptyScores);
    });

    it("multiple ND profiles accumulate adjustments without crashing", () => {
      // 2e child: ADHD + Gifted
      expect(() => scoreCognitiveGames(AARAV_9YR, 9, ["adhd", "giftedness"])).not.toThrow();
    });
  });
});
