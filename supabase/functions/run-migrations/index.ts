/**
 * run-migrations — one-time bootstrap
 * Uses service role to create missing tables via individual insert checks.
 * Safe to call multiple times. Protected by secret header.
 */
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  const secret = req.headers.get("x-migration-secret") || "";
  if (secret !== "jb-bootstrap-2026") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = Deno.env.get("SUPABASE_URL")!;

  // Check which tables need creating
  const tables = ["score_events", "behavior_events", "user_action_signals", "trajectory_predictions"];
  const results: Record<string, string> = {};

  for (const table of tables) {
    const check = await fetch(`${url}/rest/v1/${table}?limit=0`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    results[table] = check.status === 200 ? "already_exists" : "missing";
  }

  return new Response(JSON.stringify({
    message: "Table status check complete. Apply the migration SQL manually in Supabase Dashboard → SQL Editor.",
    tables: results,
    sql_to_run: "See supabase/migrations/20260417044244_create_all_missing_tables.sql in the repo.",
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
