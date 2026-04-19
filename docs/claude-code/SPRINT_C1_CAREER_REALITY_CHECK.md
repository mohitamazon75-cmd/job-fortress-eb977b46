# SPRINT_C1_CAREER_REALITY_CHECK.md
# The 8th Intelligence Card — Career Reality Check

## 0. Scope + ship target

**What:** Add an 8th card to the existing JobBachao scan output titled "Career Reality Check."

**For:** Indian IT software developers, 2-6 years experience, roles: full-stack / backend / frontend / mobile / DevOps / data.

**Ship target:** Working feature in production within 7 days. Must coexist with the 7 existing cards; zero regression to those.

**Definition of done:**
1. New edge function career-reality-check deployed + invoked as part of scan pipeline
2. New React card component rendering after existing 7 cards
3. Intake micro-flow (5 questions, 4 taps + 1 optional text) integrated into existing scan flow
4. Three-act output renders with real Naukri + GitHub + Ambitionbox data (or falls back gracefully)
5. Share image generation works
6. Feature flag allows toggling the card on/off without deploy
7. No user-visible regression to the existing 7 cards
8. Failure mode (data unavailable) returns a graceful, honest fallback — never a broken card

## 1. User-facing flow

After the existing 7 intelligence cards render, the user sees Card 8.

Top header: "Career Reality Check — Your Position in the Indian IT Market"

Below the header, a 5-question intake micro-flow renders inline if user hasn't already completed it. They tap through it in ~45 seconds. After submission, three acts render:

- Act 1 — Market Position
- Act 2 — The Five Silent Gaps
- Act 3 — The Share Moment

## 2. Intake flow (5 questions)

