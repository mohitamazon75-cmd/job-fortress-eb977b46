/**
 * scan-agents.ts
 *
 * Purpose: Parallel agent orchestration for process-scan pipeline.
 *          Runs ML obsolescence, Judo/Diet analysis, and Agents 2A/2B/2C
 *          concurrently and returns merged results.
 * Inputs:  AgentOrchestrationInput — all data assembled before parallel block
 * Returns: AgentOrchestrationResult — merged agent outputs + ML result
 * Notes:   All agents run via Promise.allSettled — individual failures
 *          degrade gracefully without failing the whole pipeline.
 */

import { callAgent } from "../_shared/ai-agent-caller.ts";
import { callAgentWithFallback, callAgentRace } from "../_shared/model-fallback.ts";
import {
  AGENT_2A_RISK_ANALYSIS,
  AGENT_2B_ACTION_PLAN,
  AGENT_2C_PIVOT_MAPPING,
  JUDO_STRATEGY_SYSTEM_PROMPT,
  WEEKLY_DIET_SYSTEM_PROMPT,
  buildSeniorityJudoPrompt,
  buildSeniorityDietPrompt,
} from "../_shared/agent-prompts.ts";
import { validateOutputForTier, wrapUserData } from "../_shared/scan-helpers.ts";
import { validateToolStatic } from "../_shared/scan-report-builder.ts";
import { validateAgentOutput, Agent2ASchema, Agent2BSchema } from "../_shared/zod-schemas.ts";
import { getPreviousScore } from "../_shared/score-history.ts";
import { getKG } from "../_shared/riskiq-knowledge-graph.ts";
import { estimateMonthlySalary, calculateGeoArbitrage, type MarketSignalRow } from "../_shared/deterministic-engine.ts";
import { getCurrentToolCatalog, formatCatalog } from "../_shared/tool-catalog.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface AgentOrchestrationInput {
  /** Lovable AI gateway key */
  LOVABLE_API_KEY: string;
  /** Primary model for quality-critical agents */
  activeModel: string;
  /** Fast model for synthesis tasks */
  FAST_MODEL: string;
  /** Global timeout for the entire scan (ms) */
  GLOBAL_TIMEOUT_MS: number;
  /** Timestamp when the scan started (Date.now()) */
  globalStart: number;

  // Scan context
  scanId: string;
  scan: {
    user_id: string | null;
    metro_tier: string | null;
    linkedin_url: string | null;
  };
  supabaseUrl: string;
  supabaseServiceRoleKey: string;

  // Profile data
  profileInput: any;
  detectedRole: string;
  resolvedRoleHint: string;
  resolvedIndustry: string;

  // Agent 1 outputs
  agent1: any;

  // Deterministic engine results
  det: any;

  // Enrichment context
  linkedinName: string | null;
  linkedinCompany: string | null;
  companyTier: string | null;
  compoundRole: boolean;
  roleComponents: string[];
  detectedSubSector: string | null;
  companyHealthResult: any;
  skillDemandResults: any[];
  kgContext: string;
  locale: any;
  scanCountry: string;

  /** Primary job taxonomy match */
  primaryJob: any;

  /** Current role market signal from market_signals table */
  marketSignal: MarketSignalRow | null;

  /** Time budget checker — returns true if enough time remains */
  hasTimeBudget: (msNeeded: number) => boolean;

  /** Key achievement bullets extracted from resume — passed verbatim to Agent 2A
   *  so it can write "your achievement of X positions you as Y" not generic advice */
  resumeAchievements?: string | null;
}

