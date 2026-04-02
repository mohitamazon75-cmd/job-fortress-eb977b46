# JobBachao — Trust Repair & Intelligence Quality Hardening
**Date:** 2026-03-26
**Author:** Product + Architecture Review
**Status:** Draft v2 — Spec Review Pass 2
**Approach:** Approach 1 of 3 — Trust Repair First

---

## 1. Problem Statement

JobBachao's core intelligence carries six trust-destroying data quality issues that, if discovered by users, would permanently damage credibility in the Indian tech community.

**Hallucinated data presented as fact:**
- Salary ranges throughout the product are either hardcoded guesses (`india-jobs/index.ts` `SAFER_ROLE_MAP`) or LLM-generated estimates (`best-fit-jobs/index.ts` line 158: "otherwise estimate range for the region")
- Job posting counts are inferred by Gemini from Tavily snippets (`market-signals/index.ts` `posting_volume_30d`) — no job board data is involved
- The ±8 confidence interval shown in `VerdictReveal.tsx` is a heuristic (`CONFIDENCE_BASE_MARGIN=15 / √matchedSkillCount`) dressed up as statistical rigour

**Fragile AI pipeline:**
- 38 edge functions parse Gemini JSON responses via manual `JSON.parse()` on regex-cleaned text — the #1 class of silent failures
- Profile extraction infers missing fields rather than flagging gaps, inflating apparent data quality on sparse profiles

This spec defines six targeted fixes. No new features are introduced. Every change either hardens existing internals or makes existing outputs more honest.

---

## 2. Scope

### In Scope
- Fix 1: Structured Output Enforcement — 14 priority edge functions → `responseMimeType: "application/json"` with `responseSchema`
- Fix 2: Salary Honesty — remove hardcoded and LLM-estimated salary figures; return `null` with honest UI
- Fix 3: Data Source Transparency Extension — extend existing `DataQuality` type and `DataQualityBadge` with market signal provenance fields
- Fix 4: Job Posting Count Honesty — replace Gemini-inferred `posting_volume_30d` with verifiable Tavily result count
- Fix 5: Confidence Interval Relabelling — rename `confidence_intervals` → `score_sensitivity`, update label + add tooltip
- Fix 6: Profile Gap Flagging — AGENT_1_PROFILER returns `profile_completeness_pct` and `profile_gaps`; UI shows nudge on sparse profiles

### Out of Scope
- Paid API integrations (Naukri partner API, AmbitionBox, Payscale India) — Phase 2
- pgvector embeddings — Phase 2
- Application tracker / retention mechanics — Approach 2
- Scoring model recalibration against real outcomes — requires 6 months of outcome data
- Score history backfill — existing scan records are not altered

---

## 3. Fix 1 — Structured Output Enforcement

### Problem
38 edge functions extract JSON from Gemini using this fragile pattern:
```typescript
const raw = response.candidates[0].content.parts[0].text;
const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
const result = JSON.parse(cleaned); // throws when Gemini prepends preamble text
```
When Gemini adds "Sure! Here is the JSON:" before the content, `JSON.parse` throws and the function silently returns partial or empty data.

### Fix
Switch Gemini calls to use native structured output:
```typescript
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: { type: "object", properties: { ... }, required: [...] }
}
```
The response body is then guaranteed valid JSON — no text cleaning needed.

### Priority Rationale
- **P1 (user-facing per-scan flows, highest call volume):** `process-scan`, `generate-report`, `best-fit-jobs`, `market-signals`, `india-jobs`. These are called on every scan and their failures directly degrade the user experience.
- **P2 (premium features, called post-scan):** `resume-weaponizer`, `generate-milestones`, `role-intel`, `generate-side-hustles`, `career-genome`, `skill-arbitrage`, `compute-delta`. Called on demand after the primary scan completes; failures are isolated to specific dashboard tabs.
- **P3 (low-traffic or background):** `ai-dossier`, `cheat-sheet`. Infrequently called; risk is low.

`process-scan` is P1 and is the orchestrator — it calls `generate-report` internally. Both must be migrated together. No P2 function calls a P1 function, so phased rollout is safe.

### Error Contract

When structured output generation fails (Gemini returns non-200, schema validation fails, or network timeout), every affected edge function must return this typed error object:

