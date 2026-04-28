-- DPDP Phase B: 90-day auto-purge for resume_artifacts + linkedin_snapshots
-- where data_retention_consent=false. Runs daily via pg_cron.
--
-- Rationale: scans.data_retention_consent governs retention. When user opts in,
-- we keep raw_text + parsed_json indefinitely for ML/insights ("goldmine").
-- When user does NOT opt in (default), we MUST delete the heavy raw artifacts
-- after 90 days to honor DPDP Act + the on-page promise.

CREATE OR REPLACE FUNCTION public.purge_unconsented_artifacts()
RETURNS TABLE(resume_artifacts_deleted bigint, linkedin_snapshots_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resume_count bigint := 0;
  v_linkedin_count bigint := 0;
BEGIN
  -- Purge resume_artifacts where consent was never granted and row is >90 days old
  WITH deleted AS (
    DELETE FROM public.resume_artifacts
    WHERE data_retention_consent = false
      AND created_at < (now() - interval '90 days')
    RETURNING id
  )
  SELECT count(*) INTO v_resume_count FROM deleted;

  -- Purge linkedin_snapshots where consent was never granted and row is >90 days old
  WITH deleted AS (
    DELETE FROM public.linkedin_snapshots
    WHERE data_retention_consent = false
      AND created_at < (now() - interval '90 days')
    RETURNING id
  )
  SELECT count(*) INTO v_linkedin_count FROM deleted;

  -- Audit trail
  INSERT INTO public.edge_function_logs (function_name, status, error_message, request_meta)
  VALUES (
    'purge_unconsented_artifacts',
    'success',
    NULL,
    jsonb_build_object(
      'resume_artifacts_deleted', v_resume_count,
      'linkedin_snapshots_deleted', v_linkedin_count,
      'cutoff', (now() - interval '90 days')
    )
  );

  RETURN QUERY SELECT v_resume_count, v_linkedin_count;
END;
$$;

-- Schedule daily at 03:30 UTC (09:00 IST) — low-traffic window for India
SELECT cron.schedule(
  'purge-unconsented-artifacts-daily',
  '30 3 * * *',
  $$ SELECT public.purge_unconsented_artifacts(); $$
);