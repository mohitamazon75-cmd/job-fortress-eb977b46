import { describe, it, expect } from "vitest";
import {
  suppressContradictorySalary,
  stripHallucinations,
  sanitiseMarketCopy,
  filterFreshSectorNews,
} from "@/lib/market-copy-sanitizer";

describe("suppressContradictorySalary", () => {
  it("drops sentence claiming ₹30L+ when median is ₹15L (Bug C)", () => {
    const txt = "In India, Demand Gen heads now command ₹30L+ averages. You are currently under-leveraged.";
    const out = suppressContradictorySalary(txt, { min: 12, max: 25, median: 15 });
    expect(out).not.toMatch(/30L/);
    expect(out).toMatch(/under-leveraged/);
  });

  it("keeps sentence with ₹ amount within 2× median", () => {
    const txt = "Senior managers reach ₹25L in this market.";
    const out = suppressContradictorySalary(txt, { min: 12, max: 25, median: 15 });
    expect(out).toMatch(/25L/);
  });

  it("returns text unchanged when band is missing", () => {
    const txt = "₹30L+ averages.";
    expect(suppressContradictorySalary(txt, null)).toBe(txt);
  });

  it("ignores Cr-denominated sums", () => {
    const txt = "Pre-IPO grants reached ₹2 Cr last cycle.";
    const out = suppressContradictorySalary(txt, { min: 12, max: 25, median: 15 });
    expect(out).toMatch(/2 Cr/);
  });
});

describe("stripHallucinations", () => {
  it("strips fake percentile claims", () => {
    expect(stripHallucinations("You sit in the top 15th percentile. Real sentence.")).toBe("Real sentence.");
  });

  it("strips '25% premium' fabrications", () => {
    expect(stripHallucinations("You are missing out on a 25% salary premium. Stay strong.")).toBe("Stay strong.");
  });

  it("strips weekday deadlines", () => {
    expect(stripHallucinations("Update your LinkedIn by Wednesday. This works.")).toBe("This works.");
  });

  it("strips weekday-with-time-of-day deadlines (round-6)", () => {
    expect(stripHallucinations("Update your headline by Wednesday night. Stay sharp.")).toBe("Stay sharp.");
    expect(stripHallucinations("Ship it by Friday morning. Other text.")).toBe("Other text.");
  });

  it("strips fabricated 'inaction costs you ₹NL' claims (round-6)", () => {
    expect(stripHallucinations("Inaction costs you ₹5L in annual growth. Real point."))
      .toBe("Real point.");
    expect(stripHallucinations("This is costing you 12% per year. Other.")).toBe("Other.");
  });

  it("strips 'missing out on N% growth' claims (round-6)", () => {
    expect(stripHallucinations("You are missing out on the 67% growth in AI roles. Truth."))
      .toBe("Truth.");
  });

  it("strips qualitative 'commands a premium' claims (round-6)", () => {
    expect(stripHallucinations("Growth Manager roles command a significant premium over peers. Real."))
      .toBe("Real.");
  });

  it("preserves benign text", () => {
    const t = "Your skills align with India's growth roles.";
    expect(stripHallucinations(t)).toBe(t);
  });

  it("handles empty input", () => {
    expect(stripHallucinations("")).toBe("");
    expect(stripHallucinations(undefined as any)).toBe("");
  });
});

describe("sanitiseMarketCopy composes both", () => {
  it("strips both salary contradiction and hallucination patterns", () => {
    const txt = "₹30L+ averages place you in the top 15th percentile. You are under-leveraged.";
    const out = sanitiseMarketCopy(txt, { min: 12, max: 25, median: 15 });
    expect(out).not.toMatch(/30L/);
    expect(out).not.toMatch(/percentile/);
    expect(out).toMatch(/under-leveraged/);
  });
});

describe("filterFreshSectorNews", () => {
  it("drops items dated 2024 AND 2025 when current year is 2026 (round-6 stricter)", () => {
    // Round-6: stricter — year markers must match the current year. Previous
    // 1-year tolerance let "(2025)" items render under "LAST 21 DAYS" labels
    // even when 8+ months old. Now only same-year markers pass.
    const items = [
      { headline: "TCS adds AI jobs (2024)" },
      { headline: "NITI Aayog warning (2025)" },
      { headline: "Fresh news (2026)" },
      { headline: "No-year-marker fresh item" },
    ];
    const out = filterFreshSectorNews(items, 2026);
    expect(out.map((i) => i.headline)).toEqual([
      "Fresh news (2026)",
      "No-year-marker fresh item",
    ]);
  });

  it("respects published_at over year markers", () => {
    const now = new Date("2026-04-29T00:00:00Z");
    const items = [
      { headline: "Fresh (2026)", published_at: "2026-04-20T00:00:00Z" }, // 9 days old → keep
      { headline: "Stale (2026)", published_at: "2025-09-01T00:00:00Z" }, // ~240 days → drop
    ];
    const out = filterFreshSectorNews(items, 2026, 30, now);
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe("Fresh (2026)");
  });

  it("keeps items without year markers", () => {
    expect(filterFreshSectorNews([{ headline: "no year here" }], 2026)).toHaveLength(1);
  });

  it("handles null/empty arrays", () => {
    expect(filterFreshSectorNews(null, 2026)).toEqual([]);
    expect(filterFreshSectorNews(undefined, 2026)).toEqual([]);
  });
});
