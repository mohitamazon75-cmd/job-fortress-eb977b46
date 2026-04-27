/**
 * @fileoverview Shared Zod-based request body validator for edge functions.
 *
 * Why this exists: auth-gating (require-auth.ts) tells us *who* can call us;
 * input validation tells us *what* they can send. Without it, a logged-in
 * user can still:
 *   - Crash a function with malformed JSON
 *   - Burn LLM budget by submitting megabytes of free-text into a prompt
 *   - Trigger downstream NPE/SQL errors with missing required fields
 *
 * Usage:
 *
 *   import { z } from "https://esm.sh/zod@3.23.8";
 *   import { validateBody } from "../_shared/validate-input.ts";
 *
 *   const Schema = z.object({ scan_id: z.string().uuid() });
 *   const parsed = await validateBody(req, Schema, corsHeaders);
 *   if (parsed.kind === "invalid") return parsed.response;
 *   const { scan_id } = parsed.data;
 *
 * Returns a typed discriminated union so callers never assemble 400 responses
 * by hand. Error responses include flattened field errors for client debugging
 * but never echo the raw body (which could be huge or sensitive).
 */

import { z, ZodError, ZodTypeAny } from "https://esm.sh/zod@3.23.8";

export interface ValidOK<T> {
  kind: "ok";
  data: T;
}

export interface ValidFail {
  kind: "invalid";
  reason: string;
  response: Response;
}

export type ValidationResult<T> = ValidOK<T> | ValidFail;

/** Hard cap on request body size (bytes). Prevents LLM-cost griefing. */
const MAX_BODY_BYTES = 256 * 1024; // 256 KB — generous for resumes/text, tight enough to block abuse

export async function validateBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
  corsHeaders: Record<string, string>,
): Promise<ValidationResult<z.infer<S>>> {
  // 1. Read raw body with a size guard before parsing.
  let raw: string;
  try {
    raw = await req.text();
  } catch (err) {
    return failure("body_read_failed", err instanceof Error ? err.message : "unknown", corsHeaders);
  }

  if (raw.length > MAX_BODY_BYTES) {
    return failure(
      "body_too_large",
      `Request body exceeds ${MAX_BODY_BYTES} bytes (got ${raw.length})`,
      corsHeaders,
      413,
    );
  }

  // 2. Parse JSON.
  let json: unknown;
  if (!raw || raw.trim() === "") {
    json = {};
  } else {
    try {
      json = JSON.parse(raw);
    } catch {
      return failure("invalid_json", "Request body is not valid JSON", corsHeaders);
    }
  }

  // 3. Validate against schema.
  const result = schema.safeParse(json);
  if (!result.success) {
    return failure(
      "schema_validation_failed",
      "Request body failed validation",
      corsHeaders,
      400,
      (result.error as ZodError).flatten().fieldErrors,
    );
  }

  return { kind: "ok", data: result.data as z.infer<S> };
}

function failure(
  reason: string,
  message: string,
  corsHeaders: Record<string, string>,
  status = 400,
  fieldErrors?: Record<string, string[] | undefined>,
): ValidFail {
  return {
    kind: "invalid",
    reason,
    response: new Response(
      JSON.stringify({
        error: message,
        reason,
        ...(fieldErrors ? { field_errors: fieldErrors } : {}),
      }),
      { status, headers: { ...corsHeaders, "content-type": "application/json" } },
    ),
  };
}

/** Re-export zod so functions don't each need to import a pinned version. */
export { z };
