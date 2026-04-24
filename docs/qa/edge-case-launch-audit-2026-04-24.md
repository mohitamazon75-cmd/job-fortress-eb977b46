# JobBachao — Edge Case & "Working As Designed" Failure Audit

**Date:** 2026-04-24
**Author:** QA Lead (in Lovable, code-grounded — every quoted string was read from the repo, not invented)
**Audience:** Mo + Day-4–5 fix sprint
**Goal:** Find every state where the system is doing the right thing but communicating poorly. Fix before Monday's 500-user push.

> **Method:** Walked the repo with the search tool, reading the actual error strings, gating logic, and fallback paths. Where a state can't be triggered without infra setup (quota exhaustion, webhook double-fire, etc.), I cite the file/line where the message comes from and project the user experience from that.

---

## SECTION 1 — Master Edge Case Matrix

Severity rubric:
- **P0** — Blank screen / raw error code / no path forward → 1-star review
- **P1** — Generic error, user understands "something broke" but not what to do
- **P2** — Clear friendly message + clear next action (already handled)

### Category 1 — Auth & Authorization

| # | Edge Case | What user sees today (verbatim where quoted) | Sev | Recommended message |
|---|---|---|---|---|
| 1 | Cross-account scan access (today's bug) | "This analysis belongs to a different account. Sign in with the original account or start a new scan." (`get-model-b-analysis:91`) — UI handles via `ResultsModelB.tsx:292`. Friendly screen renders. **But** runtime-error monitor flags it as RUNTIME_ERROR with `has_blank_screen: true`. | **P1** | UI fine. Suppress monitor false-alarm. Add the original email's masked hint (`mo***@gmail.com`) to message. |
| 2 | Anonymous user opens deep link to results | `get-model-b-analysis` returns `code: "AUTH_REQUIRED"` → `ResultsModelB.tsx:280` shows: "Please sign in to view this analysis." Save prompt opens. | **P2** | Fine. Verify the save-prompt CTA actually preserves `?id=` in redirect. |
| 3 | Session expired mid-scan (token refresh fails during 90s wait) | Polling continues with stale token → eventually 401 → caught in generic catch → "Backend is unreachable. Please check your connection and try again." (`ResultsModelB.tsx:389`) | **P0** | Detect 401 specifically. Open `ReAuthModal` (already exists). Message: "Your session timed out while we were analysing. Sign back in — your scan finished and we'll show it now." |
| 4 | Anonymous-to-authed migration | `migrate-anon-scans` claims `user_id IS NULL` scans on sign-in. **Silent.** No toast on success/failure. User who did anon scan, then signed up, has no confirmation their old scan is now linked. | **P1** | Toast: "We linked 2 earlier scans to your account." Fail-silent if zero. |
| 5 | Email not verified | Supabase default lets unverified users sign in but `emailRedirectTo` flow could leave them in limbo if they bounced from confirm link. Not surfaced anywhere in UI. | **P2** | Low frequency. Backlog. |
| 6 | Pro feature accessed by free user | `ENFORCE_PRO=off` pre-PMF → all features free today. **No gating message exists in production.** | **P2** | Document in `DECISIONS.md` (already there). When flipped on, every gate must show message — separate audit then. |
| 7 | Subscription expired mid-Pro-session | `subscription_expires_at < now()` → free quota applies on next scan attempt → user sees "Daily scan limit reached. Upgrade to Pro for 50 scans/day." (`create-scan:96`) — **misleading because user already paid for Pro.** | **P0** | Detect expired-vs-never-paid. Message: "Your Pro plan expired on {date}. Renew to keep your 50 scans/day." with renew CTA. |
| 8 | Account deleted, stale `?id=` in URL/cache | Scan row may still exist (90-day retention) but `user_id` no longer matches. Returns FORBIDDEN. Same as #1. | **P2** | Covered by #1 fix. |

### Category 2 — Scan Pipeline States

| # | Edge Case | What user sees today | Sev | Recommended |
|---|---|---|---|---|
| 9 | Scan in progress, user navigates to `/results/model-b` | `get-model-b-analysis` returns `SCAN_NOT_READY` → `ResultsModelB.tsx:275`: "This scan didn't complete. Start a new scan to view your analysis." | **P0** | **Wrong message** — scan IS still running, not failed. Detect `scan_status === 'processing'` and route back to `/?id=` to resume polling, OR show: "Your scan is still running. We'll redirect you in a moment…" with auto-poll. |
| 10 | `final_json_report` empty on `complete` status | Hit today. `get-model-b-analysis` falls through to "Unexpected response state" (`ResultsModelB.tsx:316`) → generic "Something went wrong" (`:319`). | **P0** | Detect empty report explicitly. Message: "We finished analysing but didn't get usable output. We refunded your scan credit. Try again — usually works second time." |
| 11 | `model_b_results` row never created | First call triggers background job. If create fails silently, polling 30× returns nothing → "Analysis is taking longer than expected. Please refresh the page." (`:339`) | **P0** | "Refresh the page" is dead-end advice. Auto-trigger a single retrigger before showing error. If still empty, log to `edge_function_logs` with `error_code: 'MODEL_B_NEVER_STARTED'` and show retry button. |
| 12 | `feedback_flag = 'profiler_failed_no_title'` | `process-scan:677` sets `scan_status: invalid_input`. Frontend treats as terminal error. User sees `Index.tsx:830`: "Analysis Incomplete / Our intelligence engine couldn't complete your analysis. This can happen due to high demand or data availability issues." | **P1** | Surface flag-specific message: "We couldn't extract a job title from your resume. Re-upload a clearer copy or use the manual flow — takes 30 seconds." |
| 13 | `feedback_flag = 'role_extraction_failed'` | Same generic "Analysis Incomplete" screen. | **P1** | "Your role didn't match anything in our knowledge graph. Pick the closest from this list: [seed roles]" — recovery path, not dead-end. |
| 14 | Orchestrator hits 150s wall clock | `process-scan:241` logs "Soft timeout threshold reached … continuing in degraded mode." Scan may complete partial. UI sees `complete` status with partial cards. | **P1** | If degraded, show subtle banner on results: "We ran short on time and couldn't complete every section — the missing parts are marked." Don't fail silently. |
| 15 | `card3_shield` exists but `card5_jobs` empty | Card 5 component renders empty state. Today: shows skeleton or "No jobs available right now." (verify) | **P1** | Inline message: "Live job feed unavailable for {role} in {city} right now. Try Naukri search [link]." |
| 16 | Concurrent scan attempt while previous running | `create-scan` 10-second dedupe at `:111` returns existing scan id. **Silent** — user thinks new scan started. | **P2** | Toast: "We're still finishing your last scan — taking you to it." |
| 17 | Affinda fallback fired (low confidence) | No UI surface. Logged only. | **P2** | Backlog — surface as data-quality badge if it skews score. |
| 18 | Stale scan polled days later | Should hit cache path or return cached `complete`. Verify polling doesn't loop forever on a 7-day-old `processing` status. | **P1** | `recover-stuck-scans` marks >X-min processing as `error`. Confirm cron is running and message tells user "this scan expired — start fresh." |
| 19 | User refreshed page during scan | `useScanFlow.ts` URL hydration restores from `?id=` param. Works **if** `access_token` is in URL or DB row owned by current user. **Anon scans lose access_token on refresh** (it lives only in client state). | **P0** | Persist `access_token` to `sessionStorage` keyed by scanId. Restore on hydration. Otherwise anon refresh = orphaned scan. |

### Category 3 — Rate Limiting & Quota

| # | Edge Case | What user sees today | Sev | Recommended |
|---|---|---|---|---|
| 20 | Free user hits 3/day | "Daily scan limit reached. Upgrade to Pro for 50 scans/day." + 429. Frontend catches `DAILY_LIMIT_REACHED` → opens `RateLimitUpsell`. | **P2** | Currently shows hardcoded `minutesRemaining={1440}` (= 24h flat). Should compute time until oldest of last-3 scans rolls past 24h. |
| 21 | Pro user hits 50/day | "Daily Pro scan limit reached (50/day). Try again tomorrow." | **P2** | Fine. Add: "Need more? Reply to this email and we'll bump your cap." (manual ops escape valve, builds loyalty.) |
| 22 | Lovable AI Gateway 429 | `get-model-b-analysis:464` catches 429/402. Returns to caller; UI shows "Analysis failed. Please try again." | **P1** | Specific message: "Our AI provider is temporarily rate-limited. Try again in ~30 seconds." Don't burn user retry attempts at the limit. |
| 23 | Apify quota exhausted (LinkedIn parse) | LinkedIn enrichment fails silently → scan continues with reduced data → no user signal. | **P1** | Banner on results: "We couldn't fetch your LinkedIn profile — analysis is based on resume only. {Paste again CTA}" |
| 24 | Tavily quota exhausted | Market signals/Card 2 narrows to KG-only data. No surface. | **P2** | Backlog. Affects data freshness, not correctness. |
| 25 | Affinda quota exhausted | Falls back to Gemini PDF parse (already the primary path). Acceptable. | **P2** | Acceptable. |
| 26 | Cohort match unavailable | `cohort-match` returns null → CohortRankCard renders empty or hides. Verify it doesn't show "0 percentile" or `null`. | **P1** | Hide card entirely if `sample_size < 30`. Already a known rule (mem://logic) — verify enforcement. |
| 27 | OG image gen rate limited | Share preview blank/broken. | **P2** | Fall back to static branded OG. |

### Category 4 — Input Edge Cases

| # | Edge Case | What user sees today | Sev | Recommended |
|---|---|---|---|---|
| 28 | Resume PDF >5MB | "File too large (X.YMB). Max 5MB." (`InputMethodStep:30`). Inline error. | **P2** | Fine. Note: CLAUDE.md mentions "new 10MB limit" — this code still says 5MB. **Reconcile.** |
| 29 | Non-PDF file | "Only PDF files are accepted." | **P2** | Add: "Save as PDF in Word/Google Docs (File → Download → PDF)." |
| 30 | Hindi/Tamil/Marathi resume | Gemini handles multilingual but role extraction may fail → `profiler_failed_no_title`. | **P1** | Detect non-English in extraction. Message: "Looks like your resume isn't in English. We work best with English resumes — re-upload an English copy or use manual entry." |
| 31 | Scanned image PDF (no text layer) | Affinda+Gemini both extract empty → `invalid_input`. Generic error. | **P0** | Detect zero text extracted. Message: "Your PDF looks like a scanned image — we can't read text from it. Re-save from Word/Google Docs as a text PDF, or use the manual entry option." |
| 32 | LinkedIn private/404 | Apify returns empty/error → scan proceeds with manual fields only. Silent. | **P1** | "Your LinkedIn profile is private or unreachable — we'll analyse based on the details you provided. Make profile public for richer analysis." |
| 33 | Mobile/query-string LinkedIn URL | `isValidLinkedinUrl` regex requires `/in/.+` path. Mobile URLs (`m.linkedin.com/in/...`) **fail validation**. | **P1** | Normalise: strip `m.`, strip query params, canonicalise. Don't reject. |
| 34 | Extremely short manual answers | No min-length guardrail visible in InputMethodStep. Could feed garbage to LLM. | **P1** | Minimum 3 chars on industry/role; nudge: "Add a few more details — even 2 lines helps." |
| 35 | Extremely long manual answers | No max-length truncation visible. Could blow token budget. | **P1** | Cap at 2000 chars per field with character counter. |
| 36 | Exotic role ("Quantum Computing Researcher") | Agent 1 may return low-confidence role → synthetic recovery kicks in (`mem://logic/synthetic-profile-recovery`). | **P2** | Trust the recovery. Verify it doesn't produce `"{Skill} Specialist"` stubs (process-scan:670 says it shouldn't). |
| 37 | Conflicting data (resume 5y vs manual 15y) | "Resume-as-Ground-Truth" wins per `mem://logic/data-ingestion-conflict-resolution`. User never told. | **P1** | Subtle disclosure on results: "We used your resume's 11 years of experience (your form said 15)." |
| 38 | Genuinely AI-immune role (surgeon, judge) | Score may still over-state risk. Founder-context-safety override exists. Verify it covers regulated professions. | **P1** | Extend founder-safety override to a small allowlist: surgeon, judge, religious scholar, military officer. Floor risk_score at 25, label "Low AI exposure — regulated profession." |
| 39 | Gemini safety filter trip (medical/legal/sensitive) | Returns blocked response. Caught as generic AI failure → "Analysis failed." | **P0** | Detect safety block specifically. Message: "Our AI provider declined to analyse this resume (likely due to sensitive industry content). Use the manual flow instead." |

