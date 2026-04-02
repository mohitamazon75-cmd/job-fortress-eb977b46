-- Remove the permissive client-facing UPDATE policy on referrals.
-- All writes to signup_count, click_count, scout_badge_earned go through
-- the existing credit_referral() SECURITY DEFINER function only.
DROP POLICY IF EXISTS "Users update own referral" ON public.referrals;