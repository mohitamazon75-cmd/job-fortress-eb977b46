// Server-side feature-flag evaluation.
// Reads public.feature_flags; deterministic bucketing by (flagName + identifier).
// Fail-closed: any error → false (flag OFF). Never default ON.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function isFeatureEnabled(
  supabase: SupabaseClient,
  flagName: string,
  identifier: string | null | undefined,
): Promise<boolean> {
  if (!identifier) return false;
  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled_for_user_ids, enabled_percentage")
      .eq("flag_name", flagName)
      .maybeSingle();
    if (error || !data) return false;
    const whitelist = (data.enabled_for_user_ids as string[]) || [];
    if (whitelist.includes(identifier)) return true;
    const pct = Number(data.enabled_percentage) || 0;
    if (pct <= 0) return false;
    if (pct >= 100) return true;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${flagName}:${identifier}`));
    return new DataView(digest).getUint32(0) % 100 < pct;
  } catch {
    return false;
  }
}
