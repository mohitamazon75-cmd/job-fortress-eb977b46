-- D3.7: Tighten 3 overly-permissive RLS policies flagged by the linter.
-- These previously allowed anyone (anon role) to insert arbitrary rows.
-- After this migration, inserts must satisfy basic ownership/shape constraints.

-- ── 1. behavior_events ─────────────────────────────────────────────
-- Old: be_insert_any allowed ANY public insert with WITH CHECK (true).
-- New: anon may insert only rows with no user_id; authenticated users
--      may insert only rows attributed to themselves (or anonymous).
DROP POLICY IF EXISTS "be_insert_any" ON public.behavior_events;

CREATE POLICY "behavior_events_anon_insert"
  ON public.behavior_events
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "behavior_events_auth_insert"
  ON public.behavior_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ── 2. user_action_signals ─────────────────────────────────────────
-- Same pattern: only allow rows tied to the requester (or anonymous).
DROP POLICY IF EXISTS "uas_insert_any" ON public.user_action_signals;

CREATE POLICY "user_action_signals_anon_insert"
  ON public.user_action_signals
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "user_action_signals_auth_insert"
  ON public.user_action_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ── 3. scan_outcomes ───────────────────────────────────────────────
-- This table is written from email-link clicks (no JWT in some flows).
-- Tighten so the inserted row must reference an existing scan.
DROP POLICY IF EXISTS "outcome_insert_via_email_link" ON public.scan_outcomes;

CREATE POLICY "scan_outcomes_public_insert"
  ON public.scan_outcomes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    scan_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_outcomes.scan_id)
  );