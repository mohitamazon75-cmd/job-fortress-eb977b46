# SPRINT C1 · Task 2 — `fetch-cohort-market-data` Edge Function — Plan

> **Status:** READ-ONLY investigation, 2026-04-19. No code created, no API calls made, no existing files modified.
> **Spec reference:** `docs/claude-code/SPRINT_C1_CAREER_REALITY_CHECK.md` §3 (data sources) + §8 Task 2.
> **Schema reference:** `supabase/migrations/20260419164059_career_reality_check_schema.sql` (already committed on this branch, not yet applied to DB).

---

## §1 — Current Firecrawl integration landscape

### What exists

Firecrawl is used inline in **5 edge functions**. There is **no** shared wrapper in `_shared/` today.

| Function | Endpoint used | Payload shape | Timeout | Key env |
|---|---|---|---|---|
| `parse-linkedin/index.ts` | `v1/scrape` + `v1/search` fallback | `{ url, formats: ["markdown"] }` / `{ query, limit, lang }` | 15s `AbortController` | `FIRECRAWL_API_KEY` |
| `market-signals/index.ts` | `v1/search` | `{ query, limit, lang, country, tbs: "qdr:m" }` | inline (no explicit timeout) | `FIRECRAWL_API_KEY` |
| `live-news/index.ts` | `v1/search` | same as market-signals | inline | same |
| `live-market/index.ts` | `v1/search` | same | inline | same |
| `company-news/index.ts` | `v1/search` | same | inline | same |

Common patterns across all 5:
- Auth header: `Authorization: Bearer ${FIRECRAWL_API_KEY}`
- Error handling: on non-ok → `return null` / `return []`; Firecrawl is always an optional enrichment source
- No retry loop on Firecrawl (Tavily uses `fetchWithBackoff` in `_shared/ai-agent-caller.ts`; Firecrawl does not)
- No caller caches the Firecrawl response itself; upstream response caching lives at the function boundary in `enrichment_cache` (see `best-fit-jobs`, `india-jobs`)

### What to reuse (no modification)
- `_shared/cors.ts` — `getCorsHeaders`, `handleCorsPreFlight`
- `_shared/supabase-client.ts` — `createAdminClient`
- `_shared/abuse-guard.ts` — `guardRequest`, `validateJwtClaims`
- `_shared/spending-guard.ts` — `checkDailySpending`, `buildSpendingBlockedResponse` (**one-line add required** — see §11 Q6)
- `_shared/ai-agent-caller.ts` — `callAgent`, `FLASH_MODEL` (for markdown→JSON normalization)
- `_shared/edge-logger.ts` + `_shared/token-tracker.ts` — already wired inside `callAgent`

### What's new territory
- Direct `v1/scrape` against `naukri.com` and `ambitionbox.com` search/listing pages — neither URL pattern exists in the repo today. Existing Naukri usage (`india-jobs/index.ts`) targets Naukri only via Tavily `includeDomains: ["naukri.com"]`; no direct Naukri scrape.
- Persistent TTL cache at a per-source grain — new table `public.cohort_market_cache` (committed in migration but not applied). Distinct from the generic `enrichment_cache` table so we can trim/invalidate per source without collateral.

### Existing cost/rate-limiting patterns
- No Firecrawl-specific rate limiter.
- `spending-guard.ts` tracks per-function dollar cost via `daily_usage_stats` table; `FUNCTION_COST_WEIGHTS` is the source of truth. Default floor is `$0.02/call`. Daily budget: `$2500`. Fail-closed on DB error. 30s in-memory cache on the spend check.
- Per-user cap: `USER_DAILY_LIMIT = 25` calls/day (enforced in `checkDailySpending`).

---

## §2 — Proposed file structure for `fetch-cohort-market-data`

