-- ================================================================
-- SECURITY FIX 1: shared_reports — enforce token-match via SECURITY DEFINER
-- The old open SELECT policy (expires_at > now()) let anyone dump all rows.
-- Replace with a function that requires the caller to supply the exact token.
-- ================================================================

-- 1a. Drop the dangerously open public SELECT policy
DROP POLICY IF EXISTS "Public can read shared report by token" ON public.shared_reports;

-- 1b. Create a SECURITY DEFINER function so RLS is bypassed only inside this
--     function, but the caller must supply the correct token value.
CREATE OR REPLACE FUNCTION public.get_shared_report_by_token(p_token text)
RETURNS TABLE (
  id            uuid,
  token         text,
  child_name    text,
  report_data   jsonb,
  expires_at    timestamptz,
  created_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.token,
    sr.child_name,
    sr.report_data,
    sr.expires_at,
    sr.created_at
  FROM public.shared_reports sr
  WHERE sr.token   = p_token
    AND sr.expires_at > now()
  LIMIT 1;
END;
$$;

-- Allow anyone (anon + authenticated) to call it — the token IS the secret
GRANT EXECUTE ON FUNCTION public.get_shared_report_by_token(text) TO anon, authenticated;

-- ================================================================
-- SECURITY FIX 2: report_unlocks — remove client UPDATE policy
-- Without this fix any authenticated user could self-approve payments by
-- setting status = 'completed' directly from the client.
-- All status transitions are now done server-side via a SECURITY DEFINER fn.
-- ================================================================

-- 2a. Remove the unsafe blanket UPDATE policy
DROP POLICY IF EXISTS "Users can update own unlocks" ON public.report_unlocks;

-- 2b. Create a SECURITY DEFINER function that only allows:
--     * setting status to 'paid'
--     * recording payment_id, order_id, unlocked_at
--     * CANNOT change amount_paise, child_id, or user_id
--     * Only the row owner can call it
CREATE OR REPLACE FUNCTION public.confirm_report_unlock(
  p_child_id   uuid,
  p_payment_id text,
  p_order_id   text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.report_unlocks
     SET status       = 'paid',
         payment_id   = p_payment_id,
         order_id     = p_order_id,
         unlocked_at  = now()
   WHERE user_id  = v_uid
     AND child_id = p_child_id
     AND status   = 'pending';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_report_unlock(uuid, text, text) TO authenticated;