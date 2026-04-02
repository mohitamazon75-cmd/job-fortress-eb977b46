
-- ═══════════════════════════════════════════════════════════════
-- Scalability: Hot-path indexes + scheduled cache purge jobs
-- ═══════════════════════════════════════════════════════════════

-- 1. ai_cache: fast expiry lookup (the most-queried table on every request)
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON public.ai_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_cache_key_expires ON public.ai_cache (cache_key, expires_at);

-- 2. future_blueprints: child_id + created_at for "latest blueprint" queries
CREATE INDEX IF NOT EXISTS idx_future_blueprints_child_created ON public.future_blueprints (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_future_blueprints_share_token ON public.future_blueprints (share_token) WHERE share_token IS NOT NULL;

-- 3. assessments: child_id is the primary join key
CREATE INDEX IF NOT EXISTS idx_assessments_child_id ON public.assessments (child_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id_completed ON public.assessments (user_id, completed_at DESC);

-- 4. reports: child_id + user_id for dashboard queries
CREATE INDEX IF NOT EXISTS idx_reports_child_id ON public.reports (child_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id_created ON public.reports (user_id, created_at DESC);

-- 5. blueprint_history: child_id + assessed_at for timeline charts
CREATE INDEX IF NOT EXISTS idx_blueprint_history_child_assessed ON public.blueprint_history (child_id, assessed_at DESC);

-- 6. discoverme_profiles: child_id (1:1 join)
CREATE INDEX IF NOT EXISTS idx_discoverme_profiles_child_id ON public.discoverme_profiles (child_id);

-- 7. shared_reports: token lookup + expiry check
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports (token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires_at ON public.shared_reports (expires_at);

-- 8. rate_limits: composite lookup key for RPC
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits (user_id, action);
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_key_action ON public.ip_rate_limits (ip_key, action);

-- 9. report_views: blueprint_id for analytics aggregation
CREATE INDEX IF NOT EXISTS idx_report_views_blueprint_id ON public.report_views (blueprint_id);

-- ── Scheduled purge jobs ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Purge expired ai_cache rows every day at 02:00 UTC
SELECT cron.schedule(
  'purge-expired-ai-cache',
  '0 2 * * *',
  $$SELECT public.purge_expired_ai_cache();$$
);

-- Purge expired shared_reports every day at 02:15 UTC
SELECT cron.schedule(
  'purge-expired-shared-reports',
  '15 2 * * *',
  $$SELECT public.purge_expired_shared_reports();$$
);

-- Purge stale rate_limit rows older than 24 hours every hour
SELECT cron.schedule(
  'purge-stale-rate-limits',
  '30 * * * *',
  $$
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '24 hours';
    DELETE FROM public.ip_rate_limits WHERE window_start < now() - interval '24 hours';
  $$
);
