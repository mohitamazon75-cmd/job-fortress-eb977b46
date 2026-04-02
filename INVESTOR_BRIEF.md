# JobBachao — Investor Brief

**Confidential · March 2026 · India Launch**

---

## Executive Summary

**JobBachao** is India's first AI career risk intelligence platform. We give professionals a real-time **Career Position Score** — a deterministic, reproducible assessment of how exposed their job is to AI automation — paired with a personalized defense plan. Think CIBIL score, but for career safety.

**Live Product**: [job-fortress.lovable.app](https://job-fortress.lovable.app)

**Tagline**: *"Will AI Replace You? Find Out Before Your Boss Does."*

**Price**: ₹500 per scan · ₹1,999/year Pro

---

## The Problem

- **300M jobs globally** face AI displacement in 3–5 years (Goldman Sachs 2024)
- **23% of all jobs** will structurally change by 2030 (WEF Future of Jobs 2025)
- Indian IT alone employs **5.4M professionals** — many in automatable roles
- No tool tells a working professional: *"Here's your specific risk, here's your specific plan"*
- LinkedIn offers performative optimism. We offer math.

---

## The Product

### What the User Gets (₹500 Scan)

| Deliverable | Type | Description |
|-------------|------|-------------|
| **Career Position Score** (0–100) | Deterministic | Weighted composite of 5 pillars: AI Resistance, Market Position, Human Edge, Income Stability, Seniority Shield |
| **AI Timeline** | Deterministic | Skill-by-skill automation forecast (6 months → 7+ years) |
| **Intelligence Map** | Deterministic | Interactive knowledge graph of skills color-coded by risk |
| **Best-Fit Jobs** | AI + Live Search | Real-time job listings with skill-match % and direct apply links |
| **Resume Weaponizer** | AI-Powered | ATS-optimized rewrite using STAR method with before/after scoring |
| **Interview Cheat Sheet** | AI-Powered | Tools to mention, keywords to drop, weekend homework |
| **90-Day Defense Plan** | Deterministic + AI | 4-phase milestone roadmap with judo strategies |
| **Career Genome Debate** | Multi-Agent AI | 3-agent adversarial courtroom debate on career trajectory |
| **Skill Repositioning** | Deterministic | Before → After skill framing for AI-era resumes |
| **Career Pivot Engine** | AI-Powered | Adjacent + stretch career paths with salary delta and transition difficulty |
| **Career Obituary** | AI-Powered | Viral-shareable "newspaper obituary" for current career path |
| **Side Hustle Generator** | AI-Powered | 4-slot opportunity engine benchmarked against 2026 AI tools |

### User Journey

```
Landing Page → Input (LinkedIn / Resume / Manual) → Auth → Onboarding (Industry, Experience, City)
    → Scan Processing (60–120s) → Score Reveal (animated) → 12-Card Report Flow → Full Dashboard
```

### Dashboard (4 Tabs)

| Tab | Content |
|-----|---------|
| 🩺 **Diagnosis** | Risk scores, obsolescence timeline, AI threat radar, skill decay |
| ⚔️ **Defense** | Action plan, pivot optimizer, skill gaps, what-if simulator, shock simulator |
| 📡 **Intel** | Live market data, company news, competitive landscape, geo arbitrage |
| ✨ **Dossier** | Score methodology, data quality, strategic dossier, peer comparison |

---

## Technology Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion |
| Backend | Supabase (Lovable Cloud) — Edge Functions (Deno), PostgreSQL, Auth |
| AI Models | Google Gemini 3 Pro Preview (reasoning) + Gemini 3 Flash Preview (synthesis) |
| Live Intelligence | Tavily Search API (grounded citations) |
| Web Scraping | Firecrawl API (LinkedIn profiles) |
| Payments | Razorpay (₹500/scan, ₹1,999/year) |

### Core IP: Deterministic Calculation Engine (v3.3)

**1,465 lines · 48+ calibration constants · Zero LLM involvement in scoring**

Every numerical output is computed from algorithms, not language models. This makes scores:
- **Reproducible** — same input, same output, every time
- **Auditable** — every number has a traceable formula path
- **Non-hallucinatable** — LLMs generate strategy text only; they cannot override computed scores

| Algorithm | What It Computes |
|-----------|-----------------|
| Determinism Index (DI) | Automation risk (5–95%) via KG skill-risk × industry modifiers × experience |
| Obsolescence Timeline | Months to significant AI impact (power-curve + 12% annual AI acceleration) |
| Salary Bleed | Monthly income depreciation rate (capped at 60%) |
| Survivability Score | Personal resilience rating (5–95) |
| Stability Score | Composite job safety index (0–100) |
| Confidence Intervals | Statistical ranges based on √(matched skills) |

### Multi-Agent Scan Pipeline

```
Input → Agent 1 (Profile Extraction, Gemini 3 Pro)
    → Deterministic Engine (pure math, zero LLM)
    → Agents 2A/2B/2C in parallel (Risk + Strategy + Pivots, Gemini 3 Pro)
    → Enrichment Layer in parallel (Judo Strategy + Market Intel + ML Predictions)
    → Quality Editor (Gemini 3 Flash)
    → Dashboard
```

Total scan time: **60–120 seconds** · 6 parallel agent tasks

### Knowledge Graph

| Asset | Scale |
|-------|-------|
| Skill risk vectors | 147+ with automation_risk, replacement_tools, human_moat, demand_trend |
| Job families | 95 across 8 industries |
| Skill-to-job mappings | 1,500+ |
| Market signals | Per job family × metro tier (posting trends, salary changes, AI mentions) |
| Industry skill modifiers | 7 industry-specific adjustment maps |

### 5-Tier Seniority Calibration

| Tier | DI Multiplier | Behavior |
|------|--------------|----------|
| Entry (0–2 yrs) | 1.15× amplified | High urgency, tactical advice |
| Professional (3–5 yrs) | 1.0× baseline | Balanced analysis |
| Manager (6–10 yrs) | 0.7× buffered | Strategic framing |
| Senior Leader (10–15 yrs) | 0.5× protected | Executive positioning |
| Executive (15+ yrs) | 0.4× moat-heavy | Never suggests demotion |

---

## Revenue Model

### Pricing (India Launch)

| Tier | Price | What's Included |
|------|-------|----------------|
| **Per Scan** | ₹500 | Full 12-card report + dashboard + 90-day defense plan |
| **Pro Annual** | ₹1,999/year | Unlimited scans + AI Dossier + Side Hustles + Weekly Briefs + PDF Export |

### Revenue Projections

| Metric | Month 1 | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|---------|----------|
| Daily scans | 50 | 500 | 2,000 | 5,000 |
| Paid conversion | 10% | 12% | 15% | 18% |
| Monthly revenue | ₹75K | ₹9L | ₹45L | ₹1.35Cr |
| Pro subscribers | 20 | 200 | 1,000 | 5,000 |
| Pro MRR | ₹3.3K | ₹33K | ₹1.67L | ₹8.3L |

**Assumptions**: ₹500/scan, 10–18% conversion ramp, 5% Pro conversion of scan users

### Unit Economics

| Metric | Value |
|--------|-------|
| Revenue per scan | ₹500 |
| AI compute cost per scan | ~₹35 (Gemini API via Lovable AI gateway) |
| Tavily search cost per scan | ~₹8 |
| Infrastructure cost per scan | ~₹2 |
| **Gross margin per scan** | **~91%** |
| CAC target (organic/viral) | ₹50–100 |
| LTV (scan + Pro upsell) | ₹800–2,500 |

---

## Go-to-Market: India Launch

### Why India First

- **5.4M IT professionals** in automatable roles — largest concentrated talent pool
- **AI anxiety is peak** — mass layoffs at TCS, Infosys, Wipro in 2025–26
- **WhatsApp-native sharing** — viral coefficient built into product (challenge codes, career obituary)
- **₹500 price point** — impulse purchase, lower than a business lunch
- **No competitor** offers deterministic, reproducible career risk scoring in India

### Acquisition Channels

| Channel | Strategy | Target CAC |
|---------|----------|-----------|
| **WhatsApp Viral** | Challenge a Colleague + Career Obituary sharing | ₹0 (organic) |
| **LinkedIn Organic** | "My AI said I have 18 months" — controversy-driven posts | ₹0 (organic) |
| **Instagram/Twitter** | Fate Cards (Spotify Wrapped-style career cards) | ₹20–50 |
| **Tech Community** | Reddit, Hacker News, Product Hunt launch | ₹0 (organic) |
| **Campus Partnerships** | Free scans for final-year students (funnel to Pro) | ₹30 |
| **HR/L&D Outbound** | B2B workforce risk assessment (future) | ₹500 |

### Viral Mechanics (Built-In)

| Feature | Viral Mechanism |
|---------|----------------|
| **Challenge a Colleague** | Unique code → friend scans → comparison unlock |
| **Career Obituary** | Dramatic newspaper-style death notice → social share |
| **Fate Cards** | Spotify Wrapped-style shareable career snapshots |
| **WhatsApp Share** | Pre-composed message with score + CTA |
| **LinkedIn Post Generator** | Professional framing for career discussions |

### India-Specific Features

| Feature | Description |
|---------|-------------|
| **Salary Negotiation Card** | Market benchmarks, copy-paste scripts, appraisal season detection |
| **Notice Period Optimizer** | Buyout calculator, early release templates, Section 27 legal counters |
| **India Job Search** | Naukri, LinkedIn, Instahyre integration via Tavily |
| **India Course Engine** | Scaler, UpGrad, Simplilearn mappings with CTC bump projections |
| **Hindi/Hinglish Toggle** | "Explain to Papa" mode for plain-language verdicts |
| **Metro Tier Calibration** | Tier 1 (Bangalore, Mumbai) vs Tier 2 city market adjustments |

---

## Competitive Moat

| Moat | Why It's Hard to Replicate |
|------|---------------------------|
| **Deterministic Engine** | 1,465 lines, 48+ calibrated constants, months of tuning against WEF/McKinsey/Goldman data. ChatGPT wrappers produce different answers every time. |
| **Knowledge Graph** | 147+ skill vectors with automation risk, replacement tools, human moats — curated via Tavily + manual validation. Industry-specific modifiers add a second dimension. |
| **AIRMM Optimizer** | Server-side only. Multi-variable career transition scoring (logistic probability × exponential decay × risk-adjusted trajectory). Never shipped to browsers. |
| **Seniority Calibration** | 5 tiers affect every calculation. A junior dev and a CTO get fundamentally different analyses. |
| **Industry-Aware Scoring** | Same skill shows different risk by industry. `data_analysis` is +10 riskier in Finance, -8 safer in Healthcare. |
| **Data Flywheel** | Every scan enriches the KG. Low-accuracy scans auto-flag job families for KG expansion. System improves with scale. |
| **Search-Grounded Intel** | All market data backed by Tavily search with clickable citations — not hallucinated. |

---

## Security & Operations

| Layer | Implementation |
|-------|---------------|
| IP Protection | Proprietary algorithms run server-side only; frontend has facade |
| Rate Limiting | Identity-based, 50 scans/24h per user |
| Input Sanitization | Prompt injection regex patterns |
| RLS | Row-Level Security on all 20+ database tables |
| Abuse Guard | Shared module across all 30+ edge functions |
| Spending Guard | ₹2L/day ($2,500) budget with circuit breakers |
| Monitoring | `edge_function_logs`, `daily_usage_stats`, `monitoring_alerts` tables |
| Admin Dashboard | Real-time usage, costs, Agent 1 quality metrics |

---

## Technical Scale

| Metric | Value |
|--------|-------|
| Proprietary code | ~12,000+ lines |
| Server-side code | ~7,000+ lines |
| Edge functions | 30+ deployed |
| Database tables | 20+ with RLS |
| Strategic indexes | 13+ on hot paths |
| KG skill mappings | 147+ (expandable to 3,000+) |
| Job families | 95 |
| Industries | 8 |
| AI models | 2 tiers (Gemini Pro + Flash) |
| Dashboard widgets | 20+ |
| Test coverage | 46+ deterministic tests |
| Design target | 5,000+ daily scans |

---

## Team Ask

| Need | Purpose |
|------|---------|
| **Seed Funding** | Scale to 5,000 daily scans, expand KG, hire growth + data |
| **Growth Lead** | WhatsApp viral loops, campus partnerships, LinkedIn organic |
| **Data Scientist** | KG expansion, feedback calibration, ML obsolescence models |
| **B2B Sales** | Enterprise workforce risk assessment (HR/L&D) |

---

## Roadmap

### Shipped ✅
- Deterministic engine v3.3 with seniority calibration
- Multi-agent parallel scan pipeline
- 12-card report flow with 20+ dashboard widgets
- India-specific salary negotiation + notice period tools
- Viral sharing (WhatsApp, LinkedIn, Challenge a Colleague, Fate Cards)
- Hindi/Hinglish localization
- Admin monitoring + spending guards
- 46+ test suite

### Next 90 Days 🔲
- Progressive report streaming (show results as agents complete)
- Scan-over-scan comparison for returning users
- PDF export of career reports
- Feedback calibration loop (auto-adjust KG from user ratings)
- B2B employer dashboard for workforce risk assessment
- Mobile app (React Native wrapper)

---

**Contact**: [founder email] · **Live Demo**: [job-fortress.lovable.app](https://job-fortress.lovable.app)

*Confidential — March 2026*
