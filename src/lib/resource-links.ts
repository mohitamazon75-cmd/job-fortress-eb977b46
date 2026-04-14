/**
 * resource-links.ts
 *
 * Central utility for building RELIABLE external resource links.
 *
 * Problem: LLMs hallucinate specific article/course URLs constantly.
 * "hbr.org/p-and-l-basics" looks real but returns 404.
 * "coursera.org/learn/python-for-everybody-2025" — the slug changes.
 *
 * Solution: NEVER use the specific URL the LLM provides.
 * Always build a platform-specific search URL from title + author.
 * This is guaranteed to work because search pages always exist.
 *
 * Additionally: for known domains we recognise, route to THEIR search
 * so the user lands on a real search results page on the right platform.
 */

// ── Platform domain → search URL builder ──────────────────────────────
// Maps recognised platform keywords to their working search endpoints.
const PLATFORM_SEARCH: Record<string, (q: string) => string> = {
  coursera:     (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
  udemy:        (q) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`,
  linkedin:     (q) => `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(q)}`,
  youtube:      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  hbr:          (q) => `https://hbr.org/search?term=${encodeURIComponent(q)}`,
  mckinsey:     (q) => `https://www.mckinsey.com/search#q=${encodeURIComponent(q)}`,
  amazon:       (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  nptel:        (q) => `https://nptel.ac.in/courses?search=${encodeURIComponent(q)}`,
  edx:          (q) => `https://www.edx.org/search?q=${encodeURIComponent(q)}`,
  freecodecamp: (q) => `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(q)}`,
  medium:       (q) => `https://medium.com/search?q=${encodeURIComponent(q)}`,
  substack:     (q) => `https://substack.com/search/${encodeURIComponent(q)}`,
  skillshare:   (q) => `https://www.skillshare.com/en/search?query=${encodeURIComponent(q)}`,
  pluralsight:  (q) => `https://www.pluralsight.com/search?q=${encodeURIComponent(q)}`,
  oreilly:      (q) => `https://www.oreilly.com/search/?q=${encodeURIComponent(q)}`,
  google:       (q) => `https://developers.google.com/s/results/training?q=${encodeURIComponent(q)}`,
  microsoft:    (q) => `https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(q)}`,
  aws:          (q) => `https://explore.skillbuilder.aws/learn/catalog?searchText=${encodeURIComponent(q)}`,
  ted:          (q) => `https://www.ted.com/search?q=${encodeURIComponent(q)}`,
  tedx:         (q) => `https://www.ted.com/search?q=${encodeURIComponent(q)}`,
  spotify:      (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  wharton:      (q) => `https://executiveeducation.wharton.upenn.edu/search/?q=${encodeURIComponent(q)}`,
  insead:       (q) => `https://www.insead.edu/search?q=${encodeURIComponent(q)}`,
};

// ── Domains that are SAFE to use directly (Tavily-grounded, not LLM-hallucinated) ──
const TRUSTED_SEARCH_PAGES = new Set([
  'youtube.com/results',
  'coursera.org/search',
  'udemy.com/courses/search',
  'amazon.in/s',
  'amazon.com/s',
  'google.com/search',
  'linkedin.com/learning/search',
  'nptel.ac.in/courses',
  'edx.org/search',
]);

/**
 * Checks if a URL is a search page (always safe to link to).
 */
function isSearchPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostAndPath = parsed.hostname.replace('www.', '') + parsed.pathname;
    return TRUSTED_SEARCH_PAGES.has(hostAndPath) ||
      parsed.pathname.includes('/search') ||
      parsed.pathname.includes('/results') ||
      parsed.search.includes('query=') ||
      parsed.search.includes('search_query=') ||
      parsed.search.includes('?q=') ||
      parsed.search.includes('?k=');
  } catch {
    return false;
  }
}

/**
 * Extracts the platform name from a URL hostname.
 */