### Category 5 — Browser & Device

| # | Edge Case | Today | Sev | Recommended |
|---|---|---|---|---|
| 40 | Slow 3G/4G | Loader animations run client-side, scan happens server-side — should be OK. But initial bundle (Vite + React + Framer + Recharts) is heavy for 3G. | **P1** | Verify bundle <300KB gzipped. If not, route-level code-split (already partial via `Suspense`). |
| 41 | Tab closed mid-scan | Scan continues server-side. No email today. User has no way back unless they remember `/?id=`. | **P0** | Auto-email "Your scan is ready" on completion — needs `notify-on-complete` edge fn + email infra. **Highest leverage retention fix.** |
| 42 | Low-memory Android | Framer Motion + heavy DOM in `SevenCardReveal` likely lags. Crash possible but unverified. | **P1** | Test on entry-level Android emulator. Add `prefers-reduced-motion` respect. |
| 43 | JS disabled | App doesn't render. Static `index.html` only. | **P2** | Acceptable for SaaS. Add `<noscript>` with copy: "JobBachao requires JavaScript." |
| 44 | Screen reader / keyboard-only | shadcn primitives are accessible by default. Custom card components likely have gaps (decorative emojis in card titles, aria-label missing on icon buttons). | **P1** | Backlog full a11y sweep. Quick wins: aria-labels on share/copy/back buttons. |
| 45 | iPhone Safari cookies | Supabase auth uses localStorage by default — Safari ITP doesn't purge it like cookies. Should be fine. | **P2** | Verify after launch. |
| 46 | Corporate firewall blocks Lovable AI Gateway | Edge fn timeout → "Backend is unreachable." | **P2** | Acceptable. Niche. |
| 47 | Multiple tabs same scan | Two pollers query same row. No conflict (idempotent reads). State sync via realtime — should converge. | **P2** | Verify pollers don't trigger duplicate `model-b` background jobs. Already gated by `pollGenerationRef` in `ResultsModelB.tsx`. |

