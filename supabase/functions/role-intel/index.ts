import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";

interface RoleIntelSignal {
  id: string;
  headline: string;
  summary: string;
  relevance_score: number;
  relevance_reason: string;
  signal_type: 'company' | 'market' | 'skill_threat' | 'opportunity' | 'salary';
  action_prompt?: string;
  source_url?: string;
  published_at: string;
  stale?: boolean;
  fallback?: boolean;
}

interface RoleIntelRequest {
  role: string;
  industry: string;
  company?: string;
  skills?: string[];
  city?: string;
  score?: number;
}

interface RoleIntelResponse {
  signals: RoleIntelSignal[];
  isStale: boolean;
  isFallback: boolean;
  fetchedAt: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const body = await req.json() as RoleIntelRequest;
    const { role, industry, company, skills = [], city } = body;

    // Validate required fields
    if (!role || !industry) {
      return new Response(
        JSON.stringify({ error: "role and industry are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build cache key
    const cacheKey = `role-intel:${role.toLowerCase().trim()}:${industry.toLowerCase().trim()}:${(company || '').toLowerCase().trim()}:${(city || '').toLowerCase().trim()}`;

    const supabase = createAdminClient();

    // Check cache
    const { data: cachedData } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();

    if (cachedData) {
      const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
      if (cacheAge < CACHE_TTL_MS) {
        const cachedResult = cachedData.data as RoleIntelResponse;
        return new Response(
          JSON.stringify(cachedResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Run Tavily searches in parallel
    const [tavily1, tavily2] = await Promise.all([
      tavilySearch({
        query: `${company || industry} AI automation hiring ${role} ${city || 'India'} 2025 2026`,
        maxResults: 5,
        days: 30,
        topic: "news",
        includeAnswer: true,
      }),
      tavilySearch({
        query: `${role} salary demand jobs ${city || 'India'} ${industry} hiring trends`,
        maxResults: 5,
        days: 30,
        topic: "news",
        includeAnswer: true,
      }),
    ]);

    // Query skill_risk_matrix for fallback
    const skillsToQuery = skills.length > 0 ? skills.slice(0, 5) : [];
    let dbSkills: any[] = [];
    if (skillsToQuery.length > 0) {
      const { data } = await supabase
        .from("skill_risk_matrix")
        .select("skill_name, automation_risk, replacement_tools")
        .in("skill_name", skillsToQuery)
        .limit(5);
      dbSkills = data || [];
    } else {
      // Default skills by role
      const defaultSkillsByRole: Record<string, string[]> = {
        'developer': ['Python', 'JavaScript', 'SQL'],
        'analyst': ['Excel', 'SQL', 'Data visualization'],
        'manager': ['Strategic planning', 'Team leadership', 'Communication'],
        'engineer': ['System design', 'Problem solving', 'Technical leadership'],
        'marketer': ['Digital marketing', 'Data analysis', 'Content creation'],
      };
      const roleKeyword = Object.keys(defaultSkillsByRole).find(k => role.toLowerCase().includes(k)) || 'developer';
      const { data } = await supabase
        .from("skill_risk_matrix")
        .select("skill_name, automation_risk, replacement_tools")
        .in("skill_name", defaultSkillsByRole[roleKeyword])
        .limit(5);
      dbSkills = data || [];
    }

    // Build signals from Tavily results
    const allSignals: RoleIntelSignal[] = [];
    const processedUrls = new Set<string>();

    const processResults = (results: any[], searchType: 'hiring' | 'salary') => {
      if (!results) return;
      results.forEach((result) => {
        if (processedUrls.has(result.url)) return;
        processedUrls.add(result.url);

        const relevanceScore = computeRelevanceScore(
          result,
          role,
          company,
          city,
          skills
        );

        if (relevanceScore < 20) return;

        const signal = buildSignal(
          result,
          relevanceScore,
          searchType,
          role,
          company
        );
        allSignals.push(signal);
      });
    };

    if (tavily1?.results) processResults(tavily1.results, 'hiring');
    if (tavily2?.results) processResults(tavily2.results, 'salary');

    // Sort by relevance
    allSignals.sort((a, b) => b.relevance_score - a.relevance_score);

    // Determine if we need fallback
    let isFallback = false;
    let isStale = false;
    let finalSignals = allSignals;

    if (allSignals.length === 0) {
      // Try stale cache
      if (cachedData) {
        isStale = true;
        finalSignals = (cachedData.data as RoleIntelResponse).signals.map(s => ({
          ...s,
          stale: true
        }));
      } else if (dbSkills.length > 0) {
        // Generate fallback signals from skill_risk_matrix
        isFallback = true;
        finalSignals = dbSkills.map((skill, idx) => ({
          id: crypto.randomUUID(),
          headline: `${skill.skill_name} at ${skill.automation_risk}% automation risk`,
          summary: `AI tools increasingly handle this skill category. Risk level: ${skill.automation_risk}%`,
          relevance_score: 50 - idx * 5,
          relevance_reason: `Directly affects your ${skill.skill_name} capabilities`,
          signal_type: 'skill_threat' as const,
          published_at: new Date().toISOString(),
          fallback: true,
        }));
      }
    }

    // Cache the response
    const response: RoleIntelResponse = {
      signals: finalSignals,
      isStale,
      isFallback,
      fetchedAt: new Date().toISOString(),
    };

    await supabase
      .from("enrichment_cache")
      .upsert({
        cache_key: cacheKey,
        data: response,
        cached_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[role-intel] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function computeRelevanceScore(
  result: any,
  role: string,
  company: string | undefined,
  city: string | undefined,
  skills: string[]
): number {
  let score = 0;
  const text = (result.title + " " + result.content).toLowerCase();

  // Role mention: +30
  if (text.includes(role.toLowerCase())) score += 30;

  // Company mention: +25
  if (company && text.includes(company.toLowerCase())) score += 25;

  // City mention: +15
  if (city && text.includes(city.toLowerCase())) score += 15;

  // Skill mention: +20
  for (const skill of skills) {
    if (text.includes(skill.toLowerCase())) {
      score += 20;
      break;
    }
  }

  // Recency (last 30 days): +10
  // Simple heuristic: if mentions recent dates or "2026" or "2025"
  if (text.includes("2026") || text.includes("2025") || text.includes("january") ||
      text.includes("february") || text.includes("march")) {
    score += 10;
  }

  return Math.min(score, 100);
}

function buildSignal(
  result: any,
  relevanceScore: number,
  searchType: 'hiring' | 'salary',
  role: string,
  company: string | undefined
): RoleIntelSignal {
  const baseReasons: Record<string, string> = {
    'hiring': `New hiring activity affecting ${role} professionals`,
    'salary': `Salary trends for ${role}${company ? ` at ${company}` : ''}`,
  };

  const signalTypes: Record<string, RoleIntelSignal['signal_type']> = {
    'hiring': 'opportunity',
    'salary': 'salary',
  };

  return {
    id: crypto.randomUUID(),
    headline: result.title || "Market Update",
    summary: (result.content || "").slice(0, 150) + "...",
    relevance_score: relevanceScore,
    relevance_reason: baseReasons[searchType],
    signal_type: signalTypes[searchType],
    source_url: result.url,
    published_at: new Date().toISOString(),
  };
}
