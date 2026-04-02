# QA Fix Plan — Job Fortress / JobBachao — 2026-03-31

## Summary

**7 critical · 10 high · 11 medium · 8 low**

The codebase is architecturally solid — 65 edge functions written, a well-structured scan pipeline, and clean Tailwind/Framer Motion UI. However there is one showstopper that means **nothing works in production right now**: the app is connected to the wrong Supabase project (an astrology app), which has zero Job Fortress tables and zero deployed edge functions. Every database query and every API call will fail the moment a real user tries to use it. Fix that first. After that, the remaining issues are standard SPA hygiene — auth race conditions, a few crash-risk null accesses, missing `type="button"` attributes, and security gaps in two edge functions.

---

## 🔴 Critical — Fix Before Anything Else

---

### WRONG SUPABASE PROJECT CONNECTED — all queries and functions fail
- **What's broken**: The `VITE_SUPABASE_URL` in `.env.local` points to Supabase project `cakvjjopadfpkeekpdog` (name: "trivecta"), which is an astrology app. It has 5 tables: `birth_charts`, `agent_outputs`, `reports`, `profiles`, `agent_prompts`. Job Fortress needs 27 tables: `scans`, `subscriptions`, `scan_credits`, `analytics_events`, `profiles`, etc. Every single `.from('scans')`, `.from('subscriptions')`, etc. returns "relation does not exist". Zero of the 65 edge functions are deployed to this project.
- **Where**: `.env.local` — `VITE_SUPABASE_URL` and `VITE_SUPABASE_PROJECT_ID`
- **Fix**: Change `VITE_SUPABASE_URL` and `VITE_SUPABASE_PROJECT_ID` to the correct Job Fortress Supabase project. If that project doesn't exist yet, create a new Supabase project, run all migrations from `supabase/migrations/`, then deploy all 65 functions with `supabase functions deploy --project-ref <correct-ref>`.

---

### ZERO EDGE FUNCTIONS DEPLOYED — all API calls return 404
- **What's broken**: `supabase functions list` on the connected project returns an empty array. All 65 functions exist in `supabase/functions/` but are unreachable. Every call from the frontend to `best-fit-jobs`, `create-scan`, `process-scan`, `resume-weaponizer`, etc. will get a 404.
- **Where**: Supabase dashboard for project `cakvjjopadfpkeekpdog`
- **Fix**: After correcting the project in item 1 above, run: `supabase functions deploy --project-ref <correct-ref>` to deploy all functions at once. Verify with `supabase functions list`.

---

### useAuth.ts — double initialization race condition causes stale session on first load
- **What's broken**: `getSession()` and `onAuthStateChange` both run simultaneously without ordering. On first mount, if the user is already logged in, both may attempt to set auth state concurrently. The `onAuthStateChange` fires after subscription registers, so on cold load the session can be momentarily null before the callback fires, causing protected content to flash.
- **Where**: `src/hooks/useAuth.ts` lines 10–21
- **Fix**: Call `getSession()` first, set state from it, then subscribe to `onAuthStateChange` only to handle subsequent changes (logout, token refresh). Pattern: `const { data: { session } } = await supabase.auth.getSession(); setSession(session); const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, newSession) => setSession(newSession)); return () => subscription.unsubscribe();`

---

### useAuth.ts — signOut has no error handling; silent logout failures leave user stuck
- **What's broken**: `signOut()` has no error handling. If the Supabase signOut call fails (network error, expired token), the local session is cleared but the server session persists. The user appears logged out locally but is still authenticated on the server.
- **Where**: `src/hooks/useAuth.ts` signOut method (lines ~26–42)
- **Fix**: Wrap signOut in try/catch: `const { error } = await supabase.auth.signOut(); if (error) { console.error('Sign out failed:', error.message); throw error; }` and handle the error in callers so the user sees feedback.

---

### scan-engine.ts — getUser() error never checked; silent anon fallthrough on auth failure
- **What's broken**: `supabase.auth.getUser()` can return an `error` object. The code never checks `if (error)` before using `user`. If auth is invalid or expired, `user` is undefined and the entire scan creation silently proceeds as if the user is anonymous — no error, no feedback, just a broken scan.
- **Where**: `src/lib/scan-engine.ts` line 296
- **Fix**: `const { data: { user }, error } = await supabase.auth.getUser(); if (error || !user) throw new Error('Authentication required. Please sign in again.');`

