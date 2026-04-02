# JobBachao — Result Page Usefulness Uplift
**Date:** 2026-04-02
**Author:** Product Lead (Claude)
**Status:** Approved for implementation
**Target:** Usefulness score 7.1 → 8.5+
**Constraint:** Simplicity score 8.2 must not regress

---

## Problem Statement

User testing returned a 7.1/10 usefulness score on the result page. The engine is already sophisticated (95 job families × 147 skill vectors, 24 calibration params, AIRMM™ 5-factor framework). The gap is not data quality — it is three structural UX failures:

1. **Hidden best content.** The AI Impact Dossier — the richest, most specific analysis — is collapsed by default. Most users never open it.
2. **Free users hit a dead end.** After score + verdict, free users see a blurred Pro teaser and an upgrade CTA. Zero concrete next step. The app delivers a verdict but not a path.
3. **Score feels arbitrary.** `peer_percentile_estimate` exists in the data but renders as 9px muted text. There is no explanation of what drives the score. Users cannot trust what they cannot understand.

**Decision:** Address communication failures, not data failures. No new form fields. No new APIs. No changes to input flow. Result page only.

---

## Scope

### In scope
- `src/components/AIDossierReveal.tsx` — result page component (920 lines)
- `supabase/functions/ai-dossier/` — AI prompt that generates dossier content
- New component: `src/components/cards/ScoreContextBar.tsx`
- New component: `src/components/cards/WhyThisScore.tsx`
- New component: `src/components/cards/FreeActionCard.tsx`

### Out of scope
- Input flow (job title field, GoalCaptureModal)
- Pro-gated features (AIRMM bars, full dossier, pivot cards)
- Pricing or upgrade flow
- New external API integrations (O*NET, BLS)
- Mobile layout (existing responsive behaviour is preserved)

---

## Design: 5 Changes

### Change 1 — Peer Comparison Bar (free, in score card)
**Where:** Inside the existing score card, below the 3-stat row.
**What:** A horizontal progress bar showing "Safer than X% of [role] professionals in India" with a vertical marker at the role average.
**Data source:** `report.survivability?.peer_percentile_estimate` (already computed, already in the report object).
**Parsing:** Strip the "top " prefix and "est. percentile" suffix from the string (e.g. `"top 48% est. percentile"` → `48`). If parsing fails, hide the bar gracefully.
**Freshness label:** "India market · [current month + year]" rendered in 9px muted text below the role/seniority line.
**Design decision:** Bar colour matches score tier (amber/green/red). Average marker is always neutral grey.

### Change 2 — "Why This Score?" Accordion (free)
**Where:** New card, inserted after the verdict card, before the Pro teaser.
**What:** A collapsed accordion labelled "🔍 Why is your score [N]?" that expands to show the 5 scoring factors as labelled progress bars with a plain-English summary sentence at the bottom.
**Default state:** Collapsed. User discovers it. Keeps the page from feeling overwhelming on first load.
**5 factors and data mapping:**

| Factor label | Data source | Display |
|---|---|---|
| Automation overlap | `report.automation_risk` | Percentage, amber/green/red |
| India hiring demand | `report.market_position_model.demand_trend` | Text + bar |
| Skill moat depth | `report.moat_skills.length` mapped to 0–100 | Low/Mid/High |
| Talent supply | `report.market_position_model.talent_density` | High/Moderate/Scarce |
| Seniority buffer | `report.seniority_tier` mapped to 0–100 | Junior/Mid/Senior/Executive |

**Summary sentence:** Generated from the dominant drag factor. E.g. if moat_skills < 3: "Your score drag comes from a thin skill moat — one targeted upskill closes most of the gap."
**No new AI call.** All data is in the existing `report` object.

### Change 3 — Auto-Expand Dossier Top (free)
**Where:** The existing `DossierCollapsible` component in `AIDossierReveal.tsx`.
**What:** After the score count-up animation completes (`scoreReady === true`), automatically set the dossier open state to `true`. The first two dossier sections are visible immediately. Remaining Pro-only sections stay below a lock indicator.
**Implementation:** The `DossierCollapsible` component currently manages its own `open` state. Lift this state up to the parent (`AIDossierReveal`) and pass `defaultOpen={scoreReady}` as a prop, or use a `useEffect` that fires when `scoreReady` flips.
**Free user sees:** "At risk in your role right now" (3 task pills) + "Your safe zones" (3 skill chips) + lock indicator for the rest.
**Fallback:** If dossier stream is still loading when score animation completes, show a subtle skeleton for the two sections until content arrives.

### Change 4 — Rewrite `ai-dossier` Edge Function Prompt
**Where:** `supabase/functions/ai-dossier/index.ts`
**What:** Replace the current prompt with a structured, India-calibrated prompt that produces consistent, parseable output.

