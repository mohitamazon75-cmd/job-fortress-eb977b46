# Deep QA Sweep & Go/No-Go — 2026-04-17 (v3)

## 🟢 VERDICT: GO for Free Beta · 🟡 CONDITIONAL-GO for Paid Launch (pending consultant Razorpay work)

---

## Production Signals (last 24h)

| Metric | Value | Verdict |
|---|---|---|
| Total scans | 7 | Low traffic |
| `complete` | 2 (29%) | 🔴 Too low |
| `failed` (no profile source) | 3 (43%) | 🔴 **Root cause found & fixed** |
| `invalid_input` (Profiler couldn't parse) | 2 (29%) | 🟡 Expected for thin profiles |
| Lazy roles in 24h | 1 → quarantined | ✅ |
| Unacknowledged alerts | 0 | ✅ |
| Edge function 4xx/5xx (last 6h) | 0 logged | ✅ |
| Stuck/hung scans | 0 | ✅ Watchdog healthy |

---

## 🔴 Root Cause of Today's Failures (FIXED)

3 scans (`8b94c88b…`, `6f2be952…`, `86eb1b35…`) all `failed` with **no resume AND no LinkedIn URL**. The pipeline cannot extract a profile from nothing — `create-scan` was accepting these blindly and burning AI tokens to fail downstream.

**Fix shipped this session**: `create-scan` now returns `400 MISSING_PROFILE_SOURCE` when neither input is provided, with a clear user message.

---

## ✅ What's Working

1. **Watchdog**: 0 stuck/hung scans across the day.
2. **Lazy-role purge**: Yesterday's 8/12 legacy scans are quarantined; only 1 new one slipped (now also quarantined).
3. **Daily scan cap**: enforced at 3/free, 50/pro in `create-scan`.
4. **CTC validation**: clamped to ₹5k–₹50L/month server-side.
5. **Profiler fallback chain**: gemini-3-pro-preview prioritised; gemini-2.5-pro skipped for quality-critical agents.
6. **Cohort/Model-B 404/403 handling**: Graceful empty payloads with structured error codes (`SCAN_NOT_READY`, `AUTH_REQUIRED`).

---

## 🟡 Open Items (NOT blocking free beta)

### Razorpay (consultant scope — DO NOT TOUCH)
- `ProUpgradeModal.tsx:143` still passes `amount` from the client. Server-side `create-razorpay-order` not yet built. Per user direction, leaving for external consultant.
- **Action**: Hold paid launch until consultant ships order-creation + webhook amount verification.

### Profiler invalid_input rate (29%)
- 2/7 scans today returned `invalid_input` — the Profiler genuinely couldn't extract a role from the input.
- These are honest "we tried, can't help" responses — the user sees a clear retry prompt thanks to the recent `SCAN_NOT_READY` UX work. Acceptable for free beta.

### RLS linter warnings (3)
- All three are `USING (true)` on `service_role`-only policies (`company_benchmarks`, `email_send_state`, `email_unsubscribe_tokens`). This is the correct pattern — service role legitimately needs full access. False positives. **No action.**

---

## 🚦 Decision

**Free beta**: 🟢 **GO** — pipeline is healthy, the dominant failure mode (no-input scans) is now blocked at the door, and degraded states all surface clear UX.

**Paid launch**: 🟡 **CONDITIONAL** — wait for consultant's Razorpay order-creation + webhook amount-verification work. Everything else on our side is launch-ready.

---

## Re-test plan (24h after deploy)
1. Confirm `MISSING_PROFILE_SOURCE` 400s appear in logs (proves block is working).
2. Confirm `failed` rate drops from 43% → near-0%.
3. Re-check lazy-role count in 7-day window — should plateau at zero new ones.