```
supabase/functions/fetch-cohort-market-data/
├── index.ts                        # Deno.serve entry; CORS, JWT, spend guard, orchestration
├── firecrawl-naukri.ts             # Naukri search + markdown scrape + parse
├── firecrawl-ambitionbox.ts        # AmbitionBox scrape + regex-first parse + LLM fallback
├── cache.ts                        # read/write public.cohort_market_cache (TTL-aware)
├── normalize.ts                    # markdown → structured JSON via callAgent (FLASH_MODEL)
├── types.ts                        # NaukriPosting, AmbitionboxSalary, CohortMarketPayload
└── fetch-cohort-market-data.test.ts
```

**Decision — no new `_shared/firecrawl-client.ts`:**
Refactoring the 5 existing inline callers is out of scope (CLAUDE.md Rule 2 + Rule 8). The Firecrawl fetch logic lives inside `firecrawl-naukri.ts` and `firecrawl-ambitionbox.ts` only. If a pattern emerges (likely, 3rd caller), promote later in a dedicated refactor PR.

**Decision — keep `cohort_market_cache` separate from `enrichment_cache`:**
Separate table gives per-source columns (`source`, `expires_at`) and avoids stepping on the existing generic cache used by `best-fit-jobs`/`india-jobs`. Already committed in migration; no change.

---

## §3 — Input/output contract

### Request (POST JSON)
```json
{
  "role": "fullstack developer",
  "city": "Bengaluru",
  "exp_band": "2-6",
  "force_refresh": false
}
```

Validation (Zod at boundary per project convention):
- `role`: non-empty string, length 2..80
- `city`: non-empty string, length 2..50
- `exp_band`: enum `"0-1" | "2-3" | "2-6" | "4-6" | "7-10" | "10+"` (spec uses `2-6` for the C1 target demographic)
- `force_refresh`: optional boolean, default `false`

### Response — success shape (HTTP 200)
```json
{
  "naukri": {
    "source": "naukri",
    "postings_analyzed": 142,
    "top_skills": [
      { "skill": "React", "count": 102, "pct": 72 },
      { "skill": "Node.js", "count": 88, "pct": 62 }
    ],
    "salary_lpa": { "median": 18, "p25": 12, "p75": 26, "p90": 38 },
    "top_companies": ["Flipkart", "Swiggy", "Razorpay"],
    "posting_recency_days_median": 14,
    "fetched_at": "2026-04-19T12:00:00Z"
  },
  "ambitionbox": {
    "source": "ambitionbox",
    "median_monthly_inr": 150000,
    "median_annual_lpa": 18,
    "range_label": "₹12L – ₹26L/yr",
    "p25_lpa": 12, "p75_lpa": 26, "p90_lpa": 38,
    "sample_size": 340,
    "fetched_at": "2026-04-19T12:00:00Z"
  },
  "data_quality": {
    "naukri_ok": true,
    "ambitionbox_ok": true,
    "overall": "high"
  },
  "cached": false,
  "cache_keys_used": ["naukri:fullstack-developer:bengaluru:2-6"],
  "generated_at": "2026-04-19T12:00:00Z"
}
```

### Response — fallback shape (both sources failed, still HTTP 200)
```json
{
  "naukri": null,
  "ambitionbox": null,
  "data_quality": { "naukri_ok": false, "ambitionbox_ok": false, "overall": "unavailable" },
  "cached": false,
  "generated_at": "2026-04-19T12:00:00Z"
}
```

Per §7 below: orchestrator (Task 4) is responsible for the card-level fallback copy. This function never throws; it returns a shaped null payload.

### Response — error shapes
- `400` — invalid body (Zod validation fail)
- `401` — JWT missing/invalid (from `validateJwtClaims`)
- `429` — `guardRequest` abuse throttle
- `503` — spending guard blocked (reuse `buildSpendingBlockedResponse`)
- `500` — unexpected exception (last resort only)

---

## §4 — Firecrawl call sequence

Both sources run in parallel via `Promise.all([fetchNaukri(), fetchAmbitionbox()])`. A per-source failure never blocks the other.

