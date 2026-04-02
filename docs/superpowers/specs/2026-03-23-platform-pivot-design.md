# JobBachao — Platform Pivot Design Spec
**Date:** 2026-03-23
**Author:** Product + Architecture Review
**Status:** Draft — Awaiting Approval
**Approach:** Approach 2 (Platform Pivot) with Approach 1 depth improvements baked into Phase A

---

## 1. Problem Statement

JobBachao is currently a **disposable scan tool**: users scan once, read a report, close the tab, and never return. The core intelligence is strong, but three structural problems prevent the product from reaching its potential:

1. **The product is used once.** There is no reason to return after the first scan. No score history, no completion tracking, no alerts.
2. **Insights read as impressive but shallow.** The score is a number without traceable reasoning. The advice lacks specificity. Features like the Career Genome Debate are theatrical but not evidence-grounded.
3. **Feature bloat undermines credibility.** Gimmick edge functions (`bluff-boss`, `fake-it`, `weaponized-laziness`, `panchkosha`) and redundant infrastructure (6 separate market-signal edge functions, dual toast systems) add cost and confusion without adding value.

This spec defines four sequential phases to address these problems and transform JobBachao into a **career monitoring platform**.

---

## 2. Scope and Phases

| Phase | Name | Goal | Estimated Effort |
|---|---|---|---|
| A | Sharpen & Cut | Remove bloat, deepen existing insight quality | 1–2 weeks |
| B | Score History Dashboard | Show users their career safety trend over time | 2 weeks |
| C | Defense Plan Tracking | Give users a reason to return weekly | 2 weeks |
| D | Role-Specific Intel Tab | Replace broadcast feed with personalized signals | 3 weeks |

**Total: ~8–9 weeks.** Each phase is independently valuable and shippable. If later phases slip, Phase A + B alone represent a meaningful improvement.

### Out of Scope (this spec)
- B2B / employer mode
- Native mobile app
- LinkedIn/Resume discrepancy detection
- Knowledge Graph explorer UI
- Ghost codebase cleanup (tracked separately in AUDIT_REPORT.md — must complete before Phase A begins)

---

## 3. Prerequisites (Before Phase A)

The following critical and high-severity items from AUDIT_REPORT.md are **non-negotiable prerequisites** and must be completed before any Phase A work begins:

