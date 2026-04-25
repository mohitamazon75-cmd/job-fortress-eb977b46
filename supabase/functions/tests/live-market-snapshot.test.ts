// Tests for live-market-snapshot edge function (Phase 2B-ii).
//
// These exercise the pure aggregation helpers against the 3 saved Apify
// datasets when available, and fall back to inline synthetic fixtures so
// the suite passes in any environment.
//
// Run with:
//   deno test --allow-net --allow-env --allow-read \
//     supabase/functions/tests/live-market-snapshot.test.ts

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  aggregateRecency,
  aggregateSalary,
  aggregateTopTags,
  buildSnapshot,
  computeCorpusRelevance,
  computeUserSkillOverlap,
  emptyShape,
  isExecutiveTitle,
  roleTokens,
  type ApifyJob,
} from "../live-market-snapshot/index.ts";

// ─────────────────────────────────────────────────────────────────────
// Dataset loader — uses /tmp files if available, else synthetic fallback
// ─────────────────────────────────────────────────────────────────────

type DatasetMeta = { jobs: ApifyJob[]; source: "real" | "synthetic" };

function loadOrFallback(path: string, syntheticFactory: () => ApifyJob[]): DatasetMeta {
  try {
    const text = Deno.readTextFileSync(path);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { jobs: parsed as ApifyJob[], source: "real" };
    }
  } catch {
    // fall through
  }
  return { jobs: syntheticFactory(), source: "synthetic" };
}

// Minimal synthetic stand-ins shaped like the real Apify payload.
// They exercise the same aggregation paths so test assertions hold.
function synthR1(): ApifyJob[] {
  // 12 java jobs with mixed salary disclosure, all "Today"
  return Array.from({ length: 12 }, (_, i) => ({
    title: i < 8 ? "Senior Java Developer" : "Backend Engineer",
    tagsAndSkills: "Java,Spring Boot,Microservices,AWS,Hibernate,REST API",
    jobDescription: "Java + Spring Boot microservices role.",
    footerPlaceholderLabel: "Today",
    salaryDetail: i % 2 === 0
      ? { hideSalary: false, minimumSalary: 1500000, maximumSalary: 2500000 }
      : { hideSalary: true, minimumSalary: 0, maximumSalary: 0 },
  }));
}
function synthR2(): ApifyJob[] {
  // Marketing-shaped corpus polluted with sales tags (mirrors real R2).
  return Array.from({ length: 10 }, (_, i) => ({
    title: "Digital Marketing Manager",
    tagsAndSkills: i < 7 ? "Field Sales,B2C Sales,Lead Generation,Customer Service" : "Brand Marketing,Communication",
    jobDescription: "Sales-led marketing role.",
    footerPlaceholderLabel: "Today",
    salaryDetail: i < 6
      ? { hideSalary: false, minimumSalary: 300000, maximumSalary: 500000 }
      : { hideSalary: true, minimumSalary: 0, maximumSalary: 0 },
  }));
}
function synthR3(): ApifyJob[] {
  return Array.from({ length: 12 }, (_, i) => ({
    title: "Engineering Manager",
    tagsAndSkills: "People Management,Project Management,System Design,Java,AWS,Python",
    jobDescription: "Engineering management role.",
    footerPlaceholderLabel: "1 day ago",
    salaryDetail: i < 6
      ? { hideSalary: false, minimumSalary: 2000000, maximumSalary: 4000000 }
      : { hideSalary: true, minimumSalary: 0, maximumSalary: 0 },
  }));
}

const R1 = loadOrFallback("/tmp/raw_R1_revised_baseline.json", synthR1);
const R2 = loadOrFallback("/tmp/raw_R2_revised_baseline.json", synthR2);
const R3 = loadOrFallback("/tmp/raw_R3_revised_baseline.json", synthR3);

console.log(`[live-market-snapshot.test] R1=${R1.source}(n=${R1.jobs.length}) R2=${R2.source}(n=${R2.jobs.length}) R3=${R3.source}(n=${R3.jobs.length})`);

