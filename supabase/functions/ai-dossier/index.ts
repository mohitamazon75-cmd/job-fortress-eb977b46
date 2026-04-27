import { buildDossierPrompt, buildProfileContext } from "./prompt-builder.ts";
import { createTokenTrackingTransform } from "../_shared/token-tracker.ts";
// Pro gate disabled during beta/waitlist phase — all users get full access
// import { requirePro } from "../_shared/subscription-guard.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { validateBody, z } from "../_shared/validate-input.ts";

// `report` is a deeply nested object built upstream by process-scan; we don't
// re-validate every internal field here (would be redundant with our own writes)
// but we DO require it to be a non-null object — that's enough to stop griefing.
const DossierSchema = z.object({
  report: z.record(z.unknown()),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  // P0 hardening: require valid JWT — this function calls paid LLM (Gemini Pro).
  const auth = await requireAuth(req, getCorsHeaders(req));
  if (auth.kind === "unauthorized") return auth.response;

  // Pro gate disabled during beta/waitlist phase
  // const subGuard = await requirePro(req);
  // if (subGuard) return subGuard;

  try {
    const validated = await validateBody(req, DossierSchema, getCorsHeaders(req));
    if (validated.kind === "invalid") return validated.response;
    const { report } = validated.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = buildDossierPrompt();
    const profileContext = buildProfileContext(report);

    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      { timeoutMs: 45000, // streaming dossier; allow more for slow tokens
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: profileContext },
          ],
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.5,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis unavailable" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const trackedStream = response.body!.pipeThrough(
      createTokenTrackingTransform("ai-dossier", null, "google/gemini-3.1-pro-preview")
    );

    return new Response(trackedStream, {
      headers: { ...getCorsHeaders(req), "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-dossier error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
