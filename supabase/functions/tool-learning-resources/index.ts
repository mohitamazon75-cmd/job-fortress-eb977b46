import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a career technology advisor for Indian professionals in 2026.

For someone whose "${skill_name}" skill is being disrupted by "${tool_name}":

Return ONLY a JSON object (no markdown, no explanation, no text before or after):
{
  "tool_description": "One sentence about what ${tool_name} is and why it matters RIGHT NOW in 2026",
  "resources": [
    {
      "title": "Resource name",
      "url": "https://actual-working-url.com",
      "time_estimate": "e.g. 2-3 hours",
      "type": "course"
    }
  ],
  "top_credential": {
    "name": "Credential name",
    "url": "https://certification-url.com",
    "value": "Why employers care about this"
  },
  "weekend_project": {
    "title": "Project name",
    "description": "What to build and why it proves competency"
  }
}

CRITICAL RULES for resources:
- Include exactly 3 FREE resources
- URLs MUST be real, working URLs to official sites (e.g. coursera.org, youtube.com, docs.microsoft.com, cloud.google.com, freecodecamp.org)
- Never invent URLs. Use well-known platform URLs you are confident exist.
- type must be one of: "course", "video", "docs"
- Focus on the LATEST 2025-2026 version of ${tool_name}`;

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch learning resources" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Robust JSON extraction — find the JSON object in the response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content.trim());
    } catch {
      try {
        // Strip markdown fences and any surrounding text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch {
        console.error("Failed to parse AI response:", content.substring(0, 200));
        // Return a helpful fallback
        parsed = {
          tool_description: `${tool_name} is an AI tool disrupting ${skill_name}. Learn it to stay ahead.`,
          resources: [
            { title: `${tool_name} Official Documentation`, url: `https://www.google.com/search?q=${encodeURIComponent(tool_name + " official documentation 2026")}`, time_estimate: "2-3 hours", type: "docs" },
            { title: `Learn ${tool_name} - YouTube`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(tool_name + " tutorial 2026")}`, time_estimate: "1-2 hours", type: "video" },
            { title: `${tool_name} Courses - Coursera`, url: `https://www.coursera.org/search?query=${encodeURIComponent(tool_name)}`, time_estimate: "4-6 hours", type: "course" },
          ],
          weekend_project: { title: `Build a ${skill_name} workflow with ${tool_name}`, description: `Create a real project using ${tool_name} to automate part of your ${skill_name} workflow — proves you can operate the tool, not be replaced by it.` },
        };
      }
    }

    return new Response(
      JSON.stringify({ ...parsed, tool_name, skill_name }),
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
