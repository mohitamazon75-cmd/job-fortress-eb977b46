// ═══════════════════════════════════════════════════════════════
// Company Health Signal — Live intelligence on user's employer
// Fixes the "Aakanksha Problem": scoring was company-blind
// Primary: Perplexity sonar-pro (single call, grounded, citations)
// Fallback: Tavily search + Gemini Flash synthesis (two-step)
// ═══════════════════════════════════════════════════════════════

import { tavilySearch, buildSearchContext } from "./tavily-search.ts";
import { logTokenUsage } from "./token-tracker.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const FAST_MODEL = "google/gemini-3-flash-preview";

// In-memory cache: company → { result, timestamp }
const companyCache = new Map<string, { result: CompanyHealthResult; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200; // Prevent unbounded memory growth

export interface CompanyHealthResult {
  score: number; // 0-100: 0 = company dying, 100 = thriving
  signals: string[];
  risk_factors: string[];
  growth_factors: string[];
  summary: string;
  search_grounded: boolean;
  citations?: string[];
}

const NEUTRAL_RESULT: CompanyHealthResult = {
  score: 50,
  signals: [],
  risk_factors: [],
  growth_factors: [],
  summary: "No company intelligence available",
  search_grounded: false,
};

/**
 * Fetch live company health intelligence.
 * Primary: Perplexity sonar-pro (single grounded call with citations).
 * Fallback: Tavily search + Gemini Flash synthesis.
 *
 * Returns a health score (0-100) that modifies the DI:
 *   score < 30 → company struggling → DI increases
 *   score 30-70 → neutral → no change
 *   score > 70 → company thriving → DI decreases slightly
 *
 * Graceful fallback: returns score=50 (neutral) on any failure.
 * Timeout: 15 seconds total.
 */
export async function fetchCompanyHealth(
  company: string,
  industry?: string | null,
  role?: string | null,
  country?: string | null,
): Promise<CompanyHealthResult> {
  if (!company || company.toLowerCase() === "unknown" || company.length < 2) {
    console.log("[CompanyHealth] No valid company name, skipping");
    return NEUTRAL_RESULT;
  }

  // Check cache
  const cacheKey = company.toLowerCase().trim();
  const cached = companyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[CompanyHealth] Cache hit for "${company}"`);
    return cached.result;
  }

  // Try Perplexity first, then fall back to Tavily+Gemini
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (PERPLEXITY_API_KEY) {
    const perplexityResult = await fetchCompanyHealthPerplexity(company, industry, role, country, PERPLEXITY_API_KEY);
    if (perplexityResult) {
      cacheResult(cacheKey, perplexityResult);
      return perplexityResult;
    }
    console.warn("[CompanyHealth] Perplexity failed, falling back to Tavily+Gemini");
  }

  return fetchCompanyHealthTavilyFallback(company, industry, role, country, cacheKey);
}

/**
 * PRIMARY: Single Perplexity sonar-pro call with structured output.
 * ~5s vs ~18s for the old two-step Tavily+Gemini pipeline.
 */
async function fetchCompanyHealthPerplexity(
  company: string,
  industry: string | null | undefined,
  role: string | null | undefined,
  country: string | null | undefined,
  apiKey: string,
): Promise<CompanyHealthResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const resp = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a company health analyst. Assess the current health and stability of "${company}" for employees. Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "signals": [<string>, ...],
  "risk_factors": [<string>, ...],
  "growth_factors": [<string>, ...],
  "summary": "<one sentence summary>"
}

Scoring guide:
- 0-20: Company in crisis (mass layoffs, bankruptcy, shutting down)
- 20-40: Struggling (restructuring, outsourcing, declining revenue)
- 40-60: Stable/neutral (normal operations, mixed signals)
- 60-80: Doing well (hiring, expanding, new products)
- 80-100: Thriving (rapid growth, major funding, market leadership)

IMPORTANT:
- "signals" should be 2-5 specific factual observations with dates
- Be specific with numbers and dates when available
- If no recent news, score 50 (neutral)`,
          },
          {
            role: "user",
            content: `Analyze the current health of "${company}"${industry ? ` (${industry} industry)` : ""}${country ? ` in ${country}` : ""}.${role ? ` The employee works as: ${role}.` : ""} Focus on the last 90 days: layoffs, hiring, funding, restructuring, AI adoption, revenue signals.`,
          },
        ],
        temperature: 0.1,
        search_recency_filter: "month",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`[CompanyHealth:Perplexity] Error: ${resp.status}`);
      await resp.text();
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];

    if (!content) return null;

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result: CompanyHealthResult = {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 5) : [],
      risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors.slice(0, 5) : [],
      growth_factors: Array.isArray(parsed.growth_factors) ? parsed.growth_factors.slice(0, 5) : [],
      summary: String(parsed.summary || `Company health assessed for ${company}`),
      search_grounded: true,
      citations: Array.isArray(citations) ? citations.slice(0, 5) : [],
    };

    console.log(`[CompanyHealth:Perplexity] Score for "${company}": ${result.score}/100 — ${result.summary}`);
    return result;
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      console.error(`[CompanyHealth:Perplexity] Timed out for "${company}"`);
    } else {
      console.error(`[CompanyHealth:Perplexity] Error for "${company}":`, e.message);
    }
    return null;
  }
}

