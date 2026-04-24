// ═══════════════════════════════════════════════════════════════
// DPDP Retention Helpers — pure logic, fully testable
//
// India DPDP Act 2023 + project policy: scans are retained for at
// most 90 days, then purged. These helpers compute the cutoff and
// the purge decision from a frozen clock — no DB, no I/O — so the
// rule can be unit-tested without spinning up Postgres.
//
// Used by:
//   - supabase/functions/purge-expired-scans/index.ts
//   - src/test/dpdp-retention.test.ts
// ═══════════════════════════════════════════════════════════════

/** Default retention window (days). */
export const DPDP_RETENTION_DAYS = 90;

/**
 * Compute the cutoff timestamp. Anything strictly older than this
 * cutoff is eligible for deletion.
 */
export function retentionCutoff(now: Date, days = DPDP_RETENTION_DAYS): Date {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

/**
 * Returns true when a scan with `createdAt` should be purged given `now`.
 * Defensive against bad input — treats unparseable dates as NOT eligible
 * (we'd rather skip than wrongly delete user data).
 */
export function shouldPurgeScan(
  createdAt: string | Date | null | undefined,
  now: Date,
  days = DPDP_RETENTION_DAYS,
): boolean {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(created.getTime())) return false;
  return created.getTime() < retentionCutoff(now, days).getTime();
}
