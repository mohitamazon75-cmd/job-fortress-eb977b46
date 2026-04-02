-- Phase B: Add delta_summary to score_history for scan-over-scan comparison
ALTER TABLE public.score_history ADD COLUMN IF NOT EXISTS delta_summary jsonb;
COMMENT ON COLUMN public.score_history.delta_summary IS
  'Computed async after scan. Schema: {score_change, moved_up, moved_down, new_risks, new_moats, summary_text}';

-- Phase B: Add posting_change_pct to market_signals for rescan nudge emails
ALTER TABLE public.market_signals ADD COLUMN IF NOT EXISTS posting_change_pct numeric(6,2) DEFAULT 0;
