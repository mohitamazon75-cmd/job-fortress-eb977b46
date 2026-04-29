import { describe, it, expect } from "vitest";
import {
  stripFabricatedRupeeFigures,
  hasSourceCitation,
} from "@/lib/sanitizers/strip-fabricated-rupee-figures";

/**
 * Each fixture below restates the heuristic it locks in (BL-036 lesson:
 * test fixtures rot silently when comments only summarise behaviour).
 *
 * The sanitizer's contract:
 *  1. A sentence containing a ₹/L/lakh/cr figure is DROPPED unless the same
 *     sentence also names a recognisable source (publication, consultancy,
 *     or generic "report"/"study"/"per X" marker).
 *  2. Sentences without rupee figures are always kept verbatim.
 *  3. If every sentence is dropped, return a safe directional fallback —
 *     never return empty string (which would render as a blank UI block).
 */

describe("stripFabricatedRupeeFigures", () => {
  it("drops the canonical fabrication: '₹8L–12L on the table as RevOps Architect'", () => {
    // Heuristic: rupee figure present + no source → drop.
    const input =
      "Demand Generation talent in India is in flux. You're leaving ₹8L–12L on the table as RevOps Architect.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toBe("Demand Generation talent in India is in flux.");
  });

  it("keeps a rupee figure when source is cited inline (per Mercer)", () => {
    // Heuristic: rupee figure + 'per <Outlet>' → keep.
    const input =
      "Per Mercer 2026 India Compensation Report, senior Demand Gen leaders command ₹35–60L.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toContain("₹35");
    expect(out).toContain("Mercer");
  });

  it("keeps rupee figure when source is named outlet (Naukri)", () => {
    // Heuristic: named-outlet whitelist → keep.
    const input = "Naukri data shows ₹22L is the median for this title.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toContain("₹22L");
  });

  it("drops 'Head of Demand Gen roles paying ₹35-60L' when no source", () => {
    // Heuristic: rupee figure + no whitelisted source → drop.
    const input = "Head of Demand Gen roles paying ₹35-60L are rising 28%.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).not.toContain("₹35-60L");
  });

  it("keeps sentences without any rupee figure verbatim", () => {
    // Heuristic: no rupee figure → always pass through.
    const input =
      "Demand for AI-fluent marketers is rising fast. Hiring sentiment is mixed.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toBe(input);
  });

  it("returns directional fallback when every sentence is dropped", () => {
    // Heuristic: every sentence is fabrication → return safe fallback,
    // never empty string (UI would render a blank block).
    const input = "You're leaving ₹8L on the table. ₹12L premium for AI skills.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toContain("Negotiation Anchors");
    expect(out.length).toBeGreaterThan(20);
  });

  it("handles undefined and empty string defensively", () => {
    expect(stripFabricatedRupeeFigures(undefined)).toBe("");
    expect(stripFabricatedRupeeFigures("")).toBe("");
  });

  it("treats lakh-word forms and crore-word forms as rupee figures", () => {
    // Heuristic: '8 lakh' / '1 crore' must be caught even without ₹ symbol.
    expect(stripFabricatedRupeeFigures("You'll earn 8 lakhs more next year.")).toContain(
      "Negotiation Anchors",
    );
    expect(stripFabricatedRupeeFigures("Total comp hits 1 crore for VPs.")).toContain(
      "Negotiation Anchors",
    );
  });

  it("does NOT strip non-rupee numbers (28%, 5 years)", () => {
    // Heuristic: only rupee/lakh/crore figures are guarded, not all numbers.
    const input = "Hiring is up 28%. Most senior roles need 10+ years experience.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toBe(input);
  });

  it("preserves multi-sentence body when only one sentence is fabricated", () => {
    // Heuristic: surgical removal — keep the good, drop only the bad.
    const input =
      "Demand Gen hiring is expanding in India. You're leaving ₹8L–12L on the table. Action: update LinkedIn with revenue numbers this week.";
    const out = stripFabricatedRupeeFigures(input);
    expect(out).toContain("Demand Gen hiring is expanding");
    expect(out).toContain("update LinkedIn");
    expect(out).not.toContain("₹8L–12L");
  });
});

describe("hasSourceCitation", () => {
  it("recognises 'per X' source marker", () => {
    expect(hasSourceCitation("Per Mercer 2026, salaries rose")).toBe(true);
  });
  it("recognises named outlets case-insensitively", () => {
    expect(hasSourceCitation("LinkedIn data shows...")).toBe(true);
    expect(hasSourceCitation("naukri.com lists...")).toBe(true);
  });
  it("returns false for unsourced claims", () => {
    expect(hasSourceCitation("You're leaving money on the table")).toBe(false);
  });
});
