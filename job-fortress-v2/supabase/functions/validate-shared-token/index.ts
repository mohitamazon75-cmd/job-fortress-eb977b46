import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limit: 10 requests per IP per 60 seconds, enforced atomically via DB function.
const WINDOW_SEC = 60;
const MAX_REQUESTS = 10;

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ─── Atomic DB-backed IP rate limiting (replaces in-memory Map) ────────────
  const ip = getIp(req);

  const { data: rlData, error: rlError } = await supabase.rpc(
    "check_and_increment_ip_rate_limit",
    {
      p_ip_key: ip,
      p_action: "validate_shared_token",
      p_max: MAX_REQUESTS,
      p_window_sec: WINDOW_SEC,
    }
  );

  if (!rlError) {
    const rl = Array.isArray(rlData) ? rlData[0] : rlData;
    if (rl && !rl.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please wait a minute before trying again.",
          code: "RATE_LIMITED",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }
  } else {
    // Log and fail open — don't block legitimate share-link viewers on DB hiccup
    console.error("[validate-shared-token] rate-limit DB error:", rlError.message);
  }

  // ─── Input validation ───────────────────────────────────────────────────────
  let token: string;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!token || typeof token !== "string" || token.length < 10 || token.length > 128) {
    return new Response(
      JSON.stringify({ error: "Invalid token format." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── Token lookup ───────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("shared_reports")
    .select("report_data, child_name, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    // Return generic message — do NOT reveal whether token exists or has expired
    // to prevent oracle attacks / token fishing
    return new Response(
      JSON.stringify({
        error: "This link has expired or is invalid. Please ask the parent to generate a new share link.",
        code: "NOT_FOUND",
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
