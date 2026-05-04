-- Phase 2B (2026-05-04): bounded retention for telemetry tables.
-- Pre-PMF these are 1-3 MB; at 1k scans/day they grow ~50 MB/month each.
-- 30-day retention is plenty for cost dashboards and debugging. Older data
-- is rolled up into daily_usage_stats already.

CREATE OR REPLACE FUNCTION public.purge_old_telemetry()
RETURNS TABLE(
  token_usage_deleted bigint,
  cost_events_deleted bigint,
  analytics_events_deleted bigint,
  edge_logs_deleted bigint,
  rate_limits_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token bigint := 0;
  v_cost bigint := 0;
  v_analytics bigint := 0;
  v_edge bigint := 0;
  v_rate bigint := 0;
  cutoff timestamptz := now() - interval '30 days';
BEGIN
  WITH d AS (DELETE FROM public.token_usage_log WHERE created_at < cutoff RETURNING 1)
  SELECT count(*) INTO v_token FROM d;

  WITH d AS (DELETE FROM public.cost_events WHERE created_at < cutoff RETURNING 1)
  SELECT count(*) INTO v_cost FROM d;

  WITH d AS (DELETE FROM public.analytics_events WHERE created_at < cutoff RETURNING 1)
  SELECT count(*) INTO v_analytics FROM d;

  WITH d AS (DELETE FROM public.edge_function_logs WHERE created_at < cutoff RETURNING 1)
  SELECT count(*) INTO v_edge FROM d;

  -- scan_rate_limits already has cleanup_expired_rate_limits() (24h horizon),
  -- but include here so a single nightly cron covers everything.
  WITH d AS (DELETE FROM public.scan_rate_limits WHERE window_end < now() - interval '7 days' RETURNING 1)
  SELECT count(*) INTO v_rate FROM d;

  -- Audit trail
  INSERT INTO public.edge_function_logs (function_name, status, error_message, request_meta)
  VALUES (
    'purge_old_telemetry',
    'success',
    NULL,
    jsonb_build_object(
      'token_usage_deleted', v_token,
      'cost_events_deleted', v_cost,
      'analytics_events_deleted', v_analytics,
      'edge_logs_deleted', v_edge,
      'rate_limits_deleted', v_rate,
      'cutoff', cutoff
    )
  );

  RETURN QUERY SELECT v_token, v_cost, v_analytics, v_edge, v_rate;
END;
$$;

-- Schedule nightly at 19:00 UTC (00:30 IST, off-peak)
SELECT cron.schedule(
  'purge-old-telemetry-nightly',
  '0 19 * * *',
  $$SELECT public.purge_old_telemetry();$$
);