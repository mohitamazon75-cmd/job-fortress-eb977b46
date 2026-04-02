
-- Fix: report_views INSERT policy was using WITH CHECK (true) — too permissive
-- Restrict to only valid view_type values to avoid junk/injection
DROP POLICY IF EXISTS "Authenticated users can log report views" ON public.report_views;
CREATE POLICY "Authenticated users can log report views" ON public.report_views
  AS PERMISSIVE FOR INSERT TO authenticated, anon
  WITH CHECK (view_type IN ('parent', 'doctor', 'shared', 'owner'));
