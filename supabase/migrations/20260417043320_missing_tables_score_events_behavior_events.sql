-- C1 FIX: score_events table — referenced by ScoreTimeline and use-insight-track
CREATE TABLE IF NOT EXISTS public.score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  score_before INTEGER,
  score_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_score_events" ON public.score_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_write_score_events" ON public.score_events FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_score_events_user ON public.score_events (user_id, created_at DESC);

-- C2 FIX: behavior_events table — referenced by use-track.ts
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_behavior_events" ON public.behavior_events FOR INSERT WITH CHECK (true);
CREATE POLICY "users_read_own_behavior" ON public.behavior_events FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_user ON public.behavior_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_name ON public.behavior_events (event_name, created_at DESC);
