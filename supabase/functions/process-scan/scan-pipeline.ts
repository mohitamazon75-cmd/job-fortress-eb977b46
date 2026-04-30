/**
 * scan-pipeline.ts — Core scoring kernel (CQ-4-A)
 *
 * Extracted from process-scan/index.ts Steps 6–11:
 *   Step 6:  Sub-sector circuit-breaker + deterministic scoring (computeAll)
 *   Steps 7–9: Parallel agent orchestration (orchestrateAgents)
 *   Step 10: Report assembly (assembleReport)
 *   Step 11: Quality passes (deduplicateReportText, runQualityEditor, normalizeFounderImmediateStep)
 *
 * WHY EXTRACTED:
 *   This 120-line pipeline is the most important code in the product and was previously
 *   buried inside a 1,125-line Deno.serve handler with 12 nested try/catch blocks.
 *   Extraction enables:
 *     1. Independent unit testing (det-orchestrator.test.ts can now import runScanPipeline)
 *     2. Clear input/output contract (TypeScript-enforced via ScanPipelineInput/Result)
 *     3. Independent timing and performance measurement
 *     4. Isolated error handling — a pipeline failure doesn't corrupt the outer catch
 *
 * USAGE (in index.ts):
 *   const pipeline = await runScanPipeline(input);
 *   if (!pipeline.success) { ... handle error ... }
 *   const { finalReport, det, detectedSubSector } = pipeline;
 */

import { callAgent, FLASH_MODEL } from "../_shared/ai-agent-caller.ts";
import { buildAnalysisContext, inferFamilyFromRole, type AnalysisContext } from "../_shared/analysis-context.ts";
import {
  computeAll,
  type ProfileInput,
  type SkillRiskRow,
  type JobTaxonomyRow,
  type MarketSignalRow,
  type DeterministicResult,
} from "../_shared/deterministic-engine.ts";
import { orchestrateAgents } from "./scan-agents.ts";
import {
  assembleReport,
  deduplicateReportText,
  runQualityEditor,
  normalizeFounderImmediateStep,
} from "../_shared/scan-report-builder.ts";
import { deterministicSeedFromString } from "../_shared/scan-utils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { CompanyHealthResult } from "../_shared/company-health.ts";
import type { SkillDemandResult } from "../_shared/skill-demand-validator.ts";
import type { JobSkillMapRow, CohortBenchmark } from "../_shared/det-types.ts";

// ── Cohort percentile lookup (real peer benchmarking) ────────────────────────
// Replaces the sigmoid hallucination in det-lifecycle.ts when DB has data for the role.
async function fetchCohortBenchmark(
  supabaseUrl: string,
  serviceKey: string,
  role: string,
  metroTier: string | null,
): Promise<CohortBenchmark | null> {
  if (!role) return null;
  try {
    const supa = createClient(supabaseUrl, serviceKey);
    const roleKey = role.toLowerCase().replace(/[\s-]+/g, "_").split(/[_\s]/)[0];
    if (!roleKey) return null;
    // Try exact role + metro first, then role-only fallback
    let query = supa
      .from("cohort_percentiles")
      .select("role_detected, metro_tier, sample_size, p25, p50, p75, p90")
      .ilike("role_detected", `%${roleKey}%`)
      .gte("sample_size", 100)
      .order("sample_size", { ascending: false })
      .limit(5);
    const { data, error } = await query;
    if (error || !data?.length) return null;
    // Prefer metro match, else largest sample
    const metroMatch = metroTier ? data.find((r) => r.metro_tier === metroTier) : null;
    const chosen = metroMatch ?? data[0];
    if (chosen.p25 == null || chosen.p50 == null || chosen.p75 == null || chosen.p90 == null) return null;
    return {
      role_detected: chosen.role_detected,
      metro_tier: chosen.metro_tier,
      sample_size: chosen.sample_size ?? 0,
      p25: chosen.p25,
      p50: chosen.p50,
      p75: chosen.p75,
      p90: chosen.p90,
    };
  } catch (e) {
    console.warn("[Pipeline] cohort_percentiles lookup failed (non-fatal):", e);
    return null;
  }
}

// ── Input contract ────────────────────────────────────────────────────────────

export interface ScanPipelineInput {
  // Credentials
  LOVABLE_API_KEY: string;
  activeModel: string;
  FAST_MODEL: string;
  GLOBAL_TIMEOUT_MS: number;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Scan identity
  scanId: string;
  scan: Record<string, unknown>;

