/**
 * community-signals.ts
 * Free, unauthenticated community intelligence sources.
 * No API keys required for any of these integrations.
 */

// ─── Hacker News (Algolia API) ────────────────────────────────────────────────
// Completely free, no auth. 10,000+ req/day.
export interface HNStory {
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
  objectID: string;
}

export async function fetchHNSignals(
  query: string,
  options: { maxResults?: number; daysBack?: number } = {}
): Promise<HNStory[]> {
  const { maxResults = 5, daysBack = 30 } = options;
  const since = Math.floor((Date.now() - daysBack * 86400000) / 1000);

  try {
    const params = new URLSearchParams({
      query,
      tags: "story",
      numericFilters: `created_at_i>${since},points>5`,
      hitsPerPage: String(maxResults),
    });
    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || []).map((h: any) => ({
      title: h.title || "",
      url: h.url || null,
      points: h.points || 0,
      num_comments: h.num_comments || 0,
      created_at: h.created_at || "",
      objectID: h.objectID || "",
    }));
  } catch {
    return [];
  }
}

// ─── Stack Exchange (Stack Overflow) ─────────────────────────────────────────
// Free tier: 300 req/day unauthenticated. Tags endpoint gives real demand signal.
export interface StackTag {
  name: string;
  count: number;
  has_synonyms: boolean;
  is_required: boolean;
  is_moderator_only: boolean;
}

export async function fetchStackTagTrends(
  tags: string[],
  options: { maxResults?: number } = {}
): Promise<StackTag[]> {
  const { maxResults = 10 } = options;
  if (tags.length === 0) return [];

  try {
    const tagQuery = tags.slice(0, 5).map(encodeURIComponent).join(";");
    const params = new URLSearchParams({
      order: "desc",
      sort: "popular",
      inname: tags[0], // Search by primary tag
      site: "stackoverflow",
      pagesize: String(maxResults),
      filter: "!4*IiIoIJRq9F5ILX",
    });
    const res = await fetch(`https://api.stackexchange.com/2.3/tags?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((t: any) => ({
      name: t.name || "",
      count: t.count || 0,
      has_synonyms: t.has_synonyms || false,
      is_required: t.is_required || false,
      is_moderator_only: t.is_moderator_only || false,
    }));
  } catch {
    return [];
  }
}

// Fetch trending questions for a skill to gauge current demand
export interface StackQuestion {
  title: string;
  score: number;
  answer_count: number;
  view_count: number;
  tags: string[];
  link: string;
  creation_date: number;
}

export async function fetchStackQuestions(
  query: string,
  options: { maxResults?: number; daysBack?: number } = {}
): Promise<StackQuestion[]> {
  const { maxResults = 5, daysBack = 30 } = options;
  const fromDate = Math.floor((Date.now() - daysBack * 86400000) / 1000);

  try {
    const params = new URLSearchParams({
      order: "desc",
      sort: "votes",
      intitle: query,
      site: "stackoverflow",
      pagesize: String(maxResults),
      fromdate: String(fromDate),
      filter: "!9Z(-wwYGT",
    });
    const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((q: any) => ({
      title: q.title || "",
      score: q.score || 0,
      answer_count: q.answer_count || 0,
      view_count: q.view_count || 0,
      tags: q.tags || [],
      link: q.link || "",
      creation_date: q.creation_date || 0,
    }));
  } catch {
    return [];
  }
}

// ─── GitHub Trending / Repository Search ────────────────────────────────────
// Unauthenticated: 60 req/hour. With GITHUB_TOKEN: 5000 req/hour.
export interface GitHubRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  topics: string[];
  pushed_at: string;
}

export async function fetchGitHubTrending(
  query: string,
  options: { language?: string; maxResults?: number; daysBack?: number; githubToken?: string } = {}
): Promise<GitHubRepo[]> {
  const { language, maxResults = 5, daysBack = 30, githubToken } = options;
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  try {
    let q = `${query} created:>${since} stars:>10`;
    if (language) q += ` language:${language}`;

    const params = new URLSearchParams({
      q,
      sort: "stars",
      order: "desc",
      per_page: String(maxResults),
    });

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (githubToken) headers["Authorization"] = `Bearer ${githubToken}`;

    const res = await fetch(`https://api.github.com/search/repositories?${params}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).slice(0, maxResults).map((r: any) => ({
      full_name: r.full_name || "",
      description: r.description || null,
      stargazers_count: r.stargazers_count || 0,
      language: r.language || null,
      html_url: r.html_url || "",
      topics: r.topics || [],
      pushed_at: r.pushed_at || "",
    }));
  } catch {
    return [];
  }
}

// ─── Context Builder ─────────────────────────────────────────────────────────
// Formats community signals into a compact string for LLM context injection.
export function buildCommunityContext(
  hnStories: HNStory[],
  stackQuestions: StackQuestion[],
  githubRepos: GitHubRepo[]
): string {
  const parts: string[] = [];

  if (hnStories.length > 0) {
    parts.push("HACKER NEWS COMMUNITY SIGNALS:");
    hnStories.forEach((s) => {
      parts.push(`  • "${s.title}" — ${s.points} pts, ${s.num_comments} comments`);
    });
  }

  if (stackQuestions.length > 0) {
    parts.push("\nSTACK OVERFLOW DEVELOPER ACTIVITY:");
    stackQuestions.forEach((q) => {
      parts.push(`  • "${q.title}" — ${q.view_count.toLocaleString()} views, ${q.answer_count} answers`);
    });
  }

  if (githubRepos.length > 0) {
    parts.push("\nGITHUB EMERGING TOOLS:");
    githubRepos.forEach((r) => {
      parts.push(`  • ${r.full_name}: ${r.description || "no description"} (⭐${r.stargazers_count.toLocaleString()})`);
    });
  }

  return parts.join("\n");
}
