// ═══════════════════════════════════════════════════════════════
// Week 4 #12: Hindi/Hinglish verdict translation.
// Translates final verdicts using Gemini Flash for speed.
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { logTokenUsage } from "../_shared/token-tracker.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

const TranslateSchema = z.object({
  texts: z
    .array(z.object({ key: z.string().min(1).max(120), value: z.string().min(1).max(4000) }))
    .min(1)
    .max(50),
  target_language: z.enum(["hindi", "hinglish"]).optional(),
});

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // P0 hardening: require valid JWT — paid LLM call.
  const auth = await requireAuth(req, corsHeaders);
  if (auth.kind === "unauthorized") return auth.response;

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: jsonHeaders });
    }

    const validated = await validateBody(req, TranslateSchema, corsHeaders);
    if (validated.kind === "invalid") return validated.response;
    const { texts, target_language } = validated.data;

    const lang = target_language || "hindi";
    const isHinglish = lang === "hinglish";

    const systemPrompt = isHinglish
      ? `You are a professional translator. Translate the following career analysis texts into Hinglish (Hindi written in Roman/Latin script, mixed with common English terms). Keep technical terms, company names, tool names, and numbers in English. Output ONLY valid JSON mapping each key to its translation. No markdown.`
      : `You are a professional translator. Translate the following career analysis texts into Hindi (Devanagari script). Keep technical terms, company names, tool names, and numbers in English. Output ONLY valid JSON mapping each key to its translation. No markdown.`;

    const textMap: Record<string, string> = {};
    for (const t of texts.slice(0, 10)) {
      textMap[t.key] = t.value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Translate these texts:\n${JSON.stringify(textMap, null, 2)}` },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[translate] AI error:", resp.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ error: "Translation failed" }), { status: 500, headers: jsonHeaders });
    }

    const data = await resp.json();
    logTokenUsage("translate-verdict", null, MODEL, data);
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let translations: Record<string, string>;
    try {
      translations = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[translate-verdict] JSON parse failed, returning empty translations:", parseErr);
      translations = {};
    }

    return new Response(JSON.stringify({ translations, language: lang }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("[translate] Error:", error);
    return new Response(JSON.stringify({ error: "Translation failed" }), { status: 500, headers: jsonHeaders });
  }
});
