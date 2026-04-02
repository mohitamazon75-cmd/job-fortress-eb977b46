-- =============================================================
-- REFERRAL SYSTEM: Track invites + grant Pro access on conversion
-- =============================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id text NOT NULL,
  referral_code text NOT NULL UNIQUE,
  referee_user_id text,
  referee_scan_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'clicked', 'converted')),
  created_at timestamptz DEFAULT now(),
  converted_at timestamptz
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON public.referrals(referral_code);

-- Pro access grants from referrals
CREATE TABLE IF NOT EXISTS public.referral_pro_grants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  grant_reason text DEFAULT 'referral_3_conversions',
  referral_count int DEFAULT 3
);

CREATE INDEX IF NOT EXISTS referral_pro_grants_user_idx ON public.referral_pro_grants(user_id);

-- RLS: users can only read their own referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_pro_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referrals" ON public.referrals
  FOR SELECT USING (referrer_user_id = auth.uid()::text OR referee_user_id = auth.uid()::text);

CREATE POLICY "Users read own pro grants" ON public.referral_pro_grants
  FOR SELECT USING (user_id = auth.uid()::text);

-- Service role can do everything (edge functions use service role key)
CREATE POLICY "Service full access referrals" ON public.referrals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service full access pro grants" ON public.referral_pro_grants
  FOR ALL USING (true) WITH CHECK (true);