- **C-1**: Delete all ghost codebase files (~30 files from the children's health app). Resolve the `assessments` table migration conflict by renaming to `career_assessments`.
- **C-2**: Add DOMPurify sanitization to all `dangerouslySetInnerHTML` usages.
- **C-3**: Add admin role check to `/admin/monitor` frontend route.
- **C-4**: Verify `.env` is not in git history; rotate anon key if needed.
- **H-1**: Add server-side subscription check to all premium edge functions.
- **H-6**: Audit `ShareScan` RLS — confirm no unauthenticated PII leak.

---

## 4. Phase A — Sharpen & Cut

### 4.1 Edge Function Consolidation

**Delete the following edge functions entirely:**

| Function | Reason |
|---|---|
| `weaponized-laziness` | Gimmick; undermines brand credibility |
| `bluff-boss` | Gimmick; contradicts "zero hallucination" brand promise |
| `fake-it` | Gimmick; same concern |
| `panchkosha` | Out of product scope; wellness framework, not career intelligence |
| `perplexity-research` | Orphaned prototype; not wired into any user journey |
| `blueprint-research` | Orphaned prototype; belongs to ghost codebase era |
| `generate-blueprint-narrative` | Same as above |
| `extract-dm-pdf` | Orphaned prototype |
| `ml-gateway` | Not in active use; duplicates Gemini-based scoring |
| `ml-predict` | Same; no active callers found in frontend code |
| `translate-verdict` | Functionality covered by locale toggle + Hinglish mode |

**Consolidate the following 6 functions into one parameterized `market-signals` function:**

Current: `live-enrich`, `live-market`, `live-news`, `career-intel`, `career-landscape`, `company-news`

New unified function signature:
```typescript
POST /functions/v1/market-signals
{
  "signal_type": "enrich" | "market" | "news" | "intel" | "landscape" | "company",
  "role": string,
  "industry": string,
  "company"?: string,
  "city"?: string
}
```

This reduces cold-start latency, simplifies monitoring, and eliminates 5 redundant Deno deploy slots.

**Fix dual toast system (L-4):** Remove `<Toaster />` (radix-based), keep only `<Sonner />`. Update any remaining `toast()` calls that use the radix API.

### 4.2 Insight Depth Improvements

#### 4.2.1 Score Pillar Drill-Down
**Current:** Score waterfall shows 5 pillars (AI Resistance, Market Position, etc.) as read-only numbers.
**New:** Each pillar is expandable. Clicking opens an inline panel showing:
- The 2–3 specific inputs that drove this pillar score (e.g., "Python automation risk: 78% → dragged AI Resistance down by 11 points")
- One concrete action to improve this specific pillar
- Confidence level of this sub-score

**Implementation:** The `computeScoreBreakdown` function already produces this data. It needs to be passed through to `ScoreBreakdownPanel` and rendered with an accordion pattern.

#### 4.2.2 Career Genome Debate — Evidence Chain
**Current:** 3 AI agents deliver a verdict and 3 "surgical steps." Steps are generic LLM outputs with no visible grounding.
**New:** Each agent turn must cite the user's actual scan data:
- Defender turn: "Citing [User]'s 4 moat skills (SQL expertise + stakeholder management + domain knowledge + process ownership)..."
- Prosecutor turn: "However, [User]'s reliance on Python automation (flagged as 68% risk) undermines this..."
- Final verdict steps must reference the cited evidence

**Implementation:** Update the `career-genome` edge function system prompt to require structured citation tags in its response. Parse and render these in `CareerGenomeDebate.tsx` with a collapsible "evidence" footnote per agent turn.

**Note:** DOMPurify sanitization (AUDIT_REPORT C-2) must be applied to `CareerGenomeDebate.tsx` **before** this change ships. The citation tags introduce additional HTML-like content from the LLM; unsanitized rendering would expand the XSS surface. Apply DOMPurify as part of the prerequisite sprint, then build evidence chain rendering on top of the sanitized renderer.

#### 4.2.3 Resume Weaponizer — "Why This Works" Annotations
**Current:** Old bullet → New bullet. No explanation.
**New:** Each rewritten bullet includes a one-line annotation:
> "Why: Leads with measurable outcome, uses active verb, removes passive voice."

**Implementation:** Update the `resume-weaponizer` edge function prompt to return annotations alongside rewrites. Add a toggle ("Show reasoning") in `ResumeWeaponizerWidget.tsx` to show/hide annotations. Default: shown on first load, collapsible after.

#### 4.2.4 Best-Fit Jobs — Salary Ranges
**Current:** Job cards show "Skill Match %" and "AI Safety Score" only.
**New:** Job cards show salary range (₹ LPA) when available from Tavily response. Format: "₹18–24 LPA" or "Salary not listed" with muted styling. Do not fabricate ranges; only show when the source returns this field.

#### 4.2.5 AI Timeline Skill Drill-Down
**Current:** Flat table of skills with risk % and timeline estimate.
**New:** Each skill row is expandable. Expanded state shows:
- **Replacing tools:** Names of specific AI tools automating this skill (already in `skill_risk_matrix.replacement_tools`)
- **Adjacent pivots:** 2–3 skills that are lower-risk and related (query `job_skill_map` + `skill_risk_matrix`)
- **Estimated reskill time:** e.g., "~40 hours to intermediate level"

**Implementation:** These data points already exist in the KG tables. Wire them through the `IntelTab` → `AITimelineCard` component. No new edge function needed — add a lightweight RPC call to `skill_risk_matrix` and `job_skill_map`.

#### 4.2.6 Side Hustle Generator — Remove "Wild Card" Slot, Deepen Remaining Three
**Current:** 4 slots including one "mind-bending" novelty suggestion.
**New:** 3 slots, each with implementation depth added to the LLM prompt:
- Target client profile (specific, India-relevant)
- Realistic pricing in ₹/month or ₹/project
- Where to find first 3 clients (specific platforms: Upwork, LinkedIn, Internshala, etc.)
- Time-to-first-₹10K estimate

Update `generate-side-hustles` prompt accordingly.

#### 4.2.7 Score Display — Confidence Interval
**Current:** Score shown as single integer (e.g., "47").
**New:** Score shown with interval (e.g., "47 ± 8") in a smaller, muted font next to the main number. Add a tooltip: "Score confidence range based on data completeness. Provide LinkedIn profile for tighter interval."

The `ci` (confidence interval) value is already computed and passed through `DashboardSharedProps`. Render it in two places:
1. **Main score display** (`VerdictReveal.tsx` / `ScoreRing.tsx`): show as `47 ± 8` — the `± 8` in a smaller `text-sm text-muted-foreground` font directly after the main score number.
2. **Tooltip on hover of the ± value**: "Score confidence range. Provide your LinkedIn profile for a tighter interval."
Do not show confidence interval in the History Tab chart (too much visual noise on the trend line).

#### 4.2.8 VerdictReveal — Methodology Preview Before Score
As per AUDIT_REPORT.md M-4: show a 3-second "methodology preview" card before the score count-up animation. Card text: "Your score is computed from 5 factors: AI Resistance, Market Position, Skill Moat, Role Trajectory, and Seniority Protection." Then reveal the score, then show the decomposition waterfall.

#### 4.2.9 Career Obituary — Move Behind Paywall as Reward
**Current:** Career Obituary is Card 11 in the free report flow — a viral-first, action-second mechanic.
**New:** Move it to a post-paywall "Rewards" section on the dashboard. Free users see a **blurred preview** of the obituary (CSS blur + lock overlay using the existing `PremiumGate` component pattern). The blur is applied as `filter: blur(4px)` over the first 3 lines of the obituary text, with a "Unlock with Pro" CTA.

Replace Card 11's position in the free flow with a **"Peer Comparison Preview" card**: render the existing `PeerComparison` component showing the user's score vs. anonymized industry percentile (the `percentile` value already computed in scan report). The detailed peer breakdown (individual peer data, salary comparison) is blurred/gated behind `PremiumGate`. This is not a new component — it reuses `PeerComparison` with a new `preview={true}` prop that limits the visible rows to 3 and adds a blur overlay on rows 4+.

The viral shareable unit for free users becomes the new **"Score Card"** (score + CI + one-line verdict), not the obituary. A static shareable image of the Score Card can be generated via the existing `og-image` edge function with a new template parameter.

---

## 5. Phase B — Score History Dashboard

### 5.1 Goal
Show users their career safety score trend over time. This transforms JobBachao from a one-time scan into a career monitoring platform — the CIBIL analogy only works if users can see their score move.

### 5.2 Data Model
The `score_history` table already exists with the correct schema:
```sql
public.score_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  determinism_index integer NOT NULL,  -- the main score
  survivability_score integer,
  moat_score integer,
  role_detected text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now()
)
```

**New column to add via migration** (`YYYYMMDD_add_delta_summary_to_score_history.sql`):
```sql
ALTER TABLE public.score_history ADD COLUMN delta_summary jsonb;
-- Schema: {
--   "score_change": 9,                        -- integer, positive or negative
--   "moved_up": ["SQL expertise"],            -- skills whose risk score improved
--   "moved_down": ["Python automation"],      -- skills whose risk score worsened
--   "new_risks": ["Cursor AI"],               -- new tools in risk matrix since last scan
--   "new_moats": ["stakeholder management"],  -- newly identified moat skills
--   "summary_text": "Your score rose 9 points — 2 moat skills detected, Python automation risk re-scored."
-- }
```

**Also add to `market_signals` table** (migration):
```sql
ALTER TABLE public.market_signals ADD COLUMN IF NOT EXISTS posting_change_pct numeric(6,2) DEFAULT 0;
```
This column is referenced in Section 5.5 for triggering rescan nudge emails.

### 5.2.1 Delta Computation Logic

Delta summary is computed **asynchronously** after scan write — it must not block `process-scan` response time. Implementation:

1. `process-scan` completes, writes main scan record, then enqueues a `compute-delta` job via `pgmq`.
2. A new `compute-delta` edge function (or a pg_cron job calling a PLPGSQL function) picks up the job, fetches the user's two most recent `score_history` records, computes the diff, and writes `delta_summary` to the newer record.
3. Frontend `ScoreHistoryTab` polls for `delta_summary IS NOT NULL` or uses Supabase Realtime to receive the update — no additional loading state needed beyond the chart rendering with NULL delta shown as "Calculating changes…".

**Delta generation decision tree:**
- If `score_change` is 0 and no skills changed → `summary_text` = template: "Score unchanged since last scan."
- If `score_change` is ≤ 5 AND ≤ 2 skills changed → `summary_text` = template string (no LLM call).
- If `score_change` > 5 OR > 2 skills changed → `summary_text` = lightweight Gemini Flash call with structured prompt (< 100 tokens output). This call is non-blocking and async.

The `process-scan` edge function must be updated to write a record to `score_history` on every completed scan for an authenticated user (no change needed for anonymous scans).

### 5.3 New Component: `ScoreHistoryTab`

A new tab added to `JobBachaoDashboard` (alongside Diagnosis, Defense, Intel, Dossier):

**Tab name:** "History" (or "Timeline" in Hinglish: "इतिहास")

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Your Career Safety Score Over Time                 │
│                                                     │
│  [Score trend line chart — recharts LineChart]      │
│  X-axis: scan dates  Y-axis: score (0-100)          │
│  Trend line with dots for each scan                 │
│  Green if upward trend, amber if flat, red if down  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Jan 15 → Mar 23: +9 points                  │   │
│  │ What changed: 2 new moat skills added,      │   │
│  │ Python risk re-scored after GPT-4o update   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ─────────────────────────────────────────────     │
│  [Scan 1: Jan 15]  Score: 42  [View report]        │
│  [Scan 2: Mar 23]  Score: 51  [View report] ← Now  │
│                                                     │
│  [Rescan Now — check if your score has moved]       │
└─────────────────────────────────────────────────────┘
```

**Empty state / single scan:** If the user has exactly 1 scan, render a single dot on the chart at today's date with the message: "Rescan in 30+ days to see your score trend. We'll remind you." + enroll in rescan nudge email by calling the existing `nurture-emails` edge function with `campaign: "rescan_nudge"`. If the user has 0 scans (should not reach this tab), show "Run your first scan to start tracking."

**Minimum data points for full chart:** 2 scans required for a trend line. 1 scan shows a single dot with a dashed "future" line. The recharts chart must handle 1–100 scan data points; for users with >20 scans, X-axis labels are rotated 45° and every other label is suppressed to avoid crowding.

### 5.4 Delta Summary Generation
When a user who has previous scans completes a new scan, the `process-scan` edge function computes a delta and writes it to `score_history.delta_summary`. Delta includes:
- `score_change`: integer (positive or negative)
- `moved_up`: skills whose risk score improved
- `moved_down`: skills whose risk score worsened
- `new_risks`: AI tools that appeared in the risk matrix since last scan
- `new_moats`: skills that were newly identified as moats

This delta is shown in the History tab as a plain-English summary (generated by a lightweight LLM call or templated string if change is minor).

### 5.5 "Rescan" Nudge Email
When a user's last scan is >45 days old AND market signals for their role have materially changed (measured by `market_signals.posting_change_pct > 15%` or new entries in `skill_risk_matrix.replacement_tools` for their skills), the existing `pgmq` + `pg_cron` infrastructure triggers a re-engagement email:

> "Your last scan was 47 days ago. We've detected 2 new AI tools affecting your role since then. Your score may have moved. [Check now →]"

This uses the existing `nurture-emails` + `process-email-queue` edge function infrastructure.

---

## 6. Phase C — Defense Plan Completion Tracking

### 6.1 Goal
Give users a reason to open the app weekly. The 90-day plan currently has no completion state, no progress tracking, and no reason to return after the initial read.

### 6.2 Data Model — New Table

```sql
CREATE TABLE public.defense_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scan_id uuid NOT NULL,
  phase integer NOT NULL,           -- 1–4 (the four 90-day phases)
  milestone_key text NOT NULL,      -- e.g., "week1_skill_start", "week3_linkedin_update"
  milestone_label text NOT NULL,    -- Human-readable, shown in UI
  resource_url text,                -- Optional learning resource link
  completed_at timestamptz,         -- NULL = incomplete
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, scan_id, milestone_key)
);

