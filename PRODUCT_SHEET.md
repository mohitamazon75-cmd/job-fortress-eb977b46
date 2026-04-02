# JobBachao — Product Sheet
### AI Career Safety Intelligence Platform
*Last updated: March 2026*

---

## 🎯 What It Is

JobBachao is an AI-powered career risk intelligence platform that gives professionals a real-time "Career Position Score" — a deterministic, explainable assessment of how exposed their job is to AI automation, with actionable defense strategies. Think credit score, but for career safety.

**Live URL:** https://job-fortress.lovable.app

---

## 🏗️ Architecture Overview

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Lovable Cloud (Supabase) — Edge Functions (Deno), PostgreSQL, Auth, Storage |
| AI Models | Lovable AI gateway (Gemini 2.5 Flash/Pro, GPT-5-mini) — zero API keys needed |
| Live Data | Tavily Search API for real-time market intelligence |
| Payments | Razorpay (₹499 per scan / ₹1,999 yearly Pro) |
| Auth | Supabase Auth with email verification, session recovery |

---

## 📊 Core Scoring Engine

### Career Position Score™ (0–100)

**File:** `src/lib/stability-score.ts`

A weighted composite of 5 deterministic pillars — no LLM involved in scoring:

| Pillar | Weight | Source |
|--------|--------|--------|
| AI Resistance | 30% | `100 - automation_risk` from Knowledge Graph skill matching |
| Market Position | 25% | Market percentile from job posting analysis |
| Human Edge (Moat) | 20% | Count of moat skills × 12, capped at 100 |
| Income Stability | 15% | Inverse of salary bleed rate |
| Seniority Shield | 10% | Tier-based lookup (EXEC=85, SENIOR=70, MGR=55, PRO=40, ENTRY=25) |

**Formula:** `clamp(5, 95, weighted_sum)`

### Deterministic Scan Engine

**File:** `src/lib/scan-engine.ts` (619 lines)

Processes scan via edge function `process-scan`:
1. **Skill Extraction** — Parses LinkedIn profile or resume into structured skill arrays
2. **Knowledge Graph Matching** — Maps skills against `skill_risk_matrix` table (147 skill vectors across 95 job families)
3. **Score Computation** — 48+ algorithms including salary bleed, obsolescence timeline, survivability score
4. **Market Signal Overlay** — Enriches with `market_signals` table data (posting volume, AI mentions, salary trends)

### Unified Skill Classifier

**File:** `src/lib/unified-skill-classifier.ts`

Single source of truth for categorizing every skill as:
- **Automated** (risk ≥ 75%) → Action: "Learn the tool"
- **At-Risk** (risk 40-74%) → Action: "Augment" or "Reduce exposure"
- **Safe** (risk < 40%) → Action: "Double down"

Maps risk to estimated months until impact: 85%+ → 6 months, 70%+ → 12 months, 55%+ → 24 months, etc.

---

## 🃏 12-Card Report Flow (Shock-to-Action Arc)

### Card 1: What This Means For You
**File:** `src/components/cards/JobSafetyCard.tsx` (408 lines)

- **Type:** Deterministic + Live enrichment
- **Logic:** Narrative summary using `getVibe()` function that selects tone (🛡️ Looking Good → 🚨 Act Now) based on stability score
- **Features:**
  - AIRMM™ Framework visualization (projected gains vs current state)
  - Intelligence Profile showing KG matches
  - Live AI Tools Competing module — real-time Tavily search for tools threatening the user's specific role in the last 30 days
  - Replaceability Index with adoption level indicators
- **Data sources:** `computeStabilityScore()`, `useLiveEnrichment()` hook, KG skill adjustments

### Card 2: Intelligence Map (Knowledge Graph)
**File:** `src/components/cards/KGPeerCard.tsx` (314 lines)

- **Type:** 100% deterministic
- **Logic:** Interactive node-based visualization of the user's skill graph
- **Features:**
  - Skills plotted as nodes color-coded by risk (safe/at-risk/automated)
  - Peer role comparison showing adjacent job families from `pivot_roles`
  - Skill-to-tool threat mapping with tool names
  - Expandable nodes showing detailed risk data
