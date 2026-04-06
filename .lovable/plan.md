
# QA Audit Assessment — Objective Validation

Reviewed each finding against the actual codebase. Classification:
- ✅ **Valid — Fix Required** 
- ⚠️ **Partially Valid — Needs Nuance**
- ❌ **Not Valid / Already Fixed**

---

## ❌ ALREADY FIXED (in our last session)

### CRITICAL-1: Display shows 21% but score uses 60%
**Status: FIXED.** We already patched `JobSafetyCard.tsx` and `AIDossierReveal.tsx` to use `breakdown.effectiveAutomationRisk` instead of raw `determinism_index`. The display now shows the KG-corrected value.

---

## ✅ VALID — SHOULD FIX

### CRITICAL-6: 4 different names for the same metric (Severity: High)
**Verdict: VALID.** Confirmed in code:
- `computeStabilityScore` (function name)
- "Career Position Score" (most UI labels)  
- "Career Position" (some places)
- `fate_score` (database column)
- "Stability Score" (legacy references)

**Fix:** Standardize to "Career Position Score" everywhere in UI, keep `computeStabilityScore` as function name, add a code comment mapping the terms.

### HIGH-2: Tools count includes moat skills — contradicts moat narrative (Severity: High)
**Verdict: VALID.** In `JobSafetyCard.tsx` line 24: `tools = normalizeTools(report.ai_tools_replacing || [])` — these are AI tools from the server, NOT moat skills. However, the `ai_tools_replacing` array from the server's `extractReplacingTools()` function maps skills to their replacement tools. If a "moat skill" also appears in the replacement tools list, it would be counted in both "Moat Skills" and "AI Tools Competing" — which IS contradictory. 

**Fix:** Filter `ai_tools_replacing` to exclude tools that automate moat skills before counting.

### CRITICAL-4: DI displayed as "Task Overlap %" — category error (Severity: High)
**Verdict: VALID.** The KG-corrected `effectiveAutomationRisk` is labeled "Task Overlap with AI" but it's actually an **automation risk index** (a composite of skill-level automation probabilities weighted by job importance). Calling it "task overlap" implies a literal count of tasks that AI can do, which it isn't.

**Fix:** Rename label to "AI Exposure" or "AI Automation Risk" — more accurate and already used elsewhere in the codebase.

### NARRATION-1: "Danger zone" narrative with low overlap metric (Severity: Medium)
**Verdict: PARTIALLY VALID but largely FIXED.** The worst case (21% with danger narrative) was fixed when we made the display use KG-corrected values. However, the `getVibe()` function in `get-vibe.ts` generates the narrative from the Career Position Score (which IS KG-corrected), so narrative and score are now aligned. **Remaining risk:** The vibe text references `report.determinism_index` in some places for secondary details — these should also use corrected values.

**Fix:** Audit `get-vibe.ts` for any remaining raw `determinism_index` references in narrative text.

### CRITICAL-7: Urgency score computed but never used (Severity: Low-Medium)
**Verdict: PARTIALLY VALID.** `urgency_score` IS used in:
- `SkillCrisisResponseCenter.tsx` (line 95) — drives alert severity
- `FateCardShare.tsx` (line 147) — shown on share card

However, it's NOT used in the main scoring formula or in the primary dashboard view. It exists as a secondary signal. This is a **design choice, not a bug** — adding it to the main score would require re-calibration.

**Fix:** Not urgent. Could integrate into the vibe narrative or alert prioritization. Low priority.

### CRITICAL-8: Geo arbitrage EV formula is mathematically incorrect (Severity: Medium)
**Verdict: VALID.** In `calculateGeoArbitrage()` (line 1229):
```
probAdjusted = rawDelta * probability
ev12mo = probAdjusted * 12
```
This treats the probability-adjusted delta as a monthly value, which is wrong. The EV should be: `rawDelta * probability * 12` (probability of getting the job × annual salary delta). The current formula actually gives the same result mathematically (`(rawDelta * probability) * 12 = rawDelta * probability * 12`), so **the math is actually correct** — it's just confusingly named. `probAdjusted` looks like a one-time adjustment but is used as a monthly value.

**Fix:** Rename variable for clarity. The actual numbers are correct.

### HIGH-11: AIRMM projections use fixed % boosts with no evidence basis (Severity: Medium)
**Verdict: VALID.** In `JobSafetyCard.tsx` line 50-57 and `AIDossierReveal.tsx` line 130:
```js
projectionBoost(base, 0.25)  // AI Resistance: +25% of remaining gap
projectionBoost(base, 0.12)  // Income Resilience: +12%
```
These percentages are hardcoded with no backing data. The disclaimer says "assumes full gap closure" but the boosts are partial, not full closure.

**Fix:** Either (a) make projections data-driven from the actual defense plan steps, or (b) add clear caveats like "illustrative projection" and remove specific percentages. Medium effort.

---

## ⚠️ PARTIALLY VALID — DESIGN TRADE-OFFS

### CRITICAL-2: Client KG override ignores sub-sector granularity (Severity: Medium)
**Verdict: PARTIALLY VALID but mitigated.** The client-side `KG_DISRUPTION_BASELINES` in `stability-score.ts` uses broad role patterns (e.g., `'marketing': 65`). The SERVER already has sub-sector granularity (`SUB_SECTOR_AUTOMATION_FLOORS`). With our new server-side KG floor enforcement, the server DI now enforces `jobBaseline` (which IS sub-sector-aware from `job_taxonomy`). The client KG is a **backup guard**, not the primary source.

**Fix:** Low priority. The server-side fix we just deployed handles this. Could add sub-sector patterns to client KG for extra safety, but it's defense-in-depth, not critical.

