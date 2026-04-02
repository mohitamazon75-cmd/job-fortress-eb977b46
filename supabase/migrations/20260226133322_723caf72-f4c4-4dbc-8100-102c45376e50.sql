-- Fix search_path warning on get_panic_overview
CREATE OR REPLACE FUNCTION public.get_panic_overview()
RETURNS TABLE(total_roles bigint, declining_roles bigint, booming_roles bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT count(DISTINCT job_family) FROM public.market_signals) as total_roles,
    (SELECT count(*) FROM public.market_signals WHERE market_health = 'declining') as declining_roles,
    (SELECT count(*) FROM public.market_signals WHERE market_health = 'booming') as booming_roles;
$$;