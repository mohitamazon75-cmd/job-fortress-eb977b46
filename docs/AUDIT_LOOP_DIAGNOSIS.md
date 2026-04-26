# Audit Loop Diagnosis — 2026-04-26

## TL;DR
You are **not** stuck in a structural audit loop. Four of the five root
causes are already fixed. One remains: **there is no CI gate enforcing
your existing tests, lint, and build on every change.** That single gap
is enough to silently re-break already-fixed invariants between audits —
which is the failure mode you're trying to prevent before going live.

This is a **one-session** fix, not a five-session program.

## Root Causes Detected

| # | Cause | Status | Evidence |
|---|---|---|---|
| 1 | No written invariants | **ABSENT** | `docs/INVARIANTS.md` exists; `src/test/invariants.test.ts` exists and passes |
| 2 | Test runner broken | **ABSENT** | `bun run test` → **238/238 frontend tests passing** (13 files, 9.41s); `vitest@3.2.4` installed; Deno engine tests **21/21 passing** |
| 3 | Unbounded audit scope | **ABSENT** | `docs/AUDIT_CHECKLIST_v1.md` exists; `docs/BACKLOG.md` exists |
| 4 | No CI Definition of Done | **PRESENT** | `.github/` directory does **not exist** — no workflows, no CODEOWNERS, no PR test/build/lint gate. `docs/DEFINITION_OF_DONE.md` exists on paper but nothing enforces it. |
| 5 | Cruft factories | **ABSENT** | No `.git_old*` / `_backup` / `*-v2` / `-legacy` directories. No `TESTING_BYPASS`, `SKIP_AUTH`, `DISABLE_RLS`, `BYPASS_AUTH`, or `DEV_USER_ID` references anywhere. `ENFORCE_PRO` is a deliberate env-switch (CLAUDE.md Hazard D, intentional pre-PMF). God files exist but are documented, frozen, and explicitly accepted in CLAUDE.md §1 Hazard F — they are not bug factories, they are scope freezes. |

### Note on prior hazards
Per `CLAUDE.md`, Hazards A, B, C, E are all marked RESOLVED (job-fortress-v2
deleted, .git_old* deleted, vitest runs, weekly-brief cron wired). Today's
diagnostic checks confirm those resolutions independently. Hazard D
(`ENFORCE_PRO=off`) is a documented business decision, not a defect.

## The Fix Plan — 1 Session

Only one cause is PRESENT. Skip Sessions 1–3 (already done). Session 4
already shipped. Run Session 5 only.

### Session 5 — CI gates + god-file freeze enforcement  *(if Cause 4 detected)*

**Goal:** Make the existing Definition of Done actually block bad merges,
so the next audit doesn't have to rediscover regressions that are already
fixed.

**Concrete deliverables:**

1. **`.github/workflows/ci.yml`** — runs on every push and PR:
   - `bun install --frozen-lockfile`
   - `bun run lint` — must exit 0
   - `bun run test` — full vitest suite (238 tests, currently green)
   - `bun run build` — production Vite build (currently 15s)
   - Deno test step: `deno test --allow-net --allow-env --allow-read --no-check supabase/functions/tests/ supabase/functions/get-model-b-analysis/score-anchor.test.ts supabase/functions/process-scan/process-scan.test.ts` — covers the 21 engine + regression-replay + calibration tests
2. **`.github/workflows/guard.yml`** — runs the existing
   `scripts/guard-no-bypass.sh` so any future re-introduction of
   `TESTING_BYPASS` / `SKIP_AUTH` / `DISABLE_RLS` patterns fails CI.
3. **`.github/CODEOWNERS`** — flag the protected paths from CLAUDE.md §3
   Rule 3 (`supabase/functions/_shared/det-*.ts`,
   `_shared/agent-prompts.ts`, `_shared/zod-schemas.ts`,
   `supabase/migrations/`, `activate-subscription/`, `razorpay-webhook/`,
   `subscription-guard.ts`) so PRs touching them require explicit review.
4. **God-file freeze guard** — small `scripts/guard-god-files.sh` that
   fails CI if any of the four CLAUDE.md §1 Hazard F god files
   (`process-scan/index.ts`, `scan-engine.ts`, `SideHustleGenerator.tsx`,
   `VerdictReveal.tsx`) grows beyond its currently-accepted line count
   without an explicit override label.
5. **PR template** at `.github/pull_request_template.md` mirroring
   `docs/DEFINITION_OF_DONE.md` (lint/test/build/regression-checklist).

**Deliverable acceptance:** open a no-op PR; CI runs lint + frontend
tests + Deno engine tests + build + bypass guard + god-file guard, all
green. A PR that adds `// TESTING_BYPASS = true` fails CI. A PR that
grows `process-scan/index.ts` to 1,400 lines fails CI.

**Out of scope for this session:**
- Razorpay smoke test (lives behind `ENFORCE_PRO` flip — separate decision)
- Branch protection rule configuration (must be done by repo admin in
  GitHub UI; CI files alone don't enable enforcement)
- Cypress / Playwright E2E (not needed for loop-break; vitest +
  regression-replay already covers the critical paths)

## What This Does NOT Fix

- Product-market fit
- Existing UX / narrative decisions
- Features that shouldn't exist
- The `ENFORCE_PRO=off` business decision (intentional, not a defect)
- The client-vs-server score band drift documented in the most recent
  E2E QA pass (it's calibration, not a bug — backlog item, not a blocker)

This fixes the *audit loop ignition risk*, not product judgment.

## Why this is honest about "one final pass before go-live"

You asked for a final pass. The honest answer is:

- The four expensive structural causes of audit loops are already
  closed in this repo. You did the hard work in earlier rounds.
- The one remaining gap (CI) is the difference between "we have a
  Definition of Done" and "the Definition of Done is enforced."
  Without it, the very next merge can silently undo the P0/P1
  fixes from the last audit cycle and the next sweep will
  "rediscover" them — which is the exact loop this skill exists
  to prevent.
- Closing it before go-live is cheap (one CI file + one CODEOWNERS
  file + two small guard scripts) and removes the single highest-
  leverage source of post-launch regression noise.

## Next Step

Reply `start session 5` to begin. I will:
1. Write the CI workflow, CODEOWNERS, PR template, and god-file guard.
2. Run the guards locally to confirm they pass on the current tree
   (and fail on a synthetic violation).
3. Stop and hand back for review before anything else.

Anything beyond Session 5 — Razorpay smoke, E2E browser, branch
protection — is a separate decision. I will not auto-continue.
