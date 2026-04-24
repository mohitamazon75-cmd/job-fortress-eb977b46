import { useEffect, useRef, useState } from "react";

/**
 * useAnimatedNumber — count-up animation for any numeric value.
 *
 * Used to make scores and metrics feel "alive" when they appear, instead of
 * snapping into place. Mirrors the existing animation in AIDossierReveal and
 * Card0Verdict, extracted so other surfaces (dashboard, etc.) can share the
 * exact same easing curve and timing.
 *
 * Honors prefers-reduced-motion: if the user has reduced-motion on, returns
 * the target value immediately without animating.
 *
 * @param target - The final value to animate to.
 * @param duration - Animation duration in ms (default 1200ms).
 * @returns The current animated value (rounded).
 */
export function useAnimatedNumber(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect user motion preference
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !target || target <= 0) {
      setValue(target || 0);
      return;
    }

    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * ease(p)));
      if (p < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}
