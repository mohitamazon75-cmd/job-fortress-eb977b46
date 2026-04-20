# Scan Pipeline Triage — 2026-04-20

**Scope:** Read-only investigation of the JobBachao scan pipeline against production-log evidence (200 rows of `process-scan` logs, ~Mar 2026 → 2026-04-20).
**Investigator:** Claude Code (diagnosis only — no code modified).
**Source of truth for log claims:** the operator (logs not re-pulled in this session).
**Outputs:** Bug inventory, severity/complexity/risk ratings, root-cause clustering, ranked fix order.

---

## 0. Pipeline at a glance (entry-point map)

End-to-end flow for a scan, with the files involved:

1. **Client → `create-scan/index.ts`** — inserts a `scans` row (status=pending), returns `scanId`.
2. **Client invokes `process-scan/index.ts`** (the orchestrator, **1,136 lines**, `Deno.serve(...)` at line 86).
   - Loads scan row (cols subset, line 149-151).
   - **Step 2 — Enrichment** (`scan-enrichment.ts:gatherEnrichmentData`, line 296-307): pulls resume (`parseResume`) OR LinkedIn (`enrichFromLinkedin`).
     - Resume path: `parseResume()` in `scan-enrichment.ts:63-287` calls Lovable AI gateway (Gemini vision) + Affinda for date-derived years.
     - LinkedIn path: invokes `parse-linkedin/index.ts` (1) Firecrawl scrape, (2) Firecrawl search, (3) Tavily search, (4) Gemini structured extraction, (5) URL-only fallback (`inferProfileFromLinkedinUrl`, `parse-linkedin/index.ts:421-457`).
   - **Step 3 — Industry/role resolution** (`scan-helpers.ts:resolveIndustry` line 90-113; `matchRoleToJobFamily` line 346-401).
   - **Step 4 — KG + skills lookup** (`process-scan/index.ts:420-510`).
   - **Step 5 — Agent 1 profiler** (LLM extraction, `process-scan/index.ts:533-717`).
   - **Step 6+ — Scoring/agents** (`scan-pipeline.ts:runScanPipeline`).
   - **Step 12 — Persist** (`scan-report-builder.ts:updateScan` line 33-62).

Critical insight: **the orchestrator file is 1,136 lines and CLAUDE.md Rule 3 forbids touching files >500 lines without approval.** Most fixes below land in this file or `scan-helpers.ts` (656 lines) — operator confirmation required for each.

---

## 1. The `profile_text_length = 201` mystery

**Root cause: `process-scan/index.ts:371-374`.** When external profile extraction returns no text (`!rawProfileText`), the orchestrator builds a synthetic placeholder:

```ts
rawProfileText = `Industry (resolved): ${resolvedIndustry}\nRole Hint: ${resolvedRoleHint}\nExperience: ${scan.years_experience || "Unknown"} (${normalizedExperienceYears ?? "Unknown"} years)\nLocation Tier: ${scan.metro_tier || "tier1"}\nCountry: ${locale.label}\nIndustry Resolution: ${industryResolutionReason}\n(Profile scrape unavailable)`;
```

Hand-counting this template with typical short values (industry ≈ 12 chars, role ≈ 12 chars, years range ≈ 4 chars, country "India", reason ≈ 25–30 chars) lands at **~195–215 characters**. **`profile_text_length: 201` means the entire profile is the placeholder string** — i.e., LinkedIn parse returned no text AND no resume was uploaded (or both pipelines silently failed).

The placeholder then gets sanitized at line 413 and fed to Agent 1 — which means **Agent 1 is being asked to invent a profile from 6 lines of metadata it already knows.** Anything Agent 1 returns from this state is fabrication.

**Why so uniform across many scans?** Two contributing causes:
- `parse-linkedin` ratelimit / Firecrawl scrape failures degrade silently to URL-only inference (`parse-linkedin/index.ts:306-333`), and even URL inference returns a `profile.headline === "Professional"` for slugs without role keywords. The orchestrator's `enrichFromLinkedin` (`scan-enrichment.ts:332`) skips writing `Headline:` when it equals `"Professional"`, so `rawProfileText` ends up empty.
- Resume path returns empty `rawText` on any failure (line 76 fallback): no token, no error surfaced upstream.

