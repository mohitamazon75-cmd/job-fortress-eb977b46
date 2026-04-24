# Backlog — single source of truth for known issues

> **Rule**: An audit finding goes here, not into Slack or memory. If a bug exists and isn't in this file, it doesn't exist for prioritization purposes.
>
> **Format**: each entry is `[ID] severity — title`. Body has: discovered (date + audit), files, invariant ref, fix sketch, owner, status.

Severity levels:
- **P0**: shipping-blocker (security, payments, data loss, complete feature breakage)
- **P1**: degrades trust or core flow (wrong number on screen, broken cron, slow critical path)
- **P2**: polish, dev-experience, low-impact bug
- **P3**: nice-to-have

Status: `open` · `in-progress` · `done` · `wontfix` (with reason)

---

## Open — P0

### BL-001 — `TESTING_BYPASS = true` in subscription-guard
## Open — P0

*(none — see DECISIONS.md for ENFORCE_PRO. Razorpay order-creation BL-016 is P1.)*

## Resolved — P0

### BL-001 — `TESTING_BYPASS = true` in subscription-guard → wontfix-for-now
- **Discovered**: pre-existing (CLAUDE.md Hazard D, original form).
- **Resolution (2026-04-24)**: hardcoded flag was already removed; replaced by `ENFORCE_PRO` env var which currently defaults off. Operator decision (`docs/DECISIONS.md`) is to keep Pro gating off pre-PMF. Will be revisited at DAU > 100.
- **Status**: wontfix-for-now. Reopen when reversal trigger fires.

### BL-002 — DEV-mode bypass in `activate-subscription` → done
- **Resolution (2026-04-24)**: audit confirmed the DEV fallback is no longer present in `activate-subscription/index.ts`. Function requires real Razorpay verification.
- **Status**: done.

### BL-003 — `job-fortress-v2/` parallel codebase → done
- **Resolution (2026-04-24)**: directory removed from repo. One source of truth.
- **Status**: done.

## Open — P1

*(none — BL-016 resolved 2026-04-24.)*

## Resolved — P1

### BL-016 — Razorpay order-creation is client-side (price-manipulation risk) → done
- **Resolution (2026-04-24)**: `supabase/functions/create-razorpay-order/index.ts` is in place. Server fixes `amount` from `TIER_PRICES` (`pro_monthly: ₹300`, `pro: ₹1,999`) — client never passes amount. `ProUpgradeModal.tsx` calls `createServerOrder()` then opens Razorpay checkout with the server-issued `order_id`. A pending `payments` row is inserted server-side; `activate-subscription` verifies the signature before flipping the user to Pro. Pre-condition for flipping `ENFORCE_PRO=true` is now satisfied.
- **Status**: done.

### BL-010 — `generate-weekly-brief` has no cron → done
- **Resolution (2026-04-24)**: cron wired in migration `20260416042427_activate_retention_cron_jobs.sql` (Sun midnight IST).
- **Status**: done.

### BL-011 — Five `.git_old*` directories → done
- **Resolution (2026-04-24)**: directories removed.
- **Status**: done.

## Open — P1 (continued)

### BL-012 — INV-F01 has no automated test (state leaks across scan_id) → done
- **Resolution (2026-04-24)**: extracted `shouldClearScanState` to `src/lib/model-b-helpers.ts`; covered by `src/test/model-b-helpers.test.ts`.
- **Status**: done.

### BL-013 — INV-F02 has no automated test (streak reset on day-skip) → done
- **Resolution (2026-04-24)**: extracted `nextStreak` helper; 7 tests cover same-day, 1-day, 2-day, 7-day, corrupted-date, and zero-current cases.
- **Status**: done.

### BL-014 — INV-F03 has no automated test (progressPct uses visitedCards.size) → done
- **Resolution (2026-04-24)**: extracted `journeyProgressPct` helper; 5 tests including defensive cases.
- **Status**: done.

### BL-015 — DPDP 90-day retention has no automated cleanup job
- **Memory**: `mem://project/data-privacy-and-retention`.
- **Fix**: add a `pg_cron` job that purges scans older than 90 days; add a test that calls the function with a frozen clock.
- **Status**: open.

### BL-015 — DPDP 90-day retention has no automated cleanup job
- **Memory**: `mem://project/data-privacy-and-retention`.
- **Fix**: add a `pg_cron` job that purges scans older than 90 days; add a test that calls the function with a frozen clock.
- **Status**: open.

## Open — P2

### BL-020 — ESLint rule for "useEffect must declare cleanup or comment"
- **Invariant**: INV-F04.
- **Fix**: custom ESLint rule `require-effect-cleanup-comment`.

### BL-021 — ESLint rule for "no inline <style> or @keyframes in JSX"
- **Invariant**: INV-F05.

### BL-022 — Grep guard for `TESTING_BYPASS = true` in CI
- **Invariant**: INV-X01.
- **Fix**: GitHub Action that fails build if grep matches.

### BL-023 — God files frozen-but-untested
- **Files**: `process-scan/index.ts` (1136 lines), `scan-engine.ts` (841), `SideHustleGenerator.tsx` (798), `VerdictReveal.tsx` (492).
- **Fix**: add at least one snapshot test per file before any future edit.

### BL-024 — `package-lock.json` and `bun.lock` both present
- **Files**: repo root.
- **Fix**: confirm Lovable build command, remove the unused one.

## Open — P3

### BL-030 — React Router v7 future-flag warnings in test output
- **Files**: `src/App.tsx` router config.
- **Fix**: opt into `v7_startTransition` and `v7_relativeSplatPath`.

---

## Done

*(empty — populate as items close, with PR / commit reference)*

---

## How to file a new entry

```
### BL-### — short title
- **Discovered**: <date> · <audit / report>.
- **Files**: <paths>.
- **Invariant**: INV-?? (or "new — proposing INV-??").
- **Fix**: one-paragraph sketch. Don't write the patch here.
- **Owner**: <name or "unassigned">.
- **Status**: open.
```

Bump the next ID monotonically. **Never reuse IDs.** Closed entries stay in the file forever — they document what we shipped.
