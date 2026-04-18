# Sprint B Plan — Test Infrastructure

> Planning doc written 2026-04-18 (Saturday evening) to front-load investigation before Monday's execution session.
> Read alongside `docs/claude-code/01_STABILIZATION_SPRINT.md` Sprint B and `docs/claude-code/WEEKEND_PROGRESS.md`.

## One-line status

Sprint B is **not yet started**. Tonight's investigation confirmed the test runner issue is a missing-dependency problem (not a misconfiguration), surfaced a runtime-split the original sprint doc underestimated, and identified one gating decision that must be resolved before any install commands run on Monday.

---

## 1. Current state (as of 2026-04-18, pre-execution)

### Dev machine
- **`bun` is NOT installed locally.** `which bun` returns nothing; `bun --version` → `command not found`.
- **`npm` 11.9.0 and `node` v24.14.0 are available.**
- **`node_modules/` does not exist at the repo root.** Nothing has ever been installed on this machine for this checkout. That — not a vitest config problem — is why `bun run test` fails today.

### Repo state
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- `vitest` `^3.2.4` declared as a devDependency.
- `vitest.config.ts` present and valid: `jsdom` environment, `globals: true`, `setupFiles: ["./src/test/setup.ts"]`, `include: ["src/**/*.{test,spec}.{ts,tsx}"]`, `@` aliased to `./src`.
- `src/test/setup.ts` exists.
- Testing libraries declared: `@testing-library/jest-dom ^6.6.0`, `@testing-library/react ^16.0.0`, `jsdom ^20.0.3`.
- Both `bun.lock` and `package-lock.json` exist (A6-Step-B unresolved per `WEEKEND_PROGRESS.md`).

### Test file inventory — 21 files across TWO runtimes
- **Frontend tests (vitest-compatible) — 7 files:**
  - `src/lib/display-utils.test.ts`
  - `src/test/arch04-analytics.test.ts`
  - `src/test/display-utils.test.ts`
  - `src/test/example.test.ts`
  - `src/test/llm02-json-validation.test.ts`
  - `src/test/physical-scoring.test.ts`
  - `src/test/useScanFlow.test.ts`
- **Supabase edge function tests (Deno-native, NOT picked up by vitest config) — 14 files:**
  - `supabase/functions/_shared/det-orchestrator.test.ts`
  - `supabase/functions/process-scan/process-scan.test.ts`
  - `supabase/functions/tests/ai-agent-caller.test.ts`
  - `supabase/functions/tests/capture-outcome.test.ts`
  - `supabase/functions/tests/det-orchestrator.test.ts`
  - `supabase/functions/tests/outcome-followup.test.ts`
  - `supabase/functions/tests/scan-cache.test.ts`
  - `supabase/functions/tests/scan-pipeline-paths.test.ts`
  - `supabase/functions/tests/scan-pipeline.test.ts`
  - `supabase/functions/tests/scan-rate-limiter.test.ts`
  - `supabase/functions/tests/scan-report-builder.test.ts`
  - `supabase/functions/tests/side-hustle-comparison.test.ts`
  - `supabase/functions/tests/side-hustle-consistency.test.ts`

> **Sprint B doc underestimation.** `01_STABILIZATION_SPRINT.md` describes "15+ existing test files" and implies one runner. Reality: 21 tests split across vitest (frontend, Node/jsdom) and Deno (edge functions). These cannot share a runner. This plan splits B1 into **B1a (vitest)** and **B1b (Deno)** accordingly.

---

## 2. Gating decision — A6-Step-B (must resolve FIRST on Monday)

Before anything else runs on Monday, we need to know what Lovable actually executes during deploy. Per `WEEKEND_PROGRESS.md`:

> Before deleting `package-lock.json`, we need a Lovable deploy log to confirm whether Lovable runs `bun install` or `npm ci`.

Every downstream Sprint B step depends on this. Rationale:
- If Lovable runs `bun install`, the dev machine must install Bun so local reproducibility matches prod. CI must also use Bun.
- If Lovable runs `npm ci`, installing Bun locally is wasted effort and a second source of lockfile drift. CI must use npm.

Picking the wrong runner here means the lockfile we keep diverges from the one Lovable reads — exactly the kind of mismatch A6-Step-B exists to prevent.

### Monday's FIRST task (pre-B1)
Pull a recent Lovable deploy log from the Lovable dashboard (not a Claude Code task — operator action, or operator-supervised Lovable chat read-only query). Record the answer in one sentence in `WEEKEND_PROGRESS.md` "Deferred work" section and in this doc's "Confirmed vs unknown" table (§7).

No `install` or `test` command runs on the dev machine until this is answered.

### How to pull the Lovable deploy log
Concrete click-path for the operator (or supervised Lovable read-only session):

