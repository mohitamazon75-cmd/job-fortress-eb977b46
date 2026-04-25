// ═══════════════════════════════════════════════════════════════
// Scan Report Builder — assembly, normalization, and quality passes
// ═══════════════════════════════════════════════════════════════

import {
  estimateMonthlySalary,
  calculateGeoArbitrage,
  deriveToneTag,
  type ProfileInput,
  type DeterministicResult,
  type JobTaxonomyRow,
} from "./deterministic-engine.ts";
import {
  normalizeMarketPositionModel,
  normalizeCareerShockSimulator,
  TOOL_GITHUB_MAP,
} from "./scan-helpers.ts";
import { getLocale } from "./locale-config.ts";
import { callAgent } from "./ai-agent-caller.ts";
import { checkAutomationSignalConsistency } from "./zod-schemas.ts";
import { scrubAll } from "./forbidden-phrase-scrubber.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Helpers ──────────────────────────────────────────────────

export function getTier2CityInfo(
  industry: string,
  country?: string | null,
): { city: string; multiplier: number } {
  const locale = getLocale(country);
  return locale.tier2CityMap[industry] || { city: locale.tier2Cities[0] || "Secondary City", multiplier: 0.75 };
}

export async function updateScan(
  supabase: SupabaseClient,
  scanId: string,
  report: Record<string, unknown>,
  name: string | null,
  company: string | null,
): Promise<void> {
  if (!report || typeof report !== "object") {
    await supabase
      .from("scans")
      .update({ scan_status: "failed" })
      .eq("id", scanId);
    return;
  }

  report.linkedin_name = name;
  report.linkedin_company = company;
  await supabase
    .from("scans")
    .update({
      scan_status: "complete",
      final_json_report: report,
      role_detected: report.role,
      determinism_index: report.determinism_index,
      salary_bleed_monthly: report.salary_bleed_monthly,
      months_remaining: report.months_remaining,
      industry: report.industry,
    })
    .eq("id", scanId);
}

/** Builds a minimal deterministic-only report (no AI agents used) */
export function buildDeterministicReport(
  det: DeterministicResult,
  profile: ProfileInput,
  industry: string,
  roleHint: string,
  scan: Record<string, unknown>,
  linkedinName: string | null,
  linkedinCompany: string | null,
): Record<string, unknown> {
  const monthlySalary = estimateMonthlySalary(
    profile.estimated_monthly_salary_inr, null, profile.experience_years, undefined, undefined, undefined, scan?.country,
  );
  const geoArb = calculateGeoArbitrage(monthlySalary, profile.geo_advantage);
  return {
    role: roleHint, determinism_index: det.determinism_index, determinism_confidence: det.determinism_confidence,
    months_remaining: det.months_remaining, salary_bleed_monthly: det.salary_bleed_monthly,
    total_5yr_loss_inr: det.total_5yr_loss_inr, execution_skills_dead: det.execution_skills_dead,
    cognitive_moat: "Strategic Thinking", moat_skills: ["Leadership", "Stakeholder Management"],
    industry, ai_tools_replacing: det.replacing_tools,
    arbitrage_role: `${roleHint} → Strategy Lead`, arbitrage_companies_count: 10,
    free_advice_1: "Start automating your execution tasks with AI tools this week.",
    free_advice_2: "Build a portfolio of AI-augmented work within 60 days.",
    free_advice_3: "Target 3 companies hiring for AI-augmented versions of your role within 90 days.",
    geo_advantage: "Remote roles pay 2.5-3.5x for your cognitive skills.",
    geo_arbitrage: geoArb, tier2_alternative: null,
    obsolescence_timeline: det.obsolescence_timeline, survivability: det.survivability,
    skill_gap_map: [], weekly_action_plan: [],
    immediate_next_step: {
      action: "Run a full JobBachao scan with your LinkedIn profile for personalized results",
      rationale: "Deterministic-only analysis has limited accuracy without profile data",
      time_required: "2 minutes",
      deliverable: "Personalized career threat assessment with AI-powered strategy",
    },
    cultural_risk_assessment: null, tone_tag: det.tone_tag,
    dead_end_narrative: "Your execution tasks are being automated — pivot to strategic work before the window closes.",
    data_quality: det.data_quality, score_breakdown: det.score_breakdown, score_variability: det.score_variability,
    source: "deterministic_only", linkedin_name: linkedinName, linkedin_company: linkedinCompany,
    engine_version: "3.2-deterministic",
    computation_method: { numbers: "deterministic_algorithm", qualitative: "fallback_generic", kg_skills_matched: det.matched_skill_count },
  };
}

