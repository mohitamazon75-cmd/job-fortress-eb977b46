import { describe, it, expect, beforeEach, vi } from "vitest";
import { classifyRevealOpen, makeScrollDepthTracker } from "@/lib/reveal-tracking";

describe("classifyRevealOpen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns reveal_opened on first call for a scan and persists a marker", () => {
    const result = classifyRevealOpen("scan-A");
    expect(result).toBe("reveal_opened");
    expect(window.localStorage.getItem("jb:reveal_seen:scan-A")).toBeTruthy();
  });

  it("returns reveal_reopened on subsequent calls for the same scan", () => {
    classifyRevealOpen("scan-A");
    expect(classifyRevealOpen("scan-A")).toBe("reveal_reopened");
    expect(classifyRevealOpen("scan-A")).toBe("reveal_reopened");
  });

  it("treats different scan IDs independently", () => {
    classifyRevealOpen("scan-A");
    expect(classifyRevealOpen("scan-B")).toBe("reveal_opened");
  });

  it("falls back to reveal_opened if localStorage throws on read", () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("blocked");
    });
    try {
      expect(classifyRevealOpen("scan-X")).toBe("reveal_opened");
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});

describe("makeScrollDepthTracker", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2400,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 800,
    });
    window.scrollY = 0;
  });

  it("fires each threshold exactly once even when scroll handler is invoked many times", () => {
    const crossed = new Set<number>();
    const seen: number[] = [];
    const handler = makeScrollDepthTracker(crossed, (pct) => seen.push(pct));

    // scrollable = 2400 - 800 = 1600
    window.scrollY = 400; // 25%
    handler();
    handler();
    window.scrollY = 800; // 50%
    handler();
    window.scrollY = 1200; // 75%
    handler();
    window.scrollY = 1600; // 100%
    handler();
    handler(); // duplicate at 100%

    expect(seen).toEqual([25, 50, 75, 100]);
  });

  it("does not fire any threshold when scroll position stays at top", () => {
    const seen: number[] = [];
    const handler = makeScrollDepthTracker(new Set(), (pct) => seen.push(pct));
    window.scrollY = 0;
    handler();
    expect(seen).toEqual([]);
  });

  it("fires only the thresholds actually crossed when user jumps mid-page", () => {
    const seen: number[] = [];
    const handler = makeScrollDepthTracker(new Set(), (pct) => seen.push(pct));
    window.scrollY = 1200; // 75%
    handler();
    // 25, 50, 75 should all fire because they were all crossed
    expect(seen).toEqual([25, 50, 75]);
  });
});
