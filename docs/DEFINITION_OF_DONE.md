# Definition of Done

> **Why this exists**: For three audit rounds, "done" meant "the AI re-read the file and tsc passed". That's why round 2 introduced bugs that round 3 then "discovered". This file makes "done" mechanically checkable so regressions cannot silently ship.

A change is **not done** until every box below is ticked. No exceptions for "small" changes — small changes are where regressions hide.

---

## The gates (in order)

### 1. The change has a written contract
- [ ] If it changes scoring, display, lifecycle, security, monetization, or tone: an invariant in `docs/INVARIANTS.md` exists or has been updated.
- [ ] If it fixes a bug from `docs/BACKLOG.md`: that entry is updated with the PR/commit and moved to **Done**.
- [ ] If it introduces a new category of behavior the checklist doesn't cover: a new section in `docs/AUDIT_CHECKLIST_v1.md` is proposed.

### 2. The change is covered by a test
- [ ] At least one new or updated test in `src/test/` (or `src/test/invariants.test.ts` for cross-system contracts).
- [ ] The test **fails before the fix and passes after**. (Confirm by reverting, running, then re-applying.)
- [ ] Edge function changes have a corresponding `*_test.ts` invoked via the Deno test runner.

### 3. The change builds and runs cleanly
- [ ] `bun run lint` — output included in PR description, zero errors.
- [ ] `bun run test` — output included, all green, no `.skip` added without a `// TODO(BL-###)` comment.
- [ ] `bun run build` — output included, succeeds.
- [ ] `npx tsc --noEmit` — zero errors.

### 4. The change has been exercised, not just compiled
- [ ] If frontend: a screenshot or screen recording of the new flow on the preview URL.
- [ ] If edge function: a `curl` against the deployed function with the response pasted into the PR.
- [ ] If migration: SQL output of the table state before and after.

### 5. The change respects scope
- [ ] No unrelated refactors. Diff size is the *minimum* needed to satisfy the test.
- [ ] No files >500 lines were edited (per CLAUDE.md Rule 3) without a `docs/DECISIONS.md` note.
- [ ] No file in `_shared/det-*.ts`, `agent-prompts.ts`, `zod-schemas.ts`, `migrations/`, or payment paths was touched without a separate explicit confirmation.

### 6. The change clears the regression list
- [ ] Walked through `docs/claude-code/03_REGRESSION_PREVENTION.md` (if applicable to the touched area).
- [ ] No new entry was added to `docs/BACKLOG.md` *during* this PR. (If you found new issues, log them as P-?? with status `open` — do NOT fix in the same PR.)

---

## What "done" is not

- ✘ "I read the file again and it looks right."
- ✘ "tsc passed."
- ✘ "I asked a follow-up audit and it didn't find issues this round."
- ✘ "The user said it works."

---

## CI enforcement (target state — see BL-022)

These should eventually block merge automatically:

- `bun run lint && bun run test && bun run build` is a required check.
- A grep guard fails the build if `TESTING_BYPASS = true` ships to production.
- A grep guard fails the build if `<style>` or `@keyframes` appear in `.tsx` files.
- A coverage check requires every changed file in the diff to have at least one test.

Until CI exists, this list is enforced by reviewer (human or AI). Anyone who marks a change "done" without this list is creating future audit work.

---

## The metric we are optimizing

> **Audit equilibrium**: when running `AUDIT_CHECKLIST_v1.md` produces ≤3 new findings two audits in a row, *and those findings are genuinely new categories* (not rediscoveries of fixed bugs).

When we hit that, the perpetual audit loop is broken — for real, structurally, not by virtue of one heroic sweep.
