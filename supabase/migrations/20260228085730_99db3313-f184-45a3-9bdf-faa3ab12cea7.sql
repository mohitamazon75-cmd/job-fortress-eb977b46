
CREATE TABLE public.weekly_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL,
  brief_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed — this is a public-facing feature without auth
ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of weekly briefs"
  ON public.weekly_briefs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role insert"
  ON public.weekly_briefs
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_weekly_briefs_scan_id ON public.weekly_briefs(scan_id);
CREATE INDEX idx_weekly_briefs_created_at ON public.weekly_briefs(created_at DESC);
