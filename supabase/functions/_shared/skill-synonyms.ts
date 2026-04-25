/**
 * Skill synonym map for the Naukri match layer.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Phase 2A-i diagnosis (apify-naukri-jobs match audit, 2026-04-25):
 * literal substring matching against Naukri's `tagsAndSkills` corpus
 * misses common vocabulary variants — e.g. user declares "SEO" but the
 * job tag reads "Search Engine Optimization", user declares "Node.js"
 * but the tag reads "node js". These misses collapse skill-overlap to
 * 0% on roles where the underlying fit is actually strong (R2 marketing
 * baseline = 0% overlap despite real overlap of intent).
 *
 * This map bridges canonical user-side skill names → variant strings
 * the matcher should ALSO check inside a job's normalized haystack.
 *
 * RULES (do not violate when extending)
 * -------------------------------------
 *  1. HARD CAP: 150 canonical entries. Past ~100 the Pareto tail is
 *     low-ROI and every entry is a false-positive risk surface.
 *  2. ONE-DIRECTIONAL ONLY. Map is "if user's skill is X, also check Y".
 *     Never add the reverse (Y → X) — creates infinite-expansion attack
 *     surface and pollutes match logic for users who never declared X.
 *  3. NEVER BROADEN SEMANTICS. Do NOT add canonical → category mappings:
 *       - NO "java"  → ["backend"]   (matches every Node/Python job)
 *       - NO "aws"   → ["cloud"]     (matches every Azure/GCP job)
 *       - NO "react" → ["frontend"]  (matches every Vue/Angular job)
 *       - NO "seo"   → ["marketing"] (matches every sales role)
 *     Variants must be true synonyms or reformattings, not parent
 *     categories.
 *  4. All keys and values lowercase. The matcher normalizes haystack
 *     and skill before comparison.
 *  5. New entries should be justified by observed Naukri tag frequency
 *     (see `final_json_report->'all_skills'` analysis), not invented.
 */

export const SKILL_SYNONYMS: Record<string, string[]> = {
  // ─────────────────────────────────────────────────────────────────
  // Marketing / GTM (highest user-volume cluster from DB query)
  // ─────────────────────────────────────────────────────────────────
  "seo": ["search engine optimization", "search engine optimisation", "organic search"],
  "google ads": ["google adwords", "adwords", "ppc", "sem", "paid search"],
  "performance marketing": ["paid marketing", "paid acquisition", "growth marketing"],
  "content marketing": ["content strategy", "content writing", "content creation"],
  "hubspot": ["hubspot crm", "hubspot marketing"],
  "salesforce": ["salesforce crm", "sfdc", "salesforce.com"],
  "looker studio": ["data studio", "google data studio"],
  "linkedin ads": ["linkedin advertising", "linkedin campaigns"],
  "meta ads": ["facebook ads", "facebook advertising", "instagram ads"],
  "go-to-market strategy": ["gtm strategy", "gtm", "go to market"],
  "demand generation": ["demand gen", "lead generation", "lead gen"],
  "conversion rate optimization": ["cro", "conversion optimization"],
  "social media content": ["social media marketing", "social media management", "smm"],
  "email writing": ["email marketing", "email campaigns"],
  "stakeholder management": ["stakeholder alignment", "stakeholder engagement"],
  "presentation design": ["powerpoint", "pitch decks", "slide design"],
  "report generation": ["reporting", "business reporting"],

  // ─────────────────────────────────────────────────────────────────
  // Engineering (R1/R3 testing surface)
  // ─────────────────────────────────────────────────────────────────
  "java": ["core java", "java development"],
  "spring boot": ["springboot", "spring framework"],
  "microservices": ["microservice", "micro-services", "service-oriented architecture"],
  "postgresql": ["postgres", "psql"],
  "aws": ["amazon web services", "aws cloud"],
  "node.js": ["nodejs", "node js", "node"],
  "react": ["react.js", "reactjs", "react native"],
  "system design": ["system architecture", "software architecture", "solution architecture"],
  "kubernetes": ["k8s"],
  "ci/cd": ["cicd", "continuous integration", "continuous deployment"],
  "rest api": ["restful api", "rest apis", "restful"],
  "hibernate": ["hibernate orm", "jpa"],

  // ─────────────────────────────────────────────────────────────────
  // Management / Leadership (R3 specifically)
  // ─────────────────────────────────────────────────────────────────
  "people management": ["team management", "team leadership", "team handling", "team building"],
  "engineering leadership": ["technical leadership", "tech leadership"],
  "project management": ["program management", "delivery management"],

  // ─────────────────────────────────────────────────────────────────
  // Data / Analytics (secondary cluster)
  // ─────────────────────────────────────────────────────────────────
  "data visualization": ["dataviz", "data viz"],
  "a/b testing": ["ab testing", "split testing", "experimentation"],
  "sql": ["mysql", "tsql"], // narrow on purpose — do NOT add "database"
};
