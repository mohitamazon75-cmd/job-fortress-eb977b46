/**
 * admin-clear-cache — One-time emergency use
 * Clears all stale model_b_results card_data so every result page
 * forces fresh LLM analysis instead of serving cached old data.
 * 
 * Call once: POST /admin-clear-cache with service role key
 * After running, delete or disable this function.
 */
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  // Basic auth check — requires service role key header
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!authHeader.includes(serviceKey.slice(-20))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createAdminClient();

  // 1. Clear ALL model_b_results card_data — forces fresh LLM analysis
  const { count: modelBCleared, error: err1 } = await supabase
    .from("model_b_results")
    .update({ card_data: null, gemini_raw: null })
    .not("card_data", "is", null)
    .select("id", { count: "exact", head: true });

  if (err1) {
    return new Response(JSON.stringify({ error: err1.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 2. Reset stuck scans (processing > 30 min)
  const { count: stuckFixed } = await supabase
    .from("scans")
    .update({ scan_status: "failed" })
    .eq("scan_status", "processing")
    .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .select("id", { count: "exact", head: true });

  console.log(`[admin-clear-cache] Cleared ${modelBCleared} model_b rows, fixed ${stuckFixed} stuck scans`);

  return new Response(JSON.stringify({
    success: true,
    model_b_cache_cleared: modelBCleared ?? 0,
    stuck_scans_fixed: stuckFixed ?? 0,
    message: "All stale model_b card_data cleared. Next visit to any result page will regenerate fresh analysis."
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
