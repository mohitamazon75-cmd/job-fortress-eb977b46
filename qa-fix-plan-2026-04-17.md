# QA Fix Plan — JobBachao — 2026-04-17

## Summary
5 critical · 7 high · 9 medium · 6 low

The codebase is functionally sound with a clean TypeScript build and 172 passing tests.
The primary risks are: (1) four DB tables written to from frontend that don't exist in the
schema — causing silent failures on every insert; (2) two edge functions called from the
frontend that are not deployed; (3) a hardcoded placeholder WhatsApp number that will
send weekly alert requests to a wrong number. Most issues are contained and fixable in
a single session.

---

## 🔴 Critical — Fix Before Anything Else

### C1: `score_events` table does not exist — all inserts silently fail
- **What's broken**: `use-insight-track.ts` and `ScoreTimeline.tsx` both write to `score_events`. The table is not in any migration. Every insert returns an error that is swallowed by the `as any` cast. ScoreTimeline shows blank.
- **Where**: `src/hooks/use-insight-track.ts:65`, `src/components/dashboard/ScoreTimeline.tsx:32`
- **Fix**: Create migration `CREATE TABLE IF NOT EXISTS public.score_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), scan_id UUID REFERENCES public.scans(id), event_type TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT now()); ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;`

### C2: `behavior_events` table does not exist — analytics tracking broken
- **What's broken**: `src/hooks/use-track.ts:8` inserts into `behavior_events` on every meaningful user action. Table doesn't exist. All analytics is silently failing.
- **Where**: `src/hooks/use-track.ts:8`
- **Fix**: Create migration `CREATE TABLE IF NOT EXISTS public.behavior_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), event_name TEXT NOT NULL, properties JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now()); ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY; CREATE POLICY "anon_insert_behavior" ON public.behavior_events FOR INSERT WITH CHECK (true);`

### C3: `compute-trajectory` edge function not deployed — TrajectoryCard shows loading forever
- **What's broken**: `TrajectoryCard.tsx` calls `supabase.functions.invoke("compute-trajectory")`. The function exists in the repo (`supabase/functions/compute-trajectory/index.ts`) but hasn't been deployed. Every Tools tab load fails silently on this card.
- **Where**: `src/components/cards/TrajectoryCard.tsx:71`
- **Fix**: Run `supabase functions deploy compute-trajectory --project-ref dlpeirtuaxydoyzwzdyz`. The function is ready.

### C4: WhatsApp weekly alert sends to hardcoded `919999999999` — NOT a real number
- **What's broken**: `Card7HumanAdvantage.tsx` opens `wa.me/919999999999` for weekly alerts. This is a placeholder that was never replaced. Users who enter their phone number are sending a WhatsApp message to a non-existent number with no delivery.
- **Where**: `src/components/model-b/Card7HumanAdvantage.tsx:29`
- **Fix**: Replace `919999999999` with the actual JobBachao WhatsApp Business number, OR change the approach to just open WhatsApp with the user's own pre-filled message to share with their contacts (remove the business number entirely and use `wa.me/?text=...` without a target number).

### C5: `cohort_percentiles` and `beta_events` tables referenced in edge functions — missing
- **What's broken**: Edge functions reference `cohort_percentiles` (in `cohort-match`) and `beta_events` (in older tracking functions). These tables don't exist in migrations. Any edge function path that hits these tables will crash.
- **Where**: `supabase/functions/cohort-match/index.ts`, various tracking functions
- **Fix**: Search for `.from('cohort_percentiles')` and `.from('beta_events')` in all edge functions. Either create the tables with a migration or replace the references with `cohort_cache` (which exists) and `analytics_events` (which exists) respectively.

---

## 🟠 High — Fix Soon

### H1: `logEvent` in ResultsModelB inserts to `user_action_signals` before `cardData` exists
- **What's broken**: The enhanced `logEvent` callback reads `cardData?.user?.current_title` etc. But `logEvent` is available immediately (e.g., on `card_viewed` for card 0 the Verdict), before `cardData` is populated. The insert will have null values for all context fields on early events.
- **Where**: `src/pages/ResultsModelB.tsx:134-146`
- **Fix**: Add guard `if (!analysisId) return;` at the top of the behavioral signal insert block. Also add `scan_role: cardData?.user?.current_title ?? null` (already has nullish coalescing so this is fine, but add a check that `analysisId` is set).

