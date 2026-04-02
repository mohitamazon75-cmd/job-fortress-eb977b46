# JobBachao Platform Pivot — Implementation Plan
**Date:** 2026-03-23
**Spec:** `docs/superpowers/specs/2026-03-23-platform-pivot-design.md`
**Status:** Ready for execution

---

## Prerequisites Sprint — Security & Cleanup

### Task P-1: Delete ghost codebase files
Remove all files belonging to the children's health app that were merged into this repo.

**Files to delete:**
- `src/contexts/AppContext.tsx` (if it exists — the BrainBridge context)
- `src/pages/wellnessBeta/` (entire directory)
- Any component files referencing `ChildProfile`, `IntelligenceReport`, `bb_child*` localStorage keys

**Steps:**
1. Grep for `ChildProfile` | `IntelligenceReport` | `bb_child` | `BrainBridge` across all src/ files
2. Delete each file found that belongs to the other project
3. Check for any imports of deleted files in App.tsx or other active files and remove them
4. Verify `npm run build` (or `bun run build`) still passes after deletions

**Verification:** `grep -r "ChildProfile\|IntelligenceReport\|bb_child" src/` returns no results.

---

### Task P-2: Add DOMPurify to all dangerouslySetInnerHTML usages
**Package:** `npm install dompurify @types/dompurify`

**Files affected:**
- `src/components/dashboard/CareerGenomeDebate.tsx` — critical (C-2 from audit)
- Any other files using `dangerouslySetInnerHTML` — grep for them

**Steps:**
1. `npm install dompurify @types/dompurify`
2. Find all `dangerouslySetInnerHTML` usages: `grep -r "dangerouslySetInnerHTML" src/`
3. For each: import DOMPurify and wrap: `{ __html: DOMPurify.sanitize(content, { ALLOWED_TAGS: ['strong','em','br','p'], ALLOWED_ATTR: ['class'] }) }`
4. Test each component renders correctly after sanitization

**Verification:** No `dangerouslySetInnerHTML` in codebase uses raw/unsanitized content.

---

### Task P-3: Add admin role check to /admin/monitor frontend
**File:** `src/pages/AdminDashboard.tsx`

**Steps:**
1. At the top of the AdminDashboard component, before rendering any UI, add a role check:
```tsx
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
if (profile?.role !== 'admin') { navigate('/'); return null; }
```
2. Wrap in useEffect or use a pre-render guard (not just a UI-level check)
3. Ensure the route in App.tsx that wraps AdminDashboard has role-aware protection

**Verification:** Non-admin logged-in user navigating to `/admin/monitor` is redirected to `/`.

---

### Task P-4: Fix ErrorBoundary — don't clear auth tokens on non-auth errors
**File:** `src/components/ErrorBoundary.tsx`

**Steps:**
1. Find the `hardReset()` method
2. Add logic to only clear `sb-*` auth tokens for auth-related errors:
```tsx
const isAuthError = message?.includes('auth') || message?.includes('JWT') || message?.includes('session');
if (isAuthError) {
  Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
}
// Always clear app-specific scan state keys
sessionStorage.removeItem('jb_pending_input');
```
3. Keep clearing app-specific keys (scan state) on any error

**Verification:** Simulating a non-auth render error does not clear the user's auth session.

---

### Task P-5: Fix dual toast system
**File:** `src/App.tsx`

**Steps:**
1. Find both `<Toaster />` (radix) and `<Sonner />` imports in App.tsx
2. Remove the radix `<Toaster />` component and its import
3. Keep `<Sonner />`
4. Search for any remaining `toast()` calls using the radix API (from `@radix-ui/react-toast`) and update to sonner's API
5. `npm run build` to confirm no import errors

**Verification:** Only one toast provider exists in App.tsx. No duplicate toast components in DOM.

---

## Phase A — Edge Function Cuts + Insight Depth

