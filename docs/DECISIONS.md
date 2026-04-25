# Decisions log

> Non-obvious calls, with date + reason. Append-only. Future "why is it like this?" questions get answered here, not in Slack archaeology.

---

## 2026-04-24 — `ENFORCE_PRO` stays off (Pro gating bypassed in production)

**Decision**: Leave the `ENFORCE_PRO` env var unset (or `false`) in Lovable Cloud. All Pro-tier features remain freely accessible to all users.

**Reason**: Pre-PMF stage. Per `00_CURRENT_REALITY.md` traffic is ~7 scans/24h with 29% completion. At this scale, ₹399/month revenue is rounding error compared to the conversion lift from a fully open product. Growth signal > monetization signal until the funnel proves itself.

**Costs accepted**:
- No revenue from existing users.
- Pro CTAs in the UI act as soft signals only (telemetry on intent, no actual paywall).

**Reversal trigger**: when *either* (a) DAU sustainably > 100 *or* (b) the operator chooses to test pricing. Reversal is one env-var flip; no code change required. Run a Razorpay smoke test first (BL-001 acceptance criteria).

**Owner**: founder.
**Related**: BL-001 (status updated to `wontfix-for-now`), Hazard D in CLAUDE.md, INV-X01 in `INVARIANTS.md`.

---

## How to add an entry

```
## YYYY-MM-DD — short title

**Decision**: what we chose.
**Reason**: why this over the alternatives.
**Costs accepted**: what we are knowingly giving up.
**Reversal trigger**: what would make us revisit.
**Owner**: name.
**Related**: BL-###, invariant IDs, file paths.
```

---

## Assessments RLS — re-audit 2026-04-24

External audit flagged USING (true) on assessments (migration
20260304053357). Investigation confirmed this was already replaced by
the scans-join policy in migration 20260304054450 ~12h later. No
action taken. Reconsider adding a direct user_id column if any
frontend starts querying assessments directly.

---

## Per-user AI spending cap — deferred 2026-04-25

External audit (2026-04-24) flagged the absence of a per-user AI
spending cap as a scalability/scalability issue. Investigation found:

- Neither daily_usage_stats nor token_usage_log has a user_id column.
  Building a per-user spend check would require a new migration.
- An existing USER_DAILY_LIMIT=25 call-count check in spending-guard.ts
  was dead code (filtered on a non-existent column; silently no-op'd).
- The existing scan-rate-limiter (50 scans/user/day) bounds
  process-scan spend at ~$25/user/day (~1% of $2500 global cap).

Decision: do NOT build a per-user spending cap in this pass. Remove
the dead code in spending-guard.ts to eliminate confusion. Revisit
when (a) traffic grows meaningfully OR (b) we observe a single-user
spike exceeding $50/day.

Future work if revisited:

- Add nullable user_id uuid to token_usage_log.
- Update token-tracker to populate it from the request context.
- Add checkUserDailySpending() that sums estimated_cost_usd for a
  user over last 24h against a configurable cap (default ~$5/user/day).
- Return 429 with code USER_SPENDING_CAP (distinct from the global
  503 SERVICE_DEGRADED).

---

## Audit-fix sequence — completed 2026-04-25

External audit dated 2026-04-24 identified 50 findings across 5 lenses.
After re-verifying findings against current source, 8 actionable
technical/security/scalability fixes were sequenced and shipped:

- Step 1: AuthGuard admin role lookup fixed (was conflating
  subscription_tier with role; now reads user_roles table to match
  server-side has_role()).
- Step 2: Auth.tsx localhost auth-bypass short-circuit removed
  (was running before credential check; could be exploited via
  reverse-proxy or dev tunnels).
- Step 3: Assessments RLS — investigation revealed audit finding was
  stale (USING (true) was already replaced 12h after the broken
  migration). No code change; documented in DECISIONS.
- Step 4: Fake social-proof counter (BASE_COUNT = 5247) removed from
  HeroSection. Counter now shows real count, hidden below 50.
- Step 5: Prompt-injection defense added to scan-agents
  sharedProfileContext. wrapUserData() helper sanitizes 14 user-
  controlled fields before they enter downstream agent contexts.
- Step 6: Per-user spending cap deferred (would require schema
  change; existing rate limiter already bounds per-user compute
  adequately at current traffic). Dead user-id-filtered branch
  removed from spending-guard.
- Step 7: Dual-lockfile reconciled. package-lock.json removed,
  bun.lock canonical, .gitignore guards re-add.
- Step 8: DB-backed tool catalog replaces hardcoded LLM/tool
  version names in agent prompts. Three slices (8a: helper,
  8b: scrubber extension, 8c: wiring + verification). Real-scan
  verification confirmed catalog substitution works end-to-end
  with no narrative degradation.

Additional findings (UX/product/payment) deferred per operator scope
(technical/security/scalability only).

Net deltas:

- 8 prompts shipped, 1 phantom finding correctly avoided.
- One mid-flight revert (8c original attempt) resolved cleanly via
  history rollback; no broken state shipped.
- Test suite: 194 → 231 vitest, plus 24 new Deno tests for catalog
  and scrubber.
- Build clean throughout.
- Lint baseline unchanged (~828 pre-existing errors, tracked in
  BL-032).
