-- ═══════════════════════════════════════════════════════════════
-- Emergency: create all 4 missing tables in one migration
-- These were referenced in code but never created in production.
-- ═══════════════════════════════════════════════════════════════

-- C1: score_events (referenced by ScoreTimeline + use-insight-track)
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_events' AND policyname='users_read_own_score_events') THEN
    CREATE POLICY "users_read_own_score_events" ON public.score_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_events' AND policyname='service_write_score_events') THEN
    CREATE POLICY "service_write_score_events" ON public.score_events FOR INSERT WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_score_events_user ON public.score_events (user_id, created_at DESC);

-- C2: behavior_events (referenced by use-track.ts)
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='behavior_events' AND policyname='anon_insert_behavior_events') THEN
    CREATE POLICY "anon_insert_behavior_events" ON public.behavior_events FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='behavior_events' AND policyname='users_read_own_behavior') THEN
    CREATE POLICY "users_read_own_behavior" ON public.behavior_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_behavior_events_user ON public.behavior_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_name ON public.behavior_events (event_name, created_at DESC);

-- M8: user_action_signals (behavioral flywheel)
CREATE TABLE IF NOT EXISTS public.user_action_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'card_viewed','job_clicked','skill_selected','vocab_copied',
    'pivot_expanded','plan_action_checked','share_whatsapp',
    'share_linkedin','rescan_initiated','outcome_reported','tool_opened'
  )),
  action_payload JSONB DEFAULT '{}',
  scan_role TEXT, scan_industry TEXT, scan_score INTEGER, scan_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_action_signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_action_signals' AND policyname='users_read_own_signals') THEN
    CREATE POLICY "users_read_own_signals" ON public.user_action_signals FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_action_signals' AND policyname='service_write_signals') THEN
    CREATE POLICY "service_write_signals" ON public.user_action_signals FOR INSERT WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_signals_user_scan ON public.user_action_signals (user_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_signals_action_type ON public.user_action_signals (action_type);
CREATE INDEX IF NOT EXISTS idx_signals_role_score ON public.user_action_signals (scan_role, scan_score);
CREATE INDEX IF NOT EXISTS idx_signals_created ON public.user_action_signals (created_at DESC);

-- trajectory_predictions (compute-trajectory cache)
CREATE TABLE IF NOT EXISTS public.trajectory_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE UNIQUE,
  predicted_score_30d INTEGER,
  predicted_score_90d INTEGER,
  predicted_score_180d INTEGER,
  top_actions JSONB DEFAULT '[]',
  cohort_size INTEGER DEFAULT 0,
  cohort_median_delta INTEGER DEFAULT 0,
  confidence TEXT DEFAULT 'model' CHECK (confidence IN ('model','cohort','high')),
  computed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trajectory_predictions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trajectory_predictions' AND policyname='users_read_trajectory') THEN
    CREATE POLICY "users_read_trajectory" ON public.trajectory_predictions FOR SELECT USING (
      scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trajectory_predictions' AND policyname='service_write_trajectory') THEN
    CREATE POLICY "service_write_trajectory" ON public.trajectory_predictions FOR ALL WITH CHECK (true);
  END IF;
END $$;
