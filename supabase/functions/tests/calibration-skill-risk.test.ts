/**
 * CALIBRATION ASSERTIONS — Skill-Risk Scoring Fallback
 *
 * Purpose: lock in the deterministic, category-based fallback used when the
 * Knowledge Graph has zero matches for a profile's skills. Historically this
 * path used `(skillName.length % 10)` to fabricate variance — a pseudo-random
 * signal that violated the engine's deterministic contract and produced
 * different risk for "SQL" (3) vs "PYTHON" (6) for no defensible reason.
 *
 * These assertions guarantee:
 *   C1. No string-length-derived variance: same-category skills get IDENTICAL risk
 *   C2. Risk is anchored to the structural floor + category, not the skill name
 *   C3. Execution > Strategic risk (strategic skills get a moat discount)
 *   C4. Strategic risk is capped at 35 (moat protection)
 *   C5. Execution risk never exceeds 95 (clamp)
 *   C6. Determinism: identical inputs → identical outputs across runs
 *   C7. Permutation invariance: skill order does not change risk
 *   C8. Source code MUST NOT contain `.length % ` pseudo-variance patterns
 */
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAll } from "../_shared/det-orchestrator.ts";
import type { ProfileInput, JobTaxonomyRow } from "../_shared/det-types.ts";

const job: JobTaxonomyRow = {
  job_family: "generic_role",
  category: "general",
  disruption_baseline: 60,
  avg_salary_lpa: 10,
  automatable_tasks: [],
  ai_tools_replacing: [],
};

const baseProfile = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
  experience_years: 5,
  // Deliberately varied lengths — under the OLD bug these would produce
  // different risks via (length % 10). They MUST NOT now.
  execution_skills: ["A", "BB", "CCC", "DDDDDDDDDD", "EEEEEEEEEEEEEEEEEEEE"],
  strategic_skills: ["X", "YYYYYYYY", "ZZZZZZZZZZZZZZZZZZZZ"],
  all_skills: ["A", "BB", "CCC", "DDDDDDDDDD", "EEEEEEEEEEEEEEEEEEEE", "X", "YYYYYYYY", "ZZZZZZZZZZZZZZZZZZZZ"],
  geo_advantage: null,
  adaptability_signals: 1,
  estimated_monthly_salary_inr: 50_000,
  seniority_tier: "PROFESSIONAL",
  ...overrides,
});

function adjustmentsFor(skills: string[], result: ReturnType<typeof computeAll>) {
  const set = new Set(skills);
  return (result.score_breakdown.skill_adjustments || []).filter(a => set.has(a.skill_name));
}

Deno.test("C1+C2: unmatched execution skills get IDENTICAL risk regardless of name length", () => {
  const profile = baseProfile();
  const result = computeAll(profile, [], [], job, null, false);
  const exec = adjustmentsFor(profile.execution_skills, result);
  assertEquals(exec.length, profile.execution_skills.length);
  const risks = new Set(exec.map(a => a.automation_risk));
  assertEquals(risks.size, 1, `execution skills must share one risk; got [${[...risks].join(",")}]`);
});

Deno.test("C1+C2: unmatched strategic skills get IDENTICAL risk regardless of name length", () => {
  const profile = baseProfile();
  const result = computeAll(profile, [], [], job, null, false);
  const strat = adjustmentsFor(profile.strategic_skills, result);
  assertEquals(strat.length, profile.strategic_skills.length);
  const risks = new Set(strat.map(a => a.automation_risk));
  assertEquals(risks.size, 1, `strategic skills must share one risk; got [${[...risks].join(",")}]`);
});

Deno.test("C3: execution risk > strategic risk (moat discount applied)", () => {
  const profile = baseProfile();
  const result = computeAll(profile, [], [], job, null, false);
  const execRisk = adjustmentsFor(profile.execution_skills, result)[0].automation_risk;
  const stratRisk = adjustmentsFor(profile.strategic_skills, result)[0].automation_risk;
  assert(execRisk > stratRisk, `expected exec(${execRisk}) > strat(${stratRisk})`);
});

