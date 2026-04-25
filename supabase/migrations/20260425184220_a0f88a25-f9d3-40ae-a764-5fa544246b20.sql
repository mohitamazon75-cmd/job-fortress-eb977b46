-- PR2: Scale — add indexes on per-user growing tables to prevent seq_scans at 1k+ users.
-- All IF NOT EXISTS so this is safe to re-run. Tables are small today, so a brief lock is acceptable.

CREATE INDEX IF NOT EXISTS idx_model_b_results_user_id ON public.model_b_results (user_id);
CREATE INDEX IF NOT EXISTS idx_model_b_results_analysis_id ON public.model_b_results (analysis_id);
CREATE INDEX IF NOT EXISTS idx_model_b_results_user_created ON public.model_b_results (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_nudges_user_id ON public.coach_nudges (user_id);
CREATE INDEX IF NOT EXISTS idx_coach_nudges_scan_id ON public.coach_nudges (scan_id);
CREATE INDEX IF NOT EXISTS idx_coach_nudges_scheduled ON public.coach_nudges (scheduled_at) WHERE delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_score_history_user_created ON public.score_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_scan_id ON public.score_history (scan_id);

CREATE INDEX IF NOT EXISTS idx_share_events_assessment ON public.share_events (assessment_id);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON public.share_events (created_at DESC);

-- Composite for the dashboard's "my recent scans" lookup pattern
CREATE INDEX IF NOT EXISTS idx_scans_user_status_created ON public.scans (user_id, scan_status, created_at DESC);