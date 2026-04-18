# 00 — Current Reality

> Read this before proposing any change. It is a snapshot of what JobBachao actually is, based on a real audit of the codebase on 2026-04-18.

---

## The one-sentence summary

JobBachao is a **technically sophisticated, feature-rich, pre-PMF product** with low traffic, significant accumulated cruft from prior pivots, critical security bypasses still active, and broken test infrastructure — **not a thin MVP that needs more features**.

## What's already built (significantly more than the landing page suggests)

**The product has 12 report cards + 4 dashboard tabs + 8 major standalone features.** In short:

- Deterministic Career Position Score (0–100) backed by a 1,465-line pure-math engine — real, defensible IP
- Knowledge Graph of 147 skill-risk vectors × 95 job families × 1,500+ mappings
- Multi-agent LLM pipeline (Agent 1 profiler → deterministic engine → Agents 2A/2B/2C in parallel → Quality Editor) using Gemini 3 Pro/Flash via Lovable AI gateway
- Live market enrichment via Tavily Search + Firecrawl
- 12-card flow: Job Safety, Intelligence Map, AI Timeline, Best-Fit Jobs, Resume Weaponizer, Interview Cheat Sheet, Defense Plan, Career Genome Debate, Skill Repositioning, Career Pivot, Career Obituary, Share & Export
- Dashboard with Diagnosis / Defense / Intel / Dossier tabs
- Side Hustle Generator, AI Dossier, Career Resilience Engine, RiskIQ flow
- Razorpay payments, subscription tiers, Pro gating infrastructure
- Hindi/Hinglish i18n
- Viral mechanics: Challenge a Colleague, WhatsApp share, Career Obituary, Fate Cards
- Admin dashboard, monitoring tables, structured logging, rate limiting, abuse guards
- 15+ test files (but infrastructure doesn't run)

## What's broken or half-finished

1. **Test infrastructure does not execute.** `vitest` is referenced in `package.json` but not installed in `node_modules/`. `npm test` and `bun test` both fail.
2. **`TESTING_BYPASS = true`** in `_shared/subscription-guard.ts` — every Pro-gated feature is accessible free.
3. **`activate-subscription/index.ts` DEV bypass** — a user can POST a fake `payment_id` and be granted Pro if Razorpay keys are absent.
4. **Razorpay order creation is not implemented** server-side — client passes `amount` from `ProUpgradeModal.tsx`, making price manipulation trivial.
5. **`generate-weekly-brief` has no cron** — the feature silently never fires.
6. **13 P0 audit issues documented in `_audit/MASTER_AUDIT_REPORT.md`** — payment bypass, prompt-injection vector, tier-escalation bug, and 10 others.
7. **77 total audit findings** across security/AI/product/UX/code-quality, most unresolved.

## What's structurally dangerous (repo-level)

1. **`job-fortress-v2/` is a full parallel committed codebase** — different edge-function count (73 vs 79), different `process-scan/index.ts` (1,328 lines vs 1,136), different `App.tsx`. Which one deploys is unclear. Operator must resolve this before anything else.
2. **Five `.git_old*` backup directories** (`.git_old`, `.git_old3`, `.git_old4`, `.git_old5`, `.git_ux_final`) at repo root — residue from prior rewrites.
3. **`.lovable/bugs.md` is a KidSutra bug tracker** — this repo was pivoted from a child-health app. Stale references may exist elsewhere.
4. **Existing `CLAUDE.md` is stale** — it describes a Next.js/Anthropic-API project. It has been replaced by the new one at the repo root.
5. **God files**: `process-scan/index.ts` (1,136 lines), `scan-engine.ts` (841), `SideHustleGenerator.tsx` (798), `VerdictReveal.tsx` (492). The team has already decided not to refactor these.

## What the audit history tells us

Reading `docs/qa/` in date order reveals the pattern:
- `production-go-no-go-2026-03-31.md` → audit → `qa-fix-plan-2026-03-31.md`
- `qa-fix-plan-2026-04-01.md` → fixes → re-audit
- `qa-fix-plan-2026-04-13.md` → fixes → re-audit
- `deep-audit-go-no-go-2026-04-17-v3.md` → conditional GO

**There have been at least four full audit/fix cycles in six weeks.** This team runs serious QA rhythm — which is good — but the cycles suggest fix rates are being outpaced by new issue discovery. The right response is to reduce scope (not add features), not accelerate fixing.

## Traffic reality

From the most recent audit (2026-04-17):
- 7 total scans in the last 24 hours
- 29% complete rate (2 scans)
- 43% failed rate (3 scans) — now fixed via `MISSING_PROFILE_SOURCE` guard
- 29% invalid input (Profiler couldn't parse)

**With this traffic, no moat can meaningfully compound.** The single most important non-code task the operator has is acquiring real users before building more.

## What this changes about strategy

The earlier strategic advice to "build SkillDNA, MarketPulse, TrustScore, Career OS" was given assuming a thin landing page. That was wrong. Corrected view:

| Proposed moat | Actual status |
|---|---|
| SkillDNA | **Already exists** as `skill_risk_matrix` + `job_taxonomy` + `unified-skill-classifier.ts`. Needs depth (147 → 1000+ skills) and curation, not greenfield build. |
| MarketPulse | **Already exists** as `market_signals` table + `live-market`, `market-signals`, `market-radar` edge functions + Tavily. Needs longitudinal persistence and an API surface. |
| Career Agent | **Partially exists** — there's an AI Coach with usage limits. Genuinely missing: WhatsApp channel and long-term memory per user. |
| TrustScore | **Does not exist.** Genuinely greenfield. |
| Chrome extension | Correctly skipped — wrong for Indian market. |
| Career Insurance | Correctly deferred — too early. |
| Reverse Job Board | Correctly deferred — too early. |

## The actual strategic priorities, in order

1. **Resolve `job-fortress-v2/`** (decision, not work — 1 hour with operator).
2. **Stabilization Sprint** (`01_STABILIZATION_SPRINT.md`) — 2–4 weeks.
3. **Launch to 100 real paying users** — not a code task.
4. **Then** consider new IP (`02_NEW_IP_ROADMAP.md`).

## For Claude Code: what this document means for you

- Do not propose new cards, new dashboard tabs, new edge functions, or new database tables in the current session unless the Stabilization Sprint is complete.
- Do not duplicate existing capabilities. Before proposing "let's build a skill graph," check `skill_risk_matrix`. Before "let's build market intelligence," check `market_signals`.
- When the operator asks for a new feature, your first response is: "which existing module does this extend, and what would stop working if I change it?"
- Your job in the first session is to consume this package, audit that the codebase still looks like this doc describes (some details may have changed since 2026-04-18), and report discrepancies before any implementation work.
