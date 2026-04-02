
-- ═══════════════════════════════════════════════════════
-- P0 FIX: pulse_beta_* tables — drop unrestricted policies
-- These tables contain child PII (names, parent emails).
-- Service role (edge functions) bypasses RLS automatically.
-- Anonymous/authenticated users must have zero direct access.
-- ═══════════════════════════════════════════════════════

-- pulse_beta_students
DROP POLICY IF EXISTS "anon_all_students" ON public.pulse_beta_students;

-- pulse_beta_scans
DROP POLICY IF EXISTS "anon_all_scans" ON public.pulse_beta_scans;

-- pulse_beta_alerts
DROP POLICY IF EXISTS "anon_all_alerts" ON public.pulse_beta_alerts;

-- Verify RLS is enabled on all three (belt-and-suspenders)
ALTER TABLE public.pulse_beta_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_beta_scans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_beta_alerts   ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════
-- P1 FIX: system tables — explicit deny-public policies
-- Service role bypasses RLS, so these only block
-- accidental direct client queries.
-- ═══════════════════════════════════════════════════════

-- ai_cache: edge functions only (service role)
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to ai_cache" ON public.ai_cache;
CREATE POLICY "No direct client access to ai_cache"
  ON public.ai_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- rate_limits: edge functions only (service role)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to rate_limits" ON public.rate_limits;
CREATE POLICY "No direct client access to rate_limits"
  ON public.rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ip_rate_limits: edge functions only (service role)
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to ip_rate_limits" ON public.ip_rate_limits;
CREATE POLICY "No direct client access to ip_rate_limits"
  ON public.ip_rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- admin_sessions: edge functions only (service role)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to admin_sessions" ON public.admin_sessions;
CREATE POLICY "No direct client access to admin_sessions"
  ON public.admin_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- admin_login_attempts: edge functions only (service role)
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to admin_login_attempts" ON public.admin_login_attempts;
CREATE POLICY "No direct client access to admin_login_attempts"
  ON public.admin_login_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);
