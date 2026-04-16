-- P-2-A: Composite index for weekly cron queries on scans
CREATE INDEX IF NOT EXISTS idx_scans_status_created_at
  ON public.scans (scan_status, created_at DESC);

COMMENT ON INDEX idx_scans_status_created_at IS
  'Composite index for weekly cron query: scan_status=complete AND created_at BETWEEN';

-- P-3-A: Only create if scan_outcomes table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scan_outcomes') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scan_outcomes_user_captured ON public.scan_outcomes (user_id, captured_at DESC)';
    EXECUTE $c$COMMENT ON INDEX idx_scan_outcomes_user_captured IS 'User outcome history queries: WHERE user_id=$1 ORDER BY captured_at DESC'$c$;
  END IF;
END $$;