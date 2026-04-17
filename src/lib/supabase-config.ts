/**
 * Central Supabase configuration constants.
 * All client-side code should import from here instead of reading import.meta.env directly.
 * This ensures the values are always available regardless of build environment.
 */
// Dev note: hardcoded fallbacks are intentional for Lovable's build system.
// The anon key is public by design (RLS enforces access control).
// In production, VITE_ env vars are always set by Lovable.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dlpeirtuaxydoyzwzdyz.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscGVpcnR1YXh5ZG95end6ZHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTkwNTEsImV4cCI6MjA4NzU5NTA1MX0.A-IvlBe3U5Sheq991dF_ep_RpqFlS_dvM0hskTHQPsw";