1. Open the Lovable project dashboard: https://lovable.dev/projects/447d9360-7d33-49f1-9d70-9f41c8fb142e
2. Look for a **Deployments**, **Builds**, or **Logs** tab. Likely locations, in order: top navigation bar, sidebar, or the project's three-dots (⋯) overflow menu.
3. Find the most recent deploy. It should correspond to one of today's PR merges (PRs #1–#5, most recently `cb34d11` — the lockfile unification merge).
4. Open the deploy's build log. Use the log's search/find function (⌘F in browser) and search for, in order: `bun install`, `npm ci`, `npm install`. Whichever matches first is the authoritative command.
5. **Record the actual line verbatim** — copy the full line as it appears in the log (including flags, working directory, any surrounding context line). Do not paraphrase or summarize. Paste it into `WEEKEND_PROGRESS.md` "Deferred work" section and into §7 of this doc.
6. **Fallback if the Logs tab cannot be found or the log is unreadable:** ask Lovable's AI chat in strict read-only mode. Exact prompt to use:

   > "What command do you run to build this project? Please answer read-only, do not edit any code or push anything."

   If Lovable's chat responds with anything other than a plain answer (e.g. offers to "fix" or "refactor"), dismiss and do not accept any edits. Per `WEEKEND_PROGRESS.md` "Lovable auto-push observation", Lovable's AI must not make code changes.

---

## 3. B1 — Get the vitest suite executing (two scenarios)

The vitest test logic is identical across both scenarios. What changes is exactly one tool on the dev machine.

### Scenario A — Lovable uses Bun
1. Install Bun via Homebrew: `brew install oven-sh/bun/bun` (operator confirms; Claude Code does not install system-wide without approval).
2. Verify: `bun --version` → expect 1.2+.
3. From repo root: `bun install` (reads `bun.lock`).
4. Run: `bun run test`.
5. Capture full output. Expected: vitest starts, runs 7 test files, reports pass/fail per file.
6. If all pass → proceed to B2. If any fail → see §4 (B1 failure handling).
7. A6 follow-up: in a separate PR, delete `package-lock.json`, document `bun.lock` as sole canonical lockfile.

### Scenario B — Lovable uses npm
1. No install of Bun. Dev machine uses existing `npm` 11.9.0 / `node` 24.14.0.
2. From repo root: `npm ci` (reads `package-lock.json`).
3. Run: `npm test` (resolves to `vitest run`, same as `bun run test`).
4. Capture full output. Expected: vitest starts, runs 7 test files, reports pass/fail per file.
5. If all pass → proceed to B2. If any fail → see §4 (B1 failure handling).
6. A6 follow-up: in a separate PR, update `CLAUDE.md` to record that Lovable runs `npm ci` (evidence: deploy log from [date captured in §2]), therefore `package-lock.json` is canonical and `bun.lock` is removed in this follow-up. PR #4 correctly inferred `bun.lock` as canonical based on git-history evidence available at the time; the deploy log is newer, authoritative evidence that supersedes it. References: PR #4 and the deploy log.

### B1 acceptance (scenario-independent)
- `<runner> run test` exits 0 (or documents skipped tests with reasons).
- Test output captured in a new `docs/claude-code/TEST_STATE.md` per Sprint B2.
- One PR: dependency install verification + `TEST_STATE.md`. No test logic changes in this PR.

---

## 4. B1 failure handling (if any vitest test fails)

Default action per Sprint B2: **fix the test, not the code it tests**, unless the test reveals a real bug. For each failure:
1. Read the test and the code it exercises.
2. Classify: stale test (snapshot/assertion out of date), broken dependency mock, or genuine regression.
3. Stale/broken → fix the test in a small PR.
4. Genuine regression → STOP, surface to operator, do not patch silently.
5. Record classification for each failing file in `TEST_STATE.md`.

No test is deleted without operator approval.

---

## 5. B1b — Deno edge function tests (separate track, blocked)

14 tests under `supabase/functions/` use Deno's native test runner (`Deno.test(...)`). They cannot run under vitest. This track is **blocked** until two decisions land:

1. **Local execution**: install Deno on the dev machine? (Deno is a separate runtime; not bundled with Bun or npm.)
2. **CI execution**: does Lovable's CI support running Deno tests, or do we run them in GitHub Actions separately?

Until these are answered, B1b is paused. B1 (vitest) can proceed independently of B1b — they share no code, only the Sprint B "get tests running" banner.

Proposed B1b plan (for Monday discussion, not execution):
- Install Deno locally via `brew install deno`.
- Pick a runner convention: `deno test supabase/functions/` or a `deno.json` task.
- Add a second script to `package.json`: `"test:edge": "deno test supabase/functions/"` so `npm test` stays frontend-only and edge tests are explicit.
- CI adds a second job that installs Deno and runs `npm run test:edge`.

Acceptance for B1b: `npm run test:edge` (or equivalent) exits 0, results logged in `TEST_STATE.md` under a separate "Edge function tests" section.

---

## 6. B2, B3, B4 — post-B1, separate PRs

All three are described in `01_STABILIZATION_SPRINT.md` Sprint B. Summarized here with Monday scope notes, NOT executed as part of B1.

### B2 — Document test state
- New file: `docs/claude-code/TEST_STATE.md`.
- Sections: "Frontend (vitest)" and "Edge functions (Deno)".
- For each test file: pass/fail/skipped, one-line reason if not passing.
- PR: doc-only, lands immediately after B1 run is captured.