### Task A-1: Delete 11 gimmick/orphaned edge functions
**Directories to delete:**
```
supabase/functions/weaponized-laziness/
supabase/functions/bluff-boss/
supabase/functions/fake-it/
supabase/functions/panchkosha/
supabase/functions/perplexity-research/
supabase/functions/blueprint-research/
supabase/functions/generate-blueprint-narrative/
supabase/functions/extract-dm-pdf/
supabase/functions/ml-gateway/
supabase/functions/ml-predict/
supabase/functions/translate-verdict/
```

**Steps:**
1. Before deleting, grep all frontend files for calls to these functions: `grep -r "weaponized-laziness\|bluff-boss\|fake-it\|panchkosha\|perplexity-research\|blueprint-research\|generate-blueprint-narrative\|extract-dm-pdf\|ml-gateway\|ml-predict\|translate-verdict" src/`
2. Remove any UI that calls them (buttons, hooks, components)
3. Delete each function directory
4. Run `npm run build` to verify no broken imports

**Verification:** No references to deleted function names remain in `src/`.

---

### Task A-2: Create consolidated `market-signals` edge function
**New file:** `supabase/functions/market-signals/index.ts`

**Spec:** Accepts `{ signal_type, role, industry, company?, city? }` and routes to the appropriate Tavily/data query. Replaces: live-enrich, live-market, live-news, career-intel, career-landscape, company-news.

**Steps:**
1. Create `supabase/functions/market-signals/index.ts`
2. Implement routing based on `signal_type`:
   - `"enrich"` → logic from `live-enrich`
   - `"market"` → logic from `live-market`
   - `"news"` → logic from `live-news`
   - `"intel"` → logic from `career-intel`
   - `"landscape"` → logic from `career-landscape`
   - `"company"` → logic from `company-news`
3. Each route returns same shape as the original function it replaces
4. Add validation: reject requests with missing required fields
5. Keep old functions live for now (deprecation happens in Task A-5)

**Verification:** Call `market-signals` with each `signal_type` and confirm response shape matches the old function.

---

### Task A-3: Update frontend callers to use market-signals
**Files to update:**
- `src/hooks/use-live-enrichment.ts` (or similar) → `signal_type: "enrich"`
- `src/components/dashboard/CompanyNewsWidget.tsx` → `signal_type: "company"`
- `src/components/dashboard/LiveMarketWidget.tsx` → `signal_type: "market"`
- `src/components/dashboard/CompetitiveLandscapeWidget.tsx` → `signal_type: "landscape"`
- Any other component calling the 6 old functions directly

**Steps:**
1. Grep for invocations of the 6 old function names in src/
2. Update each to call `market-signals` with the appropriate `signal_type`
3. Ensure TypeScript types still match

**Verification:** No frontend code calls the 6 old function names directly.

---

### Task A-4: Score pillar drill-down in ScoreBreakdownPanel
**File:** `src/components/dashboard/ScoreBreakdownPanel.tsx`

**Steps:**
1. Check what data `computeScoreBreakdown` already returns for each pillar
2. Add an `expandedPillar` state (string | null)
3. For each pillar row, add a chevron toggle
4. When expanded, show:
   - 2–3 specific inputs that drove this pillar score (with data already in the breakdown)
   - One concrete action to improve this specific pillar
   - Confidence level of this sub-score
5. Use Framer Motion AnimatePresence for the expand/collapse animation (already in codebase)

**Verification:** Each pillar in ScoreBreakdownPanel expands to show specific inputs. UI matches existing dashboard design language.

---

### Task A-5: Career Genome Debate — evidence chain rendering
**File:** `src/components/dashboard/CareerGenomeDebate.tsx`
**Edge function:** `supabase/functions/career-genome/index.ts`

**PREREQUISITE:** Task P-2 (DOMPurify) must be complete before this task.