- **Data sources:** `classifySkills()` from unified classifier, `normalizeTools()`, `score_breakdown.skill_adjustments`

### Card 3: AI Timeline
**File:** `src/components/cards/AITimelineCard.tsx` (115 lines)

- **Type:** 100% deterministic
- **Logic:** Maps each user skill to an estimated automation timeline
- **Features:**
  - Summary badges: Already Automated / Augmentation Zone / Human-Only counts
  - Sortable skill table with When (< 6 months to 7+ years), Risk %, and action tags
  - Earliest impact callout
  - Data provenance footer (KG skills matched, AI tools tracked, source type)
- **Data sources:** `classifySkills()`, `riskToMonths()` mapping

### Card 4: Best-Fit Jobs
**File:** `src/components/cards/BestFitJobsCard.tsx`

- **Type:** LLM + Live search
- **Logic:** Parallel Tavily searches across job platforms → Gemini 3-Flash ranking
- **Features:**
  - Real-time job listings with direct apply links
  - Skill match % and AI safety score per listing
  - Personalized "Why apply" explanations
  - Fallback: industry-based pivot role suggestions when search results are limited
- **Edge function:** `best-fit-jobs`

### Card 5: Resume Weaponizer
**File:** `src/components/cards/ResumeWeaponizerCard.tsx`

- **Type:** LLM-powered
- **Logic:** Rewrites resume using STAR method, optimized for ATS and AI-era positioning
- **Features:**
  - Copyable professional summary and experience bullets
  - ATS score transformation (Before vs After %)
  - Addresses specific skill gaps identified in the scan
- **Edge function:** `resume-weaponizer`

### Card 6: Interview Cheat Sheet
**File:** `src/components/cards/InterviewCheatSheetCard.tsx` (165 lines)

- **Type:** LLM-powered
- **Logic:** Generates role-specific interview preparation materials
- **Features:**
  - AI Tools to Mention — top 5 tools with trending signal badges (viral/surging/emerging/sleeper)
  - Keywords to Drop — buzzwords with hover definitions
  - Weekend Homework — curated book/video/course/blog recommendations with direct links
- **Edge function:** `cheat-sheet`

### Card 7: Defense Plan
**File:** `src/components/cards/DefensePlanCard.tsx` (182 lines)

- **Type:** Deterministic + scan data
- **Logic:** Generates a 90-day action roadmap from scan signals
- **Features:**
  - 4-phase milestone path: Week 1-2 (tool mastery) → Week 3-4 (moat building) → Month 2-3 (market positioning) → Month 3+ (career expansion)
  - Judo Strategy — turning AI threats into personal advantages
  - Market position intelligence with demand trends
  - Skill gap prioritization
- **Data sources:** `immediate_next_step`, `judo_strategy`, `market_position_model`, `score_breakdown`

### Card 8: Career Genome Sequencer (AI Debate)
**File:** `src/components/dashboard/CareerGenomeDebate.tsx`

- **Type:** Multi-agent LLM (SSE streaming)
- **Logic:** Adversarial 3-agent courtroom debate:
  - 🔴 **Prosecutor** — identifies career vulnerabilities
  - 🟢 **Defender** — highlights human moats and unique strengths
  - ⚖️ **Judge** — delivers final Trajectory verdict (ASCENDING / STABLE / DECLINING / CRITICAL)
- **Features:**
  - Real-time evidence injection via Tavily when agent scores diverge by >20 points
  - Full reasoning chain streamed to UI via SSE
  - 3 actionable "Surgical Steps" at conclusion
- **Edge function:** `career-genome`

### Card 9: Skill Repositioning
**File:** `src/components/cards/SkillRepositioningCard.tsx` (227 lines)

