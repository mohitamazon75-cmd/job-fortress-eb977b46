-- External API spend & latency telemetry
CREATE TABLE IF NOT EXISTS public.external_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  endpoint TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  latency_ms INTEGER,
  estimated_cost_usd NUMERIC(10, 6),
  cache_key TEXT,
  function_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_api_log_provider_created
  ON public.external_api_log (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_api_log_function
  ON public.external_api_log (function_name, created_at DESC);

ALTER TABLE public.external_api_log ENABLE ROW LEVEL SECURITY;

-- Admins can read; service role bypasses RLS so functions can write freely.
CREATE POLICY "Admins can view external_api_log"
  ON public.external_api_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index on enrichment_cache.cached_at to speed cleanup_expired_cache()
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_cached_at
  ON public.enrichment_cache (cached_at);