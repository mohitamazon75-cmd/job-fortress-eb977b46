/**
 * Golden Eval Runner — exercises the deterministic scoring engine against
 * the 50 fixtures in _shared/golden-eval-fixtures.ts and reports pass/fail.
 *
 * USAGE (admin / CI only):
 *   POST /functions/v1/golden-eval-run
 *   body: { ids?: string[] }   // omit to run all 50
 *   header: x-admin-secret: <GOLDEN_EVAL_ADMIN_SECRET>
 *
 * RESPONSE:
 *   { pass_rate, threshold, passed, total, failures: [...], by_family: {...} }
 *
 * The runner does NOT touch user data, scans table, or LLM APIs. It calls
 * computeAll() directly with synthesized profiles + live KG rows. This keeps
 * the eval cheap (~5s for 50 cases) and deterministic.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { computeAll } from "../_shared/det-orchestrator.ts";
import { matchSkillToKG } from "../_shared/det-utils.ts";
import {
  GOLDEN_FIXTURES,
  GOLDEN_EVAL_PASS_THRESHOLD,
  expectedToneForScore,
  type GoldenFixture,
} from "../_shared/golden-eval-fixtures.ts";
import type {
  ProfileInput,
  SkillRiskRow,
  JobSkillMapRow,
  JobTaxonomyRow,
  MarketSignalRow,
  ExecutiveImpactSignals,
  IcLeverageSignals,
} from "../_shared/det-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FixtureResult {
  id: string;
  family: string;
  pass: boolean;
  career_score: number;
  expected_score_window: [number, number];
  tone_actual: string;
  tone_expected: string;
  failure_reasons: string[];
}

/**
 * Heuristic skill extractor — pulls candidate skill tokens from resume text.
 * NOT meant to be smart; just give the engine enough KG match surface to
 * score realistically. Real users go through Agent 1 (LLM extraction).
 */
