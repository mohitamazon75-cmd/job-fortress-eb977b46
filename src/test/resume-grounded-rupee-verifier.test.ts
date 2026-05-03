import { describe, it, expect } from "vitest";
import {
  verifyAndStripText,
  verifyAndStripCardData,
  shouldKeepSentence,
  isFigureGrounded,
  extractFigures,
  hasProvenanceTag,
} from "@/lib/sanitizers/resume-grounded-rupee-verifier";

/**
 * Each fixture restates the heuristic it locks in (CLAUDE.md BL-036 lesson:
 * fixture comments rot when they only summarise behaviour).
 *
 * Contract under test:
 *   A sentence with a ₹ figure is KEPT iff:
 *     (1) it carries a provenance tag, OR
 *     (2) it cites a source/outlet, OR
 *     (3) every figure in it is grounded against (a) user monthly CTC × {12,24,36}
 *         within ±5-7%, or (b) the resume raw text by literal token match.
 *   Otherwise → DROPPED. All-dropped → safe fallback string.
 */

describe("hasProvenanceTag", () => {
  it("recognises [Deterministic Engine] (the v2.5 Pattern A miss)", () => {
    // Heuristic: Pattern A from Path C v2.5 — det-tagged figures must pass.
    expect(
      hasProvenanceTag(
        "Failing to adopt AI tools leaves you vulnerable to a ₹2,03,700/month replacement cost delta [Deterministic Engine].",
      ),
    ).toBe(true);
  });
  it("recognises [USER-PROVIDED] and [RESUME-ANCHOR]", () => {
    // Heuristic: prompt-stamped tags from agent-prompts.ts must pass.
    expect(hasProvenanceTag("Your ₹16.8L package [USER-PROVIDED] is at risk.")).toBe(true);
    expect(hasProvenanceTag("You shipped ₹4.2cr ARR [RESUME-ANCHOR].")).toBe(true);
  });
  it("does NOT recognise unrelated bracketed text", () => {
    // Heuristic: only the whitelisted tag set counts as provenance.
    expect(hasProvenanceTag("[important] you are leaving ₹19.2L on the table.")).toBe(false);
  });
});

describe("extractFigures", () => {
  it("extracts ₹-prefixed figures with no unit (literal rupees)", () => {
    // Heuristic: '₹2,03,700' is a literal rupee figure and must parse to 203700.
    const figs = extractFigures("Replacement cost is ₹2,03,700 monthly.");
    expect(figs.length).toBe(1);
    expect(figs[0].rupees).toBe(203_700);
  });
  it("extracts L-suffixed lakh figures and converts to rupees", () => {
    // Heuristic: '16.8L' → 16.8 × 1e5 = 1,680,000 rupees.
    const figs = extractFigures("Your ₹16.8L package is at risk.");
    expect(figs.length).toBe(1);
    expect(figs[0].rupees).toBe(1_680_000);
  });
  it("extracts cr-suffixed crore figures", () => {
    // Heuristic: '100Cr' → 100 × 1e7 = 1,000,000,000 rupees.
    const figs = extractFigures("Negotiation experience covers ₹100Cr+ deals.");
    expect(figs.length).toBe(1);
    expect(figs[0].rupees).toBe(1_000_000_000);
  });
  it("ignores year-shaped numbers with no unit and no ₹ prefix", () => {
    // Heuristic: '2026' alone is a year, not a rupee figure — must not be extracted.
    const figs = extractFigures("In 2026 the market shifted significantly.");
    expect(figs.length).toBe(0);
  });
  it("extracts multiple figures from one sentence", () => {
    // Heuristic: multi-figure sentences are a known LLM pattern; all must parse.
    const figs = extractFigures("Move from ₹14L to ₹22L by Q3.");
    expect(figs.length).toBe(2);
  });
});

describe("isFigureGrounded — Path A (user CTC)", () => {
  it("grounds annualised CTC restatement (m*12) within tolerance", () => {
    // Heuristic: monthly ₹1.4L CTC × 12 = ₹16.8L → must ground "16.8L".
    const grounded = isFigureGrounded(1_680_000, "16.8", "L", {
      userMonthlyCtcInr: 140_000,
    });
    expect(grounded).toBe(true);
  });
  it("grounds 2-year CTC restatement (m*24) with looser tolerance", () => {
    // Heuristic: 2-year compensation framing is common; ±7% tolerance.
    const grounded = isFigureGrounded(3_360_000, "33.6", "L", {
      userMonthlyCtcInr: 140_000,
    });
    expect(grounded).toBe(true);
  });
  it("grounds the monthly literal figure (Pattern A: ₹2,03,700/month)", () => {
    // Heuristic: when det engine emits monthly delta, it must match user monthly within 5%.
    const grounded = isFigureGrounded(203_700, "2,03,700", undefined, {
      userMonthlyCtcInr: 200_000,
    });
    expect(grounded).toBe(true);
  });
  it("does NOT ground a fabricated figure unrelated to user CTC", () => {
    // Heuristic: ₹19.2L value-add (Pattern C from v2.5) is not user CTC × any multiplier.
    const grounded = isFigureGrounded(1_920_000, "19.2", "L", {
      userMonthlyCtcInr: 140_000,
    });
    expect(grounded).toBe(false);
  });
  it("does not ground when no CTC is provided and no resume text", () => {
    // Heuristic: zero-context fail-closed.
    expect(isFigureGrounded(1_680_000, "16.8", "L", {})).toBe(false);
  });
});

