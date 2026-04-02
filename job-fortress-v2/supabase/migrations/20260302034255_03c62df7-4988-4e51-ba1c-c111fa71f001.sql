
-- ─── Atomic rate limiter SQL function ─────────────────────────────────────────
-- Uses advisory locking + atomic upsert to prevent race conditions on concurrent
-- requests. Returns (allowed boolean, current_count int).
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key        text,      -- unique identifier: 'user:<uuid>:action' or 'ip:<ip>:action'
  p_action     text,
  p_max        integer,
  p_window_sec integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        integer;
  v_now          timestamptz := now();
BEGIN
  -- Acquire advisory lock keyed on (key, action) to serialise concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext(p_key || ':' || p_action));

  -- Attempt to read existing row
  SELECT rl.count, rl.window_start
    INTO v_count, v_window_start
    FROM public.rate_limits rl
   WHERE rl.user_id::text = p_key
     AND rl.action = p_action
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND OR (v_now - v_window_start) > (p_window_sec || ' seconds')::interval THEN
    -- No record or window expired — start fresh
    INSERT INTO public.rate_limits (user_id, action, count, window_start)
    VALUES (
      CASE WHEN p_key ~ '^[0-9a-f-]{36}$' THEN p_key::uuid ELSE gen_random_uuid() END,
      p_action,
      1,
      v_now
    )
    ON CONFLICT (user_id, action) DO UPDATE
      SET count = 1, window_start = v_now;

    RETURN QUERY SELECT true, 1;
    RETURN;
  END IF;

  IF v_count >= p_max THEN
    RETURN QUERY SELECT false, v_count;
    RETURN;
  END IF;

  -- Increment atomically
  UPDATE public.rate_limits
     SET count = count + 1
   WHERE user_id::text = p_key
     AND action = p_action;

  RETURN QUERY SELECT true, v_count + 1;
END;
$$;

-- ─── IP-keyed rate limit table for non-user callers (shared-token endpoint) ──
-- We repurpose rate_limits but store ip hash as a uuid-shaped key.
-- To handle arbitrary IP strings, we add a separate ip_rate_limits table.
CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_key       text NOT NULL,
  action       text NOT NULL,
  count        integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_key, action)
);

ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies — only service_role (edge functions) can access this table.

CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_key_action
  ON public.ip_rate_limits (ip_key, action);

-- Atomic IP rate limit function
CREATE OR REPLACE FUNCTION public.check_and_increment_ip_rate_limit(
  p_ip_key     text,
  p_action     text,
  p_max        integer,
  p_window_sec integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        integer;
  v_now          timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ip_key || ':' || p_action));

  SELECT rl.count, rl.window_start
    INTO v_count, v_window_start
    FROM public.ip_rate_limits rl
   WHERE rl.ip_key = p_ip_key
     AND rl.action = p_action
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND OR (v_now - v_window_start) > (p_window_sec || ' seconds')::interval THEN
    INSERT INTO public.ip_rate_limits (ip_key, action, count, window_start)
    VALUES (p_ip_key, p_action, 1, v_now)
    ON CONFLICT (ip_key, action) DO UPDATE
      SET count = 1, window_start = v_now;

    RETURN QUERY SELECT true, 1;
    RETURN;
  END IF;

  IF v_count >= p_max THEN
    RETURN QUERY SELECT false, v_count;
    RETURN;
  END IF;

  UPDATE public.ip_rate_limits
     SET count = count + 1
   WHERE ip_key = p_ip_key
     AND action = p_action;

  RETURN QUERY SELECT true, v_count + 1;
END;
$$;
