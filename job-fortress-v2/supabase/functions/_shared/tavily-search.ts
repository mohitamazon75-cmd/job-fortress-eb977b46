// ═══════════════════════════════════════════════════════════════
// Shared Tavily Search Helper
// Primary search API — replaces Perplexity for grounded web search
// ═══════════════════════════════════════════════════════════════

export interface TavilySearchOptions {
  query: string;
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  includeAnswer?: boolean;
  days?: number; // recency filter in days
  topic?: "general" | "news" | "finance";
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}

/**
 * Search the web using Tavily API.
 * Returns grounded search results with citations.
 * 
 * @param options - Search configuration
 * @param timeoutMs - Abort timeout (default 20s)
 * @returns TavilyResponse or null on failure
 */
export async function tavilySearch(
  options: TavilySearchOptions,
  timeoutMs = 30000,
  maxRetries = 3
): Promise<TavilyResponse | null> {
  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
  if (!TAVILY_API_KEY) {
    console.warn("[tavily] TAVILY_API_KEY not configured");
    return null;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: options.query,
          search_depth: options.searchDepth || "basic",
          max_results: options.maxResults || 5,
          include_domains: options.includeDomains,
          exclude_domains: options.excludeDomains,
          include_answer: options.includeAnswer ?? true,
          days: options.days || 30,
          topic: options.topic || "general",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.status === 429 || resp.status >= 500) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 500;
        console.warn(`[tavily] ${resp.status} on attempt ${attempt + 1}, retrying in ${Math.round(backoffMs)}ms`);
        await resp.text(); // consume body
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      if (!resp.ok) {
        console.error(`[tavily] API error: ${resp.status}`);
        await resp.text(); // consume body
        return null;
      }

      const data = await resp.json();
      return {
        answer: data.answer || undefined,
        results: (data.results || []).map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          content: r.content || "",
          score: r.score || 0,
        })),
        query: options.query,
      };
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        console.error(`[tavily] Request timed out (attempt ${attempt + 1}/${maxRetries})`);
      } else {
        console.error(`[tavily] Error (attempt ${attempt + 1}/${maxRetries}):`, e.message);
      }
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  console.error("[tavily] All retry attempts exhausted");
  return null;
}

/**
 * Run multiple Tavily searches in parallel.
 * Returns array of results (null for failed searches).
 */
export async function tavilySearchParallel(
  searches: TavilySearchOptions[],
  timeoutMs = 30000
): Promise<(TavilyResponse | null)[]> {
  return Promise.all(searches.map((s) => tavilySearch(s, timeoutMs)));
}

/**
 * Extract citation URLs from Tavily results.
 */
export function extractCitations(results: TavilyResult[]): string[] {
  return results
    .filter((r) => r.url)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.url)
    .slice(0, 10);
}

/**
 * Flatten Tavily results into a context string for LLM synthesis.
 */
export function buildSearchContext(results: TavilyResult[], maxItems = 10): string {
  return results
    .slice(0, maxItems)
    .map((r) => `${r.title}: ${r.content}`)
    .join("\n\n");
}
