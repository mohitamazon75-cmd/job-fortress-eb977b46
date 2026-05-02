CREATE TABLE public.shadow_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  user_id uuid,
  scan_id uuid,
  role text,
  has_jd boolean NOT NULL DEFAULT false,
  det_pct integer,
  llm_pct integer,
  det_matched_count integer,
  det_missing_count integer,
  runtime_ms integer,
  resume_source text,
  det_diagnostics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shadow_match_log_created_at ON public.shadow_match_log (created_at DESC);
CREATE INDEX idx_shadow_match_log_function ON public.shadow_match_log (function_name, created_at DESC);

ALTER TABLE public.shadow_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages shadow match log"
  ON public.shadow_match_log
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read shadow match log"
  ON public.shadow_match_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));