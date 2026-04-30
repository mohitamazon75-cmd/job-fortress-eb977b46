-- ═══════════════════════════════════════════════════════════════
-- Pass 2: Peripheral refresh cache (Market Radar / Live News /
--         Sector Pulse / Tools / Best-Fit Jobs / India Jobs)
--
-- Why:
--   Pass 1 froze the core scan (one payment = one process-scan).
--   Time-sensitive surfaces (jobs, news, market signals, tools)
--   must keep updating, but cheaply: ~₹2-5/refresh, capped at one
--   refresh per scan per 7 days.
--
--   Today every widget calls its edge function live on every report
--   open, so each report view re-burns Tavily + Flash spend even
--   when nothing changed. This table lets us cache the JSON payload
--   per (scan, surface) and only re-invoke when stale.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.peripheral_refresh_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  surface     text NOT NULL,        -- 'market_radar' | 'live_news' | 'sector_pulse' | 'tools' | 'best_fit_jobs' | 'india_jobs'
  payload     jsonb NOT NULL,
  cost_paise  integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, surface)
);

CREATE INDEX IF NOT EXISTS idx_peripheral_cache_scan
  ON public.peripheral_refresh_cache (scan_id);

CREATE INDEX IF NOT EXISTS idx_peripheral_cache_refreshed
  ON public.peripheral_refresh_cache (refreshed_at);

COMMENT ON TABLE public.peripheral_refresh_cache IS
  'Pass 2 cache for cheap weekly-refreshable tabs. One row per (scan_id, surface). Refresh edge function (refresh-peripheral-tabs) writes here; widgets read from here when fresh and only re-invoke their own edge function when stale (>7 days) or missing.';

ALTER TABLE public.peripheral_refresh_cache ENABLE ROW LEVEL SECURITY;

-- Owners of the parent scan can read their own cache rows.
CREATE POLICY "Users read own peripheral cache"
  ON public.peripheral_refresh_cache
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = peripheral_refresh_cache.scan_id
        AND (s.user_id = auth.uid() OR s.access_token IS NOT NULL)
    )
  );

-- Writes happen exclusively from the service-role edge function
-- (refresh-peripheral-tabs); no client INSERT/UPDATE/DELETE policies.
