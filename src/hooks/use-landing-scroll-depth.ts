/**
 * Tracks the deepest scroll position the user reached on the landing page,
 * fired as `landing_scroll_depth` events at 25/50/75/100% buckets.
 *
 * Why: 92% of landing visitors leave without clicking the CTA. We need to
 * know if they bounced above the fold (headline failure) or scrolled deep
 * and still didn't convert (value-prop failure). These are completely
 * different fixes.
 *
 * Design:
 *   - One event per bucket per session (idempotent via Set in ref).
 *   - Throttled to once per ~200ms during scroll.
 *   - Also fires the deepest reached bucket on `pagehide` so bouncers are
 *     captured before the tab dies. (visibilitychange is the modern
 *     replacement for unload.)
 */
import { useEffect, useRef } from 'react';
import type { useAnalytics } from './use-analytics';

type Tracker = ReturnType<typeof useAnalytics>['track'];

const BUCKETS = [25, 50, 75, 100] as const;

function currentDepthPct(): number {
  if (typeof window === 'undefined') return 0;
  const doc = document.documentElement;
  const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
  const scrolled = window.scrollY + window.innerHeight;
  const pct = Math.min(100, Math.round((scrolled / doc.scrollHeight) * 100));
  // Floor against the actual scrollable region so a fully-fitting page reads as 100.
  if (window.scrollY >= scrollable - 4) return 100;
  return pct;
}

interface Args {
  /** Pass the `track` function from useAnalytics. */
  track: Tracker;
  /** When false the listener is disabled (e.g. after the user enters the scan flow). */
  active: boolean;
}

export function useLandingScrollDepth({ track, active }: Args) {
  const firedRef = useRef<Set<number>>(new Set());
  const maxDepthRef = useRef<number>(0);
  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const evaluate = () => {
      const pct = currentDepthPct();
      if (pct > maxDepthRef.current) maxDepthRef.current = pct;
      for (const b of BUCKETS) {
        if (pct >= b && !firedRef.current.has(b)) {
          firedRef.current.add(b);
          track('landing_scroll_depth', { bucket: b });
        }
      }
    };

    const onScroll = () => {
      if (throttleTimerRef.current != null) return;
      throttleTimerRef.current = window.setTimeout(() => {
        throttleTimerRef.current = null;
        evaluate();
      }, 200);
    };

    // Capture-on-leave: fires the deepest bucket if it wasn't already
    // (handles users who paused mid-scroll between buckets and then bounced).
    const onLeave = () => {
      const max = maxDepthRef.current;
      if (max > 0) {
        // Find the highest bucket they crossed
        let crossed = 0;
        for (const b of BUCKETS) if (max >= b) crossed = b;
        if (crossed > 0 && !firedRef.current.has(crossed)) {
          firedRef.current.add(crossed);
          // Best-effort fire — don't await; tab may die any moment.
          void track('landing_scroll_depth', { bucket: crossed, on_leave: true });
        }
      }
    };

    // Initial evaluation in case the page is already scrolled (refresh, back nav)
    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onLeave();
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onLeave);
      if (throttleTimerRef.current != null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [active, track]);
}
