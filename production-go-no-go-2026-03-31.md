# Production Go/No-Go — Job Fortress / JobBachao — 2026-03-31

---

## 🔴 VERDICT: NO-GO

**Not safe to go live today.** There are 6 showstopper issues that will either make the app completely non-functional, allow payment bypass, or expose user data to the public. Every one of them is fixable — most in a day. Estimated time to Go: **2–3 focused days of work.**

---

## The 6 Showstoppers

These must all be resolved before go-live. Until they are, launching would mean: users can't use the app, attackers can unlock Pro for free, and scan data is publicly accessible.

---

### 🛑 S1 — No Supabase project for Job Fortress exists
The `.env.local` file doesn't exist. The codebase points to a dead-end (the "trivecta" astrology project). No tables, no functions, no auth. **The app does nothing in production right now.**

**What to do:**
1. Create a new Supabase project in `ap-south-1` (Mumbai) or `ap-southeast-1` (Singapore)
2. Copy the new project's URL and anon key
3. Create `.env.local` in the repo root:
   ```
   VITE_SUPABASE_URL=https://<new-ref>.supabase.co
   VITE_SUPABASE_PROJECT_ID=<new-ref>
   VITE_SUPABASE_PUBLISHABLE_KEY=<new-anon-key>
   VITE_RAZORPAY_KEY_ID=rzp_test_XXXX   ← use test key until S5 is done
   ```
4. Run all 30 migrations: `supabase db push --project-ref <new-ref>`
5. Deploy all 67 edge functions: `supabase functions deploy --project-ref <new-ref>`

---

### 🛑 S2 — All 67 edge functions are publicly callable without authentication
`supabase/config.toml` has `verify_jwt = false` for all functions. Any person on the internet can call `process-scan`, `resume-weaponizer`, `cheat-sheet`, and all other AI functions without logging in. Each of those calls costs real money.

