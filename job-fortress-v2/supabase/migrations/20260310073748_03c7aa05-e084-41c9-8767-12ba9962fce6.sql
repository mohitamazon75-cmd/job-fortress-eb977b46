-- Sprint 6.3: Challenge a Colleague feature
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_scan_id uuid NOT NULL,
  challenger_user_id uuid NOT NULL,
  challenge_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  respondent_scan_id uuid,
  respondent_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own challenges" ON public.challenges
  FOR SELECT TO authenticated
  USING (challenger_user_id = auth.uid() OR respondent_user_id = auth.uid());

CREATE POLICY "Users create challenges" ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (challenger_user_id = auth.uid());

CREATE POLICY "Users accept challenges" ON public.challenges
  FOR UPDATE TO authenticated
  USING (respondent_user_id IS NULL OR respondent_user_id = auth.uid());

CREATE POLICY "Service role manages challenges" ON public.challenges
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Sprint 13.4: Referral program columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex');
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Sprint 13: Track payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  razorpay_payment_id text,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  plan_type text NOT NULL DEFAULT 'pro_scan',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages payments" ON public.payments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);