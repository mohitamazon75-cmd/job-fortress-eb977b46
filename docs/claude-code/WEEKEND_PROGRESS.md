# Weekend Progress — 2026-04-18

> Snapshot of stabilization work completed over the weekend of April 18, 2026.
> Read this first when resuming work after travel.

## One-line status

Stabilization Sprint A is ~80% complete. Sprint B (test infrastructure), Sprint C (security P0s), and Sprint D (observability) remain untouched and are next week's work.

## What shipped today (5 PRs merged to main)

| # | PR | Branch | Impact |
|---|---|---|---|
| 1 | `docs: grounded Claude Code instructions` | `docs/grounded-claude-code-instructions` | Replaced stale CLAUDE.md + added 4 reality docs under `docs/claude-code/`. Every future AI session now reads truth, not pre-pivot guesses. |
| 2 | `chore: remove abandoned job-fortress-v2 parallel codebase` | `chore/remove-abandoned-v2` | Deleted 44MB / 519 files / ~106k lines of abandoned parallel codebase. Resolved the "which codebase deploys?" ambiguity. |
| 3 | `chore: remove legacy .git_old* backup directories` | `chore/remove-legacy-git-backups` | Deleted 5 residual git-internal directories (~640MB, 9,099 tracked files) left over from past rebrands. |
| 4 | `chore: remove stale bun.lockb, correct lockfile guidance in CLAUDE.md` | `chore/unify-lockfiles` | Deleted stale binary lockfile. Corrected CLAUDE.md to say `bun.lock` (not `bun.lockb`) is canonical. Part 1 of 2 — see "Deferred work" below. |
| 5 | `chore: remove residual KidSutra references from pivoted repo` | `chore/remove-kidsutra-residue` | Replaced stale SEO URL in `public/sitemap.xml` (was pointing at old product's domain). Deleted stale KidSutra bug tracker. |

**Net effect:**
- ~684MB removed from the repo
- SEO-visible URL corrected (was telling Google about a product that no longer exists)
- Documentation now matches reality
- Zero user-visible regression across any PR (live app stayed healthy throughout)

## Stabilization Sprint A — task status

Per `docs/claude-code/01_STABILIZATION_SPRINT.md`:

| Task | Status | Notes |
|---|---|---|
| A1 — Resolve `job-fortress-v2/` | ✅ Done (PR #2) | Deleted; recoverable via git history |
| A2 — Remove `.git_old*` backups | ✅ Done (PR #3) | Deleted; git reflog preserves originals |
| A3 — KidSutra residue cleanup | ✅ Done (PR #5) | 3 surgical changes; 10 other mentions deliberately preserved as legitimate pivot context |
| A4 — Replace stale CLAUDE.md | ✅ Done (PR #1) | New grounded version in place |
| A5 — Add `docs/claude-code/` package | ✅ Done (PR #1) | All 4 docs present |
| A6 — Unify lockfiles | 🟡 Partial (PR #4) | `bun.lockb` removed. `package-lock.json` fate deferred — see below. |

**The stabilization sprint doc checklist (Sprint A acceptance criteria section) currently shows most items unchecked even though they're done, because we only flipped the A3 checkbox in PR #5. Updating the rest is a trivial follow-up — one PR, one file, one character per line.**

## Deferred work (explicit, not forgotten)

### A6 Step B — resolve `package-lock.json`
Before deleting `package-lock.json`, we need a Lovable deploy log to confirm whether Lovable runs `bun install` or `npm ci`.
- If Lovable uses Bun → delete `package-lock.json`
- If Lovable uses npm → delete `bun.lock` instead and keep `package-lock.json`
Either way, the final state is one lockfile. Not done today because we didn't have a recent deploy log to inspect.

### Pre-existing failure in scan pipeline (not caused by our work)
During smoke testing after PR #2 merged, a real scan failed with `Analysis Incomplete`. Supabase edge function logs (viewed via Lovable) showed:
- Gemini 3 Pro returned `current_role` as an object instead of a string (schema mismatch)
- Resume parsing timed out on a PDF
- RoleGuard correctly refused to synthesize a fake role and failed the scan cleanly

This is the same ~43% failure rate mentioned in `00_CURRENT_REALITY.md`. It was present *before* any of today's PRs. The scoring engine's behavior ("fail rather than synthesize junk") is actually correct — it's the upstream profiler + LLM schema robustness that needs work. This is part of **Sprint B/C** material.

### Lovable auto-push observation
Early in the afternoon, Lovable's "Try to fix" button auto-pushed 2 commits to `main` without going through a PR. The change itself (adding a `SCAN_NOT_READY` error branch in `ResultsModelB.tsx`) turned out to be a legitimate fix, so we kept it. But going forward: **Lovable's AI chat must not make code edits.** Claude Code is the sole AI making changes to this codebase. Lovable remains the host and deploys from `main`, but its AI is not a contributor.

## Next session — resume instructions

When you return from travel:

```
cd /Users/mohit/Downloads/job-fortress-eb977b46
git checkout main
git pull origin main
claude
```

Then tell Claude Code (or an AI collaborator):
> "Pick up stabilization from the weekend handoff at `docs/claude-code/WEEKEND_PROGRESS.md`. First task: Sprint B (test infrastructure) — make `bun run test` actually execute per `docs/claude-code/01_STABILIZATION_SPRINT.md` Sprint B plan."

## What NOT to do next session (keep the rules we established)

1. **One AI at a time.** If Lovable's chat is used at all, only for read-only questions (e.g., fetching deploy logs). No "Try to fix" clicks.
2. **One change per PR.** No mega-PRs. Every change gets its own branch, commit, PR, review, merge.
3. **Claude Code stops before destructive actions.** Don't approve "don't ask again" options — keep the safety rhythm.
4. **Verify before delete.** Every deletion preceded by a read-only investigation and an explicit scope summary.
5. **No Sprint C security fixes without tests running first.** Sprint B (tests) must land before Sprint C (security P0s). Without tests, we can't prove security fixes didn't regress elsewhere.
6. **`TESTING_BYPASS = false` flip happens only after Razorpay end-to-end test with the consultant.** Per stabilization doc Sprint C3 — this is consultant-gated, not Claude Code work.

## Cumulative context for the next session's AI

An AI session opened against this repo next week should, before doing anything, read in this order:
1. `CLAUDE.md` (repo root) — product overview + hazards
2. `docs/claude-code/00_CURRENT_REALITY.md` — ground truth
3. `docs/claude-code/01_STABILIZATION_SPRINT.md` — task list
4. **This file** — what's already done, what's deferred, and why
5. `docs/claude-code/03_REGRESSION_PREVENTION.md` — rules of engagement

## Appendix — commit hashes for today's work (in merge order)

Exact commit SHAs are retrievable via `git log --merges --oneline -10` on main. The five merge commits correspond to PRs #1–#5 listed above (PR #4's merge hash was `cb34d11`; others can be resolved from GitHub's PR pages).