### B3 — CI pipeline
- New file: `.github/workflows/ci.yml`.
- Jobs: `lint` (`<runner> run lint`), `test` (frontend vitest), `build` (`<runner> run build`). `test:edge` added once B1b is unblocked.
- Branch protection: all three jobs required for merge into `main`. (Branch protection edit is an operator action via GitHub settings — Claude Code does not touch repo admin.)
- PR: CI config only. Must land AFTER B2 so we know which tests are currently green before making green-ness a merge gate.

### B4 — Coverage targets
- Scoring engine (`_shared/det-*.ts`, `src/lib/stability-score.ts`, `src/lib/scan-engine.ts`): 80% minimum.
- Note: CLAUDE.md §3 Rule 3 forbids modifying `_shared/det-*.ts` without explicit approval — so this is a coverage-measurement task, not a code-change task. If coverage is below 80%, surface the gap to operator before writing new tests that would touch these files.
- Critical-path edge functions (per sprint doc list): `create-scan`, `process-scan`, `activate-subscription`, `razorpay-webhook`, `ai-dossier`, `run-pivot-analysis`. Each gets at least one integration test. Several are payment-path and touch Rule-3-forbidden code — surface before writing.
- PR: one per edge function. Do NOT batch.

---

## 7. What tonight's investigation confirmed vs. what remains unknown

| Topic | Status | Evidence / Source |
|---|---|---|
| `bun` installed on dev machine | **Confirmed absent** | `which bun` empty; `bun --version` → command not found |
| `npm`/`node` available on dev machine | **Confirmed present** | `npm 11.9.0`, `node v24.14.0` |
| `node_modules/` exists | **Confirmed absent** | `ls node_modules` → no such directory |
| `vitest` declared in package.json | **Confirmed present** | `"vitest": "^3.2.4"` in devDependencies |
| `vitest.config.ts` valid | **Confirmed present + valid** | File read; includes `src/**/*.{test,spec}.{ts,tsx}` |
| Frontend test file count | **Confirmed: 7** | Glob `src/**/*.test.{ts,tsx}` |
| Edge function test file count | **Confirmed: 14** | Glob `supabase/functions/**/*.test.ts` |
| Whether vitest catches all 21 tests | **Confirmed: NO — only 7** | `include` glob is `src/**/*` — Supabase dir excluded |
| What Lovable actually runs on deploy (`bun install` vs `npm ci`) | **Unknown** | Not verifiable without a Lovable deploy log |
| Whether existing vitest tests currently pass | **Unknown** | Cannot run without `node_modules` — pending B1 |
| Whether Deno edge tests currently pass | **Unknown** | Deno not installed; no runner decision yet |
| Whether Lovable CI supports Deno tests | **Unknown** | Not investigated — B1b blocker |
| Whether scoring-engine coverage is already at 80% | **Unknown** | Coverage never measured — pending B4 |

---

## 8. Monday-morning resume sequence

Copy-paste, in order. Stop at each STOP line.

```
cd /Users/mohit/Downloads/job-fortress-eb977b46
git checkout main
git pull origin main
claude
```

Then tell the session:

> "Resuming Sprint B per `docs/claude-code/SPRINT_B_PLAN.md`. First task: A6-Step-B — identify whether Lovable runs `bun install` or `npm ci`. I will pull a Lovable deploy log and report back before we install anything locally."

**STOP 1** — do not install anything until the operator has reported the Lovable deploy-log finding. Record the answer in `WEEKEND_PROGRESS.md` and §7 of this doc (flip the "Unknown" row to "Confirmed").

Once the runner is known:

- **If Bun**: `brew install oven-sh/bun/bun` → confirm version → `bun install` → `bun run test` → capture output.
- **If npm**: `npm ci` → `npm test` → capture output.

**STOP 2** — do not proceed to B2 until the B1 test output is pasted into chat and reviewed. Failing tests get classified per §4 before any fix is written.

After B1 is green (or documented):

- Write `docs/claude-code/TEST_STATE.md` (B2) — one PR.
- Write `.github/workflows/ci.yml` (B3) — one PR, lands AFTER B2.
- Measure coverage, surface gaps (B4) — one PR per edge function.

B1b (Deno) is paused until operator decides on the Deno-in-CI question (§5).

---

## 9. Out of scope for Sprint B

Per CLAUDE.md and the stabilization sprint doc, Sprint B does NOT include:
- Fixing the 43% scan failure rate (Sprint C material).
- Flipping `TESTING_BYPASS = false` (Sprint C, consultant-gated).
- Wiring the `generate-weekly-brief` cron (Sprint C).
- Refactoring god files (explicitly forbidden by CLAUDE.md §1 Hazard F).
- Modifying `_shared/det-*.ts`, `_shared/agent-prompts.ts`, `_shared/zod-schemas.ts`, migrations, or payment path (CLAUDE.md §2 Rule 3).
- Adding new dependencies beyond test infrastructure (CLAUDE.md §2 Rule 9).

If any of these surface during B1/B2/B3/B4 execution, log in `docs/BACKLOG.md` and surface — do not fix in Sprint B PRs.
