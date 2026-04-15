-- 48-hour Pro trial — no credit card required (P1-2 audit fix)
-- When trial_started_at is set and < 48 hours ago, the user has Pro access.
-- Checked alongside subscription_tier in subscription-guard.ts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS profiles_trial_started_at_idx
  ON public.profiles (trial_started_at)
  WHERE trial_started_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.trial_started_at IS
  '48-hour Pro trial. NULL = no trial. Set once via activate-trial edge fn. Read-only after set.';
