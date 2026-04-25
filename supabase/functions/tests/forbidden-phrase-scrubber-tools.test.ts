import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  scrubStringAll,
  scrubAll,
} from "../_shared/forbidden-phrase-scrubber.ts";

// ───────────────────────────────────────────────────────────────
// Tool-name scrubbing — only fires when a catalog is supplied.
// Names already in the catalog are passthrough; names not in the
// catalog are rewritten to category language.
// ───────────────────────────────────────────────────────────────

Deno.test("a — no catalog → behaves identically to scrubString (tool names untouched)", () => {
  const input = "Use Midjourney v7 and GPT-5 to ship faster.";
  const { output, hits } = scrubStringAll(input);
  assertEquals(output, input);
  assertEquals(hits.size, 0);
});

Deno.test("b — versioned tool name not in catalog → category replacement", () => {
  const { output, hits } = scrubStringAll("Use Midjourney v7 to draft mockups.", {
    catalog: { tools: ["Figma", "Notion"] },
  });
  assertEquals(output.includes("Midjourney v7"), false);
  assertEquals(output.includes("image-generation tools"), true);
  assertEquals((hits.get("versioned_tool_name") ?? 0) >= 1, true);
});

Deno.test("c — Runway Gen-4 (Gen- variant) is matched and replaced", () => {
  const { output, hits } = scrubStringAll("Render with Runway Gen-4 next.", {
    catalog: { tools: [] },
  });
  assertEquals(output.includes("Runway Gen-4"), false);
  assertEquals(output.includes("video-generation tools"), true);
  assertEquals((hits.get("versioned_tool_name") ?? 0) >= 1, true);
});

Deno.test("d — frontier LLM versioned (GPT-5, Claude 4 Opus, Gemini 3 Pro) all rewritten", () => {
  const { output, hits } = scrubStringAll(
    "GPT-5 beats Claude 4 Opus, but Gemini 3 Pro wins on price.",
    { catalog: { tools: [] } },
  );
  assertEquals(output.includes("GPT-5"), false);
  assertEquals(output.includes("Claude 4 Opus"), false);
  assertEquals(output.includes("Gemini 3 Pro"), false);
  assertEquals(output.includes("frontier LLMs"), true);
  assertEquals((hits.get("frontier_llm_versioned") ?? 0) >= 3, true);
});

Deno.test("e — name in catalog (case-insensitive) → passthrough, no hit", () => {
  const input = "Try GPT-5 for this workflow.";
  const { output, hits } = scrubStringAll(input, {
    catalog: { tools: ["gpt-5", "Figma"] },
  });
  assertEquals(output, input);
  assertEquals(hits.size, 0);
});

Deno.test("f — known standalone names (Devin, Sora, Cursor) rewritten when not in catalog", () => {
  const { output, hits } = scrubStringAll("Devin and Cursor pair well; Sora handles video.", {
    catalog: { tools: [] },
  });
  assertEquals(output.includes("Devin"), false);
  assertEquals(output.includes("Cursor"), false);
  assertEquals(output.includes("Sora"), false);
  assertEquals((hits.get("known_tool_name") ?? 0) >= 3, true);
});

Deno.test("g — phrase rules still fire alongside tool rules", () => {
  const { output, hits } = scrubStringAll(
    "By 2027 your employer will deploy GPT-5.",
    { catalog: { tools: [] } },
  );
  assertEquals(output.includes("by 2027 your employer will"), false);
  assertEquals(output.includes("GPT-5"), false);
  assertEquals((hits.get("deterministic_employer_doom") ?? 0) >= 1, true);
  assertEquals((hits.get("frontier_llm_versioned") ?? 0) >= 1, true);
});

Deno.test("h — no false positive on plain capability words (Pro, AI, Studio)", () => {
  const input = "Upgrade to the Pro tier; this AI Studio is friendly.";
  const { output, hits } = scrubStringAll(input, {
    catalog: { tools: [] },
  });
  assertEquals(output, input);
  assertEquals(hits.size, 0);
});

Deno.test("i — scrubAll walks nested report and rewrites tool names everywhere", () => {
  const report = {
    summary: "Use Midjourney v7 to ideate.",
    nested: {
      tools: ["GPT-5 is your friend.", "Figma stays."],
      tip: "Don't sleep on Devin.",
    },
    safe: "Stay curious.",
  };
  const result = scrubAll(report, { catalog: { tools: ["Figma"] } });
  assertEquals(result.scrubbed >= 3, true, `expected ≥3, got ${result.scrubbed}`);
  assertEquals((report.summary as string).includes("Midjourney v7"), false);
  assertEquals((report.nested.tools[0] as string).includes("GPT-5"), false);
  assertEquals(report.nested.tools[1], "Figma stays.");
  assertEquals((report.nested.tip as string).includes("Devin"), false);
  assertEquals(report.safe, "Stay curious.");
});

Deno.test("j — scrubAll without catalog ≡ scrubReport (only phrase rules apply)", () => {
  const report = {
    a: "by 2027 your employer will replace you.",
    b: "Use GPT-5 and Midjourney v7.",
  };
  const result = scrubAll(report);
  // Phrase rule fired:
  assertEquals((report.a as string).includes("by 2027 your employer will"), false);
  // Tool names untouched (no catalog):
  assertEquals((report.b as string).includes("GPT-5"), true);
  assertEquals((report.b as string).includes("Midjourney v7"), true);
  assertEquals(result.scrubbed >= 1, true);
});