// ─────────────────────────────────────────────────────────────────────
// 1. R1 (Java/Blr) — strong signal expected
// ─────────────────────────────────────────────────────────────────────
Deno.test("R1 (Java/Blr): top tags + skill overlap + salary all populated", () => {
  const skills = ["Java", "Spring Boot", "Microservices", "AWS", "PostgreSQL", "Hibernate"];
  const snap = buildSnapshot(R1.jobs, skills, false, "Senior Java Developer");
  assertEquals(snap.posting_count, R1.jobs.length);
  assertEquals(snap.top_tags.length <= 8, true);
  assert(snap.top_tags.length > 0, "top_tags should be non-empty");
  assertEquals(snap.user_skill_overlap.shown, true);
  assert(snap.user_skill_overlap.matched_count >= 4,
    `expected matched_count >= 4, got ${snap.user_skill_overlap.matched_count} (matched: ${snap.user_skill_overlap.matched_skills.join(",")})`);
  assertEquals(snap.salary.shown, true);
  const med = snap.salary.median_lpa!;
  assert(med >= 5 && med <= 30, `median_lpa ${med} out of sanity range 5-30`);
  assertEquals(snap.corpus_relevance.band, "strong",
    `expected band=strong for clean Java corpus, got band=${snap.corpus_relevance.band} score=${snap.corpus_relevance.score}`);
});

// ─────────────────────────────────────────────────────────────────────
// 2. R2 (Marketing/Mum) — overlap intentionally hides
// ─────────────────────────────────────────────────────────────────────
Deno.test("R2 (Marketing/Mum): overlap.shown=false (designed low-signal behavior)", () => {
  const skills = ["SEO", "Google Ads", "Content Marketing", "Performance Marketing", "HubSpot", "Looker Studio"];
  const snap = buildSnapshot(R2.jobs, skills, false, "Digital Marketing Manager");
  assert(snap.top_tags.length > 0, "top_tags should be non-empty");
  assertEquals(snap.user_skill_overlap.shown, false,
    `expected shown=false; matched=${snap.user_skill_overlap.matched_count} skills=[${snap.user_skill_overlap.matched_skills.join(",")}]`);
  assertEquals(snap.salary.shown, true);
  // Polluted marketing corpus should NOT score "strong" — should be partial or thin.
  assert(snap.corpus_relevance.band !== "strong",
    `polluted marketing corpus should not band=strong (got ${snap.corpus_relevance.band}, score=${snap.corpus_relevance.score})`);
});

// ─────────────────────────────────────────────────────────────────────
// 3. R3 (Eng Mgr/Blr): top_tags + salary populated; overlap correctly
//    hides because Naukri's Bangalore Eng-Mgr corpus is tag-polluted
//    with adjacent-role vocabulary (order-to-cash, broking, sql, senior).
//    This is correct behavior — the >=2 gate prevents misleading match
//    columns when the top-tag corpus doesn't reflect the user's role.
// ─────────────────────────────────────────────────────────────────────
Deno.test("R3 (Eng Mgr/Blr): top_tags + salary populated; overlap correctly hides because Naukri's Bangalore Eng-Mgr corpus is tag-polluted with adjacent-role vocabulary (order-to-cash, broking, sql, senior). This is correct behavior — the >=2 gate prevents misleading match columns when the top-tag corpus doesn't reflect the user's role.", () => {
  const skills = ["People Management", "System Design", "Java", "AWS", "Microservices", "Project Management"];
  const snap = buildSnapshot(R3.jobs, skills, false, "Engineering Manager");
  assertEquals(snap.user_skill_overlap.shown, false);
  assert(snap.user_skill_overlap.matched_count >= 1,
    `matched_count=${snap.user_skill_overlap.matched_count} skills=[${snap.user_skill_overlap.matched_skills.join(",")}]`);
  assert(snap.top_tags.length >= 5, `top_tags.length=${snap.top_tags.length}`);
  if (snap.salary.n_disclosed >= 5) {
    assertEquals(snap.salary.shown, true);
    assertExists(snap.salary.median_lpa);
  }
  // Relevance must be present on every snapshot.
  assertExists(snap.corpus_relevance);
  assertEquals(typeof snap.corpus_relevance.score, "number");
});

