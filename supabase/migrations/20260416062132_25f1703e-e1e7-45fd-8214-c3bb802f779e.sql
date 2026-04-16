-- Fix 1: Missing linkedin_url index on scans table
CREATE INDEX IF NOT EXISTS idx_scans_linkedin_url
  ON public.scans (linkedin_url)
  WHERE linkedin_url IS NOT NULL;

-- Fix 2: Drop duplicate policies and recreate canonical one
DROP POLICY IF EXISTS "Outcome capture via email link (scan_id as token)" ON public.scan_outcomes;
DROP POLICY IF EXISTS "Outcome capture via email link" ON public.scan_outcomes;

CREATE POLICY "outcome_insert_via_email_link"
  ON public.scan_outcomes FOR INSERT
  WITH CHECK (true);

-- Fix 3: Add UNIQUE constraint if missing
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

COMMENT ON INDEX idx_scans_linkedin_url IS
  'Audit fix: linkedin_url was queried 2x per scan without an index.';