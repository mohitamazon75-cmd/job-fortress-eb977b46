-- user_action_signals
CREATE TABLE IF NOT EXISTS public.user_action_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  scan_id uuid,
  action_type text NOT NULL,
  action_payload jsonb DEFAULT '{}'::jsonb,
  scan_role text,
  scan_industry text,
  scan_score numeric,
  scan_city text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uas_scan ON public.user_action_signals(scan_id);
CREATE INDEX IF NOT EXISTS idx_uas_user ON public.user_action_signals(user_id);
ALTER TABLE public.user_action_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uas_insert_any" ON public.user_action_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "uas_select_own" ON public.user_action_signals FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- trajectory_predictions
CREATE TABLE IF NOT EXISTS public.trajectory_predictions (
  scan_id uuid PRIMARY KEY,
  predicted_score_30d numeric,
  predicted_score_90d numeric,
  predicted_score_180d numeric,
  top_actions jsonb DEFAULT '[]'::jsonb,
  cohort_size integer DEFAULT 0,
  cohort_median_delta numeric,
  confidence text DEFAULT 'model',
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trajectory_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select_all" ON public.trajectory_predictions FOR SELECT USING (true);

-- behavior_events
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  scan_id uuid,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_be_scan ON public.behavior_events(scan_id);
CREATE INDEX IF NOT EXISTS idx_be_user ON public.behavior_events(user_id);
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "be_insert_any" ON public.behavior_events FOR INSERT WITH CHECK (true);
CREATE POLICY "be_select_own" ON public.behavior_events FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- score_events
CREATE TABLE IF NOT EXISTS public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid,
  event_type text NOT NULL,
  delta numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_se_user ON public.score_events(user_id);
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "se_insert_own" ON public.score_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "se_select_own" ON public.score_events FOR SELECT USING (auth.uid() = user_id);