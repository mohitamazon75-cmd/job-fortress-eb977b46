# Pull Request

## What changed
<!-- 1–3 sentence summary. Link the issue / decision doc if any. -->

## Why
<!-- The user-visible or operational reason. Not "because the code looked bad." -->

## Scope
- [ ] Touches ≤ 5 files (CLAUDE.md Rule 9 — otherwise needs operator sign-off)
- [ ] Does NOT touch protected paths (`_shared/det-*`, `agent-prompts.ts`, `zod-schemas.ts`, `subscription-guard.ts`, `activate-subscription/`, `razorpay-webhook/`, `migrations/`) — or has explicit approval logged below
- [ ] Does NOT grow the four frozen god-files (`process-scan/index.ts`, `scan-engine.ts`, `SideHustleGenerator.tsx`, `VerdictReveal.tsx`)

## Definition of Done (per `docs/DEFINITION_OF_DONE.md`)
- [ ] `bun run lint` — passes
- [ ] `bun run test` — full vitest suite passes (currently 238 tests)
- [ ] `bun run build` — production Vite build succeeds
- [ ] Deno engine tests pass: `deno test --allow-net --allow-env --allow-read --no-check supabase/functions/tests/ supabase/functions/get-model-b-analysis/score-anchor.test.ts supabase/functions/process-scan/process-scan.test.ts`
- [ ] `bash scripts/guard-no-bypass.sh` — clean
- [ ] `bash scripts/guard-god-files.sh` — clean
- [ ] Manually exercised the changed flow (curl / clickthrough)
- [ ] Regression checklist in `docs/claude-code/03_REGRESSION_PREVENTION.md` reviewed

## Invariants
- [ ] No new `TESTING_BYPASS`, `SKIP_AUTH`, `DISABLE_RLS`, `BYPASS_AUTH`, or `DEV_USER_ID`
- [ ] No `Math.random()` or `string.length % N` in deterministic scoring
- [ ] No new dependencies without operator approval
- [ ] No CHECK constraints on time-based predicates (use validation triggers)

## Risk
<!-- What could break? What's the blast radius? Rollback plan? -->

## Operator approval (only if touching protected paths)
<!-- Paste the operator's explicit approval message + date. -->
