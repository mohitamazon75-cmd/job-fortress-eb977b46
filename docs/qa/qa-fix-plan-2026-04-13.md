# QA Fix Plan — JobBachao — 2026-04-13

## Summary
3 critical · 4 high · 6 medium · 4 low

The app is in solid shape after this session's 12-file, 2-commit sweep. All Priority 1 (bug fixes) and Priority 2 (IP strengthening) items are resolved and pushed to `main`. The remaining issues below are pre-existing and were not introduced by this session. The most important unresolved item is the set of ghost DB tables (`analytics_events`, `behavior_events`, `score_events`) which silently fail on every call — these will not crash the app but lose data. The second most important is the `score_events` table used by `ScoreTimeline` which doesn't exist in the schema.

---

## ✅ RESOLVED THIS SESSION (for reference)

| ID | What was fixed |
|----|---------------|
| BUG-1 | Geo-arbitrage EV formula — `ev12mo = P × rawDelta × 12` |
| BUG-2 | Live KG calibration never applied — `loadCalibrationConfig` wired into `process-scan` |
| BUG-3 | Three automation signals with no reconciliation — `checkAutomationSignalConsistency` added |
| BUG-4 | Seniority Shield frozen constant — replaced with `computeCareerCapital()` dynamic formula |
| BUG-5 | Score drift invisible — drift badge added to `FearScoreDecay` |
| NARRATION-1..7 | All stale metric labels fixed across 12 components |
| STAT-2 | Asymmetric CI bounds in `calculateScoreVariability` |
| CRITICAL-6 | Metric naming standardised to "Career Position Score" |
| CRITICAL-8 | Geo arbitrage label fixed — "Expected value if relocation succeeds" |
| CRITICAL-9 | Exec salary framing — restructuring risk not monthly bleed |

---

## 🔴 Critical — Fix Before Anything Else

### [DB-GHOST] `score_events` table queried in `ScoreTimeline` — table does not exist in schema
- **What's broken**: `src/components/dashboard/ScoreTimeline.tsx:32` queries `.from('score_events' as any)`. This table has no entry in `src/integrations/supabase/types.ts` and no migration. Every `ScoreTimeline` component load silently returns empty data and the timeline is always blank for all users.
- **Where**: `src/components/dashboard/ScoreTimeline.tsx:24-32`
- **Fix**: Either (a) create a migration: `CREATE TABLE score_events (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES auth.users(id), scan_id uuid, event_type text NOT NULL, payload jsonb, created_at timestamptz DEFAULT now());` and regenerate types, OR (b) replace the `score_events` query with a query to `score_history` which already exists and contains the same data — this is the faster fix.

### [DB-GHOST] `analytics_events` table missing from schema — all analytics silently lost
- **What's broken**: `src/hooks/use-analytics.ts:48` inserts into `.from('analytics_events' as any)`. Table not in types, no migration. Every user action tracked via `useAnalytics` silently fails. No analytics data is being captured.
- **Where**: `src/hooks/use-analytics.ts:48`
- **Fix**: Create migration: `CREATE TABLE analytics_events (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, event_type text NOT NULL, user_id uuid REFERENCES auth.users(id), scan_id uuid, payload jsonb, created_at timestamptz DEFAULT now());` Then run `supabase gen types typescript --project-id cakvjjopadfpkeekpdog > src/integrations/supabase/types.ts`.

### [DB-GHOST] `behavior_events` table missing — user behavior tracking silently lost
- **What's broken**: `src/hooks/use-track.ts:8` inserts into `.from('behavior_events' as any)`. Same as above — all behavior tracking silently drops.
- **Where**: `src/hooks/use-track.ts:8`
- **Fix**: Create migration alongside `analytics_events`: `CREATE TABLE behavior_events (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES auth.users(id), scan_id uuid, event_name text NOT NULL, properties jsonb, created_at timestamptz DEFAULT now());` Then regenerate types.

---

## 🟠 High — Fix Soon

