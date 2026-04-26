// ═══════════════════════════════════════════════════════════════
// verdict-enrichment — Card 0 Verdict landing-page enrichment
//
// Purpose: provide three honest, concrete data points to the
// Card 0 Verdict screen so users see real value before unlocking:
//   1. resume_rating          — 0-10, derived from existing scan signals
//   2. resume_improvements    — count of concrete fixes the engine
//                                 already identified (skill_gap_map)
//   3. action_playbook_count  — count of weekly_action_plan items
//   4. missing_ai_tools_count — tools peers in the user's role list,
//                                 which the user's profile does NOT mention
//   5. missing_ai_tools_sample — up to 3 tool names for teaser
//
// CRITICAL DESIGN PRINCIPLES:
// • 100% deterministic — NO LLM calls, NO hallucination surface
// • Reads only from existing scan report + skill_risk_matrix
// • Returns null for any field we cannot honestly compute
// • <500ms latency, ~₹0 cost
// • Safe fallback on every failure path
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";

interface EnrichmentResponse {
  resume_rating: number | null;          // 0-10, one decimal
  resume_rating_label: string | null;    // "Strong" / "Solid" / "Needs work" / "Underperforming"
  resume_improvements_count: number | null;
  action_playbook_count: number | null;
  missing_ai_tools_count: number | null;
  missing_ai_tools_sample: string[];     // up to 3 names, for teaser
  // Personalised live role matches (from card4_pivot.pivots — real engine output)
  live_jobs_count: number | null;
  live_jobs_top_fit_pct: number | null;  // best match_pct across pivots (0-100)
  // Curated learning resources (deterministic count from learning_resources table)
  learning_resources_count: number | null;
  learning_resources_breakdown: { courses: number; videos: number; books: number } | null;
}

const EMPTY: EnrichmentResponse = {
  resume_rating: null,
  resume_rating_label: null,
  resume_improvements_count: null,
  action_playbook_count: null,
  missing_ai_tools_count: null,
  missing_ai_tools_sample: [],
  live_jobs_count: null,
  live_jobs_top_fit_pct: null,
  learning_resources_count: null,
  learning_resources_breakdown: null,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  try {
    const body = await req.json().catch(() => ({}));
    const scan_id = typeof body?.scan_id === "string" ? body.scan_id : null;

    if (!scan_id || !/^[0-9a-f-]{36}$/i.test(scan_id)) {
      return errResponse(req, "Valid scan_id is required", 400);
    }

    const supabase = createAdminClient();

    const { data: scan, error } = await supabase
      .from("scans")
      .select("id, final_json_report, role_detected, industry")
      .eq("id", scan_id)
      .maybeSingle();

    if (error || !scan || !scan.final_json_report) {
      // Honest fallback — no data, no enrichment, return empty.
      return okResponse(req, { enrichment: EMPTY });
    }

    const report: Record<string, unknown> = scan.final_json_report as Record<string, unknown>;

    // ─── 1 & 2. Resume rating + improvements ───────────────────────
    const rating = computeResumeRating(report);

    // Improvement count = entries in skill_gap_map (real, engine-identified gaps)
    const skillGapMap = Array.isArray(report.skill_gap_map) ? report.skill_gap_map : [];
    const resume_improvements_count = skillGapMap.length > 0 ? skillGapMap.length : null;

    // ─── 3. Action playbook count ──────────────────────────────────
    const wp = Array.isArray(report.weekly_action_plan) ? report.weekly_action_plan : [];
    const action_playbook_count = wp.length > 0 ? wp.length : null;

    // ─── 4 & 5. Missing AI tools (deterministic peer diff) ─────────
    const { count: missing_ai_tools_count, sample: missing_ai_tools_sample } =
      await computeMissingAiTools(supabase, report);

    // ─── 6 & 7. Live personalised role matches (from existing pivot output) ─
    const { count: live_jobs_count, top_fit_pct: live_jobs_top_fit_pct } =
      computeLiveJobMatches(report);

    // ─── 8 & 9. Curated learning resources (real DB count) ─────────
    const { count: learning_resources_count, breakdown: learning_resources_breakdown } =
      await computeLearningResources(supabase, report);

    const enrichment: EnrichmentResponse = {
      resume_rating: rating.value,
      resume_rating_label: rating.label,
      resume_improvements_count,
      action_playbook_count,
      missing_ai_tools_count,
      missing_ai_tools_sample,
      live_jobs_count,
      live_jobs_top_fit_pct,
      learning_resources_count,
      learning_resources_breakdown,
    };

    return okResponse(req, { enrichment });
  } catch (e) {
    console.error("[verdict-enrichment] error:", e);
    // Never break the verdict screen — return empty, not an error.
    return okResponse(req, { enrichment: EMPTY });
  }
});

