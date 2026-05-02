-- Observability columns for scan failures, driven by Path C postmortem 2026-05-02.
-- One scan failed silently with no logs; we could not attribute the failure to
-- any pipeline stage. These columns let process-scan / edge fns stamp where
-- and why a scan died, without touching final_json_report shape.
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS failure_stage text;

-- Helpful for the admin debug page + cohort failure queries.
CREATE INDEX IF NOT EXISTS idx_scans_failure_stage
  ON public.scans (failure_stage)
  WHERE failure_stage IS NOT NULL;

COMMENT ON COLUMN public.scans.error_message IS
  'Free-text error captured when scan_status transitions to failed. Set by process-scan or peripheral edge fns. Nullable on success.';
COMMENT ON COLUMN public.scans.failure_stage IS
  'Pipeline stage where the failure occurred: parse_resume | agent1 | agent2a | agent2b | agent2c | judo | persist | unknown. Nullable on success.';