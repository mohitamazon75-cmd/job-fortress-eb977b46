-- ═══════════════════════════════════════════════════════════════
-- IP #1: COHORT INTELLIGENCE ENGINE
-- pgvector-based peer comparison ("312 people like you in Bangalore
-- — 68% who learned cloud architecture improved score by 15+ pts")
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension (safe no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── scan_vectors: one row per scan, stores 16-dim feature vector ──
-- Dimensions (in order):
--  0  automation_risk / 100
--  1  stability_score / 100
--  2  doom_clock_months / 60           (capped at 1.0)
--  3  moat_score / 100
--  4  market_position / 100
--  5  seniority_tier  (0=ENTRY 0.25=MID 0.5=SENIOR 0.75=LEAD 1=EXECUTIVE)
--  6  experience_years / 30            (capped at 1.0)
--  7  ai_job_mentions_pct / 100
--  8  salary_percentile / 100
--  9  posting_change_norm              (0..1, centred at 0.5)
-- 10  role_cluster_a                   (sparse 1-hot bucket 0–5)
-- 11  role_cluster_b
-- 12  role_cluster_c
-- 13  industry_cluster_a               (sparse 1-hot bucket 0–4)
-- 14  industry_cluster_b
-- 15  city_tier                        (0 = tier-2, 1 = tier-1)
CREATE TABLE IF NOT EXISTS public.scan_vectors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding     vector(16) NOT NULL,
  -- Denormalised for fast cohort label generation (no joins needed in hot path)
  role_family   TEXT,
  industry      TEXT,
  city          TEXT,
  seniority     TEXT,
  stability_score INT,
  automation_risk INT,
  doom_months   INT,
  -- Re-scan delta — populated by validate-prediction when user re-scans
  delta_stability INT,        -- new_stability - old_stability (+ve = improved)
  delta_automation INT,       -- old_automation - new_automation (+ve = reduced risk)
  prior_scan_id UUID,         -- previous scan for this user (enables delta queries)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IVFFlat index for cosine similarity (fast ANN over 16-dim vectors)
-- nlist=50 works well for up to ~50k rows; bump to 100 once >100k rows
CREATE INDEX IF NOT EXISTS idx_scan_vectors_ivfflat
  ON public.scan_vectors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- Uniqueness: one vector per scan
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_vectors_scan_id
  ON public.scan_vectors(scan_id);

-- Fast lookup for per-user history
CREATE INDEX IF NOT EXISTS idx_scan_vectors_user_id
  ON public.scan_vectors(user_id, created_at DESC);

-- Fast cohort filtering (WHERE role_family = $1 AND city = $2)
CREATE INDEX IF NOT EXISTS idx_scan_vectors_cohort
  ON public.scan_vectors(role_family, city, seniority);

-- ── RLS: users can only read their own vectors ──
ALTER TABLE public.scan_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own vectors"
  ON public.scan_vectors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service role full access vectors"
  ON public.scan_vectors FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────
-- cohort_cache: precomputed "N people like you" summary rows
-- Refreshed nightly by a cron job / on-demand after each scan
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  cohort_size     INT NOT NULL DEFAULT 0,
  cohort_label    TEXT NOT NULL,            -- "Data Scientists in Bangalore"
  pct_improved    INT,                      -- % of cohort with +stability delta
  top_skill_gain  TEXT,                     -- most common skill learned by improvers
  median_doom_months INT,                   -- median doom clock in cohort
  median_stability INT,                     -- median stability score in cohort
  insight_text    TEXT,                     -- ready-to-render UI string
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cohort_cache_scan_id
  ON public.cohort_cache(scan_id);

ALTER TABLE public.cohort_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own cohort"
  ON public.cohort_cache FOR SELECT
  USING (
    scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
  );

CREATE POLICY "service role full access cohort"
  ON public.cohort_cache FOR ALL
  USING (auth.role() = 'service_role');
