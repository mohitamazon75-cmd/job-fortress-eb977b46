-- ═══════════════════════════════════════════════════════════════════════════
-- H-6: Fix ShareScan PII leak
--
-- Problem: ShareScan.tsx directly queries scans.final_json_report via the
-- anon SELECT policy (USING true), exposing the entire AI report blob to
-- anyone who knows a scan ID.  The share page only needs 3 safe fields:
-- score, role, industry.
--
-- Fix: Add a SECURITY DEFINER RPC that returns only those fields.  The
-- broader anon-can-read-any-scan-by-ID risk (the USING(true) policy) is a
-- known architectural issue — fixing it properly requires adding a
-- scan_token column and scoping realtime subscriptions; that is tracked as
-- a follow-up.  This migration eliminates the most egregious exposure
-- (bulk PII via final_json_report) for the share flow.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_scan_share_preview(scan_id UUID)
RETURNS TABLE (
  score       INTEGER,
  role        TEXT,
  industry    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report JSONB;
  v_role   TEXT;
  v_industry TEXT;
BEGIN
  SELECT
    final_json_report,
    role_detected,
    s.industry
  INTO v_report, v_role, v_industry
  FROM public.scans s
  WHERE s.id = scan_id;

  IF v_report IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    COALESCE(
      (v_report->>'career_position_score')::INTEGER,
      (v_report->>'replaceability_score')::INTEGER,
      50
    )::INTEGER AS score,
    COALESCE(v_report->>'matched_job_family', v_role, 'Professional') AS role,
    COALESCE(v_industry, 'Technology') AS industry;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_scan_share_preview(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_scan_share_preview(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_scan_share_preview(UUID) IS
  'Returns a minimal, PII-safe preview of a scan for the public share page. '
  'Never exposes final_json_report or other raw AI analysis data.';
