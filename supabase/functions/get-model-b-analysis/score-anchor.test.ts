// ═══════════════════════════════════════════════════════════════
// Regression test — Trust Killer #1: same-user score variance.
//
// Audit finding (2026-04-24): the same user scanning twice within
// 17 hours received risk_scores of 50 vs 79 — a 29-point swing
// for an effectively identical profile. The fix: clamp the LLM's
// risk_score to ±5 of the deterministic baseline (determinism_index).
//
// This test simulates 5 repeat "runs" of the LLM for the same user
// (same determinism_index anchor, varying raw LLM outputs) and
// asserts that EVERY anchored output stays within ±5 of the anchor.
//
// Run with:
//   deno test --allow-net --allow-env supabase/functions/get-model-b-analysis/score-anchor.test.ts
// ═══════════════════════════════════════════════════════════════

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyTrustGuardrails } from "./index.ts";

// ---------- helpers ----------

function makeCardData(rawRisk: number) {
  return {
    risk_score: rawRisk,
    card1_risk: { risk_score: rawRisk, fear_hook: "x" },
    card2_market: {},
    card4_pivot: { pivots: [] },
    card5_jobs: { job_matches: [] },
  } as Record<string, unknown>;
}

function runRepeatScans(anchor: number, llmOutputs: number[]) {
  return llmOutputs.map((raw) => {
    const card = makeCardData(raw);
    applyTrustGuardrails(card, anchor, "Bangalore");
    return {
      raw,
      anchored: card.risk_score as number,
      card1: (card.card1_risk as Record<string, number>).risk_score,
    };
  });
}

// ---------- tests ----------

Deno.test("repeat scans (n=5) all stay within ±5 of determinism_index", () => {
  const anchor = 65; // user's deterministic baseline
  // Simulates 5 LLM invocations producing wildly different raw scores
  // — exactly the regression the audit caught (50 vs 79 for same user).
  const llmRuns = [50, 58, 65, 72, 79];

  const results = runRepeatScans(anchor, llmRuns);

  for (const r of results) {
    assert(
      r.anchored >= anchor - 5 && r.anchored <= anchor + 5,
      `risk_score ${r.anchored} (raw ${r.raw}) escaped anchor ${anchor}±5`,
    );
    assertEquals(
      r.card1,
      r.anchored,
      "card1_risk.risk_score must mirror top-level risk_score",
    );
  }

  // Max spread across 5 repeat scans must be ≤ 10 (i.e. 2× the ±5 band).
  const anchored = results.map((r) => r.anchored);
  const spread = Math.max(...anchored) - Math.min(...anchored);
  assert(spread <= 10, `repeat-scan spread ${spread} exceeds 10-point cap`);
});

Deno.test("LLM swing of 29 points (audit case) is contained", () => {
  // The actual production incident: anchor ~65, two scans got 50 and 79.
  const anchor = 65;
  const before = runRepeatScans(anchor, [50, 79]);
  const spread = Math.abs(
    (before[0].anchored as number) - (before[1].anchored as number),
  );
  assert(
    spread <= 10,
    `audit-case spread ${spread} should be ≤ 10 after anchoring`,
  );
});

Deno.test("anchor is skipped when determinism_index is null", () => {
  // Backward compat: if no det score available, LLM output passes through.
  const card = makeCardData(42);
  applyTrustGuardrails(card, null, "Bangalore");
  assertEquals(card.risk_score, 42);
});

Deno.test("anchor clamps to [0,100] even if det score is near edges", () => {
  const card = makeCardData(120); // LLM returned out-of-range
  applyTrustGuardrails(card, 98, "Bangalore");
  const v = card.risk_score as number;
  assert(v >= 0 && v <= 100, `risk_score ${v} must stay in [0,100]`);
  assert(v >= 93 && v <= 100, `risk_score ${v} must stay in anchor band`);
});

Deno.test("non-finite LLM risk_score is left untouched", () => {
  const card = makeCardData(NaN);
  applyTrustGuardrails(card, 60, "Bangalore");
  // Should not throw, should not coerce NaN into a number band.
  assert(Number.isNaN(card.risk_score as number));
});

