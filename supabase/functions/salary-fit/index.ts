// salary-fit — Personalized salary benchmarking for Indian market
// Inputs: user_ctc_lpa (number), role, industry, city, years_experience, country
// Output: median range + verdict (underpaid/fair/overpaid) + diplomatic, actionable suggestion
// Sources: Adzuna (live job postings) + Tavily (web grounding) + Gemini synthesis
// Anti-abuse: caps absurd inputs (>₹100Cr, <0), gives neutral response

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { fetchAdzunaSalaryForRole } from "../_shared/adzuna-salary.ts";

const CACHE_TTL_MS = 30 * 60 * 1000;

// Sanity caps (LPA = lakhs per annum). Anything outside this is treated as bogus.
const MIN_REASONABLE_LPA = 1;       // ₹1L/year — below minimum wage territory
const MAX_REASONABLE_LPA = 50_000;  // ₹50Cr/year — top 0.001%; anything higher = abuse

interface SalaryFitInput {
  user_ctc_lpa: number;
  role?: string;
  industry?: string;
  city?: string;
  metro_tier?: "tier1" | "tier2";
  years_experience?: string;
  country?: string;
  user_skills?: string[];   // Optional: user's resume skills, used to personalise "fair" guidance
}

interface SalaryFitResult {
  status: "ok" | "input_invalid" | "no_data";
  verdict?: "underpaid" | "fair" | "overpaid" | "outlier_high" | "unverified";
  market_range_lpa?: { min: number; median: number; max: number };
  user_ctc_lpa?: number;
  delta_pct?: number;            // (user - median) / median * 100
  percentile?: number;           // estimated percentile within the role/city
  headline?: string;             // 1-line diplomatic verdict
  rationale?: string[];          // 2-3 short evidence bullets
  next_steps?: string[];         // 2-3 specific actions
  data_confidence?: "high" | "medium" | "low";
  citations?: Array<{ title: string; url: string }>;
  sample_count?: number;
}

async function getCache(supabase: any, key: string) {
  try {
    const { data } = await supabase.from("enrichment_cache").select("data, cached_at").eq("cache_key", key).single();
    if (data && Date.now() - new Date(data.cached_at).getTime() < CACHE_TTL_MS) return data.data;
  } catch { /* miss */ }
  return null;
}
async function setCache(supabase: any, key: string, data: any) {
  try {
    await supabase.from("enrichment_cache").upsert(
      { cache_key: key, data, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );
  } catch { /* non-fatal */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;
    const { blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const body = (await req.json()) as SalaryFitInput;
    const userCtc = Number(body.user_ctc_lpa);
    const role = (body.role || "").trim();
    const industry = (body.industry || "").trim();
    const city = (body.city || "").trim();
    const metroTier = body.metro_tier === "tier2" ? "tier2" : "tier1";
    const expBand = (body.years_experience || "").trim();
    const country = (body.country || "IN").toUpperCase();
    const userSkills = Array.isArray(body.user_skills)
      ? body.user_skills.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 30)
      : [];

    // ── Input validation & abuse guard ─────────────────────────────────────
    if (!Number.isFinite(userCtc)) {
      return json({ status: "input_invalid", headline: "Please enter a valid number for your annual CTC." }, corsHeaders);
    }
    if (userCtc < MIN_REASONABLE_LPA) {
      return json({
        status: "input_invalid",
        headline: "That CTC seems unusually low — please enter your gross annual package in lakhs (e.g. 12 for ₹12L).",
      }, corsHeaders);
    }
    if (userCtc > MAX_REASONABLE_LPA) {
      // Don't accuse — just neutralize. Could be a typo (50000 vs 50.0).
      return json({
        status: "ok",
        verdict: "outlier_high",
        user_ctc_lpa: userCtc,
        headline: "That figure is well outside any benchmark we can verify.",
        rationale: [
          "Public market data tops out around ₹10–15Cr/year for the highest-paid Indian executives.",
          "If you meant lakhs (e.g. 50 = ₹50L), please re-enter without trailing zeros.",
        ],
        next_steps: [
          "Re-enter your CTC in lakhs per annum (e.g. 18.5 for ₹18.5L).",
          "If accurate, your comp is in founder/C-suite territory — public benchmarks won't apply.",
        ],
        data_confidence: "low",
      }, corsHeaders);
    }
    if (!role && !industry) {
      return json({
        status: "input_invalid",
        headline: "We need your role or industry to benchmark — try uploading your resume first.",
      }, corsHeaders);
    }

    const supabase = createAdminClient();
    // Cache key intentionally excludes user CTC — we cache the market range, then compute verdict per-user.
    // Use explicit separators to avoid empty-field collisions.
    const norm = (s: string) => (s || "_").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const marketKey = `sf|${norm(role)}|${norm(industry)}|${norm(city)}|${metroTier}|${norm(expBand)}|${country}`;
    let market = await getCache(supabase, marketKey);

    if (!market) {
      market = await fetchMarket(role || industry, industry, city, metroTier, expBand, country);
      if (market) await setCache(supabase, marketKey, market);
    }

    if (!market || !market.market_range_lpa) {
      return json({
        status: "no_data",
        user_ctc_lpa: userCtc,
        headline: "We couldn't find enough live data to benchmark this role yet.",
        rationale: ["Try broadening the role title or check back in a few days."],
        data_confidence: "low",
      }, corsHeaders);
    }

    const result = computeVerdict(userCtc, market, { role, industry, expBand, userSkills });
    return json(result, corsHeaders);
  } catch (e) {
    console.error("[salary-fit] error", e);
    return json({ status: "no_data", headline: "Something went wrong. Please try again." }, corsHeaders, 500);
  }
});

