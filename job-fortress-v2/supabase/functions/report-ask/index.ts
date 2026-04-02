import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// Groq Integration (free tier: 14,400 tokens/min, ~300ms latency)
// Falls back to Gemini if GROQ_API_KEY not set or Groq fails
// ═══════════════════════════════════════════════════════════════
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<ReadableStream<Uint8Array> | null> {
  if (!GROQ_API_KEY) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[Groq] Request failed with status ${response.status}`);
      return null;
    }

    return response.body;
  } catch (error) {
    console.warn(`[Groq] Error calling Groq API:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ─── Rate limit: 30 AI messages per user per hour ────────────────────────────
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SEC = 3600;

async function checkRateLimit(userId: string, serviceClient: ReturnType<typeof createClient>): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("check_and_increment_rate_limit", {
    p_key: userId,
    p_action: "report_ask",
    p_max: RATE_LIMIT_MAX,
    p_window_sec: RATE_LIMIT_WINDOW_SEC,
  });
  if (error) {
    console.warn("Rate limit check failed (fail-open):", error.message);
    return true; // fail-open so legitimate users aren't blocked by DB issues
  }
  return data?.[0]?.allowed ?? true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ─── JWT Auth ───────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;
  // ────────────────────────────────────────────────────────────────────────

  // ─── Rate limit: 30 messages / hour per user (P0 audit fix) ────────────
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const allowed = await checkRateLimit(userId, serviceClient);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. You can ask up to 30 questions per hour. Please try again later." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const { messages, reportContext, childName } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Guard: messages must be a non-empty array
    const safeMessages = Array.isArray(messages) && messages.length > 0 ? messages : [];
    if (safeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a child development expert and health advisor helping parents understand their child's assessment report.

You have access to the following report data for ${childName || "this child"}:

<report>
${reportContext ?? "No report context provided."}
</report>

Guidelines:
- Answer in clear, warm, parent-friendly language — avoid clinical jargon
- Always ground your answers in the actual report data above
- When referencing scores, explain what percentiles mean in plain terms
- Be empathetic and constructive — focus on actionable insights
- If asked about something not in the report, say so honestly
- Keep answers concise (3-5 sentences) unless the question needs more detail
- Use Indian context where relevant (food, schools, parenting culture)`;

    // Try Groq first (fast, free) → fall back to Gemini
    let responseBody: ReadableStream<Uint8Array> | null = await callGroq(safeMessages, systemPrompt);

    if (!responseBody) {
      // Fall back to Gemini via Lovable gateway
      console.log("[report-ask] Groq unavailable, using Gemini");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...safeMessages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      responseBody = response.body;
    }

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("report-ask error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
