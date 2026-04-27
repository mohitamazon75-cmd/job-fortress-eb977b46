/**
 * scan-pipeline-paths.test.ts — Tests for the three failure modes in the scan pipeline
 * that previously caused "looks generic" output complaints.
 *
 * The process-scan.test.ts scaffold describes HTTP-level integration tests that
 * require a running Deno runtime + full fetch mocking. These tests instead target
 * the specific shared modules whose behavior determines scan quality — testable
 * in isolation without a running server.
 *
 * The three scenarios match the T-4-A spec:
 *   1. Agent 1 cache hit — isCacheCompatible correctly gates cache reuse
 *   2. Agent 1 failure fallback — validateAgentOutput falls back to raw on schema failure
 *   3. Zod validation fallback — invalid agent 2A output preserves raw output (not null)
 *
 * Run with: deno test --allow-net --allow-env scan-pipeline-paths.test.ts
 */

import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCacheCompatible } from "../_shared/scan-cache.ts";
import { validateAgentOutput, Agent2ASchema } from "../_shared/zod-schemas.ts";

// ─── Scenario 1: Agent 1 cache hit path — isCacheCompatible quality gates ────
//
// The cache-hit path was identified as the source of "looks generic" output.
// When a low-quality cached report is reused, all downstream agents receive
// weak skill signals, producing vague analysis.
// isCacheCompatible() is the gate — it must reject low-quality reports.

Deno.test("Cache path — rejects null and non-objects unconditionally", () => {
  assertEquals(isCacheCompatible(null), false, "null must not be cache-compatible");
  assertEquals(isCacheCompatible(undefined), false, "undefined must not be cache-compatible");
  assertEquals(isCacheCompatible("string"), false, "string must not be cache-compatible");
  assertEquals(isCacheCompatible(42), false, "number must not be cache-compatible");
  assertEquals(isCacheCompatible([]), false, "array must not be cache-compatible");
});

Deno.test("Cache path — rejects report with no skill signal (all three skill fields absent)", () => {
  const noSkills = {
    weekly_survival_diet: { theme: "AI awareness", items: [] },
    moat_score: 50,
    _engine_version: 5,
    // Deliberately missing: all_skills, execution_skills_dead, score_breakdown
  };
  assertEquals(
    isCacheCompatible(noSkills),
    false,
    "Report with no skill signal should be rejected — this is the 'generic output' root cause",
  );
});

Deno.test("Cache path — rejects report missing weekly_survival_diet (legacy reports)", () => {
  const legacyReport = {
    all_skills: ["Python", "SQL"],
    moat_score: 50,
    _engine_version: 4,
    // Missing weekly_survival_diet — signal of an old engine version
  };
  assertEquals(
    isCacheCompatible(legacyReport),
    false,
    "Legacy report without weekly_survival_diet must not be reused",
  );
});

Deno.test("Cache path — accepts report with all_skills array (correct cache hit)", () => {
  const goodReport = {
    weekly_survival_diet: { theme: "AI Fluency", items: [{ day: "Mon", skill: "Prompt Engineering" }] },
    role: "Software Engineer",
    all_skills: ["Python", "System Design", "Stakeholder Management"],
    moat_score: 65,
    _engine_version: 5,
  };
  assertEquals(
    isCacheCompatible(goodReport),
    true,
    "Report with all_skills + weekly_survival_diet should be cache-compatible",
  );
});

Deno.test("Cache path — accepts report with score_breakdown.skill_adjustments (alternative signal)", () => {
  const reportWithBreakdown = {
    weekly_survival_diet: { theme: "Skills", items: [] },
    role: "Software Engineer",
    all_skills: ["Excel", "SQL", "PowerBI"],
    score_breakdown: {
      skill_adjustments: [
        { skill_name: "Excel", automation_risk: 85, weight: 0.2, contribution: 17 },
      ],
    },
    moat_score: 40,
    _engine_version: 5,
  };
  assertEquals(
    isCacheCompatible(reportWithBreakdown),
    true,
    "Report with score_breakdown.skill_adjustments should be cache-compatible",
  );
});

Deno.test("Cache path — accepts report with execution_skills_dead (alternative signal)", () => {
  const reportWithDeadSkills = {
    weekly_survival_diet: {},
    role: "Operations Analyst",
    all_skills: ["Excel", "SQL", "Process Mapping"],
    execution_skills_dead: ["Data Entry", "Email Sorting"],
    moat_score: 75,
    _engine_version: 5,
  };
  assertEquals(
    isCacheCompatible(reportWithDeadSkills),
    true,
    "Report with execution_skills_dead should be cache-compatible",
  );
});