function extractSkillCandidates(resumeText: string): string[] {
  // Lower-case, split on common separators, dedupe, keep tokens 3-30 chars
  const raw = resumeText
    .toLowerCase()
    .replace(/[().,/+]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && t.length <= 30);
  // Multi-word combos (bigrams) too
  const tokens = resumeText.toLowerCase().split(/\s+/);
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`.replace(/[().,/+]/g, "").trim();
    if (bg.length >= 5 && bg.length <= 40) bigrams.push(bg);
  }
  return [...new Set([...raw, ...bigrams])];
}

/**
 * Infer company tier from resume text (used to pass companyTier into computeAll
 * so salary + scoring path matches what Agent 1 would extract from real resumes).
 */
function inferCompanyTier(text: string): string | null {
  const t = text.toLowerCase();
  if (/faang|google|meta|amazon|microsoft|apple|netflix/.test(t)) return "FAANG";
  if (/unicorn|series-?[c-f]|ipo'?d|public listed/.test(t)) return "Unicorn";
  if (/mnc|multinational|fortune 500|series-?b/.test(t)) return "MNC";
  if (/startup|series-?[a]|seed|bootstrap|founder|d2c brand|saas/.test(t)) return "Startup";
  if (/it[\s-]services|captive|offshore|consultancy|sme/.test(t)) return "SME";
  return null;
}

/**
 * Extract experience_years robustly. Handles: "11 years total", "8 years", "decade",
 * "3 as EM" (skipped — wants total), "7 years total / 3 as EM" → 7.
 */
function extractYears(text: string): number | null {
  // Prefer "X years total" or first "X years" mention
  const totalMatch = text.match(/(\d{1,2})\s*years?\s*total/i);
  if (totalMatch) return Math.min(40, parseInt(totalMatch[1], 10));
  const anyMatch = text.match(/(\d{1,2})\s*years?/i);
  if (anyMatch) return Math.min(40, parseInt(anyMatch[1], 10));
  if (/decade/i.test(text)) return 10;
  return null;
}

/**
 * Build executive_impact signals from text. Only populated for SENIOR_LEADER+
 * tiers — mirrors what Agent 1 does in the production pipeline.
 */
function buildExecutiveImpact(text: string): ExecutiveImpactSignals | null {
  const t = text.toLowerCase();
  // Team size — "60-person team", "8 engineers", "180-person team"
  const teamMatch = t.match(/(\d{1,4})[\s-]*(person|engineers?|people|team members)/);
  const team_size_org = teamMatch ? parseInt(teamMatch[1], 10) : null;
  // Budget — "₹8 Cr", "₹2 Cr/month", "$500K"
  const budgetCr = t.match(/₹\s*(\d{1,4})\s*cr/);
  const budget_authority_usd = budgetCr ? parseInt(budgetCr[1], 10) * 120000 : null; // 1 Cr ≈ $120K
  // Revenue — "₹18 Cr ARR", "₹85 Cr ARR"
  const arrMatch = t.match(/₹\s*(\d{1,4})\s*cr\s*arr/);
  const revenue_scope_usd = arrMatch ? parseInt(arrMatch[1], 10) * 120000 : null;
  const board_exposure = /board|investor|raised|seed|series|ipo/.test(t);
  const investor_facing = /investor|raised|series|seed|funded/.test(t);
  // Domain tenure — match "X years" again
  const tenureMatch = t.match(/(\d{1,2})\s*years?/);
  const domain_tenure_years = tenureMatch ? parseInt(tenureMatch[1], 10) : null;
  let moat_type: ExecutiveImpactSignals["moat_type"] = null;
  if (/regulator|compliance|hipaa|dpdp|sebi|rbi/.test(t)) moat_type = "REGULATORY";
  else if (/scaled|scale|10x|growth|cr arr/.test(t)) moat_type = "SCALE";
  else if (/relationship|client|account|enterprise/.test(t)) moat_type = "RELATIONSHIP";
  else if (/domain|expert|specialist/.test(t)) moat_type = "DOMAIN";
  return {
    revenue_scope_usd,
    team_size_direct: null,
    team_size_org,
    budget_authority_usd,
    regulatory_domains: /hipaa/.test(t) ? ["HIPAA"] : /dpdp/.test(t) ? ["DPDP"] : [],
    geographic_scope: ["India"],
    board_exposure,
    investor_facing,
    domain_tenure_years,
    cross_industry_pivots: 0,
    moat_type,
    moat_evidence: moat_type ? "inferred from resume text" : null,
  };
}

/**
 * Build ic_leverage signals from text. Used by professional/manager tier moat scoring.
 */
function buildIcLeverage(text: string, years: number | null): IcLeverageSignals | null {
  const t = text.toLowerCase();
  return {
    owns_key_relationships: /owns|owner|account|client|relationship|p&l/.test(t),
    cross_team_dependence: /cross[\s-]?functional|cross[\s-]?team|6 product|multiple teams|squads/.test(t),
    niche_replacement_difficulty: /niche|specialist|regulatory|domain|architect|staff|principal/.test(t),
    vendor_displacement_history: /displaced|replaced|in-?house|brought in-?house|consolidat/.test(t),
    tenure_in_function_years: years,
  };
}

/**
 * Build a ProfileInput from a fixture by matching its resume text against the
 * live KG. Skills the KG recognizes become execution_skills; everything else
 * is dropped. Strategic vs execution split is heuristic (anything containing
 * 'lead', 'manage', 'strategy', 'architect' goes strategic).
 *
 * v2 (2026-04-27): supplies executive_impact + ic_leverage + companyTier-aware
 * adaptability so the engine has real signal to score with — not just structural floor.
 */
function buildProfile(
  fixture: GoldenFixture,
  allSkillRiskRows: SkillRiskRow[],
): { profile: ProfileInput; companyTier: string | null; metroTier: string } {
  const candidates = extractSkillCandidates(fixture.resume_text);
  const matchedSkills: string[] = [];
  const seen = new Set<string>();
  for (const cand of candidates) {
    const m = matchSkillToKG(cand, allSkillRiskRows);
    if (m && !seen.has(m.skill_name.toLowerCase())) {
      matchedSkills.push(m.skill_name);
      seen.add(m.skill_name.toLowerCase());
    }
  }

  const STRATEGIC_HINTS = ["lead", "manage", "manager", "director", "strategy", "architect", "owner", "head", "vp", "ceo", "cto", "coo", "founder", "principal", "staff"];
  const isStrategic = (s: string) => STRATEGIC_HINTS.some((h) => s.toLowerCase().includes(h));

  const strategic_skills = matchedSkills.filter(isStrategic);
  const execution_skills = matchedSkills.filter((s) => !isStrategic(s));
  const all_skills = matchedSkills;

  const experience_years = extractYears(fixture.resume_text);

  // Seniority tier — anchored to role string + text signals
  const role = fixture.role.toLowerCase();
  const text = fixture.resume_text.toLowerCase();
  let seniority_tier: ProfileInput["seniority_tier"] = "PROFESSIONAL";
  if (/ceo|cto|coo|cfo|founder|president|chief/.test(role)) seniority_tier = "EXECUTIVE";
  else if (/vp|director|head|principal|staff|group/.test(role)) seniority_tier = "SENIOR_LEADER";
  else if (/manager|tech lead|tech manager|^lead\b/.test(role) || (/manager/.test(role) && !/social media|email/.test(role))) seniority_tier = "MANAGER";
  else if (/junior|associate|intern|trainee|executive/.test(role) && !/manager/.test(role)) seniority_tier = "ENTRY";

  // Strong AI-tooling signal — count distinct AI markers in text
  const aiMarkers = ["cursor", "claude", "gpt", "chatgpt", "llm", "rag", "vector db", "ai feature", "ai tool", "ml-ops", "mlops", "ai-native"];
  const aiCount = aiMarkers.filter((m) => text.includes(m)).length;
  const adaptability_signals = aiCount >= 3 ? 5 : aiCount >= 1 ? 3 : 1;

  const companyTier = inferCompanyTier(fixture.resume_text);
  // Metro tier inference
  const metroTier = /bengaluru|bangalore|mumbai|delhi|gurugram|gurgaon|hyderabad|pune|chennai/i.test(fixture.city) ? "tier1" : "tier2";

  // Only populate executive_impact / ic_leverage for tiers that the engine actually uses them for
  const isExec = seniority_tier === "EXECUTIVE" || seniority_tier === "SENIOR_LEADER";
  const executive_impact = isExec ? buildExecutiveImpact(fixture.resume_text) : null;
  const ic_leverage = !isExec ? buildIcLeverage(fixture.resume_text, experience_years) : null;

  return {
    profile: {
      experience_years,
      execution_skills,
      strategic_skills,
      all_skills,
      geo_advantage: fixture.city,
      adaptability_signals,
      estimated_monthly_salary_inr: null,
      seniority_tier,
      executive_impact,
      ic_leverage,
    },
    companyTier,
    metroTier,
  };
}

async function loadKG(supabase: any, industry: string) {
  const { data: industryJobs } = await supabase
    .from("job_taxonomy").select("*").eq("category", industry).limit(20);
  let jobs = industryJobs || [];
  if (jobs.length === 0) {
    const { data: fallback } = await supabase.from("job_taxonomy").select("*").limit(20);
    jobs = fallback || [];
  }
  const primaryJob: JobTaxonomyRow | null = jobs[0] || null;
  const targetFamily = primaryJob?.job_family || "full_stack_developer";

  const { data: skillMaps } = await supabase
    .from("job_skill_map")
    .select("skill_name, importance, frequency")
    .eq("job_family", targetFamily)
    .order("importance", { ascending: false })
    .limit(15);
  const skillMapRows: JobSkillMapRow[] = (skillMaps || []).map((s: any) => ({
    skill_name: s.skill_name, importance: s.importance, frequency: s.frequency || "common",
  }));

  const { data: allSkillRisk } = await supabase
    .from("skill_risk_matrix").select("*").limit(2000);
  const allSkillRiskRows: SkillRiskRow[] = (allSkillRisk || []).map((s: any) => ({
    skill_name: s.skill_name,
    automation_risk: s.automation_risk,
    ai_augmentation_potential: s.ai_augmentation_potential,
    human_moat: s.human_moat,
    replacement_tools: s.replacement_tools || [],
    india_demand_trend: s.india_demand_trend,
    category: s.category,
    ai_tool_native: s.ai_tool_native,
    vernacular_moat: s.vernacular_moat,
    bpo_template_flag: s.bpo_template_flag,
  }));

  const { data: marketSignals } = await supabase
    .from("market_signals").select("*").eq("job_family", targetFamily).limit(1);
  const marketSignal: MarketSignalRow | null = marketSignals?.[0]
    ? {
        posting_change_pct: marketSignals[0].posting_change_pct,
        avg_salary_change_pct: marketSignals[0].avg_salary_change_pct,
        ai_job_mentions_pct: marketSignals[0].ai_job_mentions_pct,
        market_health: marketSignals[0].market_health,
      }
    : null;

  return { primaryJob, skillMapRows, allSkillRiskRows, marketSignal };
}

function evaluateFixture(fixture: GoldenFixture, careerScore: number, toneTag: string): FixtureResult {
  const reasons: string[] = [];
  const inWindow = careerScore >= fixture.expected_score_min && careerScore <= fixture.expected_score_max;
  if (!inWindow) {
    reasons.push(
      `score ${careerScore} outside expected [${fixture.expected_score_min}, ${fixture.expected_score_max}]`,
    );
  }
  const expectedTone = fixture.expected_tone;
  // Allow tone to be one neighbour off (CRITICAL↔WARNING, MODERATE↔WARNING, etc.) since
  // the score window already gates this. But never allow opposite poles.
  const TONE_ORDER = ["CRITICAL", "WARNING", "MODERATE", "STABLE"];
  const distance = Math.abs(TONE_ORDER.indexOf(toneTag) - TONE_ORDER.indexOf(expectedTone));
  if (distance > 1) {
    reasons.push(`tone ${toneTag} too far from expected ${expectedTone}`);
  }
  return {
    id: fixture.id,
    family: fixture.family,
    pass: reasons.length === 0,
    career_score: careerScore,
    expected_score_window: [fixture.expected_score_min, fixture.expected_score_max],
    tone_actual: toneTag,
    tone_expected: expectedTone,
    failure_reasons: reasons,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin gate — this function exposes scoring internals; never user-callable.
  const adminSecret = Deno.env.get("GOLDEN_EVAL_ADMIN_SECRET");
  const provided = req.headers.get("x-admin-secret");
  if (!adminSecret || provided !== adminSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: { ids?: string[] } = {};
  try {
    body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  } catch {
    /* empty body OK */
  }
  const targetIds = body.ids;
  const fixtures = targetIds
    ? GOLDEN_FIXTURES.filter((f) => targetIds.includes(f.id))
    : GOLDEN_FIXTURES;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: FixtureResult[] = [];
  // Cache KG by industry to keep run cheap
  const kgCache = new Map<string, any>();

  for (const fixture of fixtures) {
    try {
      let kg = kgCache.get(fixture.industry);
      if (!kg) {
        kg = await loadKG(supabase, fixture.industry);
        kgCache.set(fixture.industry, kg);
      }
      const built = buildProfile(fixture, kg.allSkillRiskRows);
      const result = computeAll(
        built.profile, kg.allSkillRiskRows, kg.skillMapRows, kg.primaryJob, kg.marketSignal,
        false, built.companyTier, built.metroTier, null, fixture.industry, fixture.country, null, null,
      );
      const careerScore = Math.max(0, Math.min(100, 100 - result.determinism_index));
      results.push(evaluateFixture(fixture, careerScore, result.tone_tag));
    } catch (err) {
      results.push({
        id: fixture.id,
        family: fixture.family,
        pass: false,
        career_score: -1,
        expected_score_window: [fixture.expected_score_min, fixture.expected_score_max],
        tone_actual: "ERROR",
        tone_expected: fixture.expected_tone,
        failure_reasons: [`runtime error: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const passRate = total === 0 ? 0 : passed / total;

  const byFamily: Record<string, { passed: number; total: number; pass_rate: number }> = {};
  for (const r of results) {
    if (!byFamily[r.family]) byFamily[r.family] = { passed: 0, total: 0, pass_rate: 0 };
    byFamily[r.family].total += 1;
    if (r.pass) byFamily[r.family].passed += 1;
  }
  for (const fam of Object.keys(byFamily)) {
    byFamily[fam].pass_rate = byFamily[fam].passed / byFamily[fam].total;
  }

  return new Response(
    JSON.stringify({
      pass_rate: +passRate.toFixed(3),
      threshold: GOLDEN_EVAL_PASS_THRESHOLD,
      passed_threshold: passRate >= GOLDEN_EVAL_PASS_THRESHOLD,
      passed,
      total,
      by_family: byFamily,
      failures: results.filter((r) => !r.pass),
    }, null, 2),
    {
      status: passRate >= GOLDEN_EVAL_PASS_THRESHOLD ? 200 : 422,
      headers: { ...corsHeaders, "content-type": "application/json" },
    },
  );
});
