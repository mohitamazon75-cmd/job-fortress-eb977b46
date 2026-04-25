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

### BL-015 — DPDP 90-day retention has no automated cleanup job → done
- **Memory**: `mem://project/data-privacy-and-retention`.
- **Resolution (2026-04-24)**:
  - New edge function `supabase/functions/purge-expired-scans/index.ts` deletes scans (+ satellite tables: score_history, learning_path_progress, defense_milestones, coach_nudges, scan_outcomes, scan_feedback, behavior_events, scan_vectors, cohort_cache, trajectory_predictions, weekly_briefs, chat_messages) older than 90 days. Service-role-only; rejects anonymous and user-JWT calls.
  - Pure rule extracted to `src/lib/dpdp-retention.ts` (`shouldPurgeScan`, `retentionCutoff`).
  - 8 unit tests in `src/test/dpdp-retention.test.ts` cover boundary (exactly 90d → keep), 91d → purge, garbage input → keep (fail-safe), custom retention windows.
  - pg_cron job `purge-expired-scans-daily` runs daily at 02:00 UTC.
- **Status**: done.

## Open — P2

### BL-020 — ESLint rule for "useEffect must declare cleanup or comment"
- **Invariant**: INV-F04.
- **Fix**: custom ESLint rule `require-effect-cleanup-comment`.

### BL-021 — ESLint rule for "no inline <style> or @keyframes in JSX"
- **Invariant**: INV-F05.

### BL-022 — Grep guard for `TESTING_BYPASS = true` in CI → done
- **Resolution (2026-04-24)**: `scripts/guard-no-bypass.sh` greps `src/` and `supabase/functions/` for `TESTING_BYPASS = true` and the historical "DEV MODE" payment shortcut. Exits non-zero on any match. Run via `bash scripts/guard-no-bypass.sh` in CI/pre-commit. This permanently vaccinates against Hazard D regressions.
- **Status**: done.

### BL-023 — God files frozen-but-untested
- **Files**: `process-scan/index.ts` (1136 lines), `scan-engine.ts` (841), `SideHustleGenerator.tsx` (798), `VerdictReveal.tsx` (492).
- **Fix**: add at least one snapshot test per file before any future edit.
- **Decision (2026-04-24)**: deferred — snapshot tests on 800-line components produce unreadable diffs and false confidence. CLAUDE.md §1 Hazard F ("do not refactor unless explicitly asked") is the real safety net.

### BL-024 — `package-lock.json` and `bun.lock` both present → done
- **Files**: repo root.
- **Resolution (2026-04-25)**: `package-lock.json` removed; `bun.lock` is the sole lockfile. Added `package-lock.json` to `.gitignore` to prevent re-introduction. CLAUDE.md and README.md updated accordingly.
- **Status**: done.

### BL-025 — Executive-tier risk score may run hot (COO/founder archetype)
- **Discovered**: 2026-04-24 · 5-input QA sweep (Mohit, COO at scale-up).
- **Files**: `supabase/functions/_shared/det-*.ts`, `supabase/functions/_shared/agent-prompts.ts`.
- **Invariant**: none yet — proposing INV-S01 ("exec roles must score ≤ same-industry IC by ≥X pts").
- **Fix sketch**: tune `executive-tier-specialization` weights in deterministic engine; add a regression fixture for COO/CEO/Founder archetypes with expected score bands.
- **Decision (2026-04-24)**: **deferred until DAU > 100 OR first exec user complaint**. CLAUDE.md Rule 3 freezes `det-*.ts` and `agent-prompts.ts`. At single-digit scans/day, tuning on synthetic QA is negative-EV: regression risk on 4 working archetypes outweighs fixing 1 outlier nobody has reported. Reversal trigger: real user feedback on exec score, OR ≥3 exec scans in production showing the same skew.
- **Status**: open (deferred).

