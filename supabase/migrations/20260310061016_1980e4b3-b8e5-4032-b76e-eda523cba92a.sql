-- Fix beta_events RLS: ensure profile_id belongs to current user
DROP POLICY IF EXISTS "Users can insert own events" ON public.beta_events;
CREATE POLICY "Users can insert own events" ON public.beta_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL 
      OR profile_id IN (SELECT id FROM public.beta_profiles WHERE user_id = auth.uid())
    )
  );

-- Fix scan_accuracy_by_family: enable RLS and restrict to admin only
ALTER VIEW public.scan_accuracy_by_family SET (security_invoker = true);
