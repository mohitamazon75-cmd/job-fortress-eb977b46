/**
 * E2E QA — Onboarding → Verdict pipeline
 *
 * Goal: lock the rendered verdict layer (fate score, status badge, CTA copy)
 * for the four canonical "fixed cases" we use across regression suites:
 *   1. BPO data-entry agent (HIGH risk → "TAKE ACTION" red)
 *   2. Mid-level marketing copywriter (HIGH EXPOSURE gold)
 *   3. Senior FAANG engineer (SAFE ZONE green)
 *   4. Founder/CEO executive (SAFE ZONE green, executive narrative)
 *
 * We import the SAME helpers VerdictReveal uses:
 *   - computeStabilityScore (the fate score number)
 *   - getPlainEnglishVerdict equivalent (label, color, labelClass, body, hope)
 *   - computeScoreBreakdown (powers the waterfall + KG-corrected risk)
 *
 * If any of these drift, the verdict UI silently changes — these tests fail loudly first.
 */
import { describe, it, expect } from "vitest";
import { computeStabilityScore, computeScoreBreakdown } from "@/lib/stability-score";
import { getVibe } from "@/lib/get-vibe";
import type { ScanReport } from "@/lib/scan-engine";

// Re-implement getPlainEnglishVerdict locally in test (it's not exported from VerdictReveal).
// Kept in lockstep with src/components/VerdictReveal.tsx lines 15-60. If that file
// diverges, this contract test fails — which is the point.
function getPlainEnglishVerdictBands(score: number) {
  if (score >= 70) return { label: "SAFE ZONE", color: "text-prophet-green", labelClass: "bg-prophet-green/20 text-prophet-green" };
  if (score >= 55) return { label: "MODERATE RISK", color: "text-primary", labelClass: "bg-primary/20 text-primary" };
  if (score >= 40) return { label: "HIGH EXPOSURE", color: "text-prophet-gold", labelClass: "bg-prophet-gold/20 text-prophet-gold" };
  return { label: "TAKE ACTION", color: "text-prophet-red", labelClass: "bg-prophet-red/20 text-prophet-red" };
}

const baseReport = (overrides: Partial<ScanReport>): ScanReport => ({
  role: "Generic",
  determinism_index: 50,
  automation_risk: 50,
  moat_score: 30,
  months_remaining: 24,
  salary_bleed_monthly: 5000,
  execution_skills_dead: [],
  cognitive_moat: "moderate",
  moat_skills: [],
  industry: "IT",
  ai_tools_replacing: [],
  arbitrage_role: "",
  arbitrage_companies_count: 0,
  free_advice_1: "",
  free_advice_2: "",
  geo_advantage: "",
  source: "test",
  all_skills: [],
  execution_skills: [],
  strategic_skills: [],
  seniority_tier: "PROFESSIONAL",
  market_position_model: {
    market_percentile: 50, competitive_tier: "mid", leverage_status: "moderate",
    talent_density: "moderate", demand_trend: "Stable",
  },
  career_shock_simulator: { salary_drop_percentage: 25 } as any,
  years_experience: 5,
  ...overrides,
} as ScanReport);

