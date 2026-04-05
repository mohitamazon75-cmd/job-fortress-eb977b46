
-- 1. Create cohort_percentiles table (fix #1)
CREATE TABLE IF NOT EXISTS public.cohort_percentiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_detected text NOT NULL,
  determinism_index integer,
  metro_tier text,
  country text DEFAULT 'IN',
  city_percentile integer,
  national_percentile integer,
  p25 integer,
  p50 integer,
  p75 integer,
  p90 integer,
  sample_size integer DEFAULT 0,
  cohort_size integer DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cohort_percentiles_role ON public.cohort_percentiles (role_detected);
CREATE INDEX idx_cohort_percentiles_role_score ON public.cohort_percentiles (role_detected, determinism_index DESC);

ALTER TABLE public.cohort_percentiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cohort percentiles"
  ON public.cohort_percentiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages cohort percentiles"
  ON public.cohort_percentiles FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 2. Add access_token index on scans (fix #5)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_access_token 
  ON public.scans (access_token) 
  WHERE access_token IS NOT NULL;

-- 3. Composite index for admin queries (fix #18)
CREATE INDEX IF NOT EXISTS idx_scans_date_status 
  ON public.scans (created_at, scan_status);

-- 4. Enable RLS on learning_resources (fix #15)
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

-- Policy already exists for SELECT, just ensure no write access for non-service-role
-- The existing "Anyone can read learning resources" SELECT policy is fine

-- 5. Unique constraint on weekly_briefs.scan_id (fix #19)
ALTER TABLE public.weekly_briefs 
  ADD CONSTRAINT weekly_briefs_scan_id_unique UNIQUE (scan_id);
