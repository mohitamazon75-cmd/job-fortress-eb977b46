// ═══════════════════════════════════════════════════════════════
// Skill Demand Validator — Live market validation of KG skill risks
// P1: Adjusts static automation_risk by ±5 based on current demand
// ═══════════════════════════════════════════════════════════════

import { tavilySearch, buildSearchContext } from "./tavily-search.ts";
import { fetchStackTagTrends } from "./community-signals.ts";
import type { SkillRiskRow } from "./deterministic-engine.ts";
import { logTokenUsage } from "./token-tracker.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FAST_MODEL = "google/gemini-3-flash-preview";

// In-memory cache: "industry:skill1,skill2" → { result, ts }
const validationCache = new Map<string, { result: SkillDemandResult[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_ENTRIES = 200; // Prevent unbounded memory growth

export interface SkillDemandResult {
  skill_name: string;
  adjustment: number; // -5 to +5
  demand_signal: "hot" | "stable" | "cooling" | "unknown";
  evidence: string; // one-line reason
}

export interface SkillValidationOutput {
  adjustedRows: SkillRiskRow[];
  demandResults: SkillDemandResult[];
  search_grounded: boolean;
}

/**
 * Validate the user's top skills against live market demand.
 * Uses a SINGLE batched Tavily search + LLM call (not per-skill).
 *
 * Returns adjusted SkillRiskRow[] with automation_risk modified ±5.
 * Graceful fallback: returns original rows unchanged on any failure.
 */
export async function validateSkillDemand(
  allSkillRiskRows: SkillRiskRow[],
  userSkills: string[],
  industry: string,
  role: string,
  country?: string | null,
): Promise<SkillValidationOutput> {
  const fallback: SkillValidationOutput = {
    adjustedRows: allSkillRiskRows,
    demandResults: [],
    search_grounded: false,
  };

  // Pick top 5 skills that exist in KG (most impactful to validate)
  const kgSkillNames = new Set(allSkillRiskRows.map((r) => r.skill_name.toLowerCase()));
  const topSkills = userSkills
    .filter((s) => kgSkillNames.has(s.toLowerCase()) || allSkillRiskRows.some((r) => r.skill_name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.skill_name.toLowerCase())))
    .slice(0, 5);

  if (topSkills.length === 0) {
    console.log("[SkillValidator] No matchable skills to validate");
    return fallback;
  }

  // Check cache
  const cacheKey = `${industry.toLowerCase()}:${topSkills.map((s) => s.toLowerCase()).sort().join(",")}`;
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[SkillValidator] Cache hit for ${topSkills.length} skills`);
    return {
      adjustedRows: applyAdjustments(allSkillRiskRows, cached.result),
      demandResults: cached.result,
      search_grounded: true,
    };
  }

  try {
    // Step 1: Single batched Tavily search
    const currentYear = new Date().getFullYear();
    const skillList = topSkills.join('" OR "');
    const searchQuery = `("${skillList}") (hiring OR demand OR "job postings" OR automation OR "AI replacing" OR "in demand") ${industry} ${currentYear}`;

    console.log(`[SkillValidator] Searching demand for ${topSkills.length} skills in ${industry}`);

    const searchResult = await tavilySearch(
      {
        query: searchQuery,
        searchDepth: "basic",
        maxResults: 8,
        topic: "news",
        days: 60,
        includeAnswer: true,
      },
      8_000,
      1, // single retry — speed over reliability here
    );

    if (!searchResult || searchResult.results.length === 0) {
      console.log("[SkillValidator] No search results, returning unchanged");
      return fallback;
    }

    console.log(`[SkillValidator] Got ${searchResult.results.length} results`);

    // Step 1b: Parallel Stack Overflow tag trends (free, no auth required)
    const stackTags = await fetchStackTagTrends(topSkills, { maxResults: topSkills.length }).catch(() => []);
    const stackContext = stackTags.length > 0
      ? `\nSTACK OVERFLOW TAG POPULARITY (real developer activity):\n${stackTags.map(t => `  ${t.name}: ${t.count.toLocaleString()} questions`).join("\n")}`
      : "";
    console.log(`[SkillValidator] Got Stack Overflow data for ${stackTags.length} tags`);

    // Step 2: LLM synthesis — single call for all skills
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return fallback;

    const searchContext = buildSearchContext(searchResult.results, 8);
    const tavilyAnswer = searchResult.answer || "";

    // Build current KG values for context
    const kgContext = topSkills.map((skill) => {
      const row = allSkillRiskRows.find((r) => r.skill_name.toLowerCase() === skill.toLowerCase() || r.skill_name.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(r.skill_name.toLowerCase()));
      return `- ${skill}: current_automation_risk=${row?.automation_risk ?? "unknown"}%, demand_trend=${row?.india_demand_trend ?? "unknown"}`;
    }).join("\n");

    const systemPrompt = `You are a labor market analyst. Given recent search results about skill demand, assess whether each skill's automation risk should be adjusted UP or DOWN based on current market evidence.

Return ONLY valid JSON array:
[
  {
    "skill_name": "<exact skill name from the list>",
    "adjustment": <integer from -5 to +5>,
    "demand_signal": "hot" | "stable" | "cooling",
    "evidence": "<one sentence citing specific data>"
  }
]

Adjustment rules:
- +3 to +5: Strong evidence skill is being automated/displaced (AI tools replacing it, job postings declining sharply)
- +1 to +2: Moderate automation signals (some AI tools emerging, mixed demand)
- 0: No clear signal or conflicting evidence
- -1 to -2: Skill is in moderate demand (steady hiring, human-preferred)
- -3 to -5: Skill is HOT/growing demand (surge in hiring, AI can't replace it, premium salaries)

CRITICAL:
- Only adjust based on ACTUAL EVIDENCE from search results
- If no evidence for a skill, set adjustment=0 and demand_signal="stable"
- Be conservative — default to 0 if uncertain
- Return entries for ALL skills in the list`;

    const userPrompt = `Industry: ${industry}
Role: ${role}${country ? `\nCountry: ${country}` : ""}

Skills to validate:
${kgContext}

Tavily Summary: ${tavilyAnswer}

Recent Market Data:
${searchContext}${stackContext}`;

    const controller = new AbortController();
    const llmTimeout = setTimeout(() => controller.abort(), 6_000);

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
        temperature: 0.05,
      }),
      signal: controller.signal,
    });

    clearTimeout(llmTimeout);

    if (!aiResp.ok) {
      console.error(`[SkillValidator] AI error: ${aiResp.status}`);
      await aiResp.text();
      return fallback;
    }

    const aiData = await aiResp.json();
    logTokenUsage("skill-demand-validator", null, FAST_MODEL, aiData);
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Sanitize leading '+' signs in numbers (e.g. "+2" → "2") which are invalid JSON
    const sanitized = cleaned.replace(/:\s*\+(\d)/g, ": $1");
    const parsed = JSON.parse(sanitized);

    if (!Array.isArray(parsed)) return fallback;

    const demandResults: SkillDemandResult[] = parsed
      .filter((item: any) => item && typeof item.skill_name === "string")
      .map((item: any) => ({
        skill_name: String(item.skill_name),
        adjustment: Math.min(5, Math.max(-5, Math.round(Number(item.adjustment) || 0))),
        demand_signal: ["hot", "stable", "cooling"].includes(item.demand_signal) ? item.demand_signal : "unknown",
        evidence: String(item.evidence || "No specific evidence"),
      }));

    // Log adjustments
    const nonZero = demandResults.filter((d) => d.adjustment !== 0);
    if (nonZero.length > 0) {
      console.log(`[SkillValidator] Adjustments: ${nonZero.map((d) => `${d.skill_name}: ${d.adjustment > 0 ? "+" : ""}${d.adjustment} (${d.demand_signal})`).join(", ")}`);
    } else {
      console.log("[SkillValidator] All skills validated — no adjustments needed");
    }

    // Cache (evict oldest if at capacity)
    if (validationCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = validationCache.keys().next().value;
      if (oldest) validationCache.delete(oldest);
    }
    validationCache.set(cacheKey, { result: demandResults, ts: Date.now() });

    return {
      adjustedRows: applyAdjustments(allSkillRiskRows, demandResults),
      demandResults,
      search_grounded: true,
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error("[SkillValidator] Timed out");
    } else {
      console.error("[SkillValidator] Error:", e.message);
    }
    return fallback;
  }
}

/**
 * Apply demand adjustments to skill risk rows.
 * Creates new copies — does not mutate originals.
 */
function applyAdjustments(rows: SkillRiskRow[], adjustments: SkillDemandResult[]): SkillRiskRow[] {
  if (adjustments.length === 0) return rows;

  const adjMap = new Map<string, SkillDemandResult>();
  for (const adj of adjustments) {
    adjMap.set(adj.skill_name.toLowerCase(), adj);
  }

  return rows.map((row) => {
    const adj = adjMap.get(row.skill_name.toLowerCase());
    if (!adj || adj.adjustment === 0) return row;

    const newRisk = Math.min(95, Math.max(5, row.automation_risk + adj.adjustment));
    const newTrend = adj.demand_signal === "hot" ? "rising"
      : adj.demand_signal === "cooling" ? "declining"
      : row.india_demand_trend;

    return {
      ...row,
      automation_risk: newRisk,
      india_demand_trend: newTrend,
    };
  });
}
