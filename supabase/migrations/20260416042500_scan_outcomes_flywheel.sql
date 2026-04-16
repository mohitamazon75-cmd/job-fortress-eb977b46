-- ═══════════════════════════════════════════════════════════════
-- scan_outcomes — Issue 2-A: The 300x outcome tracking flywheel
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scan_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  days_since_scan INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'started_upskilling',
    'applied_to_jobs',
    'got_interview',
    'nothing_yet'
  )),
  scan_determinism_index INTEGER,
  scan_role TEXT,
  scan_industry TEXT,
  scan_seniority TEXT,
  scan_country TEXT,
  source TEXT NOT NULL DEFAULT 'email_7day' CHECK (source IN (
    'email_7day', 'email_30day', 'in_product', 'whatsapp'
  )),
  UNIQUE(scan_id, source)
);

CREATE INDEX IF NOT EXISTS idx_scan_outcomes_scan_id ON public.scan_outcomes (scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_di_role ON public.scan_outcomes (scan_determinism_index, scan_role);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_outcome ON public.scan_outcomes (outcome);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_captured_at ON public.scan_outcomes (captured_at DESC);

ALTER TABLE public.scan_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outcomes"
  ON public.scan_outcomes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON public.scan_outcomes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Outcome capture via email link"
  ON public.scan_outcomes FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.scan_outcomes IS
  'Post-scan outcome tracking. Populated 7 days after scan via email. '
  'Core flywheel: enables personalised predictions based on real outcomes.';
