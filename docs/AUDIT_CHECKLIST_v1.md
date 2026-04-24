# Audit Checklist v1

> **Purpose**: An audit means *running this checklist in full*. Not vibes, not "deep sweep", not "look at the new stuff". When v1 is clean (every box checkable, every invariant test green), bump to v2 with new categories. **The loop ends because the checklist is finite.**
>
> **Cadence**: Run before every release, after any change touching scoring/auth/payments, and on a calendar trigger every 4 weeks.
>
> **Output**: For each unchecked box, file an entry in `docs/BACKLOG.md` with a P0/P1/P2 label and a link to the offending file. Do **not** fix during the audit run — that's the next sprint.

---

## How to run it

1. Open this file alongside `docs/INVARIANTS.md`.
2. Walk every section in order. For each item, either tick it or log a backlog entry.
3. Total time should be ~60 minutes for v1. If it takes longer, the codebase needs new invariants — add them.
4. When done, write the audit summary to `docs/audits/AUDIT_<YYYY-MM-DD>.md` with: items checked, items failed, link to backlog entries.

---

## § A. Invariant test suite

- [ ] `bun run test` — all 194+ tests green, zero skipped without justification.
- [ ] `src/test/invariants.test.ts` runs and passes.
- [ ] Every invariant in `INVARIANTS.md` marked "needs test" has been triaged this round (added or explicitly deferred with a date).

## § B. Build & static analysis

- [ ] `bun run lint` — zero errors, zero new warnings vs. the previous audit.
- [ ] `bun run build` — succeeds, no console errors during build.
- [ ] `npx tsc --noEmit` — zero type errors.
- [ ] No file > 500 lines added since last audit (god files in CLAUDE.md Hazard F are grandfathered).

## § C. Scoring & display correctness

- [ ] Spot-check 3 production scans: hero score, history score, share-card score all show the same value for the same scan ID.
- [ ] Risk language uses HIGH/MEDIUM/LOW everywhere (grep for `risk_pct`, `risk_percentage`).
- [ ] No raw `determinism_index` appears in user-facing copy.
- [ ] Salary strings rendered to the user pass the SALARY_ANCHOR regex (`₹|INR|Rs|LPA|lakh|crore|Cr|p.a.|CTC`).

## § D. Lifecycle & state hygiene (frontend)

- [ ] Every `useEffect` in `src/pages/` and `src/components/` either returns a cleanup or has a `// no-cleanup-needed: <reason>` comment.
- [ ] No `useState` whose value can be derived from props/other state. (Audit by grep + manual.)
- [ ] All async setState in `useScanFlow`, `ResultsModelB`, `useStreak` are guarded by mount or generation refs.
- [ ] Modal/drawer state clears when the underlying entity ID changes (test: navigate between two scan_ids, verify modals close).
- [ ] Streak/counter logic resets on calendar gaps (test: mock `Date.now()` 3 days forward, verify reset).
- [ ] Progress bars reflect work-done, not active-tab-index.

## § E. Performance hygiene

- [ ] No inline `<style>` tags or `@keyframes` defined in JSX (grep `<style>` in `src/`).
- [ ] React.memo applied to children of memoized lists where prop equality is shallow.
- [ ] Stable function references for callbacks passed to memoized children (useCallback or module-scope).
- [ ] No N+1 Supabase queries on landing/results pages (check Network tab on a fresh load).
- [ ] Bundle size delta vs. last audit: log it. Flag any +50KB increase.

## § F. Security

- [ ] `TESTING_BYPASS` is `false` in `_shared/subscription-guard.ts` for prod build.
- [ ] No client-side role/entitlement checks (grep `localStorage.*role`, `sessionStorage.*pro`).
- [ ] No hardcoded secrets in `src/` or `supabase/functions/` (grep `sk-`, `key:`, etc.).
- [ ] `supabase --linter` shows zero errors. Warnings reviewed.
- [ ] Every public table has RLS enabled OR is explicitly documented as public-read in INVARIANTS.
- [ ] Every edge function with `verify_jwt = false` validates JWT in code OR is documented public.

## § G. Data integrity

- [ ] Migrations are append-only since last audit (no edits to existing files).
- [ ] No new column nullability change on a populated table without a backfill migration.
- [ ] DPDP retention job runs (90-day cutoff) — check `scans` table for rows older than 90 days.
- [ ] Cascading delete fires on user account deletion (manual test: delete a test account, verify dependent rows gone).

## § H. Edge functions

- [ ] No new edge function over 800 lines.
- [ ] Every new edge function has CORS headers on every response (including errors).
- [ ] Every new edge function validates body with Zod, returns 400 on failure.
- [ ] No `supabase.rpc("execute_sql")` or string-concat SQL.

## § I. Content & tone

- [ ] No absolute claims in user copy ("you will be replaced" → "significant disruption risk").
- [ ] No US/EU salary references in any user-facing surface.
- [ ] All disclaimers per `mem://project/safety-compliance` present on results pages.
- [ ] Sentence length spot-check: 5 random user-facing strings, all ≤12 words.

## § J. Hallucination guard (manual)

- [ ] Run 3 scans with synthetic resumes covering: (a) executive, (b) BPO, (c) freelance creative.
- [ ] For each: verify no fabricated company names, no fabricated tools, no fabricated salary figures.
- [ ] Cross-check `mem://tech/extraction-evidence-hygiene` rules: every claim traceable to extracted evidence.

## § K. Telemetry & observability

- [ ] `analytics_events` table is being written to (last 24h has rows).
- [ ] `edge_function_logs` shows no unhandled-error spike vs. last audit.
- [ ] `monitoring_alerts` reviewed; unacknowledged alerts triaged.

## § L. Known hazards (CLAUDE.md)

- [ ] Hazard A — `job-fortress-v2/` parallel codebase: status logged.
- [ ] Hazard B — `.git_old*/` directories: status logged.
- [ ] Hazard C — test runner working (currently ✅ — 194 tests).
- [ ] Hazard D — `TESTING_BYPASS` and DEV-mode payment fallback.
- [ ] Hazard E — `generate-weekly-brief` cron status.
- [ ] Hazard F — god files: line counts unchanged or smaller.

---

## Closing the audit

After running the checklist:

1. Count: items checked / items failed.
2. Triage failures into `docs/BACKLOG.md` with severity.
3. If any **new category of bug** was found that this checklist doesn't cover → propose a new section here AND a new invariant in `INVARIANTS.md`. Bump version when ≥3 new sections accumulate.
4. Commit the audit log to `docs/audits/AUDIT_<date>.md`.

When v1 fails ≤3 items two audits in a row, the codebase has reached *audit equilibrium* — the loop is broken.