  // Profile data (from Steps 1–5)
  profileInput: ProfileInput;
  rawProfileText: string;
  profileExtractionConfidence: string;

  // Resolved role/industry
  detectedRole: string;
  resolvedRoleHint: string;
  resolvedIndustry: string;
  compoundRole: string;
  roleComponents: string[];
  companyTier: string;
  scanCountry: string;

  // People data
  linkedinName: string | null;
  linkedinCompany: string | null;
  displayName?: string;
  displayCompany?: string;

  // KG / scoring data (from Step 4)
  allSkillRiskRows: SkillRiskRow[];
  skillMapRows: JobSkillMapRow[];
  primaryJob: JobTaxonomyRow | null;
  marketSignal: MarketSignalRow | null;
  allIndustryJobs: Record<string, unknown>[];
  kgContext: string;

  // Enrichment results (from Step 5)
  agent1: Record<string, unknown> | null;
  companyHealthResult: CompanyHealthResult | null;
  skillDemandResults: SkillDemandResult[];
  locale: Record<string, unknown>;

  // Profile quality (from Step 5)
  profile_completeness_pct: number;
  profile_gaps: string[];

  // Timer / diagnostic context
  globalStart: number;
  globalTimedOut: boolean;
  scanDiagnostics: Record<string, unknown>;
  hasTimeBudget: (minRemainingMs: number) => boolean;
}

// ── Output contract ───────────────────────────────────────────────────────────

export interface ScanPipelineResult {
  success: true;
  finalReport: Record<string, unknown>;
  det: DeterministicResult;
  detectedSubSector: string | null;
  seniorityTier: string;
  displayName: string;
  displayCompany: string;
  /** Issue #12: per-agent observability captured during the parallel block. */
  agentMeta: Awaited<ReturnType<typeof orchestrateAgents>>["agentMeta"];
  /** Phase 1.B (audit 2026-04-30): deterministic shared context, persisted to scans.analysis_context. */
  analysisContext: AnalysisContext;
}

export interface ScanPipelineError {
  success: false;
  error: string;
  step: "det" | "agents" | "assembly" | "quality";
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function runScanPipeline(
  input: ScanPipelineInput,
): Promise<ScanPipelineResult | ScanPipelineError> {
  const {
    LOVABLE_API_KEY, activeModel, FAST_MODEL: FAST, GLOBAL_TIMEOUT_MS,
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    scanId, scan, profileInput, rawProfileText, profileExtractionConfidence,
    detectedRole, resolvedRoleHint, resolvedIndustry, compoundRole, roleComponents,
    companyTier, scanCountry, linkedinName, linkedinCompany,
    allSkillRiskRows, skillMapRows, primaryJob, marketSignal, allIndustryJobs,
    kgContext, agent1, companyHealthResult, skillDemandResults, locale,
    profile_completeness_pct, profile_gaps,
    globalStart, globalTimedOut: _gt, scanDiagnostics, hasTimeBudget,
  } = input;

  // ── Step 6: Sub-sector circuit-breaker ───────────────────────────────────
  let detectedSubSector = (agent1 as any)?.industry_sub_sector || null;
  if (!detectedSubSector && hasTimeBudget(8_000) && LOVABLE_API_KEY) {
    try {
      const subSectorPrompt = `Classify this job role into the most specific industry sub-sector.

Role: "${detectedRole}"
Company: "${linkedinCompany || "Unknown"}"
Industry: "${(agent1 as any)?.industry || resolvedIndustry}"

Return ONLY: {"industry_sub_sector": string}

Valid values: IT Services & Outsourcing, SaaS Product, Performance Marketing, Brand Strategy,
Investment Banking, Retail Banking, Clinical Practice, K-12 Teaching, Production & Assembly,
Content Marketing, UX/UI Design, Fintech, Healthtech, Data Science & ML, DevOps & Cloud.
Return null if unclear. No explanation, no markdown.`;

      const subResp = await callAgent(
        LOVABLE_API_KEY, "SubSectorBreaker",
        "You are a role classifier. Return only valid JSON.",
        subSectorPrompt, FLASH_MODEL, 0.0, 6_000,
        deterministicSeedFromString(`SubSectorBreaker:v1:${detectedRole}:${linkedinCompany || ""}:${(agent1 as any)?.industry || resolvedIndustry}`),
      );
      if ((subResp as any)?.industry_sub_sector) {
        detectedSubSector = (subResp as any).industry_sub_sector;
        console.log(`[Pipeline] Sub-sector resolved: "${detectedSubSector}"`);
      }
    } catch (e) {
      console.warn("[Pipeline] Sub-sector circuit-breaker failed (non-fatal):", e);
    }
  }

  // ── Step 6b: Deterministic scoring ───────────────────────────────────────
  // Look up real peer benchmark from cohort_percentiles before scoring,
  // so survivability percentile claims are grounded in DB data, not a sigmoid.
  const cohortBenchmark = await fetchCohortBenchmark(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    detectedRole || resolvedRoleHint || "",
    (scan as any).metro_tier || null,
  );
  if (cohortBenchmark) {
    console.log(`[Pipeline] Cohort benchmark loaded: ${cohortBenchmark.role_detected} (n=${cohortBenchmark.sample_size}, p50=${cohortBenchmark.p50})`);
  }

  let det: DeterministicResult;
  try {
    det = computeAll(
      profileInput, allSkillRiskRows, skillMapRows, primaryJob, marketSignal,
      !!(scan as any).linkedin_url, companyTier,
      (scan as any).metro_tier || null, null,
      (agent1 as any)?.industry || resolvedIndustry,
      scanCountry, companyHealthResult?.score ?? null,
      detectedSubSector, profile_completeness_pct, profile_gaps,
      cohortBenchmark,
    );
    console.log(`[Pipeline] DI=${det.determinism_index}, SS=${det.survivability.score}`);
  } catch (e) {
    return { success: false, error: String(e), step: "det" };
  }

  // ── Steps 7–9: Parallel agent orchestration ──────────────────────────────
  const achievementLines = rawProfileText
    .split("\n")
    .filter((l: string) => l.trim().startsWith("•") || l.trim().startsWith("-"))
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 20 && l.length < 300)
    .slice(0, 8);
  const resumeAchievements = achievementLines.length > 0 ? achievementLines.join("\n") : null;

