# KidSutra — Bug Tracker (30 Bugs)

**QA Build:** v3 | **Tester:** QA Team | **Test Profile:** Aarav, 8yr, ADHD, 130cm/28kg

---

## 🔴 CRITICAL (4)

- [x] **BUG-01** — XSS Injection in Name Field
  - ✅ Fixed: `sanitizeName()` strips HTML tags and non-name chars; applied at Register.tsx + AppContext.

- [x] **BUG-02** — Full State Loss on Refresh
  - ✅ Fixed: AppContext mount effect only wipes legacy unscoped keys; all 3 assessments have full localStorage rehydration.

---

## 🟠 HIGH (14)

- [x] **BUG-05** — Ordinal suffix broken ("1th", "73th")
  - ✅ Fixed: Proper `ordinal()` function in PhysicalAssessment, CognitiveAssessment, Register.

- [x] **BUG-06** — BMI not auto-calculated from Height/Weight
  - ✅ Fixed: Register.tsx Step 2 computes BMI = weight / (height/100)² on both height and weight onChange; displays live preview.

- [x] **BUG-07** — Eggs question shows for Vegetarian child
  - ✅ Fixed: NutritionAssessment filters `isVegetarian` check on `["vegetarian","vegan","jain","lacto_veg"]`; egg question hidden.

- [x] **BUG-08** — ADHD consent page shows ASD examples
  - ✅ Fixed: CognitiveAssessment consent generates ND-specific text per actual `ndProfiles` array (ADHD → ADHD text, ASD → ASD text, etc.).

- [x] **BUG-09** — Slider click doesn't update value display
  - ✅ N/A: Physical Assessment uses 4-level button cards, not sliders — no slider bug exists in current codebase.

- [x] **BUG-10** — "Next Metric" disabled despite default slider value
  - ✅ N/A: Same as BUG-09 — button-based selector, Next is enabled as soon as a level card is tapped.

- [x] **BUG-11** — Pattern Match Option 1 renders blank
  - ✅ Fixed: Plain text labels used throughout; correct answer tracked by value not index.

- [x] **BUG-12** — Weight field accepts 999kg / -10kg
  - ✅ Fixed: Register.tsx validates weight 5–150kg with `min="5" max="150"` + step2Errors validation.

- [x] **BUG-13** — Question content fades to near-invisible
  - ✅ Fixed: Explicit `text-foreground` class on wellbeing question text; no opacity fade.

- [x] **BUG-23** — Reaction Time Score Shows 1068
  - ✅ Fixed: `reactionLabel()` converts raw ms to human label (e.g. "Lightning Fast", "Average Speed"); result screen shows label not raw number.

- [x] **BUG-24** — Pattern Matching Questions Same Every Session
  - ✅ Fixed: `buildPatternQuestions()` calls `fisherYates()` on question order per mount.

- [x] **BUG-25** — All Pattern Matching Correct Answers Are Option A
  - ✅ Fixed: Options shuffled per question; correct index derived AFTER shuffle by `.indexOf(correctValue)`.

- [x] **BUG-27** — Parent vs Child Role Unclear in Part 2
  - ✅ Fixed: Warning banner "👩‍👦 Parent answers — please take the phone back…" shown at top of every wellbeing question.

- [x] **BUG-29** — Nutrition Test Jumps to Parent Questions Without Warning
  - ✅ Fixed: `showIntro` intro screen with "👩‍👦 This section is for the parent" role banner before first question.

---

## 🟡 MEDIUM (12)

- [x] **BUG-14** — Name field accepts numbers ("123")
  - ✅ Fixed: `validateName()` in Register.tsx requires `/^[a-zA-Z\u00C0-\u024F\s'-]{2,100}$/`.

- [x] **BUG-15** — City accepts single character ("H")
  - ✅ Fixed: `validateCity()` requires `city.trim().length >= 2`.

- [x] **BUG-16** — City tier not auto-mapped from Step 1
  - ✅ Fixed: `CityAutocomplete` onChange calls `detectCityTier()` and sets `childData.cityTier` immediately; confirmed auto-detection banner shows in Step 3.

- [x] **BUG-17** — "Add Child" opens full 3-step wizard
  - ✅ Fixed (v3): QuickAddChildModal now collects Name + Age + Gender + Diet inline, sets sensible defaults for other fields, and navigates directly to assessment-hub — no full wizard.

- [ ] **BUG-18** — Inconsistent button colors across assessments
  - 📍 UI — Low priority cosmetic; all primary CTAs use `bg-primary`; minor variance in secondary actions. Track for v4 design pass.

- [ ] **BUG-19** — Progress bar colors vary with no legend
  - 📍 UI — `PercentileLegend` component exists and is rendered on all review screens. Residual variance in intermediate states. Track for v4.

- [x] **BUG-20** — Calories 10th percentile vs Protein/Calcium 99th
  - ✅ Fixed: Raised BASE_INTAKE calories from 1200→1450.

- [x] **BUG-21** — Loading spinner persists on Dev Obs Q9
  - ✅ Fixed: `handleWellbeingSelect` on last question (index 9) immediately advances to review phase without setTimeout.

- [x] **BUG-22** — Q9 Nutritional answer options inconsistent order
  - ✅ Fixed: Sunlight options standardized to "Rarely or never → Daily" ascending.

- [x] **BUG-26** — Emotional Matching Score Shows "3" — No Context
  - ✅ Fixed: Shows "3 / 8 correct answers"; memory shows "X tiles"; focus shows "X / 100 accuracy".

- [x] **BUG-28** — Cognitive Performance Chart Rank Unclear
  - ✅ Fixed: Review screen shows "Overall Cognitive Rank · vs. same-age Indian children · 50th = average peer".

- [x] **BUG-30** — Nutrition Performance Chart Rank Unclear
  - ✅ Fixed: Same pattern applied to wellbeing composite rank card.

---

## 🔐 Security Fixes (from Audit)

- [x] **SEC-01** — blueprint-research edge function missing JWT auth
  - ✅ Fixed: Added `getClaims()` JWT validation identical to perplexity-research; returns 401 for unauthenticated requests; input capped at 500 chars.

---

## Sprint Plan

### Sprint 1 — Critical ✅ Done
BUG-01, BUG-02

### Sprint 2 — High ✅ Done
BUG-05 → BUG-13, BUG-17, BUG-23 → BUG-25, BUG-27, BUG-29

### Sprint 3 — Medium ✅ Done (except cosmetic)
BUG-14 → BUG-22, BUG-26, BUG-28, BUG-30

### Sprint 4 — Cosmetic (track for v4 design pass)
BUG-18, BUG-19
