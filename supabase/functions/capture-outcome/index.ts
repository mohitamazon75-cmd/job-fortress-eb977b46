/**
 * capture-outcome — Issue 2-A: Outcome tracking flywheel
 *
 * Called when a user clicks a link in the 7-day follow-up email.
 * URL: /capture-outcome?scan_id=<uuid>&outcome=<value>&source=email_7day
 *
 * After capturing: redirects back to the report with a thank-you param.
 * Also handles POST from in-product prompts.
 */

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

const VALID_OUTCOMES = new Set([
  "started_upskilling",
  "applied_to_jobs",
  "got_interview",
  "nothing_yet",
]);

const OUTCOME_LABELS: Record<string, string> = {
  started_upskilling: "Started upskilling",
  applied_to_jobs:    "Applied to jobs",
  got_interview:      "Got an interview",
  nothing_yet:        "Nothing yet",
};

const SITE_URL = "https://jobbachao.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // Spam protection: reject requests from blocked IPs/origins
  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    let scan_id: string | null;
    let outcome: string | null;
    let source: string;

    if (req.method === "GET") {
      scan_id = url.searchParams.get("scan_id");
      outcome  = url.searchParams.get("outcome");
      source   = url.searchParams.get("source") || "email_7day";
    } else {
      const body = await req.json().catch(() => ({}));
      scan_id = body.scan_id ?? null;
      outcome  = body.outcome ?? null;
      source   = body.source  ?? "in_product";
    }

    if (!scan_id || !outcome || !VALID_OUTCOMES.has(outcome)) {
      if (req.method === "GET") {
        return Response.redirect(`${SITE_URL}?outcome_error=invalid`, 302);
      }
      return new Response(JSON.stringify({ error: "Missing or invalid params" }), { status: 400, headers: jsonHeaders });
    }

    const supabase = createAdminClient();

    const { data: scan } = await supabase
      .from("scans")
      .select("user_id, created_at, determinism_index, role_detected, industry, final_json_report")
      .eq("id", scan_id)
      .maybeSingle();

    if (!scan) {
      if (req.method === "GET") return Response.redirect(`${SITE_URL}?outcome_error=not_found`, 302);
      return new Response(JSON.stringify({ error: "Scan not found" }), { status: 404, headers: jsonHeaders });
    }

    const daysSinceScan = scan.created_at
      ? Math.round((Date.now() - new Date(scan.created_at as string).getTime()) / 86_400_000)
      : null;

    const r = (scan.final_json_report as Record<string, unknown>) ?? {};

    await supabase.from("scan_outcomes").upsert({
      scan_id,
      user_id:                scan.user_id ?? null,
      days_since_scan:        daysSinceScan,
      outcome,
      scan_determinism_index: (scan.determinism_index as number) ?? null,
      scan_role:              (scan.role_detected as string) ?? null,
      scan_industry:          (scan.industry as string) ?? null,
      scan_seniority:         (r.seniority_tier as string) ?? null,
      scan_country:           (r.country as string) ?? "IN",
      source,
    }, { onConflict: "scan_id,source" });

    console.log(`[capture-outcome] ${outcome} | scan=${scan_id} | days=${daysSinceScan} | source=${source}`);

    if (req.method === "GET") {
      const redirect = outcome === "got_interview"
        ? `${SITE_URL}/results/model-b?id=${scan_id}&milestone=interview`
        : `${SITE_URL}/?outcome_recorded=${encodeURIComponent(OUTCOME_LABELS[outcome])}`;
      return Response.redirect(redirect, 302);
    }

    return new Response(JSON.stringify({ success: true, outcome, days_since_scan: daysSinceScan }), { headers: jsonHeaders });

  } catch (e) {
    console.error("[capture-outcome] Error:", e);
    if (req.method === "GET") return Response.redirect(`${SITE_URL}?outcome_error=server`, 302);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: getCorsHeaders(req) });
  }
});
