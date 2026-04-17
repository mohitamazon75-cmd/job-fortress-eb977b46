# QA Fix Plan — Job Fortress — 2026-04-01

## Summary
**13 critical · 22 high · 18 medium · 9 low**

The app cannot function in production in its current state. The live Supabase project (`cakvjjopadfpkeekpdog`) contains an entirely different application's schema (an astrology app with `birth_charts`, `agent_outputs`, `reports`). Not a single Job Fortress migration has been applied, and not a single edge function has been deployed — meaning every DB read/write and every backend call the app makes silently fails or returns wrong data. Beyond the deployment gap, there are two auth-breaking bugs (admin guard queries a non-existent column; a dev-mode bypass leaks into dev-build bundles), four DB tables used in active UI components that have no migration, 27 `(report as any)` assertions for fields missing from the TypeScript type, and a non-standard env var used in the live payment flow. The estimated fix effort for all Critical + High items is one focused session of 3–4 hours.

---

## 🔴 Critical — Fix Before Anything Else

### 1. [DB-SCHEMA] [Critical] `supabase db push` has never been run — entire backend doesn't exist in production
- **What's broken**: The live Supabase project contains only 5 tables (`birth_charts`, `agent_outputs`, `reports`, `profiles`, `agent_prompts`) from an unrelated astrology app. Job Fortress tables (`scans`, `challenges`, `payments`, `enrichment_cache`, `scan_rate_limits`, etc.) do not exist. Zero edge functions are deployed. Every `.from('scans')`, every `supabase.functions.invoke()` call, and every payment webhook returns an error. The app produces zero output in production.
- **Where**: Supabase project `cakvjjopadfpkeekpdog`. Local migrations in `supabase/migrations/`.
- **Fix**: (1) Enable `pgvector` extension first in Supabase dashboard → Extensions. (2) `supabase db push --project-ref cakvjjopadfpkeekpdog`. (3) `supabase functions deploy --project-ref cakvjjopadfpkeekpdog`. (4) Set secrets: `LOVABLE_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`. (5) `supabase gen types typescript --project-id cakvjjopadfpkeekpdog > src/integrations/supabase/types.ts`.

---

### 2. [ROUTE-AUTH] [Critical] `AuthGuard.tsx` queries `profiles.select('role')` — column does not exist
- **What's broken**: `AuthGuard.tsx:64` runs `supabase.from('profiles').select('role').eq('id', userId).single()`. The `profiles` table in `types.ts` has no `role` column (it has `subscription_tier`, `referral_code`, `display_name`, etc.). Postgres returns `ERROR: column "role" does not exist`. The catch block at line 78 then calls `navigate('/', { replace: true })` — the `/admin/monitor` route is permanently inaccessible to everyone including real admins.
- **Where**: `src/components/AuthGuard.tsx:64,74`
- **Fix**: Change line 64 to `.select('subscription_tier')` and line 74 to `if (requiredRole === 'admin' && profile.subscription_tier !== 'admin')`. Alternatively, add a `role text default 'user'` column to the `profiles` migration and regenerate types — then use that.

---

### 3. [ROUTE-AUTH] [Critical] `AuthGuard` IS_LOCAL_DEV bypass based on `import.meta.env.DEV` leaks into dev builds
- **What's broken**: `AuthGuard.tsx:13` — `const IS_LOCAL_DEV = import.meta.env.DEV`. Vite sets `DEV=true` whenever `--mode development` is active. The `package.json` `"build:dev"` script runs `vite build --mode development` — this creates a production bundle with `IS_LOCAL_DEV=true`. That bundle sets `isAuthorized=true` for ALL users (line 23), uses a hardcoded `DEV_SESSION` with `id: 'dev-test-user'` (line 21), and skips all auth checks (line 28-30). If the dev build is ever deployed, every visitor gets full admin access with a fake session.
- **Where**: `src/components/AuthGuard.tsx:13-30`
- **Fix**: Replace `import.meta.env.DEV` with `import.meta.env.VITE_ENABLE_DEV_AUTH_BYPASS === 'true'`. Add to `.env.example`: `# NEVER set in production: VITE_ENABLE_DEV_AUTH_BYPASS=true`. Update `.env.local` with the flag for local dev. The `build:dev` script will then produce a real-auth bundle.

---