// ── Founder normalization ────────────────────────────────────

function isFounderLikeRole(role?: string | null): boolean {
  if (!role) return false;
  return /(\bco[\s-]?founder\b|\bfounder\b|\bowner\b|\bmanaging\s+partner\b)/i.test(role);
}

export function normalizeFounderImmediateStep(report: Record<string, unknown>): void {
  if (!report || typeof report !== "object") return report;
  if (!isFounderLikeRole(report.role)) return report;

  const step = report.immediate_next_step;
  if (!step || typeof step !== "object") return report;

  const action = String(step.action || "");
  const rationale = String(step.rationale || "");
  const founderMismatch =
    /(1[-\s]?on[-\s]?1|meeting|schedule).*(ceo|founder|leadership)/i.test(action) ||
    /(align\s+on\s+strategic\s+priorities\s+for\s+ai\s+integration)/i.test(action) ||
    /(align\s+with\s+leadership)/i.test(rationale);

  if (!founderMismatch) return report;

  const company = report.linkedin_company || "your company";
  report.immediate_next_step = {
    ...step,
    action: `Draft and approve ${company}'s 30-day AI Transformation Blueprint, then align execution owners with your co-founder/team.`,
    rationale: "As a founder/co-founder, you're the decision-maker. Your highest-leverage move is setting AI strategy and execution priorities directly.",
    time_required: step.time_required || "2 hours (strategy) + 1 hour (team alignment)",
    deliverable: "A one-page AI Transformation Blueprint with 3 priorities, owners, and 30-day KPIs.",
  };
  return report;
}

// ── Tool validation ──────────────────────────────────────────

export function validateToolStatic(judoStrategy: Record<string, unknown>): void {
  if (!judoStrategy?.recommended_tool) return;
  const toolLower = judoStrategy.recommended_tool.toLowerCase().trim();
  let repoSlug = TOOL_GITHUB_MAP[toolLower] || null;
  if (!repoSlug) {
    for (const [key, slug] of Object.entries(TOOL_GITHUB_MAP)) {
      if (toolLower.includes(key) || key.includes(toolLower)) { repoSlug = slug; break; }
    }
  }
  if (repoSlug && repoSlug.length > 0) {
    judoStrategy.github_validation = { verified: true, repo: repoSlug, source: "static_registry" };
  } else if (repoSlug === "") {
    judoStrategy.github_validation = { verified: false, reason: "proprietary_tool" };
  } else {
    judoStrategy.github_validation = { verified: false, reason: "not_in_registry" };
  }
}

// ── Deduplication pass ───────────────────────────────────────

export function deduplicateReportText(finalReport: Record<string, unknown>): void {
  try {
    const textFields = ["free_advice_1", "free_advice_2", "free_advice_3", "dead_end_narrative", "cognitive_moat", "geo_advantage"];
    const allSentences: Map<string, string> = new Map();
    for (const field of textFields) {
      const text = finalReport[field];
      if (typeof text !== "string" || !text) continue;
      const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
      const deduped: string[] = [];
      for (const sentence of sentences) {
        const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
        if (allSentences.has(normalized) && allSentences.get(normalized) !== field) {
          console.log(`[Dedup] Removed duplicate sentence from ${field} (first seen in ${allSentences.get(normalized)})`);
          continue;
        }
        allSentences.set(normalized, field);
        deduped.push(sentence);
      }
      if (deduped.length < sentences.length) {
        finalReport[field] = deduped.join(". ") + ".";
      }
    }
  } catch {
    console.warn("[Orchestrator] Deduplication pass skipped (non-fatal)");
  }
}

