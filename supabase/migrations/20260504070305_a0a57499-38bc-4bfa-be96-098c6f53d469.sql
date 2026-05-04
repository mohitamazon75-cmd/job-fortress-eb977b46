-- Phase 2A (2026-05-04): enable realtime on model_b_results so the
-- ResultsModelB page can subscribe to completion events instead of
-- polling every 3 seconds. Polling is kept as a safety net for
-- anonymous scans (RLS blocks realtime when no auth.uid()).
ALTER TABLE public.model_b_results REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.model_b_results;