# 03 — Regression Prevention (Specific to JobBachao)

> Claude Code follows this protocol on every change. No exceptions. No "small fix" escape hatches.

---

## The four principles

1. **Surface-area discipline** — change the minimum necessary, in the smallest scope
2. **Observable changes** — every change produces evidence (test, log, flag state) proving it worked and showing how to roll it back
3. **Reversible deploys** — every change can be rolled back in under 5 minutes without data loss
4. **Evidence over assertion** — never "it should work" or "this is done" without proof

---

## The untouchable core

The following files/areas are **special**. Any change requires explicit human approval in the PR description, not just default session approval.

### Scoring engine (the IP moat)
- `_shared/det-*.ts` (all 6 files)
- `src/lib/stability-score.ts`
- `src/lib/scan-engine.ts`
- `src/lib/unified-skill-classifier.ts`

Why untouchable: This is the deterministic, reproducible scoring that makes JobBachao defensible. Any change alters user-facing scores. Any user-facing score change invalidates historical comparisons.

**Protocol for changes**: Must include golden-test suite showing before/after score for 20 seeded inputs. Any score change >2 points for any seeded input requires operator sign-off.

### Agent prompts
- `_shared/agent-prompts.ts`
- `_shared/zod-schemas.ts`

Why: These were audit-tuned in cycle 2026-04-07 with anti-hallucination rules and grounded fields. Casual edits break the work.

**Protocol for changes**: Document in PR the specific failure mode being addressed, link to audit item if relevant, A/B test the old vs new prompt on ≥50 real inputs before shipping.

### Payment path
- `activate-subscription/index.ts`
- `razorpay-webhook/index.ts`
- `subscription-guard.ts`
- `create-scan/index.ts` (payment gating)

Why: This is consultant scope per operator direction. Bugs here = revenue loss or legal exposure.

**Protocol for changes**: Claude Code does not touch these unless operator explicitly instructs. If a change is needed, it goes through the consultant. Claude Code can REVIEW consultant PRs using this doc as the checklist.

### Database migrations
- `supabase/migrations/*.sql`

Why: Append-only, ordered by timestamp. A bad migration affects every environment.

**Protocol for changes**: Never edit existing migration files. Only add new ones. Forward migration MUST have a documented reverse (even if reverse is "accept data loss").

---

## Pre-change checklist (before writing any code)

Claude Code must complete this before touching any file:

- [ ] I have read the relevant phase doc (`01_STABILIZATION_SPRINT.md` or `02_NEW_IP_ROADMAP.md`)
- [ ] I have read every file I intend to modify, fully — not just the region being changed
- [ ] I have searched for all usages of any function/component I'm changing (`grep -r` or `rg`)
- [ ] I have identified the minimum set of files that need changing
- [ ] None of the files are in the "untouchable core" list above, OR the operator has explicitly approved
- [ ] I have written a one-paragraph plan in the PR description
- [ ] I have created a feature branch (never work on main)
- [ ] I have confirmed `job-fortress-v2/` and `.git_old*/` are NOT in my change set

If any item fails, STOP and ask.

---

## During-change checklist

- [ ] Adding new files rather than modifying, where possible
- [ ] When modifying, changing the minimum lines
- [ ] NOT renaming, restyling, or refactoring unrelated code
- [ ] NOT adding dependencies without explicit approval
- [ ] New user-facing code is behind a feature flag (default OFF in prod)
- [ ] Writing tests as I go (TDD preferred)
- [ ] Using Zod validation at any new data boundary
- [ ] Following existing taste (shadcn, semantic tokens, Framer Motion, etc.)
- [ ] Edge function: using `_shared/edge-logger.ts` for logging, `_shared/*-guard.ts` for rate/spend limits

---

## Pre-merge checklist (before claiming "done")

Run these and paste output into the PR:

- [ ] `bun run lint` — no new errors (show output)
- [ ] `bun run test` — all tests pass (show output, not just "it worked")
- [ ] `bun run build` — succeeds (show output)
- [ ] Manual test of the changed flow described (screenshots, curl logs, or test account walkthrough)
- [ ] Existing critical flows still work (run the smoke tests below)

### Regression smoke tests — run after every change

1. **Landing page loads** — `curl -I https://job-fortress.lovable.app` → 200
2. **Auth flow** — create test account, verify email flow reaches inbox (or uses auto-confirm in staging)
3. **Scan flow end-to-end** — paste a LinkedIn URL or upload a resume, scan completes in <180s, returns a score in the 5–95 range, renders all 12 cards
4. **Pro gating works** — free account hits upgrade UI on Pro cards, Pro account passes through
5. **Razorpay flow** — test checkout initiates (actual payment not required in staging)
6. **No new errors in logs** — watch `edge_function_logs` for 10 minutes post-deploy
7. **Weekly Brief cron fires** — verify in `weekly_briefs` table after scheduled time

### LLM/prompt-specific regression tests

When changing anything that feeds a prompt (agent prompts, Zod schemas, KG data):

