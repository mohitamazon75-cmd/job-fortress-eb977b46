-- ═══════════════════════════════════════════════════════════════
-- DPDP 90-day retention — daily purge cron (BL-015)
--
-- Calls purge-expired-scans every day at 02:00 UTC. The edge
-- function authenticates with the service role key and deletes
-- any scan (and its satellites) older than 90 days.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any prior instance so this migration is rerunnable.
SELECT cron.unschedule('purge-expired-scans-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-scans-daily'
);

SELECT cron.schedule(
  'purge-expired-scans-daily',
  '0 2 * * *',  -- 02:00 UTC = 07:30 IST every day
  $$
    SELECT net.http_post(
      url := 'https://dlpeirtuaxydoyzwzdyz.supabase.co/functions/v1/purge-expired-scans',
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