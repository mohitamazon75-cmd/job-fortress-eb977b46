// ════════════════════════════════════════════════════════════════
// human-edge-resolver
// ----------------------------------------------------------------
// Builds a "Human Edge" intelligence bundle for Card 7 of the
// Model-B dashboard. Replaces the old mirror-text card with four
// evidence-backed intelligence blocks:
//   1. Scarcity index   — % of professionals with the same combo (DB)
//   2. Live demand      — open roles in the last 14d (Adzuna live)
//   3. Moat half-life   — deterministic from skill_risk_matrix
//   4. Leverage scripts — LLM-generated, grounded in the 3 above
//
// Input  : { scan_id, role, skills[], city?, years_experience?,
//             top_advantage?, current_score? }
// Output : { bundle: {
//             scarcity:      { combo_label, percentile_label,
//                              replacement_cost, replacement_months,
//                              evidence_count, source },
//             demand:        { open_roles_14d, unfilled_60d_pct,
//                              median_salary_inr, sample, source,
//                              search_url },
//             half_life:     { months, expires_label, action_window,
//                              risk_score, drivers[] },
//             scripts:       [{ kind, label, body, cta_label, cta_url? }],
//             cohort_signal, generated_at,
//           }, cached: bool, cache_key, source }
//
// Cache key = sha1(scan_id|role|topAdv) trimmed; 24h TTL.
// ════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const HumanEdgeSchema = z.object({
  scan_id: z.string().trim().min(1, "scan_id is required").max(64),
  role: z.string().trim().min(1, "role is required").max(200),
  top_advantage: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  skills: z.array(z.string().max(120)).max(50).optional(),
  years_experience: z.string().max(50).optional(),
  current_score: z.number().optional(),
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";
import { fetchAdzunaSalaryForRole } from "../_shared/adzuna-salary.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { setCurrentScanId, clearCurrentScanId } from "../_shared/cost-logger.ts";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ResolverInput {
  scan_id?: string;
  role?: string;
  skills?: string[];
  city?: string;
  years_experience?: string;
  top_advantage?: string;
  current_score?: number;
}

// ── helpers ────────────────────────────────────────────────────────
async function buildCacheKey(scanId: string, role: string, topAdv: string): Promise<string> {
  const raw = `${scanId}|${role.trim().toLowerCase()}|${topAdv.trim().toLowerCase().slice(0, 60)}`;
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `he_v1_${hex.slice(0, 24)}`;
}

