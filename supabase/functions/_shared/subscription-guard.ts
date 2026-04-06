// ═══════════════════════════════════════════════════════════════
// Subscription Guard — DISABLED for testing
// All users are treated as Pro until payments are re-enabled.
// ═══════════════════════════════════════════════════════════════

/**
 * Always returns null (allow request through) for testing.
 */
export async function requirePro(
  _req: Request,
  _allowedTiers: string[] = ["pro", "pro_scan"],
): Promise<Response | null> {
  return null;
}
