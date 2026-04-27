/**
 * @fileoverview Shared JWT validation helper for edge functions.
 *
 * Standardizes auth gating so we have one code path to audit, one place to
 * tighten rules (e.g. require email verification, role check, etc.), and a
 * predictable 401 response shape across all protected functions.
 *
 * Usage at the top of an edge function handler:
 *
 *   import { requireAuth } from "../_shared/require-auth.ts";
 *   const auth = await requireAuth(req, corsHeaders);
 *   if (auth.kind === "unauthorized") return auth.response;
 *   const userId = auth.userId;   // proceed with authenticated logic
 *
 * Why getClaims() (verifies signature locally via JWKS) over getUser()
 * (round-trips to auth server): faster, no extra cost, sufficient for
 * authorization checks. Use getUser() only when you need profile data
 * not in the JWT.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export interface AuthOK {
  kind: "ok";
  userId: string;
  email: string | null;
  /** raw JWT, useful when the function needs to re-issue calls as the user */
  token: string;
}

export interface AuthFail {
  kind: "unauthorized";
  reason: string;
  response: Response;
}

export type AuthResult = AuthOK | AuthFail;

/**
 * Validate the Authorization: Bearer <jwt> header on an incoming request.
 *
 * Returns either a typed `ok` discriminant with the user id, or a typed
 * `unauthorized` discriminant carrying a ready-to-return 401 Response. The
 * caller never has to assemble error responses by hand — keeps the gate
 * uniform across all 12 protected functions.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      kind: "unauthorized",
      reason: "missing_bearer",
      response: new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) {
    return {
      kind: "unauthorized",
      reason: "empty_token",
      response: new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    // Misconfigured environment — fail closed.
    return {
      kind: "unauthorized",
      reason: "server_misconfigured",
      response: new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return {
        kind: "unauthorized",
        reason: error?.message || "invalid_token",
        response: new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
        ),
      };
    }

    return {
      kind: "ok",
      userId: data.claims.sub as string,
      email: (data.claims.email as string | undefined) ?? null,
      token,
    };
  } catch (err) {
    return {
      kind: "unauthorized",
      reason: err instanceof Error ? err.message : "verify_failed",
      response: new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }
}
