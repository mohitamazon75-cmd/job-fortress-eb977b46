import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { linkedinUrl } = await req.json();

    if (!linkedinUrl) {
      return new Response(
        JSON.stringify({ error: "linkedinUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate LinkedIn URL
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
    if (!linkedinRegex.test(linkedinUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Extract username from URL for search
    const slug = extractLinkedinSlug(linkedinUrl);
    const nameTokens = slug.split(/[-_]+/).filter(Boolean).slice(0, 3);
    const nameGuess = nameTokens.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(" ");

    let profileMarkdown = "";
    let firecrawlWorked = false;
    let extractionSource = "none";

    // ═══════════════════════════════════════════════════════
    // STRATEGY 1: Firecrawl direct scrape (best quality)
    // ═══════════════════════════════════════════════════════
    if (FIRECRAWL_API_KEY) {
      try {
        const scrapeController = new AbortController();
        const scrapeTimeout = setTimeout(() => scrapeController.abort(), 15_000);
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: linkedinUrl, formats: ["markdown"] }),
          signal: scrapeController.signal,
        });
        clearTimeout(scrapeTimeout);

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          const md = scrapeData?.data?.markdown || "";
          if (md && md.length > 200) {
            profileMarkdown = md;
            firecrawlWorked = true;
            extractionSource = "firecrawl_direct_scrape";
            console.log("[parse-linkedin] Firecrawl scrape succeeded, length:", md.length);
          }
        }
      } catch (e) {
        console.error("[parse-linkedin] Firecrawl scrape failed:", e);
      }

      // ═══════════════════════════════════════════════════════
      // STRATEGY 2: Firecrawl SEARCH (lower quality — snippets only)
      // ═══════════════════════════════════════════════════════
      if (!firecrawlWorked) {
        try {
          // Only search with exact slug to avoid wrong-person matches
          const searchQuery = `site:linkedin.com/in/${slug}`;

          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: searchQuery, limit: 3, lang: "en" }),
          });

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const snippets: string[] = [];
            for (const item of (searchData?.data || [])) {
              const url = String(item.url || item.link || "").toLowerCase();
              const title = String(item.title || "");
              const description = String(item.description || "");
              // STRICT: URL must contain exact slug
              if (!url.includes(`/in/${slug}`)) continue;
              if (NOISY_SOURCE_REGEX.test(url)) continue;
              // Strip numbers from snippets — they're almost always wrong-context
              const cleanDesc = stripUnverifiedNumbers(sanitizeSnippet(description, 250));
              if (cleanDesc.length > 20) {
                snippets.push(`${stripUnverifiedNumbers(title)}: ${cleanDesc}`);
              }
            }

            if (snippets.length > 0) {
              profileMarkdown = snippets.join("\n\n");
              firecrawlWorked = true;
              extractionSource = "firecrawl_search_snippets";
              console.log(`[parse-linkedin] Firecrawl search found ${snippets.length} exact-slug snippets`);
            }
          }
        } catch (e) {
          console.error("[parse-linkedin] Firecrawl search failed:", e);
        }
      }

      // ═══════════════════════════════════════════════════════
      // STRATEGY 2.5: Tavily deep search (supplement thin data)
      // ═══════════════════════════════════════════════════════
      const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
      if (TAVILY_API_KEY && (!firecrawlWorked || profileMarkdown.length < 500)) {
        try {
          console.log("[parse-linkedin] Tavily enrichment — data thin or missing");
          // STRICT: only search exact slug
          const tavilyQuery = `site:linkedin.com/in/${slug}`;

          const tavilyResp = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query: tavilyQuery,
              search_depth: "advanced",
              max_results: 5,
              include_answer: false,
              include_domains: ["linkedin.com"],
            }),
          });

          if (tavilyResp.ok) {
            const tavilyData = await tavilyResp.json();
            const tavilySnippets: string[] = [];
            for (const item of (tavilyData?.results || [])) {
              const url = String(item.url || "").toLowerCase();
              const content = String(item.content || "");
              const title = String(item.title || "");
              // STRICT: URL must contain exact slug
              if (!url.includes(`/in/${slug}`)) continue;
              if (NOISY_SOURCE_REGEX.test(url)) continue;
              if (content.length > 40) {
                const cleanContent = stripUnverifiedNumbers(sanitizeSnippet(content, 700));
                tavilySnippets.push(`${stripUnverifiedNumbers(title)}\n${cleanContent}`);
              }
            }

            if (tavilySnippets.length > 0) {
              const tavilyText = tavilySnippets.join("\n\n").slice(0, 3500);
              if (!firecrawlWorked) {
                profileMarkdown = tavilyText;
                firecrawlWorked = true;
                extractionSource = "tavily_search_snippets";
              } else {
                profileMarkdown += "\n\n--- Additional Profile Data ---\n" + tavilyText;
              }
              console.log(`[parse-linkedin] Tavily added ${tavilySnippets.length} exact-slug blocks`);
            }
          }
        } catch (e) {
          console.error("[parse-linkedin] Tavily search failed:", e);
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // STRATEGY 3: Gemini AI structured extraction
    // ═══════════════════════════════════════════════════════
    if (LOVABLE_API_KEY && profileMarkdown) {
      try {
        // Determine data quality to calibrate extraction strictness
        const isDirectScrape = extractionSource === "firecrawl_direct_scrape";
        const dataQualityNote = isDirectScrape
          ? "This is a DIRECT SCRAPE of the LinkedIn page — data is high quality. Extract all available information."
          : "WARNING: This data comes from SEARCH SNIPPETS (Google preview text), NOT a direct profile page. Search snippets are often incomplete, may contain data from WRONG PEOPLE with similar names, and frequently include hallucinated or out-of-context numbers. Be EXTREMELY conservative. Only extract facts you are HIGHLY CONFIDENT belong to the target person.";

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `You are a LinkedIn profile data extractor. Your ONLY job is to extract facts that are EXPLICITLY STATED in the provided text. 

ABSOLUTE RULES:
1. NEVER invent, assume, or infer information not explicitly present in the text.
2. If a field cannot be determined from the text, you MUST use null — never guess.
3. For "company" — only include if a company name is CLEARLY stated as the person's CURRENT employer. Do NOT pick random company names from snippets.
4. For "headline" — extract the EXACT job title as stated. If multiple titles appear, use the most recent/current one. If unclear, use null.
5. For "experience" — only include roles that are CLEARLY attributed to THIS person. If the text mentions companies without clear attribution, SKIP them.
6. For "skills" — only include skills explicitly mentioned. Do NOT add generic skills based on job title assumptions.
7. NEVER fabricate revenue numbers, team sizes, investment amounts, or any quantitative claims.
8. The target person's name is approximately "${nameGuess}" — only extract data that clearly relates to this person.

${dataQualityNote}

Return ONLY valid JSON:
{
  "name": string | null,
  "headline": string | null,
  "company": string | null,
  "location": string | null,
  "skills": [string],
  "experience": [{"title": string, "company": string, "duration": string}],
  "inferredIndustry": string | null,
  "extraction_confidence": "high" | "medium" | "low"
}

Set extraction_confidence to:
- "high": Direct scrape with rich, clear profile data
- "medium": Search snippets with clear title/company attribution
- "low": Sparse or ambiguous data, uncertain attribution

No markdown, no explanation.`,
              },
              {
                role: "user",
                content: `Extract ONLY explicitly stated facts from this text about ${nameGuess} (LinkedIn: ${linkedinUrl}):\n\n${profileMarkdown.slice(0, 6000)}`,
              },
            ],
            temperature: 0.0, // Zero temperature for maximum determinism
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            // Post-extraction validation: reject suspicious data
            const validatedParsed = validateExtraction(parsed, nameGuess, slug);

            // Enrich with DB matching
            const supabase = createClient(
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );

            const { data: jobs } = await supabase
              .from("job_taxonomy")
              .select("job_family, category, disruption_baseline");

            const matchedJob = fuzzyMatchJob(validatedParsed.headline || "", jobs || []);

            const { data: allSkills } = await supabase
              .from("skill_risk_matrix")
              .select("skill_name, automation_risk, replacement_tools");

            const matchedSkills = matchSkills(validatedParsed.skills || [], allSkills || []);

            const confidence = validatedParsed.extraction_confidence || (isDirectScrape ? "high" : "low");

            return new Response(
              JSON.stringify({
                name: validatedParsed.name || nameGuess,
                headline: validatedParsed.headline || null,
                company: validatedParsed.company || "",
                location: validatedParsed.location || "",
                skills: validatedParsed.skills || [],
                experience: validatedParsed.experience || [],
                matchedJobFamily: matchedJob?.job_family || null,
                matchedIndustry: matchedJob?.category || null,
                matchedSkills,
                suggestedIndustry: matchedJob?.category || validatedParsed.inferredIndustry || "Other",
                rawExtractionQuality: confidence,
                source: extractionSource,
                extraction_confidence: confidence,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.error("[parse-linkedin] Gemini extraction failed:", e);
      }
    }

    // ═══════════════════════════════════════════════════════
    // FALLBACK: URL-only inference (lowest quality)
    // ═══════════════════════════════════════════════════════
    const profile = inferProfileFromLinkedinUrl(linkedinUrl);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: jobs } = await supabase
      .from("job_taxonomy")
      .select("job_family, category, disruption_baseline");

    const matchedJob = fuzzyMatchJob(profile.headline, jobs || []);

    return new Response(
      JSON.stringify({
        name: profile.name,
        headline: profile.headline,
        company: "",
        location: "",
        skills: profile.skills,
        experience: [],
        matchedJobFamily: matchedJob?.job_family || null,
        matchedIndustry: matchedJob?.category || null,
        matchedSkills: [],
        suggestedIndustry: matchedJob?.category || profile.inferredIndustry || "Other",
        rawExtractionQuality: "url_inferred",
        source: "url_inference_only",
        extraction_confidence: "low",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("LinkedIn parse error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", fallback: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// Helpers
// ============================================================
const NOISY_SOURCE_REGEX = /(scribd|slideshare|poshmark|tripadvisor|naukri|indeed|glassdoor|quora|pinterest|reddit|facebook|instagram|crunchbase|zoominfo|rocketreach|signalhire|apollo\.io|lusha)/i;

function extractLinkedinSlug(linkedinUrl: string): string {
  const slugMatch = linkedinUrl.match(/\/in\/([\w-]+)/i);
  return slugMatch ? slugMatch[1].toLowerCase() : "";
}

function sanitizeSnippet(text: string, maxLength = 500): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/(scribd|uploaded by|0 ratings|views\d|open navigation menu|sign in|join now|see who you know|more activity)/gi, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Strip unverified numbers from search snippets.
 * These are almost always from wrong profiles or ad-copy noise.
 * Preserves years of experience patterns like "10+ years" or "5 years".
 */
function stripUnverifiedNumbers(text: string): string {
  return text
    // Remove dollar/rupee amounts ($6M, $100K, ₹50L, etc.)
    .replace(/[\$₹€£]\s*[\d,.]+\s*[KMBT]?\b/gi, "[amount]")
    // Remove "X investors", "X employees", "X clients", "X companies" etc.
    .replace(/\b\d{2,}\+?\s*(investors?|employees?|clients?|companies|customers?|users?|members?|offices?|countries)\b/gi, "[metric]")
    // Remove "raised X", "funded X", "revenue of X"
    .replace(/(raised|funded|revenue of|worth|valued at)\s*[\$₹€£]?\s*[\d,.]+\s*[KMBT]?\b/gi, "[financial claim]")
    // Keep years patterns intact (e.g., "10+ years", "5 years experience")
    ;
}

/**
 * Post-extraction validation: reject data that doesn't match the target person.
 */
function validateExtraction(parsed: any, nameGuess: string, slug: string): any {
  const validated = { ...parsed };

  // If extracted name is wildly different from slug-derived name, flag low confidence
  if (validated.name && nameGuess) {
    const extractedTokens = new Set(validated.name.toLowerCase().split(/\s+/));
    const expectedTokens = nameGuess.toLowerCase().split(/\s+/);
    const overlap = expectedTokens.filter(t => extractedTokens.has(t)).length;
    if (overlap === 0 && expectedTokens.length > 0) {
      console.warn(`[parse-linkedin] Name mismatch: expected "${nameGuess}", got "${validated.name}" — setting low confidence`);
      validated.extraction_confidence = "low";
      // Don't override name — could be legit (e.g., slug is "mohit-kumar-abc123")
    }
  }

  // Reject experience entries that look fabricated (no duration, generic company names)
  if (validated.experience && Array.isArray(validated.experience)) {
    validated.experience = validated.experience.filter((exp: any) => {
      // Must have both title and company
      if (!exp.title || !exp.company) return false;
      // Reject if company is a generic placeholder
      if (/^(company|organization|firm|startup|unknown)$/i.test(exp.company)) return false;
      return true;
    });
  }

  // Strip any numeric claims from headline (e.g., "$6M revenue")
  if (validated.headline) {
    validated.headline = validated.headline
      .replace(/[\$₹€£]\s*[\d,.]+\s*[KMBT]?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return validated;
}

// ============================================================
// URL fallback inference
// ============================================================
function inferProfileFromLinkedinUrl(linkedinUrl: string) {
  const roleSignals: Array<{ keywords: string[]; headline: string; industry: string; skills: string[] }> = [
    { keywords: ["founder", "cofounder", "ceo", "cto", "cfo", "coo", "cmo", "owner", "chairman", "president", "md", "managing"], headline: "Founder & CEO", industry: "IT & Software", skills: ["P&L Governance", "Strategic Partnerships", "Business Strategy", "Investor Relations", "Organizational Leadership"] },
    { keywords: ["consultant", "consulting", "advisory", "advisor", "strategist"], headline: "Strategy Consultant", industry: "IT & Software", skills: ["Strategy Consulting", "Business Transformation", "Client Advisory", "Stakeholder Management"] },
    { keywords: ["marketing", "growth", "seo", "content", "brand"], headline: "Marketing Professional", industry: "Marketing & Advertising", skills: ["Marketing", "Growth Strategy", "Content", "Brand"] },
    { keywords: ["finance", "banking", "analyst", "ca"], headline: "Finance Professional", industry: "Finance & Banking", skills: ["Finance", "Analysis", "Risk", "Compliance"] },
    { keywords: ["design", "ux", "ui", "creative"], headline: "Design Professional", industry: "Creative & Design", skills: ["Design", "UX", "Visual Design", "Research"] },
    { keywords: ["developer", "engineer", "software", "it", "dev"], headline: "Software Professional", industry: "IT & Software", skills: ["Software Development", "Engineering", "Problem Solving", "Systems"] },
  ];

  let slug = "";
  try {
    const url = new URL(linkedinUrl);
    slug = decodeURIComponent(url.pathname.replace(/^\/in\//, "").replace(/\/$/, ""));
  } catch {
    slug = linkedinUrl;
  }

  const tokens = slug.split(/[-_\s]+/).map((t) => t.trim()).filter(Boolean);
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  const matchedSignal = roleSignals.find((signal) =>
    signal.keywords.some((keyword) => lowerTokens.some((token) => token.includes(keyword)))
  );

  const name = tokens
    .filter((t) => /^[a-z]+$/i.test(t))
    .slice(0, 2)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" ") || "Unknown";

  return {
    name,
    headline: matchedSignal?.headline || "Professional",
    inferredIndustry: matchedSignal?.industry || null,
    skills: matchedSignal?.skills || [],
  };
}

// ============================================================
// Fuzzy job matching
// ============================================================
function fuzzyMatchJob(headline: string, jobs: any[]) {
  if (!headline) return null;
  const lower = headline.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    frontend_developer: ["frontend", "front-end", "react", "angular", "vue", "ui developer"],
    backend_developer: ["backend", "back-end", "node.js", "django", "spring", "api developer"],
    full_stack_developer: ["full stack", "fullstack", "full-stack"],
    mobile_developer: ["mobile", "android", "ios", "flutter", "react native"],
    data_scientist: ["data scientist", "data science", "ml engineer", "machine learning", "deep learning", "ai engineer", "ai/ml"],
    data_analyst: ["data analyst", "business intelligence", "bi analyst", "analytics"],
    devops_engineer: ["devops", "sre", "site reliability", "infrastructure", "cloud engineer", "platform engineer"],
    qa_tester: ["qa", "quality assurance", "test engineer", "sdet"],
    product_manager: ["product manager", "product owner", "pm", "head of product", "product development", "product lead", "global head of product", "vp product"],
    digital_marketer: ["digital marketing", "growth", "performance marketing", "digital transformation"],
    content_writer: ["content writer", "copywriter", "content creator"],
    graphic_designer: ["graphic designer", "visual designer"],
    ui_ux_designer: ["ui/ux", "ux designer", "ui designer", "product designer"],
    financial_analyst: ["financial analyst", "finance analyst"],
    accountant: ["accountant", "chartered accountant", "ca"],
    hr_generalist: ["hr", "human resources", "people operations"],
    sales_executive: ["sales", "business development", "account executive", "account management", "client services"],
    customer_support: ["customer support", "customer service", "support engineer"],
    project_manager: ["project manager", "program manager", "delivery manager", "delivery head", "program director"],
    teacher: ["teacher", "lecturer", "professor", "educator"],
    doctor: ["doctor", "physician", "mbbs"],
    nurse: ["nurse", "nursing"],
    lawyer_litigation: ["lawyer", "advocate", "attorney", "legal"],
    management_consultant: ["consultant", "consulting", "strategy", "advisory", "advisor", "transformation", "enterprise leader", "technology leader", "outsourcing"],
  };

  const sortedEntries = Object.entries(keywordMap).sort((a, b) => {
    const maxA = Math.max(...a[1].map(k => k.length));
    const maxB = Math.max(...b[1].map(k => k.length));
    return maxB - maxA;
  });

  for (const [family, keywords] of sortedEntries) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return jobs.find((j: any) => j.job_family === family) || null;
      }
    }
  }
  return null;
}

// ============================================================
// Skill matching
// ============================================================
function matchSkills(profileSkills: string[], dbSkills: any[]) {
  const matched: Array<{ profile_skill: string; db_skill: string; automation_risk: number }> = [];
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const ps of profileSkills) {
    const normPs = normalize(ps);
    for (const ds of dbSkills) {
      const normDs = normalize(ds.skill_name);
      if (normPs.includes(normDs) || normDs.includes(normPs) || levenshteinSimilarity(normPs, normDs) > 0.7) {
        matched.push({ profile_skill: ps, db_skill: ds.skill_name, automation_risk: ds.automation_risk });
        break;
      }
    }
  }
  return matched;
}

function levenshteinSimilarity(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - matrix[a.length][b.length] / maxLen;
}
