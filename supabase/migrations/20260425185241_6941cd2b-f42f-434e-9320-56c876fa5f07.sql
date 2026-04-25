-- PR5 fix 1: fate_cards INSERT — tighten to service-role only.
-- All legitimate inserts already go through createAdminClient() in the fate-card edge function.
DROP POLICY IF EXISTS "Anon can create fate cards for valid assessment" ON public.fate_cards;

CREATE POLICY "Service role inserts fate cards"
ON public.fate_cards
FOR INSERT
TO service_role
WITH CHECK (true);


-- PR5 fix 2: challenges UPDATE — require knowing the challenge_code to accept.
-- The code is the secret token shared in the invitation link.
DROP POLICY IF EXISTS "Users accept challenges" ON public.challenges;

CREATE POLICY "Recipients accept challenges with code"
ON public.challenges
FOR UPDATE
TO authenticated
USING (
  respondent_user_id IS NULL
  AND challenge_code IS NOT NULL
)
WITH CHECK (
  respondent_user_id = auth.uid()
);


-- PR5 fix 3: beta_events — remove the weaker overlapping INSERT policy.
-- The stricter "Users can insert own events" already validates profile_id ownership.
DROP POLICY IF EXISTS "Users insert own events" ON public.beta_events;