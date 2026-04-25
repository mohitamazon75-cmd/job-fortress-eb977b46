import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  _resetToolCatalogCacheForTests,
  formatCatalog,
  getCurrentToolCatalog,
  type ToolCatalog,
} from "../_shared/tool-catalog.ts";

// deno-lint-ignore no-explicit-any
function makeSupabase(result: { data: any; error: any }, counter?: { n: number }) {
  return {
    from(_table: string) {
      if (counter) counter.n += 1;
      const chain = {
        select(_cols: string) {
          return chain;
        },
        not(_col: string, _op: string, _val: unknown) {
          return Promise.resolve(result);
        },
      };
      return chain;
    },
  };
}

Deno.test("(a) returns empty catalog on DB error", async () => {
  _resetToolCatalogCacheForTests();
  const supa = makeSupabase({ data: null, error: new Error("boom") });
  const cat = await getCurrentToolCatalog(supa);
  assertEquals(cat, { tools: [], categories: {} });
});

Deno.test("(b) returns empty catalog when data is null/not-array", async () => {
  _resetToolCatalogCacheForTests();
  const supa = makeSupabase({ data: null, error: null });
  const cat = await getCurrentToolCatalog(supa);
  assertEquals(cat, { tools: [], categories: {} });

  _resetToolCatalogCacheForTests();
  const supa2 = makeSupabase({ data: "not an array" as unknown, error: null });
  const cat2 = await getCurrentToolCatalog(supa2);
  assertEquals(cat2, { tools: [], categories: {} });
});

Deno.test("(c) dedupes overlapping tools across rows", async () => {
  _resetToolCatalogCacheForTests();
  const supa = makeSupabase({
    data: [
      { category: "coding", replacement_tools: ["Cursor", "GitHub Copilot"] },
      { category: "coding", replacement_tools: ["Cursor", "Devin"] },
    ],
    error: null,
  });
  const cat = await getCurrentToolCatalog(supa);
  assertEquals(cat.tools, ["Cursor", "Devin", "GitHub Copilot"]);
});

Deno.test("(d) groups tools into categories, deduped and sorted", async () => {
  _resetToolCatalogCacheForTests();
  const supa = makeSupabase({
    data: [
      { category: "coding", replacement_tools: ["Cursor", "Devin"] },
      { category: "coding", replacement_tools: ["GitHub Copilot", "Cursor"] },
      { category: "design", replacement_tools: ["Figma AI"] },
    ],
    error: null,
  });
  const cat = await getCurrentToolCatalog(supa);
  assertEquals(cat.categories["coding"], [
    "Cursor",
    "Devin",
    "GitHub Copilot",
  ]);
  assertEquals(cat.categories["design"], ["Figma AI"]);
});

Deno.test("(e) falls back to 'general' when category null or empty", async () => {
  _resetToolCatalogCacheForTests();
  const supa = makeSupabase({
    data: [
      { category: null, replacement_tools: ["ToolA"] },
      { category: "", replacement_tools: ["ToolB"] },
      { category: "   ", replacement_tools: ["ToolC"] },
    ],
    error: null,
  });
  const cat = await getCurrentToolCatalog(supa);
  assertEquals(cat.categories["general"], ["ToolA", "ToolB", "ToolC"]);
});

Deno.test("(f) cache hit: .from invoked exactly once across two calls", async () => {
  _resetToolCatalogCacheForTests();
  const counter = { n: 0 };
  const supa = makeSupabase(
    {
      data: [{ category: "coding", replacement_tools: ["Cursor"] }],
      error: null,
    },
    counter,
  );
  await getCurrentToolCatalog(supa);
  await getCurrentToolCatalog(supa);
  assertEquals(counter.n, 1);
});

Deno.test("(g) formatCatalog: empty sentinel + populated format", () => {
  const empty: ToolCatalog = { tools: [], categories: {} };
  assertEquals(
    formatCatalog(empty),
    "(catalog unavailable — use category language only, never invent product names)",
  );

  const populated: ToolCatalog = {
    tools: ["Cursor", "Figma AI"],
    categories: {
      design: ["Figma AI"],
      coding: ["Cursor", "Devin"],
    },
  };
  const out = formatCatalog(populated);
  const lines = out.split("\n");
  assertEquals(lines[0], "AI TOOL CATALOG (canonical, fetched live):");
  // alphabetical: coding before design
  assertEquals(lines[1], "- coding: Cursor, Devin");
  assertEquals(lines[2], "- design: Figma AI");
  assertStringIncludes(out, "Cursor, Devin");
});

Deno.test("(h) placeholder substitution sanity — replaceAll fires on '{{TOOL_CATALOG}}'", () => {
  const original = "Header text\n{{TOOL_CATALOG}}\nFooter text";
  const block = formatCatalog({
    tools: ["Cursor", "Figma AI"],
    categories: { coding: ["Cursor"], design: ["Figma AI"] },
  });
  const out = original.replaceAll("{{TOOL_CATALOG}}", block);
  assertEquals(out.includes("{{TOOL_CATALOG}}"), false);
  assertStringIncludes(out, "AI TOOL CATALOG (canonical, fetched live):");
  assertEquals(out.length > original.length, true);
});
