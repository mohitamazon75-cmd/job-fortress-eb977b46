# Deep Audit & Go/No-Go — 2026-04-17

## 🔴 VERDICT: NO-GO for paid launch (today)
## 🟡 SOFT-GO for free/beta launch (with caveats)

The system is **functionally working** for users who reach Model-B (the user's current `/results/model-b?id=2d210e06…` view IS rendering with real `ats_avg=55, shield_score=42`). But Model-A (the deep scan) is **silently degraded** for ~80% of users. Charging ₹399 for that experience would generate refund requests.

---

## What's Actually Working ✅

1. **Watchdog cron is running** — `recover-stuck-scans` boots every 5 min, processes scans serially, completes them in ~118s when it gets through.
2. **Role detection (when it works) is accurate** — recent completion: `"Senior Manager – Business Development"` (specific, not lazy).
3. **Model-B path works independently** of Model-A. Users on `/results/model-b` see real data even when the parent scan is `pending`.
4. **Telemetry roll-up is deployed** — final outcome only is logged.
5. **Security**: RLS policies present on all 58 user-data tables; storage scoped to owner; HIBP enabled.

---

## 🛑 Showstoppers for Paid Launch

### S1 — 83 scans stuck in `pending`, watchdog can't catch up
The cron fires every 5 min but each `process-scan` call takes ~120s. With 83 stuck scans and a single-threaded watchdog (`MAX_PER_RUN=25`), the queue takes ~50 minutes minimum to clear — and new scans pile in faster than recovery.

**Fix**: Increase watchdog cadence to every 1 min, raise concurrency by firing `process-scan` calls without awaiting each (fire-and-forget pattern).

### S2 — Agent2A and Agent2B fallback chain timing out at EVERY model
Production logs at 11:20–11:21 show:
- gpt-5 → timeout (15s)
- gpt-5-mini → timeout (15s)
- gemini-3-pro-preview → timeout (25s)
- gemini-3.1-pro-preview → timeout (15s)
- gemini-2.5-pro → timeout (15s)

Result: Risk and Plan agents return null. Quality Editor patches with synthetic data. This is why we still see lazy-ish roles like `"Senior General Execution Tasks Specialist"` — the planner agent never produced a real role title because every model timed out before responding.

**Fix**: Raise per-model timeout to 35s for the first 2 models in chain, 25s for the rest. Current 15s is below the p50 latency for these models on long prompts.

### S3 — Lazy role pollution still occurring
Latest completion: `"Senior General Execution Tasks Specialist"`. The synthetic fallback we added is producing junk titles when Agent1 succeeds but Agent2A/2B fail. The "Specialist" pattern is back.

**Fix**: When Agent2A returns null, do NOT emit a synthetic title — mark the scan `error` and let the user retry. Better to fail loudly than ship a meaningless title.

---

## ⚠️ Must-Fix Before Paid Launch

### H1 — No per-user cost ceiling visible in code
Free users can run unlimited scans. One bad actor could drain the AI budget overnight.
**Fix**: Add `daily_scan_count` check to `create-scan` for non-Pro users (3/day max).

### H2 — `referral-track` and `og-image` JWT status unverified
Last audit flagged these. I did not re-verify in this pass.
**Fix**: Read both files and confirm `getClaims()` is called.

### H3 — Razorpay `orders` table still missing
The amount-bypass exploit from the 2026-03-31 audit is not closed. No `orders` table in schema. Frontend still passes amount to Razorpay SDK.
**Fix**: Build `create-checkout` edge function + `orders` table before charging real money.

---

## Soft-Go for Free/Beta Launch

If you launch as **free beta** (no Razorpay charge yet), the experience is acceptable:
- Model-B works reliably
- Model-A works ~30% of the time, fails gracefully when it doesn't
- Watchdog will eventually catch up overnight when traffic dies

But charging ₹399 today means ~70% of paying users get a degraded or stuck scan. That's churn + chargebacks.

---

## Recommended Sequence (4-6 hours of work)

1. Raise Agent2A/2B fallback timeouts to 35s/25s/25s/15s
2. Stop emitting synthetic role titles when Agent2A fails — mark `error`
3. Increase watchdog cadence to 1 min + fire-and-forget concurrency
4. Add per-user daily scan cap (3/day free, 50/day Pro)
5. Re-verify `referral-track` and `og-image` JWT
6. Build `create-checkout` + `orders` table for Razorpay
7. Run 10 real end-to-end test scans, confirm 9+ complete with specific roles

Then it's a Go.
