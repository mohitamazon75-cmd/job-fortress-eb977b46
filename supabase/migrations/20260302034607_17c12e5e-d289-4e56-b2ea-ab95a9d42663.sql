
-- ─── AI result cache table ─────────────────────────────────────────────────
-- Keyed by SHA-256 hex digest of canonical input JSON.
-- TTL is stored per-record so different call types can have different expiries.
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text        NOT NULL UNIQUE,          -- SHA-256 hex of canonical input
  action      text        NOT NULL,                 -- e.g. 'enrich_report', 'tavily_research'
  result      jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL                  -- caller-supplied TTL
);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
-- No public policies — only service_role (edge functions) can read/write.

-- Fast lookup by key
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache (cache_key);
-- Allow efficient TTL cleanup
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache (expires_at);

-- Auto-purge expired rows to keep the table lean (runs as a scheduled cleanup helper)
CREATE OR REPLACE FUNCTION public.purge_expired_ai_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.ai_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
