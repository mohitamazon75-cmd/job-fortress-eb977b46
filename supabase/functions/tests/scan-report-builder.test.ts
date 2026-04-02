import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeFounderImmediateStep,
  validateToolStatic,
  deduplicateReportText,
} from "../_shared/scan-report-builder.ts";

// ── normalizeFounderImmediateStep ─────────────────────────────

Deno.test("Founder normalization — skips non-founder roles", () => {
  const report = { role: "Software Engineer", immediate_next_step: { action: "Schedule 1-on-1 with CEO" } };
  const result = normalizeFounderImmediateStep(report);
  assertEquals(result.immediate_next_step.action, "Schedule 1-on-1 with CEO");
});

Deno.test("Founder normalization — rewrites mismatch for Co-Founder", () => {
  const report = {
    role: "Co-Founder",
    linkedin_company: "Acme Inc",
    immediate_next_step: {
      action: "Schedule a 1-on-1 meeting with CEO to align on strategic priorities for AI integration",
      rationale: "Align with leadership on AI strategy",
      time_required: "1 hour",
      deliverable: "Meeting notes",
    },
  };
  const result = normalizeFounderImmediateStep(report);
  assertEquals(result.immediate_next_step.action.includes("Acme Inc"), true);
  assertEquals(result.immediate_next_step.action.includes("AI Transformation Blueprint"), true);
});

Deno.test("Founder normalization — handles null report", () => {
  assertEquals(normalizeFounderImmediateStep(null), null);
  assertEquals(normalizeFounderImmediateStep(undefined), undefined);
});

Deno.test("Founder normalization — handles founder with no mismatch", () => {
  const report = {
    role: "Founder",
    immediate_next_step: {
      action: "Review AI tools for content creation",
      rationale: "Improve efficiency",
    },
  };
  const result = normalizeFounderImmediateStep(report);
  assertEquals(result.immediate_next_step.action, "Review AI tools for content creation");
});

Deno.test("Founder normalization — detects Managing Partner", () => {
  const report = {
    role: "Managing Partner",
    linkedin_company: "Law Corp",
    immediate_next_step: {
      action: "Schedule 1-on-1 meeting with founder to discuss",
      rationale: "normal rationale",
    },
  };
  const result = normalizeFounderImmediateStep(report);
  assertEquals(result.immediate_next_step.action.includes("Law Corp"), true);
});

// ── validateToolStatic ────────────────────────────────────────

Deno.test("Tool validation — null/undefined input does nothing", () => {
  validateToolStatic(null);
  validateToolStatic(undefined);
  validateToolStatic({});
  // No throw
});

Deno.test("Tool validation — marks unknown tool as not_in_registry", () => {
  const strategy: Record<string, unknown> = { recommended_tool: "SomeObscureTool12345" };
  validateToolStatic(strategy);
  assertExists(strategy.github_validation);
  assertEquals(strategy.github_validation, {
    verified: false,
    reason: "not_in_registry",
  });
});

// ── deduplicateReportText ─────────────────────────────────────

Deno.test("Dedup — removes duplicate sentences across fields", () => {
  const report = {
    free_advice_1: "Start automating your tasks with AI tools today. Build a strong portfolio of work.",
    free_advice_2: "Start automating your tasks with AI tools today. Focus on leadership skills.",
  };
  deduplicateReportText(report);
  // The duplicate sentence should be removed from free_advice_2
  assertEquals(report.free_advice_2.includes("Start automating your tasks"), false);
  assertEquals(report.free_advice_2.includes("Focus on leadership skills"), true);
});

Deno.test("Dedup — handles empty/missing fields gracefully", () => {
  const report = { free_advice_1: "", free_advice_2: null, dead_end_narrative: undefined };
  deduplicateReportText(report);
  // Should not throw
  assertEquals(report.free_advice_1, "");
});

Deno.test("Dedup — leaves unique content untouched", () => {
  const report = {
    free_advice_1: "Unique advice about Python automation for data pipelines.",
    free_advice_2: "Different advice about leadership development programs.",
    free_advice_3: "Third piece about networking in the AI community events.",
  };
  const original1 = report.free_advice_1;
  const original2 = report.free_advice_2;
  const original3 = report.free_advice_3;
  deduplicateReportText(report);
  assertEquals(report.free_advice_1, original1);
  assertEquals(report.free_advice_2, original2);
  assertEquals(report.free_advice_3, original3);
});

Deno.test("Dedup — short sentences (<=20 chars) are kept regardless", () => {
  const report = {
    free_advice_1: "Act now. This is important.",
    free_advice_2: "Act now. Do something else entirely different here.",
  };
  deduplicateReportText(report);
  // "Act now" is <=20 chars, should be kept in both
  assertEquals(report.free_advice_1.includes("Act now"), true);
  assertEquals(report.free_advice_2.includes("Act now"), true);
});
