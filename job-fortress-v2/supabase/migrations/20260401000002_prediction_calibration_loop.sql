-- ═══════════════════════════════════════════════════════════════
-- IP #2: PREDICTION CALIBRATION LOOP
-- Store doom clock / obsolescence predictions at scan time.
-- On re-scan, validate actual vs predicted, feed error back
-- to calibrate CALIBRATION.OBSOLESCENCE_AI_ACCELERATION_RATE.
-- ═══════════════════════════════════════════════════════════════

-- ── skill_predictions: one row per predicted skill risk ──
CREATE TABLE IF NOT EXISTS public.skill_predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id             UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name          TEXT NOT NULL,
  predicted_risk_score INT NOT NULL CHECK (predicted_risk_score BETWEEN 0 AND 100),
  predicted_half_life_months INT NOT NULL,   -- months until 50% relevance loss predicted
  doom_clock_months   INT NOT NULL,          -- overall doom clock at scan time
  model_version       TEXT NOT NULL DEFAULT 'v3.3',   -- deterministic engine version used
  calibration_input   JSONB,                -- snapshot of key CALIBRATION constants used
  predicted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Validation fields — populated when user re-scans
  validated           BOOLEAN NOT NULL DEFAULT false,
  validated_at        TIMESTAMPTZ,
  actual_risk_score   INT,                  -- actual risk at re-scan
  actual_half_life_months INT,
  error_pct           NUMERIC(6,2),         -- abs((predicted - actual) / actual * 100)
  direction_correct   BOOLEAN,              -- did we correctly predict rising/falling?
  months_elapsed      INT                   -- how many months between prediction and validation
);

CREATE INDEX IF NOT EXISTS idx_skill_predictions_scan_id
  ON public.skill_predictions(scan_id);

CREATE INDEX IF NOT EXISTS idx_skill_predictions_user_id
  ON public.skill_predictions(user_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_predictions_validation
  ON public.skill_predictions(validated, predicted_at)
  WHERE validated = false;

ALTER TABLE public.skill_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own predictions"
  ON public.skill_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service role full access predictions"
  ON public.skill_predictions FOR ALL
  USING (auth.role() = 'service_role');

-- ── calibration_log: aggregate validation results → calibration adjustments ──
CREATE TABLE IF NOT EXISTS public.calibration_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version         TEXT NOT NULL,
  sample_size           INT NOT NULL,                  -- validations used
  mean_error_pct        NUMERIC(6,2),                  -- mean absolute % error
  direction_accuracy    NUMERIC(5,2),                  -- % where direction was correct
  suggested_accel_rate  NUMERIC(8,6),                  -- recommended CALIBRATION constant
  current_accel_rate    NUMERIC(8,6),                  -- what was deployed at the time
  delta                 NUMERIC(8,6),                  -- suggested - current
  applied               BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_calibration_log_computed_at
  ON public.calibration_log(computed_at DESC);

-- ── calibration_config: live-writable override for CALIBRATION constants ──
-- Edge functions read this table at startup to patch their local CALIBRATION object.
-- The deterministic-engine.ts constants remain the compile-time default (fallback).
CREATE TABLE IF NOT EXISTS public.calibration_config (
  key     TEXT PRIMARY KEY,
  value   NUMERIC(12,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT 'system',  -- 'system' | 'admin'
  note    TEXT
);

-- Seed with the current compile-time defaults so admin can see them
INSERT INTO public.calibration_config (key, value, note) VALUES
  ('OBSOLESCENCE_AI_ACCELERATION_RATE',  0.12,  'McKinsey 2024 conservative — 12% annual compression'),
  ('OBSOLESCENCE_BASE_MONTHS',           60,    'Maximum months at 0 risk'),
  ('OBSOLESCENCE_RANGE',                 50,    'Power curve month subtraction range'),
  ('CALIBRATION_VERSION',                3.3,   'deterministic-engine.ts version')
ON CONFLICT (key) DO NOTHING;

-- RLS: public read (edge functions use anon key for reads), service_role for writes
ALTER TABLE public.calibration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read calibration config"
  ON public.calibration_config FOR SELECT
  USING (true);

CREATE POLICY "service role writes calibration config"
  ON public.calibration_config FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.calibration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access calibration log"
  ON public.calibration_log FOR ALL
  USING (auth.role() = 'service_role');
