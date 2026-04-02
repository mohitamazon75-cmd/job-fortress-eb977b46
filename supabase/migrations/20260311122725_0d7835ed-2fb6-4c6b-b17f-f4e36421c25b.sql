
-- Fix credit_referral() deduplication:
-- 1. Create referral_credits table to track which user credited which code
-- 2. Update credit_referral() to check for duplicate calls and self-referrals
-- 3. Revoke execute from anon role

CREATE TABLE IF NOT EXISTS public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  credited_by uuid NOT NULL,
  credited_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (referral_id, credited_by)
);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

-- No client access — only used by SECURITY DEFINER function
CREATE POLICY "No direct client access to referral_credits"
  ON public.referral_credits
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- Update credit_referral to prevent abuse
CREATE OR REPLACE FUNCTION public.credit_referral(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_count integer;
  v_caller uuid := auth.uid();
BEGIN
  -- Require authenticated caller
  IF v_caller IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, referrer_user_id, signup_count
    INTO v_id, v_owner, v_count
    FROM public.referrals
   WHERE referral_code = p_referral_code
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Prevent self-referral
  IF v_owner = v_caller THEN
    RETURN false;
  END IF;

  -- Cap at 100
  IF v_count >= 100 THEN
    RETURN false;
  END IF;

  -- Deduplicate: one credit per caller per referral code
  INSERT INTO public.referral_credits (referral_id, credited_by)
  VALUES (v_id, v_caller)
  ON CONFLICT (referral_id, credited_by) DO NOTHING;

  IF NOT FOUND THEN
    -- Already credited by this user
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

-- Restrict to authenticated only
REVOKE EXECUTE ON FUNCTION public.credit_referral(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_referral(text) TO authenticated;