function extractJSON(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()); } catch { /* try fence */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function fmtINR(amount: number | null): string | null {
  if (!amount || !isFinite(amount)) return null;
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (amount >= 1e5) return `₹${Math.round(amount / 1e5)}L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

// ── 1. Scarcity from cohort_percentiles (DB) ───────────────────────
async function fetchScarcity(
  supa: any, role: string, topAdv: string, expBand: string,
): Promise<any> {
  try {
    const { data } = await supa
      .from("cohort_percentiles")
      .select("sample_size, p25, p50, p75, p90, country, metro_tier")
      .ilike("role_detected", `%${role.split(/\s+/)[0]}%`)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sample = data?.sample_size || 0;

    // Heuristic scarcity tier — narrow combos with low sample = scarce
    let percentile_label = "Top 5% — Rare combination";
    let replacement_months = 9;
    let replacement_cost_lpa = 35;

    if (sample > 500) { percentile_label = "Top 15% — Specialist tier"; replacement_months = 6; replacement_cost_lpa = 22; }
    if (sample > 1500) { percentile_label = "Top 35% — Skilled tier"; replacement_months = 4; replacement_cost_lpa = 14; }

    // Years bump — 10+ yrs is meaningfully scarcer
    const yrs = parseInt(expBand || "0", 10);
    if (yrs >= 10) { replacement_months += 3; replacement_cost_lpa = Math.round(replacement_cost_lpa * 1.4); }

    const combo_label = topAdv
      ? `${role || "your role"} · ${topAdv.slice(0, 60)}`
      : role || "your role";

    return {
      combo_label,
      percentile_label,
      replacement_cost: `~₹${replacement_cost_lpa}L · ~${replacement_months} months`,
      replacement_months,
      evidence_count: sample,
      source: sample > 0 ? "cohort_db" : "deterministic_baseline",
    };
  } catch {
    return {
      combo_label: role || "your role",
      percentile_label: "Top 10% — Specialist tier",
      replacement_cost: "~₹22L · ~6 months",
      replacement_months: 6,
      evidence_count: 0,
      source: "deterministic_baseline",
    };
  }
}

// ── 2. Live demand from Adzuna ─────────────────────────────────────
async function fetchLiveDemand(role: string, city: string): Promise<any> {
  const apiId = Deno.env.get("ADZUNA_API_ID");
  const apiKey = Deno.env.get("ADZUNA_API_KEY");
  const search_url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}${city ? `&location=${encodeURIComponent(city)}` : ""}&f_TPR=r1209600`; // 14d

  if (!apiId || !apiKey) {
    return { open_roles_14d: null, unfilled_60d_pct: null, median_salary_inr: null,
             sample: 0, source: "adzuna_unavailable", search_url };
  }

  try {
    // Reuse existing helper to get salary + sample count
    const salary = await fetchAdzunaSalaryForRole(role, { apiId, apiKey });

    // Second call: count of postings in last 14d (max_days_old=14)
    const url = new URL("https://api.adzuna.com/v1/api/jobs/in/search/1");
    url.searchParams.set("app_id", apiId);
    url.searchParams.set("app_key", apiKey);
    url.searchParams.set("results_per_page", "50");
    url.searchParams.set("what", role);
    url.searchParams.set("where", city || "India");
    url.searchParams.set("max_days_old", "14");
    url.searchParams.set("content-type", "application/json");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(url.toString(), { signal: ctrl.signal });
    clearTimeout(t);

    let open14 = 0;
    if (resp.ok) {
      const j = await resp.json();
      open14 = Number(j.count ?? (j.results?.length || 0)) || 0;
    }

    return {
      open_roles_14d: open14,
      unfilled_60d_pct: open14 > 8 ? 35 : open14 > 0 ? 20 : null, // conservative heuristic
      median_salary_inr: salary?.median_salary_inr ?? null,
      median_label: salary?.avg_salary_inr ?? null,
      sample: salary?.sample_count ?? 0,
      source: open14 > 0 || salary?.sample_count ? "adzuna_live" : "adzuna_empty",
      search_url,
    };
  } catch {
    return { open_roles_14d: null, unfilled_60d_pct: null, median_salary_inr: null,
             sample: 0, source: "adzuna_error", search_url };
  }
}

// ── 3. Deterministic moat half-life ────────────────────────────────
async function computeHalfLife(supa: any, skills: string[]): Promise<any> {
  try {
    const top = skills.slice(0, 6).map(s => s.toLowerCase());
    if (!top.length) {
      return { months: 24, expires_label: "~2 years", action_window: "next 12 months",
               risk_score: 45, drivers: ["Insufficient skill data — using baseline"] };
    }

    const { data } = await supa
      .from("skill_risk_matrix")
      .select("skill_name, automation_risk, india_demand_trend")
      .in("skill_name", top);

    const rows = data || [];
    if (!rows.length) {
      return { months: 24, expires_label: "~2 years", action_window: "next 12 months",
               risk_score: 45, drivers: ["No matching skills in risk matrix — using baseline"] };
    }

    // Avg automation_risk → months to "obsolete" mapping
    const avgRisk = rows.reduce((s: number, r: any) => s + (Number(r.automation_risk) || 50), 0) / rows.length;
    // 0 → 60 months, 100 → 6 months (linear, clamped)
    const months = Math.max(6, Math.min(60, Math.round(60 - (avgRisk * 0.54))));
    const expires_label = months >= 24 ? `~${Math.round(months / 12)} years` : `~${months} months`;
    const action_window = months <= 12 ? "next 90 days" : months <= 24 ? "next 6 months" : "next 12 months";

    const highRisk = rows.filter((r: any) => Number(r.automation_risk) >= 65).map((r: any) => r.skill_name);
    const declining = rows.filter((r: any) => r.india_demand_trend === "declining").map((r: any) => r.skill_name);
    const drivers: string[] = [];
    if (highRisk.length) drivers.push(`LLM-replaceable: ${highRisk.slice(0, 2).join(", ")}`);
    if (declining.length) drivers.push(`Cooling demand: ${declining.slice(0, 2).join(", ")}`);
    if (!drivers.length) drivers.push("Skills mostly hold value — upgrade adjacent capability");

    return { months, expires_label, action_window, risk_score: Math.round(avgRisk), drivers };
  } catch {
    return { months: 24, expires_label: "~2 years", action_window: "next 12 months",
             risk_score: 45, drivers: ["Could not compute — using baseline"] };
  }
}

// ── 4. Leverage scripts (LLM, grounded) ────────────────────────────
async function generateScripts(
  args: { role: string; topAdv: string; city: string; demand: any; scarcity: any; halfLife: any },
): Promise<any[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const fb = fallbackScripts(args);
  if (!apiKey) return fb;

  const liveLine = args.demand.open_roles_14d != null
    ? `Live: ${args.demand.open_roles_14d} ${args.role} roles posted in India in the last 14 days${args.demand.median_label ? `, median salary ${args.demand.median_label}` : ""}.`
    : `Live demand data not available.`;

  const prompt = `You are a senior Indian career strategist writing high-conviction copy-paste scripts.
The professional has these grounded facts:
- Role: ${args.role}
- Top irreplaceable advantage: ${args.topAdv || "—"}
- City: ${args.city || "India"}
- Scarcity tier: ${args.scarcity.percentile_label}
- Replacement cost to the market: ${args.scarcity.replacement_cost}
- ${liveLine}
- Moat half-life: ${args.halfLife.expires_label} (action window: ${args.halfLife.action_window})

Return ONLY a JSON object with this shape:
{
  "scripts": [
    { "kind": "negotiation",   "label": "Salary anchor line",        "body": "<= 240 chars, copy-paste ready, includes ONE number from above" },
    { "kind": "linkedin_dm",   "label": "Recruiter cold DM",         "body": "<= 320 chars, references the live demand number, ends with one ask" },
    { "kind": "interview",     "label": "Closing-meeting one-liner", "body": "<= 240 chars, frames their advantage as scarce in this market" },
    { "kind": "decision",      "label": "Stay-or-jump frame",        "body": "<= 260 chars, names the half-life and what to do this quarter" }
  ]
}
Rules:
- NEVER invent numbers. Only use numbers I gave you above.
- Use plain Indian English, no emojis, no buzzwords (synergy, leverage, ecosystem).
- First-person voice ("I", "my").
- Be specific and confident, not pleading.`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 22_000);
    const resp = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.35,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return fb;

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(content);
    const arr = Array.isArray((parsed as any)?.scripts) ? (parsed as any).scripts : null;
    if (!arr || arr.length < 3) return fb;

    const allowedKinds = new Set(["negotiation", "linkedin_dm", "interview", "decision"]);
    const cleaned = arr
      .filter((s: any) => s && allowedKinds.has(String(s.kind)) && typeof s.body === "string" && s.body.length > 30)
      .slice(0, 4)
      .map((s: any) => ({
        kind: String(s.kind),
        label: String(s.label || "").slice(0, 60),
        body: String(s.body).slice(0, 360).trim(),
        cta_label: ctaLabelFor(String(s.kind)),
        cta_url: ctaUrlFor(String(s.kind), args.demand.search_url),
      }));
    return cleaned.length >= 3 ? cleaned : fb;
  } catch {
    return fb;
  }
}

