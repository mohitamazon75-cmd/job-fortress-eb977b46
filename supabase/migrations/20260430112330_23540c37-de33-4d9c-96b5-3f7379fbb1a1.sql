-- Recreate v_scan_cost_summary with security_invoker so that the view
-- enforces the *caller's* RLS, not the view-owner's. cost_events is
-- admin-only via RLS, so non-admin authenticated users will see zero
-- cost columns (which is what we want).
DROP VIEW IF EXISTS public.v_scan_cost_summary;

CREATE VIEW public.v_scan_cost_summary
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.v_scan_cost_summary TO authenticated;

COMMENT ON VIEW public.v_scan_cost_summary IS
  'Per-scan cost rollup. security_invoker=true so RLS on cost_events (admin-only) is enforced. Non-admin users see zero cost columns even when the underlying scan is theirs.';