// ── Quality Editor pass ──────────────────────────────────────

const FAST_MODEL = "google/gemini-3-flash-preview"; // Quality Editor: fast + cheap, editorial not reasoning

export async function runQualityEditor(
  finalReport: Record<string, unknown>,
  detectedRole: string,
  displayName: string,
  displayCompany: string,
  resolvedIndustry: string,
  apiKey: string,
): Promise<void> {
  try {
    const qualityCheckFields = {
      free_advice_1: finalReport.free_advice_1, free_advice_2: finalReport.free_advice_2,
      free_advice_3: finalReport.free_advice_3, dead_end_narrative: finalReport.dead_end_narrative,
      cognitive_moat: finalReport.cognitive_moat, geo_advantage: finalReport.geo_advantage,
      immediate_next_step: finalReport.immediate_next_step, pivot_rationale: finalReport.pivot_rationale,
      moat_narrative: finalReport.moat_narrative, urgency_horizon: finalReport.urgency_horizon,
    };
    const editorResult = await callAgent(apiKey, "QualityEditor",
      `You are a senior editorial quality reviewer. Review these career analysis fields for a ${detectedRole} named "${displayName}" at "${displayCompany}" in ${resolvedIndustry}.\n\nCRITICAL RULES:\n1. Remove ANY sentence that appears (even paraphrased) in more than one field — check for near-duplicates where 60%+ words overlap\n2. Remove generic platitudes and filler phrases including but not limited to: "If you left tomorrow, they'd feel it", "The clock is ticking", "You're not just a cog", "Your experience speaks volumes", "The writing is on the wall", "Stay ahead of the curve"\n3. Fix contradictions between fields (e.g. one field saying role is safe while another says it's threatened)\n4. Fix grammar errors\n5. Ensure each field adds UNIQUE value — no overlapping content between free_advice_1/2/3, dead_end_narrative, and cognitive_moat\n6. Replace vague advice ("upskill", "stay relevant") with specific actions tied to the person's actual role and industry\n7. TOOL NAME CURRENCY: Replace ANY deprecated tool names with current 2025-2026 versions. "Google Bard" → "Google Gemini". "DALL-E 2" → "DALL-E 3". "ChatGPT-3/GPT-3" → "ChatGPT/GPT-4o". "Bing Chat" → "Microsoft Copilot". "Jasper AI"/"Copy.ai" → "ChatGPT or Claude". "Stable Diffusion 1.x/2.x" → "Stable Diffusion 3 or FLUX". If uncertain about a tool name, use the generic category.\n\nReturn ONLY JSON with corrected fields. Omit fields that are fine. Return {} if all good.`,
      `Review:\n\n${JSON.stringify(qualityCheckFields, null, 2)}`, FAST_MODEL, 0.1, 15_000);
    if (editorResult && typeof editorResult === "object") {
      let corrections = 0;
      for (const [key, value] of Object.entries(editorResult)) {
        if (value && typeof value === "string" && key in finalReport) { finalReport[key] = value; corrections++; }
      }
      if (corrections > 0) console.log(`[Orchestrator] Quality Editor applied ${corrections} correction(s)`);
    }
  } catch {
    console.warn("[Orchestrator] Quality Editor skipped (non-fatal)");
  }

  // ── Last-mile safety net: deterministic regex scrub ────────
  // Catches forbidden doom phrases (always) AND non-catalog tool
  // names (when a catalog is supplied) the LLM may have leaked.
  try {
    const result = scrubAll(finalReport, { catalog: toolCatalog });
    if (result.scrubbed > 0) {
      console.log(`[Orchestrator] Scrubber rewrote ${result.scrubbed} string(s):`, result.hits);
    }
  } catch (e) {
    console.warn("[Orchestrator] Scrubber failed (non-fatal):", e);
  }
}

// ── Final report assembly ────────────────────────────────────