ALTER TABLE public.defense_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own milestones" ON public.defense_milestones
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### 6.3 Milestone Generation

**Trigger:** A new `generate-milestones` Supabase Edge Function is called **asynchronously** from `process-scan` after the scan writes successfully (via pgmq, same pattern as delta computation). It must not block the scan response.

**Input:** The completed `WeeklyActionPlan` JSON from the scan report (already stored in `final_json_report` on the `scans` table).

**Process:** The function parses `final_json_report.weeklyActionPlan` (or `defense_plan`) and extracts 8–12 structured milestones. Each milestone is assigned a deterministic `milestone_key` derived from its content (e.g., `phase1_skill_start`, `phase1_linkedin_update`) so re-runs are idempotent (use `INSERT ... ON CONFLICT DO NOTHING`).

**Resource URL sourcing:** Resource URLs are generated by the `generate-milestones` function via a small lookup table of curated learning resources indexed by skill category. The function:
1. Checks `skill_risk_matrix.replacement_tools` for the user's highest-risk skills
2. Queries a new `learning_resources` lookup table (seeded with ~50 curated links: Coursera, YouTube, specific tools' getting-started guides)
3. If no match found, `resource_url` is `NULL` — this is acceptable; email nudge omits the link section if `resource_url IS NULL`

**New migration required:** `YYYYMMDD_create_learning_resources.sql`:
```sql
CREATE TABLE public.learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category text NOT NULL,        -- e.g., "cursor_ai", "python_ml", "prompt_engineering"
  title text NOT NULL,
  url text NOT NULL,
  estimated_hours numeric(4,1),
  platform text,                       -- "Coursera", "YouTube", "Official Docs"
  created_at timestamptz DEFAULT now()
);
-- No RLS needed — read-only reference data, no user content
GRANT SELECT ON public.learning_resources TO authenticated, anon;
```

Example milestones:
```
phase 1, week 1: "Start Cursor AI fundamentals course (est. 3 hrs)" → resource_url: "https://cursor.sh/docs/get-started"
phase 1, week 2: "Update LinkedIn headline to reflect AI-augmented work" → resource_url: NULL
phase 2, week 4: "Build one portfolio project using your new skill" → resource_url: NULL
phase 3, week 8: "Apply to 3 roles matching your pivot direction" → resource_url: NULL
```

### 6.4 UI Changes — Defense Tab

The `DefenseTab` is updated to show milestone completion state inline:

```
┌─────────────────────────────────────────────────────┐
│  Your 90-Day Defense Plan             32% complete  │
│  [████░░░░░░░░░░░░░░░] progress bar                 │
│                                                     │
│  Phase 1 — Weeks 1–3: Skill Foundation              │
│  ☑ Start Cursor AI fundamentals course     ✓ Done   │
│  ☐ Update LinkedIn headline               Mark done │
│  ☐ Block 2hrs/week for learning           Mark done │
│                                                     │
│  Phase 2 — Weeks 4–6: Portfolio Building            │
│  ☐ Build one project with new skill       (locked)  │
│  ☐ Share on LinkedIn                      (locked)  │
└─────────────────────────────────────────────────────┘
```

**Phase unlock logic:** Phases 2–4 are locked until the previous phase is ≥50% complete.
- Completion % = `(count of milestones WHERE completed_at IS NOT NULL AND phase = N) / (total milestones WHERE phase = N) * 100`
- Unlocking is frontend-computed on every render from the `defense_milestones` query result.
- There is **no "unmark" flow** in v1 — once a milestone is marked complete, `completed_at` is set and the action is final. This is intentional: the product trusts users to be honest. If this creates abuse (false completions to unlock phases), a v2 audit trail can be added.
- "Mark done" button calls a `PATCH` to `defense_milestones` via Supabase client, setting `completed_at = now()`. Optimistic UI update: mark immediately in local state, roll back if the DB call fails.

### 6.5 Weekly Nudge Email

When a user has incomplete Phase 1 milestones and hasn't opened the app in 7 days, the email queue sends:

> "You said you'd [milestone_label] this week. Here's a 15-minute guide to get started: [resource_url]. You're [X]% through your 90-day plan."
> (If `resource_url IS NULL`, omit the second sentence.)

Uses `pgmq` + `process-email-queue`. New pg_cron job: runs daily at 09:00 IST, checks for users with incomplete milestones + 7 days inactive, enqueues nudge emails.

**Rate limiting / deduplication:** The pg_cron job enforces exactly 1 nudge email per user per 7-day rolling window, regardless of how many phases have incomplete milestones. A new `email_log` entry (already exists from `nurture-emails` infrastructure) with `campaign = "milestone_nudge"` and a `sent_at` timestamp is checked before each enqueue — skip if `sent_at > now() - interval '7 days'`. Users receive at most one email per week from this campaign.

---

## 7. Phase D — Role-Specific Intel Tab

### 7.1 Goal
Replace the current Intel Tab's broadcast news feed (generic AI/market news) with a "signals that affect you" digest. Every piece of market intelligence must be filtered and contextualized against the user's specific role, industry, company, and skill set.

### 7.2 Current State
The Intel Tab renders content from multiple separate edge function calls:
- `CompanyNewsWidget` → `company-news` → generic Tavily news for company
- `LiveMarketWidget` → `live-market` → job posting volume data
- `CompetitiveLandscapeWidget` → `career-landscape` → generic landscape
- `IndustryRiskHeatmap` → aggregated risk data

The content is often generic ("AI is disrupting finance"), not role-specific.

### 7.3 New Architecture — Unified `role-intel` Edge Function

Replace the 4+ individual calls with one `role-intel` edge function that:

1. Takes: `{ role, industry, company, skills[], city, score }`
2. Runs parallel Tavily queries for:
   - Company-specific news filtered for role relevance
   - Hiring trend data for this specific role+city
   - New AI tools in the skill risk matrix for user's top 5 skills
   - Peer salary movement for this role+seniority
3. Scores each signal for **personal relevance** (0–100) based on overlap with user's profile
4. Returns signals sorted by relevance score, each tagged with why it's relevant

Response structure:
```typescript
interface RoleIntelSignal {
  id: string;
  headline: string;
  summary: string;           // 2 sentences
  relevance_score: number;   // 0–100
  relevance_reason: string;  // "Affects your Python automation skills directly"
  signal_type: 'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary';
  action_prompt?: string;    // Optional CTA, e.g., "Add this to your watchlist"
  source_url?: string;
  published_at: string;
}
```

### 7.4 UI Changes — Intel Tab

The existing Intel Tab is redesigned from a grid of widgets to a **ranked signal feed**:

```
┌─────────────────────────────────────────────────────┐
│  Signals affecting Mohit — Senior Data Analyst      │
│  @ Infosys · Bangalore · Updated 2 hrs ago          │
│                                                     │
│  🔴 HIGH RELEVANCE                                  │
│  ┌───────────────────────────────────────────────┐ │
│  │ Infosys launches 4,000-person AI reskilling   │ │
│  │ program — your role category is in scope      │ │
│  │ "Affects your SQL + reporting skills directly"│ │
│  │ [Read more] [Add to watchlist]                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  🟡 MEDIUM RELEVANCE                                │
│  ┌───────────────────────────────────────────────┐ │
│  │ Power BI Copilot now automates 60% of         │ │
│  │ standard reporting tasks                      │ │
│  │ "You listed Power BI as a core skill"         │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  🟢 OPPORTUNITY                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Demand for AI-augmented analysts up 34% in    │ │
│  │ Bangalore Q1 2026. Avg salary: ₹22 LPA        │ │
│  │ "Aligns with your skill pivot direction"      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Caching:** Intel signals are cached in `enrichment_cache` with a 6-hour TTL (matching existing cache pattern). Cache key: `role-intel:{role}:{industry}:{company}:{city}`. Do not re-fetch on every dashboard open. Stale-while-revalidate: show cached signals immediately, refresh in background if TTL > 5 hours elapsed.

**Tavily zero-result fallback:** If all Tavily queries return 0 results (e.g., niche role with no coverage):
1. Return any cached signals from previous fetch, even if stale (show "Signals from [date]" label)
2. If no cache exists, return 2–3 generic fallback signals from the `skill_risk_matrix` table for the user's top skills (no Tavily required — purely from DB)
3. Show a banner: "Live signals unavailable for your role. Showing skill-based insights instead."
4. Never show an empty Intel Tab — always render something useful.

**Signal type vs relevance tier mapping** (resolves the UI/schema ambiguity):
- `signal_type` is the content category: `'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary'`
- `relevance_score` (0–100) maps to a UI display tier: 80–100 = 🔴 HIGH, 50–79 = 🟡 MEDIUM, 20–49 = 🟢 OPPORTUNITY/LOW, <20 = hidden (not shown)
- The color in the UI is derived from `relevance_score`, not `signal_type`

**Watchlist:** Users can "Add to watchlist" any signal. Watchlisted signals are stored **as denormalized JSON** in `intel_watchlist` (no separate canonical signal table needed in v1 — signals are ephemeral and sourced live). Schema:
```sql
CREATE TABLE public.intel_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  signal_json jsonb NOT NULL,   -- full RoleIntelSignal object
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON public.intel_watchlist
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```
Watchlisted signals are surfaced in a collapsible "Your Watchlist" section at the top of the Intel Tab. Watchlist items do not expire (user manually removes them). Max 50 items per user (enforce in frontend before insert).

### 7.5 Deprecate These Widgets
Once `role-intel` is live, the following widgets become redundant and are removed:
- `CompanyNewsWidget` (replaced by signal feed)
- `LiveMarketWidget` (data folded into signal feed)
- `CompetitiveLandscapeWidget` (data folded into signal feed)
- `MonitoringWidget` (functionality replaced by History Tab + watchlist)

---

## 8. Component & File Changes Summary

### New Files
| File | Purpose |
|---|---|
| `src/components/dashboard/ScoreHistoryTab.tsx` | Phase B: score trend chart + scan list |
| `src/components/dashboard/ScoreHistoryChart.tsx` | recharts LineChart for score trend |
| `src/components/dashboard/IntelSignalCard.tsx` | Phase D: individual signal card |
| `src/components/dashboard/IntelWatchlist.tsx` | Phase D: watchlist section |
| `supabase/functions/market-signals/index.ts` | Phase A: consolidated market signal function |
| `supabase/functions/role-intel/index.ts` | Phase D: unified role-specific intel function |
| `supabase/functions/generate-milestones/index.ts` | Phase C: milestone generation on scan complete |
| `supabase/functions/compute-delta/index.ts` | Phase B: async delta summary computation after scan |

### Edge Function Migration Path (Phase A Consolidation)

The 6 market signal functions are consolidated as follows:

1. **Week 1:** Deploy `market-signals` with `signal_type` routing. All old functions remain live.
2. **Week 2:** Update all frontend callers (e.g., `useLiveEnrichment`, `CompanyNewsWidget`, `LiveMarketWidget`) to call `market-signals` instead of individual functions.
3. **Week 3:** Convert old functions to thin proxies that forward to `market-signals` (one-line Deno redirect). This covers any callers missed in step 2.
4. **Week 5 (2 weeks later):** Delete old functions. Log a 404 with a descriptive error message if any stale caller hits a deleted function.

Frontend callers to update:
- `useLiveEnrichment` hook → change invocation target to `market-signals` with `signal_type: "enrich"`
- `CompanyNewsWidget` → `signal_type: "company"`
- `LiveMarketWidget` → `signal_type: "market"`
- `CompetitiveLandscapeWidget` → `signal_type: "landscape"`
- `CareerIntelWidget` (if exists) → `signal_type: "intel"`

### Modified Files
| File | Change |
|---|---|
| `src/components/dashboard/ScoreBreakdownPanel.tsx` | Phase A: add expandable pillar drill-down |
| `src/components/dashboard/CareerGenomeDebate.tsx` | Phase A: add evidence citation parsing + rendering |
| `src/components/dashboard/ResumeWeaponizerWidget.tsx` | Phase A: add "Why this works" annotations |
| `src/components/dashboard/DefenseTab.tsx` | Phase C: add milestone checklist + progress bar |
| `src/components/dashboard/IntelTab.tsx` | Phase D: replace widget grid with signal feed |
| `src/components/JobBachaoDashboard.tsx` | Phase B: add "History" tab |
| `src/components/VerdictReveal.tsx` | Phase A: add methodology preview step |
| `src/components/cards/AITimelineCard.tsx` | Phase A: expandable skill drill-down |
| `src/components/cards/CareerObituaryCard.tsx` | Phase A: remove from free flow, gate behind paywall |
| `supabase/functions/process-scan/index.ts` | Phase B+C: write to score_history + generate milestones |
| `src/App.tsx` | Phase A: remove duplicate `<Toaster />` |

### Deleted Files / Functions
See Section 4.1 for full list of 11 edge functions to delete + 6 to consolidate.

### New Migrations
| Migration | Content |
|---|---|
| `YYYYMMDD_add_delta_summary_to_score_history.sql` | Phase B: add `delta_summary jsonb` column to `score_history` |
| `YYYYMMDD_add_posting_change_pct_to_market_signals.sql` | Phase B: add `posting_change_pct` column to `market_signals` |
| `YYYYMMDD_create_defense_milestones.sql` | Phase C: create `defense_milestones` table with RLS |
| `YYYYMMDD_create_learning_resources.sql` | Phase C: create `learning_resources` reference table + seed data |
| `YYYYMMDD_create_intel_watchlist.sql` | Phase D: create `intel_watchlist` table with RLS |

---

## 9. Success Metrics

| Metric | Baseline | Target (90 days post-launch) |
|---|---|---|
| % of users who scan more than once | ~5% (estimated) | 25%+ |
| Avg sessions per active user per month | ~1.2 | 3+ |
| Defense Plan completion rate (≥1 milestone) | 0% (no tracking) | 40% |
| Email re-engagement open rate | N/A | 35%+ |
| Intel Tab session time | Baseline TBD | +40% |
| Pro conversion rate from free scan | Baseline from analytics | +15% |

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `score_history` population requires all users to be authenticated at scan time | Existing auth flow already required for full report; anon users get limited report only. Score history only written for authed users. |
| `role-intel` edge function latency (Tavily + LLM synthesis) | Cache with 6-hour TTL. Show stale-while-revalidate spinner. Phase D signals are non-blocking — load Intel Tab immediately with cache, refresh in background. |
| Milestone generation adds latency to scan completion | Generate milestones async after scan write. Do not block `process-scan` response. Use existing pgmq queue. |
| Consolidating 6 edge functions into 1 could break existing callers | Audit all frontend callers before deletion. Add a 2-week deprecation period where old functions proxy to the new one. |
| Career Obituary move behind paywall reduces virality | Compensate with new shareable "Score Card" (score + confidence interval + one-line verdict) as the free viral unit. |

---

*End of spec. Awaiting review and approval before implementation plan is written.*
