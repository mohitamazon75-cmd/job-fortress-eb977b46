// ═══════════════════════════════════════════════════════════════
// Shared Supabase client factory
//
// Single source of truth for client construction across all edge
// functions. Previously the pattern:
//   createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
// was duplicated ~64 times across edge function index.ts files.
//
// Usage:
//   import { createAdminClient, createAnonClient } from "../_shared/supabase-client.ts";
//   const supabase = createAdminClient();         // service-role, bypasses RLS
//   const supabase = createAnonClient(jwt);       // user-scoped, respects RLS
//
// Design notes:
// - Both functions throw immediately on missing env vars (fail-loud)
//   rather than silently passing `undefined!` to createClient.
// - auth.persistSession: false is set on all server-side clients
//   to prevent accidental session persistence in edge functions.
// - The admin client should only be used for operations that
//   genuinely require bypassing RLS (e.g., writing scan results,
//   reading profiles for comparison). Prefer createAnonClient
//   for user-data reads where possible.
// ═══════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `[supabase-client] Required environment variable "${name}" is not set. ` +
      `Edge function will not work correctly without it.`,
    );
  }
  return value;
}

/**
 * Creates a Supabase client with the service-role key.
 * Bypasses Row Level Security — use only when RLS bypass is explicitly needed.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

/**
 * Creates a Supabase client scoped to the given JWT.
 * Respects Row Level Security. Preferred for user-data reads.
 *
 * @param jwt - The user's bearer token from the Authorization header.
 */
export function createAnonClient(jwt?: string): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false },
      global: jwt
        ? { headers: { Authorization: `Bearer ${jwt}` } }
        : undefined,
    },
  );
}