```typescript
interface EdgeFunctionError {
  error: "generation_failed" | "schema_validation_failed" | "timeout";
  message: string;        // Human-readable description; empty string if not user-facing
  retryable: boolean;     // true = frontend may retry once; false = escalate or show fallback UI
  fallback: null;         // Always null; no partial data returned on error
}
```

**Which functions are caller-facing (called directly by frontend):**
- `process-scan`, `best-fit-jobs`, `market-signals`, `india-jobs`, `resume-weaponizer`, `generate-milestones`, `role-intel`, `generate-side-hustles`, `career-genome`, `skill-arbitrage`, `ai-dossier`, `cheat-sheet`

**Which functions are internal (called by other edge functions):**
- `generate-report` — called by `process-scan` only. `process-scan` is responsible for handling `generate-report` errors and propagating the `EdgeFunctionError` shape to the frontend.
- `compute-delta` — called by `process-scan` asynchronously via pgmq. Errors are logged to Supabase edge function logs; they do not surface to the user in real time.

**Frontend error handling contract:**
Every frontend caller must handle the `EdgeFunctionError` shape before rendering. If `retryable: true`, the frontend may attempt one automatic retry after 2 seconds. If retry fails or `retryable: false`, display a generic error state with a "Try again" button. Do not silently ignore error responses.

### Schema Construction Rule
Each `responseSchema` must be derived from the function's existing TypeScript return type, not written independently. The implementer must read the existing interface and translate it field-by-field. This prevents regressions where the schema and the TypeScript type diverge.

---

## 4. Fix 2 — Salary Honesty

### Problem

**`india-jobs/index.ts` — Hardcoded salary map:**
`SAFER_ROLE_MAP` (lines 38–90) contains 30+ role entries with hardcoded `avg_salary_inr` values (e.g., `"₹18-35L"` for AI/ML Engineers). These were authored once, never updated, and have no data source.

**`best-fit-jobs/index.ts` — "Estimate" instruction:**
Line 158 prompt: `"Extract salary info if available in the snippet, otherwise estimate range for the region"`. This explicitly instructs Gemini to invent salary figures.

### Dependency Check Before Implementation

Before making changes, run the following searches to audit full scope:
```bash
grep -rn "avg_salary_inr\|salary_range\|SAFER_ROLE_MAP" \
  "/path/to/src" "/path/to/supabase/functions" --include="*.ts" --include="*.tsx"
```

All references must be updated in the same PR. The expected list of consumers:
- `india-jobs/index.ts` — source of hardcoded values
- `BestFitJobsCard.tsx` — displays `salary_range` (already handles null with "Salary not listed" fallback)
- Any component that renders `avg_salary_inr` from india-jobs response

`best-fit-jobs` does not call `india-jobs` internally — they are independent edge functions. Order of implementation does not create dependency issues.

### Changes

**`india-jobs/index.ts`:**
- Change `avg_salary_inr: string` → `avg_salary_inr: null` in all `SAFER_ROLE_MAP` entries
- Update the TypeScript interface from `avg_salary_inr: string` to `avg_salary_inr: null | string`
- Add `salary_data_source: "not_available"` to each role entry

**`best-fit-jobs/index.ts`:**
- Line 158 prompt change: `"Extract salary ONLY if explicitly stated in the job listing snippet. If salary is not stated, return null for salary_range — do NOT estimate or infer."`
- responseSchema line 215: `description: "Salary range exactly as stated in the listing, or null if not listed"`
- Response schema type change: `salary_range: string | null`

**UI — components rendering `avg_salary_inr`:**
Where `avg_salary_inr` was displayed, replace with: `"Salary data not yet available"` + small info icon with tooltip: `"We're integrating real salary data. Check AmbitionBox or Glassdoor for current ranges."` + a deep link to AmbitionBox search for that role.

### Database / Historical Data
Existing scan records in the database are not backfilled. Historical salary estimates in stored scan results remain as-is. Only new scans produced after deployment will have null salary fields. This is intentional — do not alter historical records.

