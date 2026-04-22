import { createAdminClient } from "../_shared/supabase-client.ts";
import { getCorsHeaders, handleCorsPreFlight, okResponse, errResponse } from "../_shared/cors.ts";

// ═══════════════════════════════════════════════════════════════
// create-razorpay-order — server-side order creation
//
// Why: client must NEVER pass `amount` to Razorpay. Otherwise an
// attacker can intercept the request and pay ₹1 for Pro.
// Server is the only authority for tier→price mapping.
// ═══════════════════════════════════════════════════════════════

const TIER_PRICES: Record<string, number> = {
  pro_monthly: 30000,  // ₹300 in paise
  pro:         199900, // ₹1,999 in paise
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errResponse(req, "Unauthorized", 401);
    }

    const supabaseAdmin = createAdminClient();
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return errResponse(req, "Invalid session", 401);
    }

    // ── Parse & validate ──────────────────────────────────────
    const { tier } = await req.json() as { tier: string };
    if (!tier || !(tier in TIER_PRICES)) {
      return errResponse(req, "Invalid tier", 400);
    }

    const amount = TIER_PRICES[tier];

    // ── Razorpay creds ────────────────────────────────────────
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return errResponse(req, "Payment system not configured", 503);
    }

    // ── Create order on Razorpay ──────────────────────────────
    const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const receipt = `${user.id.slice(0, 8)}_${Date.now()}`.slice(0, 40);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const rzpResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${rzpAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        notes: { user_id: user.id, tier },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!rzpResp.ok) {
      const text = await rzpResp.text();
      console.error("[create-razorpay-order] Razorpay error:", text);
      return errResponse(req, "Failed to create order", 502);
    }

    const order = await rzpResp.json();

    // ── Persist a pending payment row for later verification ──
    await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      razorpay_payment_id: `order_${order.id}`, // placeholder until payment captured
      amount_paise: amount,
      currency: "INR",
      plan_type: tier,
      status: "pending",
    }).then(({ error }) => {
      if (error && !String(error.message).includes("duplicate")) {
        console.warn("[create-razorpay-order] Pending row insert failed (non-fatal):", error.message);
      }
    });

    return okResponse(req, {
      order_id: order.id,
      amount,
      currency: "INR",
      key_id: RAZORPAY_KEY_ID,
      tier,
    });
  } catch (err) {
    console.error("[create-razorpay-order] Unexpected error:", err);
    return errResponse(req, "Internal server error", 500);
  }
});
