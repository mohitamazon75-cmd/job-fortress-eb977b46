/**
 * Golden Scan Fixtures — 5 frozen personas covering the real distribution.
 *
 * Each fixture pairs a deterministic AnalysisContext (the engine's grounded
 * truth) with a representative `cardData` payload that mimics what the
 * get-model-b-analysis edge function returns AFTER all sanitizers run.
 *
 * These fixtures are calibrated against (do NOT change without updating both):
 *   - src/lib/analysis-context.ts (filterEligiblePivots, computeSeniorityFloor)
 *   - supabase/functions/_shared/kg-category-map.ts (industry → category)
 *   - src/lib/sanitizers/strip-fabricated-rupee-figures.ts
 *   - supabase/functions/get-model-b-analysis/index.ts (Card 1 verdict guard)
 *
 * RULE: every invariant in golden-scan-suite.test.ts MUST pass for every
 * fixture below. If a fix breaks one fixture, either the fix is wrong or
 * the fixture needs an explicit, commented update.
 */

import type { AnalysisContext, PivotCandidate } from '@/lib/analysis-context';

export interface GoldenScanCard1 {
  headline: string;
  cost?: { monthly_loss_lpa?: string | null };
}

export interface GoldenScanCard4 {
  pivots: Array<PivotCandidate & {
    match_pct?: number;
    salary_range?: string | null;
  }>;
  negotiation_anchors?: {
    base?: string;
    plus_10?: string;
    plus_20?: string;
    plus_30?: string;
  };
}

export interface GoldenScanFixture {
  id: string;
  description: string;
  /** Industry the user picked in onboarding — drives KG category lookup. */
  industry_input: string;
  /**
   * KG category that MUST appear in getCategoryCandidates(industry_input).
   * Note: the helper preserves the literal input as candidate[0] (happy path),
   * then appends the semantically mapped categories. We assert that the
   * MAPPED category is present somewhere in the list — this is what
   * fetchTaxonomyByCandidates falls through to when the literal misses.
   */
  expected_kg_category_in_candidates: string;
  /** Frozen deterministic context the engine should produce. */
  ctx: AnalysisContext;
  /** Representative LLM output AFTER sanitizers. */
  card1: GoldenScanCard1;
  card4: GoldenScanCard4;
  /** True iff user provided CTC during onboarding (drives provenance). */
  has_user_ctc: boolean;
}

