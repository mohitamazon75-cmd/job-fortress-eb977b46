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
**Status**: 🟡 In progress
**Files**: ~3 (1 new component, 1 page edit, possibly 1 hook)
**Why**: Today's earlier fixes (orphan prevention, fast-fail, session retry) stop the bleeding on the backend. But users with errored scans currently see nothing actionable. We need a visible "Try again" CTA when `scans.status = 'error'`.

**Acceptance**:
- When a scan row is in `error` state, the user sees a clear failure card with a "Try again" button
- Clicking "Try again" re-uploads the resume and creates a new scan, deleting/marking the old errored row
- Build passes, no TS errors

---

### PR2 — Scale: DB indexes + query hygiene
**Status**: ⚪ Not started
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

### PR3 — Cost guardrails: AI gateway rate limits + budget cap
**Status**: ⚪ Not started
**Files**: 1 shared module, 2–3 edge functions
**Why**: At 1,000 users running scans + coach + side-hustle + market radar, Lovable AI costs can blow out fast. Need per-user and global daily caps.

**Plan**:
- Add `_shared/ai-budget.ts` with `checkDailyBudget(userId, functionName)` reading from a `ai_usage_daily` table
- Wire into the 3 highest-cost edge functions (`process-scan`, `career-coach`, `market-radar` or equivalents)
- If budget exceeded: return graceful 429 with friendly message, don't burn the call

**Acceptance**:
- Per-user daily token cap enforced
- Global daily $ cap visible in `monitoring_alerts` if breached
- No regression on happy path

---

### PR4 — Observability: Uptime ping + error rate alerts
**Status**: ⚪ Not started
**Files**: 1 edge function (already partially exists?), 1 cron
**Why**: We have `monitoring_alerts` and `daily_usage_stats` tables and a `check_error_threshold` trigger already. Need to actually surface alerts somewhere the operator sees them.

**Plan**:
- Audit what's already wired (`check_error_threshold` trigger exists)
- Add a daily digest edge function that emails operator if any unacked alerts in the last 24h
- Cron it once a day

**Acceptance**:
- Operator gets an email if error rate > 20% on any function
- Operator gets a daily summary even on green days

---

### PR5 — Security: RLS audit + auth rate-limit
**Status**: ⚪ Not started
**Files**: 1 migration (RLS fixes), 1 edge function (signup throttle)
**Why**: Before opening to 1,000 users we need the security linter clean and signup throttled (otherwise bots will abuse free Pro).

**Plan**:
- Run `supabase--linter`, fix all critical/high findings
- Run `security--run_security_scan`, address exposed-data findings
- Add per-IP signup rate limit (5 signups / hour / IP)

**Acceptance**:
- Linter shows 0 errors, 0 critical warnings
- Signup endpoint rejects 6th attempt from same IP in an hour

---

### PR6 — Soft-launch polish: Loading states, empty states, error boundaries
**Status**: ⚪ Not started
**Files**: 2–4 components
**Why**: Final polish pass for first-impression quality. Catch the visible cracks before users do.

**Plan**:
- Add a top-level React error boundary so uncaught errors don't blank the app
- Audit major loading states (dashboard, scan flow, coach) for jank
- Audit empty states (no scans yet, no jobs found, etc.) for friendliness

**Acceptance**:
- Error boundary catches and shows recovery UI
- All major flows have non-jarring loading + empty states
- `bun run build` passes

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
