ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS analysis_context jsonb;

COMMENT ON COLUMN public.scans.analysis_context IS
  'Deterministic per-scan context object built by buildAnalysisContext() (Phase 1.A audit 2026-04-30). Read by every card to prevent cross-card contradictions. Schema: src/lib/analysis-context.ts AnalysisContext interface.';