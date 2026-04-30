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
  it("maps 'Sales' to candidate list containing Other + business (never empty, never random)", () => {
    // Locks: sales-family scans never hit the random limit(20) fallback.
    // Implementation tries the literal value first (cheap exact-match attempt),
    // then falls through to the deterministic mapped categories.
    const out = getCategoryCandidates("Sales");
    expect(out).toContain("Other");
    expect(out).toContain("business");
    expect(out.length).toBeGreaterThanOrEqual(2);
  });

  it("maps 'Sales & Business Development' to the same Sales family candidates", () => {
    // Locks: industry label variants share the same candidate set.
    const out = getCategoryCandidates("Sales & Business Development");
    expect(out).toContain("Other");
    expect(out).toContain("business");
  });

  it("maps 'Marketing' to a list containing 'Marketing & Advertising'", () => {
    // Locks: marketing scans still route to the marketing taxonomy partition.
    const out = getCategoryCandidates("Marketing");
    expect(out).toContain("Marketing & Advertising");
  });

  it("does NOT duplicate the literal input when it already appears in the mapped list", () => {
    // Locks: deterministic ordering — exact-match value is not duplicated.
    const out = getCategoryCandidates("Marketing & Advertising");
    expect(out[0]).toBe("Marketing & Advertising");
    expect(out.filter((c) => c.toLowerCase() === "marketing & advertising").length).toBe(1);
  });

  it("maps 'IT & Software' to IT & Software variants", () => {
    // Locks: tech scans still route to the IT taxonomy.
    const out = getCategoryCandidates("IT & Software");
    expect(out).toContain("IT & Software");
  });

  it("falls back to ['<input>','Other'] for unknown industries (no random limit-20)", () => {
    // Locks: unknown industries try the literal value, then 'Other' as safety net.
    const out = getCategoryCandidates("Underwater Basket Weaving");
    expect(out[0]).toBe("Underwater Basket Weaving");
    expect(out[out.length - 1]).toBe("Other");
  });

  it("returns ['Other'] for empty/null input — never throws", () => {
    expect(getCategoryCandidates(null)).toEqual(["Other"]);
    expect(getCategoryCandidates(undefined)).toEqual(["Other"]);
    expect(getCategoryCandidates("")).toEqual(["Other"]);
    expect(getCategoryCandidates("   ")).toEqual(["Other"]);
  });

  it("HR / People candidate list contains 'Other' (recruiter, hr_generalist live there)", () => {
    // Locks: HR resumes have 'Other' available as a candidate so the lookup
    // doesn't fall to the random limit-20 grab-bag.
    expect(getCategoryCandidates("Human Resources")).toContain("Other");
    expect(getCategoryCandidates("HR")).toContain("Other");
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
