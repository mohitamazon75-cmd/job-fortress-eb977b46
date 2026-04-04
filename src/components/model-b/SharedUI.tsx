import type { CSSProperties, ReactNode } from "react";

/* ── Badge ── */
export function Badge({ label, variant = "amber" }: { label: string; variant?: "amber" | "navy" | "green" | "red" | "teal" }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    amber: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.25)" },
    navy: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "var(--mb-navy-tint2)" },
    green: { bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.25)" },
    red: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.25)" },
    teal: { bg: "var(--mb-teal-tint)", color: "var(--mb-teal)", border: "rgba(14,102,85,0.25)" },
  };
  const c = colors[variant] || colors.amber;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {label}
    </span>
  );
}

/* ── Live pill ── */
export function LivePill() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.22)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mb-green)", animation: "mbPulse 2.5s infinite" }} />
      Live · Apr 2026
    </span>
  );
}

/* ── Card Shell ── */
export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="mb-card-shell" style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", animation: "mbScaleIn 0.3s ease" }}>
      {children}
    </div>
  );
}

export function CardHead({ badges, title, sub }: { badges: ReactNode; title: string; sub: string }) {
  return (
    <div style={{ padding: "28px 28px 22px", borderBottom: "2px solid var(--mb-rule)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", marginBottom: 16 }}>{badges}</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "var(--mb-ink)", marginBottom: 10, lineHeight: 1.25, letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500, margin: 0, letterSpacing: "0.01em" }}>{sub}</p>
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: "26px 28px 28px" }}>{children}</div>;
}

/* ── Emotion Strip ── */
export function EmotionStrip({ bgColor, borderColor, icon, textColor, message }: { bgColor: string; borderColor: string; icon: string; textColor: string; message: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14, marginBottom: 24, background: bgColor, border: `1.5px solid ${borderColor}` }}>
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, lineHeight: 1.75, color: textColor, letterSpacing: "0.005em" }}>{message}</span>
    </div>
  );
}

/* ── Section Label ── */
export function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-ink3)" }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1.5, background: "var(--mb-rule)" }} />
    </div>
  );
}

/* ── Info Box ── */
export function InfoBox({ variant, title, body, children }: { variant: "green" | "amber" | "navy" | "teal" | "red"; title: string; body?: string; children?: ReactNode }) {
  const map: Record<string, { bg: string; border: string; titleColor: string }> = {
    green: { bg: "var(--mb-green-tint)", border: "rgba(26,107,60,0.18)", titleColor: "var(--mb-green)" },
    amber: { bg: "var(--mb-amber-tint)", border: "rgba(139,90,0,0.18)", titleColor: "var(--mb-amber)" },
    navy: { bg: "var(--mb-navy-tint)", border: "var(--mb-navy-tint2)", titleColor: "var(--mb-navy)" },
    teal: { bg: "var(--mb-teal-tint)", border: "rgba(14,102,85,0.18)", titleColor: "var(--mb-teal)" },
    red: { bg: "var(--mb-red-tint)", border: "rgba(174,40,40,0.18)", titleColor: "var(--mb-red)" },
  };
  const c = map[variant] || map.navy;
  return (
    <div style={{ borderRadius: 14, padding: "18px 20px", marginBottom: 18, background: c.bg, border: `1.5px solid ${c.border}` }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: c.titleColor, marginBottom: 8, letterSpacing: "0.01em" }}>{title}</div>
      {body && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.8, fontWeight: 500 }}>{body}</div>}
      {children}
    </div>
  );
}

/* ── Card Nav ── */
export function CardNav({ onBack, onNext, nextLabel = "Next →", backLabel = "← Back" }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; backLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: onBack ? "space-between" : "flex-end", marginTop: 24, paddingTop: 18, borderTop: "2px solid var(--mb-rule)" }}>
      {onBack && (
        <button onClick={onBack} className="mb-btn-secondary" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink2)", background: "none", border: "1.5px solid var(--mb-rule)", borderRadius: 12, padding: "12px 22px", cursor: "pointer", transition: "all 150ms", minHeight: 48 }}>
          {backLabel}
        </button>
      )}
      {onNext && (
        <button onClick={onNext} className="mb-btn-primary" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 12, padding: "12px 24px", cursor: "pointer", transition: "all 150ms", minHeight: 48, boxShadow: "0 3px 12px rgba(27,47,85,0.25)", letterSpacing: "0.02em" }}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}

/* ── Variant color helper ── */
export function variantColor(color: string): string {
  const map: Record<string, string> = {
    green: "var(--mb-green)", amber: "var(--mb-amber)", red: "var(--mb-red)",
    navy: "var(--mb-navy)", teal: "var(--mb-teal)",
  };
  return map[color] || "var(--mb-ink3)";
}