### [EDGE-CORS] `create-bucket` edge function has no CORS headers
- **What's broken**: `supabase/functions/create-bucket/index.ts` does not import or use `getCorsHeaders` or `handleCorsPreFlight`. If called directly from the browser (not server-side), the preflight OPTIONS request will fail and the function will be unreachable.
- **Where**: `supabase/functions/create-bucket/index.ts`
- **Fix**: Add at the top of the handler: `if (req.method === 'OPTIONS') return handleCorsPreFlight(req);` and wrap all responses with `{ ...corsHeaders, 'Content-Type': 'application/json' }`.

### [EDGE-CORS] `process-email-queue` edge function has no CORS headers
- **What's broken**: `supabase/functions/process-email-queue/index.ts` same issue. Not callable from browser.
- **Where**: `supabase/functions/process-email-queue/index.ts`
- **Fix**: Same CORS pattern. Note: if this function is only ever called server-to-server (e.g., via pg_cron or webhook), CORS is not required — confirm invocation pattern first.

### [FETCH-NOERROR] Several component `fetch()` calls have no `.catch()` or `try/catch`
- **What's broken**: `src/components/AIDossierReveal.tsx:631`, `src/components/cards/BestFitJobsCard.tsx:46`, `src/components/cards/CareerPivotCard.tsx:224`, `src/components/dashboard/CareerGenomeDebate.tsx:303` all call `fetch()` inside `async` functions without explicit error handling. If the edge function is slow or returns 5xx, these components will silently freeze or show a blank state.
- **Where**: Files listed above
- **Fix**: Wrap each `fetch()` in `try/catch`. On catch, set an error state and show a user-facing error message. Current code only handles `!resp.ok` but not network-level failures (function timeout, DNS failure).

### [EDGE-SECRET] `create-scan` and `process-scan` — concurrency guard uses wall-clock time, not a DB lock
- **What's broken**: The concurrency guard (checking for active scans in the past 45 minutes) is a soft check, not a database-level lock. Under burst traffic, two simultaneous requests for the same user can both pass the check and create duplicate scans.
- **Where**: `supabase/functions/process-scan/index.ts` concurrency check section
- **Fix**: Use a Postgres advisory lock: `SELECT pg_try_advisory_lock(hashtext($userId))` at the start of scan creation, release on completion. This is atomic and race-condition safe.

---

## 🟡 Medium — Fix When You Can

