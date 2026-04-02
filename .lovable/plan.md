# Job Fortress — Product Audit Sprint Plan
## Version 1 · March 2026 · Based on Product Audit (March 2026)

---

## HOW THESE SPRINTS WORK

Each sprint ends with a **SELF-AUDIT CHECKLIST** that MUST be verified before the sprint is marked done.
If any audit item is ❌ the sprint is incomplete — do not move on.

Sprints are ordered by **impact × effort ratio** — highest leverage first.

---

## AUDIT AGREEMENT MATRIX

| Finding | Agreement | Sprint |
|---------|-----------|--------|
| Share moment too late (Card 10) | ✅ Fully Agree | S1 |
| Re-enable Money Shot (audit's "best UX moment") | ✅ Fully Agree | S1 |
| Challenge scoreboard missing | ✅ Fully Agree | S1 |
| Career Obituary needs standalone /obituary | ✅ Fully Agree | S2 |
| Blurred pro preview at PremiumGate | ✅ Fully Agree | S2 |
| Streaming terminal progress log | ✅ Fully Agree | S3 |
| KG visualization for credibility | ✅ Fully Agree | S3 |
| Diagnostic as primary homepage CTA | 🟡 Partially — dual CTA, not full replacement | S4 |
| Onboarding too many steps | 🟡 Partially — show sample on hero, keep steps | S4 |
| ₹499 pricing | 🟡 Partially — needs A/B test, not assumption | S5 |
| Hide experimental features | 🟡 Partially — gate behind "Explore", don't delete | S5 |
| Vertical card feed on mobile | 🟡 Partially — test vs current carousel | S5 |

---

## SPRINT 1 — "Share at Peak Emotion" (Highest Leverage)
### Theme: Move viral mechanics to the emotional peak. Re-enable Money Shot. Build the share loop.
### Estimated effort: 1 day
### Expected impact: 3–5× share rate increase

### Tasks:

#### S1.1 — Re-enable Money Shot Card
- The Money Shot ("Your Replacement Invoice — what your manager sees") was hidden per user request
- The audit calls it "the single best UX moment in the product"
- Re-enable the money-shot phase in Index.tsx flow
- Ensure phase transitions: reveal → money-shot → share-moment → insight-cards

#### S1.2 — WhatsApp Share Button on Money Shot
- Immediately after the Money Shot card renders, show a large WhatsApp share button
- Pre-filled message: "My boss can replace me for ₹{amount}/month. What's YOUR replacement cost? 👉 {link}"
- Use `wa.me` deep link with URL-encoded text
- Button: full-width, WhatsApp green (#25D366), icon + "Send to a friend on WhatsApp"
- Secondary button: "Challenge a colleague" → existing challenge mechanic

#### S1.3 — Challenge Scoreboard (Complete the Loop)
- Current state: Challenge creates a code + URL but no comparison view
- Build: When respondent completes scan via challenge link:
  - Show side-by-side score comparison
  - "You scored 74. Your colleague scored 61. You're safer — for now."
  - If challenger scores higher: "You win 🛡️" with celebration animation
  - If challenger scores lower: "You're more at risk ⚠️" with urgency CTA
  - "Rematch" button to create reverse challenge
  - "Share result" to WhatsApp with both scores
- Route: `/share/challenge/:challengeCode` already exists — enhance the component

#### S1.4 — Move Share/Challenge from Card 10 to Post-Money-Shot
- Remove ShareExportCard from the deep insight cards array
- Integrate share + challenge CTAs directly into the Money Shot → share transition
- The share moment IS the card, not a separate card buried at position 10

---

### 🔍 SPRINT 1 SELF-AUDIT

| Check | How to verify |
|-------|--------------|
| ✅ S1.1 — Money Shot card appears after dossier reveal | Run a scan → after AIDossierReveal → Money Shot shows replacement cost in ₹ |
| ✅ S1.2 — WhatsApp share button visible on Money Shot | Money Shot card → large green WhatsApp button visible below the card |
| ✅ S1.2 — WhatsApp link opens with pre-filled text | Tap WhatsApp button → wa.me link opens with score + link in message |
| ✅ S1.3 — Challenge comparison shows both scores | Complete a challenge → comparison view shows challenger vs respondent |
| ✅ S1.3 — Winner/loser state renders correctly | Higher scorer sees "You win" badge; lower sees urgency CTA |
| ✅ S1.4 — Share card no longer appears as Card 10 in insight flow | Complete full insight card flow → no duplicate share card at end |

---

## SPRINT 2 — "Conversion & Acquisition Funnels"
### Theme: Unlock conversion with pro previews. Create standalone viral acquisition routes.
### Estimated effort: 1.5 days
### Expected impact: 2–3× pro conversion, new organic acquisition channel

### Tasks:

#### S2.1 — Blurred Pro Preview in PremiumGate
- Current PremiumGate shows "Unlock with Pro" — a brick wall
- Change to: show 3-5 lines of actual pro content (from the scan report) with:
  - CSS `filter: blur(4px)` on the preview text
  - Gradient fade overlay at bottom
  - "Unlock full analysis →" button overlaid
- Content sources per card type:
  - AI Dossier: first 3 sentences of streaming dossier
  - Resume Weaponizer: "We found 4 critical gaps in your positioning..."
  - Best-Fit Jobs: show 2 job titles blurred with company names
  - Career Pivot: show pivot direction blurred
- The user must SEE what they're paying for

#### S2.2 — Standalone /obituary Route
- Career Obituary generates highly shareable, darkly funny content
- Currently locked behind full auth + scan flow
- Build standalone route:
  - `/obituary` — landing page with sample obituary + 30-second form
  - Form: Job title, years experience, industry (3 fields only)
  - No auth required (use diagnostic-style anonymous flow)
  - Generate obituary via existing career-obituary edge function
  - Result page with share buttons (WhatsApp, LinkedIn, Twitter)
  - "Want your full career risk analysis? →" CTA to main flow
- SEO: dedicated meta tags, OG image, structured data

#### S2.3 — Standalone /diagnostic as SEO Landing Page
- The diagnostic already works standalone at `/diagnostic`
- Enhance with:
  - Dedicated SEO meta tags: "Will My Boss Replace Me? Free AI Career Risk Test"
  - Own OG image showing a sample risk gauge
  - Schema.org FAQ structured data for "AI job replacement" queries
  - Internal link from main hero section

---

### 🔍 SPRINT 2 SELF-AUDIT

| Check | How to verify |
|-------|--------------|
| ✅ S2.1 — PremiumGate shows blurred preview content | Hit any pro-gated card → see 3-5 lines of blurred real content + unlock button |
| ✅ S2.1 — Blur + fade overlay looks professional | Visual check: text is readable enough to intrigue but not to use |
| ✅ S2.2 — /obituary loads without auth | Open /obituary in incognito → form renders, no login required |
| ✅ S2.2 — Obituary generates and shows share buttons | Fill form → obituary text appears → WhatsApp + LinkedIn share buttons work |
| ✅ S2.3 — /diagnostic has dedicated OG tags | View page source → og:title, og:description, og:image are diagnostic-specific |

---

## SPRINT 3 — "Make the Wait Feel Like Depth"
### Theme: Transform perceived latency from "slow" to "intelligent". Surface hidden intelligence.
### Estimated effort: 1.5 days
### Expected impact: Reduce processing-phase drop-off by 40%+

### Tasks:

#### S3.1 — Streaming Terminal Progress Log
- Replace the current generic "Preparing your analysis..." loading screen
- Build a terminal-style progress display showing real analysis steps:
  ```
  ▶ Parsing LinkedIn profile...                    ✓ done
  ▶ Matching against 95 job families...             ✓ done
  ▶ Scanning 147 skill vectors for risk...          ▶ in progress
  ▷ Cross-referencing market signals (30d)...       ○ queued
  ▷ Computing replacement cost model...             ○ queued
  ▷ Generating strategic dossier...                 ○ queued
  ```
- Steps should be time-gated (not tied to actual backend progress):
  - Show each step for 3-5 seconds with realistic timing
  - Steps should complete roughly in sync with actual scan duration
  - If scan completes early, accelerate remaining steps
  - If scan takes longer, add "Deep analysis in progress..." filler steps
- Design: dark terminal background, monospace font, green/amber text
- Include: "Analysing across X data points" counter that increments

#### S3.2 — Knowledge Graph Visualization Widget
- The KG (95+ job families, 147+ skill vectors) is invisible to users
- Build a compact "Your Career Intelligence Map" widget:
  - Shows user's detected role as central node
  - Connected nodes: top 5 related job families from KG
  - Edge labels: skill overlap percentage
  - Simple force-directed or radial layout (not full D3 — use SVG + framer-motion)
  - "Your skills mapped across 147 vectors" subtitle
- Place in: AIDossierReveal or as first insight card
- Purpose: makes the intelligence tangible, builds credibility, justifies the product

#### S3.3 — "Intelligence Depth" Badge on Dossier
- Small badge on the AI Dossier card header:
  - "Powered by 95 job families · 147 skill vectors · 30-day market signals"
- Tooltip on tap: "Our Knowledge Graph tracks [detected role] across [X] related roles and [Y] skill dimensions"
- Subtle credibility signal — not flashy, just confident

---

### 🔍 SPRINT 3 SELF-AUDIT

| Check | How to verify |
|-------|--------------|
| ✅ S3.1 — Terminal progress log appears during processing | Start a scan → processing phase shows terminal-style step log |
| ✅ S3.1 — Steps animate in sequence with realistic timing | Watch full processing → steps appear 3-5s apart, checkmarks appear |
| ✅ S3.1 — Early scan completion accelerates remaining steps | (If scan finishes fast) remaining steps quickly complete and transition |
| ✅ S3.2 — KG visualization shows user's role + connected families | After scan → KG widget visible with central node + 5 connected nodes |
| ✅ S3.2 — Widget is interactive (tap nodes for detail) | Tap a connected node → shows skill overlap % |
| ✅ S3.3 — Intelligence depth badge visible on dossier | Dossier card header → badge shows job family + skill vector counts |

---

## SPRINT 4 — "Hero Redesign & Onboarding Optimization"
### Theme: Show value before asking for input. Make the diagnostic the primary entry point.
### Estimated effort: 2 days
### Expected impact: 2× cold traffic conversion

### Tasks:

#### S4.1 — Dual-CTA Hero Redesign
- Current hero: single CTA to start scan flow
- New hero layout (above the fold):
  - **Primary CTA (80% of visual weight):** "Will My Boss Replace Me?" 
    - Subtitle: "Free · 3 minutes · No sign-up"
    - Links to /diagnostic
    - This is the low-friction entry for cold traffic
  - **Secondary CTA (20% of visual weight):** "Get Your Full Career Intelligence Report"
    - Subtitle: "LinkedIn or Resume · AI-powered deep scan"
    - Links to existing scan flow (input-method phase)
    - This is for users who already trust the product
- Design: diagnostic CTA is the hero card (large, animated); scan CTA is a refined secondary button below
- Do NOT remove the scan flow — it remains for returning/high-intent users

#### S4.2 — Sample Result Preview on Hero
- Below the CTAs, show a redacted/anonymized sample result:
  - A mini Money Shot card: "Sample: A Marketing Manager in Bengaluru · Replacement cost: ₹18,400/mo"
  - A mini gauge showing a sample score (e.g., 67/100 risk)
  - "This is what you'll get in 3 minutes →" label
- Purpose: show value before asking for any input
- Use static data, not a live API call
- Subtle animation: the sample score "ticks up" on scroll-into-view

#### S4.3 — Smart Onboarding Step Reduction
- Current: Country → Industry → Experience → Metro → Skills (5 steps)
- LinkedIn/Resume path already skips Skills — good
- Additional optimization:
  - Auto-detect metro from timezone + browser locale (already partially done)
  - If LinkedIn URL provided: auto-detect industry from LinkedIn (if parse-linkedin returns it)
  - Show a "Confirm your details" summary step instead of individual steps where possible
  - Target: 2-3 taps maximum for LinkedIn users, 4 taps for manual
- Do NOT remove steps that affect scan quality — just reduce friction

---

### 🔍 SPRINT 4 SELF-AUDIT

| Check | How to verify |
|-------|--------------|
| ✅ S4.1 — Hero has two distinct CTAs | Load homepage → two CTAs visible: diagnostic (primary) + full scan (secondary) |
| ✅ S4.1 — Diagnostic CTA links to /diagnostic | Click primary CTA → navigates to /diagnostic |
| ✅ S4.1 — Full scan CTA starts scan flow | Click secondary CTA → enters input-method phase |
| ✅ S4.2 — Sample result preview visible on hero | Scroll hero → mini Money Shot + gauge visible with sample data |
| ✅ S4.2 — Sample is clearly labeled as sample | "Sample result" or "Example" label visible — not misleading |
| ✅ S4.3 — LinkedIn path is ≤3 taps to processing | Enter LinkedIn URL → auth → confirm details → processing (3 taps) |
| ✅ S4.3 — Manual path still captures all needed data | Skip LinkedIn → manual onboarding → all 5 data points captured |

---

## SPRINT 5 — "Scope Cleanup & Pricing Polish"
### Theme: Reduce surface area. Optimize pricing presentation. Test mobile card format.
### Estimated effort: 1.5 days
### Expected impact: Cleaner UX, better conversion, reduced cognitive load

### Tasks:

#### S5.1 — Gate Experimental Features Behind "Explore More"
- Features to gate: Panchkosha, Weaponised Laziness, Fate Card, Startup Autopsy
- Do NOT delete — these add personality and may convert specific user segments
- Implementation:
  - After the main insight cards flow, add an "Explore More" expandable section
  - "🔬 Experimental: These features are in beta" label
  - Collapsed by default — user must explicitly tap to see them
  - Track open rate to measure interest

#### S5.2 — Gate AI Debate Behind Pro Tier
- Career Genome Debate (3 agents argue your fate) costs 3× API tokens
- Move behind PremiumGate with blurred preview (from S2.1)
- Preview text: "3 AI analysts debated your career for 47 seconds. See who won →"
- Free users see the debate topic + blurred verdict; pro users get full debate

#### S5.3 — Annual Plan as Default Pricing Anchor
- Current pricing page: review layout
- Changes:
  - Lead with ₹1,999/year (show as "₹167/month")
  - Position ₹499/scan as "Try once" option (smaller, secondary)
  - Add "Most Popular" badge on annual plan
  - Show savings: "Save 67% vs per-scan pricing"
- Note: actual price changes require Razorpay configuration — this sprint is UI only

#### S5.4 — Vertical Card Feed Test on Mobile
- Current: horizontal carousel for insight cards
- The audit says "most users never see cards 4-16"
- Build: vertical scrollable stack with "Next →" momentum indicators
  - Each card takes ~80vh on mobile
  - Subtle up-arrow animation suggesting scroll
  - Card counter: "3 of 7" in top-right
  - Snap-scroll behavior between cards
- Initially behind a feature flag or viewport check (mobile only)
- Measure: card visibility rate (% of users who see each card)

---

### 🔍 SPRINT 5 SELF-AUDIT

| Check | How to verify |
|-------|--------------|
| ✅ S5.1 — Experimental features behind "Explore More" | Complete insight flow → "Explore More" section visible, collapsed |
| ✅ S5.1 — Tapping "Explore More" reveals experimental cards | Tap → Panchkosha/Autopsy/etc. appear with beta label |
| ✅ S5.2 — AI Debate shows blurred preview for free users | Free user → Debate card → blurred verdict + "Unlock" button |
| ✅ S5.3 — Annual plan is visually primary on pricing page | /pricing → annual plan is largest/most prominent card |
| ✅ S5.3 — "Most Popular" badge on annual plan | Visual check on pricing page |
| ✅ S5.4 — Mobile shows vertical card stack | Open on mobile viewport → cards stack vertically with scroll |
| ✅ S5.4 — Card counter visible | Each card shows "X of Y" indicator |

---

## EXECUTION ORDER

```
Sprint 1 (Share at Peak)           ← Highest ROI. 1 day. Do this FIRST.
Sprint 2 (Conversion Funnels)      ← Second highest. 1.5 days. New acquisition channels.
Sprint 3 (Perceived Performance)   ← 1.5 days. Reduces drop-off during processing.
Sprint 4 (Hero & Onboarding)       ← 2 days. Cold traffic conversion.
Sprint 5 (Scope & Pricing)         ← 1.5 days. Polish and cleanup.
```

Total estimated effort: ~7.5 days across 5 sprints.

---

## WHAT "DONE" MEANS FOR EACH SPRINT

A sprint is only DONE when:
1. All task items are implemented in code
2. ALL self-audit checklist items are ✅ verified by actually opening the preview and checking
3. No TypeScript build errors introduced
4. No regressions in existing working features
5. Analytics events fire for new interactions (share, challenge, upgrade gate views)

**DO NOT mark a sprint done based on code written alone. Verify in preview.**