### What Is NOT Changed
`estimated_monthly_salary_inr` in AGENT_1_PROFILER output (the user's own salary inferred from their LinkedIn profile) is unchanged. It is used internally for score computation, not displayed as market data. The field name and schema remain as-is.

---

## 5. Fix 3 — Data Source Transparency Extension

### Current State
A partial `data_quality` infrastructure already exists:
- `DataQuality` type in `src/lib/scan-engine.ts` with `overall: 'HIGH' | 'MEDIUM' | 'LOW'` and `kg_coverage: number`
- `DataQualityBadge` component used in `DiagnosisTab`, `StrategicDossier`, and 4 insight cards
- `market-signals/index.ts` already returns `source: "tavily_gemini"` in its response body

### New Fields

Extend the `DataQuality` interface in `src/lib/scan-engine.ts`:

```typescript
interface DataQuality {
  overall: 'HIGH' | 'MEDIUM' | 'LOW';     // existing
  kg_coverage: number;                      // existing

  // NEW — all optional to avoid breaking existing code paths
  salary_source?: 'real_api' | 'not_available';
  market_signals_source?: 'real_api' | 'tavily_search';
  posting_count_source?: 'real_api' | 'search_result_count';
  data_age_hours?: number | null;          // null = unknown; missing = not provided
  profile_completeness_pct?: number;       // moved here from Fix 6
  profile_gaps?: string[];                 // moved here from Fix 6
}
```

All new fields are **optional** (`?`). This is a backwards-compatible extension — existing code that constructs `DataQuality` without the new fields continues to compile and run. Only the `DataQualityBadge` renderer needs to handle their absence.

### Which Functions Populate Which Fields

| Field | Populated by | Set to | When |
|---|---|---|---|
| `salary_source` | `india-jobs` | `"not_available"` | Always (hardcoded values removed) |
| `salary_source` | `best-fit-jobs` | `"not_available"` when salary_range is null; omit otherwise | Per job in response |
| `market_signals_source` | `market-signals` | `"tavily_search"` | Always (until real API integrated) |
| `posting_count_source` | `market-signals` | `"search_result_count"` | Always (post Fix 4) |
| `data_age_hours` | `process-scan` | `Math.floor((Date.now() - marketSignalsFetchedAt) / 3600000)` | Computed from market-signals fetch timestamp |
| `profile_completeness_pct` | `process-scan` | 0–100 integer | After AGENT_1 returns, before writing result |
| `profile_gaps` | `process-scan` | Array of field name strings | After AGENT_1 returns, before writing result |

`process-scan` is the single assembly point. It calls sub-functions, collects their individual source fields, and builds the unified `data_quality` object. No other function writes to the top-level `data_quality` object directly.

### `DataQualityBadge` Updates

Handle missing fields gracefully:
- If `salary_source` is absent: do not show salary source line
- If `salary_source === 'not_available'`: show `"Salary data: not yet available — check AmbitionBox"`
- If `market_signals_source === 'tavily_search'`: show `"Market signals: based on web search"`
- If `data_age_hours > 48`: show `"Market data: X days old"`
- If `data_age_hours` is null or absent: show nothing (do not show "Unknown")

---

## 6. Fix 4 — Job Posting Count Honesty

### Problem
`market-signals/index.ts` passes Tavily web snippets to Gemini asking it to infer `posting_volume_30d` — an integer representing estimated active postings. Gemini invents this number. The field name misleads users into thinking it's a 30-day rolling count from a job board.

### Field Rename
`posting_volume_30d` is **renamed** to `posting_volume_proxy` in the edge function response. It is not reused with a different value — the entire calculation changes:

**Old (Gemini inference):**
```typescript
posting_volume_30d: number // Gemini estimates based on news snippets
```

**New (Tavily result count):**
```typescript
posting_volume_proxy: number  // actual count of Tavily search result URLs returned
posting_volume_source: "search_result_count"  // transparency field
posting_volume_note: "Based on web search result count — not a live job board count"
```

Implementation in `market-signals/index.ts` for `signal_type === "market"`:
```typescript
const jobSearchResults = await tavilySearch({
  query: `${role} jobs ${city} site:naukri.com OR site:linkedin.com OR site:indeed.co.in`,
  max_results: 10
});
const posting_volume_proxy = jobSearchResults?.results?.length ?? 0;
```

### `posting_change_pct` Removal
`posting_change_pct` was computed in `compute-delta/index.ts` as a delta between consecutive `posting_volume_30d` values. Since `posting_volume_30d` is being replaced by a snapshot proxy count, computing a meaningful trend percentage is no longer valid.

**`compute-delta/index.ts` changes:**
- Remove `posting_change_pct` from new delta computations
- Set `posting_change_pct: null` for all new delta records
- Add `posting_change_source: "discontinued"` to new delta records

**Database migration required:**
```sql
-- Migration: 20260326000001_posting_volume_source.sql
-- Mark legacy delta records so they can be distinguished from post-fix records
UPDATE score_history
SET delta_summary = delta_summary || '{"posting_change_source": "legacy_estimate"}'::jsonb
WHERE delta_summary ? 'posting_change_pct'
  AND NOT delta_summary ? 'posting_change_source';
```

**Score calculation:** Verify `posting_change_pct` is not used as an input to the DI score in `deterministic-engine.ts`. If it is, replace with `posting_volume_proxy > 0 ? 1 : 0` (binary demand signal) or remove the input entirely. Document the decision in the PR.

**UI — `MarketPositionWidget.tsx`:**
Replace the numeric `posting_volume_30d` display with qualitative signal strength:
- `posting_volume_proxy >= 7`: `"Strong demand signal"` (green)
- `posting_volume_proxy >= 3`: `"Moderate demand signal"` (amber)
- `posting_volume_proxy < 3`: `"Limited search signal"` (red)
- Add tooltip: `"Based on web search results — not a live job board count"`

---

## 7. Fix 5 — Confidence Interval Relabelling

### Problem
`deterministic-engine.ts` lines 1397–1401 compute:
```typescript
const diMargin = Math.round(CALIBRATION.CONFIDENCE_BASE_MARGIN / Math.sqrt(matchedCount));
// CONFIDENCE_BASE_MARGIN = 15 (hardcoded)
```
This is a heuristic. "Confidence interval" implies statistical grounding it does not have. The term "sensitivity range" is also imprecise — this metric measures input ambiguity due to profile sparsity, not sensitivity analysis. The most accurate label is **"Score Variability Range"**.

### Field Rename: Complete Consumer Audit

Before implementing, run this command to identify all consumers:
```bash
grep -rn "confidence_intervals\|di_range\|confidence_interval" \
  "/path/to/src" "/path/to/supabase/functions" --include="*.ts" --include="*.tsx"
```

Expected consumers (from codebase inspection):
- `supabase/functions/_shared/deterministic-engine.ts` — produces the field
- `src/lib/scan-engine.ts` — `ConfidenceIntervals` type definition
- `src/components/VerdictReveal.tsx` — renders `confidence_intervals.di_range.high/low`
- `src/components/dashboard/ScoreBreakdownPanel.tsx` — may reference the field
- `src/components/cards/JobSafetyCard.tsx` — may reference the field

All consumers must be updated in the same PR. Any file referencing `confidence_intervals` after the PR is a regression.

### Changes

**`deterministic-engine.ts`:**
- Rename return field: `confidence_intervals` → `score_variability`
- Update the `CALIBRATION` comment: `CONFIDENCE_BASE_MARGIN: 15, // Score variability base: reflects input ambiguity, not a statistical CI`

**`src/lib/scan-engine.ts`:**
- Rename type: `ConfidenceIntervals` → `ScoreVariability`
- Update all references to this type throughout the file

**`VerdictReveal.tsx`:**
- Change display label: `"Score confidence"` → `"Score variability range"`
- Add tooltip (rendered on hover over the ± value):
  > `"Your score could shift by ±N points depending on how your profile data is interpreted. This reflects profile ambiguity — it is not a statistical confidence interval."`
- The tooltip text should be a single static string, not computed dynamically

**No change to the calculation itself.** The formula is acceptable as a heuristic; only the labelling is being corrected.

---

## 8. Fix 6 — Profile Gap Flagging

### Problem
AGENT_1_PROFILER infers missing profile fields (experience years, salary, skills) instead of returning `null`, which inflates apparent data quality for sparse profiles. Users with incomplete LinkedIn profiles receive the same score confidence display as users with complete profiles.

### AGENT_1_PROFILER Prompt Change

Add this block at the top of the `AGENT_1_PROFILER` constant in `agent-prompts.ts`:

```
DATA DISCIPLINE — READ BEFORE EXTRACTING:
You are a data extractor, not an estimator.
- Return null for ANY field not directly evidenced in the profile text.
- Do NOT infer salary from job title, seniority, or industry averages.
- Do NOT infer skills from job titles or company names.
- Do NOT estimate experience years unless explicit start/end dates exist for each role.
- Profile gaps are important signal — surface them, do not paper over them.
```

The existing instruction "For executives/VPs, CAREFULLY calculate total years from first role to present" remains valid only when explicit dates are present. Clarify this in the prompt: `"Calculate total years ONLY when explicit role start/end dates are present. If dates are absent, return null for experience_years."`

### Profile Completeness Computation

`profile_completeness_pct` is computed **server-side in `process-scan/index.ts`** after AGENT_1 returns, not by the LLM. The LLM returns `null` for missing fields; the edge function counts non-null values.

```typescript
const HIGH_VALUE_FIELDS = [
  'current_role',              // job title
  'experience_years',          // total years
  'primary_skills',            // array, non-null and non-empty
  'estimated_monthly_salary_inr', // current salary
  'industry',                  // domain/sector
  'current_company',           // employer
  'city'                       // location
] as const;

function computeProfileCompleteness(profile: AgentOneOutput): {
  profile_completeness_pct: number;
  profile_gaps: string[];
} {
  const gaps: string[] = [];
  let filled = 0;
  for (const field of HIGH_VALUE_FIELDS) {
    const val = profile[field];
    const present = val !== null && val !== undefined &&
                    !(Array.isArray(val) && val.length === 0);
    if (present) filled++;
    else gaps.push(field);
  }
  return {
    profile_completeness_pct: Math.round((filled / HIGH_VALUE_FIELDS.length) * 100),
    profile_gaps: gaps
  };
}
```

`profile_completeness_pct` and `profile_gaps` are stored in `score_history.delta_summary` and returned as part of `data_quality` in the scan result (see Fix 3 for the type extension).

### UI — Completeness Nudge

In `ScoreBreakdownPanel.tsx`, render the following when `data_quality.profile_completeness_pct < 70`:

```
⚠ Score based on [X]% complete profile.
Missing: [human-readable gap labels separated by commas]
Update your LinkedIn profile to improve accuracy.
```

Field name → human-readable label mapping (used in the nudge and in `DataQualityBadge`):
```typescript
const GAP_LABELS: Record<string, string> = {
  current_role:                    'job title',
  experience_years:                'years of experience',
  primary_skills:                  'specific skills',
  estimated_monthly_salary_inr:    'current salary',
  industry:                        'industry / sector',
  current_company:                 'current employer',
  city:                            'location',
};
```
Example rendered nudge when `industry`, `current_company`, and `city` are missing:
> ⚠ Score based on 57% complete profile. Missing: industry / sector, current employer, location. Update your LinkedIn profile to improve accuracy.

**Threshold:** 70% is a hard-coded constant, defined as `const COMPLETENESS_NUDGE_THRESHOLD = 70` in the component file. Rationale: 70% represents at least 5 of 7 high-value fields populated, which is sufficient for a meaningful scan. Below this, the score reliability is materially reduced.

**Dismiss behaviour:** The nudge is not dismissible. It shows on every scan result until the profile is more complete. A dismiss button would create false reassurance.

---

## 9. Files Changed Summary

### Edge Functions

| File | Fixes Applied | Changes |
|---|---|---|
| `_shared/agent-prompts.ts` | Fix 6 | AGENT_1_PROFILER discipline instruction |
| `_shared/deterministic-engine.ts` | Fix 5 | Rename confidence_intervals → score_variability; update CALIBRATION comment |
| `process-scan/index.ts` | Fix 1, Fix 6 | Structured output; compute + store profile_completeness_pct |
| `generate-report/index.ts` | Fix 1 | Structured output |
| `best-fit-jobs/index.ts` | Fix 1, Fix 2 | Structured output; salary honesty prompt + schema |
| `market-signals/index.ts` | Fix 1, Fix 3, Fix 4 | Structured output; add source fields; posting_volume_proxy |
| `india-jobs/index.ts` | Fix 2 | Remove hardcoded avg_salary_inr from SAFER_ROLE_MAP |
| `resume-weaponizer/index.ts` | Fix 1 | Structured output |
| `generate-milestones/index.ts` | Fix 1 | Structured output |
| `role-intel/index.ts` | Fix 1 | Structured output |
| `generate-side-hustles/index.ts` | Fix 1 | Structured output |
| `career-genome/index.ts` | Fix 1 | Structured output |
| `compute-delta/index.ts` | Fix 4 | Remove posting_change_pct; add posting_change_source: "discontinued" |
| `skill-arbitrage/index.ts` | Fix 1 | Structured output |
| `ai-dossier/index.ts` | Fix 1 | Structured output |
| `cheat-sheet/index.ts` | Fix 1 | Structured output |

### Frontend

| File | Fixes Applied | Changes |
|---|---|---|
| `src/lib/scan-engine.ts` | Fix 3, Fix 5 | Extend DataQuality type (all new fields optional); rename ConfidenceIntervals → ScoreVariability |
| `src/components/dashboard/DataQualityBadge.tsx` | Fix 3 | Render salary_source, market_signals_source, data_age_hours signals |
| `src/components/VerdictReveal.tsx` | Fix 5 | Rename field reference; change label; add tooltip |
| `src/components/dashboard/ScoreBreakdownPanel.tsx` | Fix 5, Fix 6 | Update confidence_intervals → score_variability references; add completeness nudge |
| `src/components/cards/BestFitJobsCard.tsx` | Fix 2 | Verify null salary renders "Salary not listed" (already implemented; confirm only) |
| `src/components/dashboard/MarketPositionWidget.tsx` | Fix 4 | Replace numeric posting_volume_30d with qualitative signal strength labels |
| `src/components/cards/JobSafetyCard.tsx` | Fix 5 | Update confidence_intervals → score_variability field reference if present |

### Database Migrations

| Migration file | Purpose |
|---|---|
| `supabase/migrations/20260326000001_posting_volume_source.sql` | Backfill existing delta_summary records with `posting_change_source: "legacy_estimate"` |

---

## 10. Testing Requirements

### Structured Output Tests (Fix 1)
For each of the 14 P1+P2 edge functions:

1. **Schema completeness test:** Verify the `responseSchema` contains all fields defined in the TypeScript return type (no missing required fields)
2. **Happy path test:** Mock Gemini returning valid JSON matching the schema → function returns correctly typed response
3. **Generation failure test:** Mock Gemini returning HTTP 400 → function returns `EdgeFunctionError { error: "generation_failed", retryable: false, fallback: null }`
4. **Schema validation failure test:** Mock Gemini returning valid JSON that fails the schema (e.g., missing required field) → function returns `EdgeFunctionError { error: "schema_validation_failed", retryable: true, fallback: null }`
5. **Timeout test:** Mock Gemini timing out → function returns `EdgeFunctionError { error: "timeout", retryable: true, fallback: null }`

Tests run as Deno unit tests against mocked Gemini responses; no staging Gemini API calls required for CI.

### Salary Honesty Tests (Fix 2)
- `india-jobs`: All 30+ `SAFER_ROLE_MAP` entries return `avg_salary_inr: null` — assert in a loop
- `best-fit-jobs`: When Gemini returns a job snippet without salary text, response `salary_range === null`
- `BestFitJobsCard.tsx` unit test: renders "Salary not listed" when `salary_range === null`

### Posting Count Tests (Fix 4)
- `market-signals` type "market": response contains `posting_volume_proxy: number` (integer ≥ 0), `posting_volume_source === "search_result_count"`, and does NOT contain `posting_volume_30d`
- `compute-delta`: new delta records have `posting_change_pct === null` and `posting_change_source === "discontinued"`

### Type Safety Tests (Fix 5)
- TypeScript build must pass with zero errors after renaming `confidence_intervals` → `score_variability`
- Run `grep -rn "confidence_intervals" src/ supabase/` after the PR — must return 0 results

### Profile Completeness Tests (Fix 6)
- `process-scan`: scan result contains `data_quality.profile_completeness_pct` as a number 0–100
- `computeProfileCompleteness`: three deterministic unit tests:
  - **All null:** all 7 fields null → `{ profile_completeness_pct: 0, profile_gaps: ['current_role','experience_years','primary_skills','estimated_monthly_salary_inr','industry','current_company','city'] }`
  - **All populated:** all 7 fields non-null/non-empty → `{ profile_completeness_pct: 100, profile_gaps: [] }`
  - **Partial (4/7):** `current_role="Software Engineer"`, `experience_years=5`, `primary_skills=["Python"]`, `estimated_monthly_salary_inr=120000` populated; `industry=null`, `current_company=null`, `city=null` → `{ profile_completeness_pct: 57, profile_gaps: ['industry','current_company','city'] }`
- `ScoreBreakdownPanel.tsx`: renders completeness nudge when `profile_completeness_pct === 57` (below 70 threshold)
- `ScoreBreakdownPanel.tsx`: does NOT render nudge when `profile_completeness_pct === 86` (6/7 — above threshold)

### Regression Tests
- Run a full end-to-end scan with a dense test profile
- Assert: DI score is unchanged (within ±1 of pre-fix baseline for the same profile)
- Assert: All 10 insight cards render without errors
- Assert: TypeScript frontend build passes with zero errors
- Assert: `grep -rn "confidence_intervals" src/ supabase/` returns 0 results

---

## 11. Success Metrics

All metrics are verified post-deployment:

| Metric | Verification Method | Target |
|---|---|---|
| P1+P2 functions using structured output | Code review: each function has `responseMimeType` in Gemini call + schema test exists | 14/14 functions |
| Salary fields null in new scans | Query DB: `SELECT COUNT(*) FROM scan_results WHERE data->>'salary_range' IS NOT NULL` post-deploy (best-fit jobs) | 0 non-null salary values from LLM |
| `posting_volume_30d` field removed | `grep -rn "posting_volume_30d"` returns 0 results | 0 references |
| `confidence_intervals` field removed | `grep -rn "confidence_intervals"` returns 0 results | 0 references |
| Score unchanged for dense profiles | Automated regression test with 3 test profiles | ±1 or less vs baseline |
| Profile completeness shown on sparse profiles | Manual QA: scan with a minimal profile (title + 1 skill only) | Nudge renders |
| DataQualityBadge shows market data source | Manual QA: badge tooltip in DiagnosisTab shows "Based on web search" | Renders correctly |

---

## 12. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Removing salary data reduces perceived value of pivot suggestions | Medium | Launch simultaneously with AmbitionBox deep link on each pivot card; add tooltip explaining real data is coming |
| Gemini rejects complex `responseSchema` for deeply nested types | Low | Keep all schemas flat (max 2 levels of nesting); test each schema against the Gemini API before deployment; fallback = structured try-catch returning EdgeFunctionError |
| TypeScript rename of `confidence_intervals` missed in one consumer | Medium | Require `grep -rn "confidence_intervals"` returning 0 results as a PR merge gate; reviewer checks this explicitly |
| Profile completeness nudge disrupts users who intentionally have sparse profiles | Low | Nudge is informational, not blocking; A/B test with 20% rollout in first week; measure scan completion rate before/after; dismiss option can be added if dismiss rate > 40% |
| `posting_change_pct` was used in DI score computation — removal changes scores | Low | Verify in `deterministic-engine.ts` before implementation; if used, replace with binary demand signal (posting_volume_proxy > 0) and document in PR; regression test catches any score delta > ±1 |
| Historical scan records have stale `posting_volume_30d` values | High (expected) | Explicitly out of scope; document in release notes: "Score history trend lines may show a discontinuity at this release date for posting-related metrics" |

---

## 13. Implementation Sequence

All six fixes are independent. Recommended order:

Each fix is its own PR. The recommended merge order:

1. **Fix 5** (confidence relabelling) — 2 hours, zero breaking risk, ship first for immediate credibility win. No dependency on any other fix.
2. **Fix 1 — P1 functions** (structured output) — foundational. Ship P1 before P2/P3 so the core scan flow is hardened first. Fix 5 must merge before Fix 1 so the renamed `score_variability` field is already in the TypeScript types when Fix 1 touches `deterministic-engine.ts`.
3. **Fix 2** (salary honesty) — independent of structured output; can be merged in parallel with Fix 1 P2/P3 work, but schedule it early to remove hallucinated data promptly.
4. **Fix 6** (profile gap flagging) — depends on Fix 1 P1 being merged (process-scan must use structured output before adding new fields to its response schema). Merge after Fix 1 P1 is deployed and stable.
5. **Fix 3** (data source transparency) — depends on Fix 6 (needs `profile_completeness_pct` and `profile_gaps` in DataQuality) and Fix 4 (needs `posting_count_source`). Merge last among frontend changes.
6. **Fix 4** (posting count honesty) — requires DB migration; deploy with Fix 4 code change in the same release to avoid a window where code expects `posting_volume_proxy` but DB migration hasn't run.
7. **Fix 1 — P2, P3 functions** — can be done in parallel with Fixes 3–4; lower priority, merge after P1 is confirmed stable.

**Parallel work that is safe:** Fix 2 and Fix 1-P2/P3 have no shared files and can be developed simultaneously.

Total estimated effort: **8–10 engineering days.**

---

*Approach 2 (Retention & Action Layer) begins only after all 6 fixes are merged, tested, and deployed to production.*
