# Invariants — the rules the product must never violate

> **Purpose**: Every "new P0" discovered in an audit was always-true; we just hadn't written it down. This file ends that loop. Every audit finding becomes (a) one line here and (b) one test in `src/test/invariants.test.ts`. After ~50 invariants, audits stop "finding new things" and start verifying a finite, known surface.
>
> **Rule**: A change is not "done" until any invariant it touches is reflected here AND has a passing test. CI blocks merge if `bun run test` fails.

---

## How to use this file

1. **Before changing code**: skim the section that matches the file you're touching. If your change would violate an invariant, the invariant is wrong OR your change is wrong — stop and decide.
2. **When an audit finds a "new" issue**: add it here in plain English, then add a failing test that asserts it, then fix the code so the test passes. Same PR.
3. **When you're tempted to write a clever fix**: check if the invariant exists. If not, write it first.

Format: each invariant has an **ID** (stable, never reused), a **rule** (one sentence, testable), a **test** reference, and a **why** (one line — the bug or class of bugs it prevents).

---

## I. Scoring & display invariants

**INV-S01** — Career Position Score = `100 - determinism_index`, clamped to `[0,100]`.
- Test: `invariants.test.ts › score sign semantics › Career Position Score = 100 - determinism_index`
- Why: every audit round we kept finding screens that displayed raw DI as if it were the safety score. They are inverses.

**INV-S02** — Higher determinism_index never produces a higher Career Position.
- Test: same suite, "higher determinism_index never produces a higher Career Position"
- Why: catches sign flips during refactors of the scoring engine.

**INV-S03** — `computeStabilityScore` output is always within the calibrated band `[5, 95]`.
- Test: same suite, "computeStabilityScore output is always in [5,95]"
- Why: prevents off-by-one bugs that leak `0` or `100` into hero copy ("0% safe" reads as a bug, not an insight).

**INV-S04** — Score delta direction matches the narrative verb. Rising DI → "dipped"; falling DI → "improved"; equal → "unchanged".
- Test: `invariants.test.ts › score delta direction`
- Why: this exact bug shipped to prod once. compute-delta said "improved" while DI was rising.

**INV-S05** — Hero score and history score are on the same axis (higher = safer). They may differ in calibration but never in direction.
- Test: `invariants.test.ts › cross-screen display parity`
- Why: returning users compared the two screens and screenshotted the contradiction.

**INV-S06** — All bounded scores stay in their declared range: `shield_score`, `risk_score`, `ats_avg`, `determinism_index`, `Career Position` ∈ `[0,100]`.
- Test: `invariants.test.ts › bounded scores stay within their band`
- Why: float drift during averaging produced `100.0001` which broke the gauge component.

## II. Data-truthfulness invariants

**INV-D01** — Risk is reported as the enum `HIGH | MEDIUM | LOW`. Raw `risk_pct` numbers must not appear in any UI surface.
- Test: `invariants.test.ts › risk_level uses enum, not pct`
- Memory: `mem://logic/risk-level-assessment-hierarchy`
- Why: numeric percentages imply a precision the model does not have. Banned by founder mandate.

**INV-D02** — Any salary string surfaced to the user must contain an INR anchor (`₹`, `INR`, `Rs.`, `LPA`, `lakh`, `crore`, `Cr`, `per annum`, `p.a.`, `CTC`). Otherwise it must be `null`.
- Test: `invariants.test.ts › salary string must be anchored`
- Why: catches LLM hallucinations that returned `"15-25"` or `"$120,000"` (we are India-only).

**INV-D03** — No analysis surface fabricates numbers it cannot ground. Every numeric claim must come from the deterministic engine, the resume, or a cited market source.
- Test: *manual review per `AUDIT_CHECKLIST_v1.md` § Hallucination*. (No automated test yet — track in BACKLOG.)
- Why: this is the product's central promise. Violating it = brand-existential.

**INV-D04** — Indian market only. No US/EU salaries, no global cohort comparisons. Geo-grounding fallback is Naukri / Amazon India / MCA / Tofler.
- Memory: `mem://logic/geospatial-grounding-standards`
- Why: catches city defaulting bias (Bangalore-everything).

