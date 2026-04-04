import type { CSSProperties, ReactNode } from "react";

/* ── Badge ── */
export function Badge({ label, variant = "amber" }: { label: string; variant?: "amber" | "navy" | "green" | "red" | "teal" }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    amber: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.2)" },
    navy: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "var(--mb-navy-tint2)" },
    green: { bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)" },
    red: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.2)" },
    teal: { bg: "var(--mb-teal-tint)", color: "var(--mb-teal)", border: "rgba(14,102,85,0.2)" },
  };
  const c = colors[variant] || colors.amber;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
      {label}
    </span>
  );
}

/* ── Live pill ── */
export function LivePill() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.18)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mb-green)", animation: "mbPulse 2.5s infinite" }} />
      Live · Apr 2026
    </span>
  );
}

/* ── Card Shell ── */
export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="mb-card-shell" style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 18, overflow: "hidden", boxShadow: "var(--mb-shadow-card)", animation: "mbScaleIn 0.3s ease" }}>
      {children}
    </div>
  );
}

export function CardHead({ badges, title, sub }: { badges: ReactNode; title: string; sub: string }) {
  return (
    <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid var(--mb-rule)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>{badges}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink3)", lineHeight: 1.7, fontWeight: 400 }}>{sub}</div>
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: 24 }}>{children}</div>;
}

/* ── Emotion Strip ── */
export function EmotionStrip({ bgColor, borderColor, icon, textColor, message }: { bgColor: string; borderColor: string; icon: string; textColor: string; message: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 14, marginBottom: 22, background: bgColor, border: `1px solid ${borderColor}` }}>
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: 1.75, color: textColor }}>{message}</span>
    </div>
  );
}

/* ── Section Label ── */
export function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-ink4)" }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--mb-rule)" }} />
    </div>
  );
}

/* ── Info Box ── */
export function InfoBox({ variant, title, body, children }: { variant: "green" | "amber" | "navy" | "teal" | "red"; title: string; body?: string; children?: ReactNode }) {
  const map: Record<string, { bg: string; border: string; titleColor: string }> = {
    green: { bg: "var(--mb-green-tint)", border: "rgba(26,107,60,0.15)", titleColor: "var(--mb-green)" },
    amber: { bg: "var(--mb-amber-tint)", border: "rgba(139,90,0,0.15)", titleColor: "var(--mb-amber)" },
    navy: { bg: "var(--mb-navy-tint)", border: "var(--mb-navy-tint2)", titleColor: "var(--mb-navy)" },
    teal: { bg: "var(--mb-teal-tint)", border: "rgba(14,102,85,0.15)", titleColor: "var(--mb-teal)" },
    red: { bg: "var(--mb-red-tint)", border: "rgba(174,40,40,0.15)", titleColor: "var(--mb-red)" },
  };
  const c = map[variant] || map.navy;
  return (
    <div style={{ borderRadius: 14, padding: "16px 18px", marginBottom: 16, background: c.bg, border: `1px solid ${c.border}` }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: c.titleColor, marginBottom: 6 }}>{title}</div>
      {body && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.75 }}>{body}</div>}
      {children}
    </div>
  );
}

/* ── Card Nav ── */
export function CardNav({ onBack, onNext, nextLabel = "Next →", backLabel = "← Back" }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; backLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: onBack ? "space-between" : "flex-end", marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--mb-rule)" }}>
      {onBack && (
        <button onClick={onBack} className="mb-btn-secondary" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "10px 18px", cursor: "pointer", transition: "all 150ms", minHeight: 44 }}>
          {backLabel}
        </button>
      )}
      {onNext && (
        <button onClick={onNext} className="mb-btn-primary" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "white", background: "var(--mb-navy)", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", transition: "all 150ms", minHeight: 44, boxShadow: "0 2px 8px rgba(27,47,85,0.2)" }}>
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