- **Type:** 100% deterministic, zero LLM calls
- **Logic:** Transforms existing skills into AI-era-optimized resume language
- **Features:**
  - Before → After skill framing with role-specific action verbs
  - Verb pools mapped to 8 industry categories (engineering, finance, marketing, etc.)
  - Quantitative placeholders and "why this framing" explanations
  - Stable hash function ensures consistent output across renders
  - Copy-to-clipboard for each reframed bullet
- **Data sources:** `score_breakdown.skill_adjustments`, `moat_skills`, seniority tier

### Card 10: Safer Career Pivot Engine
**File:** `src/components/cards/CareerPivotCard.tsx` (365 lines)

- **Type:** LLM-powered
- **Logic:** Analyzes user profile against adjacent and stretch career paths
- **Features:**
  - Adjacent (easy) and Stretch (hard) pivot recommendations
  - Per-pivot: skill match %, salary delta, transition difficulty, AI safety score
  - Skill gap breakdown with learning time estimates and salary unlock amounts
  - Expandable detailed view per recommendation
- **Edge function:** `run-pivot-analysis`
- **Types:** `src/types/pivot-engine.types.ts`

### Card 11: Career Obituary
**File:** `src/components/cards/CareerObituaryCard.tsx`

- **Type:** LLM-powered
- **Logic:** Generates a dramatic newspaper-style "obituary" for the user's current career trajectory
- **Features:**
  - Viral-shareable format designed for social engagement
  - Prefetched during card flow for zero-wait reveal
  - Tone calibrated to scan severity
- **Edge function:** `career-obituary`

### Card 12: Share & Export
**File:** `src/components/cards/ShareExportCard.tsx` (179 lines)

- **Type:** Deterministic
- **Logic:** Generates shareable content and handles distribution
- **Features:**
  - WhatsApp sharing with pre-composed text
  - LinkedIn post generator with professional framing
  - Challenge a Colleague — generates unique challenge codes stored in `challenges` table
  - Copy link functionality
  - Share URL format: `/share/{scanId}`

---

## 🧩 Major Standalone Features

### Verdict Reveal (Score Presentation)
**File:** `src/components/VerdictReveal.tsx` (492 lines)

- Animated score reveal with spring physics
- Plain-English verdict in 4 tiers with Hindi/Hinglish "Papa Explanation"
- Score waterfall decomposition (5 pillars)
- Personalized verdict using `getVerbatimRole()` — never shows internal role mappings

### Side Hustle Generator
**File:** `src/components/SideHustleGenerator.tsx` (798 lines)

- 4-slot opportunity engine:
  1. AI-Native / Scalable opportunity
  2. Service / Community play
  3. Lateral Wildcard (amber badge)
  4. Mind-Bending slot (violet/fuchsia, 🧠 badge)
- Benchmarked against 2026-era tools (GPT-5, Claude 4)
- Trust Messages focused on transferable skill primitives
- **Edge function:** `generate-side-hustles`

### AI Impact Dossier
**File:** `src/components/AIDossierReveal.tsx`

- Dynamic Profiling Engine: categorizes users as Apex / Co-Pilot / Vulnerable
- Enforces Current Role Primacy and Strict Numeric Evidence Policy
- Premium prose style with custom gradients and color-coded score badges
- **Edge function:** `ai-dossier`

### Career Resilience Engine
**File:** `src/components/dashboard/CareerResilienceEngine.tsx`

- MTAI (Micro-Task AI) bar chart: Defensible vs Transition tasks
- Calm vs Ambitious mode toggle
- Defensibility Slider to simulate skill-gain impact
- "Your Next Move" synergy roadmap

### RiskIQ Assessment
**Files:** `src/components/riskiq/` (6 files)

- Alternative assessment flow with industry/role matching
- Searchable combo box for role selection
- Animated analyzing state → dashboard reveal
- **Edge function:** `riskiq-analyse`

---

## 🛡️ Platform Infrastructure

### Authentication & Security
- Supabase Auth with email verification (no auto-confirm)
- Session recovery via `onAuthStateChange` listener (replaced 2s polling)
- Role-based access via `user_roles` table with `has_role()` security definer function
- RLS policies on all tables