## III. State & lifecycle invariants (frontend)

**INV-F01** — Every async `setState` is guarded by a mounted-ref or generation-ref so a stale response from scan A cannot overwrite scan B.
- Test: *needs invariant test* — see BACKLOG INV-F01-test.
- Why: round 2 found `actionModal` leaking across `scan_id` changes.

**INV-F02** — Streak counters reset to 1 after a calendar gap of ≥2 days. They do not increment monotonically.
- Test: *needs unit test* — see BACKLOG INV-F02-test.
- Why: round 3 found this exact bug.

**INV-F03** — Progress indicators reflect actual work completed (e.g., `visitedCards.size`), not the index of the active tab.
- Test: *needs unit test* — see BACKLOG INV-F03-test.
- Why: round 3 finding. Users hit "100%" by tabbing once.

**INV-F04** — Every `useEffect` either has a cleanup function or a comment explaining why none is needed.
- Test: ESLint rule (planned) — see BACKLOG.
- Why: subscription leaks were the #1 source of "stale data" tickets.

**INV-F05** — Inline `<style>` blocks and inline `@keyframes` are forbidden. Animations live in CSS files (e.g., `model-b-tokens.css`).
- Test: ESLint rule (planned) — see BACKLOG.
- Why: per-render style injection thrashes the CSSOM.

## IV. Security & monetization invariants

**INV-X01** — `TESTING_BYPASS` is `false` in any code path that ships to production. Pro features are gated by real subscription state.
- Test: grep guard (planned) — see BACKLOG.
- Hazard: `_shared/subscription-guard.ts` per CLAUDE.md Hazard D.
- Why: currently violated. All Pro features are accessible to free users.

**INV-X02** — Subscription/role checks happen server-side. Client never trusts `localStorage`/`sessionStorage` for entitlement.
- Memory: `<user-roles>` system prompt section.
- Why: client-side entitlement = trivial bypass.

**INV-X03** — No raw SQL constructed from user input. All edge-function DB calls use the typed Supabase client with parameters.
- Test: grep guard for `execute_sql` and string concatenation in `.sql()`.
- Why: SQL injection class.

**INV-X04** — One payment = one analysis. A Razorpay charge unlocks exactly the scan it was attached to.
- Memory: `mem://business/monetization-constraints`
- Why: founder mandate; protects margin.

**INV-X05** — Edge functions with `verify_jwt = false` perform JWT validation in code (or are explicitly public-by-design and documented as such).
- Test: lint rule (planned).
- Why: default-off auth surface.

## V. Tone & content invariants

**INV-C01** — Risk language is *indicative*, not absolute ("significant disruption risk", not "you will be replaced").
- Memory: `mem://style/tone-and-liability-calibration`, `mem://style/verdict-narration-standards`
- Test: prompt-side regex check (manual).

**INV-C02** — No jargon. Max 12 words per sentence in user-facing copy.
- Memory: same as above.

**INV-C03** — DPDP Act 2023 compliance: 90-day retention, explicit PII consent, cascading delete.
- Memory: `mem://project/data-privacy-and-retention`

## VI. Build & infrastructure invariants

**INV-B01** — `bun run lint` is clean before merge.
**INV-B02** — `bun run test` is green before merge (currently 194 tests).
**INV-B03** — `bun run build` succeeds before merge.
**INV-B04** — No file exceeds 500 lines without an explicit override note in `docs/DECISIONS.md`. Existing god files (per CLAUDE.md Hazard F) are grandfathered.
**INV-B05** — Migrations are append-only. No file in `supabase/migrations/` is ever edited after merge.

---

## How invariants get added

```
[round of work] → [audit finds X is wrong]
                    ↓
                add INV-?? line here     ← this file
                    ↓
                add test in invariants.test.ts (failing)
                    ↓
                fix the code (test goes green)
                    ↓
                merge. invariant is now permanent.
```

After ~50 invariants, the audit space is bounded. Future audits run `AUDIT_CHECKLIST_v1.md` against `INVARIANTS.md` and report only *new categories*, never rediscoveries.