### Naukri

**Step A — search** (cheap, broad coverage):
```http
POST https://api.firecrawl.dev/v1/search
{
  "query": "\"${role}\" jobs \"${city}\" \"${exp_band} years\" site:naukri.com",
  "limit": 20,
  "lang": "en",
  "country": "in",
  "tbs": "qdr:m"      // last month — matches spec §3.1 "last 30 days"
}
```
Returns search results with title/description/url. Each result is a job posting snippet. 15s `AbortController` timeout.

**Step B — targeted scrape — DEFERRED for v1.**

Strategy B (direct scrape of the Naukri listing page via `v1/scrape` against `https://www.naukri.com/${role-slug}-jobs-in-${city-slug}`) is DEFERRED. v1 ships with Strategy A only. If Strategy A yields insufficient data after 7 days of production use, we revisit Strategy B with operator sign-off on scraping risk (see §11 Q2).

The URL slug pattern (from `india-jobs/index.ts:104-112`'s `buildJobSearchUrls`) and the intended 20s timeout are recorded here only so the Strategy B re-evaluation has a design head-start — they are NOT implemented in v1.

Budget (v1, Strategy A only): **1 Firecrawl search call per Naukri fetch.**

### AmbitionBox

**Step A — direct scrape** (salary data is structured on page):
```http
POST https://api.firecrawl.dev/v1/scrape
{
  "url": "https://www.ambitionbox.com/salaries/${role-slug}-salary/${city-slug}",
  "formats": ["markdown"]
}
```
Slug from `toAmbitionBoxSlug()` logic already in `_shared/ambitionbox-salary.ts:30-38` — do **not** modify that file; copy the function into `firecrawl-ambitionbox.ts` or import via named export if already exported. (It's currently not exported — see §11 Q3.)

**Step B — search fallback** (if A 4xx or empty):
```http
POST https://api.firecrawl.dev/v1/search
{
  "query": "\"${role}\" salary \"${city}\" site:ambitionbox.com",
  "limit": 5,
  "lang": "en",
  "country": "in"
}
```

Budget: **1 call typical, 2 worst case.**

### Total per cold miss (v1, Strategy A only for Naukri)
**2–3 Firecrawl calls + 0–1 LLM Flash call**: Naukri search = 1, Ambitionbox scrape = 1, Ambitionbox search fallback = 0–1. See §5.

---

## §5 — Parse + normalize strategy

### Naukri — requires LLM normalization

Naukri search snippets are noisy HTML-derived text. Deterministic regex won't extract structured skills reliably.

- **Input:** concatenated snippets (title + description + url) for 20 results, truncated to ~3000 chars
- **Model:** `FLASH_MODEL` (`google/gemini-3-flash-preview`) via `callAgent()` — structured extraction, no reasoning needed
- **Temperature:** `0.1`
- **Timeout:** `20_000` ms (default 30s is excessive for this payload)
- **Response format:** JSON object (enforced by `response_format: { type: "json_object" }` in `callAgent`)

**Example input (abbreviated):**
```
[1] Full Stack Developer - Flipkart
URL: https://www.naukri.com/job-listing/fullstack-flipkart-12345
SNIPPET: 3-6 years experience. React, Node.js, TypeScript, PostgreSQL. Bengaluru. ₹18-28 LPA.

[2] Sr. Fullstack Engineer - Swiggy
URL: https://www.naukri.com/job-listing/...
SNIPPET: 4+ years. Must have React/Next.js, GraphQL, AWS. Bengaluru. ...
```

**Example output (matches `NaukriPayload` schema):**
```json
{
  "postings_analyzed": 18,
  "top_skills": [
    { "skill": "React", "count": 14, "pct": 78 },
    { "skill": "Node.js", "count": 11, "pct": 61 }
  ],
  "salary_lpa": { "median": 20, "p25": 14, "p75": 26, "p90": 34 },
  "top_companies": ["Flipkart", "Swiggy"],
  "posting_recency_days_median": 14
}
```

### AmbitionBox — regex-first, LLM fallback

Salary pages have stable patterns (`"Average salary ... ₹X Lakhs per year"`). The three regex patterns in `_shared/ambitionbox-salary.ts:44-96` already work on Tavily-sourced text; same patterns apply to Firecrawl markdown.

- Try regex on scraped markdown
- If regex yields median + range → done (zero LLM cost)
- If regex yields nothing → single `callAgent` Flash call to extract `{ median_annual_lpa, p25, p75, p90, sample_size }` from markdown
- Cap LLM fallback at 1 call

### Error surface
- `callAgent` returns `null` on any failure (built-in dedup, timeout, JSON recovery). Our code must treat `null` as "LLM step failed" and fall through to per-source null payload.

---

## §6 — Caching logic (`cohort_market_cache`)

Table schema (committed in migration, not yet applied):
```
cache_key   text UNIQUE   -- e.g. "naukri:fullstack-developer:bengaluru:2-6"
source      text          -- "naukri" | "ambitionbox" | "glassdoor_in"
payload     jsonb
expires_at  timestamptz
```

### Read path
```sql
SELECT payload, expires_at
FROM public.cohort_market_cache
WHERE cache_key = $1 AND expires_at > now()
LIMIT 1;
```
- Hit → return payload, mark `cached: true`, skip Firecrawl entirely for that source
- Miss (no row OR `expires_at <= now()`) → proceed to fetch

### Write path (on miss, only if payload non-null)
```sql
INSERT INTO public.cohort_market_cache (cache_key, source, payload, expires_at)
VALUES ($1, $2, $3, now() + $4::interval)
ON CONFLICT (cache_key)
DO UPDATE SET payload = EXCLUDED.payload,
              expires_at = EXCLUDED.expires_at,
              updated_at = now();
```

TTL per source (from spec §3):
| Source | TTL |
|---|---|
| `naukri` | 7 days |
| `ambitionbox` | 30 days |
| `glassdoor_in` (fallback) | 30 days |

### Key format
`${source}:${slugify(role)}:${slugify(city)}:${exp_band}` — lowercase, dashes for spaces.
Example: `naukri:fullstack-developer:bengaluru:2-6`

### Invariants
- **Never cache failure.** If extraction yielded a null payload (source unavailable), we do not write. Next call will retry. Prevents sticky-failure.
- **`force_refresh: true`** → skip read, always write (overwrites on conflict).
- **Conflict handling** — upsert via `ON CONFLICT (cache_key)`; `updated_at` trigger fires automatically.

---

## §7 — Failure modes + fallbacks

Concrete behavior table. In every row, HTTP status remains 200 unless noted.

| Scenario | Response behavior |
|---|---|
| Naukri Firecrawl 403 / empty / timeout | `naukri: null`, `data_quality.naukri_ok = false`. Ambitionbox continues independently. |
| Ambitionbox scrape 404 + search fallback also empty | `ambitionbox: null`, `data_quality.ambitionbox_ok = false`. Naukri continues. |
| Both sources fail | `naukri: null`, `ambitionbox: null`, `data_quality.overall = "unavailable"`. Still HTTP 200. Downstream orchestrator renders fallback copy. |
| LLM normalization returns null (Naukri) | `naukri: null`, `naukri_ok: false`. Snippets not cached. |
| LLM gateway 429 (rate limit) | `callAgent` returns null → source marked failed → no cache write. Retry on next call. |
| Database write fail (cache upsert) | Log warning, continue. Response still includes fresh payload; next call will refetch (cost acceptable, non-fatal). |
| Spending guard blocked | 503 via `buildSpendingBlockedResponse`. No Firecrawl calls made. |
| Invalid JWT | 401. No work done. |
| Abuse guard triggered | 429. No work done. |
| Invalid request body | 400 (Zod). No work done. |
| Unexpected exception in handler | 500 with `{ error: "Internal error" }`. Log full error. |

**Deliberately NOT handled here:**
- Card-level fallback copy ("Couldn't pull market data — here's what we still know…"). That's the orchestrator's / UI card's concern (Task 4 / Task 7).
- Partial salary vs missing salary distinction. Callers get `p25/p75/p90` as `null` individually if only median was extractable.

---

## §8 — Cost estimate

### Per cold-cache miss (unique cohort, first call)
| Line item | Cost |
|---|---|
| Firecrawl search (Naukri) | ~$0.002 |
| Firecrawl scrape (Naukri, if needed) | ~$0.003 |
| Firecrawl scrape (Ambitionbox) | ~$0.003 |
| Firecrawl search (Ambitionbox fallback, if needed) | ~$0.002 |
| LLM Flash (Naukri normalization) | ~$0.0002 |
| LLM Flash (Ambitionbox regex miss, if needed) | ~$0.0002 |
| **Typical cold miss** | **~$0.008** |
| **Worst-case cold miss** (both fallbacks fire) | **~$0.011** |

### Monthly projection
- **Assumption A** (current traffic): ~10 scans/day × 30 = 300 scans/mo. Assume 50 unique (role, city, exp_band) cohorts across users in the month.
- **Cache warmup**: first call per cohort is cold; subsequent calls within TTL are free
- **Hit rate after warmup**: target >80% (Naukri 7d TTL, Ambitionbox 30d TTL)
- **Monthly cost:** 50 × $0.008 (cold) + 250 × 0.2 × $0.008 (miss-through on partial expiry) ≈ **$0.80/mo**

### At 10× scale (100 scans/day)
- 3000 scans × 0.2 miss rate × $0.008 = **$4.80/mo** (Firecrawl + LLM combined)
- Still negligible; no budgetary concern unless Naukri starts blocking scrapes (§11 Q2).

### `FUNCTION_COST_WEIGHTS` entry
Recommend adding to `_shared/spending-guard.ts:9-34`:
```ts
"fetch-cohort-market-data": 0.02,   // conservative (cold + warm blended)
```
Mid-range relative to existing entries (`live-market: 0.03`, `best-fit-jobs: 0.10`, `company-news: 0.03`). See §11 Q6 — this requires touching a shared file.

---

## §9 — Test plan

Runner: Deno test, pattern established in `supabase/functions/tests/scan-cache.test.ts`. Command:
```
deno test --allow-net --allow-env supabase/functions/fetch-cohort-market-data/fetch-cohort-market-data.test.ts
```

Mocking strategy: per existing scaffold in `process-scan/process-scan.test.ts:6-9` — mock `fetch` for AI gateway + Firecrawl; mock Supabase client via module stubbing or a thin interface in `cache.ts`.

### Unit tests to write

| # | Name | Setup | Assertion |
|---|---|---|---|
| 1 | `cache hit returns payload without Firecrawl call` | Seed `cohort_market_cache` with fresh row (expires_at in future). | `fetch` never called with `firecrawl.dev`; response `cached: true`; payload matches seed. |
| 2 | `cache miss triggers both Naukri + Ambitionbox in parallel` | Empty cache table; mock both scrapes to return valid markdown. | 2+ `fetch` calls to `firecrawl.dev`; both payloads non-null; two rows upserted into `cohort_market_cache`. |
| 3 | `Naukri 403 → naukri null, Ambitionbox succeeds` | Mock Naukri fetch → `{ ok: false, status: 403 }`; Ambitionbox ok. | `response.naukri === null`; `response.ambitionbox` non-null; `data_quality.naukri_ok === false`; no Naukri cache row written. |
| 4 | `Ambitionbox empty markdown → payload null, no throw` | Mock Ambitionbox fetch → `{ ok: true, json: () => ({ data: { markdown: "" } }) }`. | `response.ambitionbox === null`; `data_quality.ambitionbox_ok === false`; handler returns 200. |
| 5 | `Both Firecrawl calls fail → overall unavailable, 200` | Both fetches throw. | `response.status === 200`; `data_quality.overall === "unavailable"`; no cache rows written. |
| 6 | `force_refresh: true skips cache read` | Seed fresh cache row; send `force_refresh: true`. | Firecrawl fetches still fire; cache row upserted; response `cached: false`. |
| 7 | `Spending guard blocked → 503, no Firecrawl` | Stub `checkDailySpending` to return `{ allowed: false }`. | `response.status === 503`; zero `fetch` calls to `firecrawl.dev`. |
| 8 | `Invalid JWT → 401, no work done` | No `Authorization` header. | `response.status === 401`; zero `fetch` calls to `firecrawl.dev`; zero DB writes. |

### Coverage gaps (documented, not blocking v1)
- LLM normalization hallucination (e.g. fabricated skills). Addressed at orchestrator level via data-quality signals, not here.
- Partial cache hit (Naukri cached, Ambitionbox missing). Already covered implicitly by running sources independently — add test #9 later if needed.

---

## §10 — Secrets + env vars

All already configured in Lovable Cloud (used by the 5 existing Firecrawl callers + LLM gateway functions). **No new secrets needed.**

| Env var | Purpose | Already set? |
|---|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl auth | ✅ yes (5 existing callers) |
| `LOVABLE_API_KEY` | LLM gateway via `callAgent` | ✅ yes |
| `SUPABASE_URL` | `createAdminClient` | ✅ yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient` | ✅ yes |

**Action for operator:** verify `FIRECRAWL_API_KEY` has sufficient credit headroom for direct scrape usage — current production usage is search-only; direct scrape on Naukri/Ambitionbox listing pages may consume more credits per call.

---

## §11 — Open questions — operator decisions (LOCKED 2026-04-19)

**Q1 — New shared Firecrawl wrapper?**
*Question:* create `_shared/firecrawl-client.ts` as part of Task 2, or leave the 5 existing inline usages alone?
**DECISION:** Leave the 5 existing inline callers alone. Wrapper logic lives inside the new function's own files only. Build `_shared/firecrawl-client.ts` later if a 3rd caller emerges (CLAUDE.md Rule 2 + Rule 8 — additive, no cleanup while we're here).

**Q2 — Naukri direct-scrape legality + robots.txt posture?**
*Question:* Naukri's ToS around automated scraping is unclear. Firecrawl handles the mechanical scrape but contract risk sits with us. Currently `india-jobs/index.ts` only uses Tavily `site:naukri.com` (search-engine-indexed), never a direct scrape.
**DECISION:** Strategy A only for v1. Strategy B (direct listing-page scrape) is DEFERRED. v1 ships search-based only. Re-evaluate after 7 days of production use; Strategy B requires explicit operator sign-off on scraping risk before it ships. See §4 Naukri section.

**Q3 — Reuse `_shared/ambitionbox-salary.ts` regex?**
*Question:* `extractAmbitionBoxSalary()` is currently an internal (non-exported) function. Copy or export?
**DECISION:** Copy the regex into `firecrawl-ambitionbox.ts`. Do NOT export from `_shared/ambitionbox-salary.ts`. ~50 lines of duplication is the right tradeoff — zero risk to the existing caller, no CLAUDE.md Rule 3 consultation needed. Refactor later if a 3rd consumer of the same regex appears.

**Q4 — `cohort_market_cache` vs `enrichment_cache`?**
**DECISION:** Settled — keep separate. Already committed in migration `20260419164059`. Per-source TTL columns and isolated invalidation justify the separate table.

**Q5 — TTL values?**
**DECISION:** Ship as spec'd — Naukri 7d, Ambitionbox 30d. Revisit after 7 days of production data alongside the Strategy B re-evaluation (Q2).

**Q6 — Touching `_shared/spending-guard.ts` to add cost weight?**
**DECISION:** Ship as a SEPARATE 1-line pre-Task-2 PR, not bundled with the edge function PR. Isolates the shared-file touch for clean review and trivial revert. Pre-Task-2 PR must merge before the Task 2 edge function PR is opened. See §12.

**Q7 — Default cost weight `0.02`?**
**DECISION:** `0.02`. Revisit after 7 days of production data. If usage outpaces the budget, raise to `0.05`; if barely registers, drop to `0.01`.

**Q8 — GitHub data fetch (spec §3.2) — in this function or separate?**
**DECISION:** Out of scope for Task 2. GitHub fetch is **Task 3**, a different edge function. `fetch-cohort-market-data` does NOT call GitHub.

---

## §12 — Monday execution sequence

### Pre-Task-2 prep PR (isolated, 1 line, ships first)

**PR A — `chore(spending-guard): add fetch-cohort-market-data cost weight`**
Single-line addition: `"fetch-cohort-market-data": 0.02,` to `FUNCTION_COST_WEIGHTS` in `_shared/spending-guard.ts`. Touches one shared file, trivial revert, ships independently of Task 2's edge function PR. Per §11 Q6 operator decision. Must merge before Task 2 PR opens, so the new function deploys against an existing weight.

### Task 2 proper (new edge function PR)

Order matters — each step can be committed independently, fail-safely:

1. **(Precondition)** Migration `20260419164059` applied to prod DB. Separate operator-triggered step.
2. **(Precondition)** Pre-Task-2 prep PR (above) merged. Cost weight present in `FUNCTION_COST_WEIGHTS`.
3. **Create `types.ts`** — `NaukriPayload`, `AmbitionboxPayload`, `CohortMarketResponse`, request Zod schema. Pure types, zero behavior.
4. **Create `cache.ts`** — `readCache(key)`, `writeCache(key, source, payload, ttlMs)`. Wraps `createAdminClient()` queries against `public.cohort_market_cache`.
5. **Create `normalize.ts`** — thin wrapper around `callAgent` with prompt template for Naukri markdown → JSON.
6. **Create `firecrawl-ambitionbox.ts`** — regex-first parser with LLM fallback. Copy regex from `_shared/ambitionbox-salary.ts` (per §11 Q3 decision).
7. **Create `firecrawl-naukri.ts`** — Strategy A only for v1: search via `v1/search` with `site:naukri.com` → normalization. No direct-scrape fallback (per §4, §11 Q2).
8. **Create `index.ts`** — `Deno.serve` entry; CORS → abuse guard → JWT validate → spend guard → Zod parse body → cache read per source → parallel Firecrawl fetches on miss → cache writes → response.
9. **Write `fetch-cohort-market-data.test.ts`** — 8 unit tests from §9.
10. **Run locally:** `deno test --allow-net --allow-env supabase/functions/fetch-cohort-market-data/*.test.ts`. Paste output in PR.
11. **Deploy to Supabase** (Lovable handles this on push to main, or via preview branch).
12. **Manual smoke test:** single curl against deployed function with `{ role: "fullstack developer", city: "Bengaluru", exp_band: "2-6" }`. Verify:
    - First call cold → ~4s latency, 2 cache rows written
    - Second call warm → <500ms, `cached: true`
    - `force_refresh: true` call → fresh data, cache updated
13. **Commit checkpoint.** Task 2 PR opens against `main`. Downstream Task 3 (GitHub fetch) + Task 4 (orchestrator) unblock after merge.

**Explicitly NOT in Task 2:**
- Wiring into the scan pipeline (`process-scan` → `fetch-cohort-market-data` invocation) — that's Task 4.
- Any frontend card component — Task 7.
- Share-image generation — Task 8.
- Feature flag enablement in prod — Task 10.

---

**End of plan. No code created. No API calls made. Awaiting operator review before Task 2 implementation begins.**
