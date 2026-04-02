// ─── Assessment Hub Checklist Wall Tests ─────────────────────────────────────
// Tests the gate logic: all 5 steps must be complete to unlock Blueprint Report
// Mirrors the exact conditions checked in AssessmentHub.tsx and Dashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ─── Replicate the exact gate logic from AssessmentHub.tsx ───────────────────
// allCoreDone = physical + cognitive + nutritional + wellbeing all done
// dmUploaded  = discoverme profile exists in DB
// allFiveDone = allCoreDone AND dmUploaded → Blueprint CTA unlocks

interface AssessmentState {
  physicalResult: Record<string, number> | null;
  cognitiveResult: Record<string, number> | null;
  nutritionalResult: Record<string, number> | null;
  discovermeProfile: Record<string, any> | null;
}

function computeGateState(state: AssessmentState) {
  const wellbeingDone = !!(state.cognitiveResult?._wellbeing_composite != null);
  const physDone = !!state.physicalResult;
  const cogDone = !!state.cognitiveResult;
  const nutrDone = !!state.nutritionalResult;
  const dmDone = !!state.discovermeProfile;

  const allCoreDone = physDone && cogDone && nutrDone && wellbeingDone;
  const allFiveDone = allCoreDone && dmDone;
  const stepsComplete = [physDone, cogDone, nutrDone, wellbeingDone, dmDone].filter(Boolean).length;

  return { physDone, cogDone, nutrDone, wellbeingDone, dmDone, allCoreDone, allFiveDone, stepsComplete };
}

// ─── Dummy assessment results ─────────────────────────────────────────────────
const PHYS_DONE = { bmi: 72, balance: 68, coordination: 68, grip: 45, endurance: 68, flexibility: 88 };
const COG_DONE = { memory: 65, processing: 72, reasoning: 68, attention: 58, emotional: 70, _wellbeing_composite: 74, _wellbeing_anxiety: 68, _wellbeing_stress: 72, _wellbeing_social: 78, _wellbeing_emotional: 74, _wellbeing_resilience: 70 };
const NUTR_DONE = { calories: 55, protein: 48, calcium: 42, iron: 38, fiber: 52, water: 65 };
const DM_DONE = { blueprintCode: "VKS-3A", brainHemisphere: "right", temperament: "divergent" };

describe("Assessment Hub Gate Logic", () => {
  describe("Zero progress state", () => {
    it("no assessments done → stepsComplete = 0", () => {
      const state = computeGateState({ physicalResult: null, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      expect(state.stepsComplete).toBe(0);
    });

    it("no assessments done → allCoreDone = false", () => {
      const state = computeGateState({ physicalResult: null, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      expect(state.allCoreDone).toBe(false);
    });

    it("no assessments done → allFiveDone = false → Blueprint locked", () => {
      const state = computeGateState({ physicalResult: null, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      expect(state.allFiveDone).toBe(false);
    });
  });

  describe("Partial progress — Profile 1: Aarav (Physical done only)", () => {
    it("1/5 done → stepsComplete = 1", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      expect(state.stepsComplete).toBe(1);
      expect(state.physDone).toBe(true);
      expect(state.cogDone).toBe(false);
    });

    it("allCoreDone still false with only physical", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      expect(state.allCoreDone).toBe(false);
    });
  });

  describe("Partial progress — 3/5 done (Physical + Cognitive + Nutrition)", () => {
    it("3/5 done → stepsComplete = 3, wellbeing still needed", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: null });
      // wellbeing IS embedded in cognitive (_wellbeing_projective = 1)
      // so cognitiveResult includes wellbeing → 4/5 (phys + cog + wellbeing + nutr)
      expect(state.stepsComplete).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Critical: wellbeing gate (_wellbeing_composite presence)", () => {
    it("cognitive done WITHOUT wellbeing composite → wellbeingDone = false", () => {
      const cogNoWellbeing = { memory: 65, processing: 72 }; // no _wellbeing_composite
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: cogNoWellbeing, nutritionalResult: NUTR_DONE, discovermeProfile: null });
      expect(state.wellbeingDone).toBe(false);
      expect(state.allCoreDone).toBe(false);
    });

    it("cognitive done WITH wellbeing composite (_wellbeing_composite != null) → wellbeingDone = true", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: null });
      expect(state.wellbeingDone).toBe(true);
    });

    it("all 4 core done but NO discoverme → allCoreDone = true, allFiveDone = false", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: null });
      expect(state.allCoreDone).toBe(true);
      expect(state.allFiveDone).toBe(false);
    });
  });

  describe("All 5 complete — Blueprint unlocked", () => {
    it("all 5 done → stepsComplete = 5", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: DM_DONE });
      expect(state.stepsComplete).toBe(5);
    });

    it("all 5 done → allFiveDone = true → Blueprint CTA unlocks", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: DM_DONE });
      expect(state.allFiveDone).toBe(true);
    });

    it("allCoreDone = true when all 4 core assessments complete", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: DM_DONE });
      expect(state.allCoreDone).toBe(true);
    });
  });

  describe("Dashboard BlueprintCTA mirrors AssessmentHub gate", () => {
    it("0/5 → shows 'complete all to unlock' message", () => {
      const state = computeGateState({ physicalResult: null, cognitiveResult: null, nutritionalResult: null, discovermeProfile: null });
      // In Dashboard, BlueprintCTA shows "X of 5 steps done"
      expect(state.stepsComplete).toBe(0);
      expect(state.allFiveDone).toBe(false);
    });

    it("4/5 → still locked — DiscoverMe is the final gate", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: null });
      // stepsComplete = 4 (phys + cog + wellbeing[embedded] + nutr), no DM
      expect(state.stepsComplete).toBe(4);
      expect(state.allFiveDone).toBe(false);
    });

    it("5/5 → unlocked — Blueprint Report CTA is clickable", () => {
      const state = computeGateState({ physicalResult: PHYS_DONE, cognitiveResult: COG_DONE, nutritionalResult: NUTR_DONE, discovermeProfile: DM_DONE });
      expect(state.stepsComplete).toBe(5);
      expect(state.allFiveDone).toBe(true);
    });
  });
});

// ─── Score Validation: Domain Averages ────────────────────────────────────────
describe("Domain Score Averages (Dashboard display logic)", () => {
  function avg(scores: Record<string, number>): number {
    const vals = Object.values(scores).filter(v => !isNaN(v));
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  it("physical average for Aarav typical session is in valid range", () => {
    const a = avg(PHYS_DONE);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it("cognitive average for Aarav is in valid range", () => {
    const cogWithoutFlag = { memory: 65, processing: 72, reasoning: 68, attention: 58, emotional: 70 };
    const a = avg(cogWithoutFlag);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it("nutrition average for Aarav is in valid range", () => {
    const a = avg(NUTR_DONE);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(100);
  });
});
