import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  try {
    const corsHeaders = getCorsHeaders(req);

    // ── Validate JWT — require authenticated user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, userId, code, refereeUserId, scanId } = body;

    // ── Action: Create a new referral code for this user ──
    if (action === "create") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify the authenticated user is creating a referral for their OWN account
      if (user.id !== userId) {
        return new Response(
          JSON.stringify({ error: "Cannot create referral for another user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate unique 6-char code
      const referralCode = Math.random().toString(36).slice(2, 8);
      const shareUrl = `https://jobbachao.com?ref=${referralCode}`;

      const { error } = await sbAdmin.from("referrals").insert({
        referrer_user_id: userId,
        referral_code: referralCode,
        status: "pending",
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ code: referralCode, shareUrl }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: Track a click on the referral link ──
    if (action === "click") {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "code required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await sbAdmin
        .from("referrals")
        .update({ status: "clicked" })
        .eq("referral_code", code)
        .eq("status", "pending");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: Mark referral as converted (referee completed scan) ──
    if (action === "convert") {
      if (!code || !refereeUserId || !scanId) {
        return new Response(
          JSON.stringify({ error: "code, refereeUserId, and scanId required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify the authenticated user is the referee (the one who scanned)
      if (user.id !== refereeUserId) {
        return new Response(
          JSON.stringify({ error: "Cannot convert referral for another user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update the referral record
      const { data: referralData, error: updateErr } = await sbAdmin
        .from("referrals")
        .update({
          status: "converted",
          referee_user_id: refereeUserId,
          referee_scan_id: scanId,
          converted_at: new Date().toISOString(),
        })
        .eq("referral_code", code)
        .select("referrer_user_id")
        .single();

      if (updateErr) throw updateErr;
      if (!referralData) {
        return new Response(
          JSON.stringify({ converted: false, referrerUnlockedPro: false }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const referrerUserId = referralData.referrer_user_id;

      // Check if referrer now has 3+ conversions
      const { count, error: countErr } = await sbAdmin
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_user_id", referrerUserId)
        .eq("status", "converted");

      if (countErr) throw countErr;

      let referrerUnlockedPro = false;
      if ((count || 0) >= 3) {
        // Grant Pro access for 30 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { error: grantErr } = await sbAdmin
          .from("referral_pro_grants")
          .upsert({
            user_id: referrerUserId,
            granted_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            grant_reason: "referral_3_conversions",
            referral_count: count,
          });

        if (grantErr) throw grantErr;
        referrerUnlockedPro = true;
      }

      return new Response(
        JSON.stringify({ converted: true, referrerUnlockedPro }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[ReferralTrack] Error:", err);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
