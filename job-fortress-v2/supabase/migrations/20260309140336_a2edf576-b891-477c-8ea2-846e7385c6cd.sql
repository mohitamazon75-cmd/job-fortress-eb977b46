
-- ============================================================
-- CRITICAL FIX 1: Remove anonymous insert on scans (prevents injection)
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.scans;

-- ============================================================
-- CRITICAL FIX 2: Fix weekly_briefs public insert policy
-- ============================================================
DROP POLICY IF EXISTS "Allow service role insert" ON public.weekly_briefs;

-- ============================================================
-- FIX 3: Restrict monitoring_alerts from anon read
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read monitoring_alerts" ON public.monitoring_alerts;

CREATE POLICY "Admins can read monitoring_alerts"
  ON public.monitoring_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX 4: Restrict daily_usage_stats from anon read
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read daily_usage_stats" ON public.daily_usage_stats;

CREATE POLICY "Admins can read daily_usage_stats"
  ON public.daily_usage_stats
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX 5: Basic error alerting — function to auto-create alerts
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_error_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_error_rate numeric;
  total_calls integer;
  total_errors integer;
BEGIN
  -- Only check on error logs
  IF NEW.status != 'error' THEN
    RETURN NEW;
  END IF;

  -- Get today's stats for this function
  SELECT COALESCE(SUM(call_count), 0), COALESCE(SUM(error_count), 0)
  INTO total_calls, total_errors
  FROM public.daily_usage_stats
  WHERE function_name = NEW.function_name
    AND stat_date = CURRENT_DATE;

  -- If error rate > 20% and at least 10 calls, create alert
  IF total_calls >= 10 THEN
    current_error_rate := (total_errors::numeric / total_calls) * 100;
    IF current_error_rate > 20 THEN
      -- Avoid duplicate alerts within 1 hour
      IF NOT EXISTS (
        SELECT 1 FROM public.monitoring_alerts
        WHERE function_name = NEW.function_name
          AND alert_type = 'high_error_rate'
          AND acknowledged = false
          AND created_at > now() - interval '1 hour'
      ) THEN
        INSERT INTO public.monitoring_alerts (alert_type, severity, function_name, message)
        VALUES (
          'high_error_rate',
          CASE WHEN current_error_rate > 50 THEN 'critical' ELSE 'warning' END,
          NEW.function_name,
          format('%s error rate at %s%% (%s/%s calls today)', NEW.function_name, round(current_error_rate), total_errors, total_calls)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_error_threshold
  AFTER INSERT ON public.edge_function_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_error_threshold();
