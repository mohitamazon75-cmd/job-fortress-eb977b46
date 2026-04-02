
-- ═══════════════════════════════════════════════════════
-- Silence linter INFO: pulse_beta_* "RLS enabled, no policy"
-- Explicit deny policies confirm intent: service role only.
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "No direct client access to pulse_beta_students" ON public.pulse_beta_students;
CREATE POLICY "No direct client access to pulse_beta_students"
  ON public.pulse_beta_students FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client access to pulse_beta_scans" ON public.pulse_beta_scans;
CREATE POLICY "No direct client access to pulse_beta_scans"
  ON public.pulse_beta_scans FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client access to pulse_beta_alerts" ON public.pulse_beta_alerts;
CREATE POLICY "No direct client access to pulse_beta_alerts"
  ON public.pulse_beta_alerts FOR ALL USING (false) WITH CHECK (false);

-- ═══════════════════════════════════════════════════════
-- Fix WARN: report_views INSERT uses WITH CHECK (true)
-- Only authenticated users should log views; tie to auth.
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can log report views" ON public.report_views;
CREATE POLICY "Authenticated users can log report views"
  ON public.report_views
  FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated', 'anon'));
