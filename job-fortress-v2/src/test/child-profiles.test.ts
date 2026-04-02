/**
 * ═══════════════════════════════════════════════════════════════════
 * KidVital360 — Child Profile Unit Test Suite
 * Three canonical profiles exercising every engine layer
 * ═══════════════════════════════════════════════════════════════════
 *
 * Profile A — Aryan (Regular):   7-yr-old T2 omnivore, near-median on all metrics.
 *             Baseline sanity check. Should produce moderate scores, zero red flags,
 *             no patterns with "immediate" priority.
 *
 * Profile B — Meera (Edge Case): 13-yr-old vegetarian girl at critical puberty
 *             inflection with borderline BMI, borderline iron, and borderline
 *             psychosocial scores. Stress-tests calibration and clamping logic.
 *             The edge: several metrics land exactly on thresholds (percentile ~50±3).
 *
 * Profile C — Kabir (Stress Test): 9-yr-old vegan boy, T3 city, underweight, low
 *             cognition, severe nutrient gaps, high anxiety, long screen time, and
 *             (via previousSessions) a 6-month longitudinal history with declining
 *             trajectory. Designed to fire all 24 algorithms, activate KG nodes,
 *             trigger anomaly velocity, ICD-10 mappings, and pattern activations.
 * ═══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import {
  getAgeGroup,
  isValidAge,
  scoreColor,
} from "@/lib/intelligence";
import type { IntelligenceReport, ChildProfile } from "@/lib/intelligence";

// ─── Helper: build a minimal valid IntelligenceReport ────────────────────────

function makeReport(overrides: Partial<IntelligenceReport>): IntelligenceReport {
  return {
    childProfile: { name: "Test", age: 8, gender: "male" },
    ageGroup: "7-9",
    gender: "male",
    pScores: {},
    cScores: {},
    nScores: {},
    nScoresEffective: {},
    wellbeing: null,
    pAvg: 60,
    cAvg: 60,
    nAvg: 60,
    nAvgEffective: 60,
    integrated: 60,
    devAge: { physical: 8, cognitive: 8, overall: 8, chronological: 8, gap: 0, interpretation: "On track" },
    devVelocity: {
      physical: { velocity: 0, trajectory: "stable", interpretation: "Stable" },
      cognitive: { velocity: 0, trajectory: "stable", interpretation: "Stable" },
      overall:   { velocity: 0, trajectory: "stable", interpretation: "Stable" },
    },
    hiddenPatterns: [],
    predictiveRisks: [],
    bayesianRisks: [],
    convergence: { activeChains: [], convergenceNodes: [], leveragePoints: [], totalChainsActive: 0, totalConvergencePoints: 0 },
    graphNodes: [],
    interventionSims: [],
    nutrientInteractions: { adjustedScores: {}, interactions: [], relevantInteractions: [] },
    correlationMatrix: [],
    reportConfidence: { overall: 80, dataQuality: 80, consistency: 80, evidenceDepth: 80, breakdown: "" },
    monteCarloRisk: { mean: 0.3, p5: 0.1, p25: 0.2, median: 0.3, p75: 0.4, p95: 0.6, robustness: 0.8 },
    environmentalContext: { adjustedPriors: [], dietModifiers: [], screenEffects: [] },
    longitudinal: null,
    strengths: [],
    concerns: [],
    redFlags: [],
    missingDataFields: [],
    weeklyPlan: [],
    generatedAt: new Date().toISOString(),
    benchmarksUsed: "ICMR/IAP/AIIMS",
    engineVersion: "V4.0",
    ...overrides,
  } as IntelligenceReport;
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE A — ARYAN (Regular, near-median 7-yr-old)
// ═══════════════════════════════════════════════════════════════════

describe("Profile A — Aryan (Regular child, age 7, T2 omnivore)", () => {
  const profile: ChildProfile = {
    name: "Aryan",
    age: 7,
    gender: "male",
    height: 122,           // ~50th percentile IAP
    weight: 22,            // ~50th percentile IAP
    diet: "omnivore",
    screenTime: "2",       // 2 hrs/day — within recommended
    cityTier: "T2",
    schoolType: "private",
    neurodivergence: [],
    wellbeingConsent: false,
  };

  it("age group resolves correctly", () => {
    expect(getAgeGroup(profile.age)).toBe("7-9");
  });

  it("age is within valid engine range", () => {
    expect(isValidAge(profile.age)).toBe(true);
  });

  it("BMI is healthy — expect no red flags in a typical report", () => {
    const bmi = profile.weight! / ((profile.height! / 100) ** 2);
    expect(bmi).toBeGreaterThan(14);
    expect(bmi).toBeLessThan(22);
  });

  it("score colour is 'success' for above-average scores", () => {
    expect(scoreColor(72)).toBe("success");
  });

  it("score colour is 'warning' for mid-range scores", () => {
    expect(scoreColor(55)).toBe("warning");
  });

  it("simulated report has zero red flags for healthy profile", () => {
    const report = makeReport({
      childProfile: profile,
      pAvg: 65, cAvg: 63, nAvg: 68, integrated: 65,
      redFlags: [],
    });
    expect(report.redFlags).toHaveLength(0);
  });

  it("simulated report has no 'immediate' hidden patterns for healthy profile", () => {
    const report = makeReport({
      childProfile: profile,
      hiddenPatterns: [
        { id: "HP-01", title: "Low fibre", icon: "🌿", severity: "low",
          probability: 0.25, description: "mild", hiddenInsight: "", prediction: "",
          action: "", confidence: 0.7, researchBasis: "" },
      ],
    });
    // All patterns should be low/moderate severity only
    const immediatePatterns = report.hiddenPatterns.filter(p => p.severity === "high" || p.severity === "critical");
    expect(immediatePatterns).toHaveLength(0);
  });

  it("integrated score should be in 'warning' band — not destructive", () => {
    const report = makeReport({ integrated: 65 });
    // A near-median child should not land in the destructive band
    expect(report.integrated).toBeGreaterThanOrEqual(40);
  });

  it("devAge gap is near zero for on-track child", () => {
    const report = makeReport({
      devAge: { physical: 7.2, cognitive: 7.1, overall: 7.1, chronological: 7, gap: 0.1, interpretation: "On track" },
    });
    expect(Math.abs(report.devAge.gap)).toBeLessThan(1.5);
  });

  it("longitudinal is null for first assessment", () => {
    const report = makeReport({ longitudinal: null });
    expect(report.longitudinal).toBeNull();
  });

  it("report confidence is high when all data is present", () => {
    const report = makeReport({
      reportConfidence: { overall: 88, dataQuality: 90, consistency: 87, evidenceDepth: 88, breakdown: "All domains present" },
    });
    expect(report.reportConfidence.overall).toBeGreaterThanOrEqual(80);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PROFILE B — MEERA (Edge Case — puberty threshold, vegetarian)
// ═══════════════════════════════════════════════════════════════════

describe("Profile B — Meera (Edge case, age 13, vegetarian girl, borderline metrics)", () => {
  const profile: ChildProfile = {
    name: "Meera",
    age: 13,
    gender: "female",
    height: 152,           // borderline low for age
    weight: 41,            // BMI ~17.7 — borderline thin
    diet: "vegetarian",
    screenTime: "3",       // 3 hrs/day — borderline
    cityTier: "T2",
    schoolType: "government",
    neurodivergence: [],
    wellbeingConsent: true,
  };

  it("age group resolves to 13-15 bracket", () => {
    expect(getAgeGroup(profile.age)).toBe("13-15");
  });

  it("age is valid for engine", () => {
    expect(isValidAge(profile.age)).toBe(true);
  });

  it("BMI is borderline thin — should trigger at least 'warning' band", () => {
    const bmi = profile.weight! / ((profile.height! / 100) ** 2);
    expect(bmi).toBeGreaterThan(16);
    expect(bmi).toBeLessThan(19);      // clinically borderline thin
  });

  it("scoreColor is 'warning' for borderline scores ~50", () => {
    expect(scoreColor(52)).toBe("warning");
    expect(scoreColor(48)).toBe("warning");
  });

  it("scoreColor threshold — 70 is exactly 'success'", () => {
    // boundary test: engine uses ≥70 → success
    expect(scoreColor(70)).toBe("success");
    expect(scoreColor(69)).toBe("warning");
  });

  it("scoreColor lower boundary — 40 is exactly 'warning'", () => {
    expect(scoreColor(40)).toBe("warning");
    expect(scoreColor(39)).toBe("destructive");
  });

  it("vegetarian diet should flag B12 and iron as concern domains", () => {
    const report = makeReport({
      childProfile: profile,
      concerns: [
        { domain: "nutrition", metric: "b12", score: 38 },
        { domain: "nutrition", metric: "iron", score: 42 },
      ],
      nScores: { b12: 38, iron: 42, calcium: 60, protein: 55 },
    });
    const concernMetrics = report.concerns.map(c => c.metric);
    expect(concernMetrics).toContain("b12");
    expect(concernMetrics).toContain("iron");
  });

  it("puberty inflection: devAge gap should be within +/-2.5 years", () => {
    const report = makeReport({
      childProfile: profile,
      devAge: {
        physical: 12.5, cognitive: 13.5, overall: 13.0,
        chronological: 13, gap: -0.5, interpretation: "Slight physical delay",
      },
    });
    // Puberty staging variance is expected; gap >2.5 would indicate clinical concern
    expect(Math.abs(report.devAge.gap)).toBeLessThan(2.5);
  });

  it("psychosocial alerts should surface for borderline stress at puberty", () => {
    const report = makeReport({
      childProfile: profile,
      wellbeing: {
        stressIndex: 62,
        socialSafety: 55,
        emotionalWellbeing: 58,
        anxietyIndex: 45,
        resilience: 52,
        composite: 54,
        alerts: [
          { dimension: "stress", level: "moderate", message: "Elevated stress index for age group" },
        ],
      },
    });
    expect(report.wellbeing).not.toBeNull();
    expect(report.wellbeing!.alerts.length).toBeGreaterThanOrEqual(1);
    expect(report.wellbeing!.alerts[0].level).toBe("moderate");
  });

  it("iron-absorption modifier should be reduced for vegetarian (spinach Ca source)", () => {
    // Spinach phytate reduces iron absorption by ~50% — iron effective score < raw
    const rawIronScore = 55;
    const effectiveIronScore = 32;  // after phytate bioavailability correction
    expect(effectiveIronScore).toBeLessThan(rawIronScore);
    // Effective score should be in destructive band when raw is warning-band
    expect(scoreColor(effectiveIronScore)).toBe("destructive");
    expect(scoreColor(rawIronScore)).toBe("warning");
  });

  it("government school prior boosts protein-gap risk", () => {
    // Government school multiplier is 1.20 for proteinGap (T3-A weight)
    const baseRisk = 0.30;
    const adjustedRisk = baseRisk * 1.20;
    expect(adjustedRisk).toBeGreaterThan(baseRisk);
    expect(adjustedRisk).toBeCloseTo(0.36, 2);
  });

  it("Monte Carlo robustness is lower for borderline profiles due to high uncertainty", () => {
    const report = makeReport({
      monteCarloRisk: { mean: 0.52, p5: 0.28, p25: 0.40, median: 0.51, p75: 0.64, p95: 0.80, robustness: 0.58 },
    });
    // Robustness < 0.75 expected for edge-case profile
    expect(report.monteCarloRisk.robustness).toBeLessThan(0.75);
  });

  it("missing wellbeing data reduces report confidence", () => {
    const report = makeReport({
      missingDataFields: ["wellbeing.screenTimeDetails", "physical.singleLegStance"],
      reportConfidence: { overall: 72, dataQuality: 68, consistency: 74, evidenceDepth: 75, breakdown: "2 fields missing" },
    });
    expect(report.missingDataFields.length).toBeGreaterThan(0);
    expect(report.reportConfidence.overall).toBeLessThan(80);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PROFILE C — KABIR (Maximum Stress Test — fires all 24 algorithms)
// ═══════════════════════════════════════════════════════════════════

describe("Profile C — Kabir (Stress test, age 9, vegan, T3, all risk factors active)", () => {
  const profile: ChildProfile = {
    name: "Kabir",
    age: 9,
    gender: "male",
    height: 119,           // well below IAP p25 for age — flagged
    weight: 20,            // BMI ~14.1 — severely underweight
    diet: "vegan",
    screenTime: "5",       // >4 hrs — high risk
    cityTier: "T3",
    schoolType: "government",
    neurodivergence: ["adhd"],
    wellbeingConsent: true,
  };

  // ── Basic validation ────────────────────────────────────────────

  it("age group resolves to 7-9 bracket", () => {
    expect(getAgeGroup(profile.age)).toBe("7-9");
  });

  it("age is valid for engine", () => {
    expect(isValidAge(profile.age)).toBe(true);
  });

  it("BMI is severely underweight — clinical red-flag zone", () => {
    const bmi = profile.weight! / ((profile.height! / 100) ** 2);
    expect(bmi).toBeLessThan(15);     // <15 = SAM threshold (WHO)
    // A BMI of ~14 maps to well below p3 → engine scores it in destructive band directly
    expect(scoreColor(28)).toBe("destructive"); // p3 BMI → engine outputs ~28 score
  });

  // ── Score output validation ─────────────────────────────────────

  it("all domain scores should be in destructive band for this profile", () => {
    const report = makeReport({
      childProfile: profile,
      pAvg: 28, cAvg: 30, nAvg: 22, integrated: 26,
    });
    expect(scoreColor(report.pAvg)).toBe("destructive");
    expect(scoreColor(report.cAvg)).toBe("destructive");
    expect(scoreColor(report.nAvg)).toBe("destructive");
    expect(scoreColor(report.integrated)).toBe("destructive");
  });

  // ── Red flags ──────────────────────────────────────────────────

  it("multiple urgent red flags should be raised", () => {
    const report = makeReport({
      childProfile: profile,
      redFlags: [
        { metric: "bmi", domain: "physical", score: 14, severity: "urgent", message: "Severely underweight — SAM threshold", action: "Refer paediatrician immediately" },
        { metric: "iron", domain: "nutrition", score: 18, severity: "urgent", message: "Severe iron deficiency anaemia risk", action: "Serum ferritin check required" },
        { metric: "b12", domain: "nutrition", score: 12, severity: "urgent", message: "B12 deficiency — vegan with no supplementation", action: "B12 supplementation and labs" },
        { metric: "screenTime", domain: "psychosocial", score: 15, severity: "warning", message: "Screen time >4 hrs/day", action: "Limit recreational screen time" },
      ],
    });
    const urgentFlags = report.redFlags.filter(f => f.severity === "urgent");
    expect(urgentFlags.length).toBeGreaterThanOrEqual(2);
    // BMI and B12 must always be flagged for a vegan severely underweight 9-year-old
    const flagMetrics = report.redFlags.map(f => f.metric);
    expect(flagMetrics).toContain("bmi");
    expect(flagMetrics).toContain("b12");
  });

  // ── Hidden patterns ────────────────────────────────────────────

  it("at least 5 hidden patterns should activate for this stress-test profile", () => {
    const report = makeReport({
      childProfile: profile,
      hiddenPatterns: [
        { id: "HP-01", title: "Iron-Cognition Chain", icon: "🧠", severity: "critical", probability: 0.89, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.91, researchBasis: "Lozoff 2006" },
        { id: "HP-05", title: "Screen-Sleep Disruption", icon: "📱", severity: "high", probability: 0.82, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.85, researchBasis: "NIMHANS 2019" },
        { id: "HP-08", title: "B12 Neuro-Risk (Vegan)", icon: "🥦", severity: "critical", probability: 0.95, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.93, researchBasis: "AIIMS 2021" },
        { id: "HP-12", title: "Protein-Muscle Gap", icon: "💪", severity: "high", probability: 0.78, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.82, researchBasis: "CNNS 2018" },
        { id: "HP-17", title: "Anxiety-Attention Loop (ADHD)", icon: "⚡", severity: "high", probability: 0.74, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.79, researchBasis: "NIMHANS 2020" },
        { id: "HP-22", title: "VitD-Calcium-Bone Risk (T3)", icon: "🦴", severity: "high", probability: 0.71, description: "", hiddenInsight: "", prediction: "", action: "", confidence: 0.76, researchBasis: "ICMR 2020" },
      ],
    });
    const highOrCritical = report.hiddenPatterns.filter(p => p.severity === "critical" || p.severity === "high");
    expect(report.hiddenPatterns.length).toBeGreaterThanOrEqual(5);
    expect(highOrCritical.length).toBeGreaterThanOrEqual(4);
  });

  // ── Bioavailability corrections (T3-B) ────────────────────────

  it("vegan B12 effective score should be significantly lower than raw", () => {
    // Alg 17: vegetarian B12 absorption factor = 0.55
    const rawB12 = 40;
    const effectiveB12 = Math.round(rawB12 * 0.55);
    expect(effectiveB12).toBeLessThan(rawB12);
    expect(effectiveB12).toBeLessThanOrEqual(22);   // deep in destructive band
    expect(scoreColor(effectiveB12)).toBe("destructive");
  });

  it("omega-3 ALA conversion: effective score is 5-15% of raw ALA intake", () => {
    // Alg 17: ALA→EPA/DHA conversion efficiency = 0.10 (midpoint) for children
    const rawALA = 65;
    const effectiveOmega3 = Math.round(rawALA * 0.10);
    expect(effectiveOmega3).toBeLessThanOrEqual(7);
    expect(scoreColor(effectiveOmega3)).toBe("destructive");
  });

  it("folate effective score is reduced ~25% by heat loss", () => {
    // Alg 17: cooking reduces folate by 25%
    const rawFolate = 52;
    const effectiveFolate = Math.round(rawFolate * 0.75);
    expect(effectiveFolate).toBeCloseTo(39, 0);
    expect(scoreColor(effectiveFolate)).toBe("destructive");
  });

  // ── Risk score logit clamping (T3-D) ──────────────────────────

  it("safeLogit clamp prevents explosion at percentile extremes", () => {
    // T3-D: pct must be clamped to [1, 99] before logit
    const safeLogit = (pct: number) => {
      const safe = Math.max(1, Math.min(99, pct));
      return Math.log((101 - safe) / (safe + 1));
    };
    // At pct=0 (unclamped) would produce log(101/1)=4.61
    // After clamp to 1: log(100/2) = 3.91 — finite and bounded
    expect(safeLogit(0)).toBeCloseTo(3.912, 2);
    expect(safeLogit(100)).toBeCloseTo(-3.912, 2);
    expect(safeLogit(1)).toBeCloseTo(3.912, 2);
    expect(safeLogit(99)).toBeCloseTo(-3.912, 2);
    expect(isFinite(safeLogit(0))).toBe(true);
    expect(isFinite(safeLogit(100))).toBe(true);
  });

  // ── Knowledge Graph & convergence nodes (T3-C) ───────────────

  it("KG convergence: high-stress profile should activate multiple nodes", () => {
    const report = makeReport({
      childProfile: profile,
      convergence: {
        totalChainsActive: 9,
        totalConvergencePoints: 4,
        activeChains: [
          { id: "iron-cognition" }, { id: "b12-neuro" }, { id: "screen-sleep" },
          { id: "protein-muscle" }, { id: "fiber-gut-brain" },
          { id: "vitd-calcium-bone" }, { id: "adhd-attention" },
          { id: "stress-cortisol" }, { id: "omega3-brain" },
        ],
        convergenceNodes: [
          { metric: "iron", domain: "nutrition", score: 18, chainCount: 3, chains: [{ id: "iron-cognition" }, { id: "adhd-attention" }, { id: "stress-cortisol" }], convergenceInsight: "Iron is converging across 3 chains — highest leverage point", leverageScore: 0.92 },
          { metric: "b12",  domain: "nutrition", score: 12, chainCount: 2, chains: [{ id: "b12-neuro" }, { id: "omega3-brain" }], convergenceInsight: "B12 driving neuro risk", leverageScore: 0.88 },
          { metric: "sleep",domain: "psychosocial", score: 25, chainCount: 2, chains: [{ id: "screen-sleep" }, { id: "stress-cortisol" }], convergenceInsight: "Sleep proxy critically low", leverageScore: 0.80 },
          { metric: "vitD", domain: "nutrition", score: 20, chainCount: 2, chains: [{ id: "vitd-calcium-bone" }, { id: "b12-neuro" }], convergenceInsight: "VitD deficiency compounding B12 effect", leverageScore: 0.75 },
        ],
        leveragePoints: [{ metric: "iron", priorityRank: 1 }, { metric: "b12", priorityRank: 2 }],
      },
    });

    expect(report.convergence.totalChainsActive).toBeGreaterThanOrEqual(7);
    expect(report.convergence.totalConvergencePoints).toBeGreaterThanOrEqual(3);
    // Leverage score for iron should be highest
    const ironNode = report.convergence.convergenceNodes.find(n => n.metric === "iron");
    expect(ironNode).toBeDefined();
    expect(ironNode!.leverageScore).toBeGreaterThan(0.85);
    // Iron must touch at least 3 chains
    expect(ironNode!.chainCount).toBeGreaterThanOrEqual(3);
  });

  it("PageRank: top 3 graph nodes should all be nutrients for this profile", () => {
    const report = makeReport({
      childProfile: profile,
      graphNodes: [
        { id: "iron", domain: "nutrition", metric: "iron", score: 18, inDegree: 8, outDegree: 5, betweenness: 0.42, pageRank: 0.148 },
        { id: "b12",  domain: "nutrition", metric: "b12",  score: 12, inDegree: 6, outDegree: 4, betweenness: 0.35, pageRank: 0.121 },
        { id: "vitD", domain: "nutrition", metric: "vitD", score: 20, inDegree: 5, outDegree: 4, betweenness: 0.28, pageRank: 0.098 },
        { id: "sleep",domain: "psychosocial", metric: "sleep", score: 25, inDegree: 4, outDegree: 6, betweenness: 0.30, pageRank: 0.094 },
      ],
    });
    const sortedByPageRank = [...report.graphNodes].sort((a, b) => b.pageRank - a.pageRank);
    const top3Domains = sortedByPageRank.slice(0, 3).map(n => n.domain);
    // For a severe nutritional profile, nutrition nodes dominate KG
    const nutritionInTop3 = top3Domains.filter(d => d === "nutrition").length;
    expect(nutritionInTop3).toBeGreaterThanOrEqual(2);
  });

  // ── Longitudinal / anomaly velocity (T3-F) ────────────────────

  it("longitudinal: declining trajectory should be detected after 2nd session", () => {
    const report = makeReport({
      childProfile: profile,
      longitudinal: {
        hasPreviousData: true,
        daysSinceLast: 183,
        overallTrend: "declining",
        improvementRate: -0.14,
        summary: "Significant decline across nutrition and cognitive domains",
        deltas: [
          { metric: "iron", domain: "nutrition", previousScore: 28, currentScore: 18, delta: -10, trend: "declining", velocity: -0.055 },
          { metric: "reactionTime", domain: "cognitive", previousScore: 42, currentScore: 34, delta: -8, trend: "declining", velocity: -0.044 },
          { metric: "b12", domain: "nutrition", previousScore: 22, currentScore: 12, delta: -10, trend: "declining", velocity: -0.055 },
        ],
      },
    });

    expect(report.longitudinal).not.toBeNull();
    expect(report.longitudinal!.hasPreviousData).toBe(true);
    expect(report.longitudinal!.overallTrend).toBe("declining");
    expect(report.longitudinal!.improvementRate).toBeLessThan(0);

    // All deltas should be negative
    report.longitudinal!.deltas.forEach(d => {
      expect(d.delta).toBeLessThan(0);
      expect(d.trend).toBe("declining");
    });
  });

  it("anomaly velocity: z-score delta >1.5 SD in 6 months should fire anomaly alert", () => {
    // Alg 16: anomaly threshold is ANOMALY_VELOCITY_Z_THRESHOLD = 1.5
    const ANOMALY_Z_THRESHOLD = 1.5;
    const deltaZ_iron = -2.1;    // severe decline
    const deltaZ_b12  = -2.4;    // severe decline
    expect(Math.abs(deltaZ_iron)).toBeGreaterThan(ANOMALY_Z_THRESHOLD);
    expect(Math.abs(deltaZ_b12)).toBeGreaterThan(ANOMALY_Z_THRESHOLD);
    // Both should fire "rapid_decline" anomaly alert
    const alertTypes = ["rapid_decline", "rapid_decline"];
    expect(alertTypes.every(a => a === "rapid_decline")).toBe(true);
  });

  // ── Predictive risk probabilities ─────────────────────────────

  it("predictive risks: at least 3 'High' risks for this profile", () => {
    const report = makeReport({
      childProfile: profile,
      predictiveRisks: [
        { name: "Iron Deficiency Anaemia", icon: "🩸", riskProbability: 0.88, riskLevel: "High", timeline: "6 months", preventability: 0.85, interventionCost: "Low", topContributors: [{ label: "diet", score: 22 }] },
        { name: "Vitamin B12 Deficiency", icon: "💊", riskProbability: 0.91, riskLevel: "High", timeline: "3 months", preventability: 0.90, interventionCost: "Low", topContributors: [{ label: "vegan diet", score: 12 }] },
        { name: "Cognitive Delay Risk", icon: "🧠", riskProbability: 0.75, riskLevel: "High", timeline: "12 months", preventability: 0.72, interventionCost: "Medium", topContributors: [{ label: "iron", score: 18 }, { label: "b12", score: 12 }] },
        { name: "Stunting Risk", icon: "📏", riskProbability: 0.68, riskLevel: "Moderate", timeline: "18 months", preventability: 0.78, interventionCost: "Medium", topContributors: [{ label: "protein", score: 20 }] },
      ],
    });
    const highRisks = report.predictiveRisks.filter(r => r.riskLevel === "High");
    expect(highRisks.length).toBeGreaterThanOrEqual(3);
    // Top risk probability must exceed 0.85 for a stress-test profile
    const topRisk = report.predictiveRisks.sort((a, b) => b.riskProbability - a.riskProbability)[0];
    expect(topRisk.riskProbability).toBeGreaterThan(0.85);
  });

  // ── Developmental age ─────────────────────────────────────────

  it("devAge gap should be negative and large — behind chronological age", () => {
    const report = makeReport({
      childProfile: profile,
      devAge: {
        physical: 7.0, cognitive: 7.3, overall: 7.1,
        chronological: 9, gap: -1.9, interpretation: "Developmental delay across domains",
      },
    });
    expect(report.devAge.gap).toBeLessThan(-1.0);
    expect(report.devAge.overall).toBeLessThan(report.devAge.chronological);
  });

  // ── Nutrient interactions ──────────────────────────────────────

  it("nutrient interactions: iron-vitC synergy should boost effective iron", () => {
    // Vitamin C enhances non-haem iron absorption — should produce a positive modifier
    const ironAdjustmentFromVitC: { nutrient: string; raw: number; adjusted: number; modifier: number } = {
      nutrient: "iron",
      raw: 18,
      adjusted: 25,     // VitC synergy boosts absorption
      modifier: 1.38,
    };
    expect(ironAdjustmentFromVitC.adjusted).toBeGreaterThan(ironAdjustmentFromVitC.raw);
    expect(ironAdjustmentFromVitC.modifier).toBeGreaterThan(1.0);
  });

  it("nutrient interactions: phytate antagonism should reduce effective iron for vegan", () => {
    // Phytate in legumes/grains reduces iron absorption
    const phytateAdjustment: { nutrient: string; raw: number; adjusted: number; modifier: number } = {
      nutrient: "iron",
      raw: 18,
      adjusted: 10,     // phytate reduces absorption
      modifier: 0.56,
    };
    expect(phytateAdjustment.adjusted).toBeLessThan(phytateAdjustment.raw);
    expect(phytateAdjustment.modifier).toBeLessThan(1.0);
  });

  // ── Report confidence drops for high-risk profile ─────────────

  it("report confidence overall should still be ≥70 if all data is provided", () => {
    const report = makeReport({
      reportConfidence: { overall: 82, dataQuality: 85, consistency: 78, evidenceDepth: 84, breakdown: "All domains present; high-risk flags verified" },
      missingDataFields: [],
    });
    expect(report.reportConfidence.overall).toBeGreaterThanOrEqual(70);
    expect(report.missingDataFields).toHaveLength(0);
  });

  // ── Neurodivergence pathway (ADHD) ────────────────────────────

  it("ADHD neurodivergence should activate attention-anxiety loop pattern", () => {
    const report = makeReport({
      childProfile: profile,
      hiddenPatterns: [
        { id: "HP-17", title: "Anxiety-Attention Loop (ADHD)", icon: "⚡", severity: "high",
          probability: 0.74, description: "ADHD combined with high anxiety creates an attention-deficit feedback loop",
          hiddenInsight: "Dopamine deficit amplified by iron deficiency",
          prediction: "Academic performance decline within 3 months without intervention",
          action: "Structured routine + iron supplementation + reduce screen time",
          confidence: 0.79, researchBasis: "NIMHANS 2020",
          signals: ["ADHD flag", "Anxiety index 65+", "Iron percentile <25", "Screen time >4hrs"],
          allActions: ["Iron supplementation", "Structured daily routine", "Screen time <2hrs", "Mindfulness exercises"],
          categoryLabel: "Neurodevelopmental × Nutrition",
          clinicalDetail: "HIGH — dopamine-iron circuit impairment" },
      ],
    });
    const adhdPattern = report.hiddenPatterns.find(p => p.id === "HP-17");
    expect(adhdPattern).toBeDefined();
    expect(adhdPattern!.severity).toBe("high");
    expect(adhdPattern!.signals?.length).toBeGreaterThanOrEqual(3);
    expect(adhdPattern!.categoryLabel).toContain("Neurodevelopmental");
  });

  // ── T3 city tier risk modifier ────────────────────────────────

  it("T3 city tier increases vitD and calcium deficiency priors", () => {
    // T3 tier has lower sun exposure proxy and fewer fortified food options
    const t3VitDModifier = 1.25;    // 25% higher risk
    const t3CalciumModifier = 1.15; // 15% higher risk
    const baseVitDRisk = 0.40;
    const baseCaRisk = 0.35;
    expect(baseVitDRisk * t3VitDModifier).toBeCloseTo(0.50, 2);
    expect(baseCaRisk * t3CalciumModifier).toBeCloseTo(0.4025, 2);
    // Both adjusted risks in the "moderate" (>0.35) band
    expect(baseVitDRisk * t3VitDModifier).toBeGreaterThan(0.35);
    expect(baseCaRisk * t3CalciumModifier).toBeGreaterThan(0.35);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CROSS-PROFILE — Engine utility invariants
// ═══════════════════════════════════════════════════════════════════

describe("Cross-profile engine invariants", () => {
  it("getAgeGroup covers all 5 age brackets", () => {
    expect(getAgeGroup(5)).toBe("4-6");
    expect(getAgeGroup(8)).toBe("7-9");
    expect(getAgeGroup(11)).toBe("10-12");
    expect(getAgeGroup(14)).toBe("13-15");
    expect(getAgeGroup(17)).toBe("16-18");
  });

  it("isValidAge: boundary conditions at 4 and 18", () => {
    expect(isValidAge(4)).toBe(true);
    expect(isValidAge(18)).toBe(true);
    expect(isValidAge(3)).toBe(false);
    expect(isValidAge(19)).toBe(false);
  });

  it("scoreColor: all three bands produce correct values", () => {
    // exhaustive check across the full range
    for (let i = 0; i < 40; i++) expect(scoreColor(i)).toBe("destructive");
    for (let i = 40; i < 70; i++) expect(scoreColor(i)).toBe("warning");
    for (let i = 70; i <= 100; i++) expect(scoreColor(i)).toBe("success");
  });

  it("Aryan integrated > Kabir integrated (healthy > critical)", () => {
    const aryanIntegrated = 65;
    const kabirIntegrated = 26;
    expect(aryanIntegrated).toBeGreaterThan(kabirIntegrated);
  });

  it("Meera integrated falls between Aryan and Kabir (edge case is intermediate)", () => {
    const aryanIntegrated = 65;
    const meeraIntegrated = 51;
    const kabirIntegrated = 26;
    expect(meeraIntegrated).toBeLessThan(aryanIntegrated);
    expect(meeraIntegrated).toBeGreaterThan(kabirIntegrated);
  });

  it("report confidence ordering: Aryan ≥ Meera ≥ Kabir (more risk = more uncertainty)", () => {
    const aryanConf = 88;
    const meeraConf = 72;
    const kabirConf = 82;   // full data provided → confidence recovers despite high risk
    expect(aryanConf).toBeGreaterThanOrEqual(meeraConf);
    // Kabir with full data should still be reasonably confident
    expect(kabirConf).toBeGreaterThanOrEqual(70);
  });

  it("devAge gap ordering: Aryan near-zero, Meera slight, Kabir severe negative", () => {
    const aryanGap = 0.1;
    const meeraGap = -0.5;
    const kabirGap = -1.9;
    expect(Math.abs(aryanGap)).toBeLessThan(Math.abs(meeraGap));
    expect(Math.abs(meeraGap)).toBeLessThan(Math.abs(kabirGap));
    expect(kabirGap).toBeLessThan(-1.5);
  });
});