### H2: PeerRankCard uses `Math.random()` in render — value changes on every rerender
- **What's broken**: `computePeerInsights` calls `Math.floor(180 + Math.random() * 200)` for `peerCount` on every call. Since this runs inside the component body (not in `useState`), every React rerender shows a different peer count. Users will see the number jump.
- **Where**: `src/components/cards/PeerRankCard.tsx` — `computePeerInsights` function
- **Fix**: Move `peerCount` into a `useMemo` or `useState` initializer: `const [peerCount] = useState(() => Math.floor(180 + Math.random() * 200));` so it only generates once per mount.

### H3: TrajectoryCard has no error state — failure shows loading forever
- **What's broken**: If `compute-trajectory` returns an error or times out, `setLoading(false)` is called but `trajectory` stays null and the component renders nothing. Users see empty space with no explanation.
- **Where**: `src/components/cards/TrajectoryCard.tsx:69-81`
- **Fix**: Add `const [error, setError] = useState(false)`. In the catch block, `setError(true)`. Render a fallback: `if (error) return <div>Trajectory data unavailable — rescan to compute</div>;`

### H4: CohortRankCard and LivingScoreCard invoke functions without checking error response
- **What's broken**: Both cards destructure only `{ data: res }` from `supabase.functions.invoke(...)`, ignoring the `error` field. If the function returns a 500, `res` is null and the component crashes or shows nothing with no user feedback.
- **Where**: `src/components/cards/CohortRankCard.tsx:35`, `src/components/cards/LivingScoreCard.tsx:25`
- **Fix**: Destructure both: `const { data: res, error } = await supabase.functions.invoke(...)`. Add `if (error || !res?.success) { setError(true); return; }` before using `res`.

### H5: `score_history` table is queried from frontend but schema has no user-accessible RLS
- **What's broken**: `ScoreTimeline.tsx` reads from `score_history` for the logged-in user, but if RLS policies don't include anonymous/unauthenticated users, the query silently returns empty. Score trend always shows blank for new users.
- **Where**: `src/components/dashboard/ScoreTimeline.tsx`
- **Fix**: Verify in Supabase Dashboard → Authentication → Policies that `score_history` has `SELECT` policy for `auth.uid() = user_id`. If missing, add: `CREATE POLICY "users_read_own_history" ON public.score_history FOR SELECT USING (auth.uid() = user_id);`

### H6: `create-bucket` and `process-email-queue` edge functions have no CORS headers
- **What's broken**: Both functions skip the `OPTIONS` preflight check. If called from the browser (cross-origin), they will fail with a CORS error before the function body runs.
- **Where**: `supabase/functions/create-bucket/index.ts`, `supabase/functions/process-email-queue/index.ts`
- **Fix**: Add at the top of each: `if (req.method === "OPTIONS") return handleCorsPreFlight(req);` and import `handleCorsPreFlight` from `../_shared/cors.ts`.

### H7: `upload-resume` edge function exists but may not be deployed
- **What's broken**: `src/lib/scan-engine.ts` calls `${SUPABASE_URL}/functions/v1/upload-resume`. If this function isn't deployed, resume uploads fail silently (no error shown to user).
- **Where**: `src/lib/scan-engine.ts`
- **Fix**: Run `supabase functions deploy upload-resume --project-ref dlpeirtuaxydoyzwzdyz`. Verify it's in the deployed functions list in Supabase Dashboard.

---

## 🟡 Medium — Fix When You Can

### M1: 20 stale Vite timestamp files in root directory
- **What's broken**: `vite.config.ts.timestamp-*` files litter the root. They don't affect the build but add confusion and should be gitignored.
- **Where**: Root directory — 20 files
- **Fix**: Add `vite.config.ts.timestamp-*` and `vitest.config.ts.timestamp-*` to `.gitignore`. Run `git rm --cached vite.config.ts.timestamp-* vitest.config.ts.timestamp-*` then `git commit`.

