-- Clear all enrichment cache
DELETE FROM enrichment_cache;

-- Clear scan-dependent tables
DELETE FROM scan_feedback;
DELETE FROM weekly_briefs;
DELETE FROM chat_messages;

-- Clear all scans (resets cache fields too)
DELETE FROM scans;

-- Clear assessments and fate cards
DELETE FROM fate_cards;
DELETE FROM share_events;
DELETE FROM assessments;

-- Clear beta data
DELETE FROM beta_scores;
DELETE FROM beta_plans;
DELETE FROM beta_signals;
DELETE FROM beta_events;
DELETE FROM beta_profiles;