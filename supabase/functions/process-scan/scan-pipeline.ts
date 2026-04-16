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
import type { CompanyHealthResult } from "../_shared/company-health.ts";
import type { SkillDemandResult } from "../_shared/skill-demand-validator.ts";
import type { JobSkillMapRow } from "../_shared/det-types.ts";

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
  let det: DeterministicResult;
  try {
    det = computeAll(
      profileInput, allSkillRiskRows, skillMapRows, primaryJob, marketSignal,
      !!(scan as any).linkedin_url, companyTier,
      (scan as any).metro_tier || null, null,
      (agent1 as any)?.industry || resolvedIndustry,
      scanCountry, companyHealthResult?.score ?? null,
      detectedSubSector, profile_completeness_pct, profile_gaps,
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

  const { mlObsolescence, mlTimedOut, validatedAgent2, seniorityTier, displayName, displayCompany } = agentResults;

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

  return {
    success: true,
    finalReport,
    det,
    detectedSubSector,
    seniorityTier: seniorityTier as string,
    displayName: displayName as string,
    displayCompany: displayCompany as string,
  };
}
