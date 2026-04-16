import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

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

      let signatureValid = true;
      for (let i = 0; i < expectedBytes.length; i++) {
        if (expectedBytes[i] !== signatureBytes[i]) {
          signatureValid = false;
        }
      }

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
      // Extract scan_id from payment notes/metadata
      const paymentEntity = payload.payload?.payment?.entity;
      const scanId = paymentEntity?.notes?.scan_id || paymentEntity?.description;
      const paymentId = paymentEntity?.id;

      if (!scanId) {
        console.error("No scan_id in payment payload");
        return new Response(
          JSON.stringify({ error: "No scan_id found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Idempotency: only update if not already paid ──
      const { data: existingScan } = await supabase
        .from("scans")
        .select("payment_status")
        .eq("id", scanId)
        .maybeSingle();

      if (existingScan?.payment_status === "paid_199") {
        console.log(`[razorpay-webhook] Scan ${scanId} already paid — idempotent skip`);
        return new Response(
          JSON.stringify({ success: true, scanId, idempotent: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update scan payment status
      const { error } = await supabase
        .from("scans")
        .update({ payment_status: "paid_199" })
        .eq("id", scanId);

      if (error) {
        console.error("Failed to update scan:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Payment captured for scan ${scanId} (payment: ${paymentId})`);

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

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 31); // Extend 31 days

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[razorpay-webhook] subscription.activated: profile update failed:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to activate subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[razorpay-webhook] ✅ subscription.activated: ${tier} for user ${userId}, expires ${expiresAt.toISOString()}`);
      return new Response(
        JSON.stringify({ success: true, event: "subscription.activated", userId, tier }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Handle subscription.charged (monthly renewal payment succeeded) ──
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

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 31); // Extend 31 days

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[razorpay-webhook] subscription.charged: profile update failed:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to extend subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[razorpay-webhook] ✅ subscription.charged: renewed ${tier} for user ${userId}, expires ${expiresAt.toISOString()} (payment: ${paymentId})`);
      return new Response(
        JSON.stringify({ success: true, event: "subscription.charged", userId, tier }),
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
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
