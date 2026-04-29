/**
 * role-normalizer.test.ts (Sprint 0, 2026-04-29)
 *
 * Locks in:
 *   • verbose Agent1 output ("Digital Marketing Manager | Growth & ...") → "digital_marketing_manager"
 *   • multiple separator types (| · — : / , and " - ", " – ", " — ") all strip qualifier
 *   • null/empty/whitespace input → ""
 *   • non-alphanumerics collapsed to single underscore
 *   • leading/trailing underscores stripped
 *   • case insensitivity (CTO === cto)
 *   • 60-char cap (safety)
 *   • pickFirstNormalizedMatch returns first candidate present in known set
 *   • pickFirstNormalizedMatch returns null when none match
 *
 * Heuristic conditions this fixture is calibrated against (per project rule):
 *   – KG enum set is qualifier-free snake_case (e.g. "senior_product_manager"
 *     not "senior_product_manager_saas"). Stripping after first separator
 *     is the contract — qualifiers are intentionally discarded.
 *   – 60-char cap chosen because longest legitimate enum is ~40 chars
 *     ("senior_engineering_manager_platform"); 60 leaves margin without
 *     enabling pathological inputs.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeRole, pickFirstNormalizedMatch } from "./role-normalizer.ts";

Deno.test("normalizeRole: verbose Agent1 output strips qualifier", () => {
  assertEquals(
    normalizeRole("Digital Marketing Manager | Growth & Performance"),
    "digital_marketing_manager",
  );
});

Deno.test("normalizeRole: pipe separator", () => {
  assertEquals(normalizeRole("Product Manager | SaaS"), "product_manager");
});

Deno.test("normalizeRole: middle dot separator", () => {
  assertEquals(normalizeRole("Engineering Manager · Platform"), "engineering_manager");
});

Deno.test("normalizeRole: em-dash separator with spaces", () => {
  assertEquals(normalizeRole("Senior PM — Growth"), "senior_pm");
});

Deno.test("normalizeRole: hyphen with spaces is a separator", () => {
  assertEquals(normalizeRole("Senior Product Manager - SaaS"), "senior_product_manager");
});

Deno.test("normalizeRole: en-dash with spaces is a separator", () => {
  assertEquals(normalizeRole("Senior Product Manager – SaaS"), "senior_product_manager");
});

Deno.test("normalizeRole: hyphen WITHOUT spaces stays in the slug", () => {
  // "data-scientist" should become "data_scientist", not be split.
  assertEquals(normalizeRole("data-scientist"), "data_scientist");
});

Deno.test("normalizeRole: forward slash separator", () => {
  assertEquals(normalizeRole("Designer / Researcher"), "designer");
});

Deno.test("normalizeRole: colon separator", () => {
  assertEquals(normalizeRole("VP: Engineering"), "vp");
});

Deno.test("normalizeRole: comma separator", () => {
  assertEquals(normalizeRole("Manager, Marketing"), "manager");
});

Deno.test("normalizeRole: null/undefined/empty → empty string", () => {
  assertEquals(normalizeRole(null), "");
  assertEquals(normalizeRole(undefined), "");
  assertEquals(normalizeRole(""), "");
  assertEquals(normalizeRole("   "), "");
});

Deno.test("normalizeRole: case insensitive", () => {
  assertEquals(normalizeRole("CTO"), "cto");
  assertEquals(normalizeRole("Cto"), "cto");
});

Deno.test("normalizeRole: ampersand and special chars collapse to single underscore", () => {
  assertEquals(normalizeRole("Sales & Marketing"), "sales_marketing");
  assertEquals(normalizeRole("Q&A   Engineer"), "q_a_engineer");
});

Deno.test("normalizeRole: leading/trailing whitespace and underscores stripped", () => {
  assertEquals(normalizeRole("  Manager  "), "manager");
  assertEquals(normalizeRole("___Manager___"), "manager");
});

Deno.test("normalizeRole: 60-char cap enforced", () => {
  const long = "a".repeat(100);
  assertEquals(normalizeRole(long).length, 60);
});

Deno.test("pickFirstNormalizedMatch: returns first candidate found in known set", () => {
  const known = new Set(["product_manager", "engineering_manager"]);
  const got = pickFirstNormalizedMatch(
    ["Some Random Title", "Engineering Manager | Platform", "Product Manager"],
    known,
  );
  assertEquals(got, "engineering_manager");
});

Deno.test("pickFirstNormalizedMatch: returns null when no candidate matches", () => {
  const known = new Set(["product_manager"]);
  const got = pickFirstNormalizedMatch(["Random Thing", "Other Thing", null], known);
  assertEquals(got, null);
});

Deno.test("pickFirstNormalizedMatch: ignores nulls / empty", () => {
  const known = new Set(["cto"]);
  const got = pickFirstNormalizedMatch([null, undefined, "", "CTO"], known);
  assertEquals(got, "cto");
});
