// ═══════════════════════════════════════════════════════════════════════════
// KidVital360 Intelligence Engine V4.0 — Main Engine
// The Five-Layer Intelligence Stack Orchestrator
// ═══════════════════════════════════════════════════════════════════════════
//
//  Layer 1 → Raw Signal Acquisition (input validation)
//  Layer 2 → Calibrated Percentile Engine (within algorithms)
//  Layer 3 → 24-Algorithm Intelligence Core
//  Layer 4 → Hidden Pattern Detection Engine (31 patterns)
//  Layer 5 → Precision Action Plan Synthesiser
//
// ═══════════════════════════════════════════════════════════════════════════

import {
  RawAssessmentInput, EngineResult,
  AssessmentSession, InterventionTrackingResult,
} from "./engine-v4-types.ts";

import { runAllAlgorithms } from "./engine-v4-algorithms.ts";
import { evaluateHiddenPatterns } from "./engine-v4-patterns.ts";
import { synthesiseActionPlan, trackInterventionOutcomes } from "./engine-v4-action-plan.ts";

const ENGINE_VERSION = "4.0.0";

// ═══════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION (Layer 1)
// ═══════════════════════════════════════════════════════════════════════════

function validateInput(input: RawAssessmentInput): string[] {
  const errors: string[] = [];

  // Profile validation
  if (!input.profile) errors.push("Missing child profile");
  else {
    if (input.profile.ageYears < 5 || input.profile.ageYears > 17)
      errors.push("Age must be between 5 and 17 years");
    if (!input.profile.gender)
      errors.push("Gender is required");
    if (!input.profile.cityTier)
      errors.push("City tier is required");
  }

  // Physical metrics validation
  if (!input.physical) errors.push("Missing physical assessment data");
  else {
    if (input.physical.heightCm < 50 || input.physical.heightCm > 200)
      errors.push("Height must be between 50-200 cm");
    if (input.physical.weightKg < 10 || input.physical.weightKg > 120)
      errors.push("Weight must be between 10-120 kg");
  }

  // Cognitive battery validation
  if (!input.cognitive) errors.push("Missing cognitive assessment data");
  else {
    if (input.cognitive.reactionTimeMs < 50 || input.cognitive.reactionTimeMs > 3000)
      errors.push("Reaction time must be 50-3000ms");
  }

  // Dietary assessment validation
  if (!input.dietary) errors.push("Missing dietary assessment data");
  else {
    if (!input.dietary.answers || input.dietary.answers.length !== 10)
      errors.push("Dietary assessment requires exactly 10 answers");
  }

  // Psychosocial screener validation
  if (!input.psychosocial) errors.push("Missing psychosocial screener data");
  else {
    if (!input.psychosocial.answers || input.psychosocial.answers.length !== 12)
      errors.push("Psychosocial screener requires exactly 12 answers");
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENGINE PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KidVital360 Intelligence Engine — Main Entry Point
 *
 * Runs the complete 5-layer intelligence pipeline:
 * 1. Validates raw assessment inputs
 * 2. Computes percentiles and runs 24 algorithms
 * 3. Evaluates 31 hidden patterns
 * 4. Synthesises personalised 24-week action plan
 * 5. Tracks intervention outcomes (if previous sessions exist)
 *
 * @param input - Complete raw assessment data for a child
 * @returns EngineResult with all outputs, patterns, and action plan
 * @throws Error if input validation fails
 */
export function runEngine(input: RawAssessmentInput): EngineResult {
  const startTime = Date.now();

  // ── Layer 1: Input Validation ──────────────────────────────────────────
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    throw new Error(`Input validation failed:\n${validationErrors.join("\n")}`);
  }

  // ── Layer 2 + 3: Percentile Engine + 24-Algorithm Core ────────────────
  const algorithmOutputs = runAllAlgorithms(input);

  // ── Layer 4: Hidden Pattern Detection ─────────────────────────────────
  const patternActivations = evaluateHiddenPatterns(input, algorithmOutputs);

  // ── Layer 5: Action Plan Synthesis ────────────────────────────────────
  const actionPlan = synthesiseActionPlan(input, algorithmOutputs, patternActivations);

  // ── Intervention Tracking (if longitudinal) ───────────────────────────
  let interventionTracking: InterventionTrackingResult[] | undefined;
  if (input.previousSessions && input.previousSessions.length > 0) {
    const lastSession = input.previousSessions[input.previousSessions.length - 1];
    if (lastSession.actionPlan) {
      interventionTracking = trackInterventionOutcomes(
        algorithmOutputs.percentiles,
        lastSession,
        lastSession.actionPlan
      );
    }
  }

  const computeTimeMs = Date.now() - startTime;

  return {
    childProfile: input.profile,
    percentiles: algorithmOutputs.percentiles,
    algorithmOutputs,
    patternActivations,
    actionPlan,
    interventionTracking,
    metadata: {
      engineVersion: ENGINE_VERSION,
      computeTimeMs,
      algorithmsExecuted: 24,
      patternsEvaluated: 33,
      patternsActivated: patternActivations.activatedCount,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick health check — returns a simplified summary without the full plan
 */
export function quickHealthCheck(input: RawAssessmentInput): {
  latentHealthScore: number;
  phenotype: string;
  riskLevel: string;
  topConcerns: string[];
  topStrengths: string[];
} {
  const result = runEngine(input);
  const lhs = result.algorithmOutputs.latentHealthScore.lhs;
  const topConcerns = result.patternActivations.patterns
    .filter(p => p.actionPriority === "immediate" || p.actionPriority === "high")
    .slice(0, 3)
    .map(p => p.patternName);

  const p = result.percentiles;
  const topStrengths: string[] = [];
  if (p.physical.composite >= 65) topStrengths.push("Physical fitness");
  if (p.cognitive.composite >= 65) topStrengths.push("Cognitive ability");
  if (p.dietary.composite >= 65) topStrengths.push("Nutrition");
  if (p.psychosocial.composite >= 65) topStrengths.push("Emotional wellbeing");

  return {
    latentHealthScore: lhs,
    phenotype: result.algorithmOutputs.phenotypicProfile.name,
    riskLevel: lhs >= 65 ? "low" : lhs >= 45 ? "moderate" : "elevated",
    topConcerns,
    topStrengths,
  };
}

/**
 * Get intervention recommendations only (lighter than full engine run)
 */
export function getRecommendations(input: RawAssessmentInput): {
  tier0Alerts: string[];
  topInterventions: Array<{ title: string; domain: string; effort: string; why: string }>;
  parentSummary: string;
} {
  const result = runEngine(input);
  const topInterventions = result.actionPlan.topPriorityInterventions.map(i => ({
    title: i.title,
    domain: i.domain,
    effort: i.effortLevel,
    why: i.linkedPatterns.length > 0
      ? `Addresses: ${i.linkedPatterns.join(", ")}`
      : `Supports ${i.domain} improvement`,
  }));

  return {
    tier0Alerts: result.actionPlan.tier0Alerts,
    topInterventions,
    parentSummary: result.actionPlan.parentCommunication.summary,
  };
}
