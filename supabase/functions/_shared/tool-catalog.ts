// ═══════════════════════════════════════════════════════════════
// Tool Catalog — DB-backed canonical list of AI tools
//
// Reads `replacement_tools` from `skill_risk_matrix` and produces a
// deduped, sorted catalog (global + per-category). Cached in module
// scope for 10 minutes (60s on error). Never throws.
//
// This module is currently UNUSED. Slices 8b/8c will wire it into
// agent-prompts.ts and post-processing scrubbers. Until then, no
// behavior change.
// ═══════════════════════════════════════════════════════════════

export interface ToolCatalog {
  tools: string[];
  categories: Record<string, string[]>;
}

interface CacheEntry {
  catalog: ToolCatalog;
  expiresAt: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

let cache: CacheEntry | null = null;

// Minimal supabase shape — avoids importing the full client type.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

const EMPTY_CATALOG: ToolCatalog = { tools: [], categories: {} };

export async function getCurrentToolCatalog(
  supabase: SupabaseLike,
): Promise<ToolCatalog> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.catalog;
  }

  try {
    const { data, error } = await supabase
      .from("skill_risk_matrix")
      .select("category, replacement_tools")
      .not("replacement_tools", "is", null);

    if (error) {
      console.warn(
        `[tool-catalog] DB error: ${error.message ?? String(error)}`,
      );
      cache = { catalog: EMPTY_CATALOG, expiresAt: now + ONE_MINUTE_MS };
      return EMPTY_CATALOG;
    }

    if (!Array.isArray(data)) {
      cache = { catalog: EMPTY_CATALOG, expiresAt: now + ONE_MINUTE_MS };
      return EMPTY_CATALOG;
    }

    const globalSet = new Set<string>();
    const catSets: Record<string, Set<string>> = {};

    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const tools = (row as { replacement_tools?: unknown }).replacement_tools;
      if (!Array.isArray(tools)) continue;

      const rawCat = (row as { category?: unknown }).category;
      const category = typeof rawCat === "string" && rawCat.trim().length > 0
        ? rawCat.trim()
        : "general";

      for (const t of tools) {
        if (typeof t !== "string") continue;
        const trimmed = t.trim();
        if (trimmed.length === 0) continue;
        globalSet.add(trimmed);
        if (!catSets[category]) catSets[category] = new Set();
        catSets[category].add(trimmed);
      }
    }

    const sortAlpha = (a: string, b: string) => a.localeCompare(b);
    const catalog: ToolCatalog = {
      tools: Array.from(globalSet).sort(sortAlpha),
      categories: Object.fromEntries(
        Object.entries(catSets).map(([k, v]) => [
          k,
          Array.from(v).sort(sortAlpha),
        ]),
      ),
    };

    cache = { catalog, expiresAt: now + TEN_MINUTES_MS };
    return catalog;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[tool-catalog] unexpected error: ${msg}`);
    cache = { catalog: EMPTY_CATALOG, expiresAt: now + ONE_MINUTE_MS };
    return EMPTY_CATALOG;
  }
}

export function formatCatalog(catalog: ToolCatalog): string {
  if (catalog.tools.length === 0) {
    return "(catalog unavailable — use category language only, never invent product names)";
  }
  const catNames = Object.keys(catalog.categories).sort((a, b) =>
    a.localeCompare(b)
  );
  const lines = ["AI TOOL CATALOG (canonical, fetched live):"];
  for (const cat of catNames) {
    const tools = [...catalog.categories[cat]].sort((a, b) =>
      a.localeCompare(b)
    );
    lines.push(`- ${cat}: ${tools.join(", ")}`);
  }
  return lines.join("\n");
}

export function _resetToolCatalogCacheForTests(): void {
  cache = null;
}
