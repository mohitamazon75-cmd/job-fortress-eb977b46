-- Replace the prior fix with a stricter posture: no client-side UPDATE on challenges.
-- Acceptance must go through an edge function that verifies the challenge_code server-side.
DROP POLICY IF EXISTS "Recipients accept challenges with code" ON public.challenges;
-- The existing "Service role manages challenges" policy (FOR ALL) already covers backend writes.