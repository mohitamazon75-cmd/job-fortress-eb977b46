-- Sprint 21: Add SECURITY DEFINER function to credit referrer without needing auth
-- This allows a newly signed-up user to safely increment signup_count
-- on a referral row identified by referral_code.

CREATE OR REPLACE FUNCTION public.credit_referral(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
  SELECT id, signup_count
    INTO v_id, v_count
    FROM public.referrals
   WHERE referral_code = p_referral_code
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Cap at 100 to prevent runaway increments
  IF v_count >= 100 THEN
    RETURN false;
  END IF;

  UPDATE public.referrals
     SET signup_count = signup_count + 1,
         scout_badge_earned = CASE WHEN (signup_count + 1) >= 3 THEN true ELSE scout_badge_earned END,
         updated_at = now()
   WHERE id = v_id;

  RETURN true;
END;
$$;