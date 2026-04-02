
-- Explicitly recreate all user-facing policies as PERMISSIVE
-- (PostgreSQL default is PERMISSIVE but being explicit to satisfy linter)

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own children" ON public.children;
CREATE POLICY "Users CRUD own children" ON public.children AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own assessments" ON public.assessments;
CREATE POLICY "Users CRUD own assessments" ON public.assessments AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own reports" ON public.reports;
CREATE POLICY "Users CRUD own reports" ON public.reports AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own feedback" ON public.feedback;
CREATE POLICY "Users CRUD own feedback" ON public.feedback AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users create own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users update own children's DM profiles" ON public.discoverme_profiles;
DROP POLICY IF EXISTS "Users delete own children's DM profiles" ON public.discoverme_profiles;
CREATE POLICY "Users see own children's DM profiles" ON public.discoverme_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users create own children's DM profiles" ON public.discoverme_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users update own children's DM profiles" ON public.discoverme_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid())) WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users delete own children's DM profiles" ON public.discoverme_profiles AS PERMISSIVE FOR DELETE TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users see own blueprints" ON public.future_blueprints;
DROP POLICY IF EXISTS "Users create own blueprints" ON public.future_blueprints;
DROP POLICY IF EXISTS "Users update own blueprints" ON public.future_blueprints;
CREATE POLICY "Users see own blueprints" ON public.future_blueprints AS PERMISSIVE FOR SELECT TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users create own blueprints" ON public.future_blueprints AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users update own blueprints" ON public.future_blueprints AS PERMISSIVE FOR UPDATE TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid())) WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users see own blueprint history" ON public.blueprint_history;
DROP POLICY IF EXISTS "Users create own blueprint history" ON public.blueprint_history;
CREATE POLICY "Users see own blueprint history" ON public.blueprint_history AS PERMISSIVE FOR SELECT TO authenticated USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Users create own blueprint history" ON public.blueprint_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can manage own shared reports" ON public.shared_reports;
CREATE POLICY "Owner can manage own shared reports" ON public.shared_reports AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own unlocks" ON public.report_unlocks;
DROP POLICY IF EXISTS "Users can insert own unlocks" ON public.report_unlocks;
CREATE POLICY "Users can view own unlocks" ON public.report_unlocks AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unlocks" ON public.report_unlocks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users view own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users insert own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users update own referral" ON public.referrals;
CREATE POLICY "Users view own referral" ON public.referrals AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id);
CREATE POLICY "Users insert own referral" ON public.referrals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Users update own referral" ON public.referrals AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = referrer_user_id) WITH CHECK (auth.uid() = referrer_user_id);