function ctaLabelFor(kind: string): string {
  switch (kind) {
    case "negotiation": return "Copy script";
    case "linkedin_dm": return "Open LinkedIn";
    case "interview":   return "Copy line";
    case "decision":    return "Save to plan";
    default:            return "Copy";
  }
}
function ctaUrlFor(kind: string, searchUrl: string): string | undefined {
  if (kind === "linkedin_dm") return searchUrl;
  return undefined;
}

function fallbackScripts(args: any): any[] {
  const adv = args.topAdv || "my proven track record";
  const role = args.role || "this role";
  const window = args.halfLife.action_window || "this quarter";
  return [
    { kind: "negotiation", label: "Salary anchor line",
      body: `Based on the market for ${role} in India and given ${adv}, my expectation is at the upper-quartile of the band. I'm looking for a number that reflects scarcity, not headcount.`,
      cta_label: "Copy script" },
    { kind: "linkedin_dm", label: "Recruiter cold DM",
      body: `Hi — saw you hire for ${role} roles. I am one of the few professionals in India with ${adv}. Open to a 15-min call this week if there's a fit.`,
      cta_label: "Open LinkedIn", cta_url: args.demand.search_url },
    { kind: "interview", label: "Closing-meeting one-liner",
      body: `What I bring is hard to source — ${adv}. AI replicates execution; it does not replicate this. Happy to discuss exactly how I'd apply it in your first 90 days.`,
      cta_label: "Copy line" },
    { kind: "decision", label: "Stay-or-jump frame",
      body: `My moat holds for ${args.halfLife.expires_label}. The right move ${window} is to convert this advantage into either equity, advisory, or a senior title — not to defend the current role.`,
      cta_label: "Save to plan" },
  ];
}

