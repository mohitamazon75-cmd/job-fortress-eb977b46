# 02 — New IP Roadmap (Post-Stabilization)

> This sprint is GATED on completion of `01_STABILIZATION_SPRINT.md` AND the product reaching 100+ paying users. Do not start any work here until both conditions are met.

The goal of this phase is not to add features — the product has enough. The goal is to build **three specific data/IP layers that competitors (Naukri, LinkedIn, Apna) cannot replicate without years of effort**, while ensuring every new addition compounds existing IP rather than duplicating it.

---

## The three new IP layers (in priority order)

### IP Layer 1 — Longitudinal Scoring (highest leverage, lowest risk)

**What it is**: Every scan already writes to `scans` and `score_history`. Right now these are just logs. Turn them into a **longitudinal career trajectory dataset** — the first of its kind in India.

**Why this is the right first move**:
- Zero new user-facing features needed (no training required)
- Compounds from day one: every existing user contributes data
- Existing schema already supports it (`score_history`, `scan_feedback`, `capture-outcome` function)
- Becomes a proprietary, non-replicable asset that grows monotonically

**What Claude Code would build**:
1. `compute-delta` edge function already exists. Verify it produces real signal: score change over time, skill-addition impact, market-signal-driven delta.
2. New edge function `career-trajectory` that consumes a user's full `score_history` and produces: trajectory classification (ASCENDING / STABLE / DECLINING / VOLATILE), velocity (score change per month), pivot-events-detected.
3. New DB view `v_user_cohort_trajectory` that aggregates trajectories across cohorts (by role, by city, by experience level) — this is the raw material for the Enterprise API.
4. New admin dashboard tab: "Trajectory Analytics" showing distributions.

**Out of scope for v1**:
- Predicting future scores (ML model — Phase 4+)
- Publishing a public "India AI Disruption Index" (PR play — requires legal + comms)

**Effort**: 2–3 weeks.

**Acceptance criteria**:
- Every user with ≥2 scans has a computed trajectory
- Cohort views render with ≥3 months of data
- Admin can export cohort CSV for enterprise pilots

---

### IP Layer 2 — WhatsApp Career Agent (highest user-facing value in India)

**What it is**: A WhatsApp-native continuous coach using Meta's WhatsApp Business API + the existing AI Coach backend.

**Why this slot is genuinely new**:
- No equivalent exists in the current codebase (AI Coach is web-only)
- WhatsApp is how India communicates — a web chat is a distant second
- Sticky: users who set up WhatsApp never go back to web

**What Claude Code would build** (phased):

**Phase 2a — inbound only** (2 weeks)
- Meta WhatsApp Cloud API integration (no Twilio dependency — cost matters)
- Edge function `whatsapp-inbound` → routes to existing AI Coach logic
- User phone number linking via OTP from the web app
- Hindi + English auto-detection (existing i18n logic extends naturally)

**Phase 2b — outbound nudges** (2 weeks)
- Weekly check-in templates (Meta-approved templates required)
- Score-change alerts when `compute-delta` detects significant change
- Job-match alerts from `best-fit-jobs` (opt-in)
- Rate-limited per DPDP Act 2023 requirements

**Phase 2c — memory** (2 weeks)
- Long-term memory per user: vector store of past conversations + structured career facts
- Agent can reference: last scan, goals captured in `GoalCaptureModal`, previous pivots discussed
- Privacy-first: user can wipe memory with a single command

**Critical extension principles**:
- Reuse existing `ai-dossier`, `cheat-sheet`, `run-pivot-analysis`, `career-obituary` — do not rebuild intelligence in the WhatsApp layer
- WhatsApp agent is a **channel** for existing IP, not a new IP silo

**Out of scope for v1**:
- Voice messages (phase 3+)
- Vernacular beyond Hindi + English (phase 3+)
- Proactive outreach to non-users (compliance hell)

**Effort**: 6–8 weeks.

**Acceptance criteria**:
- 500+ users opted into WhatsApp
- D30 retention of opted-in users ≥ 40%
- Average 3+ messages per active user per week
- DPDP compliance review passed

---

### IP Layer 3 — TrustScore Micro-Assessments

**What it is**: 3–5 minute gamified skill probes that produce verified competency scores attached to user profiles. The precursor to a real employer-facing verification product.

**Why this is genuinely new**:
- Nothing in the current codebase verifies skills — it all relies on self-reporting
- Adds a new input signal that makes every other scoring output more accurate
- Opens a future B2B line (employer verification)

**What Claude Code would build** (phased):