---

### LinkedInRoastCard.tsx — roastItems[0] access crashes if array is empty
- **What's broken**: On line 172, `roastItems[0].roast.slice(0, 100)` is called without first checking that `roastItems` is non-empty. If the AI response returns no critical/high severity items, the array is empty and this line throws `Cannot read properties of undefined`.
- **Where**: `src/components/cards/LinkedInRoastCard.tsx` line 172
- **Fix**: `roastItems[0]?.roast.slice(0, 100) ?? 'Your profile needs work'`

---

### Index.tsx — null not checked after createScan(); startScanPipeline called with undefined values
- **What's broken**: `createScan()` can fail and return null or undefined `id`/`accessToken`. The code calls `startScanPipeline(id, token)` immediately after without null-checking. If `id` is undefined, the entire pipeline is started with broken parameters, causing silent failures that are very hard to debug.
- **Where**: `src/pages/Index.tsx` line 367 and around `launchScan()`
- **Fix**: Add explicit guard: `if (!id || !accessToken) { setPhase('error'); setErrorReason('scan_create_failed'); return; }` before calling `startScanPipeline`.

---

## 🟠 High — Fix Soon

---

### activate-subscription edge function — JWT comparison not timing-safe (security)
- **What's broken**: The JWT validation in `activate-subscription` uses a non-timing-safe string comparison. This creates a timing oracle vulnerability that allows an attacker to brute-force service role credentials with enough requests.
- **Where**: `supabase/functions/activate-subscription/index.ts` line 39
- **Fix**: Use a constant-time comparison function. In Deno: `import { timingSafeEqual } from 'https://deno.land/std/crypto/timing_safe_equal.ts'; const encoder = new TextEncoder(); if (!timingSafeEqual(encoder.encode(incoming), encoder.encode(expected))) { ... }`

---

### razorpay-webhook edge function — non-timing-safe signature verification (security)
- **What's broken**: Razorpay webhook signature is verified with standard string comparison (`===`) rather than a timing-safe comparison. An attacker with the ability to send many requests could infer the correct signature byte-by-byte.
- **Where**: `supabase/functions/razorpay-webhook/index.ts` lines 37–38
- **Fix**: Replace `hmac === signature` with `timingSafeEqual(encoder.encode(hmac), encoder.encode(signature))`.

---

### use-subscription.ts — unguarded null access after Supabase query
- **What's broken**: After fetching profile with `.single()`, the code accesses `profile?.subscription_tier` and `profile?.subscription_expires_at` without checking the `error` field. If `.single()` throws (no row, or multiple rows), error is swallowed and the app behaves as if the user has no subscription — even if they paid.
- **Where**: `src/hooks/use-subscription.ts` lines 35–45
- **Fix**: `const { data: profile, error } = await supabase.from('profiles').select(...).single(); if (error) { setState(s => ({ ...s, loading: false, tier: 'FREE' })); return; }`

---

### Index.tsx — duplicate session state management creates stale state race condition
- **What's broken**: `Index.tsx` calls `supabase.auth.getSession()` independently on mount (lines ~412–417) instead of consuming the `useAuth()` hook. This means there are two independent auth states in the app. When the token refreshes silently, `useAuth()` updates but `Index.tsx`'s local state doesn't, causing the scan pipeline to use a stale token.
- **Where**: `src/pages/Index.tsx` lines 412–417
- **Fix**: Remove the standalone `getSession()` call and `useState` for session in Index.tsx. Import `useAuth`: `const { session } = useAuth()` and use that single source of truth throughout.

---

### CareerObituaryCard.tsx — useEffect with async fetch, no unmount cleanup (memory leak)
- **What's broken**: `useEffect(() => { fetchData(); }, [fetchData])` — if the component unmounts while the fetch is in-flight, `setLocalData()` is called on an unmounted component, causing a React memory leak warning and potential state corruption.
- **Where**: `src/components/cards/CareerObituaryCard.tsx` line 79
- **Fix**: Add mounted flag: `useEffect(() => { let mounted = true; fetchData().catch(console.error); return () => { mounted = false; }; }, [fetchData])` — and inside `fetchData`, wrap all `setState` calls with `if (mounted)`.