const COMMON_VERSIONS = {
  kg_version: 'kg-2026-04-29',
  prompt_version: 'mb-v2.0.0',
  engine_version: 'engine-1.4.2',
  computed_at: '2026-04-30T00:00:00.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 1: Sales Senior Manager (Farheen — the scan that surfaced Pivot
// Coherence bugs). Calibrated against: user_is_exec=true must inhibit the
// same-family pivot drop; declining family must still drop. industry "Sales"
// must map to category "Other" first (kg-category-map.ts line 26).
// ─────────────────────────────────────────────────────────────────────────────
export const SALES_EXEC: GoldenScanFixture = {
  id: 'sales-senior-manager-hyderabad',
  description: '11y Senior Manager — Business Development, Hyderabad, no CTC provided',
  industry_input: 'Sales',
  expected_kg_category_in_candidates: 'Other',
  has_user_ctc: false,
  ctx: {
    user_role_family: 'sales',
    user_role_market_health: 'stable',
    user_skill_kg_match_pct: 72,
    user_existing_skills_set: ['salesforce', 'cold outreach', 'pipeline management'],
    user_seniority_tier: 'SENIOR_LEADER',
    user_is_exec: true,
    user_metro_tier: 'tier1',
    user_notice_period_days: 60,
    salary_provenance: 'ESTIMATED',
    ...COMMON_VERSIONS,
  },
  card1: {
    // Calibrated against: market_health='stable' allows neutral verdict copy.
    headline: 'Your sales leadership track is exposed but defensible',
    cost: { monthly_loss_lpa: null }, // no CTC ⇒ no absolute ₹ figure allowed
  },
  card4: {
    pivots: [
      // Exec: same-family vertical pivots MUST survive the filter.
      { role: 'Director of Sales', job_family: 'sales', match_pct: 88, salary_range: '₹40–60L [ESTIMATED]' },
      { role: 'VP Revenue Operations', job_family: 'sales', match_pct: 82, salary_range: '₹55–80L [ESTIMATED]' },
      { role: 'Chief Revenue Officer', job_family: 'sales', match_pct: 75, salary_range: '₹80L–1.2Cr [ESTIMATED]' },
    ],
    negotiation_anchors: {
      // Calibrated against Bug 4: identical anchors when no CTC are degenerate.
      // Card4PivotPaths collapses these into one tile + prompt for CTC. Tested
      // separately; here we just freeze the LLM behavior.
      base: '₹35L',
      plus_10: '₹35L',
      plus_20: '₹35L',
      plus_30: '₹35L',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 2: IC Software Engineer Bangalore — the canonical IC case.
// Calibrated against: NOT exec ⇒ same-family pivots MUST be dropped;
// industry "Software" → category "IT & Software". With CTC provided,
// Card 1 may carry an absolute ₹ figure.
// ─────────────────────────────────────────────────────────────────────────────
export const IC_ENGINEER: GoldenScanFixture = {
  id: 'ic-software-engineer-bangalore',
  description: '4y Software Engineer, Bangalore, ₹18L CTC provided',
  industry_input: 'Software',
  expected_kg_category_in_candidates: 'IT & Software',
  has_user_ctc: true,
  ctx: {
    user_role_family: 'engineering',
    user_role_market_health: 'booming',
    user_skill_kg_match_pct: 85,
    user_existing_skills_set: ['python', 'react', 'postgres', 'docker'],
    user_seniority_tier: 'MID',
    user_is_exec: false,
    user_metro_tier: 'tier1',
    user_notice_period_days: 90,
    salary_provenance: 'USER_PROVIDED',
    ...COMMON_VERSIONS,
  },
  card1: {
    // Calibrated against: market_health='booming' allows positive verdict copy.
    headline: 'Your engineering skill stack is fortified for the AI shift',
    cost: { monthly_loss_lpa: '₹0.8L per month foregone vs the 75th percentile' },
  },
  card4: {
    // Non-exec: same-family ('engineering') pivots MUST be filtered out.
    // The Product Manager pivot is cross-family ⇒ KEEP.
    pivots: [
      { role: 'Senior Software Engineer', job_family: 'engineering', match_pct: 92 }, // DROP
      { role: 'Product Manager — Platform', match_pct: 78, salary_range: '₹28–40L' },  // KEEP
      { role: 'Solutions Engineer', match_pct: 74, salary_range: '₹22–32L' },          // KEEP
    ],
    negotiation_anchors: {
      base: '₹18L',
      plus_10: '₹19.8L',
      plus_20: '₹21.6L',
      plus_30: '₹23.4L',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 3: BPO Team Lead — high-risk family, declining family pivots must
// always drop, even cross-family. Calibrated against: industry "Customer
// Support" → category "Other" (then "it & software"). Notice period long.
// ─────────────────────────────────────────────────────────────────────────────
export const BPO_TEAM_LEAD: GoldenScanFixture = {
  id: 'bpo-team-lead-hyderabad',
  description: '6y BPO Team Lead, Hyderabad, no CTC',
  industry_input: 'Customer Support',
  expected_kg_category_in_candidates: 'Other',
  has_user_ctc: false,
  ctx: {
    user_role_family: 'customer_success',
    user_role_market_health: 'declining',
    user_skill_kg_match_pct: 60,
    user_existing_skills_set: ['call handling', 'crm', 'team management'],
    user_seniority_tier: 'SENIOR',
    user_is_exec: false,
    user_metro_tier: 'tier1',
    user_notice_period_days: 30,
    salary_provenance: 'ESTIMATED',
    ...COMMON_VERSIONS,
  },
  card1: {
    // Calibrated against: market_health='declining' blocks 'fortified/safe/protected'
    // copy. This headline must NOT contain those words (Bug 2 invariant).
    headline: 'Your customer-support track is under significant disruption pressure',
    cost: { monthly_loss_lpa: null }, // no CTC ⇒ no absolute ₹
  },
  card4: {
    pivots: [
      // Same family AND declining ⇒ DROP via two paths.
      { role: 'Senior Customer Success Manager', job_family: 'customer_success', market_health: 'declining', match_pct: 80 },
      // Cross-family but declining ⇒ DROP via market_health.
      { role: 'Email Marketing Specialist', market_health: 'declining', match_pct: 70 },
      // Cross-family + booming ⇒ KEEP.
      { role: 'Implementation Specialist', market_health: 'booming', match_pct: 75 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 4: Founder/Exec — title-driven exec floor must override missing
// years. user_is_exec=true relaxes same-family pivot drop. No CTC.
// ─────────────────────────────────────────────────────────────────────────────
export const FOUNDER_EXEC: GoldenScanFixture = {
  id: 'founder-fintech-bangalore',
  description: '15y Co-founder, Bangalore, no CTC',
  industry_input: 'Finance',
  expected_kg_category_in_candidates: 'Finance & Banking',
  has_user_ctc: false,
  ctx: {
    user_role_family: 'finance_ops',
    user_role_market_health: 'stable',
    user_skill_kg_match_pct: 55,
    user_existing_skills_set: ['fundraising', 'financial modeling', 'team building'],
    user_seniority_tier: 'EXECUTIVE',
    user_is_exec: true,
    user_metro_tier: 'tier1',
    user_notice_period_days: null,
    salary_provenance: 'ESTIMATED',
    ...COMMON_VERSIONS,
  },
  card1: {
    headline: 'Your founder profile faces structural reshuffling risk',
    cost: { monthly_loss_lpa: null },
  },
  card4: {
    pivots: [
      // Exec: same-family vertical KEEP.
      { role: 'CFO at Series B SaaS', job_family: 'finance_ops', match_pct: 82 },
      // Cross-family exec move KEEP.
      { role: 'Operating Partner at VC Firm', match_pct: 70 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 5: Freelance Creative — small skill set, low KG match. Calibrated
// against: industry "Creative" → "Creative & Design"; non-exec same-family
// drop applies. With CTC, monetary copy allowed.
// ─────────────────────────────────────────────────────────────────────────────
export const FREELANCE_CREATIVE: GoldenScanFixture = {
  id: 'freelance-creative-mumbai',
  description: '3y Freelance Video Editor, Mumbai, ₹6L CTC provided',
  industry_input: 'Creative',
  expected_kg_category_in_candidates: 'Creative & Design',
  has_user_ctc: true,
  ctx: {
    user_role_family: 'creative_content',
    user_role_market_health: 'declining',
    user_skill_kg_match_pct: 45,
    user_existing_skills_set: ['premiere pro', 'after effects', 'davinci resolve'],
    user_seniority_tier: 'JUNIOR',
    user_is_exec: false,
    user_metro_tier: 'tier1',
    user_notice_period_days: 0,
    salary_provenance: 'USER_PROVIDED',
    ...COMMON_VERSIONS,
  },
  card1: {
    // declining market ⇒ no 'fortified/safe/protected' allowed.
    headline: 'Your video-editing track is exposed to generative AI workflows',
    cost: { monthly_loss_lpa: '₹0.3L per month vs equivalent in-house roles' },
  },
  card4: {
    pivots: [
      // Same-family non-exec ⇒ DROP.
      { role: 'Senior Video Editor', job_family: 'creative_content', match_pct: 88 },
      // Cross-family with sourced range ⇒ KEEP.
      { role: 'Motion Designer at Product Company', match_pct: 76, salary_range: '₹9–14L per Naukri 2026' },
    ],
    negotiation_anchors: {
      base: '₹6L',
      plus_10: '₹6.6L',
      plus_20: '₹7.2L',
      plus_30: '₹7.8L',
    },
  },
};

export const ALL_FIXTURES: GoldenScanFixture[] = [
  SALES_EXEC,
  IC_ENGINEER,
  BPO_TEAM_LEAD,
  FOUNDER_EXEC,
  FREELANCE_CREATIVE,
];
