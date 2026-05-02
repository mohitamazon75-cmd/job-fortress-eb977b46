ALTER TABLE public.shadow_match_log
  ADD COLUMN IF NOT EXISTS det_pct_original integer,
  ADD COLUMN IF NOT EXISTS det_pct_rewritten integer,
  ADD COLUMN IF NOT EXISTS rewritten_text_chars integer;

COMMENT ON COLUMN public.shadow_match_log.det_pct IS 'Legacy: deterministic score of original resume vs JD. Use det_pct_original going forward.';
COMMENT ON COLUMN public.shadow_match_log.det_pct_original IS 'Deterministic match: original raw_text resume vs JD (0-100).';
COMMENT ON COLUMN public.shadow_match_log.det_pct_rewritten IS 'Deterministic match: LLM-rewritten resume vs JD (0-100). Apples-to-apples vs llm_pct.';
COMMENT ON COLUMN public.shadow_match_log.rewritten_text_chars IS 'Character count of reconstructed rewritten resume — sanity check for parser drift.';