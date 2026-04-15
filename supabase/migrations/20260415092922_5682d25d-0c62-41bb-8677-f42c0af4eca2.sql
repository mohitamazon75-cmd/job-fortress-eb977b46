
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analytics events"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages analytics events"
  ON public.analytics_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can insert analytics events"
  ON public.analytics_events FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated can insert own analytics events"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
