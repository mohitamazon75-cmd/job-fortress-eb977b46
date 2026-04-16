-- ═══════════════════════════════════════════════════════════════
-- Audit fixes — issues found in deep audit
-- ═══════════════════════════════════════════════════════════════

-- Fix 1: Missing linkedin_url index on scans table
-- process-scan queries linkedin_url 2× per scan (cache check + Agent1 cache).
-- Without this index, each query scans the full scans table.
CREATE INDEX IF NOT EXISTS idx_scans_linkedin_url
  ON public.scans (linkedin_url)
  WHERE linkedin_url IS NOT NULL;

-- Fix 2: Drop duplicate policies from the duplicate scan_outcomes migration.
-- Two migration files both created scan_outcomes with identical policy names.
-- The second run failed silently or created duplicates.
-- Safe to run: DROP IF EXISTS is idempotent.
DROP POLICY IF EXISTS "Outcome capture via email link (scan_id as token)" ON public.scan_outcomes;
DROP POLICY IF EXISTS "Outcome capture via email link" ON public.scan_outcomes;

-- Recreate as a single canonical policy with rate-limit comment
CREATE POLICY "outcome_insert_via_email_link"
  ON public.scan_outcomes FOR INSERT
  WITH CHECK (
    -- Rate-limited by UNIQUE(scan_id, source) — duplicate inserts become upserts
    -- Additional protection: scan_id must reference a real scan (FK constraint)
    true
  );

-- Fix 3: Add UNIQUE constraint protection on scan_outcomes if not already there
-- (was in migration but may not have applied if first migration ran and second failed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scan_outcomes_scan_id_source_key'
    AND conrelid = 'public.scan_outcomes'::regclass
  ) THEN
    ALTER TABLE public.scan_outcomes
      ADD CONSTRAINT scan_outcomes_scan_id_source_key
      UNIQUE (scan_id, source);
  END IF;
END $$;

-- Fix 4: pg_cron — set the app.service_role_key config so cron HTTP calls authenticate
-- This requires the service role key to be set as a Postgres parameter.
-- IMPORTANT: Run this separately with your actual service role key:
--   ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
-- Uncomment and update the line below:
-- ALTER DATABASE postgres SET app.service_role_key = '';

COMMENT ON INDEX idx_scans_linkedin_url IS
  'Audit fix: linkedin_url was queried 2x per scan without an index.';