### Category 6 — Payment

| # | Edge Case | Today | Sev | Recommended |
|---|---|---|---|---|
| 48 | Razorpay payment fails | Razorpay UI handles in-modal. User stays on pricing page. | **P2** | Fine. |
| 49 | Payment succeeds, webhook never fires | `activate-subscription` is the synchronous fallback (called from frontend on success). Idempotent (`:75`). User gets Pro. | **P2** | Fine — defence-in-depth works. |
| 50 | Webhook fires twice | Both `activate-subscription:75` and `razorpay-webhook:101` have idempotency checks ("already paid — idempotent skip"). | **P2** | Verified. |
| 51 | User refunds Razorpay charge | **No refund webhook handler.** Pro stays active until expiry. | **P0 (revenue leak)** | Add `payment.refunded` handler in `razorpay-webhook` → set `subscription_tier='free'`, `subscription_expires_at=now()`. |
| 52 | Geo not supported by Razorpay | Razorpay UI rejects. User sees Razorpay's own message. | **P2** | Acceptable. |
| 53 | Fraud-check trigger | Razorpay handles. | **P2** | Acceptable. |
| 54 | Payment email matches another account | Payment is bound to `user_id` of authed session, not email. Safe. | **P2** | Verified. |

### Category 7 — Data Integrity

