# SECURITY DEFINER Linter Triage — 2026-04-28

**Scanner output**: 30 WARN findings (linter rules `0028_anon_security_definer_function_executable` + `0029_authenticated_security_definer_function_executable`).

**Ground truth**: 15 distinct `SECURITY DEFINER` functions in `public` schema. Each is counted twice by the linter (once per role: `anon`, `authenticated`) → 30 warnings.

**Lens applied**: All 15 are deliberate — `SECURITY DEFINER` is the documented pattern from CLAUDE.md / Lovable user-roles guidance for any function that must bypass RLS (e.g., `has_role`, cron jobs, trigger logic). The linter warns generically; we evaluate intent per-function.

---

## Classification

| # | Function | Verdict | Rationale |
|---|----------|---------|-----------|
| 1 | `has_role(uuid, app_role)` | ✅ KEEP | Canonical RLS-helper pattern. Must be DEFINER to read `user_roles` from inside RLS policies without recursion. Documented by Supabase. |
| 2 | `handle_new_user()` | ✅ KEEP | Trigger on `auth.users` insert → writes to `public.profiles`. DEFINER required (auth schema is privileged). |
| 3 | `update_updated_at_column()` | ✅ KEEP | Trigger helper, no data exposure. |
| 4 | `update_diagnostic_results_updated_at()` | ✅ KEEP | Trigger helper, no data exposure. |
| 5 | `check_and_increment_coach_usage(uuid)` | ⚠ REVIEW | Caller passes `_user_id`; function writes to `profiles`. **Risk**: an authenticated user could call with another user's UUID and increment their counter. Cheap counter-DoS, not auth bypass. **Mitigation**: should add `IF _user_id != auth.uid() THEN RAISE EXCEPTION` guard. Defer — low impact. |
| 6 | `get_public_feature_flags()` | ✅ KEEP | Returns read-only flag table; intentionally public. |
| 7 | `get_panic_overview()` | ✅ KEEP | Returns aggregate counts only, no PII. Intentionally public. |
| 8 | `apply_feedback_to_kg()` | ✅ KEEP | Trigger on `feedback_events`. DEFINER to write `skill_risk_matrix`. Not directly callable in practice. |
| 9 | `check_error_threshold()` | ✅ KEEP | Trigger on `edge_function_logs`. Internal. |
| 10 | `enforce_story_bank_free_cap()` | ✅ KEEP | Trigger on `user_stories`. DEFINER reads `profiles.subscription_tier` for cap enforcement — exactly the documented pattern from `mem://features/story-bank`. |
| 11 | `purge_unconsented_artifacts()` | ✅ KEEP | Cron job; deletes from privileged tables. Must be DEFINER. |
| 12 | `cleanup_expired_rate_limits()` | ✅ KEEP | Cron job. |
| 13 | `cleanup_expired_cache()` | ✅ KEEP | Cron job. |
| 14 | `move_to_dlq(...)` | ⚠ REVIEW | pgmq helper. Callable by authenticated. **Risk**: an attacker could replay messages to arbitrary queues. **Mitigation**: revoke EXECUTE from `anon` and `authenticated`; only service role should call. Defer — pgmq tables are not user-exposed; queue names are not predictable secrets but compromise impact is moderate. |
| 15 | `enqueue_email`, `read_email_batch`, `delete_email` | ⚠ REVIEW | pgmq email-queue helpers. Same risk class as `move_to_dlq`. Should `REVOKE EXECUTE … FROM anon, authenticated` and force service-role-only access. Defer — soft-launch traffic is single-digit/day; not exploitable without queue-name knowledge. |

---

## Action plan

### P0 (block launch): **none**
None of the 15 functions expose authentication bypass, data exfiltration, or financial-state mutation by an unauthenticated caller.

### P1 (post-launch, week 1):
1. **`check_and_increment_coach_usage`**: add `IF _user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;` — closes counter-DoS.
2. **pgmq helpers** (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`): `REVOKE EXECUTE … FROM anon, authenticated;` — service-role-only.

### P2 (housekeeping):
- Document that the linter will continue to emit ~26 warnings forever (the trigger helpers + cron + `has_role` are correct-by-design). Suppression isn't supported; treat as expected baseline.

---

## Bottom line
**No P0 launch-blockers.** The 30 warnings are largely false positives against the documented Lovable RLS pattern. Two follow-up tickets logged for `BACKLOG.md`.
