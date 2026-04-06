import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch, buildSearchContext } from "../_shared/tavily-search.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

// In-memory cache (per isolate) — 5 min TTL
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    // Panic index is a public market-data endpoint — anon key is sufficient.
    // JWT validation is skipped; guardRequest already validates the bearer token format.

    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const city = url.searchParams.get("city") || "all";
    const industry = url.searchParams.get("industry");

    // Cache check
    const cacheKey = `panic_${industry}_${role}_${city}`.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Map industry to relevant job families for contextual results
    const INDUSTRY_ROLES: Record<string, string[]> = {
      'IT & Software': ['frontend_developer', 'backend_developer', 'data_analyst', 'ml_engineer', 'devops_engineer', 'qa_tester', 'cloud_architect', 'data_engineer', 'data_entry_operator', 'full_stack_developer'],
      'Marketing & Advertising': ['digital_marketer', 'content_writer', 'graphic_designer', 'brand_manager', 'seo_specialist', 'social_media_manager', 'copywriter'],
      'Finance & Banking': ['financial_analyst', 'accountant', 'chartered_accountant', 'bank_teller', 'insurance_underwriter', 'loan_officer', 'risk_analyst'],
      'Healthcare': ['doctor', 'nurse', 'pharmacist', 'lab_technician', 'medical_coder'],
      'Manufacturing': ['mechanical_engineer', 'civil_engineer', 'production_supervisor', 'quality_inspector'],
      'Creative & Design': ['graphic_designer', 'ui_ux_designer', 'content_writer', 'video_editor', 'animator'],
      'Education': ['teacher', 'academic_counselor', 'curriculum_designer'],
    };

    // ═══ SENIORITY-AWARE ROLE TIERING ═══
    // Classify roles into tiers so a COO never sees "Bank Teller" trends
    const ROLE_TIERS: Record<string, string[]> = {
      executive: ['coo', 'ceo', 'cto', 'cfo', 'cmo', 'cio', 'cpo', 'chief', 'president', 'founder', 'co-founder', 'managing_director', 'md'],
      senior_leadership: ['vp', 'vice_president', 'svp', 'evp', 'avp', 'director', 'head', 'general_manager', 'gm'],
      management: ['manager', 'lead', 'principal', 'senior', 'team_lead', 'supervisor', 'sr'],
      professional: ['engineer', 'developer', 'analyst', 'designer', 'consultant', 'architect', 'strategist', 'specialist'],
      entry: ['data_entry_operator', 'bank_teller', 'receptionist', 'office_assistant', 'typist', 'filing_clerk', 'cashier', 'peon', 'helper', 'intern', 'trainee', 'fresher', 'junior'],
    };

    // Role families that are inherently entry/clerical level regardless of title
    const INHERENTLY_ENTRY_FAMILIES = new Set([
      'data_entry_operator', 'bank_teller', 'receptionist', 'office_assistant',
      'typist', 'filing_clerk', 'cashier', 'peon', 'helper',
    ]);

    // Role families that are inherently leadership/strategic level
    const INHERENTLY_SENIOR_FAMILIES = new Set([
      'cloud_architect', 'ml_engineer', 'data_engineer', 'devops_engineer',
      'brand_manager', 'risk_analyst', 'financial_analyst', 'chartered_accountant',
    ]);

    const userRoleNormalized = (role || '').toLowerCase().replace(/[_-]/g, ' ');
    
    // Determine user's seniority tier
    let userTier = 'professional'; // default
    for (const [tier, keywords] of Object.entries(ROLE_TIERS)) {
      if (keywords.some(kw => userRoleNormalized.includes(kw))) {
        userTier = tier;
        break;
      }
    }

    // Minimum tier level: executive=4, senior_leadership=3, management=2, professional=1, entry=0
    const TIER_LEVELS: Record<string, number> = { executive: 4, senior_leadership: 3, management: 2, professional: 1, entry: 0 };
    const userTierLevel = TIER_LEVELS[userTier] ?? 1;

    // ═══ PARALLEL: DB signals + Tavily live search ═══
    const relevantFamilies = industry ? (INDUSTRY_ROLES[industry] || []) : [];

    // Run DB query and Tavily search in parallel
    let signalsQuery = supabase.from("market_signals").select("*");
    if (relevantFamilies.length > 0) {
      signalsQuery = signalsQuery.in("job_family", relevantFamilies);
    }

    const primaryRole = (role || '').split(/[,&\/]+/)[0].trim() || 'professional';

    const [dbResult, overallStatsResult, tavilyResult] = await Promise.all([
      signalsQuery,
      supabase.rpc("get_panic_overview").single(),
      // Tavily live search for real-time market pulse
      tavilySearch({
        query: `${primaryRole} ${industry || 'technology'} India AI automation layoffs hiring salary trends 2026`,
        maxResults: 6,
        days: 14,
        topic: "news",
        includeAnswer: true,
      }),
    ]);

    // Synthesize Tavily results via LLM
    let liveInsights: any = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (tavilyResult && LOVABLE_API_KEY) {
      try {
        const context = buildSearchContext(tavilyResult.results, 8);
        const answer = tavilyResult.answer || "";
        const aiCtrl = new AbortController();
        const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an Indian job market intelligence analyst. Return ONLY valid JSON, no markdown. Provide hyper-personalized intelligence for a "${primaryRole}" professional in ${industry || 'technology'} in India.

Return JSON:
{
  "personalized_articles": [
    {
      "title": string (max 100 chars),
      "summary": string (2-3 sentences),
      "source": string,
      "date": string (relative like "2 days ago"),
      "impact": "high" | "medium" | "low",
      "category": "layoffs" | "ai_adoption" | "hiring" | "salary" | "policy" | "skills"
    }
  ] (5-6 articles),
  "live_sentiment": "panic" | "cautious" | "stable" | "optimistic",
  "ai_replacement_evidence": string,
  "hiring_pulse": string,
  "salary_direction": "declining" | "flat" | "rising",
  "most_threatened_task": string,
  "key_insight": string
}`
              },
              {
                role: "user",
                content: `Based on these search results, what are the latest developments affecting ${primaryRole} professionals in ${industry || 'technology'} in India?\n\n${context}\n\nSummary: ${answer}`
              }
            ],
            temperature: 0.1,
          }),
          signal: aiCtrl.signal,
        });
        clearTimeout(aiT);

        if (resp.ok) {
          const data = await resp.json();
          logTokenUsage("panic-index", null, "google/gemini-3-flash-preview", data);
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const citations = tavilyResult.results.map(r => r.url).filter(Boolean);
            liveInsights = { ...JSON.parse(jsonStr), citations };
          }
        } else {
          console.error(`[panic-index] LLM synthesis failed: ${resp.status}`);
        }
      } catch (e) {
        console.error("[panic-index] Tavily synthesis error:", e);
      }
    }

    const { data: filteredSignals } = dbResult;
    const effectiveSignals = filteredSignals || [];
    const overallStats = overallStatsResult?.data;

    if (effectiveSignals.length === 0 && !liveInsights) {
      const result = {
        panic_level: "low",
        jobs_at_risk_this_week: 0,
        trend: "stable",
        message: "No market data available",
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate from filtered signals
    const totalPostings = effectiveSignals.reduce(
      (s: number, m: any) => s + (m.posting_volume_proxy || m.posting_volume_30d || 0), 0
    );
    const avgChange = effectiveSignals.reduce(
      (s: number, m: any) => s + Number(m.posting_change_pct || 0), 0
    ) / effectiveSignals.length;
    const avgAiMentions = effectiveSignals.reduce(
      (s: number, m: any) => s + Number(m.ai_job_mentions_pct || 0), 0
    ) / effectiveSignals.length;

    const jobsLostThisWeek = Math.abs(Math.min(0, avgChange)) * totalPostings / 400;

    let panicLevel: string;
    let trend: string;
    if (avgChange < -25) { panicLevel = "critical"; trend = "accelerating"; }
    else if (avgChange < -15) { panicLevel = "high"; trend = "accelerating"; }
    else if (avgChange < -5) { panicLevel = "moderate"; trend = "declining"; }
    else if (avgChange > 10) { panicLevel = "low"; trend = "growing"; }
    else { panicLevel = "low"; trend = "stable"; }

    // ═══ SMART SENIORITY FILTERING ═══
    // Filter signals to only show roles relevant to user's tier
    const seniorFiltered = effectiveSignals.filter((s: any) => {
      const family = s.job_family?.toLowerCase() || '';
      
      // Executive/senior users (tier >= 2): NEVER show entry-level roles
      if (userTierLevel >= 2 && INHERENTLY_ENTRY_FAMILIES.has(family)) return false;
      
      // Entry-level users: don't show senior-only roles
      if (userTierLevel === 0 && INHERENTLY_SENIOR_FAMILIES.has(family)) return false;
      
      return true;
    });

    // Deduplicate declining roles by job_family (DB may have multiple metro_tier entries)
    const userRoleFamily = userRoleNormalized.replace(/ /g, '_');

    // Aggregate signals by job_family (combine across metro tiers)
    const familyAgg = new Map<string, { totalChange: number; totalAi: number; count: number; health: string }>();
    for (const s of seniorFiltered) {
      const f = s.job_family;
      const existing = familyAgg.get(f);
      if (existing) {
        existing.totalChange += Number(s.posting_change_pct || 0);
        existing.totalAi += Number(s.ai_job_mentions_pct || 0);
        existing.count++;
      } else {
        familyAgg.set(f, {
          totalChange: Number(s.posting_change_pct || 0),
          totalAi: Number(s.ai_job_mentions_pct || 0),
          count: 1,
          health: s.market_health,
        });
      }
    }

    const aggregatedFamilies = Array.from(familyAgg.entries()).map(([family, agg]) => ({
      family,
      avgChange: agg.totalChange / agg.count,
      avgAi: agg.totalAi / agg.count,
      health: agg.health,
    }));

    const decliningRoles = aggregatedFamilies
      .filter(f => f.avgChange < -10)
      .sort((a, b) => {
        const aMatch = a.family === userRoleFamily ? -1000 : 0;
        const bMatch = b.family === userRoleFamily ? -1000 : 0;
        return (a.avgChange + aMatch) - (b.avgChange + bMatch);
      })
      .slice(0, 5)
      .map(f => ({
        role: f.family.replace(/_/g, " "),
        decline_pct: Math.round(f.avgChange * 10) / 10,
        ai_mentions: Math.round(f.avgAi),
        market_health: f.health,
      }));

    const growingRoles = aggregatedFamilies
      .filter(f => f.avgChange > 5)
      .sort((a, b) => b.avgChange - a.avgChange)
      .slice(0, 3)
      .map(f => ({
        role: f.family.replace(/_/g, " "),
        growth_pct: Math.round(f.avgChange * 10) / 10,
      }));

    // ═══ PERSONAL ROLE CONTEXT ═══
    // Rank families by composite risk score (decline severity + AI exposure)
    const familyRisks = aggregatedFamilies
      .map(f => ({
        family: f.family,
        risk: Math.abs(Math.min(0, f.avgChange)) + f.avgAi,
      }))
      .sort((a, b) => b.risk - a.risk);
    
    // Try to find user's role in the tracked families
    const userRankIndex = familyRisks.findIndex(r => r.family === userRoleFamily);
    const userFamilyData = aggregatedFamilies.find(f => f.family === userRoleFamily);
    
    const roleContext = userFamilyData ? {
      rank: userRankIndex + 1,
      total: familyRisks.length,
      percentile: Math.round((1 - (userRankIndex / familyRisks.length)) * 100),
      your_posting_change: Math.round(userFamilyData.avgChange * 10) / 10,
      your_ai_mentions: Math.round(userFamilyData.avgAi),
      your_market_health: userFamilyData.health,
    } : null;

    // Overall stats from filtered + aggregated data
    const totalRolesTracked = overallStats?.total_roles ?? aggregatedFamilies.length;
    const decliningCount = overallStats?.declining_roles ?? aggregatedFamilies.filter(f => f.health === "declining").length;
    const boomingCount = overallStats?.booming_roles ?? aggregatedFamilies.filter(f => f.health === "booming").length;

    const result = {
      panic_level: panicLevel,
      jobs_at_risk_this_week: Math.round(jobsLostThisWeek),
      trend,
      avg_posting_change: Math.round(avgChange * 10) / 10,
      avg_ai_mentions: Math.round(avgAiMentions),
      declining_roles: decliningRoles,
      growing_roles: growingRoles,
      industry_context: industry || 'All Industries',
      seniority_tier: userTier,
      role_context: roleContext,
      // Live Perplexity insights
      live_pulse: liveInsights ? {
        articles: liveInsights.personalized_articles || [],
        headlines: (liveInsights.personalized_articles || []).map((a: any) => a.title),
        sentiment: liveInsights.live_sentiment || null,
        ai_evidence: liveInsights.ai_replacement_evidence || null,
        hiring_pulse: liveInsights.hiring_pulse || null,
        salary_direction: liveInsights.salary_direction || null,
        most_threatened_task: liveInsights.most_threatened_task || null,
        key_insight: liveInsights.key_insight || null,
        citations: liveInsights.citations || [],
      } : null,
      overall: {
        total_roles_tracked: totalRolesTracked,
        roles_declining: decliningCount,
        roles_booming: boomingCount,
      },
      generated_at: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("Panic index error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
