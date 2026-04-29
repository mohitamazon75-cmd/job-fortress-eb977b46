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

### BL-037 — Mobile 368px hazards (4 critical screens)
- **Discovered**: 2026-04-28, audit pass (`docs/qa/mobile-368px-audit-2026-04-28.md`).
- **Findings**: V-2 (VerdictReveal hardcoded 500x500 blur exceeds viewport), V-3 (CTA may sit below fold, modal needs sticky CTA + overflow-y-auto on <sm), D-1 (DefenseTab milestone titles need line-clamp at half-width).
- **Fix sketch**: see audit doc §"Recommended P0/P1 fix sequence". ~half day total. None touch frozen files.
- **Status**: open.


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

### BL-033 — Share-card "Digital Passport" redesign
- Discovered 2026-04-26 from user feedback ("Suggested_changes" doc).
- Current `src/components/cards/ShareableScoreCard.tsx` (783 lines) uses the "Classified Document" aesthetic (mem://ux/share-card-rendering-logic). Feedback proposes a Gold/Black/Holographic "Digital Passport" treatment with percentile scarcity ("Top 5% in Bengaluru") to drive viral loops.
- Why parked: file is 783 lines (over the 300-line guardrail in CLAUDE.md Rule 9), purely visual rewrite, viral asset has highest blast radius for regression. Pre-PMF the existing card is shipping; redesign is upside, not a fix.
- Pre-condition: lock the percentile data source (cohort percentile per city × role) before redesigning visuals.
- Priority: P2 — meaningful upside, not a stability blocker.
- **Status**: open (deferred).

### BL-034 — Archetype rename to India-first labels
- Discovered 2026-04-26 from user feedback.
- Rename profile archetypes ("The Outlier" → "The Architect", plus "Frontier Leader", "Rare Hybrid", "Rising Star") to better fit the Indian competitive job-market vernacular.
- Why parked: copy-only change, but spans `AIDossierReveal`, `MoatsSection`, share-card overlays, edge-function prompts in `_shared/agent-prompts.ts` (touch-with-approval per Rule 3), and any cohort-tier strings in the KG. Needs a single coordinated grep-and-replace plus prompt re-calibration check, not a piecemeal edit.
- Priority: P2 — pure positioning win once Phase 1 stabilization is signed off.
- **Status**: open (deferred).

### BL-035 — PromptModal "Email this to me" + retry hardening
- Discovered 2026-04-26 from user feedback (today's-action reminders).
- `src/components/model-b/PromptModal.tsx` already has: empty-stream → non-stream fallback, manual "Try again" on error, "↻ Regenerate". Remaining gap is purely *additive*: "Email this to me" button so the generated content lands in the user's inbox for later action.
- Why parked: requires a new edge function (`email-action-content`) that composes + sends via the existing email infra. New edge function is explicitly disallowed pre-Phase-1 per CLAUDE.md (§5).
- Priority: P2 — retention nudge, not a fix. Existing modal is functional.
- **Status**: open (deferred).

## Open — P3

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

### BL-Agent1-Determinism — Step 1+2 shipped (2026-04-25)
Agent1:Profiler (the only score-affecting LLM call in `process-scan`) is now deterministic per-scan: pinned to `PRO_MODEL` via `callAgentWithFallback` (Flash/OpenAI remain as fallback if Pro fails or times out), `temperature = 0`, and a per-scan `seed` derived from `scanId` via `deterministicSeedFromScanId`. The `seed` parameter is threaded through `callAgent` / `callAgentCore` / `callAgentWithFallback` and included in the in-flight dedupe key. Narrative agents (Judo, WeeklyDiet, Agent2A/B/C, QualityEditor) intentionally remain non-deterministic. Operator ground rule: accuracy over speed.

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

### BL-035 — Fabricated testimonials in `SocialProofSection.tsx`
- **Found**: 2026-04-25 (soft-launch QA pass).
- **Problem**: Three testimonials with named individuals ("Rahul M.", "Priya S.", "Aditya K."), specific employers, scores, and exact salary outcomes ("34% salary jump", "28% raise") — but the platform has only single-digit scans/day per `CLAUDE.md`. Disclaimer "Real outcomes from real users" makes this an explicit misrepresentation.
- **Conflict**: Directly contradicts `mem://style/social-proof-credibility` ("technically honest").
- **Risk**: Misrepresentation under India Consumer Protection Act 2019 §2(28) (misleading advertisement); reputational risk if a journalist or competitor surfaces it; ASCI guideline violation.
- **Operator decision (2026-04-25)**: Leave as-is for now, log to backlog. Re-evaluate before any press / paid acquisition.
- **Owner**: unassigned.
- **Status**: open (deferred — not a launch blocker per operator).

### BL-036 — `live-market-card-layer-c.test.tsx` HOT-verdict test red against current copy
- **Found**: 2026-04-28 (full suite run during Tier 3 regression-net loop).
- **Problem**: `r1Fixture` (50 same-day, 0 within_7d, 0 older) hits the `repostNoiseSuspected` branch in `LiveMarketCard.tsx:679` *before* it can reach the HOT branch at line 684. The test expects copy `/active hiring right now/` + `/move this week/`, but the component returns `"Looks busy on the surface, but most \"today\" postings on a pool this small are recruiter reposts of older requisitions. Treat as steady, not urgent."`.
- **Likely cause**: Repost-noise heuristic was tightened (or HOT threshold loosened) without updating the fixture — or the fixture itself drifted. Both component code and test live in the repo; one of them is wrong.
- **Impact**: Suite is **red**. Per `docs/DEFINITION_OF_DONE.md`, this blocks merges. **Has been red since at least 2026-04-28** — caught only because the operator's CTO loop now runs the full suite.
- **Two clean fixes** (operator picks):
  - **(a) Fix the fixture**: bump `posting_count` >> repost-suspicion threshold so HOT actually triggers (e.g., 200+ with 150 same-day in a way that doesn't trip the noise filter). Cheapest, doesn't change product behavior.
  - **(b) Fix the test expectation**: if the new repost-noise copy is the intended verdict for the `r1Fixture` shape, update the test's regex to match `/looks busy on the surface/` and rename the case. Reflects current product intent.
- **Constraint**: `LiveMarketCard.tsx` is a 1025-line "god file" — per `CLAUDE.md` Rule 3, do not refactor.
- **Owner**: unassigned.
- **Status**: open (blocking suite green).

### BL-036 — RESOLVED 2026-04-28
- **Fix path**: Option (a) — corrected the test fixture, not the product copy. The repost-noise heuristic added a second clause (`sameDayShare ≥ 85% AND within7d === 0`, `LiveMarketCard.tsx:669`) that the original test author missed; their inline comment ("NOT repost-suspected (50 > 10)") was stale.
- **Change**: `live-market-card-layer-c.test.tsx` HOT case now uses `posting_count: 70, recency: { same_day: 40, within_7d: 30, older: 0 }` — 100% fresh, sameDayShare 57% (well below 85%), pool well above 10. HOT branch reachable + heuristic still meaningful.
- **Why not option (b)**: Updating the test to accept "Looks busy on the surface" would have gutted the entire HOT regression net. The product copy is correct; the fixture drifted.
- **Verification**: full suite 328/328 green.
- **Status**: closed.

## 2026-04-29 (Sprint 0 deferrals)
- **Structured logging sweep on top 10 hot edge functions.** `_shared/logger.ts` already exists & tested. Wrapping process-scan + get-model-b-analysis + verdict-enrichment + cohort-match + chat-report + score-drift + compute-trajectory + capture-outcome + ai-dossier + career-genome would touch 10+ files. Defer to dedicated PR — risk/regression budget exceeds Sprint 0 scope.
- **Cohort UI "estimated" label.** Investigated: `CohortRankCard` already gates at N≥50 with "Building your cohort" message. `get-cohort-rank` returns `has_enough_data: false` when sparse. Honesty already present; no change needed unless operator wants stronger framing.
- **role_detected normalization wiring.** Helper `_shared/role-normalizer.ts` shipped + 17 tests. Call-site wiring (process-scan, cohort-match, KG joins) deferred — touches god-file plus 4-5 query sites. Need a focused PR with KG enum dump first to validate `knownEnums` set.