- [ ] Run scan with seeded input profile "Software Engineer, 5yr exp, Bengaluru" — verify output schema still validates
- [ ] Run scan with seeded input "Accountant, 12yr exp, Pune" — verify
- [ ] Run scan with minimum-viable input (manual role entry, no resume) — verify graceful degradation
- [ ] Check for hallucinated numbers in output (salary, dates) — verify they're grounded in inputs

---

## Post-deploy monitoring

After any deploy to production:

- [ ] Watch `edge_function_logs` for 30 minutes — any new error signature triggers investigation
- [ ] Watch scan success rate — if it drops >10% from baseline (currently 29% complete rate is the baseline), roll back
- [ ] If behind a feature flag, start rollout at 1% → 10% → 50% → 100% over 24–48 hours
- [ ] Document in `docs/DEPLOYS.md` with: commit SHA, flag state, observed metrics, rollout timeline

---

## Rollback procedure (memorize this)

When something breaks:

1. **First**: flip the feature flag to OFF. This resolves ~90% of issues with zero code change.
2. **If flag doesn't help**: revert the deploy. On Lovable, this is the "revert" button on the offending commit. Via git: `git revert <sha> && git push`.
3. **If revert doesn't help** (e.g., migration involved): execute the documented reverse migration.
4. **Always**: write a short post-mortem in `docs/POSTMORTEMS/YYYY-MM-DD-<short-name>.md` within 48 hours. Not to assign blame — to prevent repeat.

---

## Rollback anti-patterns (do not do these)

- ❌ "Let me just fix it quickly forward" — roll back first, fix second
- ❌ "It's working for most users, leave it" — define threshold ahead of time and honor it
- ❌ "The flag system isn't set up for this yet" — then the feature wasn't ready to ship

---

## Red-flag patterns (Claude Code stops if it sees itself thinking these)

🚩 "I'll just quickly refactor this while I'm here..."
🚩 "This old code looks weird, let me clean it up..."
🚩 "This is probably fine without a test..."
🚩 "I'll skip the feature flag for this small change..."
🚩 "The existing tests are wrong, let me update them..."
🚩 "Let me just push straight to main..."
🚩 "I'll upgrade this dependency to a major version..."
🚩 "This script isn't in the untouchable list, but it touches the same data..." (then it's untouchable)
🚩 "I'll update both the root code AND job-fortress-v2/ to keep them in sync..." (absolutely not — v2 is frozen)

For any of these, STOP. Ask the human.

---

## Three-question test before any risky change

1. **What could this break?** List at least 3 possibilities.
2. **How would I know if it broke?** If there's no observable signal, add one first.
3. **How do I undo this if it breaks?** If there's no one-command rollback, stop and design one.

If Claude Code can't answer all three concretely, the change isn't ready.

---

## Special handling for this codebase

### The i18n trap
Hindi/Hinglish content lives in `src/lib/i18n.ts` and `src/hooks/use-locale.ts`. Any new user-facing string must be translated or deliberately English-only. Hard-coded English strings are a regression.

### The agent-pipeline trap
`process-scan/index.ts` orchestrates Agent 1 → deterministic → Agents 2A/2B/2C → Quality Editor. Any change to any agent's output schema ripples through all downstream consumers, including the 12-card UI. Regression testing must cover the full flow, not just the changed agent.

### The KG data trap
`skill_risk_matrix` and `job_taxonomy` are hand-curated data. Adding rows is safe; editing existing rows changes historical scores. If editing is needed, version it (add new rows with different keys, deprecate old ones) rather than overwriting.

### The Tavily cost trap
Tavily API is metered. Any change that increases search frequency (e.g., making live-enrich fire more often) can spike costs. `_shared/spending-guard.ts` should catch this, but verify.

### The SSE streaming trap
`career-genome` uses Server-Sent Events for the 3-agent debate. Changes to its response format break the UI reader. Test the streaming flow end-to-end, not just the first chunk.

---

## Integration with operator's installed skills

Claude Code should invoke these in reasoning:

- `regression-check` — after every fix or feature change
- `verification-before-completion` — mandatory before claiming "done"
- `deep-qa-sweep` — before any production-impacting deploy
- `karpathy-guidelines` — default guardrail against over-engineering
- `sequential-thinking` — for any non-trivial change

Reference them explicitly: "Applying regression-check skill to this change: first, I verified ..."

---

## Definition of "done"

A change is only "done" when ALL of these are true:

1. Code is written and committed to a feature branch
2. Tests written and passing (show output)
3. Lint + typecheck + build all pass (show output)
4. Manual verification in staging is complete (show evidence)
5. Regression smoke tests pass
6. Pull request created with description covering: what/why/risks/rollback plan
7. Feature flag, if applicable, is wired and defaults OFF
8. `docs/DECISIONS.md` updated if any non-obvious choice was made
9. Human operator has reviewed the diff

Not "done" when:
- ❌ "The code works on my machine"
- ❌ "Tests pass but I didn't run the build"
- ❌ "I didn't touch the flag logic, should be fine"
- ❌ "I'll verify it in prod after merge"
