// ═══════════════════════════════════════════════════════════════
// Subscription Guard — Server-side Pro subscription verification
//
// Usage in any premium edge function:
//   import { requirePro } from "../_shared/subscription-guard.ts";
//
//   const guard = await requirePro(req);
//   if (guard) return guard; // Returns a 402 Response if not Pro
//
// Production enforcement:
//   Set the ENFORCE_PRO="true" env var in Supabase Dashboard →
//   Edge Functions → Secrets. While unset (or set to anything else),
//   all users pass through — safe for development/staging.
//   Flip the switch without a deploy; revert instantly if needed.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "./supabase-client.ts";
import { getCorsHeaders } from "./cors.ts";

/**
 * Whether Pro gating is enforced.
 * Controlled by the ENFORCE_PRO env var — no code change required to flip.
 * Default: bypass (false) — safe for development.
 */
function isEnforcingPro(): boolean {
  return Deno.env.get("ENFORCE_PRO") === "true";
}

/**
 * Verifies the requesting user has an active Pro subscription.
 * Returns null if the user is Pro (or enforcement is disabled).
 * Returns a Response object if not Pro (caller should return this immediately).
 *
 * @param req - The incoming Request object
 * @param allowedTiers - Subscription tiers that can access this feature
 */
export async function requirePro(
  req: Request,
  allowedTiers: string[] = ["pro", "pro_scan", "pro_monthly"],
): Promise<Response | null> {
  // ── Bypass: enforcement disabled via env var ──────────────────
  if (!isEnforcingPro()) return null;

  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // ── Extract auth header ───────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authentication required", code: "UNAUTHENTICATED", status: "error" }),
      { status: 401, headers: jsonHeaders },
    );
  }

  // ── Verify JWT and get user ───────────────────────────────────
  const supabaseAdmin = createAdminClient();
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired session", code: "INVALID_SESSION", status: "error" }),
      { status: 401, headers: jsonHeaders },
    );
  }

  // ── Check subscription tier in profiles table ─────────────────
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, subscription_expires_at, trial_started_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return makeUpgradeResponse(req, "free");
  }

  const tier = profile.subscription_tier as string | null;
  const expiresAt = profile.subscription_expires_at as string | null;

  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired =
    expiresAtDate !== null &&
    !isNaN(expiresAtDate.getTime()) &&
    expiresAtDate <= new Date();

  const isActivePro =
    tier !== null && allowedTiers.includes(tier) && !isExpired;

  // ── 48-hour free trial check ──────────────────────────────────
  // trial_started_at is server-set only — users cannot self-escalate via client.
  if (!isActivePro && profile.trial_started_at) {
    const trialStart = new Date(profile.trial_started_at as string);
    const trialAgeHours = (Date.now() - trialStart.getTime()) / (1000 * 60 * 60);
    if (!isNaN(trialAgeHours) && trialAgeHours < 48) {
      console.log(`[subscription-guard] Trial active for ${user.id} (${trialAgeHours.toFixed(1)}h)`);
      return null;
    }
  }

  if (!isActivePro) {
    return makeUpgradeResponse(req, tier ?? "free");
  }

  return null;
}

function makeUpgradeResponse(req: Request, currentTier: string): Response {
  return new Response(
    JSON.stringify({
      error: "Pro subscription required",
      code: "SUBSCRIPTION_REQUIRED",
      upgrade_url: "/pricing",
      current_tier: currentTier,
      status: "error",
    }),
    { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
  );
}
