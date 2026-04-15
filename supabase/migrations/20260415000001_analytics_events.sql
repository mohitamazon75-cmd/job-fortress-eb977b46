-- analytics_events: funnel event tracking (landing_view, score_view, tab_view, etc.)
-- Used by useAnalytics hook. Non-critical — failure logged at DEBUG, never thrown.
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text        NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload     jsonb       DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_events' AND policyname = 'Users can read own analytics events'
  ) THEN
    CREATE POLICY "Users can read own analytics events"
      ON public.analytics_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id    ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);

-- Set search_path for security
ALTER TABLE public.analytics_events SET (fillfactor = 90);