function json(payload: any, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Fetch market range from Adzuna + Tavily, synthesize via Gemini ──────────
async function fetchMarket(
  role: string, industry: string, city: string, metroTier: string, expBand: string, country: string,
) {
  const ADZUNA_API_ID = Deno.env.get("ADZUNA_API_ID");
  const ADZUNA_API_KEY = Deno.env.get("ADZUNA_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const cityHint = city || (metroTier === "tier1" ? "Bangalore Mumbai Delhi" : "tier-2 cities India");

  // Run Adzuna + Tavily in parallel
  const [adzuna, tavily] = await Promise.all([
    (ADZUNA_API_ID && ADZUNA_API_KEY)
      ? fetchAdzunaSalaryForRole(role, { apiId: ADZUNA_API_ID, apiKey: ADZUNA_API_KEY }).catch(() => null)
      : Promise.resolve(null),
    tavilySearch({
      query: `"${role}" salary range LPA ${expBand} years experience ${cityHint} ${industry} India 2025 2026`,
      maxResults: 6,
      days: 60,
      topic: "general",
    }).catch(() => null),
  ]);

  const tavilyContext = (tavily?.results || [])
    .map((r: any) => `${r.title || ""}: ${(r.content || "").slice(0, 400)}`)
    .join("\n\n");
  const adzunaSummary = adzuna && adzuna.salary_source === "adzuna_live"
    ? `Adzuna live postings (n=${adzuna.sample_count}): median ${adzuna.median_salary_inr ? "₹" + Math.round(adzuna.median_salary_inr / 100000) + "L" : "n/a"} · range ${adzuna.avg_salary_inr || "n/a"}`
    : "No Adzuna data available.";

  if (!tavilyContext && !adzuna?.median_salary_inr) return null;

  const prompt = `You are an Indian salary benchmarking analyst. Output ONLY valid JSON.

Role: "${role}"
Industry: ${industry || "general"}
City: ${city || "(not specified)"} (tier: ${metroTier})
Experience: ${expBand || "not specified"}
Country: ${country}

LIVE DATA SOURCES:
${adzunaSummary}

TAVILY WEB GROUNDING:
${tavilyContext.slice(0, 6000)}

TASK: Estimate the realistic gross annual CTC range in lakhs per annum (LPA) for THIS role at THIS experience in THIS city. Cross-check Adzuna with Tavily. Be conservative — when ranges conflict, use the median of medians.

Output JSON exactly:
{
  "market_range_lpa": { "min": number, "median": number, "max": number },
  "data_confidence": "high" | "medium" | "low",
  "evidence": [string],         // 2-3 short bullets, each citing a source domain
  "in_demand_skills": [string]  // up to 4 skills employers in this role are paying a premium for, from the data
}

Rules:
- min/median/max in LPA (lakhs per annum), e.g. 18 not 1800000
- "high" only if Adzuna AND Tavily agree within 25%
- "medium" if one source is solid, other is partial
- "low" if data is sparse or city/seniority unclear
- in_demand_skills: ONLY skills explicitly mentioned in the data; empty array if none found.`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    const r = parsed.market_range_lpa;
    if (!r || !Number.isFinite(r.min) || !Number.isFinite(r.median) || !Number.isFinite(r.max)) return null;
    if (r.min <= 0 || r.max < r.min) return null;
    // Sanity: median should sit between min and max. If not, clamp.
    const safeMedian = Math.min(Math.max(r.median, r.min), r.max);

    const citations = (tavily?.results || []).slice(0, 4).map((x: any) => ({
      title: (x.title || "").slice(0, 90),
      url: x.url || "",
    })).filter((c: any) => c.url);

    return {
      market_range_lpa: { min: round1(r.min), median: round1(safeMedian), max: round1(r.max) },
      data_confidence: parsed.data_confidence || "medium",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 3) : [],
      in_demand_skills: Array.isArray(parsed.in_demand_skills)
        ? parsed.in_demand_skills.filter((s: any) => typeof s === "string").slice(0, 4)
        : [],
      citations,
      sample_count: adzuna?.sample_count || (tavily?.results?.length ?? 0),
    };
  } catch (e) {
    console.warn("[salary-fit] AI synthesis failed", e);
    return null;
  }
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Verdict logic — diplomatic + actionable ─────────────────────────────────
function computeVerdict(
  userCtc: number,
  market: any,
  ctx: { role: string; industry: string; expBand: string; userSkills: string[] },
): SalaryFitResult {
  const { min, median, max } = market.market_range_lpa;
  const deltaPct = Math.round(((userCtc - median) / median) * 100);
  const percentile = estimatePercentile(userCtc, min, median, max);

  let verdict: SalaryFitResult["verdict"];
  let headline: string;
  const rationale: string[] = [...(market.evidence || [])];
  const nextSteps: string[] = [];

  // Branches are mutually exclusive — order matters.
  if (userCtc > max * 1.5) {
    // Way above market — could be founder, ESOP-loaded, or input error. Stay neutral.
    verdict = "outlier_high";
    headline = `You're significantly above any public benchmark for this role.`;
    rationale.push(`Market ceiling we found: ₹${max}L. You're at ₹${userCtc}L.`);
    nextSteps.push("If your comp includes ESOPs/RSUs, public benchmarks under-count — ignore this view.");
    nextSteps.push("If this is base only, you're in the top 1% — focus on retention, not negotiation.");
  } else if (deltaPct <= -25) {
    verdict = "underpaid";
    const gap = Math.round((median - userCtc) * 10) / 10;
    headline = `You're roughly ${Math.abs(deltaPct)}% below the market median for this role.`;
    rationale.push(`Median for similar profiles: ₹${median}L · You're at ₹${userCtc}L (gap of ~₹${gap}L).`);
    nextSteps.push(`Anchor your next conversation at ₹${Math.round(median)}–${Math.round(max)}L based on the upper band.`);
    nextSteps.push("Document 2-3 outcomes from the last 12 months with specific numbers before the conversation.");
    nextSteps.push("If internal raise is blocked, the gap is large enough that a market move likely closes it.");
  } else if (deltaPct >= 25) {
    verdict = "overpaid";
    headline = `You're around ${deltaPct}% above the market median — strong position.`;
    rationale.push(`Median for similar profiles: ₹${median}L · You're at ₹${userCtc}L.`);
    nextSteps.push("Protect this position: make your impact visible to skip-level and adjacent teams.");
    nextSteps.push("Avoid lateral moves at the same band — most external offers will down-level you.");
    nextSteps.push("Use the premium to invest in skills that compound (people management, AI fluency, P&L exposure).");
  } else {
    verdict = "fair";
    const sign = deltaPct >= 0 ? "+" : "";
    headline = `You're within the fair band for this role (${sign}${deltaPct}% vs median).`;
    rationale.push(`Median: ₹${median}L · Range: ₹${min}–${max}L · You're at ₹${userCtc}L.`);

    // Skill-aware action: if we know what the market wants, tell them what they're missing.
    const inDemand = (market.in_demand_skills || []) as string[];
    if (inDemand.length > 0 && ctx.userSkills.length > 0) {
      const userSet = new Set(ctx.userSkills.map((s) => s.toLowerCase()));
      const missing = inDemand.filter((s) => !userSet.has(s.toLowerCase())).slice(0, 2);
      if (missing.length > 0) {
        nextSteps.push(`To push toward the upper band (₹${max}L), close the gap on: ${missing.join(", ")}.`);
      } else {
        nextSteps.push(`Your skill mix already matches what employers want — focus on visible outcomes for upper-band negotiations.`);
      }
    } else {
      nextSteps.push(`To push toward the upper band (₹${max}L), close the gap on 1-2 high-leverage skills employers are paying premiums for right now.`);
    }
    nextSteps.push("Reassess in 6 months — your role's market range is shifting fast in the AI-augmentation cycle.");
  }

  return {
    status: "ok",
    verdict,
    market_range_lpa: market.market_range_lpa,
    user_ctc_lpa: userCtc,
    delta_pct: deltaPct,
    percentile,
    headline,
    rationale: rationale.slice(0, 4),
    next_steps: nextSteps,
    data_confidence: market.data_confidence,
    citations: market.citations,
    sample_count: market.sample_count,
  };
}

function estimatePercentile(ctc: number, min: number, median: number, max: number): number {
  if (ctc <= min) return 10;
  if (ctc >= max) return 95;
  if (ctc < median) {
    // 10th–50th percentile range
    return Math.round(10 + ((ctc - min) / (median - min)) * 40);
  }
  // 50th–95th percentile range
  return Math.round(50 + ((ctc - median) / (max - median)) * 45);
}
