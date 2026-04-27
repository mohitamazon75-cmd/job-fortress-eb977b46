import type { LiveMarketSnapshot } from "./LiveMarketCard";

/**
 * Realistic preview fixtures derived from Phase 2B-i investigation
 * of saved R1 (Senior Java), R2 (Marketing), R3 (Engineering Manager)
 * datasets. Used ONLY by the /preview/live-market-card route.
 *
 * v2: every fixture carries a `corpus_relevance` band so the card can
 * pick the matching render state (strong / partial / thin / executive).
 */

const now = new Date(Date.now() - 1000 * 60 * 2).toISOString(); // 2 minutes ago

// ── R1: clean Java corpus → strong band → full card render
export const r1Fixture: LiveMarketSnapshot = {
  posting_count: 50,
  fetched_at: now,
  cached: false,
  is_executive: false,
  top_tags: [
    { tag: "java", count: 42, pct: 84 },
    { tag: "spring boot", count: 38, pct: 76 },
    { tag: "microservices", count: 31, pct: 62 },
    { tag: "aws", count: 24, pct: 48 },
    { tag: "kafka", count: 19, pct: 38 },
    { tag: "rest api", count: 17, pct: 34 },
    { tag: "kubernetes", count: 14, pct: 28 },
    { tag: "sql", count: 13, pct: 26 },
  ],
  user_skill_overlap: {
    shown: true,
    matched_count: 4,
    matched_skills: ["java", "spring boot", "microservices", "rest api"],
    missing_top_tags: ["aws", "kafka", "kubernetes", "sql"],
  },
  salary: { shown: true, n_disclosed: 32, n_total: 50, median_lpa: 15.0, p25_lpa: 3.9, p75_lpa: 24 },
  recency: { same_day_count: 50, within_7d_count: 0, older_count: 0 },
  corpus_relevance: { score: 86, band: "strong", title_overlap_pct: 88, skill_match_in_top_tags: 4 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};

// ── R3: partial — Naukri's Eng-Mgr corpus has SOME real signal but
// adjacent-role pollution. Show tags WITH disclaimer, no match column.
export const r3Fixture: LiveMarketSnapshot = {
  posting_count: 50,
  fetched_at: now,
  cached: false,
  is_executive: false,
  top_tags: [
    { tag: "project management", count: 22, pct: 44 },
    { tag: "order to cash", count: 18, pct: 36 },
    { tag: "python", count: 16, pct: 32 },
    { tag: "stakeholder management", count: 14, pct: 28 },
    { tag: "sap", count: 12, pct: 24 },
    { tag: "agile", count: 11, pct: 22 },
    { tag: "process improvement", count: 10, pct: 20 },
    { tag: "vendor management", count: 9, pct: 18 },
  ],
  user_skill_overlap: {
    shown: false,
    matched_count: 1,
    matched_skills: ["project management"],
    missing_top_tags: ["order to cash", "python", "sap", "agile"],
  },
  salary: { shown: true, n_disclosed: 11, n_total: 50, median_lpa: 6.4, p25_lpa: 4.5, p75_lpa: 16 },
  recency: { same_day_count: 4, within_7d_count: 46, older_count: 0 },
  corpus_relevance: { score: 38, band: "partial", title_overlap_pct: 42, skill_match_in_top_tags: 1 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};

// ── R2: thin — marketing user, sales-polluted corpus. Hide tags entirely;
// render salary + recency only with an honest "thin signal" note.
export const r2ThinFixture: LiveMarketSnapshot = {
  posting_count: 50,
  fetched_at: now,
  cached: false,
  is_executive: false,
  top_tags: [
    { tag: "field sales", count: 28, pct: 56 },
    { tag: "b2c sales", count: 22, pct: 44 },
    { tag: "lead generation", count: 19, pct: 38 },
    { tag: "cold calling", count: 17, pct: 34 },
    { tag: "customer service", count: 14, pct: 28 },
    { tag: "insurance", count: 11, pct: 22 },
  ],
  user_skill_overlap: { shown: false, matched_count: 0, matched_skills: [], missing_top_tags: ["field sales", "b2c sales"] },
  salary: { shown: true, n_disclosed: 28, n_total: 50, median_lpa: 4.5, p25_lpa: 3.0, p75_lpa: 7.0 },
  recency: { same_day_count: 12, within_7d_count: 38, older_count: 0 },
  corpus_relevance: { score: 12, band: "thin", title_overlap_pct: 8, skill_match_in_top_tags: 0 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};

export const execFixture: LiveMarketSnapshot = {
  posting_count: 0,
  fetched_at: now,
  cached: false,
  is_executive: true,
  top_tags: [],
  user_skill_overlap: { shown: false, matched_count: 0, matched_skills: [], missing_top_tags: [] },
  salary: { shown: false, n_disclosed: 0, n_total: 0, median_lpa: null, p25_lpa: null, p75_lpa: null },
  recency: { same_day_count: 0, within_7d_count: 0, older_count: 0 },
  corpus_relevance: { score: 0, band: "thin", title_overlap_pct: 0, skill_match_in_top_tags: 0 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};

// ── Tiny + flat: 6 postings, every tag appears in 1 posting (17%).
// Mirrors the production case shown in the screenshot review (Digital
// Marketing Manager | Growth & Demand Generation Leader). The tag table
// here would be wallpaper — the suppression branch should fire.
export const tinyFlatPartialFixture: LiveMarketSnapshot = {
  posting_count: 6,
  fetched_at: now,
  cached: true,
  is_executive: false,
  top_tags: [
    { tag: "team handling", count: 1, pct: 17 },
    { tag: "team management", count: 1, pct: 17 },
    { tag: "team leading", count: 1, pct: 17 },
    { tag: "b2c", count: 1, pct: 17 },
    { tag: "handling", count: 1, pct: 17 },
    { tag: "leadership", count: 1, pct: 17 },
    { tag: "linkedin", count: 1, pct: 17 },
    { tag: "linkedin marketing", count: 1, pct: 17 },
  ],
  user_skill_overlap: { shown: false, matched_count: 0, matched_skills: [], missing_top_tags: [] },
  salary: { shown: false, n_disclosed: 0, n_total: 6, median_lpa: null, p25_lpa: null, p75_lpa: null },
  recency: { same_day_count: 6, within_7d_count: 0, older_count: 0 },
  corpus_relevance: { score: 28, band: "partial", title_overlap_pct: 22, skill_match_in_top_tags: 0 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};

  posting_count: 0,
  fetched_at: now,
  cached: false,
  is_executive: false,
  error: "data_fetch_failed",
  top_tags: [],
  user_skill_overlap: { shown: false, matched_count: 0, matched_skills: [], missing_top_tags: [] },
  salary: { shown: false, n_disclosed: 0, n_total: 0, median_lpa: null, p25_lpa: null, p75_lpa: null },
  recency: { same_day_count: 0, within_7d_count: 0, older_count: 0 },
  corpus_relevance: { score: 0, band: "thin", title_overlap_pct: 0, skill_match_in_top_tags: 0 },
  source: { name: "Naukri.com", via: "Apify", fetched_at: now },
};