---

### LinkedInRoastCard.tsx — useMemo dependency array incomplete
- **What's broken**: `useMemo<RoastItem[]>(() => { ... }, [report])` captures `moatSkills`, `tools`, `yearsExp`, and other derived values but lists only `[report]` as a dependency. If internal logic is ever refactored to derive these differently, the memo will produce stale results that are very hard to debug.
- **Where**: `src/components/cards/LinkedInRoastCard.tsx` line 155
- **Fix**: Add all captured variables: `[report, allSkills, moatSkills, deadSkills, strategicSkills, executionSkills, seniorityTier, determinismIndex, yearsExp]`

---

### Multiple files — motion.button missing type="button" (accidental form submit)
- **What's broken**: `<motion.button>` defaults to `type="submit"`. Anywhere these buttons appear inside or near a form element, pressing Enter triggers form submission. This affects: DoomClockCard (line 374), ShareableScoreCard (line 340), DeepAnalysisGateCard (line 101), InsightProgressDots (line 23), LinkedInRoastCard (lines 240, 355, 362).
- **Where**: `src/components/cards/DoomClockCard.tsx:374`, `ShareableScoreCard.tsx:340`, `DeepAnalysisGateCard.tsx:101`, `InsightProgressDots.tsx:23`, `LinkedInRoastCard.tsx:240,355,362`
- **Fix**: Add `type="button"` to every `<motion.button>` and `<button>` that is not an intentional form submit.

---

### Multiple files — interactive elements missing focus-visible states (accessibility)
- **What's broken**: Buttons in DoomClockCard, ShareableScoreCard, LinkedInRoastCard, and InsightProgressDots have `hover:` classes but no `focus:` or `focus-visible:` states. Keyboard users cannot see where focus is, which also fails WCAG 2.1 AA (Success Criterion 2.4.7).
- **Where**: DoomClockCard lines 374, 407, 414, 422; ShareableScoreCard lines 340, 380, 387, 397; InsightProgressDots line 23; InsightCards.tsx lines 250, 408, 417
- **Fix**: Add to each: `focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary`

---

### ShareableScoreCard.tsx — handleDownload allows double-submit (duplicate downloads)
- **What's broken**: The "Download" button has no disabled state during the download operation, unlike `handleCapture` which correctly disables during capture. A user who clicks Download twice triggers two html2canvas operations simultaneously, which can corrupt the output or cause a crash.
- **Where**: `src/components/cards/ShareableScoreCard.tsx` lines 280–286
- **Fix**: Add state: `const [downloading, setDownloading] = useState(false);` Guard: `if (downloading) return; setDownloading(true); try { ... } finally { setDownloading(false); }` Add `disabled={downloading}` to the button.

---

## 🟡 Medium — Fix When You Can

---

### scan-engine.ts — 3-minute timeout too short for cold-start edge functions
- **What's broken**: `MAX_TOTAL_WAIT_MS = 180_000` (3 minutes) is too short. Supabase edge functions on a free tier can take 30–60 seconds to cold-start alone. A legitimate scan that takes 3.5 minutes will timeout and show "Analysis Incomplete" even though the backend is still working.
- **Where**: `src/lib/scan-engine.ts` line 645
- **Fix**: Increase to `MAX_TOTAL_WAIT_MS = 360_000` (6 minutes). Separately, add a "still working…" message at the 2-minute mark so users don't abandon.

---

### scan-engine.ts — no token refresh before long scan; token may expire mid-scan
- **What's broken**: `createScanClient()` is created once with `auth: { persistSession: false }`. If a scan takes close to 1 hour (unlikely but possible), the access token expires and all subsequent Supabase calls silently fail with 401.
- **Where**: `src/lib/scan-engine.ts` line 416
- **Fix**: Before initiating polling, call `await supabase.auth.refreshSession()` to ensure the token is fresh and has a full lifespan for the poll window.

---

### Index.tsx — JSON.parse at line 132 has no try-catch (crashes on corrupted sessionStorage)
- **What's broken**: `JSON.parse(sessionStorage.getItem('jobFortressPendingInput'))` at line 132 will throw a SyntaxError if sessionStorage is corrupted (browser storage issues, partial writes). Lines 214 and 222 have try-catch but line 132 does not, making it inconsistent.
- **Where**: `src/pages/Index.tsx` line 132
- **Fix**: Wrap in try-catch: `try { const stored = JSON.parse(sessionStorage.getItem('jobFortressPendingInput') || 'null'); } catch { sessionStorage.removeItem('jobFortressPendingInput'); }`

