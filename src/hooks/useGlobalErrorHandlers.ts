import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Top-level safety net for errors that escape React's render-phase
 * ErrorBoundary: uncaught Promise rejections (failed network calls,
 * background tasks) and bare `window.onerror` events.
 *
 * Behaviour:
 *  - Always logs to console for debugging.
 *  - Shows a single short toast per unique message in the last 5s, so a
 *    burst of identical failures doesn't stack 20 toasts.
 *  - Filters out known-noisy benign errors (ResizeObserver loop, aborted
 *    fetches from React Query cancellations).
 *
 * Mounted once at the App root.
 */
const recentToasts = new Map<string, number>();
const TOAST_DEDUP_WINDOW_MS = 5000;

function shouldSuppress(message: string): boolean {
  if (!message) return true;
  // ResizeObserver loop limit exceeded — benign, fires constantly with charts/animations
  if (message.includes("ResizeObserver loop")) return true;
  // Aborted fetches (React Query unmount, route change cancellations)
  if (message.includes("AbortError") || message.includes("aborted")) return true;
  // Lazy chunk reloads — already handled by ErrorBoundary auto-recovery
  if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message)) return true;
  return false;
}

function showOnce(message: string) {
  const now = Date.now();
  const last = recentToasts.get(message) ?? 0;
  if (now - last < TOAST_DEDUP_WINDOW_MS) return;
  recentToasts.set(message, now);
  // Keep map bounded
  if (recentToasts.size > 50) {
    const cutoff = now - TOAST_DEDUP_WINDOW_MS;
    for (const [k, v] of recentToasts) if (v < cutoff) recentToasts.delete(k);
  }
  toast.error("Something went wrong", {
    description: message.length > 140 ? message.slice(0, 140) + "…" : message,
    duration: 4000,
  });
}

export function useGlobalErrorHandlers() {
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : reason?.message || String(reason);
      console.error("[GlobalError] Unhandled promise rejection:", reason);
      if (!shouldSuppress(message)) showOnce(message);
    };

    const onError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message || "Unknown error";
      console.error("[GlobalError] Window error:", event.error || event.message);
      if (!shouldSuppress(message)) showOnce(message);
    };

    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("error", onError);
    };
  }, []);
}