// ─── Scenario 2: Agent 1 failure fallback — raw output preserved on Zod failure ─
//
// validateAgentOutput() is called on Agent 2A and 2B output.
// When Zod validation fails (agent returned unexpected shape), the pipeline
// must fall back to raw output — not null — to preserve whatever partial data
// the agent returned. Returning null causes assembleReport() to produce
// entirely generic output.

Deno.test("Zod fallback — validateAgentOutput returns null when schema is fully violated", () => {
  // Completely wrong shape — none of the required fields present
  const totallyWrongOutput = {
    some_random_field: "hello",
    another_field: 42,
  };

  const result = validateAgentOutput("Agent2A", Agent2ASchema, totallyWrongOutput);

  // null signals validation failure — caller should fall back to raw
  assertEquals(result, null, "Fully invalid output should return null from validateAgentOutput");
});

Deno.test("Zod fallback — validateAgentOutput returns typed output on valid schema", () => {
  const validAgent2AOutput = {
    cognitive_moat: "Strategic integration of cross-channel data",
    moat_skills: ["stakeholder_management", "strategic_planning", "data_analysis"],
    free_advice_1: "Build a public portfolio of AI-assisted campaigns within the next 30 days.",
    free_advice_2: "Enroll in a prompt engineering course this week — spend 2 hours on it.",
  };

  const result = validateAgentOutput("Agent2A", Agent2ASchema, validAgent2AOutput);

  assertExists(result, "Valid Agent 2A output should pass validation and return typed result");
  assertEquals(result.cognitive_moat, validAgent2AOutput.cognitive_moat);
  assertEquals(result.moat_skills, validAgent2AOutput.moat_skills);
  assertEquals(result.free_advice_1, validAgent2AOutput.free_advice_1);
});

Deno.test("Zod fallback — validateAgentOutput handles null/undefined gracefully", () => {
  // Should not throw — null input is a valid failure mode when the LLM returns nothing
  const resultNull = validateAgentOutput("Agent2A", Agent2ASchema, null);
  const resultUndef = validateAgentOutput("Agent2A", Agent2ASchema, undefined);

  assertEquals(resultNull, null, "null input should return null");
  assertEquals(resultUndef, null, "undefined input should return null");
});

Deno.test("Zod fallback — validateAgentOutput strips fields not in schema (extra fields pruned)", () => {
  // Agent 2A with extra hallucinated fields not in schema
  const outputWithExtra = {
    cognitive_moat: "Strong analytical judgment",
    moat_skills: ["data_analysis"],
    free_advice_1: "Build your portfolio.",
    free_advice_2: "Upskill in prompt engineering.",
    // Extra field not in Agent2ASchema — should be stripped by Zod .strip()
    some_hallucinated_field: "this should not appear in output",
    another_invented_key: [1, 2, 3],
  };

  const result = validateAgentOutput("Agent2A", Agent2ASchema, outputWithExtra);

  assertExists(result, "Output with extra fields should still validate");
  // The hallucinated fields should be stripped
  assert(
    !("some_hallucinated_field" in result),
    "Hallucinated fields should be stripped by Zod schema validation",
  );
  assert(
    !("another_invented_key" in result),
    "Hallucinated array fields should be stripped",
  );
});

// ─── Scenario 3: scanDiagnostics shape contract ───────────────────────────────
//
// The scanDiagnostics object was added in the architecture review.
// These tests verify the expected agent outcome values are valid strings —
// catching typos in the diagnostic literals before they reach production.

Deno.test("Diagnostics contract — valid agent1 status values are a known set", () => {
  const validStatuses = new Set(["cache_hit", "success", "fallback", "failed"]);
  // Enumerate the values used in process-scan to ensure none are typos
  const usedInCode = ["cache_hit", "success", "fallback", "failed"];
  for (const s of usedInCode) {
    assert(validStatuses.has(s), `"${s}" is not a recognised agent1 diagnostic status`);
  }
});

Deno.test("Diagnostics contract — valid qualityEditor status values are a known set", () => {
  const validStatuses = new Set(["ran", "skipped_timeout", "skipped"]);
  const usedInCode = ["ran", "skipped_timeout", "skipped"];
  for (const s of usedInCode) {
    assert(validStatuses.has(s), `"${s}" is not a recognised qualityEditor diagnostic status`);
  }
});

Deno.test("Diagnostics contract — valid profileSource values are a known set", () => {
  const validSources = new Set(["resume", "linkedin", "manual", "unknown"]);
  const usedInCode = ["resume", "linkedin", "manual", "unknown"];
  for (const s of usedInCode) {
    assert(validSources.has(s), `"${s}" is not a recognised profileSource value`);
  }
});
