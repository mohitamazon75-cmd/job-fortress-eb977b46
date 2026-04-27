import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const ActionContentSchema = z.object({
  // Prompts can be long but must be bounded — protects LLM cost.
  prompt: z.string().min(1).max(20_000),
  title: z.string().max(300).optional(),
  stream: z.boolean().optional(),
});

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  // P0 hardening: require valid JWT — this function streams paid LLM tokens.
  const auth = await requireAuth(req, corsHeaders);
  if (auth.kind === "unauthorized") return auth.response;

  try {
    const parsed = await validateBody(req, ActionContentSchema, corsHeaders);
    if (parsed.kind === "invalid") return parsed.response;
    const { prompt, title, stream: clientWantsStream = true } = { stream: true, ...parsed.data };

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

    const callAi = async (useStream: boolean) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45_000);
      try {
        return await fetch(AI_URL, {
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
            stream: useStream,
            max_tokens: 4000,
            temperature: 0.4,
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    };

    // Non-streaming branch — used as a reliable fallback by the client
    // when the streamed response comes back empty (intermittent OpenRouter issue).
    if (!clientWantsStream) {
      const response = await callAi(false);
      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const errText = await response.text();
        console.error(`[generate-action] AI error ${response.status}:`, errText.slice(0, 200));
        return new Response(JSON.stringify({ error: "AI temporarily unavailable. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content || "";
      if (!content.trim()) {
        return new Response(JSON.stringify({ error: "AI returned an empty response" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ content }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Streaming branch (default)
    const response = await callAi(true);

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