### Subscription & Monetization
- **Files:** `src/hooks/use-subscription.ts`, `src/components/PremiumGate.tsx`
- Free tier: Full scan + top 3 skill analysis + basic action plan
- Pro tier (₹1,999/yr): Full skill breakdown, AI Dossier, Side Hustles, Weekly Briefs, PDF export
- Per-scan (₹499): One-time deep scan
- Razorpay webhook: `supabase/functions/razorpay-webhook/index.ts`

### Data Layer
| Table | Purpose |
|-------|---------|
| `scans` | Core scan results + enrichment cache |
| `profiles` | User profiles with subscription tier |
| `skill_risk_matrix` | 147 skills with automation risk, replacement tools, demand trends |
| `job_taxonomy` | 95 job families with disruption baselines |
| `market_signals` | Real-time job posting data by metro tier |
| `score_history` | Longitudinal score tracking |
| `challenges` | Colleague challenge codes |
| `weekly_briefs` | Cached weekly intelligence briefs |
| `scan_feedback` | User accuracy/relevance ratings |

### Edge Functions (31 deployed)
| Function | Purpose |
|----------|---------|
| `process-scan` | Core scan orchestration |
| `ai-dossier` | Strategic AI impact dossier |
| `best-fit-jobs` | Live job search + ranking |
| `career-genome` | Multi-agent debate (SSE) |
| `career-obituary` | Viral obituary generation |
| `cheat-sheet` | Interview preparation |
| `resume-weaponizer` | ATS-optimized resume rewrite |
| `generate-side-hustles` | 4-slot opportunity engine |
| `run-pivot-analysis` | Career pivot recommendations |
| `live-enrich` | Real-time market enrichment |
| `live-market` | Job market data |
| `company-news` | Company-specific intelligence |
| `skill-arbitrage` | Skill value arbitrage analysis |
| `panic-index` | Market-wide panic index |
| `generate-weekly-brief` | Weekly intelligence digest |
| `chat-report` | Conversational report Q&A |
| `kg-expand` / `kg-refresh` | Knowledge graph operations |
| `parse-linkedin` / `parse-resume` | Input parsing |
| `admin-dashboard` | Admin analytics |
| `monitoring-dashboard` | System health |

### Observability
- `edge_function_logs` table for error tracking
- `daily_usage_stats` for per-function call counts and latency
- `monitoring_alerts` with severity levels
- Token tracking via `_shared/token-tracker.ts`
- Spending guard via `_shared/spending-guard.ts`

### Anti-Abuse
- Rate limiting: `scan_rate_limits` table + `_shared/scan-rate-limiter.ts`
- Abuse guard: `_shared/abuse-guard.ts`
- Chat rate limits: `chat_rate_limits` table
- Rate limit upsell: `src/components/RateLimitUpsell.tsx`

---

## 📐 Design System

- **Theme:** Dark-first with semantic HSL tokens (`--prophet-green`, `--prophet-gold`, `--prophet-cyan`)
- **Typography:** System font stack with heavy use of `font-black` for emphasis
- **Animations:** Framer Motion throughout — spring physics, staggered reveals, slide transitions
- **Responsive:** Mobile-first, tested at 1106×754 viewport
- **i18n:** English + Hindi/Hinglish toggle (`src/lib/i18n.ts`, `src/hooks/use-locale.ts`)

---

## 📈 Key Metrics (by design)

| Metric | Mechanism |
|--------|-----------|
| Activation | 12-card sequential flow forces full engagement |
| Virality | WhatsApp share, LinkedIn post, Challenge a Colleague, Career Obituary |
| Retention | Weekly briefs, score history tracking, re-scan with delta |
| Monetization | PremiumGate on high-value cards, RateLimitUpsell on scan limits |
| Trust | DataProvenance badges on every card showing deterministic computation proof |

---

*Built with Lovable · Powered by Lovable Cloud*
