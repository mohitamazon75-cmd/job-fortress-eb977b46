import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scrubString, scrubReport } from "../_shared/forbidden-phrase-scrubber.ts";

Deno.test("scrubString — rewrites 'by 2027 your employer will'", () => {
  const input = "Soon, by 2027 your employer will replace your team with AI agents.";
  const { output, hits } = scrubString(input);
  assertEquals(output.includes("will"), false, "absolute 'will' should be softened");
  assertEquals(output.includes("your employer may"), true);
  assertEquals(hits.get("deterministic_employer_doom"), 1);
});

Deno.test("scrubString — rewrites 'you will be fired'", () => {
  const { output, hits } = scrubString("Within 18 months you will be fired.");
  assertEquals(output.includes("you will be fired"), false);
  assertEquals(output.includes("your role faces pressure"), true);
  assertEquals(hits.get("deterministic_job_loss"), 1);
});

Deno.test("scrubString — rewrites 'AI will replace you'", () => {
  const { output } = scrubString("Make no mistake: AI will replace you.");
  assertEquals(output.includes("AI will replace you"), false);
  assertEquals(output.includes("AI may automate parts of your role"), true);
});

Deno.test("scrubString — rewrites 'guaranteed job loss'", () => {
  const { output } = scrubString("This is guaranteed job loss territory.");
  assertEquals(output.includes("guaranteed job loss"), false);
  assertEquals(output.includes("elevated risk"), true);
});

Deno.test("scrubString — leaves clean copy untouched", () => {
  const input = "Your role faces structural pressure from AI; consider upskilling in adjacent tools.";
  const { output, hits } = scrubString(input);
  assertEquals(output, input);
  assertEquals(hits.size, 0);
});

Deno.test("scrubReport — walks nested objects and arrays", () => {
  const report = {
    free_advice_1: "by 2027 your employer will downsize.",
    nested: {
      verdict: "AI will replace you outright.",
      tips: ["upskill now", "you will be fired soon"],
    },
    safe_field: "Stay alert and grow your moat.",
  };
  const result = scrubReport(report);
  assertEquals(result.scrubbed >= 3, true, `expected ≥3 scrubs, got ${result.scrubbed}`);
  assertEquals((report.free_advice_1 as string).includes("by 2027 your employer will"), false);
  assertEquals((report.nested.verdict as string).includes("AI will replace you"), false);
  assertEquals((report.nested.tips[1] as string).includes("you will be fired"), false);
  assertEquals(report.safe_field, "Stay alert and grow your moat.");
});
