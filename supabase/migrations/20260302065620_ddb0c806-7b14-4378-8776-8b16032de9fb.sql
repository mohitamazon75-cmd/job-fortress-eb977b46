
-- ── Enable pg_cron + pg_net extensions for scheduled jobs ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Index: speed up shared_reports token lookups + expiry scans ──────────
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires_at ON public.shared_reports (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON public.ai_cache (expires_at);

-- ── Purge function: expired shared_reports ────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_shared_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.shared_reports WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