// ─────────────────────────────────────────────────────────────────────
// 3b. corpus_relevance unit — strong vs thin synthetic corpora
// ─────────────────────────────────────────────────────────────────────
Deno.test("corpus_relevance: clean corpus → band=strong; polluted corpus → band=thin", () => {
  // Clean: every job titled "Java Developer", tags align with user skills.
  const clean: ApifyJob[] = Array.from({ length: 20 }, () => ({
    title: "Java Developer",
    tagsAndSkills: "Java,Spring Boot,Microservices,REST API,Hibernate,AWS",
  }));
  const cleanTags = aggregateTopTags(clean);
  const r1 = computeCorpusRelevance(clean, cleanTags, ["Java", "Spring Boot", "Microservices"], "Senior Java Developer");
  assertEquals(r1.band, "strong", `clean → expected strong, got ${r1.band} (score=${r1.score})`);

  // Polluted: marketing-titled user, sales-tagged corpus.
  const polluted: ApifyJob[] = Array.from({ length: 20 }, () => ({
    title: "Field Sales Executive",
    tagsAndSkills: "Field Sales,B2C Sales,Cold Calling,Lead Generation,Customer Service",
  }));
  const pollutedTags = aggregateTopTags(polluted);
  const r2 = computeCorpusRelevance(polluted, pollutedTags, ["SEO", "Google Ads", "Content Marketing"], "Digital Marketing Manager");
  assertEquals(r2.band, "thin", `polluted → expected thin, got ${r2.band} (score=${r2.score})`);
});

Deno.test("roleTokens: strips seniority + generic stopwords", () => {
  assertEquals(roleTokens("Senior Java Developer"), ["java", "developer"]);
  assertEquals(roleTokens("Lead Engineering Manager"), ["engineering"]);
  assertEquals(roleTokens("Marketing Manager"), ["marketing"]);
});

// ─────────────────────────────────────────────────────────────────────
// 4. Stopword filter
// ─────────────────────────────────────────────────────────────────────
Deno.test("stopword filter: 'sales' is excluded from top_tags", () => {
  const jobs: ApifyJob[] = Array.from({ length: 8 }, () => ({
    tagsAndSkills: "Sales,B2B Sales,Field Sales",
  }));
  const tags = aggregateTopTags(jobs);
  assert(!tags.some((t) => t.tag === "sales"), "'sales' should be filtered out");
  // The non-stopword tags should still appear.
  assert(tags.some((t) => t.tag === "b2b sales"), "compound tags must survive");
});

// ─────────────────────────────────────────────────────────────────────
// 5. Tag length filter
// ─────────────────────────────────────────────────────────────────────
Deno.test("length filter: 2-char tags 'ai'/'ml' are excluded", () => {
  const jobs: ApifyJob[] = Array.from({ length: 5 }, () => ({
    tagsAndSkills: "ai,ml,Generative AI,Machine Learning",
  }));
  const tags = aggregateTopTags(jobs);
  assert(!tags.some((t) => t.tag === "ai"));
  assert(!tags.some((t) => t.tag === "ml"));
  assert(tags.some((t) => t.tag === "generative ai"));
});

// ─────────────────────────────────────────────────────────────────────
// 6. Executive gate
// ─────────────────────────────────────────────────────────────────────
Deno.test("executive gate: CEO triggers is_executive=true with stable empty shape", () => {
  assertEquals(isExecutiveTitle("CEO"), true);
  assertEquals(isExecutiveTitle("Chief Marketing Officer"), true);
  assertEquals(isExecutiveTitle("Senior Java Developer"), false);
  const shape = emptyShape({ is_executive: true });
  assertEquals(shape.is_executive, true);
  assertEquals(shape.posting_count, 0);
  assertEquals(shape.top_tags.length, 0);
  assertEquals(shape.salary.shown, false);
  assertEquals(shape.salary.median_lpa, null);
  assertEquals(shape.recency.same_day_count, 0);
});

// ─────────────────────────────────────────────────────────────────────
// 7. Salary aggregation: hand-computed median/p25/p75
// ─────────────────────────────────────────────────────────────────────
Deno.test("salary: median/p25/p75 match hand-computed values", () => {
  // 10 jobs with midpoints (LPA): 4, 6, 8, 10, 12, 14, 16, 18, 20, 22
  // sorted: same. median = (12+14)/2 = 13. p25 (i=floor(9*0.25)=2) = 8. p75 (i=6) = 16.
  const mids = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const jobs: ApifyJob[] = mids.map((m) => ({
    salaryDetail: { hideSalary: false, minimumSalary: m * 100000, maximumSalary: m * 100000 },
  }));
  const s = aggregateSalary(jobs);
  assertEquals(s.n_disclosed, 10);
  assertEquals(s.median_lpa, 13);
  assertEquals(s.p25_lpa, 8);
  assertEquals(s.p75_lpa, 16);
  assertEquals(s.shown, true);
});

