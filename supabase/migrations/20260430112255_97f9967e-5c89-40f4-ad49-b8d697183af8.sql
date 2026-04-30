-- ═══════════════════════════════════════════════════════════════
-- Pass 1: Idempotency guard + cost summary view
--
-- Why:
--   1. Today, a determined user (or a bug) can re-trigger process-scan
--      for the same scan_id and burn a fresh ~₹15-40 of LLM spend.
--      We need a hard "already processed" stamp that survives status flips.
--   2. /admin/costs needs a per-scan rollup view so we don't recompute
--      it client-side from raw cost_events on every dashboard load.
-- ═══════════════════════════════════════════════════════════════

-- 1. process_completed_at: the immutable "this scan has been processed once" marker.
--    Set ONCE by process-scan when the final report is persisted. Never cleared.
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS process_completed_at timestamptz;

COMMENT ON COLUMN public.scans.process_completed_at IS
  'Set exactly once when process-scan finishes successfully. Used as an idempotency guard: if non-null, process-scan refuses to re-run for this scan_id. Never cleared, even on user-triggered "rescan" — a rescan must use a NEW scan row.';

CREATE INDEX IF NOT EXISTS idx_scans_process_completed_at
  ON public.scans (process_completed_at)
  WHERE process_completed_at IS NOT NULL;

-- 2. peripheral_refreshed_at: tracks the weekly cheap-refresh cadence
--    (Market Radar / Live News / Tools / Best-Fit Jobs). Pass 2 will use it.
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS peripheral_refreshed_at timestamptz;

COMMENT ON COLUMN public.scans.peripheral_refreshed_at IS
  'Last time the cheap weekly refresh (Market Radar, Tools, Jobs, Live News) ran for this scan. NULL = never refreshed. Pass 2 uses now() - peripheral_refreshed_at > 7 days as the gate.';

-- 3. v_scan_cost_summary: per-scan rollup for /admin/costs.
--    LEFT JOIN so scans with zero cost_events still appear (useful to spot
--    scans that ran without instrumentation).
CREATE OR REPLACE VIEW public.v_scan_cost_summary AS
SELECT
  s.id                                AS scan_id,
  s.user_id,
  s.created_at                        AS scan_created_at,
  s.process_completed_at,
  s.scan_status,
  COALESCE(SUM(c.cost_inr_paise), 0)  AS total_cost_paise,
  COUNT(c.id)                         AS event_count,
  COUNT(DISTINCT c.function_name)     AS distinct_functions,
  COUNT(DISTINCT c.provider)          AS distinct_providers,
  MIN(c.created_at)                   AS first_event_at,
  MAX(c.created_at)                   AS last_event_at
FROM public.scans s
LEFT JOIN public.cost_events c ON c.scan_id = s.id
GROUP BY s.id, s.user_id, s.created_at, s.process_completed_at, s.scan_status;

-- View inherits RLS from underlying tables (cost_events is admin-only),
-- but the view itself needs explicit grants for PostgREST.
-- Admins already gated by has_role() check inside cost_events RLS.
GRANT SELECT ON public.v_scan_cost_summary TO authenticated;

COMMENT ON VIEW public.v_scan_cost_summary IS
  'Per-scan cost rollup. Used by /admin/costs dashboard. Underlying cost_events row is admin-only (RLS), so non-admin authenticated users see zero rows.';