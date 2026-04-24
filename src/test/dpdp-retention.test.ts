import { describe, it, expect } from "vitest";
import {
  DPDP_RETENTION_DAYS,
  retentionCutoff,
  shouldPurgeScan,
} from "@/lib/dpdp-retention";

// Frozen clock for deterministic tests
const NOW = new Date("2026-04-24T12:00:00.000Z");

describe("dpdp-retention", () => {
  it("default retention is 90 days", () => {
    expect(DPDP_RETENTION_DAYS).toBe(90);
  });

  it("cutoff is exactly N days before now", () => {
    const cutoff = retentionCutoff(NOW);
    const diffMs = NOW.getTime() - cutoff.getTime();
    expect(diffMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("purges a scan that is 91 days old", () => {
    const created = new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000);
    expect(shouldPurgeScan(created, NOW)).toBe(true);
  });

  it("keeps a scan that is exactly 90 days old (boundary)", () => {
    const created = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(shouldPurgeScan(created, NOW)).toBe(false);
  });

  it("keeps a scan that is 1 day old", () => {
    const created = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(shouldPurgeScan(created, NOW)).toBe(false);
  });

  it("accepts ISO strings", () => {
    const oldIso = new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldPurgeScan(oldIso, NOW)).toBe(true);
  });

  it("does NOT purge on null/undefined/garbage (fail-safe)", () => {
    expect(shouldPurgeScan(null, NOW)).toBe(false);
    expect(shouldPurgeScan(undefined, NOW)).toBe(false);
    expect(shouldPurgeScan("not-a-date", NOW)).toBe(false);
  });

  it("respects a custom retention window", () => {
    const created = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
    expect(shouldPurgeScan(created, NOW, 30)).toBe(true);
    expect(shouldPurgeScan(created, NOW, 60)).toBe(false);
  });
});
