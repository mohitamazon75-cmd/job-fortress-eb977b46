// ═══════════════════════════════════════════════════════════════
// Shared CORS configuration — allow trusted app domains
// ═══════════════════════════════════════════════════════════════

const EXPLICIT_ALLOWED_ORIGINS = new Set([
  "https://ai-prophet.in",
  "https://www.ai-prophet.in",
  "https://jobbachao.com",
  "https://www.jobbachao.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (EXPLICIT_ALLOWED_ORIGINS.has(origin)) return true;

  return (
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin) ||
    /^http:\/\/localhost(?::\d+)?$/i.test(origin) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)
  );
}

const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scan-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-api-version, x-requested-with, accept, origin",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

/**
 * Build CORS headers for a given request.
 * Reflect Origin back for browser callers to maximize compatibility across
 * preview/published/custom domains. Auth/JWT validation remains the real guardrail.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  // No origin (server-to-server calls) — allow but don't reflect
  if (!origin) {
    return {
      ...CORS_HEADERS_BASE,
      "Access-Control-Allow-Origin": "*",
    };
  }

  // Only reflect TRUSTED origins — block CSRF from unknown domains
  if (isAllowedOrigin(origin)) {
    return {
      ...CORS_HEADERS_BASE,
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    };
  }

  // Untrusted origin: return headers but with a null origin (browser will block)
  console.warn(`[CORS] Rejected untrusted origin: ${origin}`);
  return {
    ...CORS_HEADERS_BASE,
    "Access-Control-Allow-Origin": "null",
    "Vary": "Origin",
  };
}

/**
 * Handle OPTIONS preflight — returns 204 with CORS headers.
 */
export function handleCorsPreFlight(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}


// ─── Standardised response helpers (CQ-2-A) ──────────────────────────────────
//
// Every edge function should return via these helpers instead of constructing
// raw Response objects. This guarantees:
//   1. Consistent JSON envelope: { success, data? } or { success, error }
//   2. Correct CORS headers derived from the request origin
//   3. Correct Content-Type on every response
//   4. One place to change the response format if needed
//
// Usage:
//   return okResponse(req, { items: [...] });
//   return errResponse(req, "Scan not found", 404);
//   return errResponse(req, "Rate limit exceeded", 429);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * 200 OK — wraps data in { success: true, data }.
 * Pass data: null for responses with no body (e.g. fire-and-forget confirmations).
 */
export function okResponse(
  req: Request,
  data: Record<string, JsonValue | unknown> | null = null,
  status = 200,
): Response {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
  return new Response(
    JSON.stringify(data === null ? { success: true } : { success: true, ...data }),
    { status, headers },
  );
}

/**
 * Error response — wraps message in { success: false, error }.
 * Defaults to 500. Pass 400/401/403/404/429 as appropriate.
 */
export function errResponse(
  req: Request,
  message: string,
  status = 500,
): Response {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers },
  );
}