---

### create-scan edge function — scan deduplication has a race condition
- **What's broken**: Two simultaneous scan requests for the same user can both pass the deduplication check before either writes to the DB, resulting in duplicate scans being created and double-charged credits.
- **Where**: `supabase/functions/create-scan/index.ts` lines 38–57
- **Fix**: Use a database-level unique constraint or advisory lock. Add a Postgres unique index on `(user_id, input_hash)` with a short TTL window, or use `INSERT ... ON CONFLICT DO NOTHING` pattern.

---

### best-fit-jobs edge function — salary range is AI-hallucinated, not from real data
- **What's broken**: The salary range field in job listings is generated by the AI model based on its training data, not scraped from actual job postings. It can be wildly inaccurate, especially for India-specific salaries.
- **Where**: `supabase/functions/best-fit-jobs/index.ts` lines 158, 218–219
- **Fix**: Either remove the salary field entirely and replace with "Check listing", or add a prominent disclaimer in the UI: "Salary is AI-estimated, not from the actual posting — verify on the job board." (The footer disclaimer added in Sprint 3 partially addresses this but the field should be clearly labelled as estimated.)

---

### Index.tsx — resume file lost when user returns from OAuth redirect
- **What's broken**: When a user uploads a resume file then gets redirected to OAuth, `resumeFileRef` is cleared on remount. The sessionStorage flag `hasResume: true` remains set, so the app thinks it has a resume but `resumeFileRef.current` is null, causing a silent scan with no resume.
- **Where**: `src/pages/Index.tsx` lines 135–138, 254
- **Fix**: On mount, when restoring pending input from sessionStorage, if `hasResume` is true but `resumeFileRef.current` is null, clear the `hasResume` flag and show a message: "Please re-upload your resume — it couldn't be restored after sign-in."

---

### DoomClockCard.tsx — async capture operation not guarded against unmount
- **What's broken**: `handleCapture` uses `html2canvas` (dynamically imported) without any abort/cleanup guard. If the user navigates away during capture, the Promise resolves and calls `setImageUrl()` / `setCapturing(false)` on an unmounted component.
- **Where**: `src/components/cards/DoomClockCard.tsx` lines 217–245
- **Fix**: Add a mounted guard: `const mountedRef = useRef(true); useEffect(() => () => { mountedRef.current = false; }, []); ...inside handleCapture: if (!mountedRef.current) return; setCapturing(false);`

---

### stability-score.ts — type cast with `as any` hides missing interface field
- **What's broken**: `(report as any).moat_score ?? 30` accesses a field that isn't in the `ScanReport` interface. This works at runtime because the JSON includes it, but TypeScript won't catch it if the field is renamed or removed.
- **Where**: `src/lib/stability-score.ts` line 50
- **Fix**: Add `moat_score?: number` to the `ScanReport` interface in `scan-engine.ts`, then replace the cast with `report.moat_score ?? 30`.

---

### best-fit-jobs edge function — internal error details leak to client
- **What's broken**: Error responses from the edge function include raw error messages from the AI provider (e.g., OpenAI error strings), which can reveal API key names, model names, rate limit quotas, and internal implementation details.
- **Where**: `supabase/functions/best-fit-jobs/index.ts` lines 260–293
- **Fix**: In the catch block, log the full error server-side but return only a sanitised message to the client: `return new Response(JSON.stringify({ error: 'Job search temporarily unavailable. Please try again.' }), { status: 500 })`.

---

### FearScoreDecay.tsx — 7px text used for potentially important content
- **What's broken**: `text-[7px]` is used for chart axis labels. At 7px this is below any readable threshold on most screens and fails WCAG minimum contrast ratio requirements at that size.
- **Where**: `src/components/cards/FearScoreDecay.tsx` lines 211, 231
- **Fix**: Raise to `text-[9px]` minimum. If these labels are for decoration only and convey no information independently, add `aria-hidden="true"` to the elements.

---

## 🟢 Low — Polish & Cleanup

---

