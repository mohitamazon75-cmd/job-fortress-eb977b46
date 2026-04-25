import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";

/**
 * Razorpay tier price catalogue (in paise). Used to verify the captured
 * payment amount matches the SKU declared in `notes.tier`. If tier is
 * unknown we fall back to the legacy ₹499 per-scan price.
 *
 * Keep in sync with `activate-subscription/index.ts::TIER_PRICES`.
 */
const TIER_PRICES: Record<string, number> = {
  per_scan: 49900,    // ₹499 single-scan unlock (legacy "paid_199" status string predates the price hike)
  pro_monthly: 30000, // ₹300 / mo
  pro: 199900,        // ₹1,999 / yr
};

/**
 * Days of access granted per tier when activating / extending a subscription.
 */
const TIER_DURATIONS_DAYS: Record<string, number> = {
  pro: 365,
  pro_monthly: 31,
  per_scan: 31, // unused for subscriptions but defined for safety
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Signature verification ──
    const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (WEBHOOK_SECRET) {
      if (!signature) {
        console.warn("[razorpay-webhook] Missing signature header");
        return new Response(
          JSON.stringify({ error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // HMAC-SHA256 verification
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const expectedHex = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Timing-safe comparison of HMAC signatures
      const expectedBytes = encoder.encode(expectedHex);
      const signatureBytes = encoder.encode(signature ?? "");

      if (expectedBytes.length !== signatureBytes.length) {
        console.warn("[razorpay-webhook] Invalid signature (length mismatch)");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Constant-time comparison via XOR accumulator (no early exit).
      let diff = 0;
      for (let i = 0; i < expectedBytes.length; i++) {
        diff |= expectedBytes[i] ^ signatureBytes[i];
      }
      const signatureValid = diff === 0;

      if (!signatureValid) {
        console.warn("[razorpay-webhook] Invalid signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not set — refusing to process");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.parse(rawBody);

    // Razorpay sends various events: payment.captured, subscription.*, etc.
    const event = payload.event;

    const supabase = createAdminClient();

    // ── Handle payment.captured (one-time/per-scan payments) ──
    if (event === "payment.captured") {
      const paymentEntity = payload.payload?.payment?.entity;
      // Only trust scan_id from structured notes — never from the free-form
      // `description` field (attacker-controllable / typo-prone in the dashboard).
      const scanId: string | undefined = paymentEntity?.notes?.scan_id;
      const tier: string = paymentEntity?.notes?.tier || "per_scan";
      const paymentId = paymentEntity?.id;
      const paidAmount: number | undefined = paymentEntity?.amount;

      if (!scanId) {
        console.error("[razorpay-webhook] payment.captured: no scan_id in notes (description fallback removed)");
        return new Response(
          JSON.stringify({ error: "No scan_id in payment notes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Amount verification: defeat tampered orders ──
      const expectedAmount = TIER_PRICES[tier];
      if (typeof expectedAmount !== "number") {
        console.error(`[razorpay-webhook] payment.captured: unknown tier "${tier}" — rejecting`);
        return new Response(
          JSON.stringify({ error: "Unknown tier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (paidAmount !== expectedAmount) {
        console.error(
          `[razorpay-webhook] payment.captured: amount mismatch for scan ${scanId} ` +
          `tier=${tier} expected=${expectedAmount} got=${paidAmount}`
        );
        return new Response(
          JSON.stringify({ error: "Amount mismatch" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Idempotency: only update if not already paid ──
      const { data: existingScan } = await supabase
        .from("scans")
        .select("payment_status")
        .eq("id", scanId)
        .maybeSingle();

      if (existingScan?.payment_status === "paid_per_scan") {
        console.log(`[razorpay-webhook] Scan ${scanId} already paid — idempotent skip`);
        return new Response(
          JSON.stringify({ success: true, scanId, idempotent: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update scan payment status (renamed from legacy "paid_199" — column is plain TEXT, no migration needed)
      const { error } = await supabase
        .from("scans")
        .update({ payment_status: "paid_per_scan" })
        .eq("id", scanId);

      if (error) {
        console.error("[razorpay-webhook] Failed to update scan:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[razorpay-webhook] ✅ payment.captured: scan ${scanId} unlocked (payment ${paymentId}, ₹${paidAmount / 100})`);

      return new Response(
        JSON.stringify({ success: true, scanId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Handle subscription.activated (new subscription starts) ──
    if (event === "subscription.activated") {
      const subscriptionEntity = payload.payload?.subscription?.entity;
      const subscriptionId = subscriptionEntity?.id;
      const userId = subscriptionEntity?.notes?.user_id;
      const tier = subscriptionEntity?.notes?.tier || "pro_monthly";

      if (!userId || !subscriptionId) {
        console.error("[razorpay-webhook] subscription.activated: missing user_id or subscription_id");
        return new Response(
          JSON.stringify({ error: "Missing user_id or subscription_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const durationDays = TIER_DURATIONS_DAYS[tier] ?? 31;
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId); // profiles PK is `id`

      if (updateError) {
        console.error("[razorpay-webhook] subscription.activated: profile update failed:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to activate subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[razorpay-webhook] ✅ subscription.activated: ${tier} for user ${userId} (+${durationDays}d), expires ${expiresAt.toISOString()}`);
      return new Response(
        JSON.stringify({ success: true, event: "subscription.activated", userId, tier, durationDays }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Handle subscription.charged (renewal payment succeeded) ──
    if (event === "subscription.charged") {
      const subscriptionEntity = payload.payload?.subscription?.entity;
      const paymentEntity = payload.payload?.payment?.entity;
      const subscriptionId = subscriptionEntity?.id;
      const userId = subscriptionEntity?.notes?.user_id;
      const tier = subscriptionEntity?.notes?.tier || "pro_monthly";
      const paymentId = paymentEntity?.id;

      if (!userId || !subscriptionId) {
        console.error("[razorpay-webhook] subscription.charged: missing user_id or subscription_id");
        return new Response(
          JSON.stringify({ error: "Missing user_id or subscription_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const durationDays = TIER_DURATIONS_DAYS[tier] ?? 31;
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("[razorpay-webhook] subscription.charged: profile update failed:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to extend subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[razorpay-webhook] ✅ subscription.charged: renewed ${tier} for user ${userId} (+${durationDays}d), expires ${expiresAt.toISOString()} (payment: ${paymentId})`);
      return new Response(
        JSON.stringify({ success: true, event: "subscription.charged", userId, tier, durationDays }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Handle subscription.cancelled & subscription.completed (do nothing — let expiry happen naturally) ──
    if (event === "subscription.cancelled" || event === "subscription.completed") {
      const subscriptionEntity = payload.payload?.subscription?.entity;
      const subscriptionId = subscriptionEntity?.id;
      const userId = subscriptionEntity?.notes?.user_id;

      console.log(`[razorpay-webhook] ${event}: subscription ${subscriptionId} for user ${userId} — letting subscription_expires_at expire naturally`);
      return new Response(
        JSON.stringify({ success: true, event, action: "none" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Unrecognized event ──
    return new Response(
      JSON.stringify({ status: "ignored", event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[razorpay-webhook] Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
