-- ═══════════════════════════════════════════════════════════════
-- IP Improvement: Outcome Calibration Curves + Semantic Embeddings
-- ═══════════════════════════════════════════════════════════════

-- 1. outcome_calibration_curves
-- Weekly cron writes DI-bucket × segment action rates.
-- Patches calibration_config when sample_size ≥ 30.
CREATE TABLE IF NOT EXISTS public.outcome_calibration_curves (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  di_bucket_min            INT NOT NULL,
  di_bucket_max            INT NOT NULL,
  role_category            TEXT,        -- null = all roles
  industry                 TEXT,        -- null = all industries
  sample_size              INT NOT NULL,
  action_rate              NUMERIC(5,4) NOT NULL,  -- % who took action
  got_interview_rate       NUMERIC(5,4),
  upskilling_rate          NUMERIC(5,4),
  calibration_error        NUMERIC(6,3), -- expected − actual
  suggested_di_floor_delta NUMERIC(5,2), -- DI floor nudge (capped ±5)
  UNIQUE(di_bucket_min, di_bucket_max, role_category, industry,
         date_trunc('week', computed_at))
);

CREATE INDEX IF NOT EXISTS idx_occ_bucket_segment
  ON public.outcome_calibration_curves
  (di_bucket_min, role_category, industry, computed_at DESC);

ALTER TABLE public.outcome_calibration_curves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_occ" ON public.outcome_calibration_curves
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read_occ" ON public.outcome_calibration_curves
  FOR SELECT TO authenticated USING (true);

-- 2. Semantic embedding column on scan_vectors
-- Runs alongside existing 16-dim — non-breaking additive upgrade.
ALTER TABLE public.scan_vectors
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS semantic_model     TEXT DEFAULT 'text-embedding-3-small';

CREATE INDEX IF NOT EXISTS idx_scan_vectors_semantic_hnsw
  ON public.scan_vectors
  USING hnsw (semantic_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE semantic_embedding IS NOT NULL;

COMMENT ON COLUMN public.scan_vectors.semantic_embedding IS
  '1536-dim text-embedding-3-small of concise profile text. ~$0.000002/scan via Lovable gateway.';