**Severity: P0** (every "201" scan is operating on near-zero real input → guaranteed fabrication downstream).
**Complexity: M** (need to either fail-closed when profile text is too short, OR fix the silent failure modes in `enrichFromLinkedin` so `rawProfileText` actually contains the URL-inferred snippets).
**Risk: MED** (changes how scans degrade — could push more scans into the `invalid_input` branch the operator already added at line 668-676 and 818-828).

---

## 2. The `job_family: "fitness_trainer"` classification bug

**Root cause: combination of 3 things.**

### 2.1. `fitness_trainer` lives in category `'Other'`
Migration `supabase/migrations/20260225125146_d8551a48-b45e-4894-b19c-d1e22803f099.sql:91`:
```sql
('fitness_trainer', 'Other', 30, 0.04, 4.0, ...);
```
Other rows in `'Other'`: `operations_manager, business_analyst, management_consultant, logistics_coordinator, call_center_agent, research_scientist, chef_culinary, pilot, lawyer_litigation, social_worker, fitness_trainer`.

### 2.2. `resolveIndustry` defaults to `"Other"` (`scan-helpers.ts:90-113`)
When user didn't select an industry AND `parse-linkedin` returned no industry AND URL inference returned no industry (Mohit's case — slug doesn't contain "founder", "consultant", "marketing", etc.), the function falls through to line 110: `selected || inferred || "Other"`.

### 2.3. The `matchRoleToJobFamily` fuzzy-similarity is broken (`scan-helpers.ts:346-401`)

Two distinct bugs:

**Bug 2.3a — character-bag similarity at lines 367-378:**
```ts
let common = 0;
const shorter = rt.length < ft.length ? rt : ft;
const longer = rt.length < ft.length ? ft : rt;
for (const ch of shorter) {
  if (longer.includes(ch)) common++;
}
const similarity = common / maxLen;
if (similarity > 0.7) score += 5;
```
This is **a character-set overlap, not a string similarity**. "fitness" (f,i,t,n,e,s) shares ≥5 of 7 letters with many unrelated long words (e.g., "transformation" → t,r,a,n,s,f,o,r,m,i,o,n — contains f,i,t,n,s). So Mohit's headline tokens like "transformation", "organizations", "consultant" all spuriously score against "fitness".

**Bug 2.3b — empty-role fallback at line 347:**
```ts
if (!role || jobs.length === 0) return jobs[0] || null;
```
When the role string is empty/null AND there are jobs in the category, returns `jobs[0]` — a **non-deterministic Postgres heap row**. For category "Other", this can return any of the 11 rows including `fitness_trainer`.

### Why "I help organizations solve complex technology and transformation challenges" → fitness_trainer
Most likely sequence for Mohit's scan:
1. LinkedIn URL slug doesn't trigger any role keyword in `inferProfileFromLinkedinUrl` (parse-linkedin:421-457) → `inferredIndustry: null`.
2. Firecrawl/Tavily extracted the headline summary but not industry (`industry: null` in the parse-linkedin response).
3. User didn't pick an industry → `resolveIndustry` returns `"Other"`.
4. `allIndustryJobs` = 11 rows from category "Other" including `fitness_trainer`.
5. `matchRoleToJobFamily(headline, allIndustryJobs)` runs — Bug 2.3a gives spurious character-bag scores; the highest score happens to land on `fitness_trainer` because no real keyword match exists and the ROLE_ALIASES map (lines 343-344) for "consultant"/"director" don't fire on this verbose headline.
6. `targetFamily = "fitness_trainer"` (process-scan/index.ts:432).
7. Skill map, market signals, displacement timeline all looked up under `fitness_trainer` — entire downstream report is wrong.

**Severity: P0** (catastrophic mis-classification visible in user-facing report).
**Complexity: S–M** (replace fuzzy-similarity with proper string distance + remove the `jobs[0]` fallback in favor of explicit null + nullable handling upstream).
**Risk: MED** (`matchRoleToJobFamily` is shared across multiple call sites in `process-scan/index.ts`; changing return type from "always returns something" to "may return null" forces upstream null-handling).