**Steps:**
1. Update `career-genome` edge function system prompt to require structured citation tags:
   - Each agent turn must include `[CITE: skill_name, risk_pct]` tags referencing user's actual data
   - Final verdict steps must include `[EVIDENCE: cited_skill]` references
2. In `CareerGenomeDebate.tsx`, parse citation tags from the LLM response
3. Render each `[CITE: ...]` as a collapsible footnote "Evidence" button per agent turn
4. When evidence is expanded, show the cited skill name + its risk % from the scan report
5. All rendered content must pass through DOMPurify (already applied in P-2)

**Verification:** Debate renders with at least 1 evidence citation per agent turn. Clicking "Evidence" shows the skill data.

---

### Task A-6: Resume Weaponizer — "Why This Works" annotations
**File:** `src/components/dashboard/ResumeWeaponizerWidget.tsx`
**Edge function:** `supabase/functions/resume-weaponizer/index.ts`

**Steps:**
1. Update `resume-weaponizer` prompt to return annotations alongside each rewritten bullet:
```json
{ "original": "...", "rewritten": "...", "annotation": "Leads with measurable outcome, uses active verb, removes passive voice." }
```
2. In `ResumeWeaponizerWidget.tsx`, add an "annotation" field to the bullet type
3. Render each annotation in a smaller muted font below the rewritten bullet
4. Add a `showAnnotations` toggle state (default: true), with a "Hide reasoning" button
5. Persist toggle preference to localStorage

**Verification:** Each rewritten bullet shows a one-line annotation. Toggle hides/shows all annotations.

---

### Task A-7: Best-Fit Jobs — add salary ranges
**File:** `src/components/cards/BestFitJobsCard.tsx` (or similar)
**Edge function:** `supabase/functions/best-fit-jobs/index.ts`

**Steps:**
1. Check the Tavily response structure in `best-fit-jobs` — does it include salary data?
2. If Tavily returns salary data: extract and include in the job object returned to frontend
3. If not always present: add optional `salary_range?: string` field
4. In the card UI, render `₹18–24 LPA` when present, `"Salary not listed"` (muted) when absent
5. Do NOT fabricate salary ranges — only show when source data includes them

**Verification:** Job cards that have salary data from Tavily show it. Cards without show muted "Salary not listed."

---

### Task A-8: AI Timeline skill drill-down
**File:** `src/components/cards/AITimelineCard.tsx` (or wherever AI timeline skills are rendered)

**Steps:**
1. Find where the skill risk table is rendered
2. Add expandable state per skill row
3. When a skill row is expanded, fetch from `skill_risk_matrix` + `job_skill_map` tables:
   - `replacement_tools` array for this skill
   - 2–3 adjacent lower-risk skills (query by job_family + lower automation_risk)
   - `learning_curve` field (already in skill_risk_matrix)
4. Render in an inline panel:
   - "Replacing tools: [Cursor AI, GitHub Copilot]"
   - "Adjacent pivots: [Prompt Engineering, AI-Augmented Development]"
   - "Reskill time: ~40 hours (medium difficulty)"
5. Use a lightweight Supabase RPC or direct query (no new edge function needed)

**Verification:** Clicking a skill row expands to show replacement tools, adjacent pivots, and reskill time.

---

### Task A-9: Side hustle — remove wild card slot, deepen remaining three
**Edge function:** `supabase/functions/generate-side-hustles/index.ts`

**Steps:**
1. Update the prompt to generate exactly 3 hustles (not 4)
2. Remove the "mind-bending/wild card" category/tone instruction
3. Add depth requirements to each hustle output:
   - `target_client`: specific India-relevant client description
   - `pricing_inr`: realistic pricing (e.g., "₹5,000–15,000/project")
   - `first_client_channels`: array of 3 specific platform names (e.g., ["Upwork", "LinkedIn", "Internshala"])
   - `time_to_first_10k_inr`: realistic estimate (e.g., "2–4 months with consistent effort")
4. Update the frontend component to display these new fields
5. Remove the 4th "violet/fuchsia" card slot from the UI

