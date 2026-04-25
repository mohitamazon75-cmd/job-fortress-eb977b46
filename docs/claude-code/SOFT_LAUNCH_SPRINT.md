# Soft Launch Sprint — 1 Week to 1,000 Users

> **Status**: Active
> **Started**: 2026-04-25
> **Target**: Soft launch in 7 days, free pricing, ~1,000 users
> **Decided by**: Operator on 2026-04-25 (sequence: one PR per workstream; pricing: free; timeline: 1 week)
> **Constraints**: Must follow CLAUDE.md rules — no payments work, no scoring engine edits, no agent prompt edits, no god-file refactors. PRs ≤5 files where possible.

---

## Goal

Get the app into a state where it can comfortably handle ~1,000 free users over a soft-launch week without:
- Scans silently failing or hanging
- The DB grinding under load
- AI gateway costs spiraling
- Auth/RLS holes leaking data
- Outages going unnoticed

**Out of scope** (deliberate, per operator):
- Razorpay re-enable / `ENFORCE_PRO=true` — pricing stays off
- Scoring engine, agent prompts, deterministic logic
- god-file refactors (`process-scan`, `scan-engine.ts`, `SideHustleGenerator.tsx`, `VerdictReveal.tsx`)
- New features, new cards, new pages

---

## The 6 PRs

Each PR is small, focused, and shippable on its own. Status updated as we go.

### PR1 — Reliability: Scan failure UI + retry
**Status**: ✅ Complete (2026-04-25)
**Files**: ~3 (1 new component, 1 page edit, possibly 1 hook)
**Why**: Today's earlier fixes (orphan prevention, fast-fail, session retry) stop the bleeding on the backend. But users with errored scans currently see nothing actionable. We need a visible "Try again" CTA when `scans.status = 'error'`.

**Acceptance**:
- When a scan row is in `error` state, the user sees a clear failure card with a "Try again" button
- Clicking "Try again" re-uploads the resume and creates a new scan, deleting/marking the old errored row
- Build passes, no TS errors

---

### PR2 — Scale: DB indexes + query hygiene
**Status**: ✅ Complete (2026-04-25)
**Files**: 1 migration, possibly 1 query edit
**Why**: At 1,000 users with multiple scans each, common lookups (`scans.user_id`, `scans.status`, `score_history.user_id`, `scan_rate_limits.user_id`) will full-scan without indexes.

**Plan**:
- Audit `pg_stat_user_tables` and `pg_stat_user_indexes` to see what's actually being scanned
- Add `idx_scans_user_id_created_at`, `idx_scans_status_partial` (where status in processing/error), `idx_score_history_user_id`, etc.
- All `CREATE INDEX CONCURRENTLY` so no table locks

**Acceptance**:
- Migration runs cleanly
- Explain plan on `select * from scans where user_id = $1 order by created_at desc` shows index usage

---

### PR3 — Cost & Error Observability (merged with PR4)
**Status**: ✅ Complete (2026-04-25)
**Files**: 1 new edge function, 2 cron jobs
**Why**: Per platform rule, no backend rate limiting. Instead: surface AI spend and error rates so the operator can react manually. The existing infra already had token logging (`token_usage_log`), an error-rate trigger writing to `monitoring_alerts`, and a `send-alerts` webhook dispatcher. Two pieces were missing: (1) nothing checked daily AI spend against a budget, (2) nothing was on cron.

**Shipped**:
- New `cost-budget-check` edge function: sums today's `token_usage_log`, inserts a `monitoring_alerts` row at warn ($5/day) or critical ($20/day) thresholds. Idempotent — only one alert per (severity, day).
- Cron `cost-budget-check-hourly` (every hour at :00).
- Cron `send-alerts-every-15min` dispatches unacked alerts to `ALERT_WEBHOOK_URL` (Slack/Discord) if configured, otherwise logs them.
- Smoke-tested live: $0.60 spend / 77 calls today, no alert triggered (correctly under threshold).

**Operator action required for full value**: set the `ALERT_WEBHOOK_URL` secret to a Slack or Discord incoming webhook URL. Without it, alerts still accumulate in `monitoring_alerts` but you won't get pinged.

**Explicitly NOT done** (per platform rule): no per-user token caps, no automated kill-switches, no 429s.

---