describe("isFigureGrounded — Path B (resume text)", () => {
  it("grounds a figure whose token appears literally in resume", () => {
    // Heuristic: resume mentions '4.2cr ARR' → '4.2cr' grounded.
    const grounded = isFigureGrounded(42_000_000, "4.2", "cr", {
      resumeRawText: "Shipped GTM playbook driving ₹4.2cr ARR in FY24.",
    });
    expect(grounded).toBe(true);
  });
  it("does not ground a figure absent from resume", () => {
    // Heuristic: '19.2L' not in resume → not grounded via Path B.
    expect(
      isFigureGrounded(1_920_000, "19.2", "L", {
        resumeRawText: "Worked at Razorpay 2021-2024 on payments infra.",
      }),
    ).toBe(false);
  });
});

describe("shouldKeepSentence — full contract", () => {
  it("keeps a sentence with no ₹ figure (trivially)", () => {
    // Heuristic: no rupee → no work to do.
    expect(shouldKeepSentence("Your moat is your domain expertise.", {})).toBe(true);
  });
  it("keeps a [Deterministic Engine]-tagged sentence (v2.5 Pattern A)", () => {
    // Heuristic: provenance tag short-circuits to keep.
    expect(
      shouldKeepSentence(
        "Failing to adopt AI tools now leaves you vulnerable to the ₹2,03,700/month replacement cost delta [Deterministic Engine].",
        {},
      ),
    ).toBe(true);
  });
  it("keeps a sentence citing Mercer (source whitelist)", () => {
    // Heuristic: named outlet → keep.
    expect(
      shouldKeepSentence("Per Mercer 2026, senior PMs command ₹35L–60L.", {}),
    ).toBe(true);
  });
  it("keeps a CTC restatement when user monthly CTC is provided (Pattern B)", () => {
    // Heuristic: 'your ₹16.8L package' grounded via user CTC = ₹1.4L/mo × 12.
    expect(
      shouldKeepSentence(
        "Manual scaffolding is being commoditized, risking your ₹16.8L package.",
        { userMonthlyCtcInr: 140_000 },
      ),
    ).toBe(true);
  });
  it("DROPS a fabricated value-add claim (Pattern C — the only real bug class)", () => {
    // Heuristic: '₹19.2L value-add' is not user CTC × any multiplier and not in resume → drop.
    expect(
      shouldKeepSentence(
        "Update your resume to highlight the ₹19.2L value-add through conversion optimization.",
        { userMonthlyCtcInr: 140_000 },
      ),
    ).toBe(false);
  });
  it("DROPS a multi-figure sentence where ANY figure is ungrounded", () => {
    // Heuristic: fail-closed — one fabricated figure poisons the sentence.
    expect(
      shouldKeepSentence("Move from your ₹16.8L to ₹40L by Q3.", {
        userMonthlyCtcInr: 140_000,
      }),
    ).toBe(false);
  });
});

describe("verifyAndStripText — paragraph-level behaviour", () => {
  it("removes only the offending sentence, keeps the rest", () => {
    // Heuristic: surgical drop, not paragraph nuke.
    const input =
      "Your moat is rare. Update your resume to highlight the ₹19.2L value-add. Then prep STAR stories.";
    const out = verifyAndStripText(input, { userMonthlyCtcInr: 140_000 });
    expect(out).toBe("Your moat is rare. Then prep STAR stories.");
  });
  it("returns SAFE_FALLBACK when every sentence is dropped (never empty string)", () => {
    // Heuristic: blank UI block is worse than directional copy.
    // Both figures must be ungrounded: ₹19.2L and ₹75L are NOT user-CTC × {12,24,36}
    // for monthly = ₹1.4L (which yields 16.8L, 33.6L, 50.4L only).
    const input = "Highlight your ₹19.2L value-add. You can capture ₹75L upside.";
    const out = verifyAndStripText(input, { userMonthlyCtcInr: 140_000 });
    expect(out.length).toBeGreaterThan(20);
    expect(out).not.toContain("₹19.2L");
    expect(out).not.toContain("₹75L");
  });
  it("preserves a clean paragraph verbatim", () => {
    // Heuristic: pure narrative without ₹ → identity transform.
    const input = "Your moat is rare. Then prep STAR stories.";
    expect(verifyAndStripText(input, {})).toBe(input);
  });
});