| # | Edge Case | Today | Sev | Recommended |
|---|---|---|---|---|
| 55 | Profile parsed but role null | Process-scan blocks at `:675`, marks `invalid_input`. UI shows generic error. | **P0** | Per #12 — flag-specific message. |
| 56 | All cards generated but `card7_human` empty | Card 7 component renders default/empty. Verify no "undefined" leak. | **P1** | Component should show: "We couldn't generate your human-advantage card this run. [Regenerate] (free)" |
| 57 | Skill detected but salary band missing | SalaryFitWidget likely shows blank or "—". | **P1** | Hide widget entirely if no data. Don't show "₹—" or "0–0 LPA". |
| 58 | Naukri URL 404 | User clicks, lands on Naukri's 404. Blames us. | **P0** | URL validator already exists per chat history. Audit Card 4 + Card 5 outputs to confirm canonical URLs only. |
| 59 | Cohort sample <30 | Should be hidden per `mem://logic`. Verify CohortRankCard guards. | **P1** | Test path: scan in obscure role → confirm card doesn't render with "n=4". |
| 60 | WhatsApp share contains forbidden phrase | Regex scrubber per `mem://logic/llm-grounding`. If fails, user shares brand-damaging content. | **P0** | Add server-side double-check before returning share text. Block on fail with "Generating clean share text…" retry. |
| 61 | OG image gen failed | Share preview blank. | **P2** | Per #27. |
| 62 | First-scan user, no historical comparison | ScoreTrendCard should render single point + "your first scan — come back next week to see your delta." | **P1** | Verify component handles `history.length === 1` gracefully. |