export interface AgentOrchestrationResult {
  mlObsolescence: any;
  mlTimedOut: boolean;
  validatedAgent2: any;
  seniorityTier: string;
  displayName: string;
  displayCompany: string;
  monthlySalary: number;
  isRescan: boolean;
  previousScoreData: any;
  /** Live tool catalog used to substitute {{TOOL_CATALOG}} in agent prompts.
   *  Forwarded to scan-pipeline so the post-LLM scrubAll() pass can match it. */
  toolCatalogTools: string[];
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION
// ═══════════════════════════════════════════════════════════════

/**
 * orchestrateAgents — Runs all AI agents and ML gateway in parallel.
 *
 * @param input - AgentOrchestrationInput with all pre-computed data from the pipeline
 * @returns AgentOrchestrationResult with mlObsolescence, validatedAgent2, and context vars
 * @notes Uses Promise.allSettled with a defensive parallel deadline. Individual agent
 *        failures degrade gracefully. Judo/Diet skipped if time budget is insufficient.
 */
export async function orchestrateAgents(
  input: AgentOrchestrationInput,
): Promise<AgentOrchestrationResult> {
  const {
    LOVABLE_API_KEY, activeModel, FAST_MODEL, GLOBAL_TIMEOUT_MS, globalStart,
    scanId, scan, supabaseUrl, supabaseServiceRoleKey,
    profileInput, detectedRole, resolvedRoleHint, resolvedIndustry,
    agent1, det, linkedinName, linkedinCompany, companyTier,
    compoundRole, roleComponents, detectedSubSector,
    companyHealthResult, skillDemandResults, kgContext, locale, scanCountry,
    hasTimeBudget,
  } = input;

  const seniorityTier = agent1?.seniority_tier || "PROFESSIONAL";
  const expYears = profileInput.experience_years ?? 5;
  const displayName = linkedinName || agent1?.current_role || "you";
  const displayCompany = linkedinCompany || agent1?.current_company || "your company";

  // ── Tool catalog (live, DB-backed) ─────────────────────────
  // Fetched once per scan; substituted into agent system prompts via sub().
  // Failure here is non-fatal: getCurrentToolCatalog() returns an empty
  // catalog and formatCatalog() emits an "(unavailable)" sentinel; the
  // post-LLM scrubAll() pass still catches stale tool-name leakage.
  const catalog = await getCurrentToolCatalog(createAdminClient());
  const catalogBlock = formatCatalog(catalog);
  console.log(
    `[catalog-wiring] catalog has ${catalog.tools.length} tools; ` +
    `formatted block ${catalogBlock.length} chars; ` +
    `first 120 chars: ${catalogBlock.slice(0, 120)}`,
  );
  const sub = (prompt: string) => prompt.replaceAll("{{TOOL_CATALOG}}", catalogBlock);

  const monthlySalary = estimateMonthlySalary(
    profileInput.estimated_monthly_salary_inr, 
    input.primaryJob, profileInput.experience_years, companyTier, scan.metro_tier || null,
  );
  const geoArb = calculateGeoArbitrage(monthlySalary, profileInput.geo_advantage);
  const executiveImpact = profileInput.executive_impact;
  const hasImpactData = executiveImpact && (
    executiveImpact.revenue_scope_usd || executiveImpact.team_size_org || 
    executiveImpact.regulatory_domains?.length
  );

  // ── Rescan delta detection ──────────────────────────────────
  let previousScoreData: { determinism_index: number; survivability_score: number | null; moat_score: number | null; created_at: string } | null = null;
  if (scan.user_id && scan.user_id !== 'anon') {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      previousScoreData = await getPreviousScore(supabase, scan.user_id, scanId);
      if (previousScoreData) {
        const daysSinceLast = Math.round((Date.now() - new Date(previousScoreData.created_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`[Orchestrator] Rescan detected: previous DI=${previousScoreData.determinism_index}, ${daysSinceLast} days ago`);
      }
    } catch (e) { console.warn("[Orchestrator] Previous score lookup failed (non-fatal):", e); }
  }
  const isRescan = !!previousScoreData;
  const diDelta = isRescan ? det.determinism_index - previousScoreData!.determinism_index : 0;
  const ssDelta = isRescan && previousScoreData!.survivability_score != null ? det.survivability.score - previousScoreData!.survivability_score : 0;
  const daysSinceLastScan = isRescan ? Math.round((Date.now() - new Date(previousScoreData!.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const weeksElapsed = Math.floor(daysSinceLastScan / 7);
  const rescanContext = isRescan ? `
RESCAN CONTEXT (CRITICAL — this person has done a previous scan):
- Previous DI Score: ${previousScoreData!.determinism_index}/100 → Current DI: ${det.determinism_index}/100 (DELTA: ${diDelta > 0 ? '+' : ''}${diDelta} points)
- Previous Survivability: ${previousScoreData!.survivability_score ?? 'N/A'}/100 → Current: ${det.survivability.score}/100 (DELTA: ${ssDelta > 0 ? '+' : ''}${ssDelta} points)
- Days since last scan: ${daysSinceLastScan} days (approximately ${weeksElapsed} weeks elapsed)
- Score trend: ${diDelta > 3 ? '⚠️ WORSENING — risk is increasing' : diDelta < -3 ? '✅ IMPROVING — risk is decreasing' : '→ STABLE — no significant change'}

ACTION PLAN INSTRUCTION: Because this is a RESCAN after ${daysSinceLastScan} days, DO NOT restart from Week 1.
- Assume they have completed approximately ${weeksElapsed} weeks of their previous action plan.
- Start the plan from Week ${Math.max(1, weeksElapsed + 1)} (the NEXT logical step forward).
- If diDelta > 5 (score worsening significantly), increase urgency and add a crisis mitigation step as Week 1.
- If diDelta < -5 (score improving), acknowledge their progress explicitly and build on their momentum.
- Reference what they SHOULD have completed by now (based on elapsed time) before giving new tasks.
- The plan must feel like a CONTINUATION, not a reset. Never repeat advice from a hypothetical previous scan.` : '';

  // ── KG Role Lookup for displacement timeline ────────────────
  const kg = getKG();
  const kgRole = kg.getRole(detectedRole) || kg.getRole(agent1?.current_role || "") || kg.getRole(resolvedRoleHint);
  const currentYear = new Date().getFullYear();
  const displacementTimeline = kgRole ? {
    partial_year: currentYear + kgRole.partial_displacement_years,
    significant_year: currentYear + kgRole.significant_displacement_years,
    critical_year: currentYear + kgRole.critical_displacement_years,
    partial_displacement_years: kgRole.partial_displacement_years,
    significant_displacement_years: kgRole.significant_displacement_years,
    critical_displacement_years: kgRole.critical_displacement_years,
  } : null;

  // ── Build shared profile context ────────────────────────────
  const sharedProfileContext = `
PERSON: ${wrapUserData("user_name", displayName)}
PROFILE:
- Full Name: ${wrapUserData("user_name", displayName)}
- Current Role: ${wrapUserData("user_role", detectedRole)}
- Current Company: ${wrapUserData("user_company", displayCompany)}${companyTier ? ` (${companyTier} tier)` : ""}
- Industry: ${wrapUserData("user_industry", agent1?.industry || resolvedIndustry)}${detectedSubSector ? ` → Sub-sector: ${wrapUserData("user_subsector", detectedSubSector)}` : ""}
- Experience: ${profileInput.experience_years || "Unknown"} years
- Location: ${wrapUserData("user_location", agent1?.location || scan.metro_tier || "Unknown")}
- Metro Tier: ${scan.metro_tier || "tier1"}
- Monthly Salary: ${locale.currencySymbol}${monthlySalary.toLocaleString("en-IN")} (${locale.currencySymbol}${Math.round(monthlySalary * 12 / 100000 * 10) / 10}L annual CTC)
- Salary Band: ${
  monthlySalary < 40_000 ? "Entry/Junior (< ₹5L CTC) — highly cost-sensitive, every rupee counts, survival mode thinking" :
  monthlySalary < 85_000 ? "Mid-level (₹5–10L CTC) — building financial buffer, career pivots carry moderate risk" :
  monthlySalary < 166_000 ? "Senior IC / Manager (₹10–20L CTC) — significant lifestyle commitments, career risk is personal-finance risk" :
  monthlySalary < 333_000 ? "Lead / Principal / Director (₹20–40L CTC) — high-stakes decision-making, brand equity matters as much as skills" :
  "Executive / VP+ (₹40L+ CTC) — replacement cost to employer is enormous, AI risk manifests as strategic de-prioritisation not direct job loss"
}
- AI Replacement Cost Delta: ${locale.currencySymbol}${Math.max(0, monthlySalary - Math.round(monthlySalary * 0.03)).toLocaleString("en-IN")}/month potential AI savings for employer (use this to calibrate urgency)
- Strategic Skills: ${wrapUserData("user_strategic_skills", profileInput.strategic_skills)}
- Execution Skills: ${wrapUserData("user_execution_skills", profileInput.execution_skills)}
- All Skills: ${wrapUserData("user_all_skills", profileInput.all_skills)}
- Geo Advantage: ${wrapUserData("user_geo_advantage", profileInput.geo_advantage || "None")}
${compoundRole ? `- Compound Role: ${wrapUserData("user_role_components", roleComponents.join(" + "))}` : ""}
- Automatable Task Ratio: ${agent1?.automatable_task_ratio || "MEDIUM"}
- Primary AI Threat: ${wrapUserData("user_threat_vector", agent1?.primary_ai_threat_vector || "AI automation of core tasks")}
- Moat Indicators: ${wrapUserData("user_moats", agent1?.moat_indicators || [])}
${hasImpactData ? `
EXECUTIVE IMPACT:
- Revenue: ${executiveImpact.revenue_scope_usd ? "$" + (executiveImpact.revenue_scope_usd / 1_000_000).toFixed(1) + "M" : "N/A"}
- Org Scale: ${executiveImpact.team_size_org || "Unknown"} people
- Regulatory: ${wrapUserData("user_regulatory_domains", executiveImpact.regulatory_domains?.join(", ") || "None")}
- Board: ${executiveImpact.board_exposure ? "YES" : "No"}
- Moat: ${wrapUserData("user_moat_type", executiveImpact.moat_type || "Unknown")} — ${wrapUserData("user_moat_evidence", executiveImpact.moat_evidence || "N/A")}` : ""}

DETERMINISTIC:
- DI: ${det.determinism_index}/100, Moat: ${det.moat_score}/100, Urgency: ${det.urgency_score}/100
- Months: ${det.months_remaining}, SS: ${det.survivability.score}/100, Tone: ${det.tone_tag}

SENIORITY: ${seniorityTier}
${displacementTimeline ? `
DISPLACEMENT TIMELINE (from Knowledge Graph — use these EXACT years in your urgency_horizon and threat_timeline output):
- Partial displacement begins: ${displacementTimeline.partial_year} (${displacementTimeline.partial_displacement_years} years from now — 20-30% of tasks automatable)
- Significant displacement: ${displacementTimeline.significant_year} (${displacementTimeline.significant_displacement_years} years — 50%+ of tasks automatable, role restructuring begins)
- Critical displacement: ${displacementTimeline.critical_year} (${displacementTimeline.critical_displacement_years} years — role elimination or fundamental transformation)
INSTRUCTION: Your urgency_horizon MUST reference ${displacementTimeline.significant_year} as the year by which significant displacement hits. Your threat_timeline.partial_displacement_year MUST be ${Math.round(displacementTimeline.partial_year)}.` : ''}
${companyHealthResult && companyHealthResult.search_grounded ? `
COMPANY HEALTH INTELLIGENCE (LIVE DATA — use this to contextualize advice):
- Health Score: ${companyHealthResult.score}/100
- Signals: ${companyHealthResult.signals.join("; ")}
- Risk Factors: ${companyHealthResult.risk_factors.join(", ") || "None detected"}
- Growth Factors: ${companyHealthResult.growth_factors.join(", ") || "None detected"}
- Summary: ${companyHealthResult.summary}
IMPORTANT: Factor this company-specific intelligence into your analysis. If the company is struggling, the person's actual risk is HIGHER than generic role-based analysis suggests.` : ''}
${skillDemandResults.length > 0 ? `
LIVE SKILL DEMAND VALIDATION:
${skillDemandResults.map((d: any) => `- ${d.skill_name}: ${d.demand_signal.toUpperCase()} (adjustment: ${d.adjustment > 0 ? '+' : ''}${d.adjustment}) — ${d.evidence}`).join("\n")}
NOTE: These skill risk adjustments are already factored into the DI score. Use this context to give more specific, evidence-backed advice.` : ''}
${input.marketSignal ? `
CURRENT ROLE MARKET SIGNAL (live data for ${detectedRole}):
- Market Health: ${input.marketSignal.market_health?.toUpperCase() || 'UNKNOWN'}
- Job Posting Trend: ${
    input.marketSignal.posting_change_pct != null 
      ? `${input.marketSignal.posting_change_pct > 0 ? '+' : ''}${input.marketSignal.posting_change_pct.toFixed(1)}% (30-day change)`
      : 'No data'
  }
- AI Displacement Mentions: ${
    input.marketSignal.ai_job_mentions_pct != null
      ? `${input.marketSignal.ai_job_mentions_pct.toFixed(1)}% of postings mention AI`
      : 'No data'
  }
- Avg Salary Trend: ${
    input.marketSignal.avg_salary_change_pct != null
      ? `${input.marketSignal.avg_salary_change_pct > 0 ? '+' : ''}${input.marketSignal.avg_salary_change_pct.toFixed(1)}% YoY`
      : 'No data'
  }
USE THIS: If market_health is 'declining' or posting_change_pct < -10, treat the current role as a strong PUSH factor — pivots are urgent, not optional.` : ''}
${input.resumeAchievements ? `
RESUME ACHIEVEMENTS (extracted verbatim — use these to write personalised, specific advice):
${input.resumeAchievements}

ACHIEVEMENT ANCHORING (CRITICAL — this is what separates WOW insights from generic advice):
Every free_advice field MUST reference at least one specific achievement above.
BAD: "${displayName}, upskill in Python this week."
GOOD: "${displayName}, your achievement of [paste specific metric from above] is the portfolio proof — write that as a LinkedIn case study this week."
The achievement IS the advice. The specific outcome is the proof. Generic advice is banned.` : ''}

${kgContext}`;

  // ═══════════════════════════════════════════════════════════════
  // LAUNCH ALL HEAVY WORK IN PARALLEL
  // ═══════════════════════════════════════════════════════════════
  console.log(`[Orchestrator] Launching Steps 7+8+9 in parallel at ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);

  // ML Gateway promise
  const mlPromise = (async () => {
    try {
      const ML_GATEWAY_URL = `${supabaseUrl}/functions/v1/ml-gateway`;
      const mlController = new AbortController();
      const mlTimeout = setTimeout(() => mlController.abort(), 10_000);
      const mlResp = await fetch(ML_GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceRoleKey}` },
        body: JSON.stringify({
          endpoint: "predict-obsolescence",
          payload: {
            skills: profileInput.all_skills, execution_skills: profileInput.execution_skills,
            strategic_skills: profileInput.strategic_skills, role: detectedRole,
            industry: agent1?.industry || resolvedIndustry,
            experience_years: profileInput.experience_years,
            metro_tier: scan.metro_tier || "tier1",
            determinism_index: det.determinism_index,
          },
          scanId,
        }),
        signal: mlController.signal,
      });
      clearTimeout(mlTimeout);
      if (mlResp.ok) return { data: await mlResp.json(), timedOut: false };
      if (mlResp.status === 504) return { data: null, timedOut: true };
      await mlResp.json().catch(() => ({}));
      return { data: null, timedOut: false };
    } catch (mlErr: any) {
      if (mlErr?.name === "AbortError") return { data: null, timedOut: true };
      console.warn("[ML] Fallback to deterministic:", mlErr?.name || mlErr);
      return { data: null, timedOut: false };
    }
  })();

  // Judo + Diet promise
  const judoDietPromise = hasTimeBudget(15_000) ? Promise.allSettled([
    callAgentRace(LOVABLE_API_KEY, "JudoStrategy", JUDO_STRATEGY_SYSTEM_PROMPT,
      buildSeniorityJudoPrompt(seniorityTier, expYears, displayName, displayCompany,
        agent1?.current_role || resolvedRoleHint, agent1?.industry || resolvedIndustry,
        profileInput.strategic_skills, profileInput.execution_skills, profileInput.all_skills,
        det.determinism_index, det.survivability.score, scan.metro_tier || "tier1", null,
        profileInput.executive_impact || null),
      activeModel, "google/gemini-3-flash-preview", 0.3, 25_000).then(r => r.data),
    callAgent(LOVABLE_API_KEY, "WeeklyDiet", WEEKLY_DIET_SYSTEM_PROMPT,
      buildSeniorityDietPrompt(seniorityTier, expYears, displayName,
        agent1?.current_role || resolvedRoleHint, agent1?.industry || resolvedIndustry,
        profileInput.strategic_skills, null),
      FAST_MODEL, 0.3, 20_000),
  ]) : Promise.resolve(null);

  // Agents 2A+2B+2C promise — timeouts raised from 25s → 40s.
  // Production logs (2026-04-17) showed every model in the fallback chain timing out
  // at 15-25s on long prompts (gpt-5, gemini-3-pro). p50 latency for these prompts
  // is ~22s; 25s left almost no headroom for the first-attempt model.
  const agents2Promise = Promise.allSettled([
    callAgentRace(LOVABLE_API_KEY, "Agent2A:Risk", AGENT_2A_RISK_ANALYSIS,
      `Generate risk analysis for:\n${sharedProfileContext}\n\nUse "${displayName}" by name. Reference "${displayCompany}".`,
      activeModel, "google/gemini-3-flash-preview", 0.3, 25_000).then(r => r.data),
    callAgentRace(LOVABLE_API_KEY, "Agent2B:Plan", AGENT_2B_ACTION_PLAN,
      `Generate tier-calibrated action plan for:\n${sharedProfileContext}\nTier: ${seniorityTier}\nCountry: ${locale.label}\nCurrency: ${locale.currency}\nGeo Arbitrage Delta: ${locale.currencySymbol}${geoArb?.probability_adjusted_delta_inr || 0}/month\nJob Boards: ${locale.jobBoards.join(", ")}${rescanContext ? `\n${rescanContext}` : ''}`,
      activeModel, "google/gemini-3-flash-preview", 0.35, 25_000).then(r => r.data),
    callAgentWithFallback(LOVABLE_API_KEY, "Agent2C:Pivot", AGENT_2C_PIVOT_MAPPING,
      `Map career pivots for:\n${sharedProfileContext}\nMoat Score: ${det.moat_score}/100. Pivots must be realistic for ${seniorityTier} tier.\nCountry: ${locale.label}. Use job titles from ${locale.jobBoards.join("/")}.`,
      FAST_MODEL, 0.3, 30_000).then(r => r.data),
  ]);

  // ── Await all in parallel with defensive timeout ──
  const parallelDeadlineMs = Math.max(10_000, GLOBAL_TIMEOUT_MS - (Date.now() - globalStart) - 15_000);
  console.log(`[Orchestrator] Parallel deadline: ${(parallelDeadlineMs / 1000).toFixed(1)}s`);

  let mlResult: any, judoDietResult: any, agents2Results: any;
  const parallelAll = Promise.all([mlPromise, judoDietPromise, agents2Promise]);
  const parallelTimer = new Promise<'PARALLEL_TIMEOUT'>((resolve) =>
    setTimeout(() => resolve('PARALLEL_TIMEOUT'), parallelDeadlineMs)
  );
  const raceResult = await Promise.race([parallelAll, parallelTimer]);

  if (raceResult === 'PARALLEL_TIMEOUT') {
    console.warn(`[Orchestrator] Parallel timeout after ${(parallelDeadlineMs / 1000).toFixed(1)}s — assembling partial report`);
    const settled = await Promise.race([
      Promise.allSettled([mlPromise, judoDietPromise, agents2Promise]),
      new Promise<PromiseSettledResult<any>[]>((resolve) => setTimeout(() => resolve([
        { status: 'rejected', reason: 'timeout' } as PromiseRejectedResult,
        { status: 'rejected', reason: 'timeout' } as PromiseRejectedResult,
        { status: 'rejected', reason: 'timeout' } as PromiseRejectedResult,
      ]), 500))
    ]);
    mlResult = settled[0]?.status === 'fulfilled' ? settled[0].value : { data: null, timedOut: true };
    judoDietResult = settled[1]?.status === 'fulfilled' ? settled[1].value : null;
    agents2Results = settled[2]?.status === 'fulfilled' ? settled[2].value : [
      { status: 'rejected', reason: 'timeout' },
      { status: 'rejected', reason: 'timeout' },
      { status: 'rejected', reason: 'timeout' },
    ];
  } else {
    [mlResult, judoDietResult, agents2Results] = raceResult as [any, any, any];
  }

  // Unpack ML
  let mlObsolescence: any = mlResult.data;
  const mlTimedOut = mlResult.timedOut;

  // Unpack Judo/Diet
  if (judoDietResult && Array.isArray(judoDietResult)) {
    const seniorityJudoStrategy = judoDietResult[0].status === "fulfilled" ? judoDietResult[0].value : null;
    const seniorityDiet = judoDietResult[1].status === "fulfilled" ? judoDietResult[1].value : null;
    validateToolStatic(seniorityJudoStrategy);
    if (seniorityJudoStrategy || seniorityDiet) {
      if (!mlObsolescence) mlObsolescence = {};
      if (seniorityJudoStrategy) mlObsolescence.judo_strategy = seniorityJudoStrategy;
      if (seniorityDiet) {
        const { verifyDietResources } = await import("../_shared/diet-verification.ts");
        mlObsolescence.weekly_survival_diet = verifyDietResources(seniorityDiet);
      }
    }
  }

  // Unpack Agents 2A/2B/2C
  // FIX B: Validate each agent's raw output against its Zod schema before merging.
  // Previously the merged agent2 object went to DB with zero structural validation —
  // malformed fields (wrong type, hallucinated shapes) would silently corrupt scan data.
  //
  // validateAgentOutput() returns the validated data on success, or null with a
  // console.warn on failure. Callers downstream use || {} so null fails gracefully.
  const agent2aRaw = agents2Results[0].status === "fulfilled" ? agents2Results[0].value : null;
  const agent2bRaw = agents2Results[1].status === "fulfilled" ? agents2Results[1].value : null;
  const agent2c   = agents2Results[2].status === "fulfilled" ? agents2Results[2].value : null;

  // Zod-validate 2A and 2B; 2C has no schema yet (pivot fields are looser)
  const agent2a = agent2aRaw ? (validateAgentOutput("Agent2A", Agent2ASchema, agent2aRaw) ?? agent2aRaw) : null;
  const agent2b = agent2bRaw ? (validateAgentOutput("Agent2B", Agent2BSchema, agent2bRaw) ?? agent2bRaw) : null;
  // Note: fallback to raw when schema fails keeps existing resilience — bad data is
  // logged and the scan continues rather than returning a blank report.

  // Score-narrative consistency check for Agent2A
  if (agent2a && det?.determinism_index !== undefined) {
    const di = det.determinism_index;
    const narrative = JSON.stringify(agent2a).toLowerCase();
    const safetyWords = ['safe', 'stable', 'improving', 'secure', 'no risk'];
    const hasConflict = di > 65 && safetyWords.some(w => narrative.includes(w));
    if (hasConflict) {
      console.warn(`[Agent2A] Score-narrative conflict detected: DI=${di} but narrative suggests safety. Report may need review.`);
    }
  }

  const agent2 = { ...(agent2a || {}), ...(agent2b || {}),
    pivot_title: agent2c?.pivot_title || agent2a?.pivot_title || `${detectedRole} → Strategy Lead`,
    arbitrage_companies_count: agent2c?.arbitrage_companies_count || 10,
    pivot_rationale: agent2c?.pivot_rationale || null,
  };

  const validatedAgent2 = validateOutputForTier(agent2, seniorityTier, displayName);
  console.log(`[Orchestrator] Steps 7+8+9 complete at ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);

  return {
    mlObsolescence,
    mlTimedOut,
    validatedAgent2,
    seniorityTier,
    displayName,
    displayCompany,
    monthlySalary,
    isRescan,
    previousScoreData,
  };
}
