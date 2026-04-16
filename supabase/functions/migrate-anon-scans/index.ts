// ═══════════════════════════════════════════════════════════════
// Week 1 #1: Migrate anonymous scans to authenticated user.
// Called after signup/login to claim any orphaned scans.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Extract JWT to get user ID
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: jsonHeaders });
    }

    const { scanIds } = await req.json() as { scanIds?: string[] };
    if (!scanIds || !Array.isArray(scanIds) || scanIds.length === 0) {
      return new Response(JSON.stringify({ migrated: 0 }), { status: 200, headers: jsonHeaders });
    }

    // Use service role to update scans that have no user_id (orphaned/anonymous)
    const serviceClient = createAdminClient();

    // Only claim scans that are truly orphaned (user_id IS NULL)
    // Limit to 10 to prevent abuse
    const safeScanIds = scanIds.slice(0, 10);

    const { data: updated, error: updateError } = await serviceClient
      .from("scans")
      .update({ user_id: user.id })
      .in("id", safeScanIds)
      .is("user_id", null)
      .select("id");

    if (updateError) {
      console.error("[migrate-anon-scans] Update error:", updateError);
      return new Response(JSON.stringify({ error: "Migration failed" }), { status: 500, headers: jsonHeaders });
    }

    const migratedCount = updated?.length || 0;
    console.log(`[migrate-anon-scans] Migrated ${migratedCount} scan(s) for user ${user.id}`);

    return new Response(JSON.stringify({ migrated: migratedCount }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("[migrate-anon-scans] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: jsonHeaders });
  }
});
