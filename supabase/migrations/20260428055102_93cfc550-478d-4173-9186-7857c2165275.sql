CREATE TABLE public.cost_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  cost_inr_paise BIGINT NOT NULL CHECK (cost_inr_paise >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_events_scan_id ON public.cost_events(scan_id);
CREATE INDEX idx_cost_events_created_at ON public.cost_events(created_at DESC);
CREATE INDEX idx_cost_events_function ON public.cost_events(function_name, created_at DESC);

ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all cost events
CREATE POLICY "Admins read cost_events"
  ON public.cost_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies for normal users.
-- Service-role inserts bypass RLS by design — edge functions write costs server-side.