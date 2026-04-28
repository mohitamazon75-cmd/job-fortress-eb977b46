/**
 * Reveal-funnel instrumentation helpers.
 *
 * Lightweight client-side tracking for the post-reveal user behaviour we currently
 * fly blind on (open / re-open, scroll depth, share intent, share completion,
 * Pro CTA clicks). All inserts are fire-and-forget and silently swallow errors:
 * we never want a tracking failure to interrupt the user journey.
 *
 * Storage backing: `public.user_action_signals` (CHECK constraint extended in
 * migration 20260428_135704). RLS allows any-row inserts and lets users read
 * their own rows.
 *
 * Why a separate file (vs. continuing to pile into ResultsModelB):
 *  - Reusable from share components, Coach widget, Pro CTAs.
 *  - Pure module → trivially unit-testable.
 *  - Keeps the page component focused on rendering.
 */
import { supabase } from "@/integrations/supabase/client";

export type RevealEventType =
  | "reveal_opened"
  | "reveal_reopened"
  | "scroll_depth"
  | "share_clicked"
  | "share_completed"
  | "pro_cta_clicked"
  | "coach_question_asked";

export interface RevealEventContext {
  scanId: string | null | undefined;
  userId?: string | null;
  scanRole?: string | null;
  scanIndustry?: string | null;
  scanScore?: number | null;
  scanCity?: string | null;
}

/**
 * Fire-and-forget event insert. Swallows all errors. No await needed.
 */
export function trackRevealEvent(
  eventType: RevealEventType,
  ctx: RevealEventContext,
  payload: Record<string, unknown> = {},
): void {
  if (!ctx.scanId) return; // never insert orphan rows
  try {
    // Cast: types may not include the table yet in some envs.
    (supabase.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<unknown>;
    })("user_action_signals")
      .insert({
        scan_id: ctx.scanId,
        user_id: ctx.userId ?? null,
        action_type: eventType,
        action_payload: payload,
        scan_role: ctx.scanRole ?? null,
        scan_industry: ctx.scanIndustry ?? null,
        scan_score: ctx.scanScore ?? null,
        scan_city: ctx.scanCity ?? null,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* noop */
  }
}

/**
 * Decides whether this is the first time `scanId` has been opened on this
 * device. Persists a marker in localStorage. Pure-ish (touches localStorage
 * only) so it can be exercised by callers in a single line.
 *
 * Returns the event type to fire (`reveal_opened` first time, `reveal_reopened`
 * thereafter). Returns null in non-browser environments.
 */
export function classifyRevealOpen(scanId: string): "reveal_opened" | "reveal_reopened" | null {
  if (typeof window === "undefined") return null;
  const key = `jb:reveal_seen:${scanId}`;
  try {
    const seen = window.localStorage.getItem(key);
    if (seen) return "reveal_reopened";
    window.localStorage.setItem(key, new Date().toISOString());
    return "reveal_opened";
  } catch {
    // localStorage blocked (private mode, etc.) — treat as first open, but
    // don't poison classification on later visits we can't remember.
    return "reveal_opened";
  }
}

/**
 * Scroll-depth tracker factory. Returns a handler you attach to a scroll
 * listener; it fires `onThreshold(pct)` exactly once per crossed threshold
 * (25/50/75/100). Idempotent across re-renders if you reuse the returned
 * `crossed` Set across mounts (typically a useRef).
 */
export function makeScrollDepthTracker(
  crossed: Set<number>,
  onThreshold: (pct: 25 | 50 | 75 | 100) => void,
) {
  const thresholds: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
  return function handleScroll() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const viewport = window.innerHeight || doc.clientHeight || 0;
    const full = doc.scrollHeight || 0;
    const scrollable = Math.max(1, full - viewport);
    const pct = Math.min(100, Math.max(0, (scrollTop / scrollable) * 100));
    for (const t of thresholds) {
      if (pct >= t && !crossed.has(t)) {
        crossed.add(t);
        onThreshold(t);
      }
    }
  };
}