Rendered as a single-screen micro-form. All optional-to-skip (skipping degrades output quality but doesn't block).

### Q1 — Tools used in production in last 12 months (checkbox, multi-select)
Dynamically populated from Naukri data for their detected role. Example for JS full-stack: React/Next.js, TypeScript, Node.js/Express, GraphQL, PostgreSQL/MySQL, MongoDB, Redis, Docker/Kubernetes, AWS/GCP/Azure, GitHub Actions/CI-CD, Tailwind/shadcn, "None of these — be honest".

### Q2 — AI coding tools actually used (checkbox, multi-select)
Copilot, Cursor, Claude Code/Claude, ChatGPT for code, Gemini Code Assist, v0/Lovable/Bolt, "I've tried them but don't use daily", "Haven't used any".

### Q3 — Your last commit to any public/work repo was… (single-select)
This week / This month / This quarter / 6-12 months ago / Over a year ago / I don't really use git outside work.

### Q4 — Your job primarily involves… (single-select)
Writing new features end-to-end / Maintaining legacy systems / Integrations-API work / Debugging-incident response / Mostly meetings + reviews / Mixed.

### Q5 — One thing you've been putting off learning (optional, free text, 1 line)
Placeholder: "e.g., Next.js server components, Kubernetes, system design interviews…"

**Design requirement:** All questions on one screen for desktop, stacked for mobile. Submit button disabled until Q1-Q4 answered (Q5 optional). Thumb-reachable on mobile.

## 3. Data sources + fetch strategy

### 3.1 Naukri (primary market-state source)
- **What:** Job postings matching user's detected role + city + experience
- **How:** Firecrawl search on naukri.com with query like "full stack developer" "bengaluru" "2-6 years"
- **Extract per posting:** required skills, tech stack, salary band (if listed), company, posted date
- **Target:** 100-300 postings per query, filtered to last 30 days
- **Cache key:** naukri:{role}:{city}:{exp_band} — TTL 7 days
- **Cost budget:** ~50 Firecrawl credits per unique cohort, cached across users

### 3.2 GitHub (user signal + peer signal)
- **User signal:** If user provided GitHub URL, fetch profile via GitHub public API (use GITHUB_TOKEN for 5000/hr rate limit)
- **Extract:** repos, languages-by-bytes, last commit date, stars given, PRs to other repos, contribution graph density
- **Peer signal:** pool anonymized GitHub data from other users in their cluster (activates at 20+ scans)
- **Cache:** user GitHub data 24h, peer cluster aggregates 7 days

### 3.3 Ambitionbox (salary grounding)
- **What:** Salary ranges for user's exact role + city + experience
- **How:** Firecrawl scrape of ambitionbox.com/salaries/{role}-salary
- **Extract:** median, 25th percentile, 75th percentile, 90th percentile salary
- **Cache key:** ambitionbox:{role}:{city}:{exp_band} — TTL 30 days
- **Fallback:** Glassdoor India via Firecrawl

### 3.4 Internal scan database (peer layer, activates at critical mass)
- Every completed scan writes (role, city, exp_band, tools_known, commit_recency, ai_tools_used) into cohort_data table
- When new scan runs, query cohort_data for matching (role, city, exp_band)
- If count >= 20: compute peer cohort aggregates for Act 1
- If count < 20: show market-only Act 1 with "Peer benchmarking unlocks at 20 scans in your cohort — currently {N}" message

### 3.5 Fetch orchestration
All four sources fetched in parallel, async, moment user starts intake. By submit, data is ready. Use existing scan-engine orchestration patterns. 15-second soft timeout per source; card renders with whatever data landed.

## 4. Three acts — detailed spec

### Act 1 — Market Position (always shows)

Vertical card with 3 sub-sections.

**1.1 Your Stack vs. The Market**
Horizontal bar chart. Each bar = a skill from Q1. Bar length = frequency in Naukri postings for cohort. Two colors: green (user has, market wants), amber (market wants, user lacks). Headline: "Of 247 [full-stack dev] postings in Bengaluru this month, here's how your stack overlaps."

**1.2 Your Cohort Position**
If peer cohort active (20+ scans): "Of {N} [full-stack devs with 2-6 years exp in Bengaluru] who've taken this scan, you rank in the bottom {X}% on modern-stack adoption."
If not active: "Peer benchmarking unlocks at 20 scans in your cohort. Current count: {N}. Invite others at your level to accelerate unlock." [Share referral link button]

**1.3 Salary Reality**
Horizontal bar showing Ambitionbox salary percentiles with a marker for user's estimated band (from stack match). Headline: "Your current stack maps to the 35th salary percentile for your role in Bengaluru. Top 10% adds {X, Y, Z} to the stack below."

### Act 2 — The Five Silent Gaps

List of exactly 5 items. Each is a skill/tool that:
1. Appears in >=60% of Naukri postings for cohort
2. Was NOT checked by user in Q1 or Q2
3. Has been trending upward in postings over last 6 months

For each gap:
- Name
- "Found in [X] of [Y] recent [role] postings in [city] ([percentage]%)"
- "Appeared in postings [X]% more this quarter than last"
- "Why it matters: [one specific sentence — LLM-generated but grounded in posting data]"
- "Learn in ~20 minutes: [link to specific, vetted tutorial/doc]"

The "20-minute learn" link:
- Must be real, working URL (validate before ship)
- Curated manually for v1 — ship with ~50 pre-vetted links
- Stored in learning_resources table, indexed by skill name
- Fallback: Google search URL with pre-crafted query

### Act 3 — The Share Moment

Auto-generated 1080x1080 PNG, renders below Act 2.

Content:
- "JOB BACHAO — Career Reality Check"
- [User's role] · [City] · [Exp] years
- "Of 247 postings hiring for your role this month, your stack matches 43%."
- "Top 3 missing: • [Gap 1] • [Gap 2] • [Gap 3]"
- "Take your own check → careerrealitycheck.jobbachao.in"

Design: dark background, high contrast, numbers are visual focus. No PII beyond what user shared. Download button + WhatsApp share button.

Implementation: html2canvas or server-side via Satori-equivalent in Deno edge function. Generate on-demand, cache 7 days per user.

## 5. Failure modes + fallbacks

Every data source has a fallback. Card must never break.

- **Naukri fails:** Use cached data from nearest matching cohort. If still nothing: show Act 1 with "Market data temporarily unavailable" but still show Act 2 based on user intake vs. static "known good" skill list.
- **GitHub fails:** Skip GitHub insights silently; note "GitHub signal not available — add GitHub URL to profile to strengthen future scans".
- **Ambitionbox fails:** Glassdoor India fallback. If both fail, omit sub-section 1.3.
- **Internal cohort < 20 scans:** Show "unlocks at 20" message (designed for this).
- **All 4 fail:** "Your market data will populate once scrapers refresh — check back in 1 hour." Skip to Act 2 using pure intake data.
- **LLM copy fails:** Static fallback template.
- **Share image fails:** Text-only share with generic template.

**Golden rule:** Card always renders something honest. Never a spinner. Never an error. Never fake data.

## 6. Copy standards (tough love, not abusive)

New file: docs/claude-code/COPY_STANDARDS.md

Rules:
1. Describe data, don't judge the person
2. Integer counts > percentages when under 20
3. Name specifics
4. Time-bound everything
5. Never use: "failing," "falling behind," "you should," "you need to," "obsolete," "irrelevant," "lazy," "missed," "too late"
6. Allowed tough-love phrases: "statistically closer to," "trending away from your profile," "below median for your cohort," "has not appeared in your stated stack," "hasn't been updated in {time}"
7. End every harsh framing with an actionable

## 7. Feature flag + rollout

- Feature flag: enable_career_reality_check in feature_flags table
- Default: false for all users
- Turn on for: 10 whitelisted test users (by email)
- After 3 days stable: flip to 25% of new scans
- After 7 days: 100% if no regressions

Flag checked in frontend (hide card) AND edge function (skip fetch, save cost).

## 8. Implementation tasks — exact execution order

### Task 1 — Database schema (day 1, ~2 hours)
- Migration: cohort_data table (user_id, role, city, exp_band, tools, commit_recency, ai_tools_used, created_at)
- Migration: learning_resources table (skill_name, resource_url, resource_title, resource_duration_min, curated_at)
- Migration: feature_flags table (flag_name, enabled_for_user_ids, enabled_percentage)
- Migration: add career_reality_check_data JSONB column to scans table
- RLS policies per CLAUDE.md conventions
- Seed learning_resources with 50 curated links (manual)

### Task 2 — Firecrawl orchestration edge function (day 1-2, ~6 hours)
- fetch-cohort-market-data edge function
- Inputs: role, city, exp_band
- Parallel fetch: Naukri + Ambitionbox
- Returns normalized JSON
- Caches in cohort_market_cache (new table) with 7-day TTL
- Unit tests for cache, parse

### Task 3 — GitHub profile fetch edge function (day 2, ~3 hours)
- fetch-github-signal edge function
- Input: GitHub username
- GitHub REST API v3 with GITHUB_TOKEN
- Extracts: repo count, top 5 languages, last commit, stars given, external PR count
- Cache 24h

### Task 4 — Career Reality Check orchestrator edge function (day 2-3, ~6 hours)
- career-reality-check edge function
- Called after existing 7-card scan completes
- Pulls from all 4 sources via tasks 2+3+internal query
- Computes: stack match %, peer percentile (if >=20), top 5 gaps, Act 3 share data
- Writes to scans.career_reality_check_data
- Handles all failure modes
- Unit tests for each failure mode

### Task 5 — Intake micro-flow component (day 3, ~4 hours)
- CareerRealityCheckIntake.tsx
- 5 questions, mobile-first, thumb-reachable
- Writes via existing scan-update endpoint
- Triggers orchestrator on submit

### Task 6 — Card render component (day 3-4, ~6 hours)
- CareerRealityCheckCard.tsx
- Renders Act 1 + 2 + 3 using scans.career_reality_check_data
- Existing design system + Framer Motion patterns
- Graceful loading states
- Copy reviewed vs COPY_STANDARDS.md

### Task 7 — Share image generation (day 4, ~4 hours)
- generate-reality-check-share-image edge function
- html2canvas server-side equivalent or Satori (Deno-compatible — investigate)
- PNG URL
- Cache 7 days per scan
- WhatsApp share intent on frontend

### Task 8 — Feature flag infrastructure (day 4, ~2 hours)
- useFeatureFlag('enable_career_reality_check') hook
- Edge function respects same flag
- Admin toggle via Supabase directly for v1

### Task 9 — Integration + smoke tests (day 5, ~4 hours)
- E2E: new user → scan → card renders → share works
- Failure mode tests: each source down, all down
- Performance: P95 card render < 20s

### Task 10 — Whitelist 10 users + monitor (day 5-7)
- Collect 10 IT dev emails (mixed roles, cities)
- Enable flag
- Monitor 3 days via Supabase logs + feedback
- Iterate Act 2 copy based on real output

## 9. Manual curation task — 50 learning resources

Before task 1 completes, Google Sheet with 50 rows:
- Skill name (matches Naukri normalization)
- Resource URL (free, specific, high-quality)
- Resource title
- Minutes to "I can use this in a project"

Priority 50: React, Next.js, TypeScript, Node.js, GraphQL, REST API design, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, AWS basics, CI/CD with GitHub Actions, Jest/Vitest, Playwright, TailwindCSS, shadcn/ui, Framer Motion, Zustand, TanStack Query, Prisma, Drizzle, Supabase, tRPC, Vercel deployment, Cloudflare Workers, System design basics, DSA refresher, LeetCode patterns, Behavioral interview frameworks, Copilot/Cursor workflows, Claude Code basics, LangChain basics, RAG patterns, Vector DBs (Pinecone/Qdrant), Prompt engineering, Fine-tuning basics, WebSockets, SSE, gRPC, Terraform, Observability (Datadog/Sentry), OpenTelemetry, Feature flagging, Authentication (Clerk/Auth0/Supabase Auth), Payment integration (Razorpay/Stripe), Webhooks, Rate limiting, Caching strategies, Database indexing.

Ship with 20, add 30 more week 2.

## 10. Out of scope for this sprint

- Non-IT roles (PM, marketing, finance, HR) — separate sprint
- LinkedIn scraping / paid LinkedIn API — separate decision post-launch
- Peer cohort visualization beyond text — v2
- Multi-city pan-India views — v2
- Notifications for rank changes — v2
- Paid tier gating — post-launch
- Modifying existing 7 cards — FORBIDDEN per CLAUDE.md Rule 3

## 11. Success metrics (post-ship)

- % scans completing Career Reality Check intake
- Median time-in-card
- Share rate (download or WhatsApp)
- Return rate (opened learning resource link)
- 24h return rate post-scan
- "Wow" survey at 24h: "On 1-10, how surprising or useful?"

v1 targets:
- Intake completion: >=60%
- Share rate: >=20%
- Learning resource CTR: >=30%
- Wow survey median: >=7

Hit all four = lean into this for next investor update.