### BL-026 — Narrative tone occasionally drifts from "12-word, no-jargon" rule
- **Discovered**: 2026-04-24 · 5-input QA sweep (qualitative read of verdicts).
- **Files**: `supabase/functions/_shared/agent-prompts.ts`.
- **Invariant**: see `mem://style/verdict-narration-standards`.
- **Fix sketch**: tighten Agent 4 verdict prompt with stricter banned-word list and explicit sentence-length cap; add a post-LLM lint pass.
- **Decision (2026-04-24)**: **deferred until DAU > 100**. Frozen-file edit (Rule 3). Taste-level polish, not a correctness bug. Production usage will surface which patterns actually hurt trust; tuning now on 5 synthetic resumes optimizes the wrong distribution.
- **Status**: open (deferred).

### BL-034 — Naukri matcher: address residual FP classes (Phase 2A follow-up)

- **Discovered**: 2026-04-25, Phase 2A-iii measurement (`apify-naukri-jobs`).
- **Files**: `supabase/functions/apify-naukri-jobs/index.ts`,
  `supabase/functions/_shared/skill-synonyms.ts`.
- **Symptom**: three false-positive classes survive 2A-ii, capping
  avg eyeball-relevance at ~68% on the R1/R2/R3 reference set:
  1. Synonym-token FPs ("team management", "performance marketing"
     fire on token-aware match against long JDs).
  2. Canonical-token FPs ("system design" matches "system
     integration" + "design engineer" in unrelated JDs).
  3. Short-skill substring FPs ("aws" inside "laws").
- **Fix path**: structural, not tuning. Likely embedding-based
  skill similarity (cosine on tag/skill vectors with threshold)
  or per-job LLM classification. Estimated multi-week effort.
- **Decision (2026-04-25)**: deferred. Tuning the substring
  matcher further produces zero-sum trades between FP classes
  (verified during 2A-iii — see DECISIONS.md "Naukri matcher
  overhaul — Phase 2A complete"). Real fix waits for either a
  Phase 2B card design that surfaces calibration honestly to
  users, or a structural matcher rewrite.
- **Status**: open (deferred).


### Known prompt/schema mismatches

#### BL-031 — Agent 2A: threat_timeline schema/prompt mismatch
Discovered 2026-04-24 during prompt-injection defense work.
- Schema (`_shared/zod-schemas.ts:186`) declares `threat_timeline` as string.
- Prompt (`process-scan/scan-agents.ts:241`) instructs agents to return an object with `partial_displacement_year` / `significant_displacement_year` / `critical_displacement_year` keys.
- Every recent scan emits the object form; Zod rejects it; orchestrator logs a warning and falls back to Agent 2C's `threat_timeline` (which is also an object, stored successfully).
- Net effect: the report is correct, but one warning is logged per scan and Agent 2A's `threat_timeline` output is always discarded.
- Fix direction: align the schema to match the prompt (object with three year fields), since the prompt is the intended behavior. Touches `zod-schemas.ts` only; no data migration needed.
- Priority: P3 (noise only, no user impact).
- **Status**: open.

### BL-032 — Pre-existing lint baseline is red (~828 errors)
- Discovered 2026-04-25 during post-revert verification.
- 828 errors, mostly `@typescript-eslint/no-explicit-any` across the codebase. One `@typescript-eslint/no-require-imports` in `tailwind.config.ts`.
- Not introduced by recent fixes (verified: none of the reverted files appear in the error list). Baseline has been red throughout the audit/fix sequence.
- Past prompt summaries phrased outcomes as "no new errors in touched files" — accurate — but a few summaries called it "lint passes" loosely.
- Going forward: lint convention is "no new errors in touched files" verified by diffing pre/post error counts on changed paths, not "`bun run lint` exits 0".
- Fix direction: incremental cleanup tied to module owners; don't do as a single sweep (would touch hundreds of files and create enormous review surface).
- Priority: P3 (style debt, no runtime impact).
- **Status**: open.

## Resolved — P3

### BL-030 — React Router v7 future-flag warnings in test output → done
- **Resolution (2026-04-24)**: `src/App.tsx` opts into `v7_startTransition` and `v7_relativeSplatPath`. Test output is now warning-free.
- **Status**: done.

### BL-033 — External audit fix sequence (2026-04-24 → 2026-04-25)
- 8 fixes shipped per the sequence in DECISIONS.md "Audit-fix
  sequence — completed 2026-04-25".
- Reverted intermediate state once (8c original attempt overran
  a single turn; clean history rollback). All other slices shipped
  atomically.
- Status: done.

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