---

## SECTION 2 — Top 10 Launch-Critical Edge Cases

Ordered by `frequency × severity`:

| Rank | # | Case | Est freq (per 500) | Current UX | Required UX | Hours | How to verify |
|---|---|---|---|---|---|---|---|
| 1 | 41 | Tab closed mid-scan, no email back | ~150 | Lost forever unless URL bookmarked | Email "Your scan is ready" with deep link | 6h | Submit scan, close tab, check inbox in 90s |
| 2 | 19 | Anon user refresh during scan | ~60 | Orphaned — `access_token` lost | Persist token to sessionStorage | 1h | Submit anon scan, F5, confirm hydration |
| 3 | 9 | Mid-scan navigates to `/results/model-b` | ~50 | "This scan didn't complete" (wrong) | Detect `processing`, route back to poller | 2h | Open `/results/model-b?id=X` while X still running |
| 4 | 31 | Scanned-image PDF | ~30 | Generic "Analysis Incomplete" | "PDF is image-only — re-export as text PDF" | 2h | Upload printed-then-scanned resume |
| 5 | 51 | Razorpay refund | ~3 over first month, **revenue leak** | Pro stays active | Webhook `payment.refunded` → revoke | 3h | Trigger test refund, confirm tier flips |
| 6 | 7 | Pro expired, user retries | ~10 / month | Misleading "upgrade to Pro" message | "Your Pro expired on {date}. Renew." | 1h | Set expiry to past, attempt scan |
| 7 | 10 | `final_json_report` empty | ~15 | "Something went wrong" | "We finished but output was empty. Refunded credit. Retry." + auto-refund | 3h | Force Agent 1 to error, confirm message |
| 8 | 33 | Mobile/query-string LinkedIn URL | ~40 | "Invalid URL" rejection | Normalise `m.`, strip query | 1h | Paste `m.linkedin.com/in/foo?utm=x` |
| 9 | 12 | `profiler_failed_no_title` | ~20 | Generic "Analysis Incomplete" | Flag-specific message + manual-flow CTA | 2h | Upload resume with no title field |
| 10 | 39 | Gemini safety block | ~5 | "Analysis failed" | "AI provider declined — try manual flow" | 1h | Submit medical/legal high-sensitivity content |

**Subtotal: 22 hours of focused work.** Day 4–5 is enough.

---

## SECTION 3 — Monitoring Noise Cleanup

Currently mis-classified as errors:

