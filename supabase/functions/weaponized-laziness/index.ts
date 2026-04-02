import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  const blocked = guardRequest(req, cors);
  if (blocked) return blocked;

  const { userId: _jwtUserId, blocked: jwtBlocked } = await validateJwtClaims(req, cors);
  if (jwtBlocked) return jwtBlocked;

  try {
    const { role, industry, seniority, responsibilities, toolsUsed, region } = await req.json();

    const seniorityLabel = seniority || "mid-level";
    const roleLabel = role || "professional";
    const industryLabel = industry || "technology";

    const prompt = `You are an expert productivity hacker and AI automation specialist. Generate a "Weaponized Laziness" card for a ${seniorityLabel} ${roleLabel} in ${industryLabel}${region ? ` (${region})` : ""}.

${responsibilities ? `Their key responsibilities: ${responsibilities}` : ""}
${toolsUsed ? `Tools they currently use: ${toolsUsed}` : ""}

Identify their single most painful, time-consuming, repetitive task and show them exactly how to automate it TODAY.

Return a JSON object with these exact fields:
- worstJobTask: The specific painful task they probably hate (be very specific to their role, e.g. "Formatting Weekly Vendor Reports" not just "reports")
- aiTool: The best AI tool for this exact task (real tool name like "Claude 3.5 Sonnet", "ChatGPT-4o", "Gemini Advanced", "Perplexity Pro", etc.)
- exactAiPrompt: A complete, ready-to-paste prompt they can use RIGHT NOW. Should be detailed enough to actually work (3-5 sentences). Include role-playing instruction, input format, and desired output format.
- timeSaved: Estimated time saved per occurrence (e.g. "2 Hours", "45 Minutes", "3 Hours")
- funnyAlibi: A humorous, corporate-sounding excuse for what they were "actually doing" while AI did the work (e.g. "Deep strategic alignment work", "Cross-functional synergy mapping"). Should be funny but plausible.
- effectivenessScore: Number 1-100 representing how well this automation actually works
- generatedAt: Current ISO timestamp

CRITICAL: 
- The task must be genuinely painful and common for this specific role
- The AI prompt must ACTUALLY WORK if pasted into the recommended tool
- The funny alibi should make someone smile
- Match specificity to role: a data analyst gets Excel/SQL tasks, a marketer gets content tasks, etc.
- The time saved must be realistic

Return ONLY valid JSON, no markdown.`;

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[weaponized-laziness] AI API error:", errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const aiResult = await response.json();
    logTokenUsage("weaponized-laziness", null, "google/gemini-3-flash-preview", aiResult);
    const raw = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const lastBrace = raw.lastIndexOf("}");
      if (lastBrace > 0) {
        parsed = JSON.parse(raw.slice(0, lastBrace + 1));
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const result = {
      worstJobTask: parsed.worstJobTask || "Formatting Weekly Reports",
      aiTool: parsed.aiTool || "Claude 3.5 Sonnet",
      exactAiPrompt: parsed.exactAiPrompt || "Act as a data analyst and convert this raw data into a structured comparison table with key metrics highlighted.",
      timeSaved: parsed.timeSaved || "2 Hours",
      funnyAlibi: parsed.funnyAlibi || "Deep strategic alignment work.",
      effectivenessScore: Math.min(100, Math.max(1, parsed.effectivenessScore || 80)),
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[weaponized-laziness] Error:", error);

    return new Response(
      JSON.stringify({
        worstJobTask: "Formatting Weekly Vendor Reports",
        aiTool: "Claude 3.5 Sonnet",
        exactAiPrompt: "Act as a data analyst and convert this raw vendor data into a structured comparison table with key metrics, percentage changes, and executive summary.",
        timeSaved: "2 Hours",
        funnyAlibi: "Deep strategic alignment work.",
        effectivenessScore: 82,
        generatedAt: new Date().toISOString(),
        _fallback: true,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