### PR4 — Observability (merged into PR3 above)
**Status**: ✅ Complete (2026-04-25) — see PR3.
The error-rate trigger (`check_error_threshold`) was already wired in a prior migration. Combined with the cost-budget check and the `send-alerts` cron from PR3, the observability story is complete for the soft launch: errors > 20% on any function ➜ alert; AI spend > $5/day ➜ alert; both routed to webhook every 15 min.

---

### PR5 — Security audit & RLS hardening
**Status**: ✅ Complete (2026-04-25)
**Files**: 2 migrations, 1 auth config change. No app code changes needed.

**Auth-bypass fixes (real exploits closed)**:
- `fate_cards`: removed anon INSERT — anyone could create share cards for any assessment ID. Now service-role only (the legitimate `fate-card` edge function uses admin client).
- `challenges`: removed permissive UPDATE — any signed-in user could claim any unclaimed challenge by guessing its ID. Now service-role only; the (currently unused) accept flow must go through a backend endpoint that verifies the challenge_code.
- `beta_events`: removed duplicate weaker INSERT policy that allowed spoofing another user's profile_id.

**Compliance fixes**:
- `resumes` storage bucket: added DELETE + UPDATE policies scoped to user's own folder. Closes a DPDP gap (users couldn't delete their own resumes).
- Removed duplicate INSERT policy on resumes bucket.

**Auth hardening**:
- Enabled HIBP leaked-password protection — signups with breached passwords now blocked.

**Skipped per platform rule** (no-backend-rate-limiting): per-IP signup throttle. The Lovable Cloud auth endpoint has its own throttling; no ad-hoc layer added.

**Knowingly accepted (not a bug, by design)**:
- `scans` row readable by anon with valid `access_token` — required for the entire pre-auth share/results UX. Tokens are 256-bit, server-generated, never logged client-side.
- `diagnostic_results` shared rows expose salary — user explicitly opts in via `is_shared=true`. Part of viral share-card behavior.

**Verification**: linter clean before & after. Security scan went from 9 → 11 findings, but the two new "errors" are both by-design tradeoffs documented above; the three real auth-bypass warnings from the original scan are gone.

---

### PR6 — Soft-launch polish
**Status**: ✅ Complete (2026-04-25)
**Files**: 1 new hook + 1-line wire-up in `App.tsx`.

**Audit findings**:
- ✅ Top-level React `ErrorBoundary` was already in place — wrapping the whole app + each route individually with soft/hard reset and auto-recovery on stale lazy chunks. Far better than what I'd have built. No change needed.
- ✅ `Suspense` fallback (`RouteFallback`) already renders a tasteful skeleton during route chunk loads.
- ✅ Error-state UI for the scan flow already exists (PR1 hardened it).
- 🟡 **Gap closed**: no global handler for uncaught `Promise` rejections or `window.onerror` events. Async failures outside React (failed Supabase calls in `useEffect` with no `.catch`, background tasks) silently logged to console; user saw nothing.

**Shipped**: `useGlobalErrorHandlers()` hook mounted once at App root.
- Catches `unhandledrejection` + `error` window events.
- Surfaces a single sonner toast per unique message in any 5s window (dedup, capped at 50 entries).
- Suppresses known-noisy benign errors (ResizeObserver loop, AbortError, lazy chunk reloads — already handled elsewhere).
- Always logs full error to console for debugging.

**Verified**: `tsc --noEmit` clean.

---

## Daily plan

| Day | PR | Notes |
|---|---|---|
| Day 1 (today) | PR1 Reliability UI | Ship today |
| Day 2 | PR2 DB indexes | Migration + verify |
| Day 3 | PR3 Cost guardrails | Highest-risk PR — tested carefully |
| Day 4 | PR4 Observability | Get alerts wired before launch |
| Day 5 | PR5 Security | Linter + scan + auth throttle |
| Day 6 | PR6 Polish | Final pass |
| Day 7 | Soft launch | Open to 1,000 free users |

## Operator decision log

- **2026-04-25**: Pricing stays free for soft launch. `ENFORCE_PRO` remains off (Hazard D).
- **2026-04-25**: Sequence is one PR per workstream, sequential. No parallel work.
- **2026-04-25**: Out of scope: Razorpay, scoring engine, agent prompts, god-file refactors.

## Risks

- **Cost runaway** before PR3 lands. If launch slips earlier than Day 4, manual budget check daily.
- **DB load** before PR2 lands. Acceptable at <100 users; monitor.
- **Unknown unknowns** in scan pipeline. Today's fixes addressed reported failures but the 50-user cohort may surface more.
