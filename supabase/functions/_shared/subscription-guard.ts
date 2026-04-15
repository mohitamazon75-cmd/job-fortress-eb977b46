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

// ┌─────────────────────────────────────────────────────────────┐
// │  TESTING BYPASS — set to false when ready to enforce Pro    │
// │  gating in production. While true, all users pass through.  │
// └─────────────────────────────────────────────────────────────┘
const TESTING_BYPASS = true;

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
  allowedTiers: string[] = ["pro", "pro_scan", "pro_monthly"],
): Promise<Response | null> {
  // ── Testing bypass: allow everyone through ──
  if (TESTING_BYPASS) return null;

  // ── Extract auth header ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: "Authentication required",
        code: "UNAUTHENTICATED",
        status: "error",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── Verify JWT and get user ──
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        error: "Invalid or expired session",
        code: "INVALID_SESSION",
        status: "error",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── Check subscription tier in profiles table ──
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, subscription_expires_at, trial_started_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return makeUpgradeResponse("free");
  }

  const tier = profile.subscription_tier as string | null;
  const expiresAt = profile.subscription_expires_at as string | null;

  // Check tier is allowed and not expired
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired =
    expiresAtDate !== null &&
    !isNaN(expiresAtDate.getTime()) &&
    expiresAtDate <= new Date();

  const isActivePro =
    tier !== null && allowedTiers.includes(tier) && !isExpired;

  // ── 48-hour free trial check (P1-2) ──────────────────────────────────────
  // If the user has no active subscription but started a trial within the last 48h,
  // grant Pro access. trial_started_at is set once via the activate-trial edge fn.
  // VibeSec: trial_started_at is server-set only — users cannot self-escalate via client.
  if (!isActivePro && (profile as any).trial_started_at) {
    const trialStart = new Date((profile as any).trial_started_at);
    const trialAgeHours = (Date.now() - trialStart.getTime()) / (1000 * 60 * 60);
    if (!isNaN(trialAgeHours) && trialAgeHours < 48) {
      console.log(`[subscription-guard] Trial active for user ${user.id} (${trialAgeHours.toFixed(1)}h elapsed)`);
      return null; // Grant access
    }
  }

  if (!isActivePro) {
    return makeUpgradeResponse(tier ?? "free");
  }

  // ── User is Pro — allow request through ──
  return null;
}

function makeUpgradeResponse(currentTier: string): Response {
  return new Response(
    JSON.stringify({
      error: "Pro subscription required",
      code: "SUBSCRIPTION_REQUIRED",
      upgrade_url: "/pricing",
      current_tier: currentTier,
      status: "error",
    }),
    {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
