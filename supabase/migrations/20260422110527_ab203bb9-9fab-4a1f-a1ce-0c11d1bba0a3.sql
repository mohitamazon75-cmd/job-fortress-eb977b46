-- Security hardening pass — 2026-04-22
-- Addresses three findings from security--run_security_scan.

-- ─────────────────────────────────────────────────────────────
-- 1) Remove public.scans from realtime publication.
--    Any authenticated user could subscribe to scan_id channels and
--    receive row-level updates including final_json_report,
--    resume_file_path, linkedin_url, and access_token.
--    Frontend already has a polling fallback in scan-engine.ts; this
--    drop has no functional regression.
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime DROP TABLE public.scans;

-- ─────────────────────────────────────────────────────────────
-- 2) Lock down scan_outcomes inserts.
--    The previous policy allowed anon + authenticated to insert outcomes
--    for ANY scan_id that exists. Replace with ownership check:
--    authenticated users may only insert outcomes for their own scans;
--    anonymous outcomes must be written via service_role (edge functions).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "scan_outcomes_public_insert" ON public.scan_outcomes;

CREATE POLICY "scan_outcomes_owner_insert"
ON public.scan_outcomes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.scans s
    WHERE s.id = scan_outcomes.scan_id
      AND s.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────
-- 3) Hide enabled_for_user_ids whitelist from public reads.
--    The feature_flags table is publicly readable; the user-id array
--    leaks which users have privileged feature access. Replace the
--    "public read" policy with a restricted view that excludes the
--    sensitive column. Service role retains full access via existing
--    service-role policy.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read feature_flags" ON public.feature_flags;

CREATE OR REPLACE VIEW public.feature_flags_public AS
SELECT
  id,
  flag_name,
  enabled_percentage,
  description,
  created_at,
  updated_at
FROM public.feature_flags;

GRANT SELECT ON public.feature_flags_public TO anon, authenticated;

-- Allow authenticated/anon to read only flag metadata via the view.
-- Direct selects against public.feature_flags now require service_role.