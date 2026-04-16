// ═══════════════════════════════════════════════════════════════
// Scan Cache — compatibility checks and cache lookup logic
// ═══════════════════════════════════════════════════════════════

/**
 * Validates that a cached report meets the current schema requirements.
 * Returns false if fields critical to the dashboard are missing or incompatible.
 */
export function isCacheCompatible(cachedReport: Record<string, unknown>): boolean {
  if (!cachedReport || typeof cachedReport !== "object") return false;

  // ── Quality gate: reject low-confidence cached reports ──
  const confidence = cachedReport.extraction_confidence || cachedReport.rawExtractionQuality || "unknown";
  if (confidence === "low") {
    console.log(`[Cache] REJECT — cached report has low extraction confidence`);
    return false;
  }

  // ── Quality gate: reject reports with generic/missing role ──
  const role = cachedReport.role || cachedReport.role_detected || "";
  if (!role || role === "Unknown" || role === "Professional" || role === "Unknown Role") {
    console.log(`[Cache] REJECT — cached report has generic role: "${role}"`);
    return false;
  }

  // ── Quality gate: minimum skill extraction ──
  const skillCount = (cachedReport.all_skills || []).length;
  if (skillCount < 3) {
    console.log(`[Cache] REJECT — cached report has only ${skillCount} skills`);
    return false;
  }

  const hasWeeklyDiet = "weekly_survival_diet" in cachedReport;
  const hasSkillSignal = (
    (Array.isArray(cachedReport.all_skills) && cachedReport.all_skills.length > 0) ||
    (Array.isArray(cachedReport.execution_skills_dead) && cachedReport.execution_skills_dead.length > 0) ||
    (Array.isArray(cachedReport?.score_breakdown?.skill_adjustments) && cachedReport.score_breakdown.skill_adjustments.length > 0)
  );
  const marketOk =
    !cachedReport.market_position_model ||
    typeof cachedReport.market_position_model !== "object" ||
    "market_percentile" in cachedReport.market_position_model ||
    "gaussian_fit_percentile" in cachedReport.market_position_model;
  const shockOk =
    !cachedReport.career_shock_simulator ||
    typeof cachedReport.career_shock_simulator !== "object" ||
    "expected_time_to_rehire_months" in cachedReport.career_shock_simulator ||
    "estimated_job_search_months" in cachedReport.career_shock_simulator;
  const hasTier = "moat_score" in cachedReport && cachedReport.moat_score != null && cachedReport._engine_version >= 5;

  return hasWeeklyDiet && hasSkillSignal && marketOk && shockOk && hasTier;
}

/**
 * Attempts to find a compatible cached scan result. Returns the cached report if found, null otherwise.
 */
export async function findCachedScan(
  supabase: SupabaseClient,
  scanId: string,
  scan: Record<string, unknown>,
  hasResume: boolean,
  forceRefresh: boolean,
  cacheTtlHours: number,
): Promise<{ report: Record<string, unknown>; meta: Record<string, unknown> } | null> {
  if (forceRefresh || hasResume) return null;

  const cacheWindow = new Date(Date.now() - cacheTtlHours * 60 * 60 * 1000).toISOString();
  const selectFields = "final_json_report, determinism_index, months_remaining, salary_bleed_monthly, role_detected";

  // LinkedIn URL cache
  if (scan.linkedin_url) {
    const { data: cachedScans } = await supabase.from("scans")
      .select(selectFields)
      .eq("linkedin_url", scan.linkedin_url).eq("scan_status", "complete").neq("id", scanId)
      .gte("created_at", cacheWindow).order("created_at", { ascending: false }).limit(1);

    const cached = cachedScans?.[0];
    if (cached?.final_json_report && isCacheCompatible(cached.final_json_report)) {
      console.log(`[Cache] HIT for ${scan.linkedin_url}`);
      return { report: cached.final_json_report, meta: cached };
    }
  }

  // Industry combo cache (manual entry)
  if (!scan.linkedin_url && scan.industry) {
    const { data: cachedScans } = await supabase.from("scans")
      .select(selectFields)
      .eq("industry", scan.industry).eq("years_experience", scan.years_experience || "")
      .eq("metro_tier", scan.metro_tier || "tier1").eq("scan_status", "complete").neq("id", scanId)
      .is("linkedin_url", null).gte("created_at", cacheWindow).order("created_at", { ascending: false }).limit(1);

    const cached = cachedScans?.[0];
    if (cached?.final_json_report && isCacheCompatible(cached.final_json_report)) {
      console.log(`[Cache] HIT for ${scan.industry}/${scan.years_experience}`);
      return { report: cached.final_json_report, meta: cached };
    }
  }

  return null;
}
