import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";

/**
 * create-scan — lightweight edge function that inserts a new scan row
 * using the service role key (bypasses RLS) and returns { id, accessToken }.
 *
 * This exists because the "Allow anonymous insert" RLS policy on the scans
 * table was removed for security (migration 20260309140336), but anonymous
 * users still need to start scans.  Using the edge function with service role
 * is the safe middle ground: the function validates input and enforces
 * business rules, while the database stays locked down.
 *
 * IMPORTANT: this function must NOT trigger processing itself. The client uploads
 * the resume after scan creation, then explicitly starts process-scan. Triggering
 * too early races the upload and causes stale/manual fallback analysis.
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  try {
    const supabase = createAdminClient();

    const body = await req.json().catch(() => ({}));
    const {
      linkedinUrl,
      resumeFilePath,
      country,
      industry,
      yearsExperience,
      metroTier,
      keySkills,
      userId,
      dpdpConsentGiven,
      dataRetentionConsent,
      estimatedMonthlySalaryInr: rawCTC,
    } = body as Record<string, string | boolean | number | undefined>;

    // VibeSec: validate and clamp user-reported CTC before storage.
    // Range: ₹5,000–₹5,000,000/month (₹60k–₹6Cr annual) — anything outside is rejected.
    // Type: must be a finite number, not a string or object.
    let validatedCTC: number | null = null;
    if (rawCTC !== null && rawCTC !== undefined) {
      const parsed = typeof rawCTC === 'number' ? rawCTC : Number(rawCTC);
      if (Number.isFinite(parsed) && parsed >= 5000 && parsed <= 5000000) {
        validatedCTC = Math.round(parsed);
      }
      // Silently discard out-of-range values — no error response (avoids info leakage)
    }

    // ── P0 (2026-04-17): Reject scans with no profile source ──
    // Without a resume OR a LinkedIn URL, the Profiler has nothing to extract from
    // and the scan is guaranteed to fail. Block at insert time instead of burning
    // AI tokens to fail. Discovered after 3 back-to-back `failed` scans today.
    const hasResume = typeof resumeFilePath === "string" && resumeFilePath.trim().length > 0;
    const hasLinkedIn = typeof linkedinUrl === "string" && linkedinUrl.trim().length > 0;
    if (!hasResume && !hasLinkedIn) {
      return new Response(
        JSON.stringify({
          error: "Upload a resume or paste a LinkedIn URL to start the scan.",
          code: "MISSING_PROFILE_SOURCE",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── P1 (2026-04-17): Per-user daily scan cap (cost guardrail) ──
    // Without this, a single bad actor can drain the AI budget overnight.
    // Free users: 3/day. Pro users: 50/day.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (userId && typeof userId === "string") {
      const { count: dailyCount } = await supabase
        .from("scans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", dayAgo);

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_expires_at")
        .eq("id", userId)
        .maybeSingle();
      const isPro = profile?.subscription_tier === "pro"
        && profile?.subscription_expires_at
        && new Date(profile.subscription_expires_at as string) > new Date();
      // Pre-PMF cost guardrail (2026-05-04): tightened from 100 → 30/day.
      // ENFORCE_PRO is OFF, so every scan = pure LLM burn. 30 is generous for real users
      // and brutal for bot floods. Restore to (isPro ? 50 : 3) when ENFORCE_PRO flips.
      const dailyLimit = 30;

      if ((dailyCount ?? 0) >= dailyLimit) {
        console.warn(`[create-scan] Daily cap reached for user ${userId}: ${dailyCount}/${dailyLimit}`);
        return new Response(
          JSON.stringify({
            error: isPro
              ? "Daily Pro scan limit reached. Try again tomorrow."
              : "Daily scan limit reached. Try again tomorrow.",
            code: "DAILY_LIMIT_REACHED",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // ── Anonymous IP-based rate limit (Phase 1, 2026-05-04) ──
      // Without this, an unauth'd attacker can flood create-scan and burn LLM budget.
      // Cap: 3 scans/hour per IP. Naive but sufficient pre-PMF.
      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";

      if (ip !== "unknown") {
        const { count: ipCount } = await supabase
          .from("scans")
          .select("id", { count: "exact", head: true })
          .is("user_id", null)
          .gte("created_at", hourAgo);
        // NOTE: This counts all anon scans in last hour, not per-IP (we don't store client_ip on scans).
        // True per-IP needs a separate table; this is a coarse global guardrail until then.
        if ((ipCount ?? 0) >= 20) {
          console.warn(`[create-scan] Global anon hourly cap hit (${ipCount}/20) — IP ${ip}`);
          return new Response(
            JSON.stringify({ error: "Too many scans right now. Please sign in or try again shortly.", code: "ANON_RATE_LIMIT" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── Race-condition guard: collapse rapid duplicate clicks ──
    // If the same user submitted an identical scan in the last 10 seconds,
    // return that scan instead of creating a duplicate. Protects against
    // double-click, retry storms, and accidental React strict-mode duplicates.
    if (userId && typeof userId === "string" && hasResume) {
      const tenSecAgo = new Date(Date.now() - 10_000).toISOString();
      const { data: recent } = await supabase
        .from("scans")
        .select("id, access_token")
        .eq("user_id", userId)
        .eq("resume_file_path", resumeFilePath as string)
        .gte("created_at", tenSecAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent?.id) {
        console.log(`[create-scan] Dedupe: returning existing scan ${recent.id} for user ${userId} (within 10s window)`);
        return new Response(
          JSON.stringify({ id: recent.id, accessToken: recent.access_token, triggered: false, deduped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      linkedin_url: linkedinUrl || null,
      resume_file_path: resumeFilePath || null,
      country: country || "IN",
      industry: industry || null,
      years_experience: yearsExperience || null,
      metro_tier: metroTier || null,
      scan_status: "processing",
      payment_status: "unpaid",
      dpdp_consent_given: dpdpConsentGiven ?? true,
      dpdp_consent_at: dpdpConsentGiven ? new Date().toISOString() : null,
      // DPDP Phase B: explicit opt-in for indefinite retention of resume_artifacts
      // and linkedin_snapshots. Default false → eligible for 90-day purge cron.
      data_retention_consent: dataRetentionConsent === true,
      ...(keySkills ? { enrichment_cache: { key_skills: keySkills } } : {}),
      ...(userId ? { user_id: userId } : {}),
      // User-reported CTC — pre-validated and clamped above
      ...(validatedCTC !== null ? { estimated_monthly_salary_inr: validatedCTC } : {}),
    };

    const { data, error } = await supabase
      .from("scans")
      .insert(insertPayload)
      .select("id, access_token")
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error("Scan creation returned no ID");

    return new Response(
      JSON.stringify({ id: data.id, accessToken: data.access_token, triggered: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    // Security: log full error server-side only — never expose internal details (stack traces,
    // DB constraint messages, internal IDs) to the client. Return a generic message instead.
    console.error("[create-scan] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create scan. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
