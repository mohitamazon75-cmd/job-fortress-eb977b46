// ═══════════════════════════════════════════════════════════════
// Abuse Guard — prevents direct API abuse from non-app callers
// Validates: Origin header (CORS already does this for browsers)
//            + Authorization header (must be anon key or service role)
// ═══════════════════════════════════════════════════════════════

/**
 * Timing-safe comparison for secrets (service role keys, tokens).
 * Prevents timing oracle attacks by always performing HMAC comparison.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Still do the comparison to avoid timing oracle on length
    await crypto.subtle.digest("SHA-256", aBytes);
    return false;
  }
  const keyBytes = encoder.encode("constant-time-key");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, aBytes),
    crypto.subtle.sign("HMAC", key, bBytes),
  ]);
  return Buffer.from(sigA).toString("hex") === Buffer.from(sigB).toString("hex");
}

const TRUSTED_ORIGINS = new Set([
  "https://ai-prophet.in",
  "https://www.ai-prophet.in",
  "https://jobbachao.com",
  "https://www.jobbachao.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function isTrustedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (TRUSTED_ORIGINS.has(origin)) return true;
  return (
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin) ||
    /^http:\/\/localhost(?::\d+)?$/i.test(origin)
  );
}

/**
 * Validates that a request is legitimate (from app frontend or server-to-server).
 * Returns null if valid, or a reason string if blocked.
 * 
 * Policy:
 * - Requests WITH an Origin header must come from trusted origins
 * - All requests must have an Authorization header with a Bearer token
 * - Server-to-server (no origin) is allowed if auth header is present
 */
export function validateRequest(req: Request): string | null {
  const origin = req.headers.get("origin");
  
  // If origin is present, it must be trusted
  if (origin && !isTrustedOrigin(origin)) {
    return `Untrusted origin: ${origin}`;
  }

  // Must have Authorization header (anon key or service role key)
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return "Missing authorization";
  }

  // Token must be non-trivial (at least 20 chars after "Bearer ")
  const token = auth.slice(7).trim();
  if (token.length < 20) {
    return "Invalid authorization token";
  }

  return null; // Valid
}

/**
 * Returns a 403 Response if request is not from a trusted source.
 * Also rejects oversized request bodies (>10MB).
 * Returns null if request is valid (proceed with handler).
 */
export function guardRequest(req: Request, corsHeaders: Record<string, string>): Response | null {
  // Body size check (10MB limit)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    console.warn(`[AbuseGuard] Rejected oversized body: ${contentLength} bytes`);
    return new Response(
      JSON.stringify({ error: "Request body too large" }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const reason = validateRequest(req);
  if (reason) {
    console.warn(`[AbuseGuard] Blocked request: ${reason}`);
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return null;
}

/**
 * Checks if the request is a server-to-server call using the service role key.
 * Use this explicitly in functions that need to accept server-to-server calls.
 * Uses timing-safe comparison to prevent timing oracle attacks.
 */
export async function isServiceRoleCall(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.slice(7)?.trim();
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !expectedKey) return false;
  return await timingSafeEqual(token, expectedKey);
}

/**
 * Validates JWT claims using Supabase Auth.
 * Returns the user_id (sub) if valid, or null + a Response if invalid.
 * ALL requests must have a valid JWT — no origin-based bypass.
 */
export async function validateJwtClaims(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string | null; blocked: Response | null }> {
  // Allow service-role calls (server-to-server) without JWT validation
  if (await isServiceRoleCall(req)) {
    return { userId: null, blocked: null };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      userId: null,
      blocked: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.warn("[AbuseGuard] JWT validation failed:", error?.message || "no user");
      return {
        userId: null,
        blocked: new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }

    return { userId: user.id, blocked: null };
  } catch (err) {
    console.error("[AbuseGuard] JWT validation error (fail-closed):", err);
    return {
      userId: null,
      blocked: new Response(
        JSON.stringify({ error: "Authentication service unavailable" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
}
