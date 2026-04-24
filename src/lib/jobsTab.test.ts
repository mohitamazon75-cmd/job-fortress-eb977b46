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

  it("classifies specific vs generic job URLs", () => {
    expect(classifyJobUrl("https://www.naukri.com/job-listings-product-manager-acme-mumbai-5-to-8-years-261024500123").kind).toBe("specific");
    expect(classifyJobUrl("https://www.naukri.com/product-manager-jobs-in-mumbai").kind).toBe("generic");
    expect(classifyJobUrl("https://www.linkedin.com/jobs/view/3812345678").kind).toBe("specific");
    expect(classifyJobUrl("https://www.linkedin.com/jobs/search/?keywords=PM").kind).toBe("generic");
    expect(classifyJobUrl("https://www.indeed.co.in/viewjob?jk=abc123").kind).toBe("specific");
    expect(classifyJobUrl("").kind).toBe("generic");
    expect(classifyJobUrl("not a url").kind).toBe("generic");
  });
});
