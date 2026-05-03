
CREATE TABLE IF NOT EXISTS public.business_autopsy_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL,
  score integer NOT NULL,
  band text NOT NULL,
  autopsy jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_autopsy_scan ON public.business_autopsy_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_business_autopsy_user ON public.business_autopsy_results(user_id, created_at DESC);

ALTER TABLE public.business_autopsy_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own autopsy"
ON public.business_autopsy_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own autopsy"
ON public.business_autopsy_results FOR INSERT
WITH CHECK (auth.uid() = user_id);
