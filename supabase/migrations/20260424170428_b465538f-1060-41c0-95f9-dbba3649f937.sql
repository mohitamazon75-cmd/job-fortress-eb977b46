-- Fix S1: behavior_events leaked anon-submitted rows to any reader
DROP POLICY IF EXISTS be_select_own ON public.behavior_events;

CREATE POLICY be_select_own_authed
ON public.behavior_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix S2: user_action_signals had the same leak
DROP POLICY IF EXISTS uas_select_own ON public.user_action_signals;

CREATE POLICY uas_select_own_authed
ON public.user_action_signals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);