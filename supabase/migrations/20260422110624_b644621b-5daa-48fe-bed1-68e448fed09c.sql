-- Drop the policy that re-opened the base table
DROP POLICY IF EXISTS "Public read feature_flags safe columns" ON public.feature_flags;

-- Drop the view too — replaced with a function for cleaner column control
DROP VIEW IF EXISTS public.feature_flags_public;

-- Expose flag metadata through a SECURITY DEFINER function with hard-coded
-- column projection. This pattern is the recommended way to surface a
-- restricted column set without leaving an open SELECT on the base table.
CREATE OR REPLACE FUNCTION public.get_public_feature_flags()
RETURNS TABLE (
  flag_name text,
  enabled_percentage numeric,
  description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT flag_name, enabled_percentage, description
  FROM public.feature_flags
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feature_flags() TO anon, authenticated;