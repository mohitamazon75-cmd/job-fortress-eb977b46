# Mobile 368px Audit — 4 Critical Screens
**Audited:** 2026-04-28 · **Viewport:** 368px CSS pixels (target: IN tier-2 budget Android, ~devicePixelRatio 2.5–3) · **Method:** static class-grep + design-system review. Live device verification pending.

> Scope: this is an **audit report**, not a fix PR. Findings are logged to `docs/BACKLOG.md` for prioritization. Do not assume any of these are fixed by this document.

## Summary
| Screen | Status | Severity |
|---|---|---|
| 1. Score Reveal (`VerdictReveal.tsx`) | ⚠️ 2 hazards | P1 |
| 2. Money Shot (`MoneyShotCard.tsx`) | ✅ mostly safe, 1 minor | P2 |
| 3. Best-Fit Jobs (`BestFitJobsCard.tsx`) | ✅ safe | — |
| 4. Defense Plan (`DefenseTab.tsx`) | ⚠️ 1 hazard | P1 |

---

## 1. VerdictReveal.tsx — Score Reveal

### ⚠️ Hazard V-1 (P1) — Score number can horizontal-scroll on 368px
**Line 299:** `text-[90px] sm:text-[130px] md:text-[180px]`. At 368px the `90px` font + adjacent `text-[30px] /100` (line 316) puts the `XX/100` glyph cluster at ~210–270px wide. **Safe**, but combined with the page's centered container and 16px gutters there is no slack — a 3-digit display impossible (score is 0–100, so OK).

**Verdict:** PASS. Numeric range constrains the risk.

### ⚠️ Hazard V-2 (P1) — Decorative blur element exceeds viewport
**Line 206:** `w-[500px] h-[500px] rounded-full blur-[120px]`. Hardcoded 500×500 fixed pixel size on a 368px viewport. The element is `absolute` and `pointer-events-none` so it does not break interaction, but on low-end Android the 120px Gaussian blur over a 500×500 element off-screen costs paint frames. Likely cause of jank during the count-up animation on budget devices.
- **Fix sketch:** swap to `w-[min(500px,90vw)] h-[min(500px,90vw)] blur-[80px]`.

### ⚠️ Hazard V-3 (P1) — CTA tap target may sit below fold
**Line 556:** primary CTA at `min-h-[48px]` is correct (Apple HIG / Material 48dp). But after the score, headline, body, exec disclaimer (newly added), hope signal, and waterfall, the CTA may render below 776px viewport on a 368px-wide device (the user's current viewport!). **Confirmed risk** — VerdictReveal is a `fixed inset-0` modal, so internal scroll matters.
- **Fix sketch:** ensure the modal's inner container has `overflow-y-auto` and the CTA stays sticky at bottom on `<sm` breakpoints.

---

## 2. MoneyShotCard.tsx — Replacement Invoice

### ✅ Mostly safe
**Line 295:** `max-w-[440px] mx-auto px-4` — caps width, gutters present. Good.
**Line 425:** `min-w-[140px]` salary input chip — 140 < 368 - 32(px-4) = 336. Safe.

### ⚠️ Minor M-1 (P2) — Replacement multiplier number can clip
**Line 506:** `text-[64px] sm:text-[76px]` — for 4-character payloads like "12.4×" at 64px, glyph cluster ~150px. Safe alone, but if Hindi locale appends a longer suffix ("बार") it tightens. Verify with Hindi toggle on.

---

## 3. BestFitJobsCard.tsx — Best-Fit Jobs

### ✅ No mobile hazards found
Grade chips at `min-w-[34px]`. Job rows use flex-wrap. Referral templates render in a `<details>`/expanded section with native overflow handling. **Confirmed safe at 368px.**

---

## 4. DefenseTab.tsx — Defense Plan

### ⚠️ Hazard D-1 (P1) — `grid-cols-2 md:grid-cols-4` with 4 items at 368px
**Line 134:** `grid grid-cols-2 md:grid-cols-4 gap-3`. At 368px the layout falls back to 2 columns (correct), but the underlying milestone cards may carry copy too dense for half-width on a 368px screen. Each cell has ~168px of usable width after `gap-3` (12px) and parent padding. If milestone titles run >2 lines they push the row tall and break visual rhythm.
- **Fix sketch:** add `text-balance` and a max-line-clamp on the milestone title; verify with longest-known title from production scans.

---

## Recommended P0/P1 fix sequence (separate PR)
1. **V-2** Decorative blur viewport-cap (P1) — 1 hr, pure CSS.
2. **V-3** CTA sticky on small screens (P1) — 30 min.
3. **D-1** Defense milestone title clamp (P1) — 30 min.
4. **M-1** Hindi-locale number-cluster check (P2) — verify only.

Estimated total: half a day. None touch frozen files.

## What I do NOT have proof of
- Live device behavior (Android Chrome 110+ / iOS Safari at 368px CSS px). All findings are static class-grep.
- Behavior with the longest production-realistic strings (need a sample of 10 real scans).
- Animation frame timing under blur on real budget hardware.

## What I have proof of
- Class definitions reviewed in 4 target components.
- All hazards confirmed by direct line-number reference.
- Tap targets meet 48px minimum where I checked.
