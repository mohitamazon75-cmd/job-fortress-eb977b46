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
- **Discovered**: pre-existing (CLAUDE.md Hazard D).
- **Files**: `supabase/functions/_shared/subscription-guard.ts`.
- **Invariant**: INV-X01.
- **Fix**: flip to `false`, run regression on Pro-gated features (defense plan, weaponized resume, coach >5 questions).
- **Status**: open.

### BL-002 — DEV-mode bypass in `activate-subscription`
- **Discovered**: pre-existing (CLAUDE.md Hazard D).
- **Files**: `supabase/functions/activate-subscription/index.ts`.
- **Fix**: gate behind `Deno.env.get("ENVIRONMENT") === "development"` AND require explicit dev-only flag.
- **Status**: open. Consultant scope per CLAUDE.md Rule 3 — coordinate before touching.

### BL-003 — `job-fortress-v2/` parallel codebase
- **Discovered**: pre-existing (CLAUDE.md Hazard A).
- **Risk**: unclear which deploys; risk of fixing the wrong one.
- **Fix**: operator decision — delete or move to branch.
- **Status**: open. Blocks new feature work per CLAUDE.md.

## Open — P1

### BL-010 — `generate-weekly-brief` has no cron
- **Discovered**: pre-existing (CLAUDE.md Hazard E).
- **Fix**: add `pg_cron` schedule (Mondays 06:00 IST) OR remove all UI references to Weekly Briefs.
- **Status**: open.

### BL-011 — Five `.git_old*` directories pollute repo root
- **Discovered**: pre-existing (CLAUDE.md Hazard B).
- **Fix**: archive to a separate branch then delete from main.
- **Status**: open.

### BL-012 — INV-F01 has no automated test (state leaks across scan_id)
- **Discovered**: round 3 audit (this conversation).
- **Files**: `src/pages/ResultsModelB.tsx`.
- **Fix**: add a test that mounts ResultsModelB with scan_id A, switches to B, asserts modal state cleared.
- **Status**: open. Bug itself was fixed in round 3 batch C1 — only the regression test is missing.

### BL-013 — INV-F02 has no automated test (streak reset on day-skip)
- **Discovered**: round 3 audit.
- **Files**: `src/hooks/useStreak.ts` (or wherever streak lives).
- **Fix**: add a test mocking `Date.now()` 3 days forward; assert streak resets to 1.
- **Status**: open. Bug fixed in round 3 — only the test is missing.

### BL-014 — INV-F03 has no automated test (progressPct uses visitedCards.size)
- **Discovered**: round 3 audit.
- **Fix**: unit test for the progress calculation.
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
