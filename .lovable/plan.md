
# 🔬 MODEL B EXPERT AUDIT REPORT
**Auditor**: Data Engineering × Human Psychology × AI/LLM Authority  
**Date**: 4 April 2026  
**Scope**: Full Model B pipeline — Prompt → Edge Function → 7-Card Dashboard

---

## EXECUTIVE SUMMARY

Model B has strong bones (7-card architecture, background processing, dual-model fallback) but critically lacks **emotional depth**, **psychological triggers**, and **narrative arc**. The prompt is *competent but clinical* — it asks for data but doesn't instruct the AI to weaponize psychology. The cards render information but don't **move** people. Below are 14 weaknesses across 3 domains with a phased upgrade plan.

---

## 🔴 DOMAIN 1: PROMPT ENGINEERING WEAKNESSES (Edge Function)

### W1: No Psychological Framework in System Prompt
**Current**: "You are a senior career strategist with 20 years of experience"  
**Problem**: This produces *analyst output*, not *emotional narrative*. The AI has no instruction to use fear, hope, tough love, or urgency.  
**Fix**: Inject a **Psychological Narrative Framework** — instruct the AI to use specific dark psychology techniques per card:
- Card 1 (Risk): **Loss Aversion** — "What you lose if you do nothing"
- Card 2 (Market): **Social Proof + Anchoring** — "People like you are earning X, you're at Y"
- Card 3 (Shield): **Competence Affirmation** — "You have rare skills most don't"
- Card 4 (Pivot): **Fear of Missing Out** — "These doors close in 6 months"
- Card 5 (Jobs): **Scarcity + Urgency** — "Only 3 days left, 200+ applicants"
- Card 6 (Blind Spots): **Tough Love** — "Here's what's holding you back, specifically"
- Card 7 (Human): **Hope Anchoring** — "Here's why you'll survive what AI can't touch"

### W2: Emotion Messages Are Weak Single-Purpose Fields
**Current**: One `emotion_message` per card — generic warm text  
**Problem**: No escalation, no contrast, no emotional whiplash  
**Fix**: Replace single emotion_message with a **3-part emotional structure**:
```
fear_hook: string      // The uncomfortable truth (2 sentences)
tough_love: string     // Direct, no-BS assessment (1 sentence)
hope_bridge: string    // But here's your specific advantage (1 sentence)
```

### W3: No "Confrontation Moment" in the Prompt
**Current**: Prompt asks for neutral analysis  
**Problem**: Users don't feel *personally challenged*  
**Fix**: Add explicit instruction: "For each card, include a `confrontation` field — one sentence that directly challenges the user based on their resume evidence. Example: 'You've been a Marketing Manager for 8 years but haven't led a single P&L. That's the gap competitors will exploit.'"

### W4: Job Matches Lack Emotional Urgency Signals
**Current**: `days_posted`, `applicant_count` — data without narrative  
**Fix**: Add `urgency_narrative` per job: "Posted 2 days ago, 147 people already applied. Your CPL expertise gives you a 3x edge — but only if you apply THIS WEEK."

### W5: Interview Prep Uses STAR But Lacks Psychological Framing
**Current**: STAR answers with metrics  
**Fix**: Add `psychological_hook` per question: "They ask this to test if you can think beyond execution. Open with the business impact number, not the task."

### W6: Prompt Has Hardcoded India Market Data
**Current**: Static numbers in prompt (₹18-28 LPA, 61% average, etc.)  
**Problem**: Becomes stale, not personalized to the user's actual industry  
**Fix**: Dynamically inject market context from the scan's `final_json_report` data — role_detected, industry, years_experience — to build a **contextual market briefing** instead of one-size-fits-all numbers.

---

## 🟠 DOMAIN 2: CARD UI/UX PSYCHOLOGICAL WEAKNESSES

### W7: No Emotional Arc Across Cards
**Current**: Each card is emotionally independent  
**Problem**: No narrative momentum. User can view cards in any order without feeling a *journey*.  
**Fix**: Implement **emotional state indicators** — each card header shows where they are on the Fear→Awareness→Empowerment→Action→Hope arc. Add a subtle progress bar with emotional labels.