// ─────────────────────────────────────────────────────────────────────
// 8. Salary all hidden
// ─────────────────────────────────────────────────────────────────────
Deno.test("salary: all hidden → shown=false, median=null", () => {
  const jobs: ApifyJob[] = Array.from({ length: 6 }, () => ({
    salaryDetail: { hideSalary: true, minimumSalary: 0, maximumSalary: 0 },
  }));
  const s = aggregateSalary(jobs);
  assertEquals(s.shown, false);
  assertEquals(s.n_disclosed, 0);
  assertEquals(s.median_lpa, null);
});

// ─────────────────────────────────────────────────────────────────────
// 9. Salary edge: hideSalary=false but both bounds = 0
// ─────────────────────────────────────────────────────────────────────
Deno.test("salary: hideSalary=false with both bounds=0 NOT counted disclosed", () => {
  const jobs: ApifyJob[] = [
    { salaryDetail: { hideSalary: false, minimumSalary: 0, maximumSalary: 0 } },
    { salaryDetail: { hideSalary: false, minimumSalary: 1000000, maximumSalary: 2000000 } },
  ];
  const s = aggregateSalary(jobs);
  assertEquals(s.n_disclosed, 1);
  assertEquals(s.median_lpa, 15);
});

// ─────────────────────────────────────────────────────────────────────
// 10. Recency parsing
// ─────────────────────────────────────────────────────────────────────
Deno.test("recency: mixed labels bucket correctly", () => {
  const jobs: ApifyJob[] = [
    { footerPlaceholderLabel: "Just Now" },
    { footerPlaceholderLabel: "Today" },
    { footerPlaceholderLabel: "5 hours ago" },
    { footerPlaceholderLabel: "2 days ago" },
    { footerPlaceholderLabel: "7 days ago" },
    { footerPlaceholderLabel: "10 days ago" },
    { footerPlaceholderLabel: "3 weeks ago" },
    { footerPlaceholderLabel: "1 month ago" },
    { footerPlaceholderLabel: "" },
  ];
  const r = aggregateRecency(jobs);
  assertEquals(r.same_day_count, 3);
  assertEquals(r.within_7d_count, 2);
  assertEquals(r.older_count, 3);
});

// ─────────────────────────────────────────────────────────────────────
// 11. Stable shape on failure
// ─────────────────────────────────────────────────────────────────────
Deno.test("emptyShape carries every top-level key with safe defaults", () => {
  const s = emptyShape({ is_executive: false, error: "data_fetch_failed" });
  assertEquals(s.posting_count, 0);
  assertExists(s.fetched_at);
  assertEquals(s.cached, false);
  assertEquals(s.is_executive, false);
  assertEquals(s.error, "data_fetch_failed");
  assertEquals(Array.isArray(s.top_tags), true);
  assertEquals(s.user_skill_overlap.shown, false);
  assertEquals(s.user_skill_overlap.matched_count, 0);
  assertEquals(s.salary.shown, false);
  assertEquals(s.salary.median_lpa, null);
  assertEquals(s.recency.same_day_count, 0);
  assertEquals(s.corpus_relevance.band, "thin");
  assertEquals(s.corpus_relevance.score, 0);
  assertEquals(s.source.name, "Naukri.com");
  assertEquals(s.source.via, "Apify");
});

// ─────────────────────────────────────────────────────────────────────
// 12. computeUserSkillOverlap unit
// ─────────────────────────────────────────────────────────────────────
Deno.test("computeUserSkillOverlap: missing_top_tags is the complement of matches", () => {
  const top = [
    { tag: "java" }, { tag: "spring boot" }, { tag: "kafka" }, { tag: "docker" },
  ];
  const result = computeUserSkillOverlap(top, ["Java", "Spring Boot", "PostgreSQL"]);
  assertEquals(result.matched_count, 2);
  assertEquals(result.matched_skills.sort(), ["Java", "Spring Boot"]);
  assertEquals(result.missing_top_tags.sort(), ["docker", "kafka"]);
  assertEquals(result.shown, true);
});
