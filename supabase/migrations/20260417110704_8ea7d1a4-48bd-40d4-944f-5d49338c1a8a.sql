-- P1: Tighten trajectory_predictions RLS — owner-only via scans join
DROP POLICY IF EXISTS "tp_select_all" ON public.trajectory_predictions;
CREATE POLICY "Users read own trajectory predictions"
  ON public.trajectory_predictions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scans
      WHERE scans.id = trajectory_predictions.scan_id
        AND scans.user_id = auth.uid()
    )
  );
CREATE POLICY "Service role manages trajectory predictions"
  ON public.trajectory_predictions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- P1: Restrict anon storage uploads to resumes — require object name to start with anon-{ip-hash}/
-- Drop the wide-open anon insert; require an authenticated user OR scoped path.
DROP POLICY IF EXISTS "Allow anon uploads to resumes" ON storage.objects;
CREATE POLICY "Authenticated users upload to own resumes folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Allow anon uploads only into a clearly-namespaced /anon/ subfolder (used by pre-signup flow)
CREATE POLICY "Anon uploads to anon namespace only"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'anon'
  );