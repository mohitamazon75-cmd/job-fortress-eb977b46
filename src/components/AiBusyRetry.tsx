import { useEffect, useState } from "react";

/**
 * Friendly "AI gateway is at capacity" state.
 * Shows a countdown and auto-retries once at 0. User can also retry manually.
 * Used when the LLM fallback chain returns 429/402 (transient overload),
 * NOT for the per-user daily cap.
 */
export default function AiBusyRetry({
  onRetry,
  initialSeconds = 30,
}: {
  onRetry: () => void;
  initialSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [autoFired, setAutoFired] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      if (!autoFired) {
        setAutoFired(true);
        onRetry();
      }
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, autoFired, onRetry]);

  return (
    <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: 460, margin: "0 auto" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⏱️</div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 18,
          fontWeight: 800,
          color: "var(--mb-ink)",
          marginBottom: 8,
        }}
      >
        Our AI is at capacity right now
      </div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "var(--mb-ink3)",
          marginBottom: 24,
          lineHeight: 1.7,
        }}
      >
        High traffic spike — your scan didn't fail, the engine just needs a moment. We'll auto-retry
        in <strong>{seconds}s</strong>. Your data is safe and you won't be charged extra.
      </div>
      <button
        type="button"
        onClick={() => {
          setAutoFired(true);
          onRetry();
        }}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 800,
          color: "white",
          background: "var(--mb-navy)",
          border: "none",
          borderRadius: 12,
          padding: "14px 32px",
          cursor: "pointer",
          minHeight: 48,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ↻ Retry now
      </button>
      <div
        style={{
          marginTop: 16,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: "var(--mb-ink3)",
        }}
      >
        We've been notified automatically.
      </div>
    </div>
  );
}
