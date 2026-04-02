-- FIX 1: error_logs INSERT policy (user_id injection vulnerability)
-- Old policy: WITH CHECK (true) allows any user to attribute logs to any user_id
-- New policy: only allow rows where user_id IS NULL (anon) or matches the caller
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

CREATE POLICY "Authenticated or anon can insert own error logs"
  ON public.error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- FIX 2: report_views INSERT policy (blueprint_id ownership bypass)
-- Old policy: only validates view_type, no ownership check on blueprint_id
-- New policy: shared/doctor views allowed for anon; owner/parent views require ownership
DROP POLICY IF EXISTS "Authenticated users can log report views" ON public.report_views;

CREATE POLICY "Controlled report view logging"
  ON public.report_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    view_type = ANY (ARRAY['parent'::text, 'doctor'::text, 'shared'::text, 'owner'::text])
    AND (
      -- Shared/doctor links are anonymous — no ownership required
      view_type IN ('shared', 'doctor')
      OR
      -- Owner/parent views: must own the blueprint's child
      blueprint_id IN (
        SELECT fb.id
        FROM public.future_blueprints fb
        JOIN public.children c ON c.id = fb.child_id
        WHERE c.user_id = auth.uid()
      )
    )
  );