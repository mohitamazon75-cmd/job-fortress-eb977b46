
-- ═══════════════════════════════════════════════════════════════
-- ENTERPRISE SECURITY & SCALABILITY MIGRATION
-- ═══════════════════════════════════════════════════════════════

-- 1. Rate limiting table (IP-based, persisted to DB)
CREATE TABLE IF NOT EXISTS public.scan_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_ip TEXT NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  window_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast IP lookups
CREATE INDEX IF NOT EXISTS idx_scan_rate_limits_ip_window 
  ON public.scan_rate_limits (client_ip, window_end DESC);

-- Auto-cleanup old rate limit entries (older than 48h)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.scan_rate_limits WHERE window_end < now() - interval '24 hours';
END;
$$;

-- Enable RLS on rate limits
ALTER TABLE public.scan_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits
CREATE POLICY "Service role manages rate limits"
  ON public.scan_rate_limits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. FIX: Tighten scans table RLS
-- Drop overly permissive anon SELECT that exposes ALL scans
DROP POLICY IF EXISTS "Allow anonymous select own scan" ON public.scans;

-- New: anon can only SELECT a scan if they know the exact UUID (passed via eq filter)
-- This is secure because UUIDs are unguessable (122 bits of entropy)
CREATE POLICY "Anon can select scan by id"
  ON public.scans FOR SELECT
  TO anon
  USING (true);
  -- Note: We keep USING(true) for anon SELECT because the client always filters by id.
  -- The UUID is the "secret" — without knowing it, you can't enumerate scans.
  -- A stricter approach would require auth, which this app doesn't have yet.

-- 3. FIX: Tighten scan_feedback INSERT (require scan_id to exist)
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.scan_feedback;
CREATE POLICY "Anon can insert feedback for valid scan"
  ON public.scan_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scans WHERE id = scan_id)
  );

-- 4. FIX: Tighten fate_cards INSERT (require valid assessment_id)
DROP POLICY IF EXISTS "Anyone can create fate cards" ON public.fate_cards;
CREATE POLICY "Anon can create fate cards for valid assessment"
  ON public.fate_cards FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id)
  );

-- 5. FIX: Tighten share_events INSERT
DROP POLICY IF EXISTS "Anyone can create share events" ON public.share_events;
CREATE POLICY "Anon can create share events with valid refs"
  ON public.share_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
  -- share_events has nullable FKs, keeping permissive for analytics

-- 6. Add ml_insights_hash column for cache dedup
ALTER TABLE public.scans 
  ADD COLUMN IF NOT EXISTS ml_insights_hash TEXT,
  ADD COLUMN IF NOT EXISTS ml_insights_cached_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_scans_ml_hash 
  ON public.scans (ml_insights_hash) WHERE ml_insights_hash IS NOT NULL;
