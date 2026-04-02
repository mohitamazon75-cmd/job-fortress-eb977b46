// ═══════════════════════════════════════════════════════════════
// Rate Limiter — identity-based with per-scan deduplication
// ═══════════════════════════════════════════════════════════════

const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Checks and enforces rate limits for scan creation.
 * Uses user_id when available (identity-based), falls back to IP.
 * Per-scan deduplication prevents retries from consuming additional quota.
 *
 * @returns true if within limits, false if blocked (fail-closed on errors).
 */
export async function checkRateLimit(
  ip: string,
  supabaseClient: any,
  userId?: string | null,
  scanId?: string | null,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  try {
    if (userId) {
      // Retry-safe dedupe: do not consume additional quota for the same scanId
      if (scanId) {
        const { count: existingScanCount, error: existingScanErr } = await supabaseClient
          .from("scan_rate_limits")
          .select("id", { count: "exact", head: true })
          .eq("client_ip", `scan:${scanId}`)
          .gte("created_at", windowStart);

        if (existingScanErr) {
          console.error("[RateLimit] scan marker check failed, blocking (fail-closed):", existingScanErr.message);
          return false;
        }
        if ((existingScanCount ?? 0) > 0) return true;
      }

      const { count, error } = await supabaseClient
        .from("scan_rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", `user:${userId}`)
        .gte("created_at", windowStart);

      if (error) {
        console.error("[RateLimit] DB check failed, blocking (fail-closed):", error.message);
        return false;
      }
      if ((count ?? 0) >= RATE_LIMIT) return false;

      const rowsToInsert: { client_ip: string }[] = [{ client_ip: `user:${userId}` }];
      if (scanId) rowsToInsert.push({ client_ip: `scan:${scanId}` });
      const { error: insertErr } = await supabaseClient.from("scan_rate_limits").insert(rowsToInsert);
      if (insertErr) {
        console.error("[RateLimit] insert failed, blocking (fail-closed):", insertErr.message);
        return false;
      }
      return true;
    }

    // Fallback: IP-based
    const { count, error } = await supabaseClient
      .from("scan_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", ip)
      .gte("created_at", windowStart);

    if (error) {
      console.error("[RateLimit] DB check failed, blocking (fail-closed):", error.message);
      return false;
    }
    if ((count ?? 0) >= RATE_LIMIT) return false;

    const { error: ipInsertErr } = await supabaseClient.from("scan_rate_limits").insert({ client_ip: ip });
    if (ipInsertErr) {
      console.error("[RateLimit] IP insert failed, blocking (fail-closed):", ipInsertErr.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[RateLimit] Exception, blocking (fail-closed):", err);
    return false;
  }
}