### 4. [DB-SCHEMA] [Critical] `intel_watchlist` table used in active UI — no migration, no type definition
- **What's broken**: `IntelWatchlist.tsx:52,74` and `IntelTab.tsx:100,118,130` query `.from('intel_watchlist')`. This table does not appear in `types.ts` and has no migration file. IntelTab is imported by the active `JobBachaoDashboard.tsx` (though that component is dead). The insert at `IntelTab.tsx:130` will throw a Postgres error on any table that doesn't exist.
- **Where**: `src/components/dashboard/IntelWatchlist.tsx:52,74`, `src/components/dashboard/IntelTab.tsx:100,118,130`
- **Fix**: Since `JobBachaoDashboard.tsx` is never imported in any active route (see issue #28), this entire component tree is dead. Delete `IntelWatchlist.tsx`, `IntelTab.tsx`, and `JobBachaoDashboard.tsx`. If the intel watchlist feature is needed, create a migration first.

---

### 5. [DB-SCHEMA] [Critical] `weekly_briefs` table used in active UI — no migration, no type definition
- **What's broken**: `WeeklyBriefWidget.tsx:49` queries `.from('weekly_briefs' as any)`. Table not in `types.ts`, no migration. `WeeklyBriefWidget` is lazy-loaded inside `IntelTab.tsx` — also dead code (see issue #4), but the `as any` cast and ghost table reference is a silent maintenance hazard.
- **Where**: `src/components/dashboard/WeeklyBriefWidget.tsx:49,53`
- **Fix**: Delete `WeeklyBriefWidget.tsx` along with the `IntelTab` cleanup (issue #4).

---

### 6. [DB-SCHEMA] [Critical] `referrals` table used in the post-scan critical path — no migration
- **What's broken**: `ReferralCard.tsx:35,62` queries `.from('referrals')`. Table not in `types.ts`, no migration. `ReferralCard` is imported by `ThankYouFooter.tsx` which renders at the end of every scan flow — this is on the hot path every user hits. Queries silently return empty data; inserts throw. Users see a broken referral section after every scan.
- **Where**: `src/components/ReferralCard.tsx:35,62`, `src/components/ThankYouFooter.tsx:7`
- **Fix**: Create and apply a migration: `CREATE TABLE referrals (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, referrer_user_id uuid REFERENCES auth.users(id), referred_user_id uuid REFERENCES auth.users(id), referral_code text UNIQUE NOT NULL, converted_at timestamptz, reward_granted bool DEFAULT false, created_at timestamptz DEFAULT now());` Then regenerate types and remove the `as any` cast.

---

### 7. [DB-SCHEMA] [Critical] `analytics_events` table used on every scan — no migration
- **What's broken**: `use-analytics.ts:48` inserts into `.from('analytics_events')` on every scan event. Table not in `types.ts`, no migration. Every analytics insert fails silently. No scan behavior data is being captured in production.
- **Where**: `src/hooks/use-analytics.ts:48`
- **Fix**: Create migration: `CREATE TABLE analytics_events (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, event_type text NOT NULL, user_id uuid REFERENCES auth.users(id), scan_id uuid, payload jsonb, created_at timestamptz DEFAULT now());` Run `supabase gen types`. Wrap the insert in error handling that logs but never throws (analytics must not block scan flow).

---

### 8. [DB-SCHEMA] [Critical] New IP tables (5 tables) not migrated — Cohort/Prediction/KG work is invisible in production
- **What's broken**: `skill_predictions`, `cohort_cache`, `scan_vectors`, `kg_node_overrides`, `calibration_config` are referenced in edge functions (`cohort-match`, `store-prediction`, `validate-prediction`, `kg-node-updater`) and in `useCohortIntel.ts:73`. Local migration files exist but have never been applied. The fire-and-forget calls in `process-scan` silently fail for every scan.
- **Where**: `supabase/migrations/20260401000001_cohort_intelligence_engine.sql` through `20260401000004_cohort_match_function.sql`
- **Fix**: Covered by the `supabase db push` in issue #1. Specifically verify the pgvector extension is enabled before migration #1 runs (add `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement in migration 20260401000001).

---

### 9. [API-CONTRACT] [Critical] `ScanReport` type missing 5 fields accessed everywhere via `(report as any)`
- **What's broken**: `threat_timeline`, `role_detected`, `current_role`, `defense_plan`, `user_is_pro` are NOT defined on the `ScanReport` interface in `scan-engine.ts:184`. They are accessed with `(report as any)` in 8+ components. If `process-scan` changes the field names, no TypeScript error fires anywhere — silent runtime breakage at scale.
- **Where**: `src/lib/scan-engine.ts:184` — `export interface ScanReport`. Used in `SkillCrisisResponseCenter.tsx:407`, `VerdictReveal.tsx:471`, `ManagerConfidenceCard.tsx:20,23`, `DiagnosticLaunchCard.tsx:20`, `CareerGenomeDebate.tsx:274`, `JobSafetyCard.tsx:114`, `AIDossierReveal.tsx:164`, `JobBachaoDashboard.tsx:65,68`
- **Fix**: Add to `ScanReport` interface in `scan-engine.ts`:
  ```typescript
  threat_timeline?: Array<{ skill: string; months_to_displacement: number; severity: string }>;
  role_detected?: string;
  current_role?: string;
  defense_plan?: { pivot_options?: Array<{ role?: string; title?: string }>; [key: string]: unknown };
  user_is_pro?: boolean;
  ```
  Then remove `(report as any)` casts in all 8 components and replace with `report.field_name`.

---

### 10. [DATA-FLOW] [Critical] `ChallengeResult.tsx:40-51` — scan queries have no error handling; crashes on bad data
- **What's broken**: Two sequential `.from('scans')` queries at lines 40 and 50 destructure only `data`, never `error`. If either query fails (bad scan ID, RLS block, network error), `challengerScan` / `respondentScan` is `undefined`. The component then accesses `data.respondentScore` at line 87 and crashes with `TypeError: Cannot read properties of undefined`.
- **Where**: `src/pages/ChallengeResult.tsx:40-51`
- **Fix**: Add error destructuring and null guards:
  ```typescript
  const { data: challengerScan, error: e1 } = await supabase.from('scans')...
  if (e1 || !challengerScan) { setError('Scan data unavailable'); return; }
  const { data: respondentScan, error: e2 } = await supabase.from('scans')...
  if (e2) { /* respondent hasn't scanned yet — show pending state */ }
  ```

---

### 11. [API-CONTRACT] [Critical] `SideHustleGenerator.tsx:706` uses `VITE_SUPABASE_PROJECT_ID` — undocumented env var, URL breaks silently
- **What's broken**: `SideHustleGenerator.tsx:706` builds the edge function URL as `` `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-side-hustles` ``. `VITE_SUPABASE_PROJECT_ID` is NOT in `.env.example` and is not used anywhere else. If it's not defined in `.env.local`, the URL becomes `https://undefined.supabase.co/...` — every side hustle generation silently returns a network error. `SideHustleGenerator` is imported in `Index.tsx:49` via lazy load — this is live user-facing code.
- **Where**: `src/components/SideHustleGenerator.tsx:706`
- **Fix**: Replace line 706 with:
  ```typescript
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${baseUrl}/functions/v1/generate-side-hustles`;
  ```
  This is consistent with every other component's URL construction pattern.

---

### 12. [DATA-FLOW] [Critical] `RescanDetector.tsx:31-38` — data accessed without null/error guard
- **What's broken**: `RescanDetector.tsx:31-38` queries `scans` and destructures `data` without checking `error`. Then accesses `data[0]` without confirming the array is non-empty. If no scan matches (new user, wrong ID) or query fails, `data[0]` is `undefined` and accessing its properties throws.
- **Where**: `src/components/RescanDetector.tsx:31-38`
- **Fix**: Add: `if (error || !data?.length) return;` immediately after the query and before `data[0]` access.

---

### 13. [DATA-FLOW] [Critical] `DoomClockCard` auto-capture `useEffect` stale closure — share image never generates if skills load after mount
- **What's broken**: `DoomClockCard.tsx:209` — `useEffect(() => { if (topSkills.length === 0) return; ... }, [])` has an empty dependency array but references `topSkills` (derived from props). If the component mounts before `report.at_risk_skills` is populated, `topSkills.length === 0`, the effect exits early, and auto-capture **never fires** on subsequent renders when skills arrive. The DoomClock share image is silently never generated.
- **Where**: `src/components/cards/DoomClockCard.tsx:209`
- **Fix**: Change dependency array from `[]` to `[topSkills]`:
  ```typescript
  React.useEffect(() => {
    if (topSkills.length === 0) return;
    // ... html2canvas logic
  }, [topSkills]);
  ```

---

## 🟠 High — Fix Soon

### 14. [ROUTE-AUTH] [High] `AuthGuard` DEV_SESSION provides no pro/subscription state — Pro UI untestable locally
- **What's broken**: The DEV_SESSION has `role: 'authenticated'` but no `subscription_tier` or `user_is_pro`. All components that gate on `user_is_pro` (ConversionGateCard, AIDossierReveal, InsightCards) render in free-tier mode during local dev. The Pro experience is untestable without a paid account.
- **Where**: `src/components/AuthGuard.tsx:14-18`
- **Fix**: Update DEV_SESSION: `user: { id: 'dev-test-user', email: 'test@localhost.dev', role: 'authenticated', user_metadata: { subscription_tier: 'pro' } }`. This simulates Pro during dev without any production impact.

---

### 15. [DB-SCHEMA] [High] `pulse_beta_scans`, `pulse_beta_alerts`, `pulse_beta_students` — ghost tables in unreachable feature
- **What's broken**: `src/features/wellnessBeta/` (`.jsx` files, not TypeScript) queries 3 tables with no migrations. The feature has no route in `App.tsx` and is unreachable by users.
- **Where**: `src/features/wellnessBeta/BetaChildList.jsx:67`, `BetaChildHistory.jsx:117,123,145`, `BetaScanResult.jsx:63,83,100`
- **Fix**: Delete `src/features/wellnessBeta/` entirely. No user can reach it; it adds confusion and dead DB references.

---

### 16. [TYPE-SAFETY] [High] 12+ `(report as any)` casts for fields that ARE already typed on `ScanReport`
- **What's broken**: `arbitrage_role`, `city` (via `recommended_city`), `pivot_roles`, `country`, `years_experience`, `metro_tier`, `moat_score`, `urgency_score`, `estimated_monthly_salary_inr`, `all_skills`, `execution_skills`, `strategic_skills` are all defined as optional fields on `ScanReport`. Components use `(report as any).X` unnecessarily, disabling type checking for the entire object access chain.
- **Where**: `ConversionGateCard.tsx:28,62`, `JobSafetyCard.tsx:114-115`, `CareerPivotCard.tsx:237-239`, `CheatSheet.tsx:102`, `ResumeWeaponizerWidget.tsx:57`, `KnowledgeGraphView.tsx:20`, `FateCardShare.tsx:146-147`, `unified-skill-classifier.ts:60-61`, `airmm-optimizer.ts:125,161`
- **Fix**: Remove the `(report as any)` wrapper from all these calls. Use `report.arbitrage_role`, `report.pivot_roles`, etc. directly. They're already typed as optional — no null check required to compile.

---

### 17. [TYPE-SAFETY] [High] 6 Supabase table queries cast with `as any` — entire DB operation is untyped
- **What's broken**: `supabase.from('scan_feedback' as any)`, `supabase.from('challenges' as any)`, `supabase.from('scans' as any)` bypass the Supabase query builder's type inference. Column name typos and wrong insert shapes won't be caught at compile time.
- **Where**: `StartupAutopsyPage.tsx:25`, `ShareExportCard.tsx:50`, `FeedbackButtons.tsx:18`, `ChallengeColleague.tsx:23`, `MicroFeedback.tsx:19`, `MoneyShotCard.tsx:171`, `ThankYouFooter.tsx:41`, `ChallengeResult.tsx:29`, `use-live-enrichment.ts:96,134`
- **Fix**: After types regeneration (issue #1 step 5), all these tables will be in the generated types. Remove all `as any` casts. The queries will be fully type-checked.

---

### 18. [TYPE-SAFETY] [High] `ShareScan.tsx:15` casts entire Supabase client as `any`
- **What's broken**: `(supabase as any).from('scans')` casts the entire client — not just the table name. This disables all type inference for the query result shape, not just the table lookup.
- **Where**: `src/pages/ShareScan.tsx:15`
- **Fix**: `scans` IS in `types.ts`. Replace `(supabase as any).from('scans')` with `supabase.from('scans')`. If a custom `x-scan-access-token` header is needed for RLS, use the `createScanClient` helper exported from `scan-engine.ts`.

---

### 19. [DATA-FLOW] [High] `JobBachaoDashboard.tsx` has unhandled promise rejections — and is dead code
- **What's broken**: `JobBachaoDashboard.tsx:72-76,152` — async functions called without `.catch()`. Promise rejections are unhandled and bubble to uncaught exception handlers. The component is never imported in any active route.
- **Where**: `src/components/JobBachaoDashboard.tsx:72-76,152`
- **Fix**: Delete the file (it's dead code — see issue #28). This resolves the error handling issue and the ghost table reference simultaneously.

---

### 20. [DATA-FLOW] [High] `Index.tsx:378` checks `session` without checking auth loading state
- **What's broken**: `Index.tsx:378` — `if (scanReport && session && !session.user?.user_metadata?.subscription_tier)`. The `useAuth()` hook has a `loading` state. During loading, `session` is `null`, so the condition is silently skipped — the subscription check never runs for users who load the page while auth is initializing.
- **Where**: `src/pages/Index.tsx:378`
- **Fix**: Destructure `loading` from `useAuth()` at the top of `Index.tsx` and add `!loading &&` to the condition: `if (scanReport && !loading && session && !session.user?.user_metadata?.subscription_tier)`.

---

### 21. [API-CONTRACT] [High] `LOVABLE_API_KEY` referenced with inconsistent names across edge functions
- **What's broken**: 7 edge functions use different `Deno.env.get()` key names to retrieve the AI gateway key. A key rotation that updates the Supabase secret under one name silently breaks functions using an alternative name.
- **Where**: `supabase/functions/` — various `index.ts` files
- **Fix**: Audit every `Deno.env.get(...)` call that retrieves the AI key. Standardize to one name: `LOVABLE_API_KEY`. Add startup assertion in each function: `const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY'); if (!LOVABLE_KEY) return new Response(JSON.stringify({ error: 'AI gateway not configured' }), { status: 503, headers: corsHeaders });`

---

### 22. [ROUTE-AUTH] [High] `/diagnostic` and `/obituary` are fully public — may expose paid report data
- **What's broken**: Both routes have no `<AuthGuard>` wrapper in `App.tsx`. If either renders scan data queried by user ID from the database, unauthenticated users can see it.
- **Where**: `src/App.tsx` — route definitions at lines for `/diagnostic` and `/obituary`
- **Fix**: Review each page. If they load data tied to a user session, wrap with `<AuthGuard>`. If they're intentionally public but token-gated, confirm the token validation path handles invalid tokens with a redirect.

---

### 23. [TYPE-SAFETY] [High] `DashboardTypes.ts:37-39,47-48` has `any`-typed interface fields
- **What's broken**: Interface fields typed as `any` propagate through any component that imports the interface, disabling type safety downstream.
- **Where**: `src/components/dashboard/DashboardTypes.ts:37-39,47-48`
- **Fix**: Replace each `any` field with the most specific known type based on what the API returns. Use `unknown` as a fallback where unsure, and add runtime type guards at point of use.

---

### 24. [TYPE-SAFETY] [High] `RiskIQDashboard.tsx:388,485,1053,1055` — 4 function parameters typed as `any`
- **What's broken**: This is a 1000+ line component. Any-typed parameters bypass all downstream type inference in functions that process user data.
- **Where**: `src/components/riskiq/RiskIQDashboard.tsx:388,485,1053,1055`
- **Fix**: Read each function's call site and derive the actual input type. Replace `: any` with the specific type or `Record<string, unknown>` with appropriate guards.

---

### 25. [ENV-CONFIG] [High] `ProUpgradeModal.tsx:131` — Razorpay key used without null guard
- **What's broken**: `const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID`. No check before passing to Razorpay SDK. If `.env.local` is missing this key, the payment modal throws a JS error visible to users.
- **Where**: `src/components/ProUpgradeModal.tsx:131`
- **Fix**: Add before SDK instantiation: `if (!RZP_KEY) { toast.error('Payment not available. Please contact support.'); return; }`

---

### 26. [DATA-FLOW] [High] `AIDossierReveal` streams dossier for ALL users including free — wastes AI credits
- **What's broken**: After the `isProUser` gate was added (free users see a teaser, Pro users see the full dossier), `startStreaming()` still fires on mount regardless of `isProUser`. Every free user's reveal costs LOVABLE_API_KEY credits for an AI generation they never see.
- **Where**: `src/components/AIDossierReveal.tsx:685-694`
- **Fix**: Wrap the `startStreaming()` call in a guard: `if (isProUser) { startStreaming(); }`.

---

### 27. [DEAD-CODE] [High] `JobBachaoDashboard.tsx` + `IntelTab.tsx` + `IntelWatchlist.tsx` — dead component tree, 3 ghost tables
- **What's broken**: `JobBachaoDashboard` is never imported in any active route. Its import chain pulls in `IntelTab` → `IntelWatchlist` (queries `intel_watchlist`) + `PanicIndexWidget` + `CompanyBenchmarkWidget` + lazy `WeeklyBriefWidget` (queries `weekly_briefs`). These are bundled dead weight and create ghost table requirements that block migration verification.
- **Where**: `src/components/JobBachaoDashboard.tsx`, `IntelTab.tsx`, `IntelWatchlist.tsx`, `WeeklyBriefWidget.tsx`
- **Fix**: Delete all four files. Run TypeScript check to confirm no active imports. This also resolves issues #4 and #5.

---

### 28. [DEAD-CODE] [High] 6 unused components bundled — including several with type errors and `as any` casts
- **What's broken**: `VerdictReveal.tsx`, `MoatsSection.tsx`, `NavLink.tsx`, `SkillCrisisResponseCenter.tsx`, `StartupAutopsyPage.tsx`, `TechnologySection.tsx` are never imported in any route or active component. They are compiled and type-checked on every build. Several contain `as any` casts that inflate the false-positive count in any future type audit.
- **Where**: `src/components/VerdictReveal.tsx`, `MoatsSection.tsx`, `NavLink.tsx`, `SkillCrisisResponseCenter.tsx`, `StartupAutopsyPage.tsx`, `TechnologySection.tsx`
- **Fix**: Move all 6 to `src/_archive/components/` or delete them.

---

### 29. [DB-SCHEMA] [High] `scan_vectors` migration needs `CREATE EXTENSION IF NOT EXISTS vector` — will fail without it
- **What's broken**: `20260401000001_cohort_intelligence_engine.sql` creates a `vector(16)` column. If `pgvector` is not pre-enabled, migration fails with `type "vector" does not exist` and aborts the entire migration sequence.
- **Where**: `supabase/migrations/20260401000001_cohort_intelligence_engine.sql` — first line
- **Fix**: Add as the first line of the migration: `CREATE EXTENSION IF NOT EXISTS vector;`

---

### 30. [API-CONTRACT] [High] `IntelTab.tsx:349,354,372,409,413` — 5 map/filter callbacks typed as `any`
- **What's broken**: Map and filter callbacks over API data typed as `: any` mean field access errors inside the callbacks are never caught.
- **Where**: `src/components/dashboard/IntelTab.tsx:349,354,372,409,413`
- **Fix**: If `IntelTab` is deleted (issue #27), this resolves automatically. If kept, define a type for the items being mapped and replace `: any` with it.

---

### 31. [TYPE-SAFETY] [High] `AIDossierReveal.tsx:710-784` — 15+ markdown render component props typed as `any`
- **What's broken**: The `markdownComponents` object types every render prop as `({ children, ...props }: any)`. A breaking change in `react-markdown`'s prop types won't be caught.
- **Where**: `src/components/AIDossierReveal.tsx:710-784`
- **Fix**: Import `Components` from `react-markdown`: `import type { Components } from 'react-markdown'`. Type the object: `const markdownComponents: Partial<Components> = { h1: ({ children }) => <h1>...</h1>, ... }`.

---

### 32. [DATA-FLOW] [High] `scan-engine.ts:10-12` throws at module load — causes blank white screen if env vars missing
- **What's broken**: The `throw new Error(...)` at module scope runs when the file is first imported. If env vars are not set during a Vite build, the entire app bundle crashes on load with no UI recovery path. Users see a blank white screen.
- **Where**: `src/lib/scan-engine.ts:10-12`
- **Fix**: Move the guard inside `createScanClient()` instead of at module scope, so the error is deferred until an actual scan is attempted. The app can then render an error state instead of crashing entirely.

---

### 33. [ENV-CONFIG] [High] 6 components manually construct edge function URLs — should use shared helper
- **What's broken**: `CompanyBenchmarkWidget.tsx:68`, `PanicIndexWidget.tsx:96`, `BestFitJobsCard.tsx:45`, `CareerPivotCard.tsx:223`, `CareerGenomeDebate.tsx:298`, `AIDossierReveal.tsx:582` each manually build `${VITE_SUPABASE_URL}/functions/v1/...` and manage auth headers. If the URL structure changes, 6 files need updating.
- **Where**: 6 files above
- **Fix**: Add a helper to `src/lib/utils.ts`:
  ```typescript
  export function edgeFnUrl(name: string): string {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  }
  ```
  Replace all manual constructions with `edgeFnUrl('function-name')`. For non-streaming calls, migrate to `supabase.functions.invoke()` entirely.

---

### 34. [API-CONTRACT] [High] `use-analytics.ts` insert fails silently with no operational visibility
- **What's broken**: Analytics inserts fail silently (table doesn't exist — see issue #7). Even after the table is created, the only signal of failure is a `console.warn`. In production, there is no way to know if analytics are broken.
- **Where**: `src/hooks/use-analytics.ts:48`
- **Fix**: After issue #7 migration: add a `consecutiveFailures` counter. If it exceeds 5, fire a `console.error('[analytics] Persistent insert failures — analytics data is NOT being captured')`. This is detectable in Supabase logs and browser error monitoring.

---

### 35. [TYPE-SAFETY] [High] `use-live-enrichment.ts:96,134` casts `scans` table as `any` unnecessarily
- **What's broken**: `scans` IS in `types.ts`. The `as any` cast disables type checking on select/eq/single chain — column name typos won't be caught.
- **Where**: `src/hooks/use-live-enrichment.ts:96,134`
- **Fix**: Remove the `as any` cast. Use `supabase.from('scans')` directly.

---

## 🟡 Medium — Fix When You Can

### 36. [TYPE-SAFETY] [Medium] `catch (e: any)` throughout codebase — should be `unknown`
- **Where**: `src/pages/Auth.tsx:75,95,121` and 20+ other catch blocks
- **Fix**: Global replace `catch (e: any)` → `catch (e: unknown)`. Add `const msg = e instanceof Error ? e.message : String(e)` where `.message` is used. Add ESLint rule `@typescript-eslint/no-explicit-any: warn`.

---

### 37. [DEAD-CODE] [Medium] `usePredictionHistory` hook built but never used in any component
- **Where**: `src/hooks/usePredictionHistory.ts`
- **Fix**: Wire into a component (e.g., show prediction accuracy in DoomClockCard), or delete if not planned for this release.

---

### 38. [DEAD-CODE] [Medium] `diagnosticApi.ts` — 4 exported functions never called
- **Where**: `src/utils/diagnosticApi.ts` — `saveDiagnosticResult`, `generateSurvivalPlan`, `generateRolePrompts`, `enableSharing`
- **Fix**: Verify against `pages/Diagnostic.tsx` and `pages/DiagnosticShare.tsx`. Delete any that are unused.

---

### 39. [DEAD-CODE] [Medium] `diagnosticCalculations.ts` — 4 exported functions never called
- **Where**: `src/utils/diagnosticCalculations.ts` — `autoDetectSkills`, `calculateRiskScore`, `computeMetrics`, `getVerdict`
- **Fix**: Same as #38 — verify and delete unused exports.

---

### 40. [DEAD-CODE] [Medium] `seniority-utils.ts` — 4 of 6 exports are unused
- **Where**: `src/lib/seniority-utils.ts` — `getDisplayScore`, `getGlowColor`, `getSeniorityRank`, `getVerdictMessage`
- **Fix**: Remove the 4 unused exports. `inferSeniorityTier` and `isExecutiveTier` are actively used; keep those.

---

### 41. [DEAD-CODE] [Medium] `local-cache.ts` — `getCached`, `setCached`, `invalidateCache` unused
- **Where**: `src/lib/local-cache.ts`
- **Fix**: Delete the file. If caching is needed, the existing `enrichment_cache` table in the DB serves that purpose.

---

### 42. [DEAD-CODE] [Medium] `i18n.ts:localeFromCountry` — unused export
- **Where**: `src/lib/i18n.ts`
- **Fix**: Remove the export.

---

### 43. [DEAD-CODE] [Medium] `use-subscription.ts:PRO_FEATURES` — exported constant never imported
- **Where**: `src/hooks/use-subscription.ts`
- **Fix**: Either consume it in `ProUpgradeModal.tsx` or `ConversionGateCard.tsx` to drive the feature list displayed there, or remove the export.

---

### 44. [API-CONTRACT] [Medium] `ai-dossier` 25-second timeout too short for slow mobile connections
- **Where**: `src/components/AIDossierReveal.tsx:586` — `STREAM_TIMEOUT_MS = 25000`
- **Fix**: Increase to `45000` (45 seconds). The edge function has its own AI generation timeout; 45s is a reasonable client ceiling for mobile.

---

### 45. [ROUTE-AUTH] [Medium] `/share/:scanId` renders empty state on invalid token instead of redirecting
- **Where**: `src/pages/ShareScan.tsx`
- **Fix**: On token validation failure, `navigate('/link-expired', { replace: true })` or render a clear `<LinkExpiredScreen>` component with a CTA to create a new scan.

---

### 46. [DATA-FLOW] [Medium] Multiple card components don't guard against `report` being null
- **Where**: `src/components/InsightCards.tsx` and all card components that receive `report: ScanReport` as required prop
- **Fix**: Add `if (!report) return null;` as the first line of each card component body.

---

### 47. [ENV-CONFIG] [Medium] Edge function secrets not documented
- **Where**: `supabase/functions/` — no `SECRETS.md` exists
- **Fix**: Create `supabase/functions/SECRETS.md` listing every required and optional `Deno.env.get()` variable across all 72 functions, with description and whether it's required vs optional.

---

### 48. [DB-SCHEMA] [Medium] Regenerated `types.ts` will be out of sync after migration until step 5 is run
- **Where**: `src/integrations/supabase/types.ts`
- **Fix**: After `supabase db push`, immediately run `supabase gen types typescript --project-id cakvjjopadfpkeekpdog > src/integrations/supabase/types.ts` and commit the updated file. Add this to the deployment runbook.

---

### 49. [DEPENDENCY-MAP] [Medium] `_archive/` directory compiled by TypeScript on every build
- **Where**: `tsconfig.app.json`
- **Fix**: Add `"exclude": ["src/_archive"]` to `tsconfig.app.json`.

---

### 50. [DEPENDENCY-MAP] [Medium] `ScanReport` lacks index signature — forces `as any` for dynamic field access
- **Where**: `src/lib/scan-engine.ts` — `export interface ScanReport`
- **Fix**: Add `readonly [key: string]: unknown;` as an index signature. This allows `report.anyField` without `as any` while preserving typed access for known fields. This is a pragmatic bridge while the full type gap (issue #9) is being closed.

---

### 51. [DATA-FLOW] [Medium] `FateCardShare.tsx:368,463` uses untyped canvas ref
- **Where**: `src/components/dashboard/FateCardShare.tsx:368,463`
- **Fix**: Type the ref: `const canvasRef = useRef<HTMLCanvasElement>(null)`. Use `canvasRef.current?.getContext('2d')` with optional chaining.

---

### 52. [ENV-CONFIG] [Medium] No dev-mode Supabase connection health check
- **Where**: `src/integrations/supabase/client.ts`
- **Fix**: Add dev-only ping: `if (import.meta.env.DEV) { supabase.from('profiles').select('id').limit(1).then(({ error }) => { if (error) console.error('[supabase] Connection check failed:', error.message); }); }`

---

### 53. [DEAD-CODE] [Medium] `AdvancedBeta.tsx` has a route but no navigation link — unreachable by users
- **Where**: `src/App.tsx`, `src/pages/AdvancedBeta.tsx`
- **Fix**: Either add a navigation entry for the `/advanced-beta` route or remove it from `App.tsx` if the feature is deprecated.

---

## 🟢 Low — Polish & Cleanup

### 54. [DEAD-CODE] [Low] `use-toast.ts` exports internal `reducer` function — implementation detail leaks
- **Where**: `src/hooks/use-toast.ts`
- **Fix**: Remove `export` from the `reducer` function.

---

### 55. [DB-SCHEMA] [Low] `cohort-match` edge function returns `{ cohort_size: 0 }` on cold start — no log entry
- **Where**: `supabase/functions/cohort-match/index.ts`
- **Fix**: Add a `console.log('[cohort-match] cold start: cohort_size=0 for scan_id:', scanId)` to track the cold-start period. No functional change needed.

---

### 56. [ENV-CONFIG] [Low] `FIRECRAWL_API_KEY` / `TAVILY_API_KEY` optional secrets have no fallback warning in logs
- **Where**: `supabase/functions/parse-linkedin/index.ts`
- **Fix**: On startup, log which optional integrations are active: `console.log('[parse-linkedin] Firecrawl:', !!Deno.env.get('FIRECRAWL_API_KEY'), 'Tavily:', !!Deno.env.get('TAVILY_API_KEY'))`.

---

### 57. [TYPE-SAFETY] [Low] `use-subscription.ts:PRO_FEATURES` uses string literal union type — could be an enum
- **Where**: `src/hooks/use-subscription.ts`
- **Fix**: Minor — convert to `const enum` or `as const` object if the list grows.

---

### 58. [DATA-FLOW] [Low] `DoomClockCard` manual share button label still says "Preparing..." after image ready
- **Where**: `src/components/cards/DoomClockCard.tsx` — button label logic
- **Fix**: After the useEffect fix (issue #13), verify the button label transitions correctly from "Preparing…" → "Download Share Card" once `imageUrl` is set.

---

### 59. [ENV-CONFIG] [Low] No startup validation that `VITE_RAZORPAY_KEY_ID` starts with `rzp_live_` in production
- **Where**: `src/components/ProUpgradeModal.tsx:131`
- **Fix**: Add a dev-only warning: `if (import.meta.env.DEV && RZP_KEY?.startsWith('rzp_test_')) console.warn('[payments] Using Razorpay TEST key — payments will not be real');`

---

## Deployment Runbook (in required order)

1. In Supabase dashboard → Extensions: enable `vector` (pgvector)
2. `supabase db push --project-ref cakvjjopadfpkeekpdog`
3. `supabase gen types typescript --project-id cakvjjopadfpkeekpdog > src/integrations/supabase/types.ts`
4. `supabase functions deploy --project-ref cakvjjopadfpkeekpdog`
5. Set secrets in Supabase dashboard: `LOVABLE_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`
6. Apply code fixes #2, #3, #11 (auth guard column, dev bypass, SideHustleGenerator URL)
7. `npx tsc --noEmit` — confirm zero errors
8. `npm run build` (NOT `build:dev`) — confirm clean production bundle
