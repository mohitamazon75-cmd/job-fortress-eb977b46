-- Week 2 #2: Score history table for delta tracking
CREATE TABLE public.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  determinism_index integer NOT NULL,
  survivability_score integer,
  moat_score integer,
  role_detected text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: users read own history
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own score history"
  ON public.score_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages score history"
  ON public.score_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_score_history_user ON public.score_history(user_id, created_at DESC);

-- Week 2 #6: Cache TTL cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.enrichment_cache 
  WHERE cached_at < now() - interval '7 days';
END;
$$;