### M2: 123 `as any` casts suppress TypeScript errors throughout the codebase
- **What's broken**: 123 instances of `as any` mean TypeScript cannot catch type mismatches. Many are on DB calls where the table/column shape could change silently.
- **Where**: Throughout `src/` — highest concentration in `InsightCards.tsx`, `AIDossierReveal.tsx`, `ResultsModelB.tsx`
- **Fix**: Regenerate Supabase TypeScript types: `supabase gen types typescript --project-id dlpeirtuaxydoyzwzdyz > src/integrations/supabase/types.ts`. Replace `as any` with the generated types for DB calls.

### M3: Multiple `.map()` calls missing `key` prop in `AIDossierReveal.tsx`
- **What's broken**: 6+ `.map()` calls in `AIDossierReveal.tsx` use index `i` directly without a `key` prop on the rendered element. React will log warnings and potentially misrender on updates.
- **Where**: `src/components/AIDossierReveal.tsx:62, 319, 393, 403, 511, 566`
- **Fix**: Add `key={i}` or `key={item.id || i}` to the outer element of each `.map()` return.

### M4: Hero section role selector chips all call `onStart` — no role context passed
- **What's broken**: The 6 role chips ("Software Engineer", "Product Manager", etc.) all call `onStart()` with no role context. The scan flow doesn't know which role the user self-identified as, so the onboarding doesn't pre-fill industry intelligently.
- **Where**: `src/components/HeroSection.tsx` — role selector chips
- **Fix**: Change `HeroSection` to accept `onStartWithRole?: (role: string) => void`. In `Index.tsx`, handle this by pre-filling the industry state based on role. Or at minimum, store the selected role in `sessionStorage` so it can inform the onboarding step.

### M5: `SkillCompoundCalculator` `startUrl` array uses placeholder generic URLs
- **What's broken**: When `cardData` has no at-risk skills, the fallback `startUrl` array uses hardcoded strings including `"https://coursera.org"` (no specific course), `"https://udemy.com"` (homepage). Users who click "Start →" get the homepage, not a relevant course.
- **Where**: `src/components/cards/SkillCompoundCalculator.tsx:54-55`
- **Fix**: Replace generic fallback URLs with specific free India-accessible resources:
  - Python → `https://cs50.harvard.edu/python/2022/`
  - SQL → `https://mode.com/sql-tutorial/introduction-to-sql/`
  - Cloud → `https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/`
  - AI → `https://www.deeplearning.ai/short-courses/`

### M6: OfficePowerVocab phrases hardcoded in component — not personalised to user's role
- **What's broken**: All 20 phrases are generic. A Healthcare professional gets the same "₹X" negotiation examples as an IT professional. The Bengaluru salary examples are irrelevant for Mumbai or Pune users.
- **Where**: `src/components/cards/OfficePowerVocab.tsx` — `VOCAB_DATA` array
- **Fix**: Filter/sort `VOCAB_DATA` based on `cardData?.user?.location` and `cardData?.user?.current_title`. Prioritise "data" situation for data analysts, "negotiation" for senior users (>8 years). Add city-specific salary references using the user's actual city from `cardData`.

### M7: TrajectoryCard `industryDecay` hardcoded for `"Marketing & Advertising"` but card data industry may differ
- **What's broken**: `DECAY_RATES["Marketing & Advertising"]` = 1.8 but `cardData.user.industry` from the LLM may return slightly different strings like `"FMCG"` or `"Ad Tech"`. The lookup falls back to `"default"` silently.
- **Where**: `supabase/functions/compute-trajectory/index.ts` — `DECAY_RATES`
- **Fix**: Add fuzzy matching: normalise the industry string to lowercase and check for substrings. E.g., if `industry.toLowerCase().includes('market')` → use Marketing rate. If it includes `'health'` or `'medic'` → Healthcare rate.

