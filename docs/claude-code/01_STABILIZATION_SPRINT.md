# 01 — Stabilization Sprint

> This sprint comes BEFORE any new-feature work. 2–4 weeks depending on operator availability. Claude Code executes these in order. Do not start Sprint B until Sprint A is signed off.

---

## Sprint A — Repo Hygiene (Week 1)

These are decisions + deletions. Fast, but high-leverage.

### A1. Resolve `job-fortress-v2/`
**Who decides**: human operator (not Claude Code).
**Question**: Is v2 a planned replacement, a scratch area, or abandoned?

Three possible actions:
- **If abandoned**: `rm -rf job-fortress-v2/`, commit with message "Remove abandoned v2 parallel codebase"
- **If planned replacement**: move to its own git branch (`git checkout -b v2-migration`, preserve there, remove from main)
- **If scratch**: move to a separate repo or out-of-tree folder

**Claude Code's role**: Do not touch v2 until operator has decided. When operator gives the decision, execute it exactly.

### A2. Remove `.git_old*` backup directories
After A1 is resolved:
```
rm -rf .git_old .git_old3 .git_old4 .git_old5 .git_ux_final
```
Commit message: "Remove legacy git-folder backups from pre-rebrand period"

These are not useful — if something from the old history is genuinely needed, it's in git reflog, not in these folders.

### A3. Clean up KidSutra residue
- Delete `.lovable/bugs.md` (KidSutra bug tracker)
- `grep -ri "KidSutra\|kidsutra\|KidVital\|kidvital" .` — replace or remove every remaining reference
- Do this in one PR, verify build still works

### A4. Replace the stale `CLAUDE.md`
The existing `CLAUDE.md` at repo root describes a Next.js project that doesn't exist. Replace it with the new one in this package.

### A5. Add the `docs/claude-code/` package
Copy the four docs from this package into `docs/claude-code/` in the repo:
- `00_CURRENT_REALITY.md`
- `01_STABILIZATION_SPRINT.md` (this file)
- `02_NEW_IP_ROADMAP.md`
- `03_REGRESSION_PREVENTION.md`

### A6. Unify lockfiles
Currently both `bun.lock`, `bun.lockb`, and `package-lock.json` exist. Pick one (recommended: `bun.lockb`), delete the others, and document in `CLAUDE.md` which package manager is canonical.

### Sprint A acceptance criteria
- [ ] v2 question resolved
- [ ] `.git_old*` dirs removed
- [ ] KidSutra references purged
- [ ] New `CLAUDE.md` in place
- [ ] `docs/claude-code/` populated
- [ ] Lockfiles unified
- [ ] `bun install` and `bun run build` both succeed cleanly

---

## Sprint B — Test Infrastructure (Week 1–2)

**Goal**: `bun run test` actually executes and runs all 15+ existing test files.

### B1. Fix the test runner
```bash
bun install
bun run test
```

If `vitest` is missing, `bun install` should fix it. If not, diagnose and repair.

### B2. Run the existing test suite
Identify which tests pass, which fail, which error out.

For failing tests, the default action is: fix the test (not the code it tests), unless the test reveals a real bug. Document findings in `docs/claude-code/TEST_STATE.md`.

