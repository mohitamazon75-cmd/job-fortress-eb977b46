
-- Rate limits table (replaces in-memory Map — survives cold starts)
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, action)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role (edge functions) can access

-- Admin sessions table (replaces raw password re-transmission)
CREATE TABLE public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'),
  ip_hint text
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role can access

-- Admin login attempt tracking (brute force protection)
CREATE TABLE public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hint text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role can access

-- Index for fast brute force lookups
CREATE INDEX idx_admin_login_attempts_ip_recent 
ON public.admin_login_attempts (ip_hint, attempted_at DESC);

-- Index for rate limit lookups
CREATE INDEX idx_rate_limits_user_action 
ON public.rate_limits (user_id, action);
