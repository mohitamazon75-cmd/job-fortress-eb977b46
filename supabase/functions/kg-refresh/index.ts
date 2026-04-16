import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
// Process job families in batches to avoid rate limits
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchFirecrawl(apiKey: string, query: string): Promise<string[]> {
  try {
    const fcController = new AbortController();
    const fcTimeout = setTimeout(() => fcController.abort(), 15_000);
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5, lang: "en", country: "in", tbs: "qdr:m" }),
      signal: fcController.signal,
    });
    clearTimeout(fcTimeout);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || [])
      .filter((item: any) => item.title || item.description)
      .map((item: any) => `${item.title || ""}: ${item.description || ""}`);
  } catch {
    return [];
  }
}

async function synthesizeWithGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<any | null> {
  try {
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
      signal: aiController.signal,
    });
    clearTimeout(aiTimeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    logTokenUsage("kg-refresh", null, "google/gemini-3-flash-preview", data);
    const content = data.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function refreshMarketSignals(
  supabase: any,
  firecrawlKey: string,
  lovableKey: string,
  jobFamilies: string[]
): Promise<number> {
  let updated = 0;

  for (let i = 0; i < jobFamilies.length; i += BATCH_SIZE) {
    const batch = jobFamilies.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (jobFamily) => {
        const readableRole = jobFamily.replace(/_/g, " ");

        // Search for market data
        const articles = await searchFirecrawl(
          firecrawlKey,
          `${readableRole} jobs India salary hiring trend 2026`
        );

        if (articles.length === 0) return null;

        const parsed = await synthesizeWithGemini(
          lovableKey,
          `Extract job market signals for "${readableRole}" in India from the provided data. Return ONLY valid JSON:
{
  "posting_change_pct": number (YoY % change),
  "avg_salary_change_pct": number (YoY % change),
  "ai_job_mentions_pct": number (% of postings mentioning AI/ML),
  "market_health": "BOOMING" | "GROWING" | "STABLE" | "DECLINING" | "CRITICAL"
}
Base ONLY on provided data. No markdown.`,
          `Market data for ${readableRole} in India:\n\n${articles.join("\n\n")}`
        );
        // Use article count as proxy for posting volume (actual search result count)
        if (parsed) {
          parsed.posting_volume_proxy = articles.length;
          parsed.posting_volume_source = "search_result_count";
          parsed.posting_volume_note = "Based on web search result count — not a live job board count";
        }

        if (!parsed) return null;

        return { jobFamily, data: parsed };
      })
    );

    // Upsert results
    for (const result of results) {
      if (!result) continue;

      for (const tier of ["tier1", "tier2"]) {
        const { error } = await supabase
          .from("market_signals")
          .upsert(
            {
              job_family: result.jobFamily,
              metro_tier: tier,
              posting_volume_proxy: result.data.posting_volume_proxy || 0,
              posting_volume_source: result.data.posting_volume_source || "search_result_count",
              posting_change_pct: result.data.posting_change_pct || 0,
              avg_salary_change_pct: result.data.avg_salary_change_pct || 0,
              ai_job_mentions_pct: result.data.ai_job_mentions_pct || 0,
              market_health: result.data.market_health || "STABLE",
              snapshot_date: new Date().toISOString().split("T")[0],
            },
            { onConflict: "job_family,metro_tier" }
          );

        if (!error) updated++;
      }
    }

    if (i + BATCH_SIZE < jobFamilies.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return updated;
}

async function refreshSkillRisks(
  supabase: any,
  firecrawlKey: string,
  lovableKey: string
): Promise<number> {
  // Get existing skills
  const { data: skills } = await supabase
    .from("skill_risk_matrix")
    .select("skill_name, category")
    .limit(100);

  if (!skills || skills.length === 0) return 0;

  let updated = 0;
  const skillNames = skills.map((s: any) => s.skill_name);

  // Process in batches of categories
  const categories = [...new Set(skills.map((s: any) => s.category))];

  for (const category of categories) {
    const catSkills = skills.filter((s: any) => s.category === category);
    const skillList = catSkills.map((s: any) => s.skill_name).join(", ");

    const articles = await searchFirecrawl(
      firecrawlKey,
      `${category} skills AI automation risk India 2026 ${skillList.slice(0, 100)}`
    );

    if (articles.length === 0) continue;

    const parsed = await synthesizeWithGemini(
      lovableKey,
      `Update automation risk scores for these ${category} skills based on latest data. Return ONLY valid JSON:
{
  "skills": [
    {
      "skill_name": "exact skill name from input",
      "automation_risk": number (0-100),
      "ai_augmentation_potential": number (0-100),
      "india_demand_trend": "rising" | "stable" | "declining",
      "replacement_tools": ["tool1", "tool2"]
    }
  ]
}

TOOL NAME CURRENCY — use ONLY current 2025-2026 tool names:
"Google Bard" → "Google Gemini". "DALL-E 2" → "DALL-E 3". "Bing Chat" → "Microsoft Copilot".
"ChatGPT-3/GPT-3" → "ChatGPT/GPT-4o". "Jasper AI"/"Copy.ai" → "ChatGPT" or "Claude".
"Stable Diffusion 1.x/2.x" → "Stable Diffusion 3" or "FLUX".

Skills to assess: ${skillList}
Base ONLY on provided data. No markdown.`,
      `Latest data on ${category} skills and AI automation:\n\n${articles.join("\n\n")}`
    );

    if (!parsed?.skills) continue;

    for (const skill of parsed.skills) {
      if (!skillNames.includes(skill.skill_name)) continue;

      const { error } = await supabase
        .from("skill_risk_matrix")
        .update({
          automation_risk: skill.automation_risk,
          ai_augmentation_potential: skill.ai_augmentation_potential,
          india_demand_trend: skill.india_demand_trend,
          replacement_tools: skill.replacement_tools || [],
        })
        .eq("skill_name", skill.skill_name);

      if (!error) updated++;
    }

    await sleep(BATCH_DELAY_MS);
  }

  return updated;
}

async function refreshJobTaxonomy(
  supabase: any,
  firecrawlKey: string,
  lovableKey: string,
  jobFamilies: string[]
): Promise<number> {
  let updated = 0;

  // Sample 10 job families per run to stay within rate limits
  const sampled = jobFamilies.sort(() => Math.random() - 0.5).slice(0, 10);

  for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
    const batch = sampled.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (jobFamily) => {
        const readableRole = jobFamily.replace(/_/g, " ");

        const articles = await searchFirecrawl(
          firecrawlKey,
          `${readableRole} AI tools automation salary India 2026`
        );

        if (articles.length === 0) return null;

        const parsed = await synthesizeWithGemini(
          lovableKey,
          `Update job taxonomy data for "${readableRole}" in India based on latest information. Return ONLY valid JSON:
{
  "disruption_baseline": number (0-100, how automatable this role is),
  "avg_salary_lpa": number (average salary in lakhs per annum),
  "automatable_tasks": ["task1", "task2", "task3"],
  "ai_tools_replacing": ["tool1", "tool2", "tool3"]
}
Base ONLY on provided data. No markdown.`,
          `Latest data for ${readableRole} in India:\n\n${articles.join("\n\n")}`
        );

        if (!parsed) return null;
        return { jobFamily, data: parsed };
      })
    );

    for (const result of results) {
      if (!result) continue;

      const updateData: any = {};
      if (result.data.disruption_baseline != null) updateData.disruption_baseline = result.data.disruption_baseline;
      if (result.data.avg_salary_lpa != null) updateData.avg_salary_lpa = result.data.avg_salary_lpa;
      if (result.data.automatable_tasks) updateData.automatable_tasks = result.data.automatable_tasks;
      if (result.data.ai_tools_replacing) updateData.ai_tools_replacing = result.data.ai_tools_replacing;

      if (Object.keys(updateData).length === 0) continue;

      const { error } = await supabase
        .from("job_taxonomy")
        .update(updateData)
        .eq("job_family", result.jobFamily);

      if (!error) updated++;
    }

    if (i + BATCH_SIZE < sampled.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  const startTime = Date.now();

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FIRECRAWL_API_KEY || !LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createAdminClient();

    // Get all job families
    const { data: jobRows } = await supabase
      .from("job_taxonomy")
      .select("job_family")
      .order("job_family");

    const jobFamilies = (jobRows || []).map((r: any) => r.job_family);

    if (jobFamilies.length === 0) {
      return new Response(
        JSON.stringify({ error: "No job families found in taxonomy" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[kg-refresh] Starting refresh for ${jobFamilies.length} job families`);

    // Run all three refreshes
    const [marketUpdated, skillsUpdated, taxonomyUpdated] = await Promise.all([
      refreshMarketSignals(supabase, FIRECRAWL_API_KEY, LOVABLE_API_KEY, jobFamilies),
      refreshSkillRisks(supabase, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      refreshJobTaxonomy(supabase, FIRECRAWL_API_KEY, LOVABLE_API_KEY, jobFamilies),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[kg-refresh] Complete in ${elapsed}s: market=${marketUpdated}, skills=${skillsUpdated}, taxonomy=${taxonomyUpdated}`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_seconds: parseFloat(elapsed),
        updates: {
          market_signals: marketUpdated,
          skill_risk_matrix: skillsUpdated,
          job_taxonomy: taxonomyUpdated,
        },
        job_families_total: jobFamilies.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kg-refresh] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