### CRITICAL-3: 2 moat skills shown green but internally penalized (Severity: Medium)
**Verdict: PARTIALLY VALID.** Moat skills are shown as green "safe" skills in the UI. The scoring engine's `UNVERIFIED_MOAT_CAP = 55` caps the moat score when `< 4` verified moat skills exist. So yes, having only 2 moat skills triggers a cap — but the cap applies to the AGGREGATE moat score, not individual skills. Individual skills aren't "penalized" — the overall moat contribution is capped. The UI correctly shows them as defensible skills.

**Fix:** Add a subtle indicator when moat score is capped (e.g., "2 moat skills identified — build more to strengthen your position"). Low effort.

### CRITICAL-5: SKEPTICISM_FACTOR same for all data quality tiers (Severity: Low)
**Verdict: VALID but intentional.** The `SKEPTICISM_FACTOR = 0.82` is a global compression factor. Making it data-quality-dependent would mean: HIGH quality → less skepticism (e.g., 0.88), LOW quality → more skepticism (e.g., 0.75). This is theoretically sound but increases complexity and requires calibration data we don't have.

**Fix:** Future improvement. Would need outcome data to calibrate quality-dependent factors. Park for v3.

### NARRATION-7: Yellow zone = "months remaining" framing overstates urgency (Severity: Low)
**Verdict: PARTIALLY VALID.** The yellow zone is labeled as "months remaining" which implies a deadline. In reality, it's the window before significant market shift begins — not job loss. The framing is deliberately urgent for motivation, but could be misleading.

**Fix:** Rename to "window before market shift" or "action window" in the dossier. Already using "repositioning window" in some exec-tier text. Standardize. Low effort.

### HIGH-4: Obsolescence acceleration is industry-invariant (Severity: Low-Medium)
**Verdict: PARTIALLY VALID.** `OBSOLESCENCE_AI_ACCELERATION_RATE = 0.12` applies uniformly. Different industries adopt AI at different rates (healthcare slower, marketing faster). However, the DI itself is already industry-calibrated, so the timeline is indirectly industry-sensitive. The acceleration rate is about GENERAL AI progress, not industry-specific adoption.

**Fix:** Could add industry-specific acceleration multipliers. Medium effort, marginal impact since DI already handles industry variance.

### HIGH-6: KG market cap makes strong market position impossible for at-risk roles (Severity: Medium)
**Verdict: ALREADY MITIGATED.** We added `seniorityMarketBonus` in the last session (Executive: +15, Senior Leader: +10, Manager: +5). The cap formula is now `Math.max(20, Math.min(65, 100 - kgBaseline + seniorityMarketBonus))`. For a Marketing Executive (baseline 65): cap = `100 - 65 + 15 = 50`, which allows decent market positioning. Without seniority: cap = 35, which IS restrictive but reflects reality for junior marketing roles.

**Fix:** Already addressed. Could further refine by adding certifications/education as cap modifiers. Low priority.

### STAT-2: Symmetric confidence intervals on bounded risk score (Severity: Low)
**Verdict: TECHNICALLY VALID but cosmetic.** A score of 85 ± 15 implies a range of 70-100, but scores are clamped at 95. The CI should be asymmetric near boundaries. This only affects the `score_variability.di_range` display in the breakdown panel — not the actual score.

**Fix:** Clamp CI bounds to [5, 95]. Very low effort.

### CRITICAL-9: Exec salary bleed measures wrong risk type (Severity: Medium)
**Verdict: VALID.** Executive risk isn't "your salary drops X%" — it's "your role gets restructured/eliminated." The salary bleed formula (depreciation rate from DI) models gradual salary erosion, but execs face binary outcomes (keep role vs. forced transition). However, the formula already has seniority adjustments, and we've switched to percentage display which is less misleading than absolute amounts.

**Fix:** Could add exec-specific framing: "restructuring probability" instead of "earning pressure." Medium effort, narrative change only.

---

## ❌ NOT VALID / OVER-ENGINEERED

### STAT-1: Core weights not calibrated to outcome data (Severity: N/A — aspirational)
**Verdict: ASPIRATIONAL, NOT A BUG.** The weights (AI Resistance 30%, Market 25%, etc.) are expert-calibrated, not data-calibrated. This is true for every scoring system before having longitudinal outcome data. We don't have 12-month follow-up data on users to calibrate against. This is a future research task, not a bug.

**Fix:** Track user outcomes over time and calibrate weights via regression. Long-term roadmap item, not a current fix.

---

## RECOMMENDED PRIORITY ORDER

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | CRITICAL-4: Rename "Task Overlap" → "AI Exposure" | 15 min | Eliminates confusion |
| 2 | CRITICAL-6: Standardize metric name to "Career Position Score" | 30 min | Consistency |
| 3 | HIGH-2: Filter tools that overlap with moat skills | 30 min | Fixes contradiction |
| 4 | NARRATION-1: Audit get-vibe.ts for raw DI references | 20 min | Narrative consistency |
| 5 | CRITICAL-3: Add moat cap indicator in UI | 15 min | Transparency |
| 6 | NARRATION-7: Standardize "months remaining" framing | 15 min | Less alarmist |
| 7 | STAT-2: Clamp CI bounds to score range | 10 min | Cosmetic correctness |
| 8 | HIGH-11: Add caveats to AIRMM projections | 20 min | Honesty |
| 9 | CRITICAL-9: Exec-specific salary framing | 30 min | Better narrative |
| 10 | CRITICAL-8: Rename geo arbitrage variables | 10 min | Code clarity |

**Total estimated effort: ~3.5 hours for all fixes.**
**Items 1-7 are highest value-to-effort ratio.**
