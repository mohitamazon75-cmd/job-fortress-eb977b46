/**
 * get-cohort-outcomes
 * 
 * Returns calibration curve data for a given DI range + profile.
 * Used by Card 2 to show: "Of N professionals with DI 65–75 in your
 * field who upskilled: 61% got interviews."
 *
 * POST { di: number, role: string, industry: string }
 * Returns { sample_size, action_rate, got_interview_rate, upskilling_rate,
 *           di_bucket_min, di_bucket_max, calibrated: boolean }
 *
 * When no data (sample_size < 30): returns { calibrated: false }
 * so the UI can show a "gathering data" placeholder.
 */

import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

// In-process cache — TTL 1 hour (calibration runs weekly, results are stable)
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  try {
    const { di, role, industry } = await req.json().catch(() => ({}));
    if (!di || typeof di !== "number") {
      return new Response(JSON.stringify({ calibrated: false, reason: "missing_di" }), {
        headers: jsonHeaders,
      });
    }

    const di_bucket_min = Math.floor(di / 10) * 10;
    const di_bucket_max = di_bucket_min + 10;
    const normRole    = normalizeRoleCategory(role ?? "");
    const normIndustry = normalizeIndustry(industry ?? "");

    // Try progressively broader segments until we find one with data
    const candidates = [
      { role_category: normRole, industry: normIndustry },
      { role_category: normRole, industry: null },
      { role_category: null, industry: normIndustry },
      { role_category: null, industry: null },
    ];

    const cacheKey = `${di_bucket_min}:${normRole ?? "*"}:${normIndustry ?? "*"}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return new Response(JSON.stringify(hit.data), { headers: jsonHeaders });
    }

    const supabase = createAdminClient();

    for (const seg of candidates) {
      let q = supabase
        .from("outcome_calibration_curves")
        .select("sample_size, action_rate, got_interview_rate, upskilling_rate, calibration_error, di_bucket_min, di_bucket_max, role_category, industry")
        .eq("di_bucket_min", di_bucket_min)
        .eq("di_bucket_max", di_bucket_max)
        .order("computed_at", { ascending: false })
        .limit(1);

      if (seg.role_category !== null) q = q.eq("role_category", seg.role_category);
      else q = q.is("role_category", null);
      if (seg.industry !== null) q = q.eq("industry", seg.industry);
      else q = q.is("industry", null);

      const { data: rows } = await q;
      const row = rows?.[0];
      if (row && (row.sample_size as number) >= 30) {
        const result = { calibrated: true, ...row };
        cache.set(cacheKey, { data: result, ts: Date.now() });
        return new Response(JSON.stringify(result), { headers: jsonHeaders });
      }
    }

    // No segment has enough data yet
    const notReady = { calibrated: false, reason: "gathering_data" };
    cache.set(cacheKey, { data: notReady, ts: Date.now() });
    return new Response(JSON.stringify(notReady), { headers: jsonHeaders });

  } catch (e) {
    console.error("[get-cohort-outcomes] Error:", e);
    return new Response(JSON.stringify({ calibrated: false, reason: "error" }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

function normalizeRoleCategory(role: string): string | null {
  const r = role.toLowerCase();
  if (/software|engineer|developer|devops|sre|backend|frontend|fullstack|platform/.test(r)) return "engineering";
  if (/data|analyst|scientist|bi |analytics/.test(r)) return "data";
  if (/product|pm |program manager/.test(r)) return "product";
  if (/market|content|brand|seo|growth|social|copywr/.test(r)) return "marketing";
  if (/finance|account|audit|tax|banking|invest/.test(r)) return "finance";
  if (/hr |human resource|talent|recruit/.test(r)) return "hr";
  if (/sales|business dev|account executive/.test(r)) return "sales";
  if (/design|ux |ui |visual/.test(r)) return "design";
  if (/ops|operations|supply|logistics/.test(r)) return "operations";
  if (!r) return null;
  return "other";
}

function normalizeIndustry(industry: string): string | null {
  const i = industry.toLowerCase();
  if (/tech|software|it |saas|cloud|cyber/.test(i)) return "technology";
  if (/finance|bank|insurance|fintech/.test(i)) return "finance";
  if (/health|pharma|biotech|medical/.test(i)) return "healthcare";
  if (/ecomm|retail|consumer/.test(i)) return "retail";
  if (/manufact|auto|industrial/.test(i)) return "manufacturing";
  if (/media|entertainment|gaming/.test(i)) return "media";
  if (!i) return null;
  return "other";
}
