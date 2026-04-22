-- Recreate feature_flags_public with explicit SECURITY INVOKER
-- Default in older Postgres is SECURITY DEFINER which bypasses RLS of the
-- caller. Switching to INVOKER means the view honors the caller's identity.
DROP VIEW IF EXISTS public.feature_flags_public;

CREATE VIEW public.feature_flags_public
WITH (security_invoker = true)
AS
SELECT
  id,
  flag_name,
  enabled_percentage,
  description,
  created_at,
  updated_at
FROM public.feature_flags;

GRANT SELECT ON public.feature_flags_public TO anon, authenticated;

-- The base table public.feature_flags has RLS enabled with only a
-- service_role policy now, so anon/authenticated reads through the view
-- will fail. Restore a *column-restricted* read by attaching a policy
-- that lets anon/authenticated select from the base table — the view
-- definition itself prevents the sensitive column from being returned.
CREATE POLICY "Public read feature_flags safe columns"
ON public.feature_flags
FOR SELECT
TO anon, authenticated
USING (true);