export interface ReportAssemblyInput {
  det: DeterministicResult;
  mlObsolescence: Record<string, unknown> | null;
  mlTimedOut: boolean;
  agent1: Record<string, unknown> | null;
  validatedAgent2: Record<string, unknown> | null;
  profileInput: ProfileInput;
  primaryJob: JobTaxonomyRow | null;
  scan: Record<string, unknown>;
  linkedinName: string | null;
  linkedinCompany: string | null;
  detectedRole: string;
  resolvedIndustry: string;
  compoundRole: boolean;
  roleComponents: string[];
  companyTier: string | null;
  seniorityTier: string;
  displayName: string;
  displayCompany: string;
  scanCountry: string;
  companyHealth?: { score: number; signals: string[]; risk_factors: string[]; growth_factors: string[]; summary: string; search_grounded: boolean } | null;
  skillDemandResults?: { skill_name: string; adjustment: number; demand_signal: string; evidence: string }[];
  subSector?: string | null;
  rawProfileText?: string;
  extractionConfidence?: string;
}

export function assembleReport(input: ReportAssemblyInput): Record<string, unknown> {
  const {
    det, mlObsolescence, mlTimedOut, agent1, validatedAgent2, profileInput,
    primaryJob, scan, linkedinName, linkedinCompany, detectedRole, resolvedIndustry,
    compoundRole, roleComponents, companyTier, displayName, displayCompany, scanCountry,
    companyHealth, skillDemandResults, subSector,
  } = input;

  const monthlySalary = estimateMonthlySalary(profileInput.estimated_monthly_salary_inr, primaryJob, profileInput.experience_years, companyTier, scan.metro_tier || null);
  const geoArb = calculateGeoArbitrage(monthlySalary, profileInput.geo_advantage);
  const tier2Info = getTier2CityInfo(agent1?.industry || resolvedIndustry, scanCountry);

  // ── AUDIT (#3, #12): Seniority-gated tier-2 alternative ──
  // Senior leaders / execs do not have viable Tier-2 markets in India for their domain
  // (e.g. Senior Marketing Director → Jaipur is a fiction). Restrict tier-2 routing to
  // PROFESSIONAL/MANAGER/ENTRY tiers OR when the user explicitly self-reported willingness.
  const seniorityForGeo = (agent1?.seniority_tier as string) || (input.seniorityTier as string) || 'PROFESSIONAL';
  const isSeniorOrExec = seniorityForGeo === 'EXECUTIVE' || seniorityForGeo === 'SENIOR_LEADER';
  const userOptedInToRelocate = !!profileInput.geo_advantage && /relocat|tier[-\s]?2|within india/i.test(profileInput.geo_advantage);
  let geoGatingDecision: 'allowed' | 'blocked_senior_role' | 'blocked_no_geo' | 'allowed_self_reported' = 'allowed';
  let tier2: { recommended_city: string; salary_estimate_inr: number; probability: number } | null = null;

  if (scan.metro_tier === 'tier2') {
    geoGatingDecision = 'blocked_no_geo';
    tier2 = null;
  } else if (isSeniorOrExec && !userOptedInToRelocate) {
    geoGatingDecision = 'blocked_senior_role';
    tier2 = null;
    console.warn(`[GeoGate] Tier-2 alt suppressed: tier=${seniorityForGeo} for role="${detectedRole}" — no viable Tier-2 market for senior leadership.`);
  } else if (geoArb) {
    geoGatingDecision = userOptedInToRelocate ? 'allowed_self_reported' : 'allowed';
    tier2 = { recommended_city: tier2Info.city, salary_estimate_inr: Math.round(monthlySalary * tier2Info.multiplier), probability: 0.70 };
  }
  // attach gating decision to score_breakdown for debugging
  if (det.score_breakdown) {
    (det.score_breakdown as any).geo_gating_decision = geoGatingDecision;
  }

  // CONSISTENCY FIX: All core numerical metrics come from the deterministic engine.
  // ML/LLM outputs only provide qualitative insights (judo_strategy, weekly_diet, etc.)
  //
  // AUDIT FIX A: Signal consistency gate with teeth.
  // Previously checkAutomationSignalConsistency() logged a warning and did nothing —
  // a user could receive DI=22 ("safe") while Agent1 said HIGH automation risk, silently.
  //
  // The fix: when Agent1's categorical signal contradicts the DI AND DI confidence is
  // LOW or MEDIUM (meaning KG had sparse skill matches), nudge DI 30% toward the
  // Agent1-implied range midpoint. Conservative — deterministic engine still dominates.
  // Only fires when both: (a) contradiction detected, (b) DI confidence is not HIGH/VERY HIGH.
  let mergedDI = det.determinism_index;
  if (agent1?.automatable_task_ratio) {
    const consistencyResult = checkAutomationSignalConsistency(
      agent1.automatable_task_ratio,
      mergedDI,
      null,
    );
    const diConfidence = det.determinism_confidence as string;
    if (!consistencyResult.consistent && diConfidence !== "VERY HIGH" && diConfidence !== "HIGH") {
      const AGENT1_MIDPOINTS: Record<string, number> = {
        HIGH: 72,   // midpoint of 55–100 expected range
        MEDIUM: 47, // midpoint of 25–70 expected range
        LOW: 20,    // midpoint of 0–40 expected range
      };
      const targetMidpoint = AGENT1_MIDPOINTS[agent1.automatable_task_ratio];
      if (targetMidpoint !== undefined) {
        const adjustedDI = Math.round(mergedDI * 0.7 + targetMidpoint * 0.3);
        console.warn(
          `[ConsistencyGate] Contradiction resolved: DI ${mergedDI}→${adjustedDI} ` +
          `(Agent1=${agent1.automatable_task_ratio}, KG confidence=${diConfidence}). ` +
          `${consistencyResult.warning}`,
        );
        mergedDI = Math.max(5, Math.min(95, adjustedDI));
      }
    }
  }
  const mergedMonthsRemaining = det.months_remaining;
  const mergedToneTag = deriveToneTag(mergedDI as number);
  const analysisSource = mlObsolescence ? "ml_enhanced" : "deterministic_only";

  const normalizedMarketPosition = normalizeMarketPositionModel(mlObsolescence?.market_position_model, det, agent1?.industry || resolvedIndustry);
  const normalizedCareerShock = normalizeCareerShockSimulator(mlObsolescence?.career_shock_simulator, det, detectedRole, agent1?.industry || resolvedIndustry, validatedAgent2, profileInput, scan.metro_tier || null);

  return {
    determinism_index: mergedDI, determinism_confidence: det.determinism_confidence,
    months_remaining: mergedMonthsRemaining,
    // CONSISTENCY: All numerical metrics from deterministic engine only
    salary_bleed_monthly: det.salary_bleed_monthly,
    total_5yr_loss_inr: det.total_5yr_loss_inr,
    obsolescence_timeline: det.obsolescence_timeline, survivability: det.survivability,
    tone_tag: mergedToneTag, ai_tools_replacing: det.replacing_tools,
    execution_skills_dead: det.execution_skills_dead, data_quality: det.data_quality,
    score_breakdown: det.score_breakdown, score_variability: det.score_variability,
    ml_enhanced: !!mlObsolescence, ml_timed_out: mlTimedOut,
    automation_risk: mlObsolescence?.automation_risk ?? mlObsolescence?.core_metrics?.automation_risk ?? null,
    judo_strategy: mlObsolescence?.judo_strategy ?? null,
    weekly_survival_diet: mlObsolescence?.weekly_survival_diet ?? null,
    market_position_model: normalizedMarketPosition,
    career_shock_simulator: normalizedCareerShock,
    seniority_tier: agent1?.seniority_tier || null,
    executive_impact: profileInput.executive_impact || null,
    ...(compoundRole ? { compound_role: true, role_components: roleComponents } : {}),
    ...(companyTier ? { company_tier: companyTier } : {}),
    role: detectedRole, industry: agent1?.industry || resolvedIndustry, industry_sub_sector: subSector || null,
    all_skills: profileInput.all_skills || [], execution_skills: profileInput.execution_skills || [], strategic_skills: profileInput.strategic_skills || [],
    cognitive_moat: validatedAgent2?.cognitive_moat || "Strategic Thinking",
    moat_skills: validatedAgent2?.moat_skills || profileInput.strategic_skills || ["Leadership", "Judgment"],
    arbitrage_role: validatedAgent2?.pivot_title || `${detectedRole} → Strategy Lead`,
    arbitrage_companies_count: validatedAgent2?.arbitrage_companies_count || 10,
    free_advice_1: validatedAgent2?.free_advice_1 || `${displayName}, start automating your ${(profileInput.execution_skills?.[0] || "execution tasks").toLowerCase()} with AI tools this week at ${displayCompany}.`,
    free_advice_2: validatedAgent2?.free_advice_2 || `${displayName}, build a portfolio showcasing AI-augmented ${detectedRole} work within 60 days.`,
    free_advice_3: validatedAgent2?.free_advice_3 || `${displayName}, target 3 companies hiring for AI-augmented ${detectedRole} roles within 90 days.`,
    geo_advantage: `${displayName}, remote roles in ${geoArb?.target_market || "global markets"} pay ${geoArb ? Math.round(geoArb.raw_delta_inr_monthly / monthlySalary * 100 + 100) + "%" : "2-3x"} more for your ${(profileInput.strategic_skills?.[0] || "cognitive").toLowerCase()} skills.`,
    dead_end_narrative: validatedAgent2?.dead_end_narrative || `${displayName}, staying as a ${detectedRole} at ${displayCompany} without AI skills risks a significant pay cut by 2027.`,
    weekly_action_plan: validatedAgent2?.weekly_action_plan || [],
    immediate_next_step: validatedAgent2?.immediate_next_step || null,
    skill_gap_map: validatedAgent2?.skill_gap_map || [],
    cultural_risk_assessment: validatedAgent2?.cultural_risk_assessment || null,
    skill_threat_intel: validatedAgent2?.skill_threat_intel || null,
    pivot_rationale: validatedAgent2?.pivot_rationale || null,
    // Previously generated by Agent 2A but silently dropped — now persisted to DB
    moat_narrative: validatedAgent2?.moat_narrative || null,
    urgency_horizon: validatedAgent2?.urgency_horizon || null,
    threat_timeline: validatedAgent2?.threat_timeline || null,
    skill_trajectory: validatedAgent2?.skill_trajectory || null,
    geo_arbitrage: geoArb, tier2_alternative: tier2,
    moat_score: det.moat_score, urgency_score: det.urgency_score,
    automatable_task_ratio: agent1?.automatable_task_ratio || null,
    primary_ai_threat_vector: agent1?.primary_ai_threat_vector || null,
    moat_indicators: agent1?.moat_indicators || [],
    metro_tier: scan.metro_tier || null,
    source: scan.linkedin_url ? (linkedinName ? `linkedin_${analysisSource}` : `linkedin_url_inferred_${analysisSource}`) : `industry_${analysisSource}`,
    linkedin_name: linkedinName, linkedin_company: linkedinCompany,
    engine_version: mlObsolescence ? "5.0-tier-intelligence" : "5.0-deterministic",
    _engine_version: 5,
    company_health: companyHealth ? { score: companyHealth.score, signals: companyHealth.signals, risk_factors: companyHealth.risk_factors, growth_factors: companyHealth.growth_factors, summary: companyHealth.summary, search_grounded: companyHealth.search_grounded } : null,
    skill_demand_validation: skillDemandResults && skillDemandResults.length > 0 ? skillDemandResults : null,
    raw_profile_text: input.rawProfileText ? input.rawProfileText.slice(0, 5000) : null,
    extraction_confidence: input.extractionConfidence || "medium",
    computation_method: { numbers: mlObsolescence ? "ml_enhanced_with_deterministic_fallback" : "deterministic_algorithm", qualitative: "llm_3_prompt_split", kg_skills_matched: det.matched_skill_count, ml_used: !!mlObsolescence, company_health_used: !!companyHealth?.search_grounded, skill_demand_validated: (skillDemandResults?.length ?? 0) > 0 },
  };
}