  let agentResults: Awaited<ReturnType<typeof orchestrateAgents>>;
  try {
    agentResults = await orchestrateAgents({
      LOVABLE_API_KEY, activeModel, FAST_MODEL: FAST, GLOBAL_TIMEOUT_MS,
      globalStart, scanId,
      scan: {
        user_id: (scan as any).user_id,
        metro_tier: (scan as any).metro_tier,
        linkedin_url: (scan as any).linkedin_url,
      },
      supabaseUrl: SUPABASE_URL,
      supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      profileInput, detectedRole, resolvedRoleHint, resolvedIndustry,
      agent1, det, linkedinName, linkedinCompany, companyTier,
      compoundRole, roleComponents, detectedSubSector, companyHealthResult,
      skillDemandResults, kgContext, locale, scanCountry, primaryJob,
      marketSignal, hasTimeBudget, resumeAchievements,
    });
  } catch (e) {
    return { success: false, error: String(e), step: "agents" };
  }

  const { mlObsolescence, mlTimedOut, validatedAgent2, seniorityTier, displayName, displayCompany, toolCatalogTools, agentMeta } = agentResults;

  // Diagnostics
  const va2 = validatedAgent2 as any;
  scanDiagnostics.agent2a = va2?.agent2a ? (va2.agent2aValidated === false ? "fallback" : "success") : "skipped";
  scanDiagnostics.agent2b = va2?.agent2b ? (va2.agent2bValidated === false ? "fallback" : "success") : "skipped";
  scanDiagnostics.agent2c = va2?.pivot_roles ? "success" : "skipped";

  // ── Step 10: Report assembly ─────────────────────────────────────────────
  let finalReport: Record<string, unknown>;
  try {
    finalReport = assembleReport({
      det, mlObsolescence, mlTimedOut, agent1, validatedAgent2, profileInput,
      primaryJob, scan, linkedinName, linkedinCompany, detectedRole, resolvedIndustry,
      compoundRole, roleComponents, companyTier, seniorityTier,
      displayName, displayCompany, scanCountry,
      companyHealth: companyHealthResult,
      skillDemandResults,
      subSector: detectedSubSector,
      rawProfileText,
      extractionConfidence: profileExtractionConfidence,
    });
  } catch (e) {
    return { success: false, error: String(e), step: "assembly" };
  }

