# Expert Panel Audit — JobBachao Engine, IP & Card Coherence
**Date:** 2026-04-30 · **Panel:** LLM/KG expert (Dr. K) + India career counsellor (Priya M.) · **Triggered by:** operator pause request after consecutive contradiction reports.

---

## 1. Scope
Joint review of:
- The deterministic engine (`_shared/det-*.ts`, 1,814 lines)
- The Knowledge Graph (`skill_risk_matrix`, `job_taxonomy`, `job_skill_map`, `market_signals`, `kg_node_overrides`, `cohort_market_cache`, `skill_predictions`)
- The agent prompt layer (`_shared/agent-prompts.ts`, 721 lines)
- All 19 user-facing cards (7 Model-B + 12 legacy)
- Cross-card coherence (the moat-or-mess question)

## 2. Ground truth pulled (2026-04-30)
| Layer | Reality |
|---|---|
| KG rows | 319 skills · 121 job families · 574 skill-job edges · 101 market signals |
| KG empty tables | `kg_node_overrides` (0) · `cohort_market_cache` (0) · `skill_predictions` (0) |
| Market freshness | 2 snapshot dates in 2 months. 12 rows on 2026-04-23, 89 on 2026-02-25. |
| Feedback loop | 0 skills have ever received user feedback. Trigger active, table cold. |
| KG category collisions | `it & software` vs `IT & Software`; `marketing & advertising` vs `Marketing & Advertising`. |
| Executive KG depth | `executive_capability` (10) + `executive_leadership` (10) = 20 skills. Insufficient. |
| Recent scans (14d) | 22 complete. ~1.5/day. Pre-PMF traffic confirmed. |

## 3. Findings — Dr. K (LLM/KG)
### Strengths
1. Deterministic engine + LLM-narration architecture is correct.
2. KG schema columns are well-chosen (`automation_risk`, `replacement_tools`, `human_moat`, `india_specific`, `vernacular_moat`).
3. Citation rule + `[USER-PROVIDED]/[ESTIMATED]` salary tag are textbook anti-hallucination controls.
4. Belt-and-braces guards stack deep (Zod → tool-task map → rupee sanitizer → forbidden-phrase scrubber).

### Gaps (P0 → P2)
| ID | Gap | Severity |
|---|---|---|
| **K1** | Executive KG too thin (10+10 skills) → exec scans collapse to LLM vibes | P0 |
| **K2** | `market_signals` stale + narrow (67 families); negative-only sample | P0 |
| **K3** | Feedback loop cold (0 rows) | P1 |
| **K4** | 3 empty tables (kg_node_overrides, cohort_market_cache, skill_predictions) | P1 |
| **K5** | KG match rate computed but never surfaced — moat is invisible | P1 |
| **K6** | Duplicate category casing breaks GROUP BY analytics | P2 |
| **K7** | No skill→skill adjacency edges → pivots are LLM guesses | P1 |
| **K8** | 721-line single-file prompt; no per-scan prompt-version trace | P1 |
| **K9** | `golden-eval-fixtures.ts` exists but not gated as pre-deploy assertion | P1 |

## 4. Findings — Priya M. (India counsellor)
### Strengths
1. Fear→Hope arc lands.
2. Hindi/Hinglish toggle is a real moat.
3. HIGH/MEDIUM/LOW > 67% for non-technical users.
4. Salary-as-band > ₹3L hallucination.

### Cross-card contradictions found
| ID | Contradiction |
|---|---|
| **P1** | Card 1 says role HIGH risk; Card 4 suggests same/declining role as pivot. |
| **P2** | Card 3 marks "email marketing" as moat; Card 1 lists Mailchimp AI as the replacement. |
| **P3** | Monday Move action ≠ Card 1 diagnosis. |
| **P4** | Card 2 cites sources; Card 4 throws provenance away. |
| **P5** | Pivot timelines ignore age + family stage. |
| **P6** | Best-Fit Jobs presents empty search-result lists as "opportunities". |
| **P7** | Defense Plan recommends skills user already lists in profile. |

