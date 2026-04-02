import { describe, it, expect } from "vitest";
import { getAgeGroup, isValidAge, scoreColor } from "@/lib/intelligence";
import type { IntelligenceReport, RedFlag } from "@/lib/intelligence";

describe("V3 Intelligence Engine — Client Interface", () => {
  it("getAgeGroup clamps out-of-range ages", () => {
    expect(getAgeGroup(3)).toBe("4-6");
    expect(getAgeGroup(8)).toBe("7-9");
    expect(getAgeGroup(20)).toBe("16-18");
  });

  it("isValidAge validates supported range", () => {
    expect(isValidAge(4)).toBe(true);
    expect(isValidAge(18)).toBe(true);
    expect(isValidAge(3)).toBe(false);
    expect(isValidAge(19)).toBe(false);
  });

  it("scoreColor returns correct severity", () => {
    expect(scoreColor(75)).toBe("success");
    expect(scoreColor(50)).toBe("warning");
    expect(scoreColor(20)).toBe("destructive");
  });

  it("IntelligenceReport interface includes safety fields", () => {
    // Type-level check: ensure redFlags and missingDataFields exist on the interface
    const partial: Pick<IntelligenceReport, "redFlags" | "missingDataFields" | "engineVersion"> = {
      redFlags: [] as RedFlag[],
      missingDataFields: [],
      engineVersion: "V3.1",
    };
    expect(partial.redFlags).toHaveLength(0);
    expect(partial.missingDataFields).toHaveLength(0);
    expect(partial.engineVersion).toContain("V3");
  });
});