---

## 3. The fallback mechanism — `all→MERGED_FALLBACK`

**Definition: `process-scan/index.ts:765`.**
```ts
if (profileInput.all_skills.length === 0) {
  profileInput.all_skills = Array.from(new Set([
    ...profileInput.execution_skills,
    ...profileInput.strategic_skills,
    ...kgSkillFallbackPool.slice(0, 8)
  ])).filter(Boolean);
  fallbacksUsed.push("all→MERGED_FALLBACK");
}
```

**When it fires:** Whenever Agent 1 returns no skills (or returned cached empty). The cascading fallback chain is:
- Lines 761-762: `exec→KG[…]` and `strat→KG[…]` — pull from `kgSkillFallbackPool` (skills attached to the matched `targetFamily` via `job_skill_map`).
- Lines 763-764: `exec→HARDCODED` / `strat→HARDCODED` — generic "Process Execution / Stakeholder Coordination / Reporting" / "Decision Making / Problem Framing".
- Line 765: `all→MERGED_FALLBACK` — union of the previous fallback fillers, with no real profile evidence behind any of them.

**Why does status remain `"success"` when this fires?** The orchestrator records `synthetic_fallback_used` and `fallbacks_used` in the diagnostic write at lines 779-792 (with status `"degraded"` in `edge_function_logs`), but the user-facing scan never gets failed — the pipeline marches on with synthetic skills, scores them, ships a report. The scan row's `scan_status` becomes `"complete"`. **The `degraded` signal exists only in `edge_function_logs`, not in the user-facing scan record or final report.**

**Why so many scans?** Because Agent 1 is running on the 201-char placeholder (Bug 1) → returns nothing useful → fallback chain fires by design.

**Severity: P1** (downgrade to fabricated content, but operator already records the signal).
**Complexity: S** (the fix is policy: when `usedAgent1SyntheticFallback === true` OR `fallbacksUsed.includes("all→MERGED_FALLBACK")`, mark scan `degraded`/`invalid_input` instead of shipping it).
**Risk: LOW** (additive — flip one branch to fail rather than continue).

---

## 4. The runtime errors

### 4.1 `Buffer is not defined`
**No `Buffer` references in the codebase** (`grep -rn "\bBuffer\b" supabase/functions/`). All ArrayBuffer / Uint8Array uses are correct (`scan-enrichment.ts:85-89` uses `arrayBuffer()` + `Uint8Array` + `btoa`).

**Hypothesis:** transitively imported via an `npm:`/`esm.sh` package. The only `npm:` import I found is in `process-email-queue/index.ts:1` (`npm:@lovable.dev/email-js`) — irrelevant to scan pipeline. Likely candidates by elimination:
- An LLM SDK or PDF/HTML library used inside the Lovable AI gateway response handling.
- The Affinda parser path (`affinda-parser.ts`) if it returns binary that someone tries to wrap in `Buffer`.

