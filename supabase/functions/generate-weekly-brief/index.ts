/**
 * generate-weekly-brief
 * Status: INCOMPLETE — not wired to any trigger
 *
 * This function generates weekly job market briefs and writes
 * to the weekly_briefs table. The table and RLS policies exist.
 *
 * To activate: add a pg_cron schedule in a new migration:
 *   SELECT cron.schedule(
 *     'weekly-brief-job',
 *     '0 0 * * 0',  -- Sunday midnight UTC
 *     $$ SELECT net.http_post(
 *       url := current_setting('app.supabase_url')
 *              || '/functions/v1/generate-weekly-brief',
 *       headers := '{"Content-Type":"application/json"}'::jsonb
 *     ) $$
 *   );
 *
 * TODO(2026-04-06): Wire cron trigger when feature is
 * ready for production.
 */
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requirePro } from "../_shared/subscription-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  // Server-side Pro subscription check
  // Note: This function is also called by cron (no auth header) — skip check for service role
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "NEVERMATCHES");
  if (!isCronCall) {
    const subGuard = await requirePro(req);
    if (subGuard) return subGuard;
  }

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;
  } catch { /* guard is best-effort for batch jobs */ }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const targetScanId = body.scanId as string | undefined;

    // If a specific scanId is provided, generate for that scan only.
    // Otherwise, generate for all scans from the last 30 days.
    let scans: any[] = [];

    if (targetScanId) {
      const { data } = await sb
        .from("scans")
        .select("id, final_json_report, industry, role_detected, years_experience")
        .eq("id", targetScanId)
        .eq("scan_status", "complete")
        .single();
      if (data) scans = [data];
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from("scans")
        .select("id, final_json_report, industry, role_detected, years_experience")
        .eq("scan_status", "complete")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(50);
      scans = data || [];
    }

    if (scans.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible scans", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;

    for (const scan of scans) {
      try {
        const report = scan.final_json_report as any;
        if (!report) continue;

        const role = report.role || scan.role_detected || "Professional";
        const industry = report.industry || scan.industry || "Technology";
        const seniorityTier = report.seniority_tier || "PROFESSIONAL";
        const moatSkills = (report.moat_skills || []).slice(0, 3).join(", ");
        const riskScore = report.determinism_index || 50;
        const company = report.linkedin_company || null;

        // Check if brief already exists this week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const { data: existing } = await sb
          .from("weekly_briefs")
          .select("id")
          .eq("scan_id", scan.id)
          .gte("created_at", weekStart.toISOString())
          .limit(1);

        if (existing && existing.length > 0) continue; // Already generated this week

        // Compute SPI
        const spi = Math.round(100 - Math.min(95, Math.max(5, riskScore)));

        // Check previous brief for SPI delta
        const { data: prevBriefs } = await sb
          .from("weekly_briefs")
          .select("brief_json")
          .eq("scan_id", scan.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const prevSpi = prevBriefs?.[0]?.brief_json?.spi ?? null;
        const spiDelta = prevSpi !== null ? spi - prevSpi : null;

        // Fetch fresh signals from Perplexity
        let signals: any[] = [];
        let netSignal = "";

        if (PERPLEXITY_API_KEY) {
          const seniorityCtx = ["EXECUTIVE", "SENIOR_LEADER"].includes(seniorityTier)
            ? "This is a senior executive. Focus on board-level AI mandates, organizational restructuring, P&L impact, and strategic positioning — NOT individual tool recommendations."
            : seniorityTier === "MANAGER"
            ? "This is a mid-level manager. Focus on team-level AI adoption, leadership positioning, and departmental efficiency."
            : "This is an individual contributor. Focus on specific tools, skill premiums, and job market trends.";

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);

          try {
            const resp = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "sonar",
                messages: [
                  {
                    role: "system",
                    content: `You are a weekly career intelligence briefing engine. Return ONLY valid JSON.

ADDRESSATION: Address the user as "you" throughout. NEVER use "this professional" or third-person.
CITATIONS: For every numerical claim, cite the source in brackets [source, date]. Never fabricate statistics.

CONTEXT:
- Role: ${role}
- Industry: ${industry}
- Seniority: ${seniorityTier}
- Key strengths: ${moatSkills || "not specified"}
- Company: ${company || "not specified"}
${seniorityCtx}

Generate 3-5 fresh career signals from the LAST 7 DAYS relevant to you. Each must reference real companies, events, or data.

Return JSON:
{
  "signals": [
    {
      "category": "ai_impact" | "hiring_trend" | "role_shift" | "opportunity" | "risk",
      "headline": string (max 12 words),
      "detail": string (1-2 sentences, specific),
      "urgency": "high" | "medium" | "low",
      "source_hint": string (e.g. "Bloomberg", "LinkedIn data")
    }
  ],
  "weekly_action": string (one specific action for this week),
  "net_signal": string (one sentence overall assessment)
}`,
                  },
                  {
                    role: "user",
                    content: `Generate this week's intelligence brief for a ${role} in ${industry}${company ? ` at ${company}` : ""}. Focus on what changed in the last 7 days that affects their career trajectory.`,
                  },
                ],
                temperature: 0.1,
                search_recency_filter: "week",
              }),
              signal: controller.signal,
            });

            clearTimeout(timeout);

            if (resp.ok) {
              const data = await resp.json();
              logTokenUsage("generate-weekly-brief", null, "google/gemini-3-flash-preview", data);
              const content = data.choices?.[0]?.message?.content || "";
              const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              try {
                const parsed = JSON.parse(jsonStr);
                signals = parsed.signals || [];
                netSignal = parsed.net_signal || "";

                // Include weekly_action in brief
                if (parsed.weekly_action) {
                  netSignal = parsed.weekly_action;
                }
              } catch {
                console.warn(`[weekly-brief] JSON parse failed for scan ${scan.id}`);
              }
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") {
              console.warn(`[weekly-brief] Perplexity timed out for scan ${scan.id}`);
            } else {
              console.warn(`[weekly-brief] Perplexity error for scan ${scan.id}:`, e);
            }
            clearTimeout(timeout);
          }
        }

        const briefJson = {
          spi,
          spi_delta: spiDelta,
          signals,
          weekly_action: netSignal,
          role,
          industry,
          seniority_tier: seniorityTier,
          generated_at: new Date().toISOString(),
        };

        await sb.from("weekly_briefs").insert({
          scan_id: scan.id,
          brief_json: briefJson,
        });

        generated++;
      } catch (scanErr) {
        console.error(`[weekly-brief] Error processing scan ${scan.id}:`, scanErr);
      }
    }

    return new Response(
      JSON.stringify({ message: `Generated ${generated} briefs`, generated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[weekly-brief] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
