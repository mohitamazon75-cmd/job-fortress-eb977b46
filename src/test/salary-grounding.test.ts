// Locks in C2 root-fix: salary grounding rule injected into every agent that
// emits ₹ figures, replacing the previous "₹ amounts beat percentages" prompt
// line that was caught fabricating ₹3L/₹5L/₹10L anchors across Card 1, Pivot,
// Blind Spots, Leverage Scripts, and Evidence (audit 2026-04-29).
//
// Calibration this fixture is checking against (do not summarize — restate per
// the BL-036 fixture-comment rule):
//   1. SALARY_GROUNDING_RULE constant exists and exports the [USER-PROVIDED] vs
//      [ESTIMATED — DO NOT QUOTE] tag contract verbatim, since scan-agents.ts
//      emits exactly those tag strings on the Monthly Salary line.
//   2. The rule is injected into AGENT_2A_RISK_ANALYSIS, AGENT_2B_ACTION_PLAN,
//      AGENT_2C_PIVOT_MAPPING, and JUDO_STRATEGY_SYSTEM_PROMPT — the four
//      surfaces that produce salary_anchor_line, recruiter_dm, blindspots,
//      free_advice, and stay_or_jump_frame.
//   3. The previous toxic narration line "₹ amounts and months beat
//      percentages" no longer appears verbatim in Agent 2A — it must now
//      condition ₹ usage on provenance.
import { describe, it, expect } from "vitest";
import {
  SALARY_GROUNDING_RULE,
  AGENT_2A_RISK_ANALYSIS,
  AGENT_2B_ACTION_PLAN,
  AGENT_2C_PIVOT_MAPPING,
  JUDO_STRATEGY_SYSTEM_PROMPT,
} from "../../supabase/functions/_shared/agent-prompts.ts";

describe("SALARY_GROUNDING_RULE — root-fix for ₹ hallucinations", () => {
  it("declares the [USER-PROVIDED] vs [ESTIMATED — DO NOT QUOTE] provenance contract", () => {
    expect(SALARY_GROUNDING_RULE).toContain("[USER-PROVIDED]");
    expect(SALARY_GROUNDING_RULE).toContain("[ESTIMATED — DO NOT QUOTE]");
  });

  it("explicitly forbids fabricated ₹ figures when salary is estimated", () => {
    expect(SALARY_GROUNDING_RULE).toMatch(/MUST NOT cite any absolute ₹ figure/);
  });

  it("provides concrete GOOD/BAD exemplars so the LLM has an output template", () => {
    expect(SALARY_GROUNDING_RULE).toMatch(/GOOD:/);
    expect(SALARY_GROUNDING_RULE).toMatch(/BAD:/);
    // Specific banned phrases pulled directly from the audit (B33, B38)
    expect(SALARY_GROUNDING_RULE).toContain("₹3L gap");
    expect(SALARY_GROUNDING_RULE).toContain("adds ₹10L to your value");
  });

  it("calls out every downstream field by name so the LLM can't claim 'this rule didn't apply to my output'", () => {
    // These 5 field names map 1:1 to the surfaces flagged in the audit
    expect(SALARY_GROUNDING_RULE).toContain("salary_anchor_line");
    expect(SALARY_GROUNDING_RULE).toContain("recruiter_dm");
    expect(SALARY_GROUNDING_RULE).toContain("stay_or_jump_frame");
    expect(SALARY_GROUNDING_RULE).toContain("blindspots");
    expect(SALARY_GROUNDING_RULE).toContain("evidence cards");
  });

  it("permits months/years/percentages — those were never the hallucination source", () => {
    expect(SALARY_GROUNDING_RULE).toMatch(/Months\/years and percentages do NOT need this guard/);
  });
});

describe("Rule injection — every ₹-emitting agent must include SALARY_GROUNDING_RULE", () => {
  it("Agent 2A (Risk Analysis) includes the grounding rule", () => {
    expect(AGENT_2A_RISK_ANALYSIS).toContain(SALARY_GROUNDING_RULE);
  });

  it("Agent 2B (Action Plan) includes the grounding rule", () => {
    expect(AGENT_2B_ACTION_PLAN).toContain(SALARY_GROUNDING_RULE);
  });

  it("Agent 2C (Pivot Mapping) includes the grounding rule", () => {
    expect(AGENT_2C_PIVOT_MAPPING).toContain(SALARY_GROUNDING_RULE);
  });

  it("Judo Strategy system prompt includes the grounding rule", () => {
    expect(JUDO_STRATEGY_SYSTEM_PROMPT).toContain(SALARY_GROUNDING_RULE);
  });
});

describe("Toxic prior-art removed — Agent 2A no longer instructs ₹ fabrication", () => {
  it("the old 'Stakes over abstractions. ₹ amounts and months beat percentages.' line is gone verbatim", () => {
    // This exact line was the prompt-level root cause: it told the LLM to
    // prefer ₹ figures over qualitative language regardless of whether a
    // ₹ value was even known. New line conditions on the [USER-PROVIDED] tag.
    expect(AGENT_2A_RISK_ANALYSIS).not.toMatch(
      /Stakes over abstractions\. ₹ amounts and months beat percentages\./,
    );
  });

  it("the new line conditions ₹ usage on the [USER-PROVIDED] tag", () => {
    expect(AGENT_2A_RISK_ANALYSIS).toMatch(
      /Absolute ₹ figures are allowed ONLY when the salary line is tagged \[USER-PROVIDED\]/,
    );
  });
});
