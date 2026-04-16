
CREATE TABLE IF NOT EXISTS public.scan_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  user_id uuid,
  outcome text NOT NULL,
  days_since_scan integer,
  source text NOT NULL DEFAULT 'email_7day',
  scan_determinism_index integer,
  scan_role text,
  scan_industry text,
  scan_seniority text,
  scan_country text DEFAULT 'IN',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, source)
);

ALTER TABLE public.scan_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages scan_outcomes"
  ON public.scan_outcomes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users read own outcomes"
  ON public.scan_outcomes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_scan_outcomes_user_captured
  ON public.scan_outcomes (user_id, captured_at DESC);
