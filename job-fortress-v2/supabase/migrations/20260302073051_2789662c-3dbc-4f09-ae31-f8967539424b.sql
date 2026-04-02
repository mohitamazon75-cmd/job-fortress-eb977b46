-- Allow authenticated users to INSERT their own scans
CREATE POLICY "Authenticated users can insert own scans"
  ON public.scans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to SELECT their own scans
CREATE POLICY "Authenticated users can select own scans"
  ON public.scans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to UPDATE their own scans
CREATE POLICY "Authenticated users can update own scans"
  ON public.scans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);