**Verification:** Side hustle card shows exactly 3 hustles, each with target client, pricing, channels, and timeline.

---

### Task A-10: Confidence interval display
**Files:** `src/components/VerdictReveal.tsx`, `src/components/ScoreRing.tsx`

**Steps:**
1. Confirm `ci` value is available in `DashboardSharedProps` — find where it's computed
2. In the score display, render `± {ci}` directly after the main score number:
   - Main score: large, bold font
   - `± 8`: `text-sm text-muted-foreground` inline
3. Wrap the `± 8` in a `<span>` with a tooltip (use existing `TermTooltip` or `HinglishTooltip` component):
   - Tooltip text: "Score confidence range. Provide your LinkedIn profile for a tighter interval."
4. Do NOT show CI in History Tab chart (out of scope for this task)

**Verification:** Score displays as "47 ± 8" with tooltip on hover of the ± portion.

---

### Task A-11: Methodology preview before VerdictReveal score
**File:** `src/components/VerdictReveal.tsx`

**Steps:**
1. Add a new phase to VerdictReveal: `"methodology"` → `"countdown"` → `"reveal"`
2. In the `"methodology"` phase (3 seconds), show a card:
   > "Your score is computed from 5 factors: AI Resistance, Market Position, Skill Moat, Role Trajectory, and Seniority Protection."
3. After 3 seconds, transition to the existing count-up animation
4. After count-up, show the decomposition waterfall (already exists)
5. Use Framer Motion for the transition (already in use)

**Verification:** Score reveal shows methodology card for 3 seconds before the number count-up begins.

---

### Task A-12: Career Obituary — move behind paywall, add Peer Comparison preview
**Files:** `src/components/cards/CareerObituaryCard.tsx`, `src/components/cards/PeerComparison.tsx` (or wherever used in card flow)

**Steps:**
1. Find where CareerObituaryCard appears in the free card flow (InsightCards.tsx or similar)
2. Wrap it with `PremiumGate` component — blur overlay + "Unlock with Pro" CTA
3. Apply `filter: blur(4px)` via CSS on the obituary content for free users
4. At the Card 11 position in the free flow, add a new `PeerComparisonPreviewCard`:
   - Renders `PeerComparison` component with a new `preview={true}` prop
   - `preview={true}` limits visible peer rows to 3
   - Rows 4+ are blurred with a `PremiumGate` overlay
5. Add the `preview` prop to `PeerComparison` component

**Verification:** Free users see a blurred Career Obituary with upgrade CTA. Card 11 shows Peer Comparison preview with first 3 rows visible.

---

## Phase B — Score History Dashboard

### Task B-1: Create score_history delta_summary migration
**New file:** `supabase/migrations/20260323_add_delta_summary_to_score_history.sql`

```sql
ALTER TABLE public.score_history ADD COLUMN IF NOT EXISTS delta_summary jsonb;
ALTER TABLE public.market_signals ADD COLUMN IF NOT EXISTS posting_change_pct numeric(6,2) DEFAULT 0;
```

**Steps:**
1. Create the migration file
2. Apply locally: `supabase db push` (or add to migrations folder for next deploy)

**Verification:** `score_history` table has `delta_summary` column. `market_signals` has `posting_change_pct`.

---

### Task B-2: Create compute-delta edge function
**New file:** `supabase/functions/compute-delta/index.ts`

**Steps:**
1. Create the function. It receives `{ user_id, scan_id, new_score_history_id }` from pgmq
2. Fetches the two most recent `score_history` records for `user_id`
3. Computes diff: score_change, moved_up skills, moved_down skills, new_risks, new_moats
4. Decision tree:
   - 0 change + no skills changed → template summary
   - ≤5 change AND ≤2 skills changed → template summary
   - >5 change OR >2 skills changed → Gemini Flash call (< 100 tokens)