  // ── Step 11: Quality passes ──────────────────────────────────────────────
  try {
    deduplicateReportText(finalReport);
    if (hasTimeBudget(5_000)) {
      await runQualityEditor(
        finalReport, detectedRole, displayName, displayCompany,
        (agent1 as any)?.industry || resolvedIndustry, LOVABLE_API_KEY,
        toolCatalogTools,
      );
      scanDiagnostics.qualityEditor = "ran";
    } else {
      console.warn("[Pipeline] Skipping Quality Editor — low time budget");
      scanDiagnostics.qualityEditor = "skipped_timeout";
    }
    normalizeFounderImmediateStep(finalReport);
    delete finalReport.ml_raw;
  } catch (e) {
    // Quality passes are non-fatal — log but don't fail the pipeline
    console.warn("[Pipeline] Quality pass error (non-fatal):", e);
    scanDiagnostics.qualityEditor = "skipped";
  }

  // ── Step 12: Build deterministic AnalysisContext (Phase 1.B audit 2026-04-30) ──
  // Single source of truth read by every downstream card to prevent contradictions.
  // Pure computation — no IO, fail-open with safe defaults if any input is missing.
  let analysisContext: AnalysisContext;
  try {
    const totalSkillCount = Array.isArray(profileInput.all_skills) ? profileInput.all_skills.length : 0;
    const matchedSkillCount = typeof det.matched_skill_count === "number" ? det.matched_skill_count : 0;
    // Pass C5 (2026-04-30): role-string inference takes PRECEDENCE over primaryJob.job_family.
    // KG matching over-weights generic tokens like "manager" (e.g. "Senior Manager – Business
    // Development" → project_manager), polluting Card 4 pivot filtering. The deterministic
    // FAMILY_TOKENS dictionary is title-aware and beats noisy KG inference. Falls back to KG
    // only when the title yields no match (rare unusual titles).
    //
    // Pass C5.1 (2026-04-30): broaden the inference inputs. 4/4 most-recent prod scans had
    // detectedRole=null but industry="Sales & Business Development" — KG fell through to
    // project_manager/supply_chain_manager, polluting every downstream filter. We now feed
    // the user's self-declared industry into inferFamilyFromRole as a 2nd-pass signal before
    // surrendering to KG. The dictionary already contains "business development" and "sales"
    // tokens, so this is plumbing-only.
    const industryHint = ((agent1 as any)?.industry as string) || resolvedIndustry || "";
    const roleString = detectedRole || resolvedRoleHint || "";
    const roleFamily =
      inferFamilyFromRole(roleString) ||
      inferFamilyFromRole(industryHint) ||
      primaryJob?.job_family ||
      null;
    const userMonthlyCTC = (scan as any)?.estimated_monthly_salary_inr ?? null;
    const hasUserCTC = typeof userMonthlyCTC === "number" && userMonthlyCTC > 0;
    analysisContext = buildAnalysisContext({
      role_family: roleFamily,
      market_health: marketSignal?.market_health ?? null,
      matched_skill_count: matchedSkillCount,
      total_skill_count: totalSkillCount,
      existing_skills: profileInput.all_skills || [],
      seniority_tier: seniorityTier as string,
      metro_tier: ((scan as any)?.metro_tier as string) || null,
      has_user_ctc: hasUserCTC,
      // Fix B (Audit 2026-04-30): pass deterministic seniority-floor inputs.
      // The floor (years + title) can ONLY raise the LLM-supplied tier.
      experience_years_raw: (scan as any)?.years_experience ?? null,
      current_title: detectedRole || resolvedRoleHint || null,
      kg_version: "kg-v1",
      prompt_version: "p-v1",
      engine_version: "e-v1",
    });
    console.log(
      `[Pipeline] AnalysisContext: family=${analysisContext.user_role_family}, health=${analysisContext.user_role_market_health}, kg_match=${analysisContext.user_skill_kg_match_pct}%, exec=${analysisContext.user_is_exec}`,
    );
  } catch (e) {
    // Fail-open: never block a scan because context build threw.
    console.warn("[Pipeline] AnalysisContext build failed, using minimal fallback (non-fatal):", e);
    analysisContext = buildAnalysisContext({
      role_family: null,
      market_health: null,
      matched_skill_count: 0,
      total_skill_count: 0,
      existing_skills: [],
      seniority_tier: "MID",
      metro_tier: null,
      has_user_ctc: false,
      kg_version: "kg-v1",
      prompt_version: "p-v1",
      engine_version: "e-v1",
    });
  }

  return {
    success: true,
    finalReport,
    det,
    detectedSubSector,
    seniorityTier: seniorityTier as string,
    displayName: displayName as string,
    displayCompany: displayCompany as string,
    agentMeta,
    analysisContext,
  };
}
