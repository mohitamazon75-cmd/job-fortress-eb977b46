/**
 * activate-trial — P1-2: 48-hour Pro trial (no credit card required)
 *
 * Sets trial_started_at on the user's profile ONCE.
 * VibeSec:
 *   - Requires valid JWT — user_id from server, never trusted from body
 *   - Idempotent: once set, trial_started_at is NEVER overwritten
 *   - No privilege escalation — update only fires when IS NULL
 *   - Returns remaining hours so UI can show countdown
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { validateJwtClaims } from "../_shared/abuse-guard.ts";

const TRIAL_HOURS = 48;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const cors = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: user_id always from JWT, never from body (VibeSec)
    const { userId, blocked } = await validateJwtClaims(req, cors);
    if (blocked) return blocked;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("trial_started_at, subscription_tier, subscription_expires_at")
      .eq("id", userId)
      .single();

    if (fetchErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Already paid Pro — no trial needed
    if (profile.subscription_tier === "pro" && profile.subscription_expires_at) {
      if (new Date(profile.subscription_expires_at) > new Date()) {
        return new Response(JSON.stringify({ status: "already_pro" }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // Trial already used — return remaining time, never overwrite
    if (profile.trial_started_at) {
      const elapsed = (Date.now() - new Date(profile.trial_started_at).getTime()) / (1000 * 60 * 60);
      const remaining = Math.max(0, TRIAL_HOURS - elapsed);
      return new Response(JSON.stringify({
        status: remaining > 0 ? "trial_active" : "trial_expired",
        trial_started_at: profile.trial_started_at,
        remaining_hours: Math.round(remaining * 10) / 10,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // First activation — set once, cannot be reset by user
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ trial_started_at: now })
      .eq("id", userId)
      .is("trial_started_at", null); // Guard: only updates if still null

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to activate trial" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000).toISOString();
    console.log(`[activate-trial] Trial activated for ${userId}, expires ${expiresAt}`);

    return new Response(JSON.stringify({
      status: "trial_started",
      trial_started_at: now,
      expires_at: expiresAt,
      remaining_hours: TRIAL_HOURS,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[activate-trial] Error:", err?.message ?? err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