// ─── Resume rating: 0-10 derived from existing engine signals ────
//
// Uses three signals already in the report (no LLM):
//   • Career Position score (jobbachao_score / risk_score) — 0-100
//   • data_quality.profile_completeness_pct — 0-100 (or 0-1)
//   • extraction_confidence — 'high' | 'medium' | 'low'
//
// Output: 0.0 — 10.0 with one decimal.
// Returns null if signals are missing (we don't fake it).
function computeResumeRating(
  report: Record<string, unknown>,
): { value: number | null; label: string | null } {
  const sb = (report.score_breakdown ?? {}) as Record<string, unknown>;
  const score = numOrNull(report.jobbachao_score)
    ?? numOrNull(report.risk_score)
    ?? numOrNull(sb.final_clamped)
    ?? numOrNull(report.survivability)
    ?? numOrNull(report.automation_risk);
  const dq = (report.data_quality ?? {}) as Record<string, unknown>;
  const completenessRaw = numOrNull(dq.profile_completeness_pct) ?? numOrNull(dq.profile_completeness);
  const completeness = completenessRaw == null
    ? null
    : completenessRaw > 1 ? Math.min(100, completenessRaw) : completenessRaw * 100;

  const extractionConf = String(report.extraction_confidence ?? "").toLowerCase();
  const confBoost = extractionConf === "high" ? 1 : extractionConf === "medium" ? 0 : -1;

  // Need at least the score to compute. Completeness optional.
  if (score == null) return { value: null, label: null };

  // 60% career score, 30% completeness (default 70 if absent), 10% extraction confidence
  const completenessTerm = completeness != null ? completeness : 70;
  let raw = (score * 0.6) + (completenessTerm * 0.3) + (confBoost + 1) * 5; // 0-110ish
  raw = Math.max(0, Math.min(100, raw));

  const value = Math.round(raw / 10 * 10) / 10; // tenths, e.g. 7.4
  const label = value >= 8 ? "Strong"
    : value >= 6.5 ? "Solid"
    : value >= 5 ? "Needs work"
    : "Underperforming";

  return { value, label };
}

// ─── Missing AI tools: peer-diff from skill_risk_matrix ──────────
//
// Algorithm:
//   1. Take user's all_skills + execution_skills
//   2. Look up skill_risk_matrix rows where skill_name matches
//      (case-insensitive)
//   3. Collect every replacement_tools entry — these are the tools
//      that real peers use in the user's actual skill domains
//   4. Subtract any tool already mentioned in raw_profile_text
//      (case-insensitive substring match)
//   5. Return count + up to 3 sample names
//
// 100% deterministic, 0 LLM calls, ~50ms.
async function computeMissingAiTools(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  report: Record<string, unknown>,
): Promise<{ count: number | null; sample: string[] }> {
  try {
    const allSkills = arrOfStrings(report.all_skills);
    const execSkills = arrOfStrings(report.execution_skills);
    const userSkills = Array.from(new Set([...allSkills, ...execSkills].map((s) => s.toLowerCase().trim()).filter(Boolean)));
    if (userSkills.length === 0) return { count: null, sample: [] };

    const profileText = String(report.raw_profile_text ?? "").toLowerCase();

    // Pull the full matrix once (251 rows; trivial). Avoids fragile
    // per-skill OR queries and keeps the SQL simple & fast.
    const { data: matrix, error } = await supabase
      .from("skill_risk_matrix")
      .select("skill_name, replacement_tools")
      .not("replacement_tools", "is", null);

    if (error || !Array.isArray(matrix)) return { count: null, sample: [] };

    const userSkillSet = new Set(userSkills);
    const tools = new Set<string>();

    for (const row of matrix) {
      const skill = String(row?.skill_name ?? "").toLowerCase().trim();
      if (!skill) continue;
      // Match if user's skill mentions the matrix skill (substring either way)
      const match = userSkillSet.has(skill) ||
        Array.from(userSkillSet).some((us) => us.includes(skill) || skill.includes(us));
      if (!match) continue;

      const rt = row.replacement_tools;
      if (!Array.isArray(rt)) continue;
      for (const t of rt) {
        if (typeof t !== "string" || !t.trim()) continue;
        const tool = t.trim();
        // Already in resume? Skip (case-insensitive substring).
        if (profileText.includes(tool.toLowerCase())) continue;
        tools.add(tool);
      }
    }

    if (tools.size === 0) return { count: 0, sample: [] };
    const list = Array.from(tools).sort();
    return { count: list.length, sample: list.slice(0, 3) };
  } catch (e) {
    console.warn("[verdict-enrichment] missing-tools failed:", e);
    return { count: null, sample: [] };
  }
}

// ─── helpers ─────────────────────────────────────────────────────
function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) return Number(v);
  return null;
}
function arrOfStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
