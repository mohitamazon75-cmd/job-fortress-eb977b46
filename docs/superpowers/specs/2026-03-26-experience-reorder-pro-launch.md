# JobBachao — Experience Reorder + Pro Launch
**Date:** 2026-03-26
**Approach:** A+B Combined — UX Reorder + Monetisation Sprint
**Status:** Approved for implementation

---

## Problem Statement

JobBachao suffers four simultaneous constraints — acquisition, conversion, retention, monetisation — with roughly equal severity. Analysis shows the root cause is structural: the emotional journey has the wrong sequence, growth loops have no incentive structure, the trust anchor (social proof) cites fabricated stats, and the Pro tier cannot be purchased. All four problems share the same fix window.

---

## Fix 1 — GoalCapture Timing (Conversion)

### Problem
`GoalCaptureModal` fires when the user first clicks "Get Started" — before any value is delivered. At this moment the user has zero emotional investment and treats the questions as friction. Skip rate is high.

### Fix
Move `GoalCaptureModal` to fire **after** the score reveal — specifically after the user clicks "See Your Full Report" at the end of `VerdictReveal`. At that moment the user is emotionally activated (they just saw their score), curious about next steps, and motivated to answer intent questions accurately.

**`src/pages/Index.tsx` changes:**
- Remove `setShowGoalModal(true)` from `handleStart()`
- `handleStart()` should go directly to `setPhase('input-method')` as it did before GoalCapture was added
- Add a new handler `handleRevealComplete(goals?: ScanGoals)` that receives optional goals from the post-reveal GoalCapture and then transitions to `money-shot`
- Pass `onComplete={handleRevealComplete}` to `VerdictReveal`

**`src/components/VerdictReveal.tsx` changes:**
- After the user clicks "See Your Full Report", show `GoalCaptureModal` as an overlay (isOpen=true)
- On `GoalCaptureModal.onComplete(goals)` → call `onComplete(goals)` (parent handler)
- On `GoalCaptureModal.onSkip()` → call `onComplete()` with no goals
- The modal is non-blocking: the scan is already complete, so skipping does not degrade the experience

---

## Fix 2 — Goal-Driven Dashboard Default Tab (Conversion + Retention)

### Problem
Six equal-weight dashboard tabs (Diagnosis, Defense, Intel, Dossier, History, Coach) give first-time users no starting point. They open the dashboard and freeze.

### Fix
Use `scanGoals.intent` to pre-select the most relevant tab:

| Intent | Default Tab | Rationale |
|---|---|---|
| `actively_looking` | `defense` | Immediate action focus |
| `monitoring` | `diagnosis` | Understand current position |
| `future_planning` | `intel` | Market signals |
| No goal captured | `diagnosis` | Safe default |

**`src/components/JobBachaoDashboard.tsx` changes:**
- Accept new prop `scanGoals?: ScanGoals`
- Derive `initialTab` from `scanGoals?.intent` using the table above
- Pass `initialTab` as the initial value of the `activeScreen` state
- Add a subtle `"Recommended"` badge (small pill, primary color, 8px font) on the active tab label for first render only (remove after the user manually switches tabs)

**`src/pages/Index.tsx` changes:**
- Pass `scanGoals` state to `JobBachaoDashboard` component

---

## Fix 3 — Plain English Summary Replaces Hinglish Section (Virality)

### Problem
The "Explain to Papa" collapsible in `VerdictReveal` mixes Hindi and English. Per product direction, the app is English-only and professional. The section also has no share affordance, which wastes a high-emotion moment.

### Fix
**Remove** the "Explain to Papa" / Hinglish collapsible from `VerdictReveal`.

**Add** a "In Plain English" section immediately before the "See Your Full Report" CTA:

```
In Plain English
[2-3 sentence summary generated from the verdict text — professional, plain, non-jargon]

[Share this insight]  →  WhatsApp button + Copy button
```

The summary text is constructed client-side from existing report fields (role, score, top risk, top strength) — no new API call. Template:

> "Your Career Position Score of [N] means your role as a [role] sits in [safe/moderate/exposed] territory right now. Your strongest protection is [top moat skill]; your biggest vulnerability is [top risk skill]. The good news: you have a clear path to improve this."

Share button (WhatsApp) pre-fills:
> "Just checked my AI career risk score on JobBachao — I scored [N]/100. Find out yours: jobbachao.com"

Copy button copies the same text to clipboard.

---

## Fix 4 — Colleague Challenge CTA (Acquisition + Virality)

### Problem
Share mechanics exist (Fate Card, Money Shot, ThankYouFooter) but all are one-way broadcasts. There is no mechanic that converts a recipient into a scanner.

### Fix
Add a "Challenge a Colleague" card **above** the existing share buttons in `ThankYouFooter`:

```
┌─────────────────────────────────────────────────────┐
│  ⚡  Challenge a Colleague                           │
│  Think someone on your team is safe from AI?         │
│  Send them this test — results might surprise them.  │
│                                                     │
│  [Send on WhatsApp →]    [Copy link]                │
└─────────────────────────────────────────────────────┘
```

WhatsApp message:
> "I just checked my AI career risk score on JobBachao. Curious what yours is? Takes 2 minutes: jobbachao.com?ref=challenge"

