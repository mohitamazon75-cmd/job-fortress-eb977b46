-- One-time wipe of all user accounts and associated data for a clean slate.
-- Order matters: dependent rows first, then auth.users (cascade handles the rest).

-- Scan-scoped dependents
DELETE FROM public.scan_feedback WHERE scan_id IN (SELECT id FROM public.scans);
DELETE FROM public.weekly_briefs WHERE scan_id IN (SELECT id FROM public.scans);
DELETE FROM public.chat_messages;
DELETE FROM public.cohort_cache;
DELETE FROM public.cohort_data;
DELETE FROM public.coach_nudges;
DELETE FROM public.defense_milestones;
DELETE FROM public.learning_path_progress;
DELETE FROM public.intel_watchlist;
DELETE FROM public.challenges;
DELETE FROM public.fate_cards;
DELETE FROM public.assessments;
DELETE FROM public.behavior_events;
DELETE FROM public.ab_test_events;
DELETE FROM public.analytics_events;
DELETE FROM public.model_b_results;
DELETE FROM public.diagnostic_results;

-- Beta data
DELETE FROM public.beta_scores;
DELETE FROM public.beta_plans;
DELETE FROM public.beta_signals;
DELETE FROM public.beta_events;
DELETE FROM public.beta_profiles;

-- Scans
DELETE FROM public.scans;

-- User-scoped
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- Auth users (will cascade to any remaining auth-linked rows)
DELETE FROM auth.users;