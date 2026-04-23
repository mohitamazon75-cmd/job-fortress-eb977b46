import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { enrichRolesWithAdzunaSalary } from "../_shared/adzuna-salary.ts";
import { enrichRolesWithIndiaSalary } from "../_shared/ambitionbox-salary.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════
// India Jobs Matcher v2 — Tavily-powered live job search
// 1. Tavily search for real job listings (primary)
// 2. Adzuna API fallback (if keys configured)
// 3. Deterministic safer-role recommendations (always)
// ═══════════════════════════════════════════════════════════════

const CACHE_TTL_HOURS = 12;

interface JobListing {
  title: string;
  company: string;
  location: string;
  salary_range?: string;
  url: string;
  description_snippet: string;
  posted_days_ago?: number;
  source: string;
}

interface UpskillRole {
  role: string;
  why_safer: string;
  skill_overlap_pct: number;
  avg_salary_inr: string;
  transition_time: string;
  search_url: string;
}

// ── India-specific safer role transitions (deterministic) ──
const SAFER_ROLE_MAP: Record<string, UpskillRole[]> = {
  "software engineer": [
    { role: "AI/ML Engineer", why_safer: "You build the AI instead of being replaced by it", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/ai-ml-engineer-jobs" },
    { role: "DevOps / Platform Engineer", why_safer: "Infrastructure automation is AI-resistant — requires system-wide judgment", skill_overlap_pct: 60, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/devops-engineer-jobs" },
    { role: "Security Engineer", why_safer: "AI creates new attack surfaces — security demand grows with AI adoption", skill_overlap_pct: 55, avg_salary_inr: null, transition_time: "4-6 months", search_url: "https://www.naukri.com/security-engineer-jobs" },
  ],
  "data analyst": [
    { role: "Analytics Engineer", why_safer: "Builds data pipelines AI consumes — meta-layer above analysis", skill_overlap_pct: 75, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/analytics-engineer-jobs" },
    { role: "Data Product Manager", why_safer: "Decides WHAT to analyze — judgment + stakeholder skills AI can't replicate", skill_overlap_pct: 60, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/data-product-manager-jobs" },
    { role: "Business Intelligence Lead", why_safer: "Translates data into business decisions — requires domain expertise", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "2-3 months", search_url: "https://www.naukri.com/business-intelligence-jobs" },
  ],
  "marketing manager": [
    { role: "Growth Product Manager", why_safer: "Strategy + experimentation — AI can execute but can't set direction", skill_overlap_pct: 65, avg_salary_inr: null, transition_time: "3-5 months", search_url: "https://www.naukri.com/growth-product-manager-jobs" },
    { role: "Brand Strategist", why_safer: "Brand building requires cultural intuition AI fundamentally lacks", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "1-3 months", search_url: "https://www.naukri.com/brand-strategist-jobs" },
    { role: "AI Marketing Ops", why_safer: "You become the human who orchestrates AI marketing tools", skill_overlap_pct: 80, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/marketing-automation-jobs" },
  ],
  "content writer": [
    { role: "AI Content Strategist", why_safer: "You direct AI content generation — editor-in-chief of AI output", skill_overlap_pct: 75, avg_salary_inr: null, transition_time: "1-3 months", search_url: "https://www.naukri.com/content-strategist-jobs" },
    { role: "UX Writer", why_safer: "Micro-copy requires product context AI can't fully grasp", skill_overlap_pct: 65, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/ux-writer-jobs" },
    { role: "Technical Writer", why_safer: "Requires deep product understanding + accuracy AI hallucinates on", skill_overlap_pct: 60, avg_salary_inr: null, transition_time: "2-3 months", search_url: "https://www.naukri.com/technical-writer-jobs" },
  ],
  "accountant": [
    { role: "Financial Controller", why_safer: "Compliance judgment + stakeholder management — high accountability", skill_overlap_pct: 75, avg_salary_inr: null, transition_time: "6-12 months", search_url: "https://www.naukri.com/financial-controller-jobs" },
    { role: "FP&A Analyst", why_safer: "Strategic forecasting requires business context AI can't access", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/fpa-analyst-jobs" },
    { role: "Internal Auditor", why_safer: "Investigative + judgment-heavy — AI assists but can't replace the investigator", skill_overlap_pct: 65, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/internal-auditor-jobs" },
  ],
  "graphic designer": [
    { role: "Product Designer", why_safer: "System thinking + user research — AI generates pixels, not strategy", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/product-designer-jobs" },
    { role: "Design Systems Lead", why_safer: "Architectural design decisions AI can't make — scales human design", skill_overlap_pct: 65, avg_salary_inr: null, transition_time: "4-6 months", search_url: "https://www.naukri.com/design-system-jobs" },
    { role: "AI Art Director", why_safer: "You direct AI visual generation — creative judgment is the moat", skill_overlap_pct: 75, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/art-director-jobs" },
  ],
  "hr manager": [
    { role: "People Analytics Lead", why_safer: "Data-driven HR with strategic influence — AI assists, you decide", skill_overlap_pct: 60, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/people-analytics-jobs" },
    { role: "Organizational Development", why_safer: "Culture + change management — fundamentally human skills", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/organizational-development-jobs" },
    { role: "HR Business Partner", why_safer: "Strategic advisory role — relationship-driven, AI-resistant", skill_overlap_pct: 80, avg_salary_inr: null, transition_time: "1-3 months", search_url: "https://www.naukri.com/hr-business-partner-jobs" },
  ],
  "customer support": [
    { role: "Customer Success Manager", why_safer: "Proactive relationship management — AI handles tickets, you handle strategy", skill_overlap_pct: 70, avg_salary_inr: null, transition_time: "2-4 months", search_url: "https://www.naukri.com/customer-success-manager-jobs" },
    { role: "Technical Account Manager", why_safer: "Complex B2B relationships + product expertise AI can't replicate", skill_overlap_pct: 55, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/technical-account-manager-jobs" },
    { role: "CX Operations Analyst", why_safer: "Designs the systems AI uses — meta-layer thinking", skill_overlap_pct: 50, avg_salary_inr: null, transition_time: "3-5 months", search_url: "https://www.naukri.com/customer-experience-jobs" },
  ],
  default: [
    { role: "AI Operations Specialist", why_safer: "Every industry needs people who manage AI tools — you become the bridge", skill_overlap_pct: 40, avg_salary_inr: null, transition_time: "3-6 months", search_url: "https://www.naukri.com/ai-operations-jobs" },
    { role: "Process Automation Lead", why_safer: "You design what gets automated — the architect, not the brick", skill_overlap_pct: 45, avg_salary_inr: null, transition_time: "4-6 months", search_url: "https://www.naukri.com/process-automation-jobs" },
    { role: "Digital Transformation Consultant", why_safer: "Guides organizations through AI adoption — requires business + tech judgment", skill_overlap_pct: 35, avg_salary_inr: null, transition_time: "6-9 months", search_url: "https://www.naukri.com/digital-transformation-jobs" },
  ],
};

function matchRole(role: string): string {
  const r = role.toLowerCase();
  for (const key of Object.keys(SAFER_ROLE_MAP)) {
    if (key === "default") continue;
    if (r.includes(key) || key.includes(r.split(" ")[0])) return key;
  }
  if (r.includes("engineer") || r.includes("developer") || r.includes("programmer")) return "software engineer";
  if (r.includes("data") && (r.includes("analyst") || r.includes("science"))) return "data analyst";
  if (r.includes("market")) return "marketing manager";
  if (r.includes("content") || r.includes("writer") || r.includes("copywriter")) return "content writer";
  if (r.includes("account") || r.includes("financ") || r.includes("audit")) return "accountant";
  if (r.includes("design") || r.includes("creative")) return "graphic designer";
  if (r.includes("hr") || r.includes("recruit") || r.includes("people")) return "hr manager";
  if (r.includes("support") || r.includes("service") || r.includes("helpdesk")) return "customer support";
  return "default";
}

function buildJobSearchUrls(role: string, skills: string[], city: string) {
  const query = encodeURIComponent(`${role} ${skills.slice(0, 3).join(" ")}`);
  const loc = encodeURIComponent(city || "India");
  return {
    naukri: `https://www.naukri.com/${role.toLowerCase().replace(/\s+/g, "-")}-jobs-in-${city.toLowerCase().replace(/\s+/g, "-")}`,
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${loc}`,
    foundit: `https://www.foundit.in/srp/results?searchType=personalizedSearch&query=${query}&locations=${loc}`,
  };
}

// ── Parse Tavily results into JobListings ──
function parseTavilyJobResults(results: any[]): JobListing[] {
  const jobs: JobListing[] = [];
  for (const r of results) {
    if (!r.title || !r.url) continue;
    // Skip non-job pages
    const url = r.url.toLowerCase();
    if (url.includes("/blog/") || url.includes("/article/") || url.includes("wikipedia.org")) continue;
    if (url.includes("/salaries") || url.includes("/salary") || url.includes("/reviews") || url.includes("/interview") || url.includes("ambitionbox") || url.includes("payscale")) continue;

    // Extract company from title or content
    const titleParts = r.title.split(/\s+[-–|at@]\s+/);
    const title = titleParts[0]?.trim() || r.title;
    let company = titleParts[1]?.trim() || "";
    
    // Try to extract company from content
    if (!company && r.content) {
      const companyMatch = r.content.match(/(?:at|company[:\s]+|employer[:\s]+)\s*([A-Z][A-Za-z\s&.]+?)(?:\s*[-,.|]|\s+in\s+)/);
      if (companyMatch) company = companyMatch[1].trim();
    }

    // Extract location from content
    let location = "India";
    const locMatch = r.content?.match(/(?:location|city|place)[:\s]*([A-Z][A-Za-z\s,]+?)(?:\s*[-.|])/i) ||
                     r.content?.match(/\b(Mumbai|Bangalore|Bengaluru|Delhi|NCR|Hyderabad|Chennai|Pune|Kolkata|Gurgaon|Gurugram|Noida|Ahmedabad|Jaipur|Kochi|Chandigarh|Indore|Lucknow|Dubai|Remote)\b/i);
    if (locMatch) location = locMatch[1]?.trim() || locMatch[0]?.trim() || "India";

    // Extract salary if mentioned
    let salary_range: string | undefined;
    const salaryMatch = r.content?.match(/₹?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|Lakhs?|lakh)\s*(?:[-–to]+\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|Lakhs?|lakh))?/i);
    if (salaryMatch) {
      salary_range = salaryMatch[2] 
        ? `₹${salaryMatch[1]}L - ₹${salaryMatch[2]}L` 
        : `₹${salaryMatch[1]}L+`;
    }

    jobs.push({
      title: title.slice(0, 120),
      company: company.slice(0, 60) || "View listing",
      location,
      salary_range,
      url: r.url,
      description_snippet: (r.content || "").slice(0, 250),
      source: "tavily",
    });
  }
  return jobs.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const blocked = guardRequest(req, cors);
    if (blocked) return blocked;

    const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
    if (jwtBlocked) return jwtBlocked;

    const { role, industry, skills, city, risk_score, force_refresh, is_executive, executive_tier, experience } = await req.json();
    if (!role) return json({ error: "role required" }, 400);

    // Detect executive intent from role string when caller didn't flag it
    const roleLc = String(role).toLowerCase();
    const detectedExec = is_executive === true || /\b(ceo|cto|cfo|coo|cmo|cpo|chro|cro|cdo|ciso|cio|founder|co[\s-]?founder|president|managing\s+director|managing\s+partner|chief\s+\w+\s+officer|evp|svp|executive\s+vice\s+president|senior\s+vice\s+president|vp\b)\b/.test(roleLc);
    const execTier: string | null = executive_tier || (detectedExec ? "executive" : null);

    const sb = createAdminClient();

    // Cache key includes exec flag + skill fingerprint so executive scans don't reuse junior results
    const skillFingerprint = (skills || []).slice(0, 3).map(s => String(s).toLowerCase()).sort().join("-").slice(0, 40);
    const cacheKey = `india-jobs-v2:${role.toLowerCase()}:${(city || "india").toLowerCase()}:${execTier || "ic"}:${skillFingerprint}`;

    if (!force_refresh) {
      const { data: cached } = await sb
        .from("enrichment_cache")
        .select("data, cached_at")
        .eq("cache_key", cacheKey)
        .single();

      if (cached) {
        const cacheAge = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60);
        if (cacheAge < CACHE_TTL_HOURS) {
          console.log(`[india-jobs] Cache hit for ${cacheKey}`);
          return json({ ...(cached.data as any), cached: true });
        }
      }
    } else {
      console.log(`[india-jobs] Force refresh requested, skipping cache`);
    }

    // ── Build deterministic results ──
    const matchedKey = matchRole(role);
    const upskillRoles = SAFER_ROLE_MAP[matchedKey] || SAFER_ROLE_MAP.default;
    const searchUrls = buildJobSearchUrls(role, skills || [], city || "India");

    // ── Search for LIVE jobs via Tavily ──
    let jobs: JobListing[] = [];
    let source: "tavily" | "adzuna" | "deterministic" = "deterministic";

    // Domain set + query template depends on tier
    const execDomains = ["linkedin.com", "naukri.com", "iimjobs.com", "hirist.tech", "instahyre.com", "cutshort.io", "blueprintleadership.com", "thefederal.com", "vahura.com"];
    const icDomains = ["naukri.com", "linkedin.com", "indeed.co.in", "foundit.in", "instahyre.com", "cutshort.io", "wellfound.com", "hirist.tech"];

    // PRIMARY: Tavily search for real job listings
    try {
      const skillStr = (skills || []).slice(0, 3).join(" ");
      const cityStr = city || "India";
      const expStr = experience ? `${experience} years` : "";

      // Exec queries focus on senior outcomes; IC queries focus on apply-now postings.
      // Quotes around role keep multi-word titles intact in Tavily.
      const searchQuery = detectedExec
        ? `"${role}" OR "Chief" OR "Head of" OR "VP" hiring "${cityStr}" India 2025 2026 ${expStr} -salary -review -"salary insights"`
        : `"${role}" jobs apply now hiring "${cityStr}" ${skillStr} ${expStr} -salary -review -"salary insights"`;

      console.log(`[india-jobs] Tavily search (exec=${detectedExec}): "${searchQuery}"`);

      const tavilyResult = await tavilySearch({
        query: searchQuery,
        searchDepth: detectedExec ? "advanced" : "basic",
        maxResults: 15,
        includeDomains: detectedExec ? execDomains : icDomains,
        excludeDomains: [
          "glassdoor.co.in", "glassdoor.com", "ambitionbox.com",
          "payscale.com", "salary.com", "levels.fyi",
        ],
        days: detectedExec ? 45 : 14,  // Exec listings turn over slower
        topic: "general",
        includeAnswer: false,
      }, 15000, 2);

      if (tavilyResult?.results?.length) {
        jobs = parseTavilyJobResults(tavilyResult.results);
        if (jobs.length > 0) {
          source = "tavily";
          console.log(`[india-jobs] Tavily returned ${jobs.length} job listings`);
        }
      }
    } catch (e: any) {
      console.warn("[india-jobs] Tavily search failed (non-fatal):", e.message);
    }

    // FALLBACK: Adzuna — SKIP for executives (Adzuna has poor exec inventory in India)
    if (jobs.length === 0 && !detectedExec) {
      const ADZUNA_API_KEY = Deno.env.get("ADZUNA_API_KEY");
      const ADZUNA_API_ID = Deno.env.get("ADZUNA_API_ID");
      if (ADZUNA_API_KEY && ADZUNA_API_ID) {
        try {
          const searchTerms = [role, ...(skills || []).slice(0, 2)].join(" ");
          const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${ADZUNA_API_ID}&app_key=${ADZUNA_API_KEY}&results_per_page=8&what=${encodeURIComponent(searchTerms)}&where=${encodeURIComponent(city || "India")}&content-type=application/json`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(adzunaUrl, { signal: controller.signal });
          clearTimeout(timeout);

          if (resp.ok) {
            const data = await resp.json();
            jobs = (data.results || []).slice(0, 8).map((j: any) => ({
              title: j.title || "",
              company: j.company?.display_name || "Company",
              location: j.location?.display_name || city || "India",
              salary_range: j.salary_min ? `₹${Math.round(j.salary_min / 100000)}L - ₹${Math.round(j.salary_max / 100000)}L` : undefined,
              url: j.redirect_url || "#",
              description_snippet: (j.description || "").slice(0, 200),
              posted_days_ago: j.created ? Math.round((Date.now() - new Date(j.created).getTime()) / 86400000) : 0,
              source: "adzuna",
            }));
            source = "adzuna";
            console.log(`[india-jobs] Adzuna returned ${jobs.length} jobs`);
          }
        } catch (e: any) {
          console.warn("[india-jobs] Adzuna failed (non-fatal):", e.message);
        }
      }
    }

    // Personalize upskill roles based on risk score
    const personalizedRoles = upskillRoles.map(r => ({
      ...r,
      why_safer: risk_score && risk_score > 60
        ? `${r.why_safer}. With your risk score at ${risk_score}%, this move is urgent.`
        : r.why_safer,
    }));

    // Enrich upskill roles with India salary data — AmbitionBox → Glassdoor → Adzuna
    // AmbitionBox has 30M+ India-specific salary points vs Adzuna's global data.
    let enrichedRoles = personalizedRoles;
    try {
      enrichedRoles = await enrichRolesWithIndiaSalary(personalizedRoles);
    } catch (e: any) {
      console.warn("[india-jobs] India salary enrichment failed (non-fatal):", e.message);
      // Fallback to Adzuna if AmbitionBox/Glassdoor chain fails
      try {
        enrichedRoles = await enrichRolesWithAdzunaSalary(personalizedRoles, {
          ADZUNA_API_ID: Deno.env.get("ADZUNA_API_ID") || "",
          ADZUNA_API_KEY: Deno.env.get("ADZUNA_API_KEY") || "",
        });
      } catch (e2: any) {
        console.warn("[india-jobs] Adzuna fallback also failed (non-fatal):", e2.message);
      }
    }

    const result = {
      jobs,
      total_found: jobs.length,
      search_query: role,
      source,
      cached: false,
      generated_at: new Date().toISOString(),
      upskill_roles: enrichedRoles,
      search_urls: searchUrls,
      salary_data_source: enrichedRoles.some(r => r.avg_salary_inr) ? "adzuna_live" : "not_available",
    };

    // ── Cache result ──
    await sb.from("enrichment_cache").upsert({
      cache_key: cacheKey,
      data: result,
      cached_at: new Date().toISOString(),
    }, { onConflict: "cache_key" }).then(() => {});

    return json(result);
  } catch (e: any) {
    console.error("[india-jobs] error:", e.message);
    return json({ error: "Internal error" }, 500);
  }
});
