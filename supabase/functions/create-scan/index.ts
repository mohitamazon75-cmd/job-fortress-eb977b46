import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

/**
 * create-scan — lightweight edge function that inserts a new scan row
 * using the service role key (bypasses RLS) and returns { id, accessToken }.
 *
 * This exists because the "Allow anonymous insert" RLS policy on the scans
 * table was removed for security (migration 20260309140336), but anonymous
 * users still need to start scans.  Using the edge function with service role
 * is the safe middle ground: the function validates input and enforces
 * business rules, while the database stays locked down.
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    } = body as Record<string, string | boolean | undefined>;

    // Deduplicate: if this user already has a recent 'processing' scan, reuse it
    if (userId) {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("scans")
        .select("id, access_token")
        .eq("user_id", userId)
        .eq("scan_status", "processing")
        .gte("created_at", twoMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ id: existing.id, accessToken: existing.access_token }),
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
      ...(keySkills ? { enrichment_cache: { key_skills: keySkills } } : {}),
      ...(userId ? { user_id: userId } : {}),
    };

    const { data, error } = await supabase
      .from("scans")
      .insert(insertPayload)
      .select("id, access_token")
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error("Scan creation returned no ID");

    // Fire-and-forget: trigger process-scan server-to-server so anonymous users
    // don't hit the JWT gate inside process-scan.  The service-role key bypasses
    // validateJwtClaims (isServiceRoleCall returns true for it).
    const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-scan`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const triggerFetch = fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ scanId: data.id }),
    }).catch((err) => console.warn("[create-scan] Failed to trigger process-scan:", err));

    // Keep the fetch alive after this function returns
    // @ts-ignore: EdgeRuntime is available in the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(triggerFetch);
    }

    return new Response(
      JSON.stringify({ id: data.id, accessToken: data.access_token, triggered: true }),
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
