-- Back-register the two migrations that were manually applied via SQL editor
-- so Lovable's migration runner doesn't try to re-apply them.
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20260419164059'), ('20260420120000')
ON CONFLICT (version) DO NOTHING;

-- Ensure the b3_fabrication_guard feature flag row exists.
-- If the April 20 migration's INSERT was skipped during manual apply,
-- this guarantees the flag is present so the guard code path activates.
INSERT INTO public.feature_flags (flag_name, enabled_percentage, description, enabled_for_user_ids)
VALUES (
  'b3_fabrication_guard',
  100,
  'Blocks Agent 1 synthetic fallback when resume parsing fails — fails the scan loudly instead of fabricating a profile.',
  ARRAY[]::uuid[]
)
ON CONFLICT (flag_name) DO UPDATE
  SET enabled_percentage = EXCLUDED.enabled_percentage,
      description = EXCLUDED.description;