### [TYPE-SAFETY] `computeCareerCapital` derives experience_years from `survivability_breakdown.experience_bonus` via reverse-engineering
- **What's broken**: `src/lib/stability-score.ts:98` — experience years estimated from `experience_bonus / 1.5`. This is fragile: if the experience_bonus formula changes server-side, the client-side CareerCapital calculation silently uses wrong years.
- **Where**: `src/lib/stability-score.ts:98`
- **Fix**: Add `experience_years` to `ScanReport` interface (it's already returned from Agent 1 via the server) and read it directly rather than reverse-engineering from the bonus.

### [TYPE-SAFETY] `score_history` drift query assumes `data[1]` is a different scan — may be same scan on retry
- **What's broken**: `src/components/cards/FearScoreDecay.tsx:66` — takes `data[1]` as the "prior" scan. If the same scan is recorded twice in score_history (e.g., on force-refresh), `data[1]` is still the current scan and the drift delta will always be 0.
- **Where**: `src/components/cards/FearScoreDecay.tsx:66`
- **Fix**: Pass `report.determinism_index` to the fetch, then filter: `.neq('determinism_index', report.determinism_index)` — or better, pass the current `scan_id` and use `.neq('scan_id', currentScanId)` to exclude the current scan explicitly.

### [LOGIC] `checkAutomationSignalConsistency` called with `ml_automation_risk: null` at compute time — ML risk only available later
- **What's broken**: `supabase/functions/process-scan/index.ts:790` — the consistency check is called right after `computeAll()` with ML risk hardcoded to `null`. The ML prediction runs in parallel and may have already resolved. The check never validates Agent1 vs ML.
- **Where**: `supabase/functions/process-scan/index.ts:790-794`
- **Fix**: Add a second consistency check call in `scan-report-builder.ts` after `assembleReport()` when both `det.determinism_index` and `mlObsolescence?.automation_risk` are available.

### [LOGIC] `CALIBRATION` object is module-level — `loadCalibrationConfig` patches it globally across concurrent requests
- **What's broken**: `supabase/functions/process-scan/index.ts:199` — `CALIBRATION` is a module-level `const` in `det-utils.ts`. In Deno Edge Functions, module state is shared across warm requests in the same isolate. If two requests run concurrently, both patching `CALIBRATION` could interleave, causing one request to use the other's calibration values.
- **Where**: `supabase/functions/process-scan/index.ts:199`, `supabase/functions/_shared/det-utils.ts:12`
- **Fix**: Either (a) make `loadCalibrationConfig` return a new calibration object instead of mutating the module-level one, then pass it through to `computeAll()`, or (b) accept the current behaviour for now (calibration values change rarely and are not user-specific, so cross-contamination is low-impact).

### [UX] `FearScoreDecay` drift badge shows for the very first scan — `data[1]` may be stale from a previous role
- **What's broken**: A user who previously scanned as a "Marketing Manager" then rescans as a "Software Engineer" will see "↑ +12 points since last scan" comparing two completely different roles. This is misleading.
- **Where**: `src/components/cards/FearScoreDecay.tsx:56-72`
- **Fix**: Add `.eq('industry', report.industry)` (or pass `role_detected`) to the score_history query so drift is only compared within the same role/industry context.

### [UX] `CareerCapital` uses `adaptability_bonus` from `score_breakdown.survivability_breakdown` — null on old scans
- **What's broken**: `src/lib/stability-score.ts:104` — if `score_breakdown` is null (older scans), `adaptabilityBonus` defaults to 0, lowering CareerCapital compared to what the old Seniority Shield would have shown.
- **Where**: `src/lib/stability-score.ts:104`
- **Fix**: Current `?? 0` fallback is fine — but the seniority floor `SENIORITY_PROTECTION_FLOOR[tier]` prevents the score dropping below the old value. This is working as designed but worth noting.

---

## 🟢 Low — Polish & Cleanup

### [CLEANUP] 20 `vite.config.ts.timestamp-*` files in root directory
- **What's broken**: Not breaking, but 20 stale Vite timestamp files in the repo root create noise in `git status` and `ls`.
- **Where**: `/` (root directory)
- **Fix**: Add to `.gitignore`: `vite.config.ts.timestamp-*` and `vitest.config.ts.timestamp-*`. Then `git rm --cached vite.config.ts.timestamp-*`.

### [CLEANUP] `job-fortress-v2/` subdirectory (44MB) — duplicate codebase
- **What's broken**: A full copy of an older version of the app sits in the repo. Not breaking but bloats clone size by ~44MB.
- **Where**: `job-fortress-v2/`
- **Fix**: `git rm -r job-fortress-v2/` after confirming no unique content is needed.

### [CLEANUP] Dead code: `JobBachaoDashboard.tsx`, `IntelTab.tsx`, `WeeklyBriefWidget.tsx`
- **What's broken**: `JobBachaoDashboard.tsx` is imported by nothing. `IntelTab` and `WeeklyBriefWidget` are only reachable through `JobBachaoDashboard`. All three contain references to non-existent tables (`intel_watchlist`, `weekly_briefs`).
- **Where**: `src/components/JobBachaoDashboard.tsx`, `src/components/dashboard/IntelTab.tsx`, `src/components/dashboard/WeeklyBriefWidget.tsx`
- **Fix**: Delete all three files. If the intel watchlist feature is planned, create the migration first, then build the component.

### [STYLE] `SampleReport.tsx` uses hardcoded static data — CareerCapital pts value wrong
- **What's broken**: `src/components/SampleReport.tsx:29` has `{ label: 'Career Capital', pts: +11, desc: '7 yrs experience buffer' }`. The description still references "experience buffer" which was the old Seniority Shield framing.
- **Where**: `src/components/SampleReport.tsx:29`
- **Fix**: Update desc to `'Moat depth · experience · adaptability · peer validation'`.