function extractPlatform(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
    // Match to known platforms
    for (const key of Object.keys(PLATFORM_SEARCH)) {
      if (hostname.includes(key)) return key;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Detects platform from a platform/author string (e.g. "Coursera", "YouTube").
 */
function detectPlatformFromString(str: string): string | null {
  const lower = (str || '').toLowerCase();
  for (const key of Object.keys(PLATFORM_SEARCH)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

/**
 * buildResourceUrl — THE SINGLE SOURCE OF TRUTH for all external resource links.
 *
 * Strategy:
 * 1. If LLM provided URL is a SEARCH page → use it (search pages always work)
 * 2. If LLM provided URL has a recognised platform → redirect to THAT platform's search
 * 3. Fall back to type-based search (YouTube for videos, Coursera for courses, etc.)
 *
 * We NEVER use a specific LLM-generated article/page URL directly — they hallucinate.
 *
 * @param title - Resource title (from LLM output)
 * @param authorOrPlatform - Author name or platform (from LLM output)
 * @param type - Resource type
 * @param llmUrl - URL from LLM (untrusted — may be hallucinated)
 */
export function buildResourceUrl(
  title: string,
  authorOrPlatform: string,
  type: 'book' | 'course' | 'video' | 'blog' | 'article' | 'docs',
  llmUrl?: string | null,
): string {
  const query = [title, authorOrPlatform].filter(Boolean).join(' ').trim() ||
    title || authorOrPlatform || 'resource';

  // 1. If the LLM URL is already a search page, trust it
  if (llmUrl && isSearchPage(llmUrl)) return llmUrl;

  // 2. If the LLM URL has a recognisable platform, route to that platform's search
  if (llmUrl) {
    const platformFromUrl = extractPlatform(llmUrl);
    if (platformFromUrl && PLATFORM_SEARCH[platformFromUrl]) {
      return PLATFORM_SEARCH[platformFromUrl](query);
    }
  }

  // 3. Detect platform from the authorOrPlatform string
  const platformFromStr = detectPlatformFromString(authorOrPlatform);
  if (platformFromStr && PLATFORM_SEARCH[platformFromStr]) {
    return PLATFORM_SEARCH[platformFromStr](query);
  }

  // 4. Fall back to type-based defaults (these always exist)
  switch (type) {
    case 'book':
      return `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    case 'video':
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    case 'course':
      return `https://www.coursera.org/search?query=${encodeURIComponent(query)}`;
    case 'blog':
    case 'article':
      // For articles/blogs, if we can detect the domain from URL, search their site
      if (llmUrl) {
        try {
          const hostname = new URL(llmUrl).hostname;
          return `https://www.google.com/search?q=site:${hostname}+${encodeURIComponent(query)}`;
        } catch { /* ignore */ }
      }
      return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    case 'docs':
      if (llmUrl) {
        try {
          const { hostname } = new URL(llmUrl);
          return `https://${hostname}`; // At least link to the homepage, not a hallucinated path
        } catch { /* ignore */ }
      }
      return `https://www.google.com/search?q=${encodeURIComponent(query + ' documentation')}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

/**
 * buildJobSearchUrl — for job board links.
 * LLMs often hallucinate specific job posting IDs. Route to search instead.
 */
export function buildJobSearchUrl(title: string, company?: string, location?: string): string {
  const parts = [title, company, location].filter(Boolean).join(' ');
  return `https://www.naukri.com/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}-jobs?${
    company ? `comid=&company=${encodeURIComponent(company)}&` : ''
  }`;
}

/**
 * sanitizeExternalUrl — last-resort safety net.
 * Used when we don't know the type. Converts hallucinated URLs to safe searches.
 */
export function sanitizeExternalUrl(url: string | null | undefined, fallbackQuery?: string): string {
  if (!url) return fallbackQuery ? `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}` : '#';
  if (isSearchPage(url)) return url;

  // For Tavily/live-search URLs (these are real, grounded web results) — allow
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return '#';
    // Trusted news/research domains — Tavily returns real URLs for these
    const trustedDomains = ['reuters.com', 'bbc.com', 'techcrunch.com', 'wired.com',
      'thehindu.com', 'economictimes.indiatimes.com', 'ndtv.com', 'livemint.com',
      'moneycontrol.com', 'businessinsider.com', 'timesofindia.com'];
    if (trustedDomains.some(d => hostname.includes(d))) return url;
  } catch { return '#'; }

  // Everything else: build a Google search
  return `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery || url)}`;
}
