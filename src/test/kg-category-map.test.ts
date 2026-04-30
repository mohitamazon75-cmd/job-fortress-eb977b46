/**
 * Fix A — kg-category-map invariants.
 *
 * Each test restates the heuristic it pins so future edits to CATEGORY_PRIORITY
 * cannot rot the test silently (BL-036 lesson).
 *
 * Bug being prevented: user picks industry "Sales" → no `category='Sales'` row
 * exists in job_taxonomy → previously fell back to random limit(20) grab-bag →
 * "Senior Manager – Business Development" token-matched supply_chain_manager.
 */
import { describe, expect, it } from "vitest";
import { getCategoryCandidates, fetchTaxonomyByCandidates } from "@/lib/kg-category-map";

describe("getCategoryCandidates — Fix A (Sales leak)", () => {
  it("maps 'Sales' to ['Other','business'] — never returns empty", () => {
    // Locks: sales-family scans never hit the random limit(20) fallback.
    const out = getCategoryCandidates("Sales");
    expect(out[0]).toBe("Other");
    expect(out).toContain("business");
  });

  it("maps 'Sales & Business Development' the same way", () => {
    // Locks: industry label variants do not change the candidate set.
    const out = getCategoryCandidates("Sales & Business Development");
    expect(out).toEqual(["Other", "business"]);
  });

  it("maps 'Marketing' to Marketing & Advertising variants first", () => {
    // Locks: marketing scans still go to the marketing taxonomy partition.
    const out = getCategoryCandidates("Marketing");
    expect(out[0]).toBe("Marketing & Advertising");
  });

  it("preserves exact 'Marketing & Advertising' as the head when it would otherwise duplicate", () => {
    // Locks: deterministic head ordering — exact-match value is not duplicated nor demoted.
    const out = getCategoryCandidates("Marketing & Advertising");
    expect(out[0]).toBe("Marketing & Advertising");
    // No duplicate of the exact match in the tail.
    expect(out.filter((c) => c.toLowerCase() === "marketing & advertising").length).toBe(1);
  });

  it("maps 'IT & Software' to IT & Software variants", () => {
    // Locks: tech scans still route to the IT taxonomy.
    const out = getCategoryCandidates("IT & Software");
    expect(out).toContain("IT & Software");
  });

  it("falls back to ['<input>','Other'] for unknown industries (no random limit-20)", () => {
    // Locks: unknown industries try the literal value, then the deterministic 'Other' partition.
    const out = getCategoryCandidates("Underwater Basket Weaving");
    expect(out[0]).toBe("Underwater Basket Weaving");
    expect(out[out.length - 1]).toBe("Other");
  });

  it("returns ['Other'] for empty/null input — never throws", () => {
    // Locks: pipeline never crashes on missing industry.
    expect(getCategoryCandidates(null)).toEqual(["Other"]);
    expect(getCategoryCandidates(undefined)).toEqual(["Other"]);
    expect(getCategoryCandidates("")).toEqual(["Other"]);
    expect(getCategoryCandidates("   ")).toEqual(["Other"]);
  });

  it("HR / People maps to 'Other' (recruiter, hr_generalist live there)", () => {
    // Locks: HR resumes don't land in the marketing/tech bucket.
    expect(getCategoryCandidates("Human Resources")[0]).toBe("Other");
    expect(getCategoryCandidates("HR")[0]).toBe("Other");
  });
});

describe("fetchTaxonomyByCandidates — fail-open ordering", () => {
  it("returns the first non-empty fetch result and stops", async () => {
    // Locks: we don't keep hitting the DB once we've found rows.
    const calls: string[] = [];
    const fetcher = async (cat: string) => {
      calls.push(cat);
      if (cat === "Other") return [{ family: "sales_executive" }];
      return [];
    };
    const { rows, matchedCategory } = await fetchTaxonomyByCandidates(
      ["Sales", "Other", "business"],
      fetcher,
    );
    expect(rows).toEqual([{ family: "sales_executive" }]);
    expect(matchedCategory).toBe("Other");
    expect(calls).toEqual(["Sales", "Other"]); // stopped before "business"
  });

  it("returns empty + null when nothing matches", async () => {
    // Locks: no fabricated row when DB has nothing.
    const { rows, matchedCategory } = await fetchTaxonomyByCandidates(["A", "B"], async () => []);
    expect(rows).toEqual([]);
    expect(matchedCategory).toBeNull();
  });
});