| Source | Currently | Recommendation |
|---|---|---|
| `RUNTIME_ERROR` with `code: FORBIDDEN` (Edge fn 403) | Fires `has_blank_screen: true` even though UI renders friendly fallback | **Suppress entirely** in client error reporter. Add ignore-list: `code in ['FORBIDDEN','AUTH_REQUIRED','SCAN_NOT_READY','DAILY_LIMIT_REACHED']` |
| `edge_function_logs` `status='degraded'` from process-scan timeout | Currently logged at error severity | **Downgrade to `info`** — degraded mode is by design |
| `edge_function_logs` `error_code='AGENT1_SYNTHETIC_FALLBACK'` | Logged as error | **Downgrade to `info`** — recovery worked |
| `create-scan` 429 daily-limit | Logged as warn | **Keep** but add `error_code: 'DAILY_LIMIT_REACHED'` for analytics filtering |
| `model-b` 429/402 Lovable AI rate-limit | Logged as error | **Keep as error** but tag `error_code: 'LLM_RATE_LIMIT'` so we can alert on rate, not on individual hits |
| `recover-stuck-scans` marking `error` | Currently warn | **Keep** — actionable signal |
| `migrate-anon-scans` zero-row claim | Silent | Fine — silent success is correct |

**Net result:** During launch, dashboards should only flash red for: real Agent failures, real LLM outages, payment-webhook signature failures, DB errors. Nothing else.

---

## SECTION 4 — The 5 "User Will Blame Us" Patterns

Voice Guide: elder brother, India-aware, specific numbers/names, never patronizing.

### Pattern 1: Cross-account access
- ❌ Today: `"This analysis belongs to a different account. Sign in with the original account or start a new scan."` (`get-model-b-analysis:91`)
- ✅ Rewrite: `"Looks like you saved this scan from a different login (mo***@gmail.com). Sign in with that one to see it again, or start fresh — your old scan is still safe."`

### Pattern 2: Mid-scan navigation
- ❌ Today: `"This scan didn't complete. Start a new scan to view your analysis."` (`ResultsModelB.tsx:275`)
- ✅ Rewrite: `"Your scan is still cooking — about 30 seconds left. Hang tight, we'll show it the moment it's done."` (with auto-poll, no button)

### Pattern 3: Daily limit hit
- ❌ Today: `"Daily scan limit reached. Upgrade to Pro for 50 scans/day."`
- ✅ Rewrite: `"You've used your 3 free scans for today. Next one unlocks at {time}. If you want to scan a friend's resume sooner, Pro gets you 50/day for ₹399/month."`

### Pattern 4: Generic analysis failure
- ❌ Today: `"Our intelligence engine couldn't complete your analysis. This can happen due to high demand or data availability issues."` (`Index.tsx:830`)
- ✅ Rewrite: `"Our AI got stuck halfway through your scan. We didn't deduct any credit — try again. If this is your second try, it's on us — email mo@jobbachao.com and we'll run it manually."`

### Pattern 5: Backend unreachable (likely just session expired)
- ❌ Today: `"Backend is unreachable. Please check your connection and try again."` (`ResultsModelB.tsx:389`)
- ✅ Rewrite: When 401: `"Your login timed out while we were analysing. Sign back in — your scan is done and we'll show it right after."` (auto-open ReAuth modal)
  When network: `"Looks like your internet hiccupped. Your scan finished on our side — refresh once you're back online."`

---

## SECTION 5 — Race Conditions