### LinkedInRoastCard.tsx — `||` used instead of `??` on array access fallback
- **What's broken**: `moatSkills[1] || 'AI-Augmented'` will use the fallback if `moatSkills[1]` is an empty string `""`, which is a valid (if unusual) skill name. `??` is the correct operator here.
- **Where**: `src/components/cards/LinkedInRoastCard.tsx` lines 58–61, 80–81, 109–112
- **Fix**: Replace `||` with `??` for all string fallbacks on indexed array access: `moatSkills[1] ?? 'AI-Augmented'`

---

### CareerObituaryCard.tsx — array index used as React key in .map()
- **What's broken**: `survivedItems.map((item, i) => <li key={i}>...)` — using array index as key means if the array is sorted or filtered, React will incorrectly reuse DOM nodes and animations will fire on wrong elements.
- **Where**: `src/components/cards/CareerObituaryCard.tsx` line 201
- **Fix**: `key={`survived-${item.slice(0,20)}-${i}`}` — use a combination of content and index to ensure uniqueness without full content serialisation.

---

### Index.tsx — `window.location.reload()` on chunk load error is jarring
- **What's broken**: When a lazy-loaded chunk fails (e.g., stale cache after deployment), the app hard-reloads automatically. This loses all user state and can create a reload loop if the new chunk is also unavailable.
- **Where**: `src/pages/Index.tsx` line 26
- **Fix**: Replace with: show an inline toast/banner saying "App updated — please refresh to continue" with a manual refresh button. Let users decide when to reload.

---

### CoachOptInCard.tsx — silent early return when scanId is missing
- **What's broken**: `if (!scanId || activated) return;` returns undefined with no feedback. If `scanId` is missing due to a data loading race, the user clicks "Connect with Coach" and nothing happens — no error, no explanation.
- **Where**: `src/components/cards/CoachOptInCard.tsx` line 17
- **Fix**: `if (!scanId) { console.warn('CoachOptInCard: scanId missing'); setError('Unable to connect right now — please refresh.'); return; }`

---

### Index.tsx — ScanRow typed as `any` loses type safety
- **What's broken**: `const row = data as { scan_status: string; final_json_report: any } | null` uses `any` for `final_json_report`. Any shape mismatch between what the DB returns and what the frontend expects is invisible to TypeScript.
- **Where**: `src/pages/Index.tsx` line 160
- **Fix**: Define an interface: `interface ScanRow { scan_status: string; final_json_report: ScanReport | null }` and use it in the cast.

---

### LinkedInRoastCard.tsx — `(tools[0] as any).tool_name` bypasses type checking
- **What's broken**: Casting to `any` to access `.tool_name` hides the fact that `report.ai_tools_replacing` is `(string | ReplacingTool)[]`. The correct pattern is a runtime type guard.
- **Where**: `src/components/cards/LinkedInRoastCard.tsx` lines 80, 96
- **Fix**: `typeof tools[0] === 'object' && tools[0] !== null ? (tools[0] as ReplacingTool).tool_name : String(tools[0])`

---

### LinkedInRoastCard.tsx / BestFitJobsCard.tsx — WhatsApp hardcoded hex color
- **What's broken**: `bg-[#25D366]` and `hover:bg-[#20BD5A]` are not in the design token system. In a future design update or dark mode change, this will be inconsistent.
- **Where**: `src/components/cards/LinkedInRoastCard.tsx` line 357
- **Fix**: Add to `tailwind.config.ts`: `'whatsapp': '#25D366'`, then use `bg-whatsapp hover:bg-whatsapp/90` or define in CSS variables.

---

### scan-engine.ts — error reason details swallowed before reaching UI
- **What's broken**: When `triggerProcessScan` fails (rate-limited, service unavailable, etc.), the detailed error message is logged to console but the `reason` returned to `subscribeScanStatus` is a generic string. Users see "Analysis Incomplete" with no actionable guidance.
- **Where**: `src/lib/scan-engine.ts` lines 447–470
- **Fix**: Return the specific error message in the reason field: `{ status: 'failed', reason: err.message || 'unknown', ... }` and display it in the error screen inside `Index.tsx`.

---

*Generated by deep-qa-sweep on 2026-03-31 · Job Fortress v1.x · Vite + React 18 + TypeScript + Supabase*
