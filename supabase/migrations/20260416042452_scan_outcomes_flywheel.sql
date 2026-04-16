-- ═══════════════════════════════════════════════════════════════
-- scan_outcomes — Issue 2-A: The 300x outcome tracking flywheel
--
-- Captures what happens AFTER a scan. This is the moat-building
-- dataset: when we know that users with DI=67 who adopted AI tools
-- got interviews at 61%, we can show that to the next user.
--
-- Populated by:
--   1. 7-day post-scan email with a single 4-option question
--   2. In-product "Did this work?" prompt (future)
--   3. LinkedIn share callback tracking (future)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scan_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- When was this outcome captured (vs when was the scan)
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  days_since_scan INTEGER,  -- computed on insert

  -- The 4-option outcome question (answered via email link)
  outcome TEXT NOT NULL CHECK (outcome IN (
    'started_upskilling',   -- "Started upskilling / learning"
    'applied_to_jobs',      -- "Applied to jobs"
    'got_interview',        -- "Got an interview"
    'nothing_yet'           -- "Nothing yet"
  )),

  -- Context at the time of the scan (denormalised for analytics)
  scan_determinism_index INTEGER,
  scan_role TEXT,
  scan_industry TEXT,
  scan_seniority TEXT,
  scan_country TEXT,

  -- Source of outcome capture
  source TEXT NOT NULL DEFAULT 'email_7day' CHECK (source IN (
    'email_7day',     -- 7-day follow-up email click
    'email_30day',    -- 30-day follow-up
    'in_product',     -- in-app prompt
    'whatsapp'        -- WhatsApp follow-up
  )),

  -- Prevent duplicate outcomes per scan per source
  UNIQUE(scan_id, source)
);

-- Indexes for the prediction calibration query:
-- "For users with DI between X and Y in role R who took action A, what % got interviews?"
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_scan_id ON public.scan_outcomes (scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_user_id ON public.scan_outcomes (user_id);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_outcome ON public.scan_outcomes (outcome);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_di_role ON public.scan_outcomes (scan_determinism_index, scan_role);
CREATE INDEX IF NOT EXISTS idx_scan_outcomes_captured_at ON public.scan_outcomes (captured_at DESC);

-- RLS: users can see their own outcomes; service role can write all
ALTER TABLE public.scan_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outcomes"
  ON public.scan_outcomes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON public.scan_outcomes FOR ALL
  USING (auth.role() = 'service_role');

-- Public INSERT for email click-through (unauthenticated users clicking email links)
-- Uses scan_id as the auth token — guessable only if you know the scan UUID
CREATE POLICY "Outcome capture via email link (scan_id as token)"
  ON public.scan_outcomes FOR INSERT
  WITH CHECK (true);  -- Rate-limited by UNIQUE(scan_id, source) constraint

COMMENT ON TABLE public.scan_outcomes IS
  'Post-scan outcome tracking. Populated 7 days after scan via email follow-up. '
  'Core flywheel: enables "users like you who took action X had Y% interview rate" '
  'personalised predictions. This is the data moat no competitor can buy.';

COMMENT ON COLUMN public.scan_outcomes.outcome IS
  'started_upskilling | applied_to_jobs | got_interview | nothing_yet';
