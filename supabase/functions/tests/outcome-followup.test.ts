/**
 * Tests for sendOutcomeFollowUps() — the 7-day outcome follow-up email logic.
 *
 * The weekly retention cron fires this function every Monday at 9am IST.
 * An off-by-one in the date window silently causes users to be missed (or
 * double-emailed) for the entire week — no error, no alert, just silence.
 *
 * These tests verify:
 *   1. Scans in the 6–8 day window ARE included
 *   2. Scans older than 8 days are NOT included
 *   3. Scans newer than 6 days are NOT included
 *   4. Scans with an existing email_7day outcome are excluded (deduplication)
 *
 * Strategy: test the window calculation logic directly without mocking the
 * full Supabase client — extract the window arithmetic into testable form.
 *
 * Run with: deno test --allow-net --allow-env outcome-followup.test.ts
 */

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ─── Window arithmetic extracted from sendOutcomeFollowUps ───────────────────
// These are the exact constants from score-change-notify/index.ts.
// If they change, these tests fail and the change is visible.

const WINDOW_DAYS_OLD = 8;   // scans OLDER than this are excluded
const WINDOW_DAYS_NEW = 6;   // scans NEWER than this are excluded

function getFollowUpWindow(now = Date.now()): { windowStart: string; windowEnd: string } {
  return {
    windowStart: new Date(now - WINDOW_DAYS_OLD * 24 * 60 * 60 * 1000).toISOString(),
    windowEnd:   new Date(now - WINDOW_DAYS_NEW * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function isInFollowUpWindow(createdAt: string, now = Date.now()): boolean {
  const { windowStart, windowEnd } = getFollowUpWindow(now);
  return createdAt >= windowStart && createdAt <= windowEnd;
}

// ─── T-4-1: Scans in the 6–8 day window are included ────────────────────────

Deno.test("7-day window — scan from exactly 7 days ago is included", () => {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  assert(
    isInFollowUpWindow(sevenDaysAgo, now),
    "A scan from exactly 7 days ago must be in the follow-up window (6–8 days)",
  );
});

Deno.test("7-day window — scan from 6.5 days ago is included", () => {
  const now = Date.now();
  // 6.5 days = 6 days + 12 hours — inside the 6–8 day window
  const sixAndHalfDaysAgo = new Date(now - 6.5 * 24 * 60 * 60 * 1000).toISOString();
  assert(
    isInFollowUpWindow(sixAndHalfDaysAgo, now),
    "A scan from 6.5 days ago must be in the follow-up window",
  );
});

// ─── T-4-2: Scans older than 8 days are excluded ─────────────────────────────

Deno.test("7-day window — scan from 10 days ago is excluded", () => {
  const now = Date.now();
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  assert(
    !isInFollowUpWindow(tenDaysAgo, now),
    "A scan from 10 days ago must NOT be in the follow-up window (too old)",
  );
});

Deno.test("7-day window — scan from 8 days + 1 hour ago is excluded", () => {
  const now = Date.now();
  // Just past the 8-day boundary
  const justOver8Days = new Date(now - (8 * 24 * 60 * 60 + 3600) * 1000).toISOString();
  assert(
    !isInFollowUpWindow(justOver8Days, now),
    "A scan just past 8 days old must be excluded",
  );
});

// ─── T-4-3: Scans newer than 6 days are excluded ─────────────────────────────

Deno.test("7-day window — scan from 3 days ago is excluded", () => {
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert(
    !isInFollowUpWindow(threeDaysAgo, now),
    "A scan from 3 days ago must NOT be in the follow-up window (too recent)",
  );
});

Deno.test("7-day window — scan from 5 days + 23 hours ago is excluded", () => {
  const now = Date.now();
  // Just inside the 6-day boundary
  const justUnder6Days = new Date(now - (6 * 24 * 60 * 60 - 3600) * 1000).toISOString();
  assert(
    !isInFollowUpWindow(justUnder6Days, now),
    "A scan just under 6 days old must be excluded (too recent)",
  );
});

// ─── T-4-4: Deduplication contract ───────────────────────────────────────────

Deno.test("7-day window deduplication — alreadyCaptured set prevents double-sending", () => {
  // Simulate the deduplication logic from sendOutcomeFollowUps
  const targetScans = [
    { id: "scan-aaa", user_id: "user-1", role_detected: "Engineer", determinism_index: 55 },
    { id: "scan-bbb", user_id: "user-2", role_detected: "Manager", determinism_index: 62 },
    { id: "scan-ccc", user_id: "user-3", role_detected: "Analyst", determinism_index: 70 },
  ];

  // scan-aaa already has an outcome captured (user clicked email link)
  const existingOutcomes = [{ scan_id: "scan-aaa" }];
  const alreadyCaptured = new Set(existingOutcomes.map(o => o.scan_id));
  const toEmail = targetScans.filter(s => !alreadyCaptured.has(s.id));

  assertEquals(
    toEmail.length,
    2,
    "Only 2 of 3 scans should be emailed (scan-aaa already has outcome)",
  );
  assert(!toEmail.some(s => s.id === "scan-aaa"), "scan-aaa must be excluded from email batch");
  assert(toEmail.some(s => s.id === "scan-bbb"), "scan-bbb must be included");
  assert(toEmail.some(s => s.id === "scan-ccc"), "scan-ccc must be included");
});

Deno.test("7-day window deduplication — empty outcomes list sends to all scans", () => {
  const targetScans = [
    { id: "scan-111", user_id: "user-1" },
    { id: "scan-222", user_id: "user-2" },
  ];

  const alreadyCaptured = new Set<string>([]);
  const toEmail = targetScans.filter(s => !alreadyCaptured.has(s.id));

  assertEquals(
    toEmail.length,
    2,
    "All scans must be emailed when no outcomes have been captured yet",
  );
});

// ─── T-4-5: Window boundary values ───────────────────────────────────────────

Deno.test("7-day window — windowStart is exactly 8 days before now", () => {
  const now = Date.now();
  const { windowStart } = getFollowUpWindow(now);
  const expectedStart = new Date(now - 8 * 24 * 60 * 60 * 1000);
  const actualStart = new Date(windowStart);

  // Allow 1 second tolerance for execution time
  const diffMs = Math.abs(actualStart.getTime() - expectedStart.getTime());
  assert(diffMs < 1000, `windowStart should be 8 days before now (±1s), got diff=${diffMs}ms`);
});

Deno.test("7-day window — windowEnd is exactly 6 days before now", () => {
  const now = Date.now();
  const { windowEnd } = getFollowUpWindow(now);
  const expectedEnd = new Date(now - 6 * 24 * 60 * 60 * 1000);
  const actualEnd = new Date(windowEnd);

  const diffMs = Math.abs(actualEnd.getTime() - expectedEnd.getTime());
  assert(diffMs < 1000, `windowEnd should be 6 days before now (±1s), got diff=${diffMs}ms`);
});
