/**
 * jina-reader.ts
 * Jina AI Reader — converts any URL to clean markdown.
 * Completely FREE, no API key, no rate limit documentation needed.
 * Usage: GET https://r.jina.ai/{target_url}
 */

export interface JinaResult {
  url: string;
  content: string;
  title: string;
  success: boolean;
}

/**
 * Fetch a URL and return clean markdown content via Jina AI Reader.
 * Falls back gracefully — never throws.
 */
export async function readUrlWithJina(
  targetUrl: string,
  options: { timeoutMs?: number; maxChars?: number } = {}
): Promise<JinaResult> {
  const { timeoutMs = 8000, maxChars = 3000 } = options;
  const fallback: JinaResult = { url: targetUrl, content: "", title: "", success: false };

  if (!targetUrl || !targetUrl.startsWith("http")) return fallback;

  try {
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const res = await fetch(jinaUrl, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return fallback;
    const text = await res.text();
    // Extract title from first line if it starts with "Title:"
    const lines = text.split("\n");
    const titleLine = lines.find(l => l.startsWith("Title:"));
    const title = titleLine ? titleLine.replace("Title:", "").trim() : "";
    const content = text.slice(0, maxChars);
    return { url: targetUrl, content, title, success: true };
  } catch {
    return fallback;
  }
}

/**
 * Enrich a list of URLs with full-text content.
 * Runs in parallel, always resolves (no throws).
 */
export async function enrichUrlsWithJina(
  urls: string[],
  options: { timeoutMs?: number; maxChars?: number; maxConcurrent?: number } = {}
): Promise<JinaResult[]> {
  const { maxConcurrent = 3 } = options;
  const results: JinaResult[] = [];
  const batches = [];
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    batches.push(urls.slice(i, i + maxConcurrent));
  }
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(url => readUrlWithJina(url, options))
    );
    results.push(...batchResults.map(r => r.status === "fulfilled" ? r.value : { url: "", content: "", title: "", success: false }));
  }
  return results;
}