### B3. Make test output a first-class citizen
- Configure CI (GitHub Actions or Lovable's CI) to run `bun run test` and `bun run build` on every push
- Any failing test blocks merge
- Document in `.github/workflows/ci.yml`

### B4. Coverage targets (not aspirational — enforced)
- **Scoring engine** (`_shared/det-*.ts`, `src/lib/stability-score.ts`, `src/lib/scan-engine.ts`): 80% coverage minimum, because this is the IP
- **Edge functions**: at least one integration test per edge function from this short list: `create-scan`, `process-scan`, `activate-subscription`, `razorpay-webhook`, `ai-dossier`, `run-pivot-analysis`
- **Everything else**: smoke tests only

### Sprint B acceptance criteria
- [ ] `bun run test` exits 0
- [ ] All existing tests pass OR are documented as skipped with reasons
- [ ] CI pipeline runs tests on every PR
- [ ] Scoring-engine coverage ≥ 80%
- [ ] Critical-path edge functions have at least one integration test each

---

## Sprint C — P0 Security Fixes (Week 2–3)

**Source of truth**: `_audit/MASTER_AUDIT_REPORT.md`. Execute all P0 items. Do not invent new fixes.

### C1. Payment-bypass P0s (must-fix before any paid launch)
- **P0-SEC-01**: Remove DEV MODE fallback in `activate-subscription/index.ts:78-82`. Fail hard when Razorpay keys are absent.
- **P0-SEC-02**: Fix tier-escalation idempotency bug in `activate-subscription/index.ts:67-72`. Verify both `payment_id` AND `plan_type` match.
- **P0-SEC-03** (and subsequent prompt-injection P0s): Address each per the audit's recommended fix.

### C2. Subscription enforcement
**Only after all P0 fixes and at least one successful end-to-end Razorpay test payment:**
1. Flip `TESTING_BYPASS = false` in `_shared/subscription-guard.ts`
2. Verify each Pro-gated function refuses free users and shows upgrade UI (not a silent error)
3. Test with: one free account, one Pro account, one expired-Pro account

**Do not flip this flag in the same PR as code changes.** It should be its own change, with its own rollback path.

### C3. Razorpay order-creation
This is marked "consultant scope" in the team's own docs. Claude Code does not build it. When the consultant's code lands, Claude Code reviews it per `docs/claude-code/03_REGRESSION_PREVENTION.md`.

### C4. Wire `generate-weekly-brief` cron
- Add a `pg_cron` schedule in a new migration targeting the edge function endpoint
- Weekly frequency (e.g., Sundays 9am IST)
- Add a manual-trigger admin route for testing
- Document in `ENGINEERING_STATUS.md`

### C5. Remaining 13 P0 items
Walk through `_audit/MASTER_AUDIT_REPORT.md` line by line. For each:
- Verify whether the code still exhibits the issue (code may have changed)
- If still present, fix per audit recommendation
- If already fixed, mark resolved in the audit doc
- Commit each fix as its own PR with a reference to the audit item ID

### Sprint C acceptance criteria
- [ ] All 13 P0 items from `MASTER_AUDIT_REPORT.md` resolved or documented as not-applicable
- [ ] `TESTING_BYPASS = false` in prod
- [ ] Pro gating verified working with real test accounts
- [ ] Weekly Brief cron firing (log evidence in `ENGINEERING_STATUS.md`)
- [ ] Razorpay consultant work landed and reviewed

---

## Sprint D — Observability & Operational Readiness (Week 3–4)

### D1. Error alerting that actually alerts
- `edge_function_logs` and `monitoring_alerts` tables exist but nothing notifies humans.
- Add a Slack or email webhook triggered when error rate exceeds threshold
- Document threshold and on-call procedure in `docs/OPS_RUNBOOK.md`

### D2. Cost guard verification
- `_shared/spending-guard.ts` and `_shared/token-tracker.ts` exist
- Verify they actually halt AI calls when limits are exceeded
- Add daily spend visibility to admin dashboard

### D3. Scan success-rate dashboard
Given 43% recent failure rate, a live success-rate view is essential:
- Admin-only page showing scan completion rate by day × profile source
- Alert if rate drops below 80%

### D4. Data retention and user deletion
- `delete-my-data` edge function exists; verify it actually deletes everything
- Document GDPR/DPDP compliance posture in `docs/PRIVACY.md`
- Add a consent log for opt-in features

### Sprint D acceptance criteria
- [ ] Error alerting live and tested (trigger a deliberate error, confirm alert fires)
- [ ] Spend guards verified
- [ ] Admin success-rate dashboard live
- [ ] Data-deletion flow verified
- [ ] `OPS_RUNBOOK.md` written

---

## Sprint E (optional — Week 4) — Consolidation

Only execute if Sprints A–D finish ahead of schedule. The goal is to reduce surface area, not add it.

### E1. Card consolidation review
12 cards + 4 tabs + standalone features = too much. Walk through each with the operator and honestly answer: which produce real user engagement, and which are dead weight?

Candidates for removal (based on complexity and non-core status):
- Career Resilience Engine (overlaps Defense Plan)
- RiskIQ (alternative flow that duplicates main scan)
- Fake-it edge function (`fake-it/` — unclear purpose)

**Removal is a feature.** Simpler product = more reliable + easier to sell.

### E2. Edge-function audit
79 edge functions is excessive. Identify functions with zero invocations in the last 30 days and delete.

### E3. Dependency audit
Review `package.json` — are all dependencies actually used? Tools like `depcheck` can flag candidates for removal.

### Sprint E acceptance criteria
- [ ] Dead features removed (at least 2 cards or 10 edge functions)
- [ ] Unused dependencies removed
- [ ] Build size reduced measurably

---

## Claude Code execution protocol for this sprint

For each task above:
1. Claude Code proposes a concrete plan (what files, what changes, what tests)
2. Human operator approves or redirects
3. Claude Code executes on a feature branch
4. Claude Code shows verification evidence (test output, build output, manual verification)
5. Human operator reviews and merges
6. Claude Code updates this document with `[x]` on the completed item

**Do not batch multiple sprints into one session.** Each sprint gets its own session, its own PR series, its own signed-off milestone.

---

## What Claude Code should NOT do during the Stabilization Sprint

- Add new features
- Add new cards, tabs, or edge functions
- "Improve" existing code that isn't listed above
- Refactor god files
- Change the deterministic scoring engine
- Modify agent prompts
- Add new dependencies
- Change the UI design system

If in doubt, ask the operator.
