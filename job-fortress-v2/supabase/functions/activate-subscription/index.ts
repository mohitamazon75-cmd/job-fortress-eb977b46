import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// ═══════════════════════════════════════════════════════════════
// activate-subscription edge function
//
// Called by the frontend after a successful Razorpay checkout.
// Verifies the payment via Razorpay API, then grants the
// appropriate subscription tier on the user's profile.
//
// Security: Uses Razorpay Payments API (server-side secret key)
// to confirm payment status & amount before granting access.
// ═══════════════════════════════════════════════════════════════

const TIER_PRICES: Record<string, number> = {
  pro_monthly: 30000,  // ₹300 in paise
  pro:         199900, // ₹1,999 in paise
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────
    const { payment_id, order_id, tier } = await req.json() as {
      payment_id: string;
      order_id?: string;
      tier: string;
    };

    if (!payment_id || !tier || !(tier in TIER_PRICES)) {
      return new Response(JSON.stringify({ error: "Invalid request: missing payment_id or tier" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: check if this payment_id was already processed ──
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("status, plan_type")
      .eq("razorpay_payment_id", payment_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingPayment?.status === "paid") {
      // Tier escalation protection: ensure requested tier matches stored tier
      if (existingPayment.plan_type !== tier) {
        console.warn(`[activate-subscription] Tier escalation attempt detected: payment ${payment_id} was for ${existingPayment.plan_type}, requesting ${tier}`);
        return new Response(
          JSON.stringify({ error: "Payment tier mismatch. This payment ID cannot be reused for a different tier.", code: "TIER_MISMATCH" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[activate-subscription] Idempotent skip — payment ${payment_id} already applied with matching tier`);
      return new Response(JSON.stringify({ success: true, idempotent: true, tier }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify payment via Razorpay API ───────────────────────
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured. Contact support.", code: "PAYMENT_CONFIG_ERROR" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      const rzpResp = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
      });

      if (!rzpResp.ok) {
        console.error("[activate-subscription] Razorpay API error:", await rzpResp.text());
        return new Response(JSON.stringify({ error: "Payment verification failed" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payment = await rzpResp.json();

      // Verify payment status
      if (payment.status !== "captured") {
        return new Response(JSON.stringify({ error: `Payment not captured — status: ${payment.status}` }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify amount matches expected price for tier
      const expectedAmount = TIER_PRICES[tier as keyof typeof TIER_PRICES];
      if (expectedAmount === undefined) {
        return new Response(JSON.stringify({ error: 'Invalid subscription tier' }), {
          status: 400,
          headers: corsHeaders
        });
      }
      if (payment.amount !== expectedAmount) {
        console.error(`[activate-subscription] Amount mismatch: got ${payment.amount}, expected ${expectedAmount}`);
        return new Response(JSON.stringify({ error: "Payment amount mismatch" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Grant subscription ────────────────────────────────────
    const now = new Date();
    let expiresAt: string;

    if (tier === "pro") {
      // Annual subscription: 1 year from now
      const expiry = new Date(now);
      expiry.setFullYear(expiry.getFullYear() + 1);
      expiresAt = expiry.toISOString();
    } else {
      // Per-scan: expires 90 days after purchase (generous window for re-scanning)
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 90);
      expiresAt = expiry.toISOString();
    }

    // ── Write payment record ────────────────────────────────────
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .upsert({
        user_id: user.id,
        razorpay_payment_id: payment_id,
        amount_paise: TIER_PRICES[tier],
        currency: "INR",
        plan_type: tier,
        status: "paid",
        created_at: now.toISOString(),
      }, { onConflict: "razorpay_payment_id" });

    if (paymentError) {
      console.warn("[activate-subscription] Payment record write failed (non-fatal):", paymentError.message);
    }

    // ── Update subscription tier on profile ──────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[activate-subscription] Profile update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[activate-subscription] ✅ Activated ${tier} for user ${user.id}, expires ${expiresAt}`);

    return new Response(
      JSON.stringify({ success: true, tier, expires_at: expiresAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[activate-subscription] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
