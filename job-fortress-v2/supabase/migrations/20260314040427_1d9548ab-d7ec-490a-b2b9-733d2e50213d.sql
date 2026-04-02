
-- Add token tracking columns to daily_usage_stats
ALTER TABLE public.daily_usage_stats 
  ADD COLUMN IF NOT EXISTS total_tokens bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd numeric DEFAULT 0;

-- Create token_usage_log for per-call granular tracking
CREATE TABLE IF NOT EXISTS public.token_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  agent_name text,
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: service role only
ALTER TABLE public.token_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages token logs"
  ON public.token_usage_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read token logs"
  ON public.token_usage_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_token_usage_log_fn_date ON public.token_usage_log (function_name, created_at DESC);
