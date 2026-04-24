import { describe, expect, it } from "vitest";
import { buildBoardLinks, classifyJobUrl, formatLiveTimestamp, normalizeCity, parsePostedDays } from "./jobsTab";

describe("jobsTab helpers", () => {
  it("normalizes city strings for board searches", () => {
    expect(normalizeCity("Bengaluru, Karnataka")).toBe("Bengaluru");
    expect(normalizeCity("Mumbai (All Areas)")).toBe("Mumbai");
    expect(normalizeCity("tier-1")).toBe("India");
  });

  it("builds stable Naukri and LinkedIn links", () => {
    const links = buildBoardLinks("Product Marketing Manager", "Bengaluru, Karnataka");
    expect(links.naukri).toContain("product-marketing-manager-jobs-in-bengaluru");
    expect(links.linkedin).toContain("Product%20Marketing%20Manager");
  });

  it("parses recency labels safely", () => {
    expect(parsePostedDays("1 Day Ago")).toBe(1);
    expect(parsePostedDays("30+ Days Ago")).toBe(30);
    expect(parsePostedDays("Few Hours Ago")).toBe(0);
  });

  it("formats timestamps without throwing", () => {
    expect(formatLiveTimestamp("2026-04-23T10:21:11.851Z")).toContain("Refreshed");
    expect(formatLiveTimestamp(undefined)).toBe("Live now");
  });
});
