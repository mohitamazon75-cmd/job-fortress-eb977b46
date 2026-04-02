-- ═══════════════════════════════════════════════════════════════
-- Fix: Assessments Table Schema Conflict
--
-- Background: The initial migration (20260220032553) created
-- public.assessments for a children's health app with schema:
--   (id, user_id, child_id, type, answers, score, ...)
--
-- A later migration (20260225124047) created the Job Fortress
-- version of public.assessments with schema:
--   (id, session_id, industry, metro_tier, years_experience, ...)
--
-- On a fresh database, the second CREATE TABLE fails silently
-- (or keeps the wrong schema) if IF NOT EXISTS was used.
--
-- This migration detects which schema is present and ensures
-- the correct Job Fortress schema exists.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  has_old_schema BOOLEAN;
BEGIN
  -- Detect if this is the old children's app schema (has 'type' column)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessments'
      AND column_name = 'type'
  ) INTO has_old_schema;

  IF has_old_schema THEN
    -- Rename old schema table to avoid losing any data
    ALTER TABLE public.assessments RENAME TO legacy_kidsutra_assessments;
    RAISE NOTICE 'Renamed legacy assessments table to legacy_kidsutra_assessments';
  END IF;
END $$;

-- Ensure the Job Fortress assessments table exists with correct schema
CREATE TABLE IF NOT EXISTS public.assessments (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT    NOT NULL,
  industry        TEXT    NOT NULL,
  metro_tier      TEXT    NOT NULL,
  years_experience TEXT   NOT NULL,
  fate_score      INTEGER,
  status          TEXT    DEFAULT 'pending',
  matched_job_family TEXT,
  agent_1_disruption JSONB,
  agent_2_skills  JSONB,
  agent_3_market  JSONB,
  agent_4_verdict JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure RLS is enabled
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies from the old schema
DROP POLICY IF EXISTS "Users CRUD own assessments" ON public.assessments;

-- Correct policies for Job Fortress assessments
DO $$ BEGIN
  CREATE POLICY "Anyone can create assessments"
    ON public.assessments FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access to assessments"
    ON public.assessments FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for session_id lookups
CREATE INDEX IF NOT EXISTS idx_assessments_session_id ON public.assessments(session_id);
