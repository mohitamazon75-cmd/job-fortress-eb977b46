import { describe, expect, it } from "vitest";
import { ACADEMIC_EXPOSURE_META, academicRiskTier, getAcademicOccupationExposure } from "@/lib/det-occupation-exposure";

describe("getAcademicOccupationExposure — Atlas academic exposure lookup", () => {
  it("maps exact KG family backend_developer after title repair", () => {
    // Locks the Phase 2 bugfix: Atlas title is "Software developers, quality assurance analysts, and testers",
    // not the stale "Software developers" title that left core tech roles unmapped.
    const out = getAcademicOccupationExposure("backend_developer");
    expect(out.kind).toBe("mapped");
    if (out.kind !== "mapped") return;
    expect(out.job_family).toBe("backend_developer");
    expect(out.occupations[0].atlas_title).toBe("Software developers, quality assurance analysts, and testers");
    expect(out.risk_tier).toBe("HIGH");
  });

  it("normalizes human-ish family strings without fuzzy role guessing", () => {
    // Locks deterministic normalization only: spaces/case become snake_case;
    // no LLM or fuzzy occupation search is allowed inside this lookup.
    const out = getAcademicOccupationExposure("Digital Marketer");
    expect(out.kind).toBe("mapped");
    if (out.kind !== "mapped") return;
    expect(out.job_family).toBe("digital_marketer");
    expect(out.occupations[0].atlas_title).toBe("Market research analysts");
  });

  it("shows honest empty state for unmapped data_entry_operator", () => {
    // Atlas has no exact Data Entry Keyers row. We intentionally do not map to a weak proxy.
    const out = getAcademicOccupationExposure("data_entry_operator");
    expect(out).toEqual({
      kind: "unmapped",
      job_family: "data_entry_operator",
      message: "Academic exposure data not yet mapped for this role",
    });
  });

  it("keeps risk tier enum thresholds deterministic", () => {
    // Product rule: risk levels are HIGH/MEDIUM/LOW enums, not displayed percentages.
    expect(academicRiskTier(0.66)).toBe("HIGH");
    expect(academicRiskTier(0.4)).toBe("MEDIUM");
    expect(academicRiskTier(0.399)).toBe("LOW");
  });

  it("keeps KG coverage above the Phase 2 launch gate", () => {
    // Implementation gate from approved plan: ≥80% mapped before UI wiring.
    expect(ACADEMIC_EXPOSURE_META.coverage_pct).toBeGreaterThanOrEqual(80);
    expect(ACADEMIC_EXPOSURE_META.unmapped_count).toBe(1);
  });
});