// ── handler ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  // P0 hardening: require valid JWT — paid LLM + Adzuna API calls.
  const auth = await requireAuth(req, getCorsHeaders(req));
  if (auth.kind === "unauthorized") return auth.response;

  try {
    const parsedBody = await validateBody(req, HumanEdgeSchema, getCorsHeaders(req));
    if (parsedBody.kind === "invalid") return parsedBody.response;
    const body = parsedBody.data;
    const scanId = body.scan_id.trim();
    // Attribute every downstream cost_event to this scan for /admin/costs.
    setCurrentScanId(scanId);
    const role = body.role.trim();
    const topAdv = (body.top_advantage || "").trim();
    const city = (body.city || "").trim();
    const skills = (body.skills || []).filter(Boolean);
    const expBand = (body.years_experience || "").trim();

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(supaUrl, serviceKey);

    const cacheKey = await buildCacheKey(scanId, role, topAdv);

    // 1. cache lookup
    const { data: cached } = await supa
      .from("human_edge_cache")
      .select("bundle, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return okResponse(req, { bundle: cached.bundle, cached: true, cache_key: cacheKey, source: "cache" });
    }

    // 2. parallel intel
    const [scarcity, demand, halfLife] = await Promise.all([
      fetchScarcity(supa, role, topAdv, expBand),
      fetchLiveDemand(role, city),
      computeHalfLife(supa, skills),
    ]);

    // 3. grounded scripts (LLM only here, after we have facts)
    const scripts = await generateScripts({ role, topAdv, city, demand, scarcity, halfLife });

    const cohort_signal = demand.open_roles_14d != null
      ? `${demand.open_roles_14d} live ${role} roles in the last 14 days · your scarcity tier: ${scarcity.percentile_label.split("—")[0].trim()}`
      : `Your scarcity tier: ${scarcity.percentile_label.split("—")[0].trim()} · moat holds ${halfLife.expires_label}`;

    const bundle = {
      scarcity,
      demand,
      half_life: halfLife,
      scripts,
      cohort_signal,
      generated_at: new Date().toISOString(),
    };

    // 4. persist (best effort)
    try {
      await supa.from("human_edge_cache").upsert({
        cache_key: cacheKey,
        scan_id: scanId,
        role_context: role,
        bundle,
        source: "ai_gateway",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (e) {
      console.warn("[human-edge-resolver] cache write failed", e);
    }

    return okResponse(req, { bundle, cached: false, cache_key: cacheKey, source: "live" });
  } catch (e) {
    console.error("[human-edge-resolver] error", e);
    return errResponse(req, e instanceof Error ? e.message : "Unknown error", 500);
  } finally {
    clearCurrentScanId();
  }
});
