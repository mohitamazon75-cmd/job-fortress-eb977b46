import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { analysis_id, user_id, event_type, metadata } = body;

    // --- Input validation (no auth required) ---
    if (!event_type || typeof event_type !== "string" || event_type.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "event_type must be a non-empty string" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (user_id !== undefined && user_id !== null && typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "user_id must be a string or null" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (analysis_id !== undefined && analysis_id !== null && typeof analysis_id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id must be a string or null" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    // --- end input validation ---

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ab_test_events")
      .insert({
        analysis_id: analysis_id || null,
        user_id: user_id || null,
        event_type,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[log-ab-event] Insert error:", error);
      throw new Error("Failed to log event");
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[log-ab-event] error:", e);
    // D2 FIX: Never throw to caller — always return 200 with success: false
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
