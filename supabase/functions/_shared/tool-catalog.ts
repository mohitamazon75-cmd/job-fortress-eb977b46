// ═══════════════════════════════════════════════════════════════
// Tool Catalog — DB-backed source of truth for AI tool names
//
// Why: agent prompts used to hardcode product names + version
// suffixes (Midjourney v7, GPT-5, Claude 4 Opus, ...). Those go
// stale within months and cost editorial credibility. Instead we
// fetch the canonical list from skill_risk_matrix.replacement_tools
// (text[] column) and inject it into prompts via {{TOOL_CATALOG}}.
//
// Cached in-process for 10 min. On any DB error we return an empty
// catalog so callers can fall back to category language ("AI code
// assistants") rather than fail the scan.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ToolCatalog {
  /** Distinct, deduplicated tool names (case-preserved as stored). */
  tools: string[];
  /** Tools grouped by category if the column exists; otherwise a single "all" bucket. */
  categories: Record<string, string[]>;
}

const EMPTY: ToolCatalog = { tools: [], categories: {} };

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cached: { value: ToolCatalog; expiresAt: number } | null = null;

/**
 * Fetch the live tool catalog from skill_risk_matrix.replacement_tools.
 *
 * Uses an in-memory cache (10 min). Pass a service-role client so RLS
 * doesn't surprise you. Returns an empty catalog on any error — never
 * throws, never blocks the scan flow.
 */
export async function getCurrentToolCatalog(
  supabase: SupabaseClient,
): Promise<ToolCatalog> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    // Pull category + replacement_tools; UNNEST happens client-side because
    // the JS SDK doesn't expose array UNNEST directly without an RPC.
    const { data, error } = await supabase
      .from("skill_risk_matrix")
      .select("category, replacement_tools")
      .not("replacement_tools", "is", null);

    if (error || !Array.isArray(data)) {
      console.warn("[tool-catalog] DB fetch failed; returning empty catalog:", error?.message);
      cached = { value: EMPTY, expiresAt: now + 60_000 }; // short cache on failure
      return EMPTY;
    }

    const seen = new Set<string>();
    const categories: Record<string, Set<string>> = {};

    for (const row of data as Array<{ category: string | null; replacement_tools: string[] | null }>) {
      const cat = (row.category || "general").toLowerCase();
      const list = Array.isArray(row.replacement_tools) ? row.replacement_tools : [];
      for (const raw of list) {
        if (typeof raw !== "string") continue;
        const t = raw.trim();
        if (!t) continue;
        seen.add(t);
        (categories[cat] ??= new Set()).add(t);
      }
    }

    const value: ToolCatalog = {
      tools: [...seen].sort((a, b) => a.localeCompare(b)),
      categories: Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b))]),
      ),
    };

    cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch (e) {
    console.warn("[tool-catalog] Unexpected error; returning empty catalog:", e);
    cached = { value: EMPTY, expiresAt: now + 60_000 };
    return EMPTY;
  }
}

/**
 * Format a catalog for prompt injection. Compact, predictable shape:
 *
 *   AI TOOL CATALOG (current as of {date}):
 *   - coding: GitHub Copilot, Cursor, Devin
 *   - design: Figma AI, Midjourney
 *   - (general): Claude, ChatGPT
 *
 * If the catalog is empty we return a sentinel string so the model is
 * still warned — the prompt rule still bites.
 */
export function formatCatalog(catalog: ToolCatalog): string {
  if (!catalog.tools.length) {
    return "(catalog unavailable — use category language only, never invent product names)";
  }
  const cats = Object.entries(catalog.categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, tools]) => `- ${cat}: ${tools.join(", ")}`)
    .join("\n");
  return `AI TOOL CATALOG (canonical, fetched live):\n${cats}`;
}

/**
 * Test-only escape hatch — clears the in-process cache so unit tests
 * exercise the fetch path. Do not call from production code.
 */
export function _resetToolCatalogCacheForTests(): void {
  cached = null;
}
