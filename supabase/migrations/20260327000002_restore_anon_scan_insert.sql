-- ============================================================
-- Restore safe anonymous INSERT on scans table
-- ============================================================
-- Migration 20260309140336 removed "Allow anonymous insert" to prevent
-- injection.  However the app relies on anonymous scan creation (users
-- do not need to be logged in to get their scan).  This migration adds
-- back a SAFE variant: anon users can only insert rows where user_id IS
-- NULL, preventing them from claiming another user's account.
-- ============================================================

DROP POLICY IF EXISTS "Allow anonymous insert" ON public.scans;
DROP POLICY IF EXISTS "Anon can insert scan without user_id" ON public.scans;

CREATE POLICY "Anon can insert scan without user_id"
  ON public.scans
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
