
-- ── PulseCheck Beta: Students ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_beta_students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name   TEXT NOT NULL,
  year_group   TEXT,
  parent_name  TEXT,
  parent_email TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pulse_beta_students ENABLE ROW LEVEL SECURITY;

-- Permissive anon policy (beta feature — no auth required)
CREATE POLICY "anon_all_students"
  ON public.pulse_beta_students
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── PulseCheck Beta: Scans ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_beta_scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.pulse_beta_students(id) ON DELETE CASCADE,
  dominant_emotion  TEXT NOT NULL,
  wellness_score    INTEGER NOT NULL CHECK (wellness_score >= 0 AND wellness_score <= 100),
  wellness_zone     TEXT NOT NULL,
  expressions       JSONB,
  scanned_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_scans_student_id   ON public.pulse_beta_scans (student_id);
CREATE INDEX IF NOT EXISTS idx_pulse_scans_scanned_at   ON public.pulse_beta_scans (scanned_at DESC);

ALTER TABLE public.pulse_beta_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_scans"
  ON public.pulse_beta_scans
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── PulseCheck Beta: Alerts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_beta_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.pulse_beta_students(id) ON DELETE CASCADE,
  trigger_scan_id UUID REFERENCES public.pulse_beta_scans(id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL,
  zone            TEXT NOT NULL,
  message         TEXT NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_alerts_student_id ON public.pulse_beta_alerts (student_id);
CREATE INDEX IF NOT EXISTS idx_pulse_alerts_resolved   ON public.pulse_beta_alerts (resolved);

ALTER TABLE public.pulse_beta_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_alerts"
  ON public.pulse_beta_alerts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
