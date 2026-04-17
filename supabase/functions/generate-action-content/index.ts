import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";



const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { prompt, title } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 503, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are JobBachao's Career Action Expert — a brutally honest, India-focused career strategist.

RULES:
- Write DIRECTLY for the user. No meta-commentary. No "Here's your..." preamble.
- Start with the output immediately (e.g. the cover letter, the LinkedIn post, the plan).
- Be specific — use the exact names, companies, skills, and numbers provided.
- Indian market context: salaries in ₹ LPA, Indian companies, Indian job platforms.
- Tone: confident, direct, professional. Not desperate or apologetic.
- Use markdown formatting for readability (headers, bold, bullet points).
- Keep it actionable and ready to use — the user should be able to copy and paste directly.`;

      const aiCtrl = new AbortController();
      const aiT = setTimeout(() => aiCtrl.abort(), 30_000);
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: 4000,
        temperature: 0.4,
      }),
        signal: aiCtrl.signal,
    });
      clearTimeout(aiT);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error(`[generate-action] AI error ${response.status}:`, errText.slice(0, 200));
      return new Response(
        JSON.stringify({ error: "AI temporarily unavailable. Please try again." }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[generate-action] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