**Severity: P2** (sporadic, source unclear; investigation needed in production stack traces).
**Complexity: M** (hunt the source via the full stack trace from logs — this triage couldn't pinpoint it from static reads alone).
**Risk: LOW** until source is known.

### 4.2 `Cannot set properties of null (setting 'linkedin_name')`
**Site: `_shared/scan-report-builder.ts:48`** — `report.linkedin_name = name;`

The function has a defensive guard at lines 40-46:
```ts
if (!report || typeof report !== "object") {
  await supabase.from("scans").update({ scan_status: "failed" }).eq("id", scanId);
  return;
}
```
which catches null/undefined/non-object before line 48. **If the error is current,** the only way it fires is if `report` is a special object like `Object.create(null)` with frozen `linkedin_name`, which is implausible. **More likely the log entries are from before the guard was added** (no git check performed). If the error reappears, the most plausible source is `assembleReport` (`scan-report-builder.ts:254`) returning `null` and an upstream caller bypassing `updateScan`.

**Severity: P2** (likely already fixed; needs log-date confirmation).
**Complexity: S** (verify guard with a regression test).
**Risk: LOW**.

### 4.3 `manualKeySkills.split is not a function`
**Site: `process-scan/index.ts:329-336`.**
```ts
const manualKeySkills = (scan.enrichment_cache as any)?.key_skills ?? null;
...
String(manualKeySkills).split(/[,;\n]+/)
```
The current code defensively handles array vs string with `Array.isArray(manualKeySkills) ? ... : String(manualKeySkills).split(...)`. The comment at lines 326-328 explicitly cites this fix. **The error is from the older code path that called `manualKeySkills.split(...)` directly** when `enrichment_cache.key_skills` was an array.

**Severity: P2** (already fixed in current code; logs are historical).
**Complexity: S** (no fix needed; add a unit test for the array path to prevent regression).
**Risk: LOW**.

### 4.4 `getKG is not defined`
**Site: `process-scan/index.ts:54`** (now imported statically). Comment at lines 51-53 explicitly says: "Static top-level import — was previously dynamic-only inside a try/catch, which left `getKG` undefined for the manual-skill matching path below (line ~340) and crashed every manual scan." **Already fixed** in the orchestrator. Verified the static import is also present in `scan-agents.ts:28`, `riskiq-scoring.ts:6`. No remaining dynamic-only path found.

**Severity: P2** (already fixed; logs are historical).
**Complexity: S** (no action; add an import-presence test).
**Risk: LOW**.

### 4.5 `prev is not defined`
**Site: `process-scan/index.ts:992-1102`.** `let prev: ... = null;` at line 992 (function-level scope, inside the main try block). Used at line 1087 inside an IIFE — the IIFE captures `prev` from the enclosing closure, which is in scope. **The current code is correct.** The error must be from before line 992 was hoisted out of the inner `if (scan.user_id)` block (or before the IIFE was added).

**Severity: P2** (already fixed; logs are historical).
**Complexity: S** (no action).
**Risk: LOW**.

### Summary on runtime errors
4 of 5 (`linkedin_name`, `manualKeySkills`, `getKG`, `prev`) appear already fixed in the current code, judging by the explanatory comments left in place at the fix sites. **Confirm with operator from log timestamps before treating these as historical** — if any error appears in logs dated *after* the fix commit, the fix is incomplete.

The 1 still-unexplained error is **`Buffer is not defined`** — needs a production stack trace.

---

## 5. The `AGENT1_SYNTHETIC_FALLBACK` path — what does it produce?

**Trigger: `process-scan/index.ts:643-717`.** Sequence:

1. `callAgentWithFallback(...)` is called for Agent 1 profiler (line 644).
2. If it returns no `agent1` at all (line 660):
   - If parsed title is missing/`Unknown` → mark `invalid_input` and return error to user (lines 667-676 — operator's recent P0 fix).
   - **Else, build a synthetic Agent1 output from the parsed title + KG skill list (lines 679-716):**
     ```ts
     usedAgent1SyntheticFallback = true;
     const fallbackRole = parsedLinkedinRole;
     const fallbackSkills = Array.from(new Set([
       ...manualMatchedSkills,
       ...skillMapRows.slice(0, 8).map((skill) => skill.skill_name),
     ])).filter(Boolean);
     agent1 = {
       current_role: fallbackRole,
       execution_skills: fallbackSkills.slice(0, 3),
       strategic_skills: fallbackSkills.slice(3, 5),
       all_skills: fallbackSkills,
       primary_ai_threat_vector: "AI automation of routine execution work",
       moat_indicators: strategicFallback,
       ...
     };
     ```
3. The synthetic `agent1` then flows through the rest of the pipeline as if it were real LLM output.

**What does this produce?** A profile whose:
- `current_role` is the parsed LinkedIn title (often "Professional" or a guess).
- All "skills" are taken straight from `job_skill_map` for whatever `targetFamily` was matched. **If `targetFamily` is wrong (e.g., `fitness_trainer` from Bug 2), the synthetic skills are gym-related.**
- `primary_ai_threat_vector` is hardcoded.
- Seniority tier is derived from years_experience only (no profile signal).

This is **plausibly fabricated content** — the report shipped to the user contains skills the user does not have, mapped to an automation risk profile of a job the user does not do.

**Severity: P0** (this is the engine of fabrication — combined with Bug 2 it explains "12 vs 27 years" + invented top skills).
**Complexity: M** (best fix: when `usedAgent1SyntheticFallback === true`, **do not ship the report** — fail to `degraded`/`invalid_input` the same way the role-extraction guard does at lines 818-828).
**Risk: MED** (will increase visible failure rate, but per CLAUDE.md "fail loudly" is the operator's preference — see `Agent1:Profiler` failed_no_title fix at lines 661-676).

---

## 6. The fabrication path — the most dangerous behavior

**The single root cause for "plausible-sounding but factually wrong" reports** is the chain:

1. Profile extraction silently degrades to placeholder (Bug 1: `profile_text_length = 201`).
2. Industry resolves to `"Other"` (Bug 2.2 weak resolution path).
3. Role match returns `fitness_trainer` or another wrong row (Bugs 2.3a + 2.3b).
4. Agent 1 returns nothing useful from the placeholder text (because there is no profile to extract from).
5. **Either** Agent 1 produces a hallucinated low-quality output that passes Zod schema (lines 643-655), **or** synthetic fallback fires (Bug 5).
6. Skills get filled from `job_skill_map` of the wrong `targetFamily` (Bug 3 — `MERGED_FALLBACK`).
7. Years of experience may be overridden incorrectly: in `scan-enrichment.ts:500-507`, when the resume LLM extracts a years number that differs from user-selected by >2, **resume value silently wins** even when the resume parser returned partial data. With no resume, the user-selected `years_experience` range midpoint is used (e.g., "10+" → 12), which explains "12 years" for someone who is 27 years experienced if they picked the wrong dropdown bucket OR if the dropdown caps at 10+.

**Conclusion: there is no single "fabrication function" — fabrication is the emergent behavior of the silent-degradation chain.** Any single fix (e.g., fail-closed on `profile_text_length < 400`) cuts the chain at the source.

The deterministic engine itself (`_shared/det-*.ts`) is innocent here — it is producing correct outputs given the wrong inputs. CLAUDE.md Rule 3 forbids touching those files anyway.

---

## 7. Severity / complexity / risk inventory (consolidated)

| ID | Bug | File:Line | Sev | Cmplx | Risk |
|---|---|---|---|---|---|
| B1 | `profile_text_length = 201` synthetic placeholder fed to Agent 1 | `process-scan/index.ts:371-374` | P0 | M | MED |
| B2a | `matchRoleToJobFamily` returns `jobs[0]` for empty role → non-deterministic family | `_shared/scan-helpers.ts:347` | P0 | S | MED |
| B2b | `matchRoleToJobFamily` character-bag "similarity" at lines 367-378 | `_shared/scan-helpers.ts:367-378` | P0 | S | MED |
| B2c | `resolveIndustry` defaults to `"Other"` silently | `_shared/scan-helpers.ts:90-113` | P1 | S | LOW |
| B3  | `MERGED_FALLBACK` ships report instead of failing | `process-scan/index.ts:765-794` | P0 | S | LOW |
| B4  | `AGENT1_SYNTHETIC_FALLBACK` ships fabricated report | `process-scan/index.ts:660-717` | P0 | M | MED |
| B5  | `linkedin_name` null setter (likely already fixed) | `_shared/scan-report-builder.ts:48` | P2 | S | LOW |
| B6  | `manualKeySkills.split` (already fixed in current code) | `process-scan/index.ts:329-336` | P2 | S | LOW |
| B7  | `getKG is not defined` (already fixed) | `process-scan/index.ts:54` | P2 | S | LOW |
| B8  | `prev is not defined` (already fixed) | `process-scan/index.ts:992` | P2 | S | LOW |
| B9  | `Buffer is not defined` — source unknown | unknown (not in user code) | P2 | M | LOW |
| B10 | `years_experience` round-trip loses precision (dropdown midpoints) | `_shared/scan-helpers.ts:67-83` | P1 | S | LOW |

---

## 8. Ranked fix order

Ranking principle: **fix-priority = severity × user-visibility ÷ (complexity × risk)**, with severity weights {P0:3, P1:2, P2:1}, complexity {S:1, M:2, L:4}, risk {LOW:1, MED:2, HIGH:4}, visibility {high:3, med:2, low:1}.

| Order | ID | Bug | Score | Justification |
|---|---|---|---|---|
| 1 | **B3** | `MERGED_FALLBACK` ships instead of fails | 9.0 | Highest leverage: a 1-branch flip stops fabricated reports from ever reaching users. Cuts B1+B2+B4 cascade at the exit. |
| 2 | **B2a** | `jobs[0]` empty-role fallback | 4.5 | Eliminates non-deterministic `fitness_trainer` matches. One-line change to return null. |
| 3 | **B2b** | character-bag similarity | 4.5 | Replace with Levenshtein (already used in `parse-linkedin/index.ts:528-540`) — copy-paste known good code. |
| 4 | **B4** | `AGENT1_SYNTHETIC_FALLBACK` | 2.25 | Same fix-shape as B3; lower priority because B3 catches its downstream symptom anyway. |
| 5 | **B1** | placeholder text fed to Agent 1 | 2.25 | Add a guard: if `rawProfileText.length < N` AND no manualKeySkills, mark `invalid_input` before Agent 1 ever runs. Pairs with B3. |
| 6 | **B2c** | `resolveIndustry` defaults to `"Other"` | 1.5 | Either prompt the user or fail; depends on UI work. |
| 7 | **B10** | `years_experience` midpoint loss | 1.5 | Add a "27" or numeric input on the form so dropdown bucketing isn't the only path. |
| 8 | **B9** | `Buffer is not defined` | 0.75 | Hunt source from log stack trace; cannot fix without it. |
| 9 | **B5–B8** | Likely-already-fixed runtime errors | low | Confirm against log dates; add regression tests. |

---

## 9. Root-cause clustering — one fix that disappears multiple bugs

**B3 is the master switch.** A single change — when `usedAgent1SyntheticFallback === true` OR `fallbacksUsed.includes("all→MERGED_FALLBACK")`, return `invalid_input` to the user instead of completing the scan — would make the user-visible symptoms of **B1, B2 (entire cluster), B4** disappear. The underlying defects would still exist and still need cleanup, but **no fabricated report would reach the user during the cleanup window.**

This is the cheapest, lowest-risk action with the highest user-visible payoff. Recommend B3 first as a hot-fix, then attack the actual data-quality bugs (B1, B2a, B2b, B4) on a normal cadence.

A secondary fix-cluster: **B5, B6, B7, B8** all appear already addressed in current code. If logs confirm they stopped after the relevant commits, the only action needed is one regression test per bug to lock in the fix.

---

## 10. What this triage did not cover (knowns/unknowns)

- **Did not run any code or tests** — per task constraint and per CLAUDE.md Hazard C (test runner not installed).
- **Did not git-blame** to confirm fix dates for B5–B8 (out of scope for this read-only pass).
- **Did not pull fresh logs** — relied on operator's summary.
- **Did not inspect `job-fortress-v2/`** — per CLAUDE.md Hazard A.
- **Did not verify which orchestrator actually deploys** (CLAUDE.md Hazard A again — root vs v2 ambiguity). All file references are to the root copy. If v2 is the live one, the line numbers are wrong but the patterns likely repeat.
- **`Buffer is not defined` source** is the one open item that needs production stack-trace data.
- **`scan-pipeline.ts` (steps 6–11)** — only skimmed the input contract; did not deep-read the agent orchestration or report assembly. If fabrication is happening inside Agent 2 prompts (not just Agent 1), there is more to find there.
- **Have not verified that `degraded` events are actually being read by anyone** — the `edge_function_logs` writes happen at line 776, but if no monitoring dashboard reads them, the operator's "true failure rate" claim has no closed loop yet.