5. Writes `delta_summary` jsonb to the newer `score_history` record
6. Function must be idempotent (re-running doesn't overwrite with bad data)

**Verification:** After a test invocation with two different score_history records, the newer record has `delta_summary` populated with correct fields.

---

### Task B-3: Update process-scan to write score_history and enqueue delta
**File:** `supabase/functions/process-scan/index.ts`

**Steps:**
1. Find where `process-scan` completes and writes the final scan record
2. If user is authenticated, after writing the scan, insert a record into `score_history`:
   ```typescript
   await supabase.from('score_history').insert({
     user_id: userId,
     scan_id: newScanId,
     determinism_index: finalScore,
     survivability_score: report.survivability_score,
     moat_score: report.moat_score,
     role_detected: report.role,
     industry: report.industry,
   });
   ```
3. After inserting, enqueue a `compute-delta` job via pgmq:
   ```typescript
   await supabase.rpc('pgmq_send', { queue_name: 'compute_delta', msg: { user_id: userId, scan_id: newScanId } });
   ```
4. This must NOT block the main scan response — use async/fire-and-forget pattern

**Verification:** After completing a scan as an authenticated user, a new `score_history` record appears. After a short delay, `delta_summary` is populated.

---

### Task B-4: Create ScoreHistoryTab and ScoreHistoryChart components
**New files:**
- `src/components/dashboard/ScoreHistoryTab.tsx`
- `src/components/dashboard/ScoreHistoryChart.tsx`

**Steps:**
1. `ScoreHistoryChart.tsx`: recharts `LineChart`
   - X-axis: scan dates (formatted as "Jan 15", "Mar 23")
   - Y-axis: score 0–100, gridlines at 25/50/75
   - Trend line color: green if last 2 points trending up, amber if flat (±3), red if trending down
   - Dots at each scan point, clickable (sets selected scan)
   - For >20 data points: rotate X-axis labels 45°, suppress every other label
   - 1 data point: single dot + dashed future line
2. `ScoreHistoryTab.tsx`:
   - Fetches `score_history` for current user via Supabase client (ordered by created_at desc)
   - Shows chart at top
   - Below chart: list of scans with score, date, delta summary text
   - Each scan has a "[View report]" button
   - Empty state (0 scans): "Run your first scan to start tracking"
   - Single scan state: message + enroll in rescan_nudge email via `nurture-emails` edge function
   - "Rescan Now" CTA button at bottom

**Verification:** Tab shows chart with correct colors. Delta summary appears below each scan after async computation. Empty/single states render correctly.

---

### Task B-5: Add History tab to JobBachaoDashboard
**File:** `src/components/JobBachaoDashboard.tsx`

**Steps:**
1. Import `ScoreHistoryTab`
2. Add "History" to the tab list (after Dossier or in a logical position)
3. Hinglish label: "इतिहास" when `locale === 'hi'`
4. Render `ScoreHistoryTab` when History tab is active
5. Lazy-load with `React.lazy` (same pattern as other tabs)

**Verification:** History tab appears in the dashboard. Clicking it renders ScoreHistoryTab.

---

## Phase C — Defense Plan Milestone Tracking

### Task C-1: Create defense_milestones and learning_resources migrations
**New files:**
- `supabase/migrations/20260323_create_defense_milestones.sql`
- `supabase/migrations/20260323_create_learning_resources.sql`

**defense_milestones schema:**
```sql
CREATE TABLE public.defense_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scan_id uuid NOT NULL,
  phase integer NOT NULL,
  milestone_key text NOT NULL,
  milestone_label text NOT NULL,
  resource_url text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, scan_id, milestone_key)
);
ALTER TABLE public.defense_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own milestones" ON public.defense_milestones
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_defense_milestones_user ON public.defense_milestones(user_id, scan_id);
```

**learning_resources schema:**
```sql
CREATE TABLE public.learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  estimated_hours numeric(4,1),
  platform text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.learning_resources TO authenticated, anon;
```
Seed with ~20 initial resources covering: cursor_ai, python_ml, prompt_engineering, data_visualization, communication, leadership.

**Verification:** Both tables exist with correct schemas and RLS policies.

---

### Task C-2: Create generate-milestones edge function
**New file:** `supabase/functions/generate-milestones/index.ts`

**Steps:**
1. Function receives `{ user_id, scan_id }` from pgmq
2. Fetches `final_json_report` for the scan from `scans` table
3. Parses `weeklyActionPlan` or `defense_plan` from the report
4. Extracts 8–12 structured milestones with deterministic `milestone_key` values
5. For each milestone, queries `learning_resources` table for a matching `skill_category`
6. Inserts into `defense_milestones` with `ON CONFLICT DO NOTHING` (idempotent)
7. Enqueue this function from `process-scan` after scan completes (same pattern as compute-delta)

**Verification:** After a scan completes, `defense_milestones` table has 8–12 records for that user+scan. Re-running doesn't create duplicates.

---

### Task C-3: Add milestone checklist UI to DefenseTab
**File:** `src/components/dashboard/DefenseTab.tsx`

**Steps:**
1. Add a query to fetch `defense_milestones` for current user + scan_id
2. Add overall progress bar: `(completed_count / total_count) * 100`
3. Group milestones by `phase` (1–4)
4. For each phase group:
   - Phase header with phase number and week range
   - List of milestones as checkboxes
   - Completion % computed: `completed_in_phase / total_in_phase * 100`
   - Phase 2–4 are locked (show lock icon, greyed out) until previous phase ≥50% complete
5. "Mark done" button on each incomplete milestone:
   - Optimistic UI: mark checked immediately
   - Call Supabase update: `SET completed_at = now()` on the milestone
   - Roll back if DB call fails
6. Place the milestone section at the TOP of DefenseTab, above existing plan content

**Verification:** Milestones render grouped by phase. Phases 2–4 are locked until Phase 1 reaches 50%. Marking done persists to DB.

---

### Task C-4: Add weekly nudge email pg_cron job
**New migration:** `supabase/migrations/20260323_milestone_nudge_cron.sql`

**Steps:**
1. Create a SQL function `send_milestone_nudge_emails()` that:
   - Finds users with incomplete Phase 1 milestones
   - Checks `last_seen_at` on `profiles` or similar — skip if seen in last 7 days
   - Checks `email_log` for `campaign = "milestone_nudge"` within last 7 days — skip if found
   - Enqueues one nudge email per eligible user via pgmq
2. Schedule with pg_cron: `SELECT cron.schedule('milestone-nudge', '0 3 * * *', 'SELECT send_milestone_nudge_emails()');`
   (3:30 UTC = 9:00 IST)
3. Update `process-email-queue` edge function to handle `milestone_nudge` campaign type with correct template

**Verification:** The pg_cron job is scheduled. A test run of the SQL function enqueues emails for users who qualify.

---

## Phase D — Role-Specific Intel Tab

### Task D-1: Create intel_watchlist migration
**New file:** `supabase/migrations/20260323_create_intel_watchlist.sql`

```sql
CREATE TABLE public.intel_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  signal_json jsonb NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON public.intel_watchlist
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_intel_watchlist_user ON public.intel_watchlist(user_id, added_at DESC);
```

**Verification:** Table exists with correct schema and RLS.

---

### Task D-2: Create role-intel edge function
**New file:** `supabase/functions/role-intel/index.ts`

**Steps:**
1. Accepts: `{ role, industry, company, skills[], city, score }`
2. Runs parallel Tavily searches:
   - Company-specific news filtered for role relevance
   - Hiring trends for role+city
   - New AI tools in `skill_risk_matrix` for user's top 5 skills (from DB, no Tavily needed)
   - Peer salary movement for role+seniority
3. For each result, compute `relevance_score` (0–100) based on overlap with user profile
4. Returns `RoleIntelSignal[]` sorted by relevance_score desc
5. Signals with relevance_score < 20 are filtered out
6. Cache in `enrichment_cache` with 6-hour TTL, key: `role-intel:{normalized_role}:{industry}:{company}:{city}`
   - Normalize cache key: lowercase, trim whitespace
7. **Tavily fallback:** If all Tavily queries return 0 results:
   - Return any stale cached signals (with `stale: true` flag)
   - If no cache: return 2–3 signals from `skill_risk_matrix` for user's top skills
   - Include `fallback: true` flag in response
8. **API error handling:** Treat Tavily timeout/500 same as 0-result fallback

**Verification:** Function returns relevant signals. With a niche role that Tavily can't find, returns fallback signals from DB. Repeated calls within 6 hours return cached result.

---

### Task D-3: Create IntelSignalCard and IntelWatchlist components
**New files:**
- `src/components/dashboard/IntelSignalCard.tsx`
- `src/components/dashboard/IntelWatchlist.tsx`

**IntelSignalCard:**
- Renders a single `RoleIntelSignal`
- Header: colored relevance tier badge (🔴 HIGH if 80–100, 🟡 MEDIUM if 50–79, 🟢 LOW if 20–49)
- Body: headline, summary (2 sentences), relevance_reason in muted italic
- Footer: "Read more" link (if source_url) + "Add to watchlist" button
- "Add to watchlist" calls a Supabase insert to `intel_watchlist`
- If user already watchlisted this signal (check by headline dedup), show "✓ Watchlisted" instead

**IntelWatchlist:**
- Collapsible section (default: collapsed if empty, open if has items)
- Fetches user's watchlist from `intel_watchlist` table
- Renders each watchlisted signal as a compact IntelSignalCard (without "Add to watchlist" button — replace with "Remove" button)
- "Remove" calls Supabase delete on the watchlist item
- Shows count in section header: "Your Watchlist (3)"

**Verification:** Signal card renders all fields. Adding to watchlist persists. Removing from watchlist works.

---

### Task D-4: Redesign IntelTab to use role-intel signal feed
**File:** `src/components/dashboard/IntelTab.tsx`

**Steps:**
1. Add state: `signals: RoleIntelSignal[]`, `loading`, `isStale`, `isFallback`
2. On mount, call `role-intel` edge function with user's role/industry/company/skills/city from `report`
3. While loading: show 3 skeleton card placeholders (same height as signal cards)
4. On success:
   - If `isFallback`: show banner "Live signals unavailable. Showing skill-based insights."
   - If `isStale`: show banner "Signals from [date]. Refreshing in background."
   - Render `IntelWatchlist` at top (collapsed if empty)
   - Render signals grouped by relevance tier (HIGH → MEDIUM → LOW)
   - Each signal rendered with `IntelSignalCard`
5. Remove old widgets: `CompanyNewsWidget`, `LiveMarketWidget`, `CompetitiveLandscapeWidget`, `MonitoringWidget`
6. Keep `IndustryRiskHeatmap` if it's powered by DB data (not a Tavily call)

**Verification:** Intel Tab shows role-specific signals. Fallback banner appears when Tavily unavailable. Old widgets are gone.

---

## Success Criteria for Completion

- [ ] `npm run build` passes with no errors
- [ ] No `dangerouslySetInnerHTML` without DOMPurify in src/
- [ ] Ghost codebase references (`ChildProfile`, `bb_child`) return 0 grep results
- [ ] 11 deleted edge functions have no remaining frontend callers
- [ ] `market-signals` function handles all 6 signal_type values
- [ ] Score History Tab renders with chart and delta summaries
- [ ] Defense milestone checkboxes persist to DB
- [ ] Intel Tab shows relevance-scored signals, not generic news feed
- [ ] All new tables have RLS enabled
- [ ] No TypeScript errors in new/modified files
