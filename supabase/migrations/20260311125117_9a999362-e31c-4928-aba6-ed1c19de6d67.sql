
-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: All user-access-granting RLS policies must be PERMISSIVE (default)
-- PostgreSQL requires at least one PERMISSIVE policy to grant access.
-- RESTRICTIVE policies can only further LIMIT what PERMISSIVE ones already allow.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── children ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users CRUD own children" ON public.children;

CREATE POLICY "Users CRUD own children"
  ON public.children FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── assessments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users CRUD own assessments" ON public.assessments;

CREATE POLICY "Users CRUD own assessments"
  ON public.assessments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── reports ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users CRUD own reports" ON public.reports;

CREATE POLICY "Users CRUD own reports"
  ON public.reports FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── feedback ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users CRUD own feedback" ON public.feedback;

CREATE POLICY "Users CRUD own feedback"
  ON public.feedback FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── discoverme_profiles ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users create own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users update own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users delete own children's DM profiles" ON public.discoverme_profiles;

CREATE POLICY "Users see own children's DM profiles"
  ON public.discoverme_profiles FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users create own children's DM profiles"
  ON public.discoverme_profiles FOR INSERT
  TO authenticated
  WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users update own children's DM profiles"
  ON public.discoverme_profiles FOR UPDATE
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()))
  WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own children's DM profiles"
  ON public.discoverme_profiles FOR DELETE
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

-- ── future_blueprints ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own blueprints" ON public.future_blueprints;
DROP POLICY IF EXISTS "Users create own blueprints" ON public.future_blueprints;
DROP POLICY IF EXISTS "Users update own blueprints" ON public.future_blueprints;

CREATE POLICY "Users see own blueprints"
  ON public.future_blueprints FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users create own blueprints"
  ON public.future_blueprints FOR INSERT
  TO authenticated
  WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users update own blueprints"
  ON public.future_blueprints FOR UPDATE
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()))
  WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

-- ── blueprint_history ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own blueprint history" ON public.blueprint_history;
DROP POLICY IF EXISTS "Users create own blueprint history" ON public.blueprint_history;

CREATE POLICY "Users see own blueprint history"
  ON public.blueprint_history FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

CREATE POLICY "Users create own blueprint history"
  ON public.blueprint_history FOR INSERT
  TO authenticated
  WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

-- ── shared_reports ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage own shared reports" ON public.shared_reports;

CREATE POLICY "Owner can manage own shared reports"
  ON public.shared_reports FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── report_unlocks ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own unlocks" ON public.report_unlocks;
DROP POLICY IF EXISTS "Users can insert own unlocks" ON public.report_unlocks;

CREATE POLICY "Users can view own unlocks"
  ON public.report_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unlocks"
  ON public.report_unlocks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid())
  );

-- ── referrals ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users view own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users insert own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users update own referral" ON public.referrals;

CREATE POLICY "Users view own referral"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users insert own referral"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Users update own referral"
  ON public.referrals FOR UPDATE
  TO authenticated
  USING (auth.uid() = referrer_user_id)
  WITH CHECK (
    auth.uid() = referrer_user_id
    AND click_count = (SELECT r.click_count FROM referrals r WHERE r.id = referrals.id)
    AND signup_count = (SELECT r.signup_count FROM referrals r WHERE r.id = referrals.id)
    AND scout_badge_earned = (SELECT r.scout_badge_earned FROM referrals r WHERE r.id = referrals.id)
  );
