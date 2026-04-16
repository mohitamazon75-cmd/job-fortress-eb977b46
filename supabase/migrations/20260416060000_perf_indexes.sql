-- ═══════════════════════════════════════════════════════════════
-- Performance indexes — P-2-A and P-3-A
-- ═══════════════════════════════════════════════════════════════

-- P-2-A: Composite index for sendOutcomeFollowUps weekly cron query
-- Query: WHERE scan_status = 'complete' AND created_at BETWEEN x AND y
-- Previously used two separate single-column indexes (status + created_at)
-- requiring a merge join. This composite index makes it O(log n).
-- Also benefits score-change-notify main pass (same query shape).
CREATE INDEX IF NOT EXISTS idx_scans_status_created_at
  ON public.scans (scan_status, created_at DESC);

-- P-3-A: User outcome history index
-- Query: WHERE user_id = $1 ORDER BY captured_at DESC
-- The UNIQUE constraint on (scan_id, source) exists but doesn't help
-- user-level queries. This index makes user outcome history O(log n).
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_user_captured
  ON public.scan_outcomes (user_id, captured_at DESC);

COMMENT ON INDEX idx_scans_status_created_at IS
  'Composite index for weekly cron query: scan_status=complete AND created_at BETWEEN';

COMMENT ON INDEX idx_scan_outcomes_user_captured IS
  'User outcome history queries: WHERE user_id=$1 ORDER BY captured_at DESC';