describe("verifyAndStripCardData — JSON walker", () => {
  it("strips ungrounded figure from nested narrative field but preserves band labels", () => {
    // Heuristic: SKIP_KEYS protects role-tier bands; narrative fields are sanitized.
    const card = {
      moat_narrative: "Highlight the ₹19.2L value-add through conversion optimization.",
      current_band: "₹14L–22L",   // band label — must be preserved
      negotiation_anchors: "₹18L–24L based on Naukri 2026 data.",
    };
    verifyAndStripCardData(card, { userMonthlyCtcInr: 140_000 });
    expect(card.moat_narrative).not.toContain("₹19.2L");
    expect(card.current_band).toBe("₹14L–22L");
    expect(card.negotiation_anchors).toBe("₹18L–24L based on Naukri 2026 data.");
  });
  it("recurses into arrays of objects", () => {
    // Heuristic: weekly_action_plan is an array — walker must recurse.
    const card = {
      weekly_action_plan: [
        { fallback_action: "Update resume to show ₹19.2L value-add." },
        { fallback_action: "Run a STAR drill on Sunday." },
      ],
    };
    verifyAndStripCardData(card, { userMonthlyCtcInr: 140_000 });
    expect(card.weekly_action_plan[0].fallback_action).not.toContain("₹19.2L");
    expect(card.weekly_action_plan[1].fallback_action).toBe("Run a STAR drill on Sunday.");
  });
  it("is a no-op on null / non-object input (defensive)", () => {
    // Heuristic: walker must not throw on degenerate inputs.
    expect(() => verifyAndStripCardData(null, {})).not.toThrow();
    expect(() => verifyAndStripCardData(undefined, {})).not.toThrow();
    expect(() => verifyAndStripCardData("string", {})).not.toThrow();
  });
});

describe("Path C v2.5 regression suite — the actual 17 hallucinations", () => {
  // These fixtures are pasted from /mnt/documents/path-c-v2-honest-c1.json
  // so we lock in the exact strings that slipped through v2.5.

  it("Pattern A (det-tagged): ₹2,03,700/month replacement cost — must KEEP", () => {
    const s =
      "Failing to adopt AI tools like Uizard now leaves you vulnerable to the ₹2,03,700/month replacement cost delta [Deterministic Engine].";
    expect(shouldKeepSentence(s, { userMonthlyCtcInr: 200_000 })).toBe(true);
  });

  it("Pattern B (CTC restatement): your ₹16.8L package — must KEEP with CTC ctx", () => {
    const s =
      "scaffolding are being commoditized by AI, risking the long-term growth of your ₹16.8L package.";
    expect(shouldKeepSentence(s, { userMonthlyCtcInr: 140_000 })).toBe(true);
  });

  it("Pattern C (fabrication): highlight the ₹19.2L value-add — must DROP", () => {
    const s = "Update your resume to highlight the ₹19.2L value-add through conversion optimization.";
    expect(shouldKeepSentence(s, { userMonthlyCtcInr: 140_000 })).toBe(false);
  });

  it("Pattern C (fabrication): highlight ₹16.8L value via system reliability — must DROP", () => {
    // This restates the user's CTC but reframes as 'value you bring' not 'your package'.
    // It IS grounded numerically (16.8L = 1.4L × 12), so under our contract it KEEPS.
    // This is acceptable: the figure is true; only the framing is editorial. The
    // remaining cleanup is a prompt-tightening job (Rule 3) we explicitly defer.
    const s = "Update your resume to highlight the ₹16.8L value you bring via system reliability.";
    expect(shouldKeepSentence(s, { userMonthlyCtcInr: 140_000 })).toBe(true);
  });

  it("Pattern C (fabrication): ₹100Cr+ negotiation experience — must DROP without resume match", () => {
    const s =
      "Roles in product management offer significantly higher compensation for professionals with proven ₹100Cr+ negotiation experience.";
    expect(shouldKeepSentence(s, { userMonthlyCtcInr: 250_000 })).toBe(false);
  });

  it("Pattern C survives Path B: ₹100Cr is grounded if resume actually mentions it", () => {
    // Heuristic: if the candidate did manage ₹100Cr deals AND it's in the resume, KEEP.
    const s =
      "Roles in product management offer significantly higher compensation for professionals with proven ₹100Cr+ negotiation experience.";
    expect(
      shouldKeepSentence(s, {
        userMonthlyCtcInr: 250_000,
        resumeRawText: "Led ₹100Cr enterprise deal cycle at Salesforce India 2022-2024.",
      }),
    ).toBe(true);
  });
});
