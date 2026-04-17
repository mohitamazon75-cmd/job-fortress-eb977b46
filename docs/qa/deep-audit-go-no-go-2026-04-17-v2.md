# Deep Audit & Go/No-Go — 2026-04-17 (v2, post-fixes)

## 🟡 VERDICT: SOFT-GO for Free Beta · 🔴 NO-GO for Paid Razorpay Launch

The previous P0/P1 fixes (timeout raises, daily caps, watchdog cadence, no-synthetic-roles) are deployed and working. Pipeline is genuinely better. **But the Razorpay amount-tampering vector is still wide open and the Profiler is timing out at 18s on 3 of the last 12 scans.** Charging real money today = chargebacks.

---

## Fresh Production Signals (last 24h)

| Metric | Value | Verdict |
|---|---|---|
| Completed scans | 5 | OK |
| `invalid_input` (Profiler failed) | 3 | ⚠️ 25% failure rate |
| `failed` | 3 | ⚠️ 25% hard-fail |
| Stuck `pending` (>10min) | 0 | ✅ Watchdog working |
| Hung `processing` (>10min) | 0 | ✅ |
| Lazy roles ("Specialist"/"General Execution") | 8 / 12 last 7d | 🔴 67% legacy pollution |
| Agent activity last hour | Active (Agent1, 2A, 2B, 2C, Diet, Quality) | ✅ Pipeline alive |
| Razorpay `orders` table | **DOES NOT EXIST** | 🔴 Amount tampering possible |

---

## ✅ What's Actually Fixed

1. **Watchdog working.** Zero stuck/hung scans in last 6h. Cadence is healthy.
2. **No synthetic roles for new failures.** Profiler now correctly emits `invalid_input` instead of "Senior General Execution Tasks Specialist". The 8 lazy roles in the 7-day window are **legacy data from before the fix** — confirmed: latest completion is `"Senior Manager – Business Development"`.
3. **Daily cap deployed.** `create-scan` enforces 3/day free, 50/day pro.
4. **Agent2A/2B raised to 24s** — succeeding more often (gemini-3-pro-preview returned 8698 tokens at 12:50).
5. **Quality Editor consistently runs** (~3s on flash-preview).

---

## 🛑 Showstoppers Still Blocking Paid Launch

### S1 — Razorpay amount tampering (CRITICAL, security)
- `ProUpgradeModal.tsx:143` passes `amount: config.amount` directly to the Razorpay SDK in the browser.
- No `orders` table. No `create-checkout` edge function. No server-side amount enforcement.
- **Exploit**: User opens devtools, modifies `amount` to `100` (₹1), pays ₹1, gets Pro for a year.
- The `razorpay-webhook` exists but only verifies signature — it does NOT verify the amount matches a server-created order.

**Fix**: `create-razorpay-order` edge function that:
1. Looks up plan price server-side (₹300 monthly / ₹1999 annual — hardcoded server-side).
2. Calls Razorpay Orders API with that amount + receipt id.
3. Inserts row into new `orders` table with `(user_id, plan_type, amount_paise, razorpay_order_id, status='created')`.
4. Returns `order_id` to client. Client passes only `order_id` to Razorpay SDK (no amount).
5. Webhook verifies `payment.captured` event amount matches the order row.

**Effort**: 1.5 hours. Mandatory.

### S2 — Profiler timeout still too tight (18s)
Logs show **3 of last ~10 scans hit `[Agent1:Profiler] Profiler failed AND no parsed title — marking scan invalid_input`** because gpt-5 + gpt-5-mini + gemini-2.5-pro all timed out at 18s.

That's a **25% scan failure rate** at the very first agent — the user just sees "Analysis Incomplete".

**Fix**: Raise Profiler `timeoutMs` from 18000 → 30000 (first model) and 25000 (fallback chain). Profiler is the cheapest agent (~8k tokens), it can afford the latency.

### S3 — `gemini-2.5-pro` is the worst offender in fallback chain
Every log line shows it timing out at 24s. Gemini-3-pro-preview succeeds in ~5–8s. **Reorder the chain**: put `gemini-3-pro-preview` first, drop `gemini-2.5-pro` to last (or remove it entirely from quality-critical agents).

---

## ⚠️ Important But Not Blocking

### H1 — Lazy-role legacy pollution in cohort data
8/12 of the last 7 days' completions still carry `"Specialist"`/`"General Execution"` titles. These are real DB rows that pollute `cohort_percentiles` and analytics.

**Fix**: One-shot SQL to mark these as `feedback_flag='legacy_lazy_role'` and exclude from cohort aggregations.

### H2 — Prompt freshness
No 2024/2023-dated strings in process-scan prompts (good — they're year-agnostic). But the **knowledge cutoff and "today's date"** are not injected into Profiler/Risk prompts. Agents may default to model training cutoff (early 2025 for Gemini-3) when reasoning about "current AI tools".

**Fix**: Inject `Today is 2026-04-17. Latest AI tools you must consider: GPT-5.2, Gemini-3.1, Claude Opus 4.5...` into the system prompt of Risk + Plan agents. 30-min job.

### H3 — `referral-track` JWT — **VERIFIED OK** in last pass.

### H4 — `og-image` is `verify_jwt = false` — correct (public OG previews).

---

## Cost & Reliability Snapshot

- Last hour: ~25k tokens across all agents on Gemini-3 — **healthy**.
- No active monitoring alerts.
- No errored scans waiting for recovery.

---

## 🎯 Recommended Action Sequence (≈3 hours total)

| # | Task | Effort | Blocking paid launch? |
|---|---|---|---|
| 1 | Build `create-razorpay-order` + `orders` table | 1.5h | 🔴 YES |
| 2 | Raise Profiler timeout 18s → 30s, reorder fallback chain | 15m | 🔴 YES |
| 3 | Inject current date + 2026 AI tool list into agent prompts | 30m | 🟡 Quality |
| 4 | Mark legacy lazy-role scans + exclude from cohorts | 15m | 🟡 Hygiene |
| 5 | Run 10 fresh end-to-end scans, confirm 9+ complete with specific roles | 30m | 🔴 YES |

After steps 1, 2, 5: **GO for paid Razorpay launch in India.**

---

## Final Recommendation

**Don't charge users today.** You're 3 hours away from a clean paid launch. The Razorpay amount-tampering risk alone is enough to delay — one screenshot of "I paid ₹1 for Pro" on Twitter kills launch credibility permanently.

Want me to execute steps 1–4 right now?