**What to do:**
- In `supabase/config.toml`, change the default to `verify_jwt = true`
- OR add `[functions.functionname] verify_jwt = true` for each user-facing function (but the global default is safer)
- Keep `verify_jwt = false` only for: `razorpay-webhook` (Razorpay can't send a JWT), `og-image` (public share previews), and any health-check functions
- Redeploy all functions after config change

**File:** `supabase/config.toml`

---

### 🛑 S3 — referral-track has zero auth — anyone can grant Pro access to any user for free
`supabase/functions/referral-track/index.ts` — action=convert grants Pro access with zero authentication. No JWT check. A user who finds this endpoint (it's not secret) can send `action=convert&userId=<target>` and get free Pro. This is a direct revenue bypass.

**What to do:**
- Add `validateJwtClaims()` at the top of `referral-track/index.ts` (same pattern as other functions)
- Verify that the JWT user_id matches the `userId` in the request body before converting
- File: `supabase/functions/referral-track/index.ts`

---

### 🛑 S4 — og-image exposes any user's scan data without authentication
`supabase/functions/og-image/index.ts` — takes `?scanId=` as a query param and returns the scan report (role, score, industry) with no JWT check. Anyone who can guess or enumerate a scan ID can read another user's career report. Scan IDs are UUIDs but are often shared in links, so they're not truly secret.

**What to do:**
- Either add JWT validation + verify `scans.user_id = auth.uid()` before returning data
- OR only return non-sensitive fields (score, industry tier — no personal role/company data) for public share previews
- File: `supabase/functions/og-image/index.ts`

---

### 🛑 S5 — Razorpay: no orders table, no server-side order creation — payment bypass possible
The frontend opens Razorpay checkout with an amount directly, with no server-created order. This means a technically savvy user can intercept the Razorpay SDK call, change the amount to ₹1, complete payment, and call `activate-subscription` with a real `payment_id` — for a payment of ₹1 instead of ₹1,999. The backend only checks that the payment was captured, not that it was for the right amount before the database validates. Amount validation exists but is fragile without a server-created order to anchor it.

**What to do:**
1. Create a `create-checkout` edge function that: creates a Razorpay order server-side (`POST https://api.razorpay.com/v1/orders`), stores `{razorpay_order_id, user_id, amount_paise, plan_type, status: 'pending'}` in a new `orders` table, returns the `order_id` to the frontend
2. The frontend passes `order_id` to the Razorpay SDK (not amount)
3. In `activate-subscription`, look up `order_id` in the `orders` table and verify `amount_paise === TIER_PRICES[tier]` before activating
4. Add a migration to create the `orders` table

This is ~3 hours of work but closes the most exploitable payment gap.

---

### 🛑 S6 — 22 secrets not set — every edge function will crash on first call
Every edge function reads its API keys from `Deno.env.get('KEY_NAME')`. None of these are set in the new project. Without them, AI functions crash with "API key not set", payment functions fail, and monitoring doesn't work.

**Complete list of secrets to set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:**

| Secret Name | Where to get it |
|---|---|
| `LOVABLE_API_KEY` | Your AI provider dashboard |
| `PERPLEXITY_API_KEY` | perplexity.ai → Settings → API |
| `GROQ_API_KEY` | console.groq.com |
| `GEMINI_API_KEY` | Google AI Studio |
| `FIRECRAWL_API_KEY` | firecrawl.dev |
| `TAVILY_API_KEY` | app.tavily.com |
| `ONET_USERNAME` + `ONET_PASSWORD` | O*NET Web Services |
| `ADZUNA_API_ID` + `ADZUNA_API_KEY` | developer.adzuna.com |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks → create webhook |
| `ML_BASE_URL` | Your ML server endpoint |
| `ALERT_WEBHOOK_URL` | Slack/PagerDuty webhook URL |
| `ADMIN_PASSWORD` | Choose a strong password |
| `PIPELINE_TEST_EMAIL` + `PIPELINE_TEST_PASS` | Test account credentials |

**Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected by Supabase — you don't need to set those manually.

---

## Must Do Before Launch (High — but not showstoppers)

These won't prevent the app from working but will cause problems in production if not addressed.

**H1 — Add RLS to learning_resources table**
The `learning_resources` table has no Row Level Security at all. Any user can insert, update, or delete rows. Add `ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY` + a read-only policy: `CREATE POLICY "anyone_read" ON learning_resources FOR SELECT USING (true)` and a write policy restricted to service role.

**H2 — Remove hardcoded Supabase credentials from vite.config.ts**
`vite.config.ts` contains a hardcoded Supabase anon key as a fallback. If `.env.local` variables are missing during a CI build, this key leaks into the production bundle in plain text. Remove the fallback and let the build fail loudly if env vars are not set — that's the safer behaviour.
- **File:** `vite.config.ts` lines ~7-8

**H3 — Register production domain everywhere before flipping DNS**
Before pointing your domain to the app, do all of these:
1. Supabase Dashboard → Auth → URL Configuration: set Site URL to `https://jobbachao.com` (or `ai-prophet.in`), add both `https://jobbachao.com/**` and `https://www.jobbachao.com/**` to Additional Redirect URLs
2. Google OAuth Console: add `https://jobbachao.com` to Authorized redirect URIs
3. Razorpay Dashboard: add the production domain to allowed origins

**H4 — Set `verify_jwt = true` in supabase/config.toml (tied to S2 above)**
Also specifically set `verify_jwt = false` ONLY for these exceptions:
```toml
[functions.razorpay-webhook]
verify_jwt = false

[functions.og-image]
verify_jwt = false

[functions.validate-shared-token]
verify_jwt = false
```

**H5 — Razorpay webhook: handle payment.failed and payment.refunded**
Currently the webhook only processes `payment.captured`. Add handlers for:
- `payment.failed` → log to `payments` table with status='failed', send user notification
- `payment.refunded` → set profile `subscription_tier = 'free'`, log to payments

**H6 — Razorpay webhook: return 500 if DB update fails (so Razorpay retries)**
Currently returns 200 even if the database write fails. Razorpay uses the 200 to stop retrying. If the DB write fails silently, the user pays but gets nothing. Change: return `500` on DB errors so Razorpay retries.

---

## Razorpay Go-Live Checklist (Specific Steps)

When the 6 showstoppers above are fixed, here's the exact sequence to go live with payments:

- [ ] Test entire payment flow with `rzp_test_XXXX` key (test mode). Make at least 3 test payments — ₹199 per-scan, ₹1,999 Pro annual, and a failed payment.
- [ ] Verify subscription activates correctly in DB after payment
- [ ] Register webhook in Razorpay Dashboard:
  - URL: `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
  - Events: `payment.captured`, `payment.failed`, `payment.refunded`
  - Copy the webhook secret → set as `RAZORPAY_WEBHOOK_SECRET` in Supabase secrets
- [ ] Switch to live keys: change `VITE_RAZORPAY_KEY_ID` to `rzp_live_XXXX` and `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in Supabase secrets
- [ ] Make one real ₹1 test transaction to confirm live flow works
- [ ] Set up Razorpay alerts for failed webhook deliveries

---

## Post-Launch (Fix Within 2 Weeks)

These won't block launch but should be addressed quickly once you're live.

**M1 — Per-user rate limiting on expensive AI functions**
Global daily budget exists but no per-user limit. One power user can exhaust the budget. Add a per-user limit of 10 AI calls/day for free tier, 50/day for Pro.

**M2 — create-scan anonymous rate limiting**
Anonymous users can create unlimited scans. Add IP-based rate limiting (1 scan per IP per 10 minutes).

**M3 — process-scan file size check before resume download**
Resume downloads have no size limit. Add a 15MB check before downloading from storage.

**M4 — Add per-request tracing ID across functions**
Multi-hop debugging (create-scan → process-scan) is impossible without a request ID. Add `x-request-id` header propagation.

**M5 — Audit all 20 SECURITY DEFINER functions**
The 20 SECURITY_DEFINER Postgres functions need individual review to confirm they validate their inputs and can't be called with crafted parameters to bypass RLS.

**M6 — Non-atomic payment writes in activate-subscription**
The `payments` upsert and `profiles` update happen in two separate statements. Add them to a Postgres transaction or use an RPC function so both succeed or both fail together.

---

## Summary Scorecard

| Area | Status | Blocks Launch? |
|---|---|---|
| Supabase project setup | ❌ Not done | YES |
| Edge functions deployed | ❌ Not done | YES |
| JWT auth on functions | ❌ Missing | YES |
| Secrets configured | ❌ Not done | YES |
| Razorpay orders table | ❌ Missing | YES |
| referral-track auth | ❌ Missing | YES |
| og-image auth | ❌ Missing | YES |
| RLS coverage | ⚠️ 57/58 tables (learning_resources gap) | Not a blocker |
| CORS configuration | ✅ Correct for all domains | No |
| Auth flow (sign-up/in/OAuth) | ✅ Solid | No |
| QA code fixes (36 issues) | ✅ Applied | No |
| UI/UX sprint (36 changes) | ✅ Applied | No |
| Card architecture | ✅ Solid | No |

---

## Estimated Time to Go-Live

| Work Item | Time |
|---|---|
| Create Supabase project + run migrations | 30 min |
| Set all 22 secrets in dashboard | 45 min |
| Deploy 67 edge functions | 20 min |
| Create .env.local + test locally | 30 min |
| Fix verify_jwt in config.toml | 15 min |
| Fix referral-track auth | 1 hour |
| Fix og-image auth | 1 hour |
| Create create-checkout + orders table | 3 hours |
| Add RLS to learning_resources | 30 min |
| Remove hardcoded anon key from vite.config | 15 min |
| Register domains in Supabase/Google/Razorpay | 30 min |
| End-to-end test with Razorpay test mode | 2 hours |
| **Total** | **~10 hours** |

With focused work, **you can be live in 2 days.**

---

*Audit conducted 2026-03-31 · Job Fortress v1.x · Vite + React 18 + TypeScript + Supabase + Razorpay*
