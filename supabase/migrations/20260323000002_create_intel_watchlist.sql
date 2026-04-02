-- Phase D: Intel watchlist for user-saved signals
CREATE TABLE IF NOT EXISTS public.intel_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_json jsonb NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intel_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist" ON public.intel_watchlist
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_intel_watchlist_user
  ON public.intel_watchlist(user_id, added_at DESC);
