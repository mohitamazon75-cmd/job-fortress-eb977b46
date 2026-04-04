import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tool_name, skill_name } = await req.json();

    if (!tool_name || !skill_name) {
      return new Response(
        JSON.stringify({ error: "tool_name and skill_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Perplexity API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a career technology advisor. Return ONLY valid JSON, no markdown. Be specific, current, and actionable. Focus on the most popular and current version of the tool.",
          },
          {
            role: "user",
            content: `For a professional whose "${skill_name}" skill is being disrupted by "${tool_name}":

1. What is ${tool_name} exactly? (1 sentence)
2. What are the top 3 FREE learning resources to learn ${tool_name} RIGHT NOW in 2026? Include title, URL, and estimated time.
3. What is the #1 specific certification or credential for ${tool_name} that employers value?
4. What is one weekend project someone can build with ${tool_name} to prove competency?

Return as JSON:
{
  "tool_description": "...",
  "resources": [{"title": "...", "url": "...", "time_estimate": "...", "type": "course|video|docs"}],
  "top_credential": {"name": "...", "url": "...", "value": "..."},
  "weekend_project": {"title": "...", "description": "..."}
}`,
          },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch learning resources" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    // Try to parse the JSON response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, return raw content
      parsed = { raw: content };
    }

    return new Response(
      JSON.stringify({ ...parsed, citations, tool_name, skill_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("tool-learning-resources error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