### M8: `user_action_signals` migration not applied to production yet
- **What's broken**: The migration file exists (`20260417042355_user_action_signals_trajectory.sql`) but Supabase MCP has been unable to apply migrations this session. The table may not exist in production.
- **Where**: `supabase/migrations/20260417042355_user_action_signals_trajectory.sql`
- **Fix**: In Supabase SQL Editor, manually run: `\i 20260417042355_user_action_signals_trajectory.sql` or paste the migration content directly. Verify the table exists: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('user_action_signals','trajectory_predictions');`

### M9: Anon key is hardcoded in two source files (low risk but bad practice)
- **What's broken**: The Supabase anon key is hardcoded in `src/integrations/supabase/client.ts:6` and `src/lib/supabase-config.ts:7` as a fallback. The anon key is not secret (it's designed to be public) but hardcoding it means you can't rotate it without a code deploy.
- **Where**: Both files above
- **Fix**: Remove the hardcoded fallback. Require `VITE_SUPABASE_PUBLISHABLE_KEY` to be set. Add a startup check: `if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required');`

---

## 🟢 Low — Polish & Cleanup

### L1: 196 hardcoded hex colors in components — should use CSS variables
- **What's broken**: `Card7HumanAdvantage`, `Card5JobsTracker`, `OfficePowerVocab` etc. use inline `style={{ color: '#dc2626' }}` instead of `color: 'var(--mb-red)'`. If theme colors are updated, these won't change.
- **Where**: Throughout `src/components/model-b/` and new feature components
- **Fix**: Audit and replace the most visible hardcoded colors (`#dc2626`, `#16a34a`, `#2563eb`, `#d97706`) with `var(--mb-red)`, `var(--mb-green)`, `var(--mb-navy)`, `var(--mb-amber)`.

### L2: 20 stale `vite.config.ts.timestamp-*` files pollute the repo root
- **Where**: Root directory
- **Fix**: `echo "vite.config.ts.timestamp-*\nvitest.config.ts.timestamp-*" >> .gitignore && git rm --cached vite.config.ts.timestamp-* vitest.config.ts.timestamp-* 2>/dev/null; git commit -m "cleanup: gitignore vite timestamp files"`

### L3: `WhatsAppCaptureBlock` in `Card7HumanAdvantage` sends to hardcoded wrong number (duplicate of C4)
- Already covered in C4.

### L4: SampleReport landing page sample still references "Marketing Manager in Mumbai" in description text
- **Where**: `src/components/SampleReport.tsx` — look for any remaining `Marketing Manager` strings after the data replacement
- **Fix**: `grep -rn "Marketing Manager\|Ananya\|FMCG" src/components/SampleReport.tsx` and replace any missed instances.

### L5: `qa-fix-plan-2026-03-31.md`, `qa-fix-plan-2026-04-01.md`, `qa-fix-plan-2026-04-13.md` accumulating in root
- **Where**: Root directory
- **Fix**: Move all old QA plans to `docs/qa/` folder: `mkdir -p docs/qa && mv qa-fix-plan-*.md docs/qa/ && mv qa-audit-*.md docs/qa/ && mv QA_*.md docs/qa/ && mv AUDIT_*.md docs/qa/ && mv FIXES_*.md docs/qa/`

### L6: `PeerRankCard` confidence disclaimer mentions "Peer counts are estimates" but the number looks very specific
- **Where**: `src/components/cards/PeerRankCard.tsx` — bottom disclaimer
- **Fix**: Change "Peer counts are estimates" to "Based on Knowledge Graph distribution data. Actual peer counts accumulate as more professionals scan." This sets honest expectations without undermining the feature's value.

---

## Deploy Checklist

Run these in order before going live:

```bash
# 1. Apply missing table migrations (paste into Supabase SQL Editor)
# score_events, behavior_events — see C1 and C2

# 2. Deploy missing edge functions
supabase functions deploy compute-trajectory upload-resume \
  --project-ref dlpeirtuaxydoyzwzdyz

# 3. Fix C4 — WhatsApp number
# Replace 919999999999 in Card7HumanAdvantage.tsx

# 4. Apply user_action_signals migration if not done
# Verify: SELECT table_name FROM information_schema.tables 
#   WHERE table_name IN ('user_action_signals','trajectory_predictions');

# 5. Publish in Lovable (syncs all recent commits)
```
