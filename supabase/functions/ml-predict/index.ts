// ═══════════════════════════════════════════════════════════════
// ML PREDICT — Proxy to external Python ML microservice
// Keeps the Replit URL server-side, avoids CORS issues from browser
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest } from "../_shared/abuse-guard.ts";

const ML_BASE_URL = "https://dcce6740-52eb-4861-9ab4-1c6ffbf0a3fc-00-17r35n9rdd8su.kirk.replit.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const blocked = guardRequest(req, corsHeaders);
    if (blocked) return blocked;

    const { endpoint, payload } = await req.json();

    if (!endpoint || !["predict-obsolescence", "build-graph"].includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: "Invalid endpoint. Use 'predict-obsolescence' or 'build-graph'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ML-Predict] Calling ${endpoint} with ${JSON.stringify(payload).length} bytes`);

    const mlResp = await fetch(`${ML_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const mlData = await mlResp.json();

    if (!mlResp.ok) {
      console.error(`[ML-Predict] ML service error [${mlResp.status}]:`, JSON.stringify(mlData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "ML service error", status: mlResp.status, details: mlData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ML-Predict] ${endpoint} succeeded`);
    return new Response(
      JSON.stringify(mlData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ML-Predict] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
