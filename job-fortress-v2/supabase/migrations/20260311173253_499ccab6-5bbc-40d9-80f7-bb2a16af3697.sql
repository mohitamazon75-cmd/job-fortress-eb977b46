
-- Coach nudges table for AI Career Coach follow-up system
CREATE TABLE public.coach_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  nudge_type text NOT NULL DEFAULT 'immediate', -- 'immediate', '24h', '48h'
  scheduled_at timestamp with time zone NOT NULL,
  delivered_at timestamp with time zone,
  seen_at timestamp with time zone,
  content jsonb, -- generated nudge content
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for scheduled job to find due nudges efficiently
CREATE INDEX idx_coach_nudges_due ON public.coach_nudges (scheduled_at) WHERE delivered_at IS NULL;
CREATE INDEX idx_coach_nudges_user ON public.coach_nudges (user_id, seen_at);

-- RLS
ALTER TABLE public.coach_nudges ENABLE ROW LEVEL SECURITY;

-- Users can read their own nudges
CREATE POLICY "Users read own nudges"
  ON public.coach_nudges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update seen_at on their own nudges
CREATE POLICY "Users mark nudges seen"
  ON public.coach_nudges FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role manages all nudges (insert, update from cron)
CREATE POLICY "Service role manages nudges"
  ON public.coach_nudges FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
