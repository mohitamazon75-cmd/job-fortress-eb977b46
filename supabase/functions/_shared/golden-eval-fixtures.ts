/**
 * @fileoverview Golden Eval Suite v1 — 50 cases across 8 Indian job families.
 *
 * PURPOSE: prevent silent regressions in scoring/tone/prompts.
 * Every fixture asserts what a human evaluator would expect to see in the
 * final scan report given a realistic Indian-market profile. Run via the
 * `golden-eval-run` edge function; CI gate fails the deploy if pass rate
 * drops below GOLDEN_EVAL_PASS_THRESHOLD.
 *
 * IMPORTANT: Fixtures are synthetic but representative. They are NOT real
 * users. They were calibrated against the production scoring engine on
 * 2026-04-27 and the expected windows are intentionally generous (±8 score)
 * so that legitimate engine recalibration does not trip false positives —
 * but tone class and risk band MUST hold.
 */

export type ToneClass = "CRITICAL" | "WARNING" | "MODERATE" | "STABLE";
export type RiskBand = "HIGH" | "MEDIUM" | "LOW";

export interface GoldenFixture {
  id: string;
  family: string;
  /** Synthetic resume text. Realistic enough to drive Agent 1 / Agent 2A. */
  resume_text: string;
  /** Optional public URL stub. Set null to test resume-only flow. */
  linkedin_url: string | null;
  role: string;
  industry: string;
  city: string;
  country: string;
  /** Expected Career Position score band (0-100, higher = safer). Inclusive. */
  expected_score_min: number;
  expected_score_max: number;
  /** Expected tone tag derived from determinism_index. */
  expected_tone: ToneClass;
  /** Expected dominant risk band on key skills. */
  expected_risk_band: RiskBand;
  /** Substrings that MUST appear in the dossier (case-insensitive). */
  must_contain?: string[];
  /** Substrings that MUST NOT appear (typically hallucination tells). */
  must_not_contain?: string[];
  /** Why this fixture exists — for the evaluator's audit log. */
  rationale: string;
}

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  // ────────────────────────────────────────────────────────────
  // FAMILY 1: Software Engineer — mid-level IC (6 cases)
  // ────────────────────────────────────────────────────────────
  {
    id: "swe-mid-01",
    family: "Software Engineer",
    resume_text:
      "Software Engineer with 4 years building React/Node web apps at a Series-B fintech. Owns checkout flow. Comfortable with TypeScript, PostgreSQL, AWS Lambda. Ships features weekly. No team management.",
    linkedin_url: null,
    role: "Software Engineer",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 32,
    expected_score_max: 48,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    must_contain: ["AI", "code"],
    must_not_contain: ["obituary", "guaranteed"],
    rationale: "Mid IC SWE — significant AI augmentation pressure but still high-demand role. Should land MODERATE.",
  },
  {
    id: "swe-mid-02",
    family: "Software Engineer",
    resume_text:
      "Backend engineer, 5 years, mostly CRUD APIs in Java Spring Boot at an IT services company. Maintains legacy modules. No cloud-native work, no AI tooling adoption.",
    linkedin_url: null,
    role: "Software Engineer",
    industry: "Information Technology",
    city: "Pune",
    country: "India",
    expected_score_min: 30,
    expected_score_max: 60,
    expected_tone: "WARNING",
    expected_risk_band: "HIGH",
    must_contain: ["legacy", "AI"],
    rationale: "IT-services CRUD work — explicit BPO_TEMPLATE_FLAG territory in KG. Should warn.",
  },
  {
    id: "swe-mid-03",
    family: "Software Engineer",
    resume_text:
      "Full-stack engineer, 6 years. Ships AI features end-to-end using Cursor + Claude. Deep RAG / vector DB experience. Owns ML-Ops at a product startup. Mentors 2 juniors.",
    linkedin_url: null,
    role: "Software Engineer",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 32,
    expected_score_max: 48,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    must_contain: ["AI"],
    rationale: "AI-native operator (ai_tool_native skill flag) — should score safely.",
  },
  {
    id: "swe-mid-04",
    family: "Software Engineer",
    resume_text:
      "QA Engineer, 3 years, manual testing for an e-commerce platform. Writing test cases in Excel. Limited automation. No exposure to AI test generation.",
    linkedin_url: null,
    role: "QA Engineer",
    industry: "Information Technology",
    city: "Hyderabad",
    country: "India",
    expected_score_min: 20,
    expected_score_max: 50,
    expected_tone: "WARNING",
    expected_risk_band: "HIGH",
    must_contain: ["test"],
    rationale: "Manual QA is a textbook AI-displaced role.",
  },
  {
    id: "swe-mid-05",
    family: "Software Engineer",
    resume_text:
      "Frontend engineer, 2 years, React + Tailwind. First job out of college. Building marketing pages and basic dashboards.",
    linkedin_url: null,
    role: "Software Engineer",
    industry: "Information Technology",
    city: "Chennai",
    country: "India",
    expected_score_min: 30,
    expected_score_max: 65,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Junior IC, narrow surface area — vulnerable but not catastrophic.",
  },
  {
    id: "swe-mid-06",
    family: "Software Engineer",
    resume_text:
      "DevOps / SRE, 7 years. Owns Kubernetes, Terraform, CI/CD across 4 product teams. On-call rotation lead. Drove platform consolidation saving ₹40L/yr in cloud spend.",
    linkedin_url: null,
    role: "Site Reliability Engineer",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 32,
    expected_score_max: 48,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "SRE owns critical infra + cross-team dependence. Strong moat.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 2: Senior Engineer / Engineering Manager (6 cases)
  // ────────────────────────────────────────────────────────────
  {
    id: "em-01",
    family: "Engineering Manager",
    resume_text:
      "Engineering Manager, 11 years total / 3 as EM. Manages 8 engineers across 2 squads at a Series-C SaaS. Owns hiring, perf, architecture review. Ships quarterly OKRs.",
    linkedin_url: null,
    role: "Engineering Manager",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    must_contain: ["team"],
    rationale: "EM with people leverage — moat is human, not technical.",
  },
  {
    id: "em-02",
    family: "Engineering Manager",
    resume_text:
      "Tech Lead, 9 years. Lead architect for payments stack at a unicorn. Owns design reviews, mentors 5 engineers, handles incident postmortems.",
    linkedin_url: null,
    role: "Tech Lead",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Senior IC + architecture authority. Strong stability.",
  },
  {
    id: "em-03",
    family: "Engineering Manager",
    resume_text:
      "Senior Engineer, 8 years. Built internal tools team at an IT-services giant. Mostly oversees offshore delivery for a single US client. No external visibility.",
    linkedin_url: null,
    role: "Senior Software Engineer",
    industry: "Information Technology",
    city: "Noida",
    country: "India",
    expected_score_min: 40,
    expected_score_max: 70,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Single-client IT-services lead — captive risk if client cuts spend.",
  },
  {
    id: "em-04",
    family: "Engineering Manager",
    resume_text:
      "Director of Engineering, 14 years. Built and scaled a platform team from 3 to 35 engineers. Owns ₹8 Cr/yr infra budget. Reports to CTO.",
    linkedin_url: null,
    role: "Director of Engineering",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    must_contain: ["leadership"],
    rationale: "Senior leader tier — exec scoring path applies.",
  },
  {
    id: "em-05",
    family: "Engineering Manager",
    resume_text:
      "Staff Engineer, 12 years. Designed event-driven architecture used across 6 product lines. Co-author of internal design RFC standard. Speaks at conferences.",
    linkedin_url: null,
    role: "Staff Engineer",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Staff IC with cross-team influence + external rep. Top-tier moat.",
  },
  {
    id: "em-06",
    family: "Engineering Manager",
    resume_text:
      "Tech Manager, 10 years. Manages a 6-person team doing SAP customization for one banking client. Decade-long tenure at the same captive.",
    linkedin_url: null,
    role: "Engineering Manager",
    industry: "Information Technology",
    city: "Mumbai",
    country: "India",
    expected_score_min: 24,
    expected_score_max: 40,
    expected_tone: "WARNING",
    expected_risk_band: "MEDIUM",
    rationale: "Captive SAP custom work — narrow skill surface, vendor risk.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 3: Product Manager (6 cases)
  // ────────────────────────────────────────────────────────────
  {
    id: "pm-01",
    family: "Product Manager",
    resume_text:
      "Senior PM, 7 years. Owns checkout + payments at a horizontal SaaS. Drove 22% conversion lift in 2 quarters. Cross-functional with engineering, design, growth, finance.",
    linkedin_url: null,
    role: "Product Manager",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    must_contain: ["product"],
    rationale: "Senior PM with measurable outcomes — strategic moat intact.",
  },
  {
    id: "pm-02",
    family: "Product Manager",
    resume_text:
      "Associate PM, 1.5 years. First PM job. Writes PRDs, runs sprint demos. No P&L exposure. Comes from engineering.",
    linkedin_url: null,
    role: "Associate Product Manager",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 35,
    expected_score_max: 65,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "APM is the most AI-displaceable PM tier (PRD writing, ticket grooming).",
  },
  {
    id: "pm-03",
    family: "Product Manager",
    resume_text:
      "Group PM, 10 years. Manages 4 PMs across enterprise + SMB segments. Owns 30% of company ARR. Quarterly board updates.",
    linkedin_url: null,
    role: "Group Product Manager",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Group PM with revenue ownership — manager+ tier moat.",
  },
  {
    id: "pm-04",
    family: "Product Manager",
    resume_text:
      "Product Owner / Scrum Master hybrid, 5 years at an IT-services firm. Mostly grooms backlog and runs Jira workflows for offshore client teams.",
    linkedin_url: null,
    role: "Product Owner",
    industry: "Information Technology",
    city: "Hyderabad",
    country: "India",
    expected_score_min: 25,
    expected_score_max: 55,
    expected_tone: "WARNING",
    expected_risk_band: "HIGH",
    rationale: "Backlog-grooming PO is a textbook AI-replaceable function.",
  },
  {
    id: "pm-05",
    family: "Product Manager",
    resume_text:
      "Growth PM, 4 years. Owns activation + retention experiments at a B2C app. Built in-house experimentation framework. SQL + Python proficient.",
    linkedin_url: null,
    role: "Product Manager",
    industry: "Information Technology",
    city: "Gurugram",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Data-fluent growth PM — strong augmentation potential.",
  },
  {
    id: "pm-06",
    family: "Product Manager",
    resume_text:
      "Senior PM, 8 years, healthcare SaaS. Owns regulatory + clinical workflow product. HIPAA + DPDP compliance lead.",
    linkedin_url: null,
    role: "Product Manager",
    industry: "Healthcare",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 60,
    expected_score_max: 88,
    expected_tone: "STABLE",
    expected_risk_band: "LOW",
    rationale: "Regulatory moat + domain depth = essential-role ceiling kicks in.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 4: Digital Marketing Manager (8 cases — high-disruption sentinel)
  // ────────────────────────────────────────────────────────────
  {
    id: "mkt-01",
    family: "Digital Marketing",
    resume_text:
      "Digital Marketing Manager, 6 years. Runs Google Ads + Meta Ads for a D2C brand. Monthly spend ₹25L. Reports to head of growth.",
    linkedin_url: null,
    role: "Digital Marketing Manager",
    industry: "Marketing",
    city: "Mumbai",
    country: "India",
    expected_score_min: 11,
    expected_score_max: 27,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    must_contain: ["AI"],
    rationale: "Performance marketing — explicit industry-floor target. Must trip HIGH risk.",
  },
  {
    id: "mkt-02",
    family: "Digital Marketing",
    resume_text:
      "Performance Marketing Lead, 8 years. Owns ₹2 Cr/month spend across 12 brands. Built attribution model in-house. Manages 4-person team.",
    linkedin_url: null,
    role: "Performance Marketing Manager",
    industry: "Marketing",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 24,
    expected_score_max: 40,
    expected_tone: "WARNING",
    expected_risk_band: "MEDIUM",
    rationale: "Senior performance marketer with team — partial moat but still pressured.",
  },
  {
    id: "mkt-03",
    family: "Digital Marketing",
    resume_text:
      "SEO Specialist, 4 years. Writes briefs, manages on-page optimization, monitors SERP rankings. Mostly executes from a content calendar.",
    linkedin_url: null,
    role: "SEO Specialist",
    industry: "Marketing",
    city: "Pune",
    country: "India",
    expected_score_min: 15,
    expected_score_max: 45,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    must_contain: ["AI"],
    rationale: "Mid SEO IC — SGE/AI Overviews crisis. Should trip CRITICAL.",
  },
  {
    id: "mkt-04",
    family: "Digital Marketing",
    resume_text:
      "Email Marketing Manager, 5 years at a SaaS company. Manages drip campaigns, A/B tests, list segmentation in HubSpot.",
    linkedin_url: null,
    role: "Email Marketing Manager",
    industry: "Marketing",
    city: "Gurugram",
    country: "India",
    expected_score_min: 10,
    expected_score_max: 26,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    rationale: "Email marketing automation = canonical AI-augmentation target.",
  },
  {
    id: "mkt-05",
    family: "Digital Marketing",
    resume_text:
      "Brand Marketing Manager, 7 years. Owns brand strategy, creative direction, agency management, sponsorship deals. ₹4 Cr/yr brand budget.",
    linkedin_url: null,
    role: "Brand Marketing Manager",
    industry: "Marketing",
    city: "Mumbai",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Brand marketing — strategic + relationship moat. Less AI-displaceable.",
  },
  {
    id: "mkt-06",
    family: "Digital Marketing",
    resume_text:
      "Social Media Executive, 2 years. Posts on LinkedIn / Instagram / X for a SaaS brand. Designs basic creatives in Canva.",
    linkedin_url: null,
    role: "Social Media Executive",
    industry: "Marketing",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 15,
    expected_score_max: 45,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    rationale: "Junior social media exec — AI tooling has eaten this role.",
  },
  {
    id: "mkt-07",
    family: "Digital Marketing",
    resume_text:
      "Marketing Director, 12 years. Reports to CMO. Owns demand-gen org (12 people). Quarterly board reporting on pipeline contribution.",
    linkedin_url: null,
    role: "Marketing Director",
    industry: "Marketing",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Senior leader tier — exec moat dominates.",
  },
  {
    id: "mkt-08",
    family: "Digital Marketing",
    resume_text:
      "Growth Marketer, 5 years. Owns full-funnel growth at a Series-A startup. SQL + GA4 + experimentation. Built lifecycle automation in-house.",
    linkedin_url: null,
    role: "Growth Marketing Manager",
    industry: "Marketing",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 21,
    expected_score_max: 37,
    expected_tone: "WARNING",
    expected_risk_band: "MEDIUM",
    rationale: "Data-fluent growth role — should score better than channel-specific peers.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 5: BPO / Customer Support (7 cases — high-risk sentinel)
  // ────────────────────────────────────────────────────────────
  {
    id: "bpo-01",
    family: "BPO / Customer Support",
    resume_text:
      "Customer Support Executive, 3 years at a domestic BPO. Handles inbound calls + email tickets in English/Hindi. Average 60 tickets/day.",
    linkedin_url: null,
    role: "Customer Support Executive",
    industry: "BPO",
    city: "Gurugram",
    country: "India",
    expected_score_min: 10,
    expected_score_max: 40,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    must_contain: ["AI"],
    rationale: "Inbound voice + ticket BPO — explicit bpo_template_flag target. Must score CRITICAL.",
  },
  {
    id: "bpo-02",
    family: "BPO / Customer Support",
    resume_text:
      "Tier-1 Tech Support Engineer, 4 years. Resolves L1 incidents from a knowledge base. Escalates 30% of tickets to L2.",
    linkedin_url: null,
    role: "Technical Support Engineer",
    industry: "BPO",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 15,
    expected_score_max: 45,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    rationale: "L1 KB-driven support — RAG agents directly replace.",
  },
  {
    id: "bpo-03",
    family: "BPO / Customer Support",
    resume_text:
      "Customer Success Manager, 6 years at a B2B SaaS. Owns ₹12 Cr ARR book. Quarterly business reviews with enterprise clients. Renewal-rate 94%.",
    linkedin_url: null,
    role: "Customer Success Manager",
    industry: "BPO",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "CSM with revenue ownership — relationship moat is strong.",
  },
  {
    id: "bpo-04",
    family: "BPO / Customer Support",
    resume_text:
      "Team Lead, 8 years in BPO ops. Manages 25-agent team for a US insurance client. Owns SLA + QA + scheduling.",
    linkedin_url: null,
    role: "BPO Team Lead",
    industry: "BPO",
    city: "Hyderabad",
    country: "India",
    expected_score_min: 25,
    expected_score_max: 55,
    expected_tone: "WARNING",
    expected_risk_band: "HIGH",
    rationale: "BPO TL — spans operational. Risk if account migrates to AI.",
  },
  {
    id: "bpo-05",
    family: "BPO / Customer Support",
    resume_text:
      "Inside Sales Rep, 2 years. Cold calling SMB prospects. Handles 80 dials/day. Target ₹5L/month qualified pipeline.",
    linkedin_url: null,
    role: "Inside Sales Representative",
    industry: "BPO",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 32,
    expected_score_max: 48,
    expected_tone: "MODERATE",
    expected_risk_band: "HIGH",
    rationale: "SDR cold-calling — AI dialers / SDR-bots are operational.",
  },
  {
    id: "bpo-06",
    family: "BPO / Customer Support",
    resume_text:
      "Voice agent, 5 years. Fluent in Tamil + Telugu + English. Handles regional-language banking helpdesk for a Tier-1 PSU bank.",
    linkedin_url: null,
    role: "Voice Customer Support",
    industry: "BPO",
    city: "Chennai",
    country: "India",
    expected_score_min: 30,
    expected_score_max: 60,
    expected_tone: "WARNING",
    expected_risk_band: "MEDIUM",
    rationale: "Vernacular_moat flag should bump above pure English voice work.",
  },
  {
    id: "bpo-07",
    family: "BPO / Customer Support",
    resume_text:
      "Operations Manager, 11 years. Runs a 200-seat captive ops centre for a global retailer. P&L responsibility ₹35 Cr.",
    linkedin_url: null,
    role: "Operations Manager",
    industry: "BPO",
    city: "Gurugram",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Manager+ tier with P&L — operational leverage moat.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 6: Sales Executive — B2B (6 cases)
  // ────────────────────────────────────────────────────────────
  {
    id: "sls-01",
    family: "Sales",
    resume_text:
      "Account Executive, 4 years at a B2B SaaS. Closes mid-market deals (₹20L–₹2 Cr ACV). 118% of quota last year. Owns full cycle from discovery to close.",
    linkedin_url: null,
    role: "Account Executive",
    industry: "Sales",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 32,
    expected_score_max: 48,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    must_contain: ["sales"],
    rationale: "Mid-market closer — relationship + negotiation moat.",
  },
  {
    id: "sls-02",
    family: "Sales",
    resume_text:
      "Enterprise Sales Director, 12 years. Closes ₹5–25 Cr deals with BFSI clients. Manages 4 AEs and a sales engineer.",
    linkedin_url: null,
    role: "Enterprise Sales Director",
    industry: "Sales",
    city: "Mumbai",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Enterprise + BFSI relationship moat. Strong stability.",
  },
  {
    id: "sls-03",
    family: "Sales",
    resume_text:
      "SDR / BDR, 1 year. Cold outbound for an early-stage SaaS. Books 8 meetings/week. Uses Apollo + LinkedIn.",
    linkedin_url: null,
    role: "Sales Development Representative",
    industry: "Sales",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 15,
    expected_score_max: 45,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    rationale: "Outbound SDR — AI SDR-tools (e.g. 11x, Artisan) directly replace.",
  },
  {
    id: "sls-04",
    family: "Sales",
    resume_text:
      "Channel Sales Manager, 7 years. Manages 18 reseller partners across South India for an enterprise hardware brand.",
    linkedin_url: null,
    role: "Channel Sales Manager",
    industry: "Sales",
    city: "Chennai",
    country: "India",
    expected_score_min: 37,
    expected_score_max: 53,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Partner ecosystem manager — relationship-heavy, hard to automate.",
  },
  {
    id: "sls-05",
    family: "Sales",
    resume_text:
      "Inside Sales Manager, 5 years. Manages 8-person team selling subscription software to Indian SMBs. Quarterly target ₹3 Cr.",
    linkedin_url: null,
    role: "Inside Sales Manager",
    industry: "Sales",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 35,
    expected_score_max: 65,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Manages SDR-style team — disruption pressure on the function.",
  },
  {
    id: "sls-06",
    family: "Sales",
    resume_text:
      "VP Sales, 15 years. Reports to CEO. Built sales org from 5 to 60 people across 3 geographies. ₹120 Cr in pipeline managed.",
    linkedin_url: null,
    role: "VP Sales",
    industry: "Sales",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Senior leader exec tier.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 7: Founder / CEO (5 cases — exec override path)
  // ────────────────────────────────────────────────────────────
  {
    id: "fdr-01",
    family: "Founder / CEO",
    resume_text:
      "Founder & CEO, 6 years. Bootstrapped vertical SaaS in logistics. ₹18 Cr ARR, 60-person team, profitable. Raised seed in 2022.",
    linkedin_url: null,
    role: "Founder",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    must_not_contain: ["obituary", "fired", "replaced"],
    rationale: "Founder safety override path — must not trip CRITICAL or insulting language.",
  },
  {
    id: "fdr-02",
    family: "Founder / CEO",
    resume_text:
      "CEO, Series-B fintech, 4 years in role. ₹220 Cr ARR. 240-person org. Reports to board. Raised ₹400 Cr across 3 rounds.",
    linkedin_url: null,
    role: "CEO",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Exec impact signals (revenue scope, board exposure) all maxed.",
  },
  {
    id: "fdr-03",
    family: "Founder / CEO",
    resume_text:
      "Solo founder, pre-revenue, 1 year in. Building no-code tooling for Indian SMB accountants. No team, no funding yet.",
    linkedin_url: null,
    role: "Founder",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 35,
    expected_score_max: 70,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Pre-revenue solo founder — softer override, real risk on viability.",
  },
  {
    id: "fdr-04",
    family: "Founder / CEO",
    resume_text:
      "Co-founder & COO, 8 years. Owns ops + people for a Series-C consumer-internet company. ₹85 Cr ARR. 180-person team.",
    linkedin_url: null,
    role: "COO",
    industry: "Information Technology",
    city: "Mumbai",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Exec tier with operational P&L. Top moat.",
  },
  {
    id: "fdr-05",
    family: "Founder / CEO",
    resume_text:
      "CTO, 10 years. Co-founded climate-tech startup. Owns engineering org of 14. Recent Series-A. Built proprietary IoT + ML stack.",
    linkedin_url: null,
    role: "CTO",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 42,
    expected_score_max: 58,
    expected_tone: "MODERATE",
    expected_risk_band: "LOW",
    rationale: "Founding CTO — exec + technical moat.",
  },

  // ────────────────────────────────────────────────────────────
  // FAMILY 8: Content Writer / Copywriter (6 cases — canonical "AI-killed")
  // ────────────────────────────────────────────────────────────
  {
    id: "cnt-01",
    family: "Content Writer",
    resume_text:
      "Content Writer, 3 years. Writes blog posts and product descriptions for a D2C brand. Targets long-tail SEO keywords.",
    linkedin_url: null,
    role: "Content Writer",
    industry: "Marketing",
    city: "Pune",
    country: "India",
    expected_score_min: 10,
    expected_score_max: 40,
    expected_tone: "CRITICAL",
    expected_risk_band: "HIGH",
    must_contain: ["AI"],
    rationale: "Generic SEO content writer — sentinel for the AI-killed narrative.",
  },
  {
    id: "cnt-02",
    family: "Content Writer",
    resume_text:
      "Senior Copywriter, 7 years at a top ad agency. Owns brand campaigns for 3 FMCG accounts. Cannes shortlisted twice.",
    linkedin_url: null,
    role: "Senior Copywriter",
    industry: "Marketing",
    city: "Mumbai",
    country: "India",
    expected_score_min: 21,
    expected_score_max: 37,
    expected_tone: "WARNING",
    expected_risk_band: "MEDIUM",
    rationale: "Senior creative copywriter — taste + brand moat is real.",
  },
  {
    id: "cnt-03",
    family: "Content Writer",
    resume_text:
      "Content Strategist, 6 years. Owns editorial calendar + brand voice + content ops for a B2B SaaS. Manages 3 freelance writers.",
    linkedin_url: null,
    role: "Content Strategist",
    industry: "Marketing",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 35,
    expected_score_max: 65,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Strategy + ops layer — partial AI augmentation, not full replacement.",
  },
  {
    id: "cnt-04",
    family: "Content Writer",
    resume_text:
      "Hindi Content Writer, 4 years. Writes regional-language editorial for a digital news outlet. Specializes in political + sports coverage.",
    linkedin_url: null,
    role: "Hindi Content Writer",
    industry: "Media",
    city: "Delhi",
    country: "India",
    expected_score_min: 30,
    expected_score_max: 60,
    expected_tone: "MODERATE",
    expected_risk_band: "MEDIUM",
    rationale: "Vernacular moat should soften the generic-content-writer crash.",
  },
  {
    id: "cnt-05",
    family: "Content Writer",
    resume_text:
      "Technical Writer, 5 years. Owns API documentation + developer guides for a developer-tools company. Closely embedded with engineering.",
    linkedin_url: null,
    role: "Technical Writer",
    industry: "Information Technology",
    city: "Bengaluru",
    country: "India",
    expected_score_min: 25,
    expected_score_max: 55,
    expected_tone: "WARNING",
    expected_risk_band: "HIGH",
    rationale: "Tech writing — high AI augmentation risk; mitigated only by deep tooling integration.",
  },
  {
    id: "cnt-06",
    family: "Content Writer",
    resume_text:
      "Editor-in-Chief, 14 years. Runs a 20-person editorial team at a major business publication. Owns hiring, voice, and editorial standards.",
    linkedin_url: null,
    role: "Editor-in-Chief",
    industry: "Media",
    city: "Mumbai",
    country: "India",
    expected_score_min: 60,
    expected_score_max: 88,
    expected_tone: "STABLE",
    expected_risk_band: "LOW",
    rationale: "Editorial leader — relationship + brand moat at the top of the org.",
  },
];

/**
 * Quick assertion: tone derives from determinism_index per det-orchestrator's deriveToneTag.
 * We mirror that mapping here so the runner can score without importing Deno code.
 */
export function expectedToneForScore(careerScore: number): ToneClass {
  // Career score = 100 - DI. So:
  //   DI > 80  → CRITICAL → score < 20
  //   DI > 60  → WARNING  → score < 40
  //   DI > 40  → MODERATE → score < 60
  //   else     → STABLE   → score >= 60
  if (careerScore < 20) return "CRITICAL";
  if (careerScore < 40) return "WARNING";
  if (careerScore < 60) return "MODERATE";
  return "STABLE";
}

/** Fixture count by family — used by runner for stratified pass-rate reporting. */
export const FAMILY_COUNTS = GOLDEN_FIXTURES.reduce<Record<string, number>>((acc, f) => {
  acc[f.family] = (acc[f.family] || 0) + 1;
  return acc;
}, {});

/** CI gate threshold — below this aggregate pass rate, deploy fails. */
export const GOLDEN_EVAL_PASS_THRESHOLD = 0.85; // 85% of fixtures must pass
