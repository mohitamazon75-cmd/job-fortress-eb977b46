// ═══════════════════════════════════════════════════════════════
// Subscription Guard — Server-side Pro subscription verification
//
// Usage in any premium edge function:
//   import { requirePro } from "../_shared/subscription-guard.ts";
//
//   const guard = await requirePro(req);
//   if (guard) return guard; // Returns a 402 Response if not Pro
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Verifies the requesting user has an active Pro subscription.
 * Returns null if the user is Pro (allow the request through).
 * Returns a Response object if not Pro (caller should return this immediately).
 *
 * @param req - The incoming Request object
 * @param allowedTiers - Subscription tiers that can access this feature (default: all paid tiers)
 */
export async function requirePro(
  req: Request,
  allowedTiers: string[] = ["pro", "pro_scan"],
): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authentication required", code: "UNAUTHENTICATED" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.slice(7);

  // Use admin client to look up the user's profile subscription details
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify the JWT and get the user ID
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired session", code: "INVALID_SESSION" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Fetch subscription details from profiles table
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, subscription_expires_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // No profile = free tier
    return new Response(
      JSON.stringify({
        error: "Pro subscription required to access this feature.",
        code: "SUBSCRIPTION_REQUIRED",
        upgrade_url: "/pricing",
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tier = profile.subscription_tier as string | null;
  const expiresAt = profile.subscription_expires_at as string | null;

  // Check if tier is in allowed tiers and subscription hasn't expired
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiresAtDate !== null &&
    !isNaN(expiresAtDate.getTime()) &&
    expiresAtDate <= new Date();

  const isActivePro =
    tier !== null &&
    allowedTiers.includes(tier) &&
    !isExpired;

  if (!isActivePro) {
    return new Response(
      JSON.stringify({
        error: "Pro subscription required to access this feature.",
        code: "SUBSCRIPTION_REQUIRED",
        current_tier: tier ?? "free",
        upgrade_url: "/pricing",
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // User is Pro — allow request through
  return null;
}