The `?ref=challenge` UTM parameter is appended to the URL for attribution tracking. No referral reward is offered in this sprint — social pressure is the mechanism.

**`src/components/ThankYouFooter.tsx` changes:**
- Add `ColleagueChallenge` card component inline (no separate file needed)
- Place it above the existing share row
- Prophet design: border `border-primary/20`, background `bg-primary/5`, icon `⚡ Zap`

---

## Fix 5 — Social Proof Trust Repair (Conversion)

### Problem
`SocialProofSection` shows two fabricated stats:
- "92% of users report taking action within 7 days" — no source
- "3.2× higher confidence in career decisions" — no source, no methodology

These undermine the product's core credibility claim (deterministic, not hallucinated).

### Fix
Replace the three stat cards with verifiable, honest claims:

| Old (remove) | New (replace with) |
|---|---|
| "92% of users report taking action within 7 days" | Pull live scan count from DB: "X,XXX+ professionals have scanned their career risk" |
| "3.2× higher confidence in career decisions" | "Free forever — no credit card required" |
| "147 skills tracked across 95 job families" | Keep as-is — this is verifiable and true |

The live scan count is already fetched in `HeroSection` via `getScanCount()`. Extract this into a shared hook or pass it as a prop to `SocialProofSection`.

**Testimonial disclosure:**
Add below the testimonials grid, in `text-[10px] text-muted-foreground`:
> "Testimonials are illustrative of outcomes from real users. Names changed for privacy."

This one line converts the testimonials from feeling fake to feeling considered.

---

## Fix 6 — Pro Freemium Gate (Monetisation)

### Problem
Pro tier is "Coming Soon". Users who want to pay cannot. The free tier is fully generous with no upgrade motivation.

### Freemium Line

**Free (always):**
- Career Position Score
- Score Breakdown (top-level 5-pillar view)
- Top 3 skill risks (names only, no deep breakdown)
- Basic defense bullets (3 actions)
- Peer percentile indicator
- WhatsApp / social sharing
- Re-scan (score only, no history comparison)

**Pro (₹499/scan or ₹1,999/year):**
- Full skill-by-skill breakdown with automation % per skill
- Complete defense plan (all milestones, phased roadmap)
- AI Strategic Dossier (streaming)
- Market Intel tab (hiring trends, salary signals)
- Side Hustle Generator
- AI Career Coach (unlimited Q&A)
- Score history comparison (delta tracking)
- PDF export
- Priority scan queue

### New Component: `ProGateCard`

Create `src/components/ProGateCard.tsx`:

```tsx
interface ProGateCardProps {
  featureName: string;       // "AI Strategic Dossier"
  featureDescription: string; // "Get an AI-generated strategic brief..."
  icon: LucideIcon;
}
```

Renders a locked-state placeholder card with:
- Lock icon (top right)
- Feature name + description
- "Unlock Pro — ₹499/scan or ₹1,999/year" button (primary, full-width)
- Clicking opens `ProUpgradeModal`

### New Component: `ProUpgradeModal`

Create `src/components/ProUpgradeModal.tsx`:
- Two-option pricing layout: Per-scan (₹499) | Yearly (₹1,999 — save 67%)
- Feature comparison table (5 rows, Pro ticked, Free crossed)
- CTA: "Continue to Payment →"
- For now: clicking CTA shows toast "Payment launching shortly — you're on the early access list" and stores email in `waitlist` table. **Do not wire Razorpay in this sprint** — the urgency copy does the job.
- Can be dismissed

### Dashboard Gating (`JobBachaoDashboard.tsx`)

Apply `ProGateCard` to these tabs for non-Pro users:
- `intel` tab → replace `IntelTab` with `ProGateCard` (feature: "Market Intel")
- `dossier` tab → replace `DossierTab` with `ProGateCard` (feature: "AI Strategic Dossier")
- `coach` tab → replace `ReportChat` with `ProGateCard` (feature: "AI Career Coach")

Free tabs (no gate): `diagnosis`, `defense`, `history`

**User Pro status:** Check `report.user_is_pro` (boolean on ScanReport) or, if not present, default all users to free for this sprint. This can be upgraded when Razorpay is live.

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove pre-scan GoalCapture; add post-reveal handler; pass scanGoals to Dashboard |
| `src/components/VerdictReveal.tsx` | Add post-reveal GoalCaptureModal + Plain English summary section |
| `src/components/JobBachaoDashboard.tsx` | Accept scanGoals; goal-driven default tab; Pro gates on intel/dossier/coach |
| `src/components/SocialProofSection.tsx` | Replace fake stats; add testimonial disclosure |
| `src/components/ThankYouFooter.tsx` | Add Colleague Challenge card |
| `src/components/GoalCaptureModal.tsx` | No changes needed |
| `src/components/ProGateCard.tsx` | New component |
| `src/components/ProUpgradeModal.tsx` | New component |

---

## Success Metrics

| Metric | Current | Target (4 weeks post-launch) |
|---|---|---|
| Scan completion rate | Unknown | +20% (GoalCapture timing fix) |
| Share rate | Unknown | +35% (Plain English share button) |
| Colleague challenge conversion | 0 | >5% of thank-you page visitors click challenge |
| Pro upgrade intent | 0 (no button) | >8% of dashboard visitors click "Unlock Pro" |
| Testimonial trust | Unverified | Disclosed |
