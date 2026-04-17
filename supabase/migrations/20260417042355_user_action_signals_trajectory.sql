-- ═══════════════════════════════════════════════════════════════
-- user_action_signals + trajectory_predictions
-- The behavioral flywheel that makes JobBachao learn from users.
-- ═══════════════════════════════════════════════════════════════

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

CREATE INDEX IF NOT EXISTS idx_signals_user_scan ON public.user_action_signals (user_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_signals_action_type ON public.user_action_signals (action_type);
CREATE INDEX IF NOT EXISTS idx_signals_role_score ON public.user_action_signals (scan_role, scan_score);
CREATE INDEX IF NOT EXISTS idx_signals_created ON public.user_action_signals (created_at DESC);

ALTER TABLE public.user_action_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_signals" ON public.user_action_signals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_write_signals" ON public.user_action_signals FOR INSERT WITH CHECK (true);

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
CREATE POLICY "users_read_trajectory" ON public.trajectory_predictions FOR SELECT USING (
  scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
);
CREATE POLICY "service_write_trajectory" ON public.trajectory_predictions FOR ALL WITH CHECK (true);
