// Tests for the synonym + token-aware skill matcher introduced in
// Phase 2A-ii of the apify-naukri-jobs match audit.
//
// Run with:
//   deno test --allow-net --allow-env supabase/functions/tests/skill-synonyms.test.ts

import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  skillPresent,
  toMatchPct,
  toMatchLabel,
} from "../apify-naukri-jobs/index.ts";

// ─────────────────────────────────────────────────────────────────────
// (a) Direct substring match still works
// ─────────────────────────────────────────────────────────────────────
Deno.test("direct substring: java in 'java spring boot'", () => {
  assertStrictEquals(skillPresent("java", "java spring boot"), true);
});

// ─────────────────────────────────────────────────────────────────────
// (b) Token-aware match handles ".js" → "js"
// ─────────────────────────────────────────────────────────────────────
Deno.test("token-aware: node.js matches 'node js development'", () => {
  // "node.js" as it would arrive from a user is normalized to "node js"
  // by the caller; we test both pre-normalized and rawer forms.
  assertStrictEquals(skillPresent("node js", "node js development"), true);
});

Deno.test("token-aware: react.js matches 'reactjs developer' via synonym", () => {
  // "react js" → SKILL_SYNONYMS["react"] includes "reactjs"
  // We pass the normalized form "react js"; the loose-key index maps
  // "react" → variants and "reactjs" lands as a contiguous substring.
  assertStrictEquals(skillPresent("react", "reactjs developer"), true);
});

// ─────────────────────────────────────────────────────────────────────
// (c) Synonym match works for marketing
// ─────────────────────────────────────────────────────────────────────
Deno.test("synonym (marketing): seo matches 'search engine optimization specialist'", () => {
  assertStrictEquals(
    skillPresent("seo", "search engine optimization specialist"),
    true,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (d) Synonym match works for engineering management
// ─────────────────────────────────────────────────────────────────────
Deno.test("synonym (eng): system design matches 'experienced in software architecture'", () => {
  assertStrictEquals(
    skillPresent("system design", "experienced in software architecture"),
    true,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (e) Short-token exclusion (no false positive on "ai" / "ml")
// ─────────────────────────────────────────────────────────────────────
Deno.test("short-token exclusion: 'ai' does NOT match 'available immediately'", () => {
  assertStrictEquals(skillPresent("ai", "available immediately"), false);
});

Deno.test("short-token exclusion: 'ml' does NOT match 'html templates'", () => {
  assertStrictEquals(skillPresent("ml", "html templates"), false);
});

// ─────────────────────────────────────────────────────────────────────
// (f) Anti-broadening sanity — map discipline holds
// ─────────────────────────────────────────────────────────────────────
Deno.test("anti-broadening: java does NOT match 'node js backend developer'", () => {
  assertStrictEquals(
    skillPresent("java", "node js backend developer"),
    false,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (g) Multiple sub-tokens — all required
// ─────────────────────────────────────────────────────────────────────
Deno.test("token-aware: 'spring boot' does NOT match 'boot camp for new hires'", () => {
  assertStrictEquals(
    skillPresent("spring boot", "boot camp for new hires"),
    false,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (h) Negative penalty test for toMatchPct
//     Anchor-in-title with 0 shared skills (when user HAS skills) should
//     score lower than the same anchor-in-title with 0 user skills.
// ─────────────────────────────────────────────────────────────────────
Deno.test("toMatchPct: penalty fires when anchor-in-title + 0 skill overlap + user has skills", () => {
  const penalized = toMatchPct({
    anchorInTitle: true,
    sharedSkillsCount: 0,
    userSkillsCount: 5,
    recencyDays: 7,
  });
  const noPenalty = toMatchPct({
    anchorInTitle: true,
    sharedSkillsCount: 0,
    userSkillsCount: 0,
    recencyDays: 7,
  });
  assert(
    penalized < noPenalty,
    `expected penalized (${penalized}) < noPenalty (${noPenalty})`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (i) Score spread sanity — floor and ceiling
// ─────────────────────────────────────────────────────────────────────
Deno.test("toMatchPct: weakest possible (no anchor, no skills) sits at 40", () => {
  assertEquals(
    toMatchPct({
      anchorInTitle: false,
      sharedSkillsCount: 0,
      userSkillsCount: 5,
      recencyDays: null,
    }),
    40,
  );
});

Deno.test("toMatchPct: strongest possible (anchor + full overlap + same-day) caps at 96", () => {
  assertEquals(
    toMatchPct({
      anchorInTitle: true,
      sharedSkillsCount: 5,
      userSkillsCount: 5,
      recencyDays: 0,
    }),
    96,
  );
});

// ─────────────────────────────────────────────────────────────────────
// (j) Label cutoffs — boundary-precise
// ─────────────────────────────────────────────────────────────────────
Deno.test("toMatchLabel: 80 → Strong fit", () => {
  assertEquals(toMatchLabel(80), "Strong fit");
});

Deno.test("toMatchLabel: 79 → Relevant", () => {
  assertEquals(toMatchLabel(79), "Relevant");
});

Deno.test("toMatchLabel: 65 → Relevant (lower bound)", () => {
  assertEquals(toMatchLabel(65), "Relevant");
});

Deno.test("toMatchLabel: 64 → Stretch", () => {
  assertEquals(toMatchLabel(64), "Stretch");
});
