CREATE TABLE public.sector_pulse_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  city TEXT NOT NULL,
  beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sector_pulse_cache_unique UNIQUE (sector, city)
);

CREATE INDEX idx_sector_pulse_cache_lookup ON public.sector_pulse_cache (sector, city, fetched_at DESC);

ALTER TABLE public.sector_pulse_cache ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read cache entries — it's curated public news, not user data.
CREATE POLICY "Sector pulse cache is readable by everyone"
  ON public.sector_pulse_cache
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies → only service_role can write (which bypasses RLS).
-- This is intentional: edge functions write via service role; clients can only read.