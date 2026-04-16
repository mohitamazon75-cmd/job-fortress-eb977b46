-- ═══════════════════════════════════════════════════════════════
-- Activate retention cron jobs — Issue 3-A
--
-- Schedules two fully-built but previously dormant edge functions:
--
--   1. score-change-notify   — Mon 9am IST (03:30 UTC)
--      Proactively emails users when their role's market signals
--      deteriorate or their industry sees layoff signals.
--      Rate-limited: max 1 email per user per 30 days.
--
--   2. generate-weekly-brief — Sun midnight IST (18:30 UTC Sat)
--      Generates personalised weekly career intelligence for each
--      user: India market shifts, AI tools threatening their role,
--      company signals. Requires PERPLEXITY_API_KEY env var.
--
-- Both functions already handle the cron call signature (they check
-- for the service role key to bypass Pro gating).
-- ═══════════════════════════════════════════════════════════════

-- Ensure pg_cron and pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 1. score-change-notify — Monday 9am IST = 03:30 UTC ──────────────────────
-- Proactive score-drift alerts. Fires when market signals for a user's role
-- have worsened by ≥3 DI points or posting_change_pct < -10% since their scan.
-- NOTE: Replace YOUR_SERVICE_ROLE_KEY with the actual key from
-- Supabase Dashboard → Settings → API → service_role key
-- Or set it first: ALTER DATABASE postgres SET app.service_role_key = 'your-key';
SELECT cron.schedule(
  'score-change-notify-weekly',
  '30 3 * * 1',  -- Mon 03:30 UTC = Mon 09:00 IST
  $$
    SELECT net.http_post(
      url := 'https://dlpeirtuaxydoyzwzdyz.supabase.co/functions/v1/score-change-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          current_setting('app.service_role_key', true),
          current_setting('app.settings.service_role_key', true)
        )
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ── 2. generate-weekly-brief — Sunday midnight IST = 18:30 UTC Sat ──────────
-- Weekly career intelligence brief. Requires PERPLEXITY_API_KEY env var.
-- If key is not configured, the function degrades gracefully (uses fallback).
SELECT cron.schedule(
  'generate-weekly-brief-sunday',
  '30 18 * * 6',  -- Sat 18:30 UTC = Sun 00:00 IST
  $$
    SELECT net.http_post(
      url := 'https://dlpeirtuaxydoyzwzdyz.supabase.co/functions/v1/generate-weekly-brief',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Verify schedules are registered
-- SELECT jobid, jobname, schedule, command FROM cron.job
-- WHERE jobname IN ('score-change-notify-weekly', 'generate-weekly-brief-sunday');




-- IP Improvement: outcome calibration — runs Mon 04:00 UTC (30 min after outcome follow-ups)
SELECT cron.unschedule('compute-outcome-calibration-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'compute-outcome-calibration-weekly'
);
SELECT cron.schedule(
  'compute-outcome-calibration-weekly',
  '0 4 * * 1',  -- Mon 04:00 UTC = Mon 09:30 IST (after sendOutcomeFollowUps at 03:30)
  $$
    SELECT net.http_post(
      url := 'https://dlpeirtuaxydoyzwzdyz.supabase.co/functions/v1/compute-outcome-calibration',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          current_setting('app.service_role_key', true),
          current_setting('app.settings.service_role_key', true)
        )
      ),
      body := '{}'::jsonb
    );
  $$
);