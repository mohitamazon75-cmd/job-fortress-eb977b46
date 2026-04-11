

# Model B Critical Fixes — Eliminating Fabricated Data

## Problem Summary
The Model B output fabricates specific data points that erode user trust:
1. **Bangalore bias** — prompt hardcodes Bangalore companies even when user is in Hyderabad
2. **Fake social proof** — "2,340 professionals checked this month" is a static string
3. **Fabricated job metadata** — `days_posted` and `applicant_count` are LLM inventions
4. **Fabricated peer stats** — `peer_gap_pct` ("42% of peers have already...") is fiction
5. **Absolute ₹ losses without salary input** — `cost_of_inaction` shows precise ₹ amounts with no salary data
6. **Hardcoded india_average** — always 61, never computed

## Fix Plan (5 changes, no regressions)

### Fix 1 — Extract location from scan data and pass to prompt
**File:** `supabase/functions/get-model-b-analysis/index.ts`

In `extractResumeText()`, also extract the user's city from scan metadata (`final_json_report`). Pass it to `buildUserPrompt()` as a parameter.

In `buildUserPrompt()`:
- Replace the hardcoded "Top hiring B2B SaaS India 2026: Freshworks (Bangalore)..." list with a dynamic instruction: `"The user is based in {city}. Prioritize companies and job matches in {city} and nearby metros. Only use Bangalore/Mumbai if the user is actually located there."`
- If city is unknown, instruct: `"Location unknown. Use 'India' as location. Do not default to any specific city."`

In `buildSystemPrompt()`:
- Add to EVIDENCE RULES: `"NEVER default to Bangalore. Use the user's actual city from their resume. If no city found, use 'India'."`

### Fix 2 — Replace hardcoded "2,340" with real scan count
**File:** `src/components/model-b/Card1RiskMirror.tsx` (line 197)

Replace the static `2,340` with a prop passed from the parent. The parent component will query the real count from the `scans` table on mount (a simple `SELECT COUNT(*)` for scans completed in the last 30 days). Display as "70+ professionals" (rounded down to nearest 10 for honesty).

If count < 10, hide the social proof line entirely.

### Fix 3 — Remove fabricated `days_posted` and `applicant_count`
**File:** `src/components/model-b/Card5JobsTracker.tsx` (line 152-156)

Replace "Posted {days_posted} days ago · {applicant_count} applicants" with a honest label: "Search live openings on Naukri and LinkedIn above" — pointing users to real job boards instead of displaying invented metadata.

Remove `days_posted`, `applicant_count`, and `is_urgent` from the prompt schema in `get-model-b-analysis/index.ts` to stop the LLM from generating them.

### Fix 4 — Remove fabricated `peer_gap_pct`
**File:** `src/components/model-b/Card1RiskMirror.tsx` (lines 105-109)

Remove the `peer_gap_pct` display block entirely. The LLM has no peer data to reference.

In the prompt (`get-model-b-analysis/index.ts`), remove `peer_gap_pct` from the `cost_of_inaction` schema.

### Fix 5 — Reframe `cost_of_inaction` as percentages
**File:** `supabase/functions/get-model-b-analysis/index.ts`

Change the `cost_of_inaction` prompt schema:
- `monthly_loss_lpa` → `annual_gap_pct` (string like "10-15% of package")
- `six_month_loss` → `six_month_gap_pct` (string like "5-8% earning power lost")
- Remove `peer_gap_pct`
- Keep `decay_narrative` but instruct: "Use percentages, not absolute ₹ amounts. You don't know their salary."

**File:** `src/components/model-b/Card1RiskMirror.tsx` (lines 95-116)

Update labels to match: "Left on table annually" → display the percentage. "6-month inaction cost" → display percentage framing.

### Fix 6 — Remove hardcoded `india_average: 61`
**File:** `supabase/functions/get-model-b-analysis/index.ts` (line 527)

Change from `india_average: 61` to `india_average: integer (role-specific average from your analysis)`. Let the LLM compute a role-specific average based on the actual market context provided, rather than always outputting 61.

## Deployment
- Deploy updated `get-model-b-analysis` edge function
- Run `tsc --noEmit` to confirm 0 errors
- No database migrations needed
- No breaking changes to existing cached results (old data still renders, new analyses get clean data)

## What This Does NOT Change
- No layout, color, or structural changes
- No changes to Model A
- No changes to Cards 2, 3, 4, 6, 7 (they don't have the fabrication issues)
- Card 5 only loses the fake metadata line; job cards, links, and kanban stay intact