### India-market-specific gaps
- No notice-period reality (60–90 day Indian norm).
- Tier-2/3 city language missing.
- Family/dependent context missing.
- Founder/exec override exists but doesn't reach all cards.

## 5. Joint root cause
> **There is no shared `analysis_context` object that all cards must read from.** Each card pulls its own slice of `final_json_report` and adds its own LLM call. No card knows what the other cards said. This is why P1–P4 exist. The C4 work that was repeatedly deferred IS the actual product fix.

## 6. Fix plan (4 phases · ~7 days · approved)

### Phase 1 — Stop the bleeding (2 days)
1. **`analysis_context` shared object** with: `user_role_family`, `user_role_market_health`, `user_skill_kg_match_pct`, `user_existing_skills_set`, `user_seniority_tier`, `user_is_exec`, `user_family_stage_proxy`, `user_notice_period_assumption`, `user_metro_tier`, `salary_provenance`. Persisted on `scans.analysis_context jsonb`. Read by all cards. Injected into all LLM prompts.
2. **Pivot eligibility filter (server-side):** drop pivots whose `job_family` matches user's family OR has `market_health='declining'`. Drop skills from Defense Plan that already exist in `user_existing_skills_set`.
3. **Golden no-contradiction invariant test:** "Performance Marketer profile" → assert `pivot_list ∩ {performance marketer family, declining roles} == ∅` AND `defense_plan ∩ user_existing_skills == ∅`.

### Phase 2 — Make the moat visible (1 day)
4. KG match-rate badge on Card 1 ("Matched 11/14 of your skills to our 319-skill threat graph · confidence HIGH").
5. Stamp every report with `kg_version`, `prompt_version`, `engine_version` (3 new columns on `scans`).
6. Honest empty states on Best-Fit Jobs + Defense Plan ("0 verified roles match — try widening city").
7. Card 4 Pivot must inherit Card 2's citation discipline.

### Phase 3 — Executive blind spot (3 days)
8. KG content sprint: +50 executive_capability/executive_leadership skills, +20 senior leader job families with `disruption_baseline`.
9. `isExec` propagation audit across all 19 cards. Currently only Card 1 honors it.
10. Pivot list for execs must filter on `seniority_tier ≥ SENIOR_LEADER`.

### Phase 4 — Warm + cleanup (1 day)
11. Seed 20 manual feedback rows on top-scanned skills.
12. Cron: weekly `market_signals` refresh (kill 60-day gaps).
13. Fix duplicate KG categories (one-line UPDATE).
14. Decide: activate or delete `kg_node_overrides`, `cohort_market_cache`, `skill_predictions`.
15. Onboarding additions: notice-period (number) + family-stage proxy (single optional field).

## 7. Out of scope (deliberate)
- No new cards. No new dashboard tabs. No new edge functions beyond a `compute-analysis-context` helper.
- No prompt-file split (Phase 5+ later).
- Skill→skill adjacency graph (K7) is correctly identified but deferred — too large for this sprint.

## 8. Done definition
A single fresh scan, run end-to-end, must pass:
- Pivot list contains zero declining roles
- Pivot list contains zero same-family roles
- Defense plan contains zero skills already in `user_existing_skills_set`
- Card 1 shows KG match-rate badge
- Every card cites its source; Card 4 inherits Card 2's discipline
- Best-Fit Jobs returns either ≥1 verified role or an honest empty state
- Exec persona scan returns exec-tier suggestions on every card (no "Learn Python in 8 weeks")
- Report payload contains `kg_version`, `prompt_version`, `engine_version`, `analysis_context`
- 458+ existing vitest tests still green; new `no-contradiction.test.ts` green
- `npx tsc --noEmit` clean

---

**Approved by operator on 2026-04-30. Phase 1 starts next turn.**