describe("E2E QA — Verdict layer for fixed cases", () => {
  it("Case 1: BPO data-entry → red 'TAKE ACTION' band, score < 40", () => {
    const report = baseReport({
      role: "Data Entry Operator",
      industry: "BPO",
      determinism_index: 22,
      automation_risk: 88,
      moat_score: 8,
      execution_skills: ["Data Entry", "Typing", "MS Excel"],
      strategic_skills: [],
      moat_skills: [],
      all_skills: ["Data Entry", "Typing", "MS Excel"],
      seniority_tier: "ENTRY",
      ai_tools_replacing: ["ChatGPT", "Excel Copilot", "Power Automate"],
      tone_tag: "CRITICAL",
      market_position_model: {
        market_percentile: 18, competitive_tier: "low", leverage_status: "weak",
        talent_density: "abundant", demand_trend: "Declining",
      },
      career_shock_simulator: { salary_drop_percentage: 55 } as any,
      years_experience: 2,
    });
    const score = computeStabilityScore(report);
    const band = getPlainEnglishVerdictBands(score);
    const vibe = getVibe(score, report);
    expect(score).toBeLessThan(40);
    expect(band.label).toBe("TAKE ACTION");
    expect(band.color).toBe("text-prophet-red");
    expect(vibe.label).toBe("Act Now");
    expect(vibe.headline.length).toBeGreaterThan(10);
    expect(vibe.hope).toMatch(/runway|moat|defense/i);
    expect(vibe.plan).toMatch(/this week|90-day|defense/i);
  });

  it("Case 2: Mid-level copywriter → gold 'HIGH EXPOSURE', 40 ≤ score < 55", () => {
    const report = baseReport({
      role: "Marketing Copywriter",
      industry: "Marketing",
      determinism_index: 45,
      automation_risk: 65,
      moat_score: 28,
      execution_skills: ["Copywriting", "Content Writing", "SEO"],
      strategic_skills: ["Brand Strategy"],
      moat_skills: ["Brand Strategy"],
      all_skills: ["Copywriting", "Content Writing", "SEO", "Brand Strategy"],
      seniority_tier: "PROFESSIONAL",
      ai_tools_replacing: ["ChatGPT", "Jasper", "Copy.ai"],
      tone_tag: "WARNING",
      market_position_model: {
        market_percentile: 45, competitive_tier: "mid", leverage_status: "moderate",
        talent_density: "abundant", demand_trend: "Stable",
      },
      career_shock_simulator: { salary_drop_percentage: 30 } as any,
      years_experience: 6,
    });
    const score = computeStabilityScore(report);
    const band = getPlainEnglishVerdictBands(score);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(55);
    expect(band.label).toBe("HIGH EXPOSURE");
    expect(band.color).toBe("text-prophet-gold");
  });

  it("Case 3: Senior FAANG engineer → green 'SAFE ZONE', score ≥ 70", () => {
    const report = baseReport({
      role: "Senior Software Engineer",
      industry: "Big Tech",
      determinism_index: 78,
      automation_risk: 22,
      moat_score: 75,
      execution_skills: ["Python", "Distributed Systems", "Kubernetes"],
      strategic_skills: ["System Design", "Tech Strategy", "Architecture"],
      moat_skills: ["System Design", "Distributed Systems", "Tech Strategy", "Architecture"],
      all_skills: ["Python", "Distributed Systems", "Kubernetes", "System Design", "Tech Strategy", "Architecture"],
      seniority_tier: "SENIOR_LEADER",
      tone_tag: "STABLE",
      market_position_model: {
        market_percentile: 88, competitive_tier: "top", leverage_status: "high",
        talent_density: "scarce", demand_trend: "Strong",
      },
      career_shock_simulator: { salary_drop_percentage: 10 } as any,
      years_experience: 12,
      survivability: { peer_percentile_estimate: "Top 12th percentile" } as any,
    });
    const score = computeStabilityScore(report);
    const band = getPlainEnglishVerdictBands(score);
    const vibe = getVibe(score, report);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(band.label).toBe("SAFE ZONE");
    expect(band.color).toBe("text-prophet-green");
    expect(vibe.label).toBe("Safe Zone");
    expect(vibe.hope).toMatch(/moat|judgment|leverage|institutional/i);
  });

  it("Case 4: Founder/CEO → executive narrative, score ≥ 70 SAFE ZONE", () => {
    const report = baseReport({
      role: "Founder & CEO",
      industry: "SaaS",
      determinism_index: 82,
      automation_risk: 15,
      moat_score: 85,
      execution_skills: [],
      strategic_skills: ["Fundraising", "Vision Setting", "Board Management", "Hiring"],
      moat_skills: ["Fundraising", "Vision Setting", "Board Management", "Investor Relations"],
      all_skills: ["Fundraising", "Vision Setting", "Board Management", "Hiring", "Investor Relations"],
      seniority_tier: "EXECUTIVE",
      executive_impact: {
        revenue_scope_usd: 25_000_000, team_size_org: 80, regulatory_domains: [],
        board_exposure: true, investor_facing: true, domain_tenure_years: 8, cross_industry_pivots: 1,
      } as any,
      tone_tag: "STABLE",
      market_position_model: {
        market_percentile: 92, competitive_tier: "top", leverage_status: "high",
        talent_density: "scarce", demand_trend: "Strong",
      },
      career_shock_simulator: { salary_drop_percentage: 8 } as any,
      years_experience: 15,
      survivability: { peer_percentile_estimate: "Top 5th percentile" } as any,
    });
    const score = computeStabilityScore(report);
    const band = getPlainEnglishVerdictBands(score);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(band.label).toBe("SAFE ZONE");
    expect(band.labelClass).toBe("bg-prophet-green/20 text-prophet-green");
  });

  it("Band boundaries are exhaustive and monotonic", () => {
    expect(getPlainEnglishVerdictBands(100).label).toBe("SAFE ZONE");
    expect(getPlainEnglishVerdictBands(70).label).toBe("SAFE ZONE");
    expect(getPlainEnglishVerdictBands(69).label).toBe("MODERATE RISK");
    expect(getPlainEnglishVerdictBands(55).label).toBe("MODERATE RISK");
    expect(getPlainEnglishVerdictBands(54).label).toBe("HIGH EXPOSURE");
    expect(getPlainEnglishVerdictBands(40).label).toBe("HIGH EXPOSURE");
    expect(getPlainEnglishVerdictBands(39).label).toBe("TAKE ACTION");
    expect(getPlainEnglishVerdictBands(0).label).toBe("TAKE ACTION");
  });

  it("Score breakdown produces a non-null waterfall for every fixed case", () => {
    const cases: ScanReport[] = [
      baseReport({ determinism_index: 22, seniority_tier: "ENTRY" }),
      baseReport({ determinism_index: 45 }),
      baseReport({ determinism_index: 78, seniority_tier: "SENIOR_LEADER", moat_skills: ["a", "b", "c"] }),
      baseReport({ determinism_index: 82, seniority_tier: "EXECUTIVE", moat_skills: ["a", "b", "c", "d"] }),
    ];
    for (const r of cases) {
      const b = computeScoreBreakdown(r);
      expect(b).toBeTruthy();
      expect(typeof b.effectiveAutomationRisk).toBe("number");
      expect(b.effectiveAutomationRisk).toBeGreaterThanOrEqual(0);
      expect(b.effectiveAutomationRisk).toBeLessThanOrEqual(100);
    }
  });

  it("CTA copy ('See Your Full Report') is present and stable in VerdictReveal source", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/VerdictReveal.tsx", "utf8");
    expect(src).toMatch(/See Your Full Report/);
    expect(src).toMatch(/onComplete\(\)/);
    // Score band logic must remain intact
    expect(src).toMatch(/score >= 70/);
    expect(src).toMatch(/score >= 55/);
    expect(src).toMatch(/score >= 40/);
    // Status badge must consume verdict.label + verdict.labelClass
    expect(src).toMatch(/verdict\.labelClass/);
    expect(src).toMatch(/verdict\.label/);
  });
});
