import { describe, it, expect } from "vitest";
import {
  formatAnnualLakhs,
  parsePctRange,
  parseBandToAnnualInr,
  deriveMonthlyFromBands,
} from "@/components/model-b/Card1RiskMirror";

/**
 * Unit tests for the rupee-anchoring helpers used by Card 1 (Risk Mirror).
 *
 * Why these matter: these are the only reason the user sees "₹1.8L–2.4L/year"
 * instead of the abstract "15-20%" that Indian users (per qualitative feedback)
 * read as "AI slop". Money math without tests = a future audit finding waiting
 * to happen — see docs/DEFINITION_OF_DONE.md Gate 2.
 */

describe("formatAnnualLakhs", () => {
  it("formats sub-lakh monthly into ₹k/year", () => {
    // 5,000 INR/month × 12 = 60,000 → "₹60k"
    expect(formatAnnualLakhs(5_000)).toBe("₹60k");
  });

  it("formats single-digit lakhs with one decimal", () => {
    // 50,000/month × 12 = 6,00,000 → 6.0L
    expect(formatAnnualLakhs(50_000)).toBe("₹6.0L");
  });

  it("formats double-digit lakhs as rounded integers", () => {
    // 1,00,000/month × 12 = 12,00,000 → ₹12L
    expect(formatAnnualLakhs(100_000)).toBe("₹12L");
  });

  it("formats crore-range income correctly", () => {
    // 10,00,000/month × 12 = 1.2 Cr
    expect(formatAnnualLakhs(1_000_000)).toBe("₹1.2Cr");
  });

  it("handles the lakh boundary correctly (just under 10L)", () => {
    // 75,000 × 12 = 9L exactly → 9.0L (one decimal)
    expect(formatAnnualLakhs(75_000)).toBe("₹9.0L");
  });

  it("handles zero gracefully without throwing", () => {
    expect(formatAnnualLakhs(0)).toBe("₹0k");
  });
});

describe("parsePctRange", () => {
  it("parses a hyphenated percentage range", () => {
    expect(parsePctRange("15-20%")).toEqual([0.15, 0.20]);
  });

  it("parses an en-dash percentage range (LLM commonly emits this)", () => {
    expect(parsePctRange("15–20%")).toEqual([0.15, 0.20]);
  });

  it("parses 'X to Y%' phrasing", () => {
    expect(parsePctRange("15 to 20%")).toEqual([0.15, 0.20]);
  });

  it("parses a single percentage as a degenerate range", () => {
    expect(parsePctRange("18%")).toEqual([0.18, 0.18]);
  });

  it("parses decimal percentages", () => {
    expect(parsePctRange("7.5-12.5%")).toEqual([0.075, 0.125]);
  });

  it("returns null for null/undefined/empty", () => {
    expect(parsePctRange(null)).toBeNull();
    expect(parsePctRange(undefined)).toBeNull();
    expect(parsePctRange("")).toBeNull();
  });

  it("returns null for unparseable strings (no %)", () => {
    expect(parsePctRange("about 15 to 20")).toBeNull();
    expect(parsePctRange("significant")).toBeNull();
  });

  it("integration: range × salary produces the expected ₹/year string", () => {
    // 80,000/month salary, 15-20% gap → ₹1.4L–1.9L/year
    const range = parsePctRange("15-20%");
    expect(range).not.toBeNull();
    if (!range) return;
    const monthlySalary = 80_000;
    const annualSalary = monthlySalary * 12; // 9,60,000
    const lo = formatAnnualLakhs((annualSalary * range[0]) / 12); // 12,000/mo → 1,44,000/yr
    const hi = formatAnnualLakhs((annualSalary * range[1]) / 12); // 16,000/mo → 1,92,000/yr
    expect(lo).toBe("₹1.4L");
    expect(hi).toBe("₹1.9L");
  });
});

describe("parseBandToAnnualInr", () => {
  it("parses lakh range like '₹18-28L' to median annual rupees", () => {
    expect(parseBandToAnnualInr("₹18-28L")).toBe(2_300_000);
  });

  it("parses single lakh figure like '₹35L'", () => {
    expect(parseBandToAnnualInr("₹35L")).toBe(3_500_000);
  });

  it("parses crore range like '₹1.2-1.8Cr'", () => {
    expect(parseBandToAnnualInr("₹1.2-1.8Cr")).toBe(15_000_000);
  });

  it("parses 'LPA' suffix variants", () => {
    expect(parseBandToAnnualInr("18-28 LPA")).toBe(2_300_000);
  });

  it("returns null for unparseable / empty / non-INR strings", () => {
    expect(parseBandToAnnualInr(undefined)).toBeNull();
    expect(parseBandToAnnualInr("")).toBeNull();
    expect(parseBandToAnnualInr("$120k")).toBeNull();
    expect(parseBandToAnnualInr("competitive")).toBeNull();
  });
});

describe("deriveMonthlyFromBands", () => {
  const bands = [
    { role: "VP Marketing", range: "₹35-60L" },
    { role: "Head Demand Generation", range: "₹22-35L" },
    { role: "Marketing Manager", range: "₹12-22L" },
  ];

  it("matches the user's current_title against band roles (substring, case-insensitive)", () => {
    // ₹12-22L → median 17L = 17,00,000/yr → 17,00,000/12 = 141,666.66… → rounded 141,667
    expect(deriveMonthlyFromBands(bands, "Marketing Manager")).toBe(141_667);
    expect(deriveMonthlyFromBands(bands, "marketing manager")).toBe(141_667);
  });

  it("falls back to the middle band when no role match", () => {
    // middle index = 1 → ₹22-35L → 28.5L → 28,50,000/12 = 237,500
    expect(deriveMonthlyFromBands(bands, "Astronaut")).toBe(237_500);
  });

  it("returns null on empty / missing bands", () => {
    expect(deriveMonthlyFromBands(undefined, "PM")).toBeNull();
    expect(deriveMonthlyFromBands([], "PM")).toBeNull();
    expect(deriveMonthlyFromBands(null, "PM")).toBeNull();
  });

  it("returns null when chosen band has no parseable range", () => {
    expect(deriveMonthlyFromBands([{ role: "PM", range: "competitive" }], "PM")).toBeNull();
  });
});