Deno.test("C4: strategic-skill risk is capped at 35 (moat ceiling)", () => {
  const hotJob: JobTaxonomyRow = { ...job, disruption_baseline: 90 };
  const result = computeAll(baseProfile(), [], [], hotJob, null, false);
  const strat = adjustmentsFor(baseProfile().strategic_skills, result);
  for (const a of strat) {
    assert(a.automation_risk <= 35, `strategic risk ${a.automation_risk} breached cap 35`);
    assert(a.automation_risk >= 5, `strategic risk ${a.automation_risk} below floor 5`);
  }
});

Deno.test("C5: execution-skill risk never exceeds 95 (clamp)", () => {
  const hotJob: JobTaxonomyRow = { ...job, disruption_baseline: 99 };
  const result = computeAll(baseProfile(), [], [], hotJob, null, false);
  const exec = adjustmentsFor(baseProfile().execution_skills, result);
  for (const a of exec) {
    assert(a.automation_risk <= 95, `exec risk ${a.automation_risk} breached clamp 95`);
  }
});

Deno.test("C6: determinism — identical inputs produce identical risk over 5 runs", () => {
  const profile = baseProfile();
  const first = computeAll(profile, [], [], job, null, false);
  for (let i = 0; i < 4; i++) {
    const next = computeAll(profile, [], [], job, null, false);
    assertEquals(
      next.score_breakdown.skill_adjustments,
      first.score_breakdown.skill_adjustments,
      `run ${i + 2} diverged from run 1`,
    );
  }
});

Deno.test("C7: permutation invariance — shuffled skill order yields identical risk per skill", () => {
  const original = baseProfile();
  const shuffled = baseProfile({
    execution_skills: [...original.execution_skills].reverse(),
    strategic_skills: [...original.strategic_skills].reverse(),
    all_skills: [...original.all_skills].reverse(),
  });
  const a = computeAll(original, [], [], job, null, false);
  const b = computeAll(shuffled, [], [], job, null, false);
  const byName = (r: ReturnType<typeof computeAll>) =>
    new Map((r.score_breakdown.skill_adjustments || []).map(x => [x.skill_name, x.automation_risk]));
  const ma = byName(a);
  const mb = byName(b);
  for (const [name, risk] of ma) {
    assertEquals(mb.get(name), risk, `risk for "${name}" changed under permutation`);
  }
});

Deno.test("C8 (source guard): det-scoring.ts must not contain `.length % ` pseudo-variance", async () => {
  const src = await Deno.readTextFile(new URL("../_shared/det-scoring.ts", import.meta.url));
  // Strip line + block comments so the audit comment that names the old bug doesn't trip us.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(l => l.replace(/\/\/.*$/, ""))
    .join("\n");
  assertEquals(
    /\.length\s*%\s*\d+/.test(stripped),
    false,
    "Forbidden pattern `.length % N` reintroduced — pseudo-deterministic noise must not return.",
  );
});

Deno.test("C8 (source guard): det-scoring.ts must not use Math.random in fallback path", async () => {
  const src = await Deno.readTextFile(new URL("../_shared/det-scoring.ts", import.meta.url));
  assertEquals(/Math\.random\s*\(/.test(src), false, "Math.random() found in scoring engine — must remain deterministic.");
});

Deno.test("C2 anchoring: fallback risk tracks the structural floor (not the skill string)", () => {
  // Two jobs with very different baselines should produce two different exec risks,
  // but within each job all exec skills still share the SAME risk.
  const lowJob: JobTaxonomyRow = { ...job, disruption_baseline: 30 };
  const highJob: JobTaxonomyRow = { ...job, disruption_baseline: 80 };
  const lo = computeAll(baseProfile(), [], [], lowJob, null, false);
  const hi = computeAll(baseProfile(), [], [], highJob, null, false);
  const loExec = adjustmentsFor(baseProfile().execution_skills, lo).map(a => a.automation_risk);
  const hiExec = adjustmentsFor(baseProfile().execution_skills, hi).map(a => a.automation_risk);
  assertEquals(new Set(loExec).size, 1);
  assertEquals(new Set(hiExec).size, 1);
  assertNotEquals(loExec[0], hiExec[0], "structural floor should drive risk; got identical risks across baselines");
  assert(hiExec[0] > loExec[0], `higher baseline must yield higher exec risk (lo=${loExec[0]}, hi=${hiExec[0]})`);
});
