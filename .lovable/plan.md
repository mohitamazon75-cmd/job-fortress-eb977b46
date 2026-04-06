

# Fix All 5 Critical IP Logic Issues

## Summary
Unify scoring, fix narrative inconsistency, eliminate dual moat computation, replace naive temporal risk with power curves, and optimize matchSkillToKG performance.

---

## Issue 1: Client/Server Score Divergence (Critical)

**Problem**: `stability-score.ts` (client) computes a "Career Position Score" using its own weights (0.30/0.25/0.20/0.15/0.10) and skepticism calibration (0.82x + 9), while the server's `deterministic-engine.ts` computes `determinism_index` using completely different logic (weighted KG skill matching, industry floors, experience reduction). These two numbers diverge, confusing users.

**Fix**: Make the client score derive FROM the server's `determinism_index` as its primary AI resistance input. The client already does `report.automation_risk ?? report.determinism_index`, but then applies KG floor enforcement *again* on top of the server's already-KG-corrected value. Remove the client-side KG baseline re-application — the server engine already handles industry floors and KG matching. Keep the skepticism calibration and evidence gating as a presentation-layer compression only.

**Files**: `src/lib/stability-score.ts`

---

## Issue 2: Vibe Engine Bypasses KG Floor

**Problem**: `get-vibe.ts` reads `report.automation_risk ?? report.determinism_index` directly — the raw AI agent value, not the KG-corrected value from `computeScoreBreakdown`. This means the narrative text can say "22% of your tasks are automatable" when the actual score engine corrected it to 50%.

**Fix**: Export `effectiveAutomationRisk` from `computeScoreBreakdown` and pass it into `getVibe()`, or have `getVibe()` call `computeScoreBreakdown()` internally to get the corrected risk percentage. The `riskPct` used in narrative text must match the score.

**Files**: `src/lib/get-vibe.ts`, `src/lib/stability-score.ts`

---

## Issue 3: AIRMM Uses Raw Risk, Bypasses KG

**Problem**: `airmm-optimizer.ts` reads `report.determinism_index` directly for `automationPressure` and `demandMultiplier` thresholds. If the AI agent reported DI=22 but KG corrected it to 50, the AIRMM pivot recommendations are built on the wrong risk assessment.

**Fix**: Have `buildAIRMMState()` call `computeScoreBreakdown()` to get `effectiveAutomationRisk` and use that instead of raw `determinism_index`.

**Files**: `src/lib/airmm-optimizer.ts`

---

## Issue 4: Naive `riskToMonths()` Step Function

**Problem**: `unified-skill-classifier.ts` uses hardcoded step thresholds (`if risk >= 85 return 6`) that are statistically inconsistent with the server's power-curve-based `calculateObsolescenceTimeline()` which uses `OBSOLESCENCE_POWER_CURVE: 1.3` and AI acceleration compounding.

**Fix**: Replace the step function with a power-curve formula mirroring the server logic:
```
months = baseMonths - range * (risk/100)^power * accelerationFactor
```
Where `baseMonths=60`, `range=50`, `power=1.3`. This produces a smooth curve instead of abrupt jumps and matches server output.

**Files**: `src/lib/unified-skill-classifier.ts`

---

## Issue 5: `matchSkillToKG` O(n×m) Levenshtein

**Problem**: Every skill runs Levenshtein distance against every KG row (O(n×m) with expensive string operations). With 500+ KG skills and 10-15 user skills, this is ~7,500 Levenshtein computations per scan.

**Fix**: Add a normalized hashmap for exact/substring matches (O(1) lookup). Only fall back to Levenshtein for unmatched skills. Build the hashmap once per `computeAll` call and pass it through.

**Files**: `supabase/functions/_shared/deterministic-engine.ts`

---

## Technical Details

### Moat Score Dual Computation
The client caps moat at 55 if < 4 verified skills. The server computes moat via `calculateMoatScore()` with tier-specific weighting. The client-side cap is the correct guard — keep it, but document that it's a presentation-layer evidence gate on top of the server's structural moat calculation.

### Execution Order
1. Issue 5 first (server-side perf, independent)
2. Issue 4 (client-side, independent)
3. Issue 1 (client scoring, foundational)
4. Issue 2 (depends on Issue 1's exported values)
5. Issue 3 (depends on Issue 1's exported values)

### Risk
- Issue 1 changes the displayed score. Users who re-scan will see different numbers. This is intentional — the new numbers are more honest.
- Issue 5 must preserve identical matching behavior; only the lookup strategy changes.

