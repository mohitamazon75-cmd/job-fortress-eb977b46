import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length === 0 || code.trim().length > 20) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();

    const normalized = code.trim().toUpperCase();

    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, is_active, uses_remaining")
      .eq("code", normalized)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check uses_remaining if set
    if (data.uses_remaining !== null && data.uses_remaining <= 0) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Decrement uses_remaining if applicable
    if (data.uses_remaining !== null) {
      await supabase
        .from("invite_codes")
        .update({ uses_remaining: data.uses_remaining - 1 })
        .eq("id", data.id);
    }

    return new Response(JSON.stringify({ valid: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
