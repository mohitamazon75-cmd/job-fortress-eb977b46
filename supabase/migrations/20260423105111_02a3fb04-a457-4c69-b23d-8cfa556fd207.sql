-- ──────────────────────────────────────────────────────────────
-- Cached learning bundles per blind-spot fingerprint
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_resources_cache (
  cache_key text PRIMARY KEY,
  gap_title text NOT NULL,
  role_context text,
  bundle jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'ai_gateway',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_lrc_expires ON public.learning_resources_cache (expires_at);

ALTER TABLE public.learning_resources_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read learning cache"
ON public.learning_resources_cache FOR SELECT
USING (true);

-- writes go through the service role only (no INSERT/UPDATE policies for anon)

-- ──────────────────────────────────────────────────────────────
-- Per-user, per-scan learning progress
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  gap_key text NOT NULL,
  gap_title text NOT NULL,
  severity text,
  resource_url text,
  marked_complete_at timestamptz,
  score_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scan_id, gap_key)
);

CREATE INDEX IF NOT EXISTS idx_lpp_user_scan ON public.learning_path_progress (user_id, scan_id);

ALTER TABLE public.learning_path_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own learning progress"
ON public.learning_path_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all learning progress"
ON public.learning_path_progress FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own learning progress"
ON public.learning_path_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own learning progress"
ON public.learning_path_progress FOR UPDATE
USING (auth.uid() = user_id);