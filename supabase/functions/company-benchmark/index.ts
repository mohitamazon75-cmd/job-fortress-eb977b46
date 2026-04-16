
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";

// In-memory cache per isolate — 5 min TTL
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Map roles to relevant industries for benchmark lookup
const ROLE_INDUSTRY_MAP: Record<string, string[]> = {
  'developer': ['IT & Software'],
  'engineer': ['IT & Software'],
  'software': ['IT & Software'],
  'devops': ['IT & Software'],
  'data': ['IT & Software', 'Finance & Banking'],
  'cloud': ['IT & Software'],
  'architect': ['IT & Software'],
  'frontend': ['IT & Software'],
  'backend': ['IT & Software'],
  'full stack': ['IT & Software'],
  'product': ['IT & Software'],
  'qa': ['IT & Software'],
  'tester': ['IT & Software'],
  'tech': ['IT & Software'],
  'it': ['IT & Software'],
  'cyber': ['IT & Software'],
  'ml': ['IT & Software'],
  'ai': ['IT & Software'],
  'finance': ['Finance & Banking'],
  'account': ['Finance & Banking'],
  'bank': ['Finance & Banking'],
  'audit': ['Finance & Banking'],
  'analyst': ['Finance & Banking', 'IT & Software'],
  'ca': ['Finance & Banking'],
  'risk': ['Finance & Banking'],
  'market': ['Marketing & Advertising'],
  'brand': ['Marketing & Advertising'],
  'content': ['Marketing & Advertising'],
  'seo': ['Marketing & Advertising'],
  'social media': ['Marketing & Advertising'],
  'copywrite': ['Marketing & Advertising'],
  'digital': ['Marketing & Advertising'],
  'doctor': ['Healthcare'],
  'nurse': ['Healthcare'],
  'pharma': ['Healthcare'],
  'health': ['Healthcare'],
  'medical': ['Healthcare'],
  'design': ['Creative & Design', 'IT & Software'],
  'creative': ['Creative & Design'],
  'ui': ['Creative & Design', 'IT & Software'],
  'ux': ['Creative & Design', 'IT & Software'],
  'graphic': ['Creative & Design'],
  'teach': ['Education'],
  'professor': ['Education'],
  'education': ['Education'],
  'trainer': ['Education'],
  'manufactur': ['Manufacturing'],
  'mechanical': ['Manufacturing'],
  'production': ['Manufacturing'],
  'civil': ['Manufacturing'],
  'sales': ['Finance & Banking', 'IT & Software'],
  'consult': ['IT & Software', 'Finance & Banking'],
  'hr': ['IT & Software', 'Finance & Banking'],
  'recruit': ['IT & Software'],
};

function inferIndustriesFromRole(role: string): string[] {
  if (!role) return [];
  const lower = role.toLowerCase();
  const matched = new Set<string>();
  for (const [keyword, industries] of Object.entries(ROLE_INDUSTRY_MAP)) {
    if (lower.includes(keyword)) {
      for (const ind of industries) matched.add(ind);
    }
  }
  return Array.from(matched);
}

const SENIOR_KEYWORDS = ['lead', 'senior', 'manager', 'director', 'head', 'chief', 'vp', 'president', 'principal', 'architect', 'strategist', 'partner'];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;

    const url = new URL(req.url);
    const company = url.searchParams.get("company");
    const industry = url.searchParams.get("industry");
    const role = url.searchParams.get("role");

    // Cache check
    const cacheKey = `bench_${company}_${industry}_${role}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();

    const roleNormalized = (role || '').toLowerCase().replace(/[_-]/g, ' ');
    const isSenior = SENIOR_KEYWORDS.some(kw => roleNormalized.includes(kw));

    if (company) {
      const { data: benchmarks } = await supabase
        .from("company_benchmarks")
        .select("*")
        .ilike("company_name", `%${company}%`)
        .limit(5);

      if (!benchmarks || benchmarks.length === 0) {
        return new Response(
          JSON.stringify({ error: "Company not found", suggestion: "Try TCS, Infosys, or Wipro" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const match = benchmarks[0];

      // Use indexed query for industry avg
      const { data: industryData } = await supabase
        .from("company_benchmarks")
        .select("avg_fate_score, company_name, risk_tier")
        .eq("industry", match.industry)
        .order("avg_fate_score", { ascending: false });

      const allIndustry = industryData || [];
      const industryAvg = allIndustry.reduce((s: number, d: any) => s + Number(d.avg_fate_score), 0) / (allIndustry.length || 1);
      const rank = allIndustry.findIndex((r: any) => r.company_name === match.company_name) + 1;

      const baseVerdict = Number(match.avg_fate_score) >= 65
        ? "HIGH RISK — employees should upskill now"
        : Number(match.avg_fate_score) >= 50
        ? "MODERATE RISK — selective disruption expected"
        : "LOWER RISK — but stay vigilant";

      const result = {
        company: match.company_name,
        industry: match.industry,
        avg_fate_score: Number(match.avg_fate_score),
        assessment_count: match.assessment_count,
        risk_tier: match.risk_tier,
        industry_avg: Math.round(industryAvg * 10) / 10,
        rank_in_industry: rank,
        total_in_industry: allIndustry.length,
        verdict: baseVerdict,
        seniority_context: isSenior ? 'senior' : 'standard',
        peers: allIndustry.slice(0, 5).map((r: any) => ({
          company: r.company_name,
          score: Number(r.avg_fate_score),
        })),
      };

      cache.set(cacheKey, { data: result, ts: Date.now() });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    }

    // ═══ LIST MODE ═══
    const roleIndustries = inferIndustriesFromRole(role || '');
    const targetIndustries: string[] = [];
    if (industry && industry !== 'Other') targetIndustries.push(industry);
    for (const ri of roleIndustries) {
      if (!targetIndustries.includes(ri)) targetIndustries.push(ri);
    }

    const showAll = targetIndustries.length === 0;

    let query = supabase
      .from("company_benchmarks")
      .select("*")
      .order("avg_fate_score", { ascending: false });

    if (!showAll && targetIndustries.length > 0) {
      query = query.in("industry", targetIndustries);
    }

    const { data: companies } = await query;

    const mappedCompanies = (companies || []).map((c: any) => ({
      company: c.company_name,
      industry: c.industry,
      avg_fate_score: Number(c.avg_fate_score),
      assessment_count: c.assessment_count,
      risk_tier: c.risk_tier,
    }));

    mappedCompanies.sort((a: any, b: any) => b.avg_fate_score - a.avg_fate_score);

    const result = {
      companies: mappedCompanies,
      total: mappedCompanies.length,
      role_context: role || null,
      seniority: isSenior ? 'senior' : 'standard',
      industries_matched: showAll ? ['All'] : targetIndustries,
    };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("Benchmark error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