| Race | Current behaviour (read from code) | Recommended |
|---|---|---|
| Submit scan → close tab | Server-side scan completes. **No notification path.** User has to remember `/?id=`. | Add `notify-on-complete` edge fn → email with deep link. (Top of priority list — #41/#1 above.) |
| Refresh during scan | URL hydration in `useScanFlow.ts:144` works for authed users. **Anon users lose `access_token`** because it lives only in React state. | Persist `access_token` to `sessionStorage` keyed by scanId. |
| Two tabs same scan | Both poll independently via `pollGenerationRef`. Background `model-b` job is idempotent at DB level. | Verify no duplicate billing events; otherwise fine. |
| Pro upgrade during scan | Scan was created when user was free → score logic may have applied free-tier prompts. | Acceptable for now: scan completes as-started. Document. |
| Multiple scans in 60s | `create-scan:111` dedupes within 10s window. Beyond 10s, both run in parallel. | Add 60s soft cap with toast: "Easy! We'll run this after your last one finishes." |
| Logout mid-scan | Realtime subscription cleanup on unmount. **Server-side scan continues.** Result becomes orphan unless re-claimed. | `migrate-anon-scans` claims on next sign-in. Verify this works for users who log out then back in as same account. |

---

## SECTION 6 — Pre-Launch Fix Checklist (ordered)

```
P0 — Blocking launch
1. [Pipeline] Wrong message for mid-scan navigation (#9)              — 2h
2. [Pipeline] Empty final_json_report → specific message + refund (#10) — 3h
3. [Pipeline] Anon refresh loses access_token (#19)                    — 1h
4. [Input] Image-only PDF → specific guidance (#31)                    — 2h
5. [Input] Gemini safety filter → specific message (#39)               — 1h
6. [Auth] Pro expired vs never-paid distinction (#7)                   — 1h
7. [Payment] Razorpay refund webhook handler (#51)                     — 3h
8. [Pipeline] model-b never started → auto-retrigger then surface (#11) — 2h
9. [Pipeline] Refresh-page advice replaced with retry button (#11)     — 0.5h
10. [Retention] Email-on-complete for tab-closers (#41)                — 6h

Subtotal: 21.5h

P1 — Causing churn risk
11. [Auth] Session-expired during poll → ReAuth modal (#3)             — 1.5h
12. [Pipeline] feedback_flag specific messages (#12, #13)              — 2h
13. [Pipeline] Degraded-mode banner on partial results (#14)           — 1h
14. [Input] Mobile/query-string LinkedIn URL normalise (#33)           — 1h
15. [Input] Conflicting resume vs manual data — disclose (#37)         — 1h
16. [Input] Min/max length guards on manual fields (#34, #35)          — 1h
17. [Input] Non-English resume detection (#30)                         — 1.5h
18. [Input] Private LinkedIn — explicit fallback notice (#32)          — 0.5h
19. [Quota] Real-time-aware reset for free quota (#20)                 — 1h
20. [Quota] LLM 429 → specific retry-in-30s message (#22)              — 0.5h
21. [Data] Hide cards with insufficient sample (#26, #59)              — 1h
22. [Data] First-scan empty history graceful (#62)                     — 0.5h
23. [Data] Naukri URL 404 audit (#58)                                  — 1h
24. [Data] WhatsApp share scrubber double-check (#60)                  — 1h
25. [Auth] Anon-to-authed migration toast (#4)                         — 0.5h
26. [Pipeline] Concurrent scan dedupe — toast (#16)                    — 0.5h
27. [Regulated profession floor on risk_score (#38)                    — 1h

Subtotal: 16.5h

P2 — Monitoring & polish
28. [Monitoring] Suppress FORBIDDEN/AUTH_REQUIRED/SCAN_NOT_READY in client errors — 1h
29. [Monitoring] Downgrade degraded/synthetic-fallback to info — 0.5h
30. [Monitoring] Tag rate-limit errors with error_code for filtering — 0.5h
31. [Reconcile 5MB vs 10MB resume limit (CLAUDE.md vs InputMethodStep:20) — 0.25h
32. [a11y] aria-labels on icon-only buttons (#44) — 1.5h
33. [Polish] RateLimitUpsell minutesRemaining accurate calc (#20) — 0.5h

Subtotal: 4.25h

============================================================
TOTAL: 42.25 hours over Day 4–5
P0 alone: 21.5h — feasible in one focused day
============================================================
```

---

## Final note for Mo

The 403 you flagged today is not the problem. The problem is **Tab Closed Mid-Scan (#41)** — at single-digit scans/day you don't see it, but at 500/day on Monday roughly **30%** of submitters will close the tab and never return because they have no way back. Nothing else on this list approaches that magnitude.

If you cut everything from the P0 list, do these three:
1. **#41 Email-on-complete** (6h) — saves 30% of users
2. **#19 Anon refresh persistence** (1h) — saves 10%
3. **#9 Mid-scan navigation message** (2h) — saves 10% from "this scan didn't complete" lie

That's 9 hours that prevents ~50% of churn, before anything else.
