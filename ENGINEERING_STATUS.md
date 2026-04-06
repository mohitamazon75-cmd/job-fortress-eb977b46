# Engineering Status — JobBachao

> Last updated: 2026-04-06 (post-audit cycle)

---

## Architecture Overview

### Scan Pipeline
```
process-scan/index.ts (942 lines — orchestrator)
  → scan-enrichment.ts    — gathers resume, LinkedIn, KG data in parallel
  → scan-agents.ts        — runs ML obsolescence + Agents 2A/2B/2C via Promise.allSettled
  → deterministic-engine   — pure scoring (no AI calls)
  → DB write + response
```

### _shared/ Key Files
| File | Purpose |
|------|---------|
| `deterministic-engine.ts` | Barrel re-export for det-* modules |
| `det-types.ts` | Type definitions for scoring engine |
| `det-utils.ts` | Utility functions (clamp, normalize, etc.) |
| `det-industry.ts` | Industry-specific risk adjustments |
| `det-scoring.ts` | Core score computation |
| `det-lifecycle.ts` | Career lifecycle / seniority modifiers |
| `det-orchestrator.ts` | `computeAll()` — top-level scoring entry point |
| `subscription-guard.ts` | Pro subscription verification (TESTING_BYPASS=true) |
| `edge-logger.ts` | Structured error logging + usage tracking |
| `agent-prompts.ts` | Shared AI agent prompt templates |

### Edge Functions
- **68 edge functions** total
- **37 shared modules** in `_shared/`
- All AI gateway calls have 30s AbortController timeouts
- External API calls have 15s timeouts
- JWT auth pattern: hard (401 reject) or soft (degrade gracefully)

---

## Security State

| Pattern | Functions |
|---------|-----------|
| JWT hard auth (401 if no token) | `fate-card`, `kg-expand` |
| JWT soft auth (degrade if no token) | `career-obituary` |
| Input validation only | `log-ab-event` |
| Subscription guard | All Pro features (currently bypassed) |

### Subscription Guard
- **Location:** `_shared/subscription-guard.ts`
- **Current state:** `TESTING_BYPASS = true` — all users pass through
- **To activate:** Set `TESTING_BYPASS = false` (see Phase 3B checklist below)

---

## Known Incomplete Features

### generate-weekly-brief
- Function exists, `weekly_briefs` table exists
- **NO cron trigger configured** — function never fires automatically
- To wire: add `pg_cron` schedule targeting the function endpoint

### Subscription Enforcement
- `TESTING_BYPASS = true` in subscription-guard.ts
- Pro-gated functions (resume-weaponizer, ai-dossier, etc.) are currently accessible to all users
- To enforce: flip flag after confirming Razorpay webhook flow

---

## Test Coverage

### Scaffold
- **File:** `supabase/functions/process-scan/process-scan.test.ts`
- **Scenarios:** 7 integration test stubs
- **Status:** SCAFFOLD ONLY — no test logic implemented

### Priority Implementation Order
1. Scenario 1: Resume-only scan (happy path baseline)
2. Scenario 5: Full agent timeout (resilience verification)
3. Scenario 4: Minimum viable input (no resume, no LinkedIn)
4. Scenario 7: Empty KG enrichment (graceful degradation)

---

## Phase 3B Checklist (Before Going Live with Payments)

- [ ] Verify Razorpay webhook is receiving events in production
- [ ] Confirm at least 1 real user has `profiles.subscription_tier = 'pro'`
- [ ] Set `TESTING_BYPASS = false` in `_shared/subscription-guard.ts`
- [ ] Test that `generate-weekly-brief`, `resume-weaponizer`, and `ai-dossier` are properly gated
- [ ] Verify frontend shows upgrade prompt for free users (not silent failure)
- [ ] Run a test payment end-to-end: Razorpay checkout → webhook → profile update → feature access

---

## Remaining Technical Debt (Ordered by Impact)

