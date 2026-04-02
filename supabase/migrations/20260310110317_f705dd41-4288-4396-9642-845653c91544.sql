
-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX 1: report_unlocks — restrict INSERT to status='pending' only
-- Any user could previously self-insert status='completed' to bypass payment.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can insert own unlocks" ON public.report_unlocks;

CREATE POLICY "Users can insert own unlocks"
  ON public.report_unlocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX 2: future_blueprints — remove the broken "token IS NOT NULL"
-- SELECT policy that leaked ALL blueprints with any share token to anyone.
-- Shared access is handled via the existing SECURITY DEFINER RPC function
-- (get_shared_report_by_token) — not via a client-side RLS policy.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Shared blueprints visible via token" ON public.future_blueprints;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX 3: referrals — lock down UPDATE so users cannot self-award
-- badges or inflate counters. Only the user's own identity fields (none exist
-- on this table) are user-editable. All counter/badge mutations go via
-- the server-side credit_referral() SECURITY DEFINER function.
-- We replace the permissive UPDATE policy with a WITH CHECK that rejects
-- any attempt to change click_count, signup_count, or scout_badge_earned.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users update own referral" ON public.referrals;

CREATE POLICY "Users update own referral"
  ON public.referrals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = referrer_user_id)
  WITH CHECK (
    auth.uid() = referrer_user_id
    -- Prevent self-service manipulation of counters and badge
    AND click_count  = (SELECT r.click_count  FROM public.referrals r WHERE r.id = referrals.id)
    AND signup_count = (SELECT r.signup_count FROM public.referrals r WHERE r.id = referrals.id)
    AND scout_badge_earned = (SELECT r.scout_badge_earned FROM public.referrals r WHERE r.id = referrals.id)
  );
