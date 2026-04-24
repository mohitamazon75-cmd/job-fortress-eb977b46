# 00 — Current Reality

> Read this before proposing any change. Snapshot last refreshed **2026-04-24** (originally 2026-04-18).
> Sections marked ✅ have been resolved since the original snapshot — kept for institutional memory.

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

1. ✅ **Test infrastructure runs** (refresh 2026-04-24). 194 tests across 9 files pass cleanly via `bun run test`. Includes `src/test/invariants.test.ts` (cross-system contracts).
2. 🔶 **Pro gating is bypassed by default.** `TESTING_BYPASS` was removed; replaced by `ENFORCE_PRO` env switch in `_shared/subscription-guard.ts`. Currently unset → all Pro features are free in production. **This is a deliberate pre-PMF decision** (operator, 2026-04-24, see `docs/DECISIONS.md`).
3. ✅ **`activate-subscription` DEV bypass removed** (refresh 2026-04-24). Function now requires real Razorpay verification end-to-end.
4. **Razorpay order creation is not implemented** server-side — client passes `amount` from `ProUpgradeModal.tsx`, making price manipulation trivial. Less urgent while `ENFORCE_PRO` is off but still a P1 to fix before flipping the gate.
5. ✅ **`generate-weekly-brief` cron wired** (migration `20260416042427_activate_retention_cron_jobs.sql`).
6. **Older `_audit/MASTER_AUDIT_REPORT.md` is partly stale.** Re-run `docs/AUDIT_CHECKLIST_v1.md` to get the live count of P0/P1 against current invariants in `docs/INVARIANTS.md`.

## What's structurally dangerous (repo-level)

1. ✅ **`job-fortress-v2/` removed** (refresh 2026-04-24). One source of truth.
2. ✅ **`.git_old*` backup directories removed** (refresh 2026-04-24).
3. **`.lovable/bugs.md` may still contain KidSutra residue** — confirm before relying on anything in `.lovable/` as ground truth.
4. ✅ **CLAUDE.md is current** (refreshed 2026-04-24 alongside this file).
5. **God files**: `process-scan/index.ts` (1,179 lines), `scan-engine.ts` (842), `SideHustleGenerator.tsx` (900), `VerdictReveal.tsx` (564). Grandfathered — do not refactor unless explicitly asked. Any edit must add a snapshot test first (BL-023).

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

1. ✅ **`job-fortress-v2/` resolved.**
2. **Stabilization Sprint** (`01_STABILIZATION_SPRINT.md`) — partially done (test infra, hazard cleanup). Remaining: invariant-test backfill (BL-012/013/014), `package-lock.json` vs `bun.lock` reconciliation (BL-024).
3. **Launch to 100 real paying users** — not a code task. Until this happens, `ENFORCE_PRO` stays off (per operator).
4. **Then** consider new IP (`02_NEW_IP_ROADMAP.md`).

## For Claude Code: what this document means for you

- Do not propose new cards, new dashboard tabs, new edge functions, or new database tables in the current session unless the Stabilization Sprint is complete.
- Do not duplicate existing capabilities. Before proposing "let's build a skill graph," check `skill_risk_matrix`. Before "let's build market intelligence," check `market_signals`.
- When the operator asks for a new feature, your first response is: "which existing module does this extend, and what would stop working if I change it?"
- Your job in the first session is to consume this package, audit that the codebase still looks like this doc describes (some details may have changed since 2026-04-18), and report discrepancies before any implementation work.
