-- ══════════════════════════════════════════════════════════════════════
-- B3 — Fabrication Guard feature flag (master switch)
-- Spec: docs/claude-code/SCAN_PIPELINE_TRIAGE_2026-04-20.md §9 (master-switch fix)
--
-- Adds one row to public.feature_flags:
--   • enable_fabrication_guard — when ON for a given user/scan, process-scan
--     fails-closed with scan_status='invalid_input' (feedback_flag='fabrication_guard')
--     instead of shipping a fabricated report when:
--       usedAgent1SyntheticFallback === true
--       OR fallbacksUsed.includes("all→MERGED_FALLBACK")
--
-- Default OFF (enabled_percentage = 0, enabled_for_user_ids = []).
-- Operator ramps manually via Supabase UI per CLAUDE.md Rule 4:
--   dev → internal whitelist → 1% → 10% → 100%.
--
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run.
-- Touches: one INSERT into public.feature_flags. No schema/column/type change.
-- Depends on: 20260419164059_career_reality_check_schema.sql (creates the table).
--
-- Reverse migration (data loss acceptable — this row is runtime config, not user
-- data; removing it returns the flag to its implicit-OFF state, which the helper
-- isFeatureEnabled() treats as false per fail-closed Refinement B):
--   DELETE FROM public.feature_flags WHERE flag_name = 'enable_fabrication_guard';
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO public.feature_flags (flag_name, enabled_percentage, enabled_for_user_ids, description)
VALUES (
  'enable_fabrication_guard',
  0,
  ARRAY[]::uuid[],
  'B3 master switch (per docs/claude-code/SCAN_PIPELINE_TRIAGE_2026-04-20.md §9). When ON for a user/scan, process-scan fails-closed with invalid_input instead of shipping a synthetic-fallback or MERGED_FALLBACK report. Default OFF; ramp via enabled_percentage or whitelist via enabled_for_user_ids.'
)
ON CONFLICT (flag_name) DO NOTHING;