// ═══════════════════════════════════════════════════════════════
// Regression tests — Trust Killer #2: jobbachao_score variance.
//
// Audit finding (2026-04-27): same resume scanned twice produced
// jobbachao_score of 53 vs 67 because the LLM ignored the formula
//   jobbachao_score = 100 − (risk_score × (1 − shield_score / 200))
// on roughly 1-in-3 scans. The fix: deterministically recompute
// jobbachao_score after the risk anchor so the page-top number
// is mathematically locked to (risk_score, shield_score).
//
// These tests must NEVER be deleted without a replacement that
// proves jobbachao_score is still deterministic for fixed inputs.
// ═══════════════════════════════════════════════════════════════

function makeCardWithShield(rawRisk: number, shield: number, llmJB: number) {
  return {
    risk_score: rawRisk,
    shield_score: shield,
    jobbachao_score: llmJB,
    card1_risk: { risk_score: rawRisk, fear_hook: "x" },
    card2_market: {},
    card4_pivot: { pivots: [] },
    card5_jobs: { job_matches: [] },
  } as Record<string, unknown>;
}

Deno.test("jobbachao_score: same (risk,shield) → identical output across LLM variance", () => {
  // Production case: risk=67, shield=58. LLM produced 53 one day, 67 the next.
  // After the fix, BOTH must collapse to the formula value (52).
  const expected = Math.round(100 - (67 * (1 - 58 / 200))); // = 52
  const llmHallucinations = [42, 53, 60, 67, 75, 88];

  const outputs = llmHallucinations.map((llmJB) => {
    const card = makeCardWithShield(67, 58, llmJB);
    applyTrustGuardrails(card, 67, "Bangalore");
    return card.jobbachao_score as number;
  });

  for (const out of outputs) {
    assertEquals(
      out,
      expected,
      `jobbachao_score must equal formula output ${expected}, got ${out}`,
    );
  }
});

Deno.test("jobbachao_score: matches Farheen-Dubai production scan (r=67, s≈94)", () => {
  // Live verification 2026-04-27: log shows
  //   "[model-b] jobbachao_score recomputed: LLM=82 formula(r=67,s=94)=64"
  // This test pins that exact production case forever.
  const card = makeCardWithShield(67, 94, 82);
  applyTrustGuardrails(card, 67, "Bangalore");
  assertEquals(card.jobbachao_score, 64);
});

Deno.test("jobbachao_score: tolerates ±2 LLM drift (no spurious recompute)", () => {
  // If LLM is within ±2 of the formula, we keep its value to avoid
  // log spam. This is intentional — verify the slack window holds.
  const formula = Math.round(100 - (50 * (1 - 60 / 200))); // = 65
  const card = makeCardWithShield(50, 60, formula + 1); // 1 off → keep
  applyTrustGuardrails(card, 50, "Bangalore");
  assertEquals(card.jobbachao_score, formula + 1);

  const card2 = makeCardWithShield(50, 60, formula + 5); // 5 off → recompute
  applyTrustGuardrails(card2, 50, "Bangalore");
  assertEquals(card2.jobbachao_score, formula);
});

Deno.test("jobbachao_score: clamps to [0,100] for adversarial inputs", () => {
  // Adversarial: risk=100, shield=0 → formula = 0
  const cardLow = makeCardWithShield(100, 0, 999);
  applyTrustGuardrails(cardLow, 100, "Bangalore");
  assertEquals(cardLow.jobbachao_score, 0);

  // Adversarial: risk=0, shield=100 → formula = 100
  const cardHigh = makeCardWithShield(0, 100, -50);
  applyTrustGuardrails(cardHigh, 0, "Bangalore");
  assertEquals(cardHigh.jobbachao_score, 100);
});

Deno.test("jobbachao_score: untouched when shield_score is missing", () => {
  // Backward compat: if shield never came back from LLM, don't fabricate one.
  const card = {
    risk_score: 60,
    jobbachao_score: 75,
    card1_risk: { risk_score: 60 },
    card2_market: {},
    card4_pivot: { pivots: [] },
    card5_jobs: { job_matches: [] },
  } as Record<string, unknown>;
  applyTrustGuardrails(card, 60, "Bangalore");
  assertEquals(card.jobbachao_score, 75);
});
