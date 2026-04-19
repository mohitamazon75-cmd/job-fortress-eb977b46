-- ══════════════════════════════════════════════════════════════════════
-- Sprint C1: Career Reality Check (8th card) — schema additions
-- Spec: docs/claude-code/SPRINT_C1_CAREER_REALITY_CHECK.md §8 Task 1
--
-- Adds:
--   • public.cohort_data            — peer layer, one row per completed scan
--   • public.crc_learning_resources — manually curated vetted learning links
--   • public.feature_flags          — runtime toggles (seeded with Sprint C1 flag, OFF)
--   • public.cohort_market_cache    — Firecrawl/Tavily response cache (TTL'd)
--   • scans.career_reality_check_data (JSONB, nullable, no backfill)
--
-- Does NOT touch:
--   • existing public.learning_resources (Tavily cache for defense milestones)
--   • existing public.cohort_cache       (peer summary aggregates)
--   • scoring-engine / agent-prompt / payment files (per CLAUDE.md §1 Rule 3)
--
-- Reuses public.update_updated_at_column() defined in 20260220032553.
--
-- Reverse migration (data loss acceptable — feature is flag-gated, default OFF,
-- no production users on these surfaces yet):
--   DROP TRIGGER IF EXISTS update_cohort_market_cache_updated_at    ON public.cohort_market_cache;
--   DROP TRIGGER IF EXISTS update_feature_flags_updated_at          ON public.feature_flags;
--   DROP TRIGGER IF EXISTS update_crc_learning_resources_updated_at ON public.crc_learning_resources;
--   DROP TRIGGER IF EXISTS update_cohort_data_updated_at            ON public.cohort_data;
--   DROP TABLE IF EXISTS public.cohort_market_cache;
--   DROP TABLE IF EXISTS public.feature_flags;
--   DROP TABLE IF EXISTS public.crc_learning_resources;
--   DROP TABLE IF EXISTS public.cohort_data;
--   ALTER TABLE public.scans DROP COLUMN IF EXISTS career_reality_check_data;
-- ══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- Table 1: cohort_data
-- One row per completed scan; powers peer-cohort aggregates in Act 1.
-- Nullable user_id (anon scans allowed) with ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_data (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role           text NOT NULL,
  city           text NOT NULL,
  exp_band       text NOT NULL,                             -- "0-1" | "2-3" | "4-6" | "7-10" | "10+"
  tools          jsonb NOT NULL DEFAULT '[]'::jsonb,        -- Q1 multi-select
  ai_tools_used  jsonb NOT NULL DEFAULT '[]'::jsonb,        -- Q2 multi-select
  commit_recency text,                                      -- Q3 single-select
  job_nature     text,                                      -- Q4 single-select
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_data_cohort
  ON public.cohort_data(role, city, exp_band);

CREATE INDEX IF NOT EXISTS idx_cohort_data_user
  ON public.cohort_data(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.cohort_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cohort row"
  ON public.cohort_data FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages cohort_data"
  ON public.cohort_data FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_cohort_data_updated_at
  BEFORE UPDATE ON public.cohort_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────
-- Table 2: crc_learning_resources
-- Manually curated, pre-vetted links for the "20-minute learn" field in Act 2.
-- NAMED `crc_*` to avoid collision with existing public.learning_resources
-- (which is a Tavily cache used by supabase/functions/generate-milestones).
-- Seed data ships in a SEPARATE later migration.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crc_learning_resources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name            text NOT NULL,        -- lowercased; matches Naukri normalization
  resource_url          text NOT NULL,
  resource_title        text NOT NULL,
  resource_duration_min integer,
  curated_at            timestamptz NOT NULL DEFAULT now(),   -- when the link was last manually vetted
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_name, resource_url)
);

CREATE INDEX IF NOT EXISTS idx_crc_learning_resources_skill
  ON public.crc_learning_resources(skill_name);

ALTER TABLE public.crc_learning_resources ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.crc_learning_resources TO authenticated, anon;

CREATE POLICY "Public read crc_learning_resources"
  ON public.crc_learning_resources FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role manages crc_learning_resources"
  ON public.crc_learning_resources FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_crc_learning_resources_updated_at
  BEFORE UPDATE ON public.crc_learning_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────
-- Table 3: feature_flags
-- Runtime toggles (checked by edge functions + frontend useFeatureFlag hook).
-- Admin writes via Supabase direct for v1; no admin UI.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name            text NOT NULL UNIQUE,
  enabled_for_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  enabled_percentage   integer NOT NULL DEFAULT 0
                       CHECK (enabled_percentage BETWEEN 0 AND 100),
  description          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.feature_flags TO authenticated, anon;

CREATE POLICY "Public read feature_flags"
  ON public.feature_flags FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Service role manages feature_flags"
  ON public.feature_flags FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Sprint C1 flag, default OFF
INSERT INTO public.feature_flags (flag_name, enabled_percentage, description)
VALUES (
  'enable_career_reality_check',
  0,
  'Sprint C1 — 8th card (Career Reality Check). Default OFF; whitelist via enabled_for_user_ids or ramp via enabled_percentage.'
)
ON CONFLICT (flag_name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- Table 4: cohort_market_cache
-- Firecrawl/Tavily response cache for Naukri/Ambitionbox/Glassdoor-IN.
-- Distinct from existing public.cohort_cache (peer aggregates).
-- Service-role only (internal scraper cache, never exposed to clients).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_market_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  text NOT NULL UNIQUE,           -- e.g. "naukri:fullstack:bengaluru:2-6"
  source     text NOT NULL,                  -- "naukri" | "ambitionbox" | "glassdoor_in"
  payload    jsonb NOT NULL,                 -- normalized JSON per source
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohort_market_cache_lookup
  ON public.cohort_market_cache(cache_key, expires_at);

CREATE INDEX IF NOT EXISTS idx_cohort_market_cache_source
  ON public.cohort_market_cache(source);

ALTER TABLE public.cohort_market_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cohort_market_cache"
  ON public.cohort_market_cache FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_cohort_market_cache_updated_at
  BEFORE UPDATE ON public.cohort_market_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────
-- scans: add Career Reality Check payload column
-- Nullable, no default, no backfill of existing rows.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS career_reality_check_data JSONB;