**System prompt addition:**
```
You are a career risk analyst specialising in the Indian professional job market.
You have deep knowledge of: AI tool adoption curves in India (2024-2025),
Naukri/LinkedIn hiring trends across Indian metro markets, salary benchmarks
for Indian tech and knowledge-work roles, and the specific AI tools currently
displacing tasks in each occupation. You are precise, specific, and never generic.
Always reference current tools by their actual product names (e.g. "ChatGPT
Advanced Data Analysis", "Copilot in Power BI", "Julius AI") — never say
"AI tools" or "automation" without naming the specific product.
```

**Structured output sections the prompt must produce (in order):**
1. `## AT RISK` — exactly 3 bullet points, each a specific task, ≤ 10 words each
2. `## AI TOOLS COMPETING` — exactly 3–4 named AI tools with one-line description of what they automate
3. `## SAFE ZONES` — exactly 3 bullet points, specific to role + India market context
4. `## YOUR #1 MOVE` — one concrete action, ≤ 25 words, role + score tier specific
5. `## 90-DAY PLAN` — 4 numbered steps (the free action is step 1; steps 2–4 are Pro-only), each ≤ 15 words with an action verb
6. `## PIVOT OPTION` — one adjacent role that is safer, with reason (Pro-only)

**Data freshness:** Prompt must include current date context so the model reasons about 2025-era AI capability, not 2022-era.
**Parsing:** Frontend parses these `##` sections by heading name. If a section is missing, the component falls back gracefully (section hidden, not errored).

### Change 5 — Free Action Card (replaces dead end)
**Where:** After the dossier box, before the Pro CTA.
**What:** A new card component `FreeActionCard` that displays the `## YOUR #1 MOVE` section from the dossier as a highlighted, role-specific action. Followed by "→ 4 more specific actions in your 90-day plan" as the Pro hook.
**Score-tier copy:**
- Score ≥ 70: Framing is "reinforce your position" — consolidate moat skills
- Score 50–69: Framing is "close the gap" — one targeted upskill
- Score 30–49: Framing is "your window is now" — urgency + specific skill
- Score < 30: Framing is "first step" — smallest possible action, no overwhelm

**Replaces:** The current "Scroll down for your full defense plan / Upgrade" dead end shown to free users.
**Pro hook:** "→ 4 more specific actions in your 90-day plan" — clicking opens `ProUpgradeModal`.

---

## Data Freshness Policy

All content displayed in the result must signal recency. Concrete rules:

- Score card: show "India market · [Month Year]" where Month Year is the current month at scan time (injected from `new Date()` at render, not hardcoded)
- AI tool chips in dossier: model must reference tools by 2025 product names; prompt includes current date
- "Why this score?" accordion: Naukri reference uses "Q1 2025" or nearest current quarter
- No hardcoded year anywhere in components — always derived from `new Date()`

---

## What Does Not Change

- Input flow (job title field, industry/experience dropdowns, GoalCaptureModal)
- Page structure and scroll flow
- Pro gating on AIRMM™ bars, full 90-day plan, career pivot card
- Score computation (`computeStabilityScore`, `computeScoreBreakdown`)
- Score count-up animation (already implemented and good)
- Score colour coding (already implemented)
- `DataProvenance` component
- `ProUpgradeModal` copy (already updated in previous session)
- Mobile responsiveness

---

## Implementation Order

Execute in this order. Each step is independently deployable and testable.

| # | Change | File(s) | Estimated time | Risk |
|---|---|---|---|---|
| 1 | Peer comparison bar | `AIDossierReveal.tsx` (score card section) | 30 min | Low — pure UI, data already exists |
| 2 | Why This Score accordion | New `WhyThisScore.tsx` + import in `AIDossierReveal.tsx` | 45 min | Low — no new data, pure UI |
| 3 | ai-dossier prompt rewrite | `supabase/functions/ai-dossier/index.ts` | 90 min | Medium — affects all users, test with 10 job titles |
| 4 | Auto-expand dossier top | `AIDossierReveal.tsx` (state lift) + `DossierCollapsible` | 30 min | Low — behaviour change only |
| 5 | Free action card | New `FreeActionCard.tsx` + import + parse dossier output | 45 min | Low-medium — depends on Change 3 output structure |

**Total:** ~4 hours. Changes 1–2 have zero backend dependency. Change 3 is the highest-leverage and must be tested before shipping Changes 4–5.

---

## Success Metrics

- Primary: Usefulness score ≥ 8.5 in next user test round
- Secondary: Free user scroll depth increases (users read past the verdict)
- Secondary: Pro conversion rate holds or improves (better free experience = better upgrade intent)
- Guard rail: Simplicity score does not drop below 8.0

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ai-dossier prompt change produces inconsistent section headings | Frontend parses defensively — missing section = hidden section, never an error |
| Auto-expand dossier feels jarring if stream is slow | Only auto-expands when `scoreReady === true` (score animation done); skeleton shown during load |
| Peer bar data missing for rare job titles | Hide bar gracefully if `peer_percentile_estimate` is null or unparseable |
| "Why this score?" shows confusing values for edge-case roles | Cap factor bars at 0–100, label extremes as "Very Low" / "Very High" rather than raw numbers |
