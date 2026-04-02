// ═══════════════════════════════════════════════════════════════
// Week 2 #2: Delta tracking — records score snapshots per scan.
// Called from process-scan after report assembly.
// ═══════════════════════════════════════════════════════════════

export async function recordScoreHistory(
  supabase: any,
  userId: string | null,
  scanId: string,
  report: any,
): Promise<void> {
  if (!userId) return; // Skip for anonymous scans
  try {
    await supabase.from("score_history").insert({
      user_id: userId,
      scan_id: scanId,
      determinism_index: report.determinism_index ?? 0,
      survivability_score: report.survivability?.score ?? null,
      moat_score: report.moat_score ?? null,
      role_detected: report.role ?? null,
      industry: report.industry ?? null,
    });
  } catch (e) {
    console.warn("[ScoreHistory] Insert failed (non-fatal):", e);
  }
}

/**
 * Fetch the previous score snapshot for delta calculation.
 * Returns null if no prior scan exists.
 */
export async function getPreviousScore(
  supabase: any,
  userId: string,
  currentScanId: string,
): Promise<{ determinism_index: number; survivability_score: number | null; moat_score: number | null; created_at: string } | null> {
  try {
    const { data } = await supabase
      .from("score_history")
      .select("determinism_index, survivability_score, moat_score, created_at")
      .eq("user_id", userId)
      .neq("scan_id", currentScanId)
      .order("created_at", { ascending: false })
      .limit(1);
    return data?.[0] || null;
  } catch {
    return null;
  }
}