**Phase 3a — probe engine** (3 weeks)
- New tables: `skill_probes`, `probe_attempts`, `user_trust_scores`
- Top 20 skills selected from `skill_risk_matrix` by demand × risk (SQL, Python, written English, spoken English, Excel, data viz, customer handling, sales pitch, project planning, negotiation, client email, cold outreach, prompt writing, debugging, code review, API design, unit testing, product spec writing, competitive analysis, financial modeling)
- 50+ probe items per skill, LLM-generated, human-reviewed
- Adaptive difficulty via simple IRT-style logic (no ML model in v1)

**Phase 3b — frontend integration** (2 weeks)
- New card (#13) in the flow: "Prove Your Score" — prompts users to verify their top 3 skills via probes
- User profile page shows earned TrustScores with badges
- Shareable TrustScore cards (extends existing share-card component)

**Phase 3c — employer pilot** (4 weeks, mostly non-code)
- Partnership conversations with 3–5 SMB employers
- B2B dashboard showing candidate pool filtered by TrustScore
- Paid per-screen pilot pricing

**Anti-cheating measures (ship in v1, not as afterthought)**:
- Browser focus detection (signal only, not blocking)
- Randomized item order per attempt
- Attempt throttling per skill per user
- Observation window: 24h before re-attempt

**Out of scope for v1**:
- Proctoring via webcam (legal + UX minefield)
- Scoring calibration against real-world job performance (requires year+ of data)
- Peer/employer endorsement (phase 4)

**Effort**: 8–10 weeks including pilot.

**Acceptance criteria**:
- 20 skills with ≥50 validated probe items each
- 1,000 users completed at least one probe
- 3 employer pilots signed (even unpaid)
- IRT analysis confirms difficulty calibration holds

---

## What we are explicitly NOT building

These were in earlier strategy proposals. They're wrong for this codebase and this stage.

| Proposed | Reason to skip |
|---|---|
| Chrome extension for behavioral telemetry | Low Indian adoption; privacy-hostile; existing data sources are richer |
| Career Insurance | IRDAI regulated; needs insurance carrier partnership; year-3 at earliest |
| Reverse Job Board | Requires employer behavior change; needs 10x scale first |
| Digital AI Twin for interviews | Trust/legal minefield; unclear ROI |
| Full job marketplace | Naukri already wins; commoditized; not our moat |
| Blue-collar expansion | Apna's territory; different product; would split focus |
| "Skill Futures Market" | Too novel; regulatory risk; distraction |

## How each IP Layer extends existing code (not replaces)

| New IP | Extends | Does NOT duplicate |
|---|---|---|
| Longitudinal Scoring | `score_history`, `scans`, `compute-delta`, `capture-outcome` | Not a new scoring engine — uses existing outputs |
| WhatsApp Agent | `ai-dossier`, `cheat-sheet`, `run-pivot-analysis`, Gemini gateway, i18n | Not a new LLM layer — new channel for existing intelligence |
| TrustScore | `skill_risk_matrix`, `unified-skill-classifier`, share-card components | Not a new skill graph — a new *signal* for the existing graph |

## Claude Code rules for this phase

1. **Before proposing any new code**, answer in writing: "which existing module does this extend? What happens to [named existing module] when this ships?"
2. **Every new feature ships with a kill switch** (feature flag, default OFF).
3. **Every new DB table gets RLS from day one**, not retrofitted later.
4. **New edge functions follow the 300-line limit** strictly — no god files.
5. **New Zod schemas in `_shared/zod-schemas.ts`** — do not fragment schemas across files.
6. **Honor the existing taste**: deterministic-first where possible, LLM for strategy text only, shadcn + semantic tokens, Framer Motion for animation.

## The decision point after IP Layer 1

After IP Layer 1 ships (roughly 3 weeks post-Stabilization Sprint), the operator decides whether to:

**Path A — Consumer depth (Layer 2: WhatsApp)**
If user growth is healthy and retention is the bottleneck, build the WhatsApp agent next.

**Path B — B2B monetization (skip to Layer 3: TrustScore)**
If enterprise inquiries are coming in and consumer traction is slow, build TrustScore first and go B2B.

**Path C — Stop adding and start selling**
If the decision is unclear, the right answer is usually to stop building and focus on sales/growth for a quarter. Claude Code should support this by not adding pressure to ship.

---

## Success definition for this entire phase

By end of IP Layer 3 (roughly 6–8 months after Stabilization Sprint completion):

- 50,000+ registered users
- 5,000+ Pro subscribers
- ₹5–10 Cr ARR
- One signed enterprise pilot for B2B Skill Graph API
- Trajectory data across 3+ months showing real cohort patterns
- WhatsApp user retention at D30 ≥ 40%

**If these aren't hit, the answer is not "build more" — it's to re-examine positioning, pricing, and distribution.**
