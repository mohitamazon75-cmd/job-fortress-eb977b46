// ═══════════════════════════════════════════════════════════════
// Best-Fit Jobs — Real Job Listings Engine
// Uses Tavily to find ACTUAL job postings users can apply to,
// then AI ranks & annotates them by fit to the user's profile.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { AI_URL, FLASH_MODEL } from "../_shared/ai-agent-caller.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { checkDailySpending, buildSpendingBlockedResponse } from "../_shared/spending-guard.ts";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
  if (jwtBlocked) return jwtBlocked;

  // Spending guard
  const spendCheck = await checkDailySpending("best-fit-jobs");
  if (!spendCheck.allowed) return buildSpendingBlockedResponse(corsHeaders, spendCheck);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { role, industry, skills, moatSkills, seniority, country, determinismIndex } = body;
  if (!role || !industry) {
    return new Response(JSON.stringify({ error: "Missing role or industry" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();

  // Cache check
  const cacheKey = `bfj:${role}_${industry}_${(skills || []).slice(0, 5).join(",")}_${country || "IN"}`.toLowerCase().replace(/\s+/g, '_');
  try {
    const { data: cached } = await supabase
      .from("enrichment_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();
    if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS) {
      console.log(`[BestFitJobs] Cache hit for ${role}`);
      return new Response(JSON.stringify({ ...cached.data as object, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch { /* cache miss */ }

  console.log(`[BestFitJobs] Finding real jobs for ${role} in ${industry}, user ${userId}`);

  try {
    const skillList = (skills || []).slice(0, 8).join(", ");
    const regionTag = country === "IN" ? "India" : country || "global";
    const seniorityTag = seniority || "mid-level";

    // ═══ STEP 1: Search for REAL job postings across multiple angles ═══
    const jobBoardDomains = country === "IN" 
      ? ["naukri.com", "linkedin.com", "indeed.co.in", "instahyre.com", "foundit.in", "glassdoor.co.in"]
      : ["linkedin.com", "indeed.com", "glassdoor.com", "wellfound.com"];

    const [directJobs, pivotJobs, skillJobs] = await Promise.all([
      tavilySearch({
        query: `"${role}" OR "${role} jobs" hiring ${regionTag} 2025 2026 apply now`,
        searchDepth: "advanced",
        maxResults: 8,
        days: 30,
        topic: "general",
        includeDomains: jobBoardDomains,
      }),
      tavilySearch({
        query: `${industry} jobs hiring ${seniorityTag} AI-safe roles ${regionTag} 2025 apply`,
        searchDepth: "advanced",
        maxResults: 8,
        days: 30,
        topic: "general",
        includeDomains: jobBoardDomains,
      }),
      tavilySearch({
        query: `jobs requiring ${skillList} ${regionTag} hiring 2025 open positions apply`,
        searchDepth: "basic",
        maxResults: 6,
        days: 45,
        topic: "general",
      }),
    ]);

    // Deduplicate & compile raw listings — filter out generic search/listing pages
    const urlSeen = new Set<string>();
    const rawListings: { title: string; url: string; snippet: string; source: string }[] = [];

    /** Check if a URL points to a specific job posting vs a generic search page */
    const isSpecificJobUrl = (url: string): boolean => {
      try {
        const u = new URL(url);
        const path = u.pathname + u.search;
        // Naukri individual jobs have /job-listing- or /jobs-in- with jobId param or /job/
        if (u.hostname.includes("naukri.com")) {
          return /\/job-listing|\/job\/|jobId=|\/jobs\/\d/.test(path);
        }
        // LinkedIn individual jobs have /jobs/view/ or /jobs/\d+
        if (u.hostname.includes("linkedin.com")) {
          return /\/jobs\/view\/|\/jobs\/\d+/.test(path);
        }
        // Indeed individual jobs have /viewjob or /rc/clk or jk= param
        if (u.hostname.includes("indeed")) {
          return /\/viewjob|\/rc\/clk|[?&]jk=/.test(path);
        }
        // Glassdoor individual jobs have /job-listing/
        if (u.hostname.includes("glassdoor")) {
          return /\/job-listing\/|\/Jobs\/.*-SRCH/.test(path);
        }
        // For other domains, assume specific if URL path is deep enough
        return u.pathname.split("/").filter(Boolean).length >= 3;
      } catch {
        return true; // if URL parsing fails, keep it
      }
    };

    const addResults = (results: any, source: string) => {
      for (const r of results?.results || []) {
        if (!r.url || urlSeen.has(r.url)) continue;
        urlSeen.add(r.url);
        rawListings.push({
          title: r.title || "",
          url: r.url,
          snippet: (r.content || "").slice(0, 400),
          source,
          isSpecific: isSpecificJobUrl(r.url),
        } as any);
      }
    };
    addResults(directJobs, "direct");
    addResults(pivotJobs, "pivot");
    addResults(skillJobs, "skill-match");

    // Sort: specific job URLs first, then generic ones
    rawListings.sort((a, b) => ((b as any).isSpecific ? 1 : 0) - ((a as any).isSpecific ? 1 : 0));

    console.log(`[BestFitJobs] Found ${rawListings.length} raw listings`);

    if (rawListings.length === 0) {
      return new Response(JSON.stringify({
        jobs: [],
        market_insight: "No live job postings found matching your profile. Try again in a few hours as new listings appear constantly.",
        sources: [],
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ STEP 2: AI ranks & annotates the real listings ═══
    const listingsContext = rawListings.slice(0, 18).map((l, i) =>
      `[${i}] TITLE: ${l.title}\nURL: ${l.url}\nSNIPPET: ${l.snippet}\nSOURCE_TYPE: ${l.source}`
    ).join("\n\n");

    const systemPrompt = `You are an elite career advisor. Given REAL job listings scraped from job boards, select and rank the TOP 8 most relevant jobs for you based on your profile.

ADDRESSATION: Address the user as "you" throughout. NEVER use "this professional". For every numerical claim, cite the source.

ABSOLUTE RULES (zero hallucination):
- Only include jobs that are REAL postings (not articles, not guides, not "top jobs" listicles)
- Extract the actual company name and job title from the listing
- Calculate a skill_match_pct based on how many of the person's skills match the job requirements
- Determine if the role is AI-safe (human judgment, creativity, leadership roles score higher)
- SALARY: Return null UNLESS the snippet contains an explicit ₹/INR/LPA/lakh/crore figure. NEVER estimate, infer, guess, or fabricate ranges. NEVER use phrases like "estimated", "typical", "market rate", "around". If unsure → null.
- Include the EXACT original URL so the user can apply
- Flag remote/hybrid/onsite if mentioned
- Be honest — if a listing is a stretch, say so

OUTPUT FORMAT (strict JSON via tool call):`;

    const userPrompt = `Rank these real job listings for this person's profile:

PROFILE:
- Current Role: ${role}
- Industry: ${industry}
- Seniority: ${seniorityTag}
- Region: ${regionTag}
- Skills: ${(skills || []).join(", ") || "Not specified"}
- Human-Moat Skills: ${(moatSkills || []).join(", ") || "None identified"}
- AI Displacement Risk: ${determinismIndex || "N/A"}/100

RAW JOB LISTINGS FROM JOB BOARDS:
${listingsContext}

Select the top 8 most relevant, REAL job postings. Rank by fit to this person's profile.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    const aiResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FLASH_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        generationConfig: {
          responseMimeType: "application/json",
        },
        tools: [{
          type: "function",
          function: {
            name: "rank_real_jobs",
            description: "Return ranked real job listings with fit annotations",
            parameters: {
              type: "object",
              properties: {
                jobs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Exact job title from listing" },
                      company: { type: "string", description: "Company name extracted from listing" },
                      url: { type: "string", description: "Direct apply URL" },
                      skill_match_pct: { type: "number", description: "0-100 how well user's skills match" },
                      ai_safety_score: { type: "number", description: "0-100 how AI-safe this role is" },
                      salary_range: { type: ["string", "null"], description: "Exact salary text from listing (e.g. '₹15-25 LPA'). MUST be null if no explicit ₹/INR/LPA/lakh figure appears in the snippet — never estimate." },
                      location: { type: "string", description: "Location or Remote/Hybrid/Onsite" },
                      why_good_fit: { type: "string", description: "1-2 sentences on why this person should apply" },
                      skills_matched: { type: "array", items: { type: "string" }, description: "User skills that match this job" },
                      skills_to_learn: { type: "array", items: { type: "string" }, description: "Skills user would need to pick up" },
                      fit_level: { type: "string", enum: ["STRONG", "GOOD", "STRETCH"], description: "How close a fit this is" },
                    },
                    required: ["title", "company", "url", "skill_match_pct", "ai_safety_score", "why_good_fit", "skills_matched", "fit_level"],
                    additionalProperties: false,
                  },
                },
                market_insight: { type: "string", description: "One paragraph about the current job market for your profile" },
              },
              required: ["jobs", "market_insight"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rank_real_jobs" } },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[BestFitJobs] AI error [${aiResp.status}]:`, errText.slice(0, 300));
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    logTokenUsage("best-fit-jobs", null, FLASH_MODEL, aiData);
    let result: any = null;

    // Extract tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("[BestFitJobs] Failed to parse tool call:", e);
        return new Response(JSON.stringify({
          error: "Job search temporarily unavailable. Please try again.",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fallback: try content (in case tool call was not generated)
    if (!result) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        result = JSON.parse(content);
      } catch (e) {
        console.error("[BestFitJobs] Failed to parse content:", e);
        return new Response(JSON.stringify({
          error: "Job search temporarily unavailable. Please try again.",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!result?.jobs?.length) {
      return new Response(JSON.stringify({
        jobs: [],
        market_insight: "Could not analyze listings. Please try again.",
        sources: [],
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[BestFitJobs] Ranked ${result.jobs.length} real job listings`);

    // ── Server-side salary sanitization (defense against LLM hallucination) ──
    // If the LLM returned a salary string but the source snippet has no ₹/LPA/lakh
    // anchor, force it to null. This guarantees zero fabricated salary data
    // regardless of prompt drift.
    const SALARY_ANCHOR = /(₹|INR|Rs\.?|LPA|lakh|crore|cr\b|\d+\s*L\b)/i;
    const sanitizedJobs = result.jobs.slice(0, 8).map((j: any) => {
      if (j.salary_range && typeof j.salary_range === "string") {
        const sourceSnippet = rawListings.find((l) => l.url === j.url)?.snippet || "";
        if (!SALARY_ANCHOR.test(j.salary_range) || !SALARY_ANCHOR.test(sourceSnippet)) {
          j.salary_range = null;
        }
      }
      return j;
    });

    const responseData = {
      jobs: sanitizedJobs,
      market_insight: result.market_insight || "",
      total_found: rawListings.length,
      sources: rawListings.slice(0, 6).map((l) => ({ title: l.title, url: l.url })),
      generated_at: new Date().toISOString(),
    };

    // Cache (non-blocking)
    supabase.from("enrichment_cache").upsert(
      { cache_key: cacheKey, data: responseData, cached_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    ).then(() => {}).catch((e: any) => console.warn("[BestFitJobs] cache write fail:", e));

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[BestFitJobs] Error:", err);
    return new Response(JSON.stringify({
      error: "Job search temporarily unavailable. Please try again.",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
