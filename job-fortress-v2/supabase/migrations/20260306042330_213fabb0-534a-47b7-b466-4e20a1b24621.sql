-- ══════════════════════════════════════════════════════════════════════
-- PRODUCTION HARDENING: Beta Launch Security + Performance
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Performance indexes for beta scale (5-10k users) ──────────────

-- Index: assessments lookup by child_id+user_id (loadChildAssessments hot path)
CREATE INDEX IF NOT EXISTS idx_assessments_child_user 
  ON public.assessments(child_id, user_id);

-- Index: reports by child_id + created_at DESC (most-recent report query)
CREATE INDEX IF NOT EXISTS idx_reports_child_created 
  ON public.reports(child_id, user_id, created_at DESC);

-- Index: shared_reports token lookup (validate-shared-token edge function)
CREATE INDEX IF NOT EXISTS idx_shared_reports_token 
  ON public.shared_reports(token);

-- Index: children by user_id + created_at (loadUserData query)
CREATE INDEX IF NOT EXISTS idx_children_user_id 
  ON public.children(user_id, created_at ASC);

-- Index: rate_limits atomic increment hot path
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
  ON public.rate_limits(user_id, action, window_start);

-- Index: ip_rate_limits atomic increment hot path
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_key_action 
  ON public.ip_rate_limits(ip_key, action, window_start);

-- Index: feedback lookup by user_id
CREATE INDEX IF NOT EXISTS idx_feedback_user_id 
  ON public.feedback(user_id);

-- ── 2. ai_cache TTL maintenance — add index for purge job ─────────────
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires 
  ON public.ai_cache(expires_at);

-- ── 3. shared_reports expiry index for purge + RLS policy ─────────────
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires 
  ON public.shared_reports(expires_at);