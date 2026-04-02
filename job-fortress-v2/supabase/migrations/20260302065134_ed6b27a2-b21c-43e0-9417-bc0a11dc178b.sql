-- Shared enrichment cache table for edge functions (replaces in-memory Map caches)
CREATE TABLE IF NOT EXISTS public.enrichment_cache (
  cache_key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_cached_at ON public.enrichment_cache (cached_at);

-- RLS: service_role only (edge functions use service role key)
ALTER TABLE public.enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.enrichment_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Cleanup old cache entries (older than 2 hours) via pg_cron
SELECT cron.schedule(
  'cleanup-enrichment-cache',
  '0 */2 * * *',
  $$DELETE FROM public.enrichment_cache WHERE cached_at < now() - interval '2 hours'$$
);