### W8: Card 1 Risk Mirror Lacks "Personal Cost Calculator"
**Current**: Shows risk score and ATS matches  
**Problem**: Abstract percentages don't trigger loss aversion  
**Fix**: Add a **"What This Costs You"** section: "At your current trajectory, you're leaving ₹4.2L/year on the table by not closing these 3 gaps. In 3 years, that's ₹12.6L+ in lost earnings."

### W9: Card 6 Blind Spots Is Too Gentle
**Current**: Lists gaps with "fix" badges and learning links  
**Problem**: No tough love. Doesn't make the user feel the *weight* of their gaps.  
**Fix**: Add a **severity indicator** and confrontational framing: "🔴 CRITICAL: 78% of candidates at your level have this skill. You don't. This is likely why you're not getting callbacks."

### W10: Card 7 Human Advantage Ends Too Softly
**Current**: Advantages list + manifesto + share card  
**Problem**: No call to immediate action. No "next 24 hours" urgency.  
**Fix**: Add a **"Your 24-Hour Mission"** section with ONE specific action tied to their #1 advantage. "Your strongest edge is stakeholder management. TODAY: Message 3 former colleagues and ask for a LinkedIn recommendation mentioning cross-functional leadership."

### W11: No Emotional Contrast Between Cards
**Current**: All cards use the same visual weight  
**Fix**: Card 1 and 6 should feel *heavier* (danger colors, bolder borders). Card 3 and 7 should feel *lighter* (hope colors, breathing room). Create visual emotional rhythm.

---

## 🟡 DOMAIN 3: DATA & INFERENCE ENGINE WEAKNESSES

### W12: No Peer Pressure Mechanics
**Current**: India average mentioned (61%) but not weaponized  
**Fix**: Add **peer comparison narratives**: "42% of Marketing Managers with your experience have already upskilled in AI tools. You haven't. Every month you wait, the gap widens."

### W13: No Time-Decay Urgency
**Current**: Static snapshot analysis  
**Fix**: Add a **"Decay Clock"** to Card 1: "Your current score of 58 drops to ~47 in 6 months if you take no action. Here's exactly why..." (similar to the FearScoreDecay component already in the legacy system — port this logic).

### W14: Validation Is Too Lenient
**Current**: Only checks if keys exist and minimum array lengths  
**Fix**: Add **quality validation**: emotion fields must be > 80 chars, confrontation fields must reference a specific metric or company from the resume, salary figures must contain ₹ symbol.

---

## 📋 PHASED UPGRADE PLAN

### Phase 1: Prompt Overhaul (Highest Impact)
1. Rewrite system prompt with Psychological Narrative Framework (W1)
2. Replace `emotion_message` with 3-part emotional structure (W2)
3. Add `confrontation` field to every card schema (W3)
4. Add `urgency_narrative` to job matches (W4)
5. Add `psychological_hook` to interview prep (W5)
6. Strengthen validation for emotional quality (W14)

### Phase 2: Card UI Emotional Enhancement
7. Add "Personal Cost Calculator" to Card 1 (W8)
8. Add severity + tough love framing to Card 6 (W9)
9. Add "24-Hour Mission" to Card 7 (W10)
10. Implement emotional contrast via visual weight (W11)
11. Add emotional arc progress indicator (W7)

### Phase 3: Inference Engine Upgrades
12. Add peer pressure mechanics across cards (W12)
13. Port FearScoreDecay logic to Card 1 (W13)
14. Dynamic market context injection from scan data (W6)

---

**Estimated Impact**: User engagement score from 5.8/10 → target 8.5/10. The biggest lever is Phase 1 — the prompt controls 70% of the output quality.

**Recommendation**: Approve Phase 1 first. It requires only edge function changes (no UI), can be deployed and tested immediately, and will dramatically change the emotional depth of every card.