/**
 * FALLBACK: Original Tavily search + Gemini Flash synthesis.
 */
async function fetchCompanyHealthTavilyFallback(
  company: string,
  industry: string | null | undefined,
  role: string | null | undefined,
  country: string | null | undefined,
  cacheKey: string,
): Promise<CompanyHealthResult> {
  const overallController = new AbortController();
  const overallTimeout = setTimeout(() => overallController.abort(), 15_000);

  try {
    const currentYear = new Date().getFullYear();
    const searchQuery = `"${company}" (layoffs OR restructuring OR outsourcing OR "hiring freeze" OR "store closures" OR downsizing OR expansion OR growth OR "new funding" OR acquisition) ${currentYear}`;

    console.log(`[CompanyHealth:Tavily] Searching: ${searchQuery}`);

    const searchResult = await tavilySearch(
      {
        query: searchQuery,
        searchDepth: "basic",
        maxResults: 8,
        topic: "news",
        days: 90,
        includeAnswer: true,
      },
      10_000,
      2,
    );

    if (!searchResult || searchResult.results.length === 0) {
      console.log(`[CompanyHealth:Tavily] No search results for "${company}"`);
      const result = { ...NEUTRAL_RESULT, summary: `No recent news found for ${company}` };
      cacheResult(cacheKey, result);
      return result;
    }

    console.log(`[CompanyHealth:Tavily] Got ${searchResult.results.length} results for "${company}"`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.warn("[CompanyHealth:Tavily] No API key, returning neutral");
      return NEUTRAL_RESULT;
    }

    const searchContext = buildSearchContext(searchResult.results, 8);
    const tavilyAnswer = searchResult.answer || "";

    const systemPrompt = `You are a company health analyst. Given recent news and search results about a company, assess its health and stability for employees.

Return ONLY valid JSON with this exact structure:
{
  "score": <number 0-100>,
  "signals": [<string>, ...],
  "risk_factors": [<string>, ...],
  "growth_factors": [<string>, ...],
  "summary": "<one sentence summary>"
}

Scoring guide:
- 0-20: Company is in crisis (mass layoffs, bankruptcy, shutting down operations)
- 20-40: Company is struggling (restructuring, outsourcing core functions, declining revenue)
- 40-60: Company is stable/neutral (normal operations, mixed signals)
- 60-80: Company is doing well (hiring, expanding, new products)
- 80-100: Company is thriving (rapid growth, major funding, market leadership)

IMPORTANT:
- "signals" should be 2-5 specific factual observations from the search results
- "risk_factors" should list negative signals (layoffs, closures, outsourcing, etc.)
- "growth_factors" should list positive signals (hiring, expansion, funding, etc.)
- Be specific with numbers and dates when available
- If search results are about a different company with a similar name, score 50 (neutral)`;

    const userPrompt = `Analyze the health of "${company}"${industry ? ` (${industry} industry)` : ""}${country ? ` in ${country}` : ""}.${role ? ` The employee works as: ${role}.` : ""}

Tavily Summary: ${tavilyAnswer}

Recent Search Results:
${searchContext}`;

    const controller = new AbortController();
    const llmTimeout = setTimeout(() => controller.abort(), 8_000);

    const aiResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(llmTimeout);

    if (!aiResp.ok) {
      console.error(`[CompanyHealth:Tavily] AI error: ${aiResp.status}`);
      await aiResp.text();
      return NEUTRAL_RESULT;
    }

    const aiData = await aiResp.json();
    logTokenUsage("company-health", null, FAST_MODEL, aiData);
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.warn("[CompanyHealth:Tavily] Empty AI response");
      return NEUTRAL_RESULT;
    }

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result: CompanyHealthResult = {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 5) : [],
      risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors.slice(0, 5) : [],
      growth_factors: Array.isArray(parsed.growth_factors) ? parsed.growth_factors.slice(0, 5) : [],
      summary: String(parsed.summary || `Company health assessed for ${company}`),
      search_grounded: true,
    };

    console.log(`[CompanyHealth:Tavily] Score for "${company}": ${result.score}/100 — ${result.summary}`);
    cacheResult(cacheKey, result);
    return result;
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error(`[CompanyHealth:Tavily] Timed out for "${company}"`);
    } else {
      console.error(`[CompanyHealth:Tavily] Error for "${company}":`, e.message);
    }
    return NEUTRAL_RESULT;
  } finally {
    clearTimeout(overallTimeout);
  }
}

function cacheResult(cacheKey: string, result: CompanyHealthResult) {
  if (companyCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = companyCache.keys().next().value;
    if (oldest) companyCache.delete(oldest);
  }
  companyCache.set(cacheKey, { result, ts: Date.now() });
}

/**
 * Calculate the DI modifier based on company health score.
 * Returns a number to ADD to the DI (positive = more risk, negative = less risk).
 */
export function calculateCompanyHealthModifier(score: number | null | undefined): number {
  if (score == null) return 0;
  if (score < 30) {
    // Company struggling: increase DI by up to +15
    return Math.ceil((30 - score) / 2);
  }
  if (score > 70) {
    // Company thriving: decrease DI by up to -10
    return -Math.ceil((score - 70) / 3);
  }
  // Neutral zone: no modifier
  return 0;
}