1. **process-scan/index.ts at 953 lines** — acceptable; dynamic template-literal prompts prevent further extraction without architectural changes
2. **~50 edge functions use `{ error: string }` envelope** — consistent but lacks machine-readable `code` field; Priority 1+2 functions (JWT-gated) have been standardized
3. **Zero running tests** — scaffold exists, needs implementation
4. **No monitoring/alerting on edge function failures** — `edge_function_logs` and `monitoring_alerts` tables exist but no notification pipeline (email/Slack)
5. **No cron for generate-weekly-brief** — table and function ready, trigger missing

---

## Audit Cycle Summary (2026-04)

| Phase | Work Done |
|-------|-----------|
| Phase 1 | Dead code removal — 19+ KidVital/KidSutra files purged |
| Phase 2 | Security hardening — JWT auth on premium endpoints |
| Phase 3 | Subscription guard — server-side Pro verification (bypass mode) |
| Phase 4 | Deterministic engine split — monolith → 6 focused modules |
| Phase 5 | process-scan split — extracted scan-enrichment.ts + scan-agents.ts |
| Phase 6 | Polish — response envelopes, AbortController timeouts, JSDoc headers |
| Phase 7 | LLM/Prompt quality audit — 7 fixes across all agents |

**Architecture score: 8.5/10**

---

## LLM/Prompt Layer Status (post-audit 2026-04-06)

| Agent | Before | After | Fix Applied |
|-------|--------|-------|-------------|
| Agent 1 (Profiler) | 8/10 | 8.5/10 | Zod schema + range clamping (salary ₹5K–₹50L, experience 0-60, skill caps) |
| Agent 2A (Risk) | 6.5/10 | 8.5/10 | `industry_proof` grounded to context data only; `risk_pct` → `risk_level` enum |
| Agent 2B (Action Plan) | 7/10 | 8/10 | `salary_unlock_inr_monthly` → grounded `demand_signal` (HIGH/MEDIUM/LOW) |
| Agent 2C (Pivot) | 5/10 | 7/10 | Anti-hallucination rules, negative examples, arbitrage range 5-500 |
| Judo Strategy | 7.5/10 | 7.5/10 | No changes — `months_gained` ungrounded but low-stakes |
| Weekly Diet | 6/10 | 7.5/10 | `content_verified` removed; server-side domain verification via `diet-verification.ts` |
| Det Engine | 7.5/10 | 8/10 | All CALIBRATION constants documented with rationale |
| **Overall** | **6.5/10** | **8/10** | |

### Remaining LLM Limitations (accepted)
- `months_gained` in Judo Strategy is ungrounded projection (low-stakes — directional only)
- `weeks_to_proficiency` in Agent 2B is ungrounded (directional, not financial — accepted)
- Agent 2C pivot quality still depends heavily on model knowledge of job markets — needs live job data injection to reach 9/10
- All agent outputs are LLM-generated and should be treated as directional intelligence, not precise data

### Key Files Modified
- `_shared/agent-prompts.ts` — industry_proof, risk_level, demand_signal, 2C rules
- `_shared/zod-schemas.ts` — Agent1Schema strengthened, clampAgent1Output added, demand_signal
- `_shared/diet-verification.ts` — server-side domain verification
- `_shared/det-utils.ts` — all CALIBRATION constants documented
- `process-scan/index.ts` — Agent1 validation + clamping wired in
- `process-scan/scan-agents.ts` — diet verification wired in
- `career-landscape/index.ts` — `ai_risk_pct` → `risk_level` in prompt schema
- `market-signals/index.ts` — `ai_risk_pct` → `risk_level` in prompt schema
- `src/lib/scan-engine.ts` — SkillThreatIntel type updated (risk_level + backward compat)
- `src/lib/unified-skill-classifier.ts` — threatIntelRisk() helper for risk_level → numeric
- `src/components/dashboard/CompetitiveLandscapeWidget.tsx` — risk_level badge display (backward compat with legacy ai_risk_pct)
- `src/components/dashboard/StrategicDossier.tsx` — demand_signal badge display

✅ Full audit cycle complete — architecture 8.5/10 + LLM layer 8/10

