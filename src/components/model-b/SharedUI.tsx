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
    <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

/* ── Live pill ── */
export function LivePill() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.18)", fontFamily: "'DM Sans', sans-serif" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--mb-green)", animation: "mbPulse 2.5s infinite" }} />
      Live · Apr 2026
      <style>{`@keyframes mbPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </span>
  );
}

/* ── Card Shell ── */
export function CardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 16, overflow: "hidden" }}>
      {children}
    </div>
  );
}

export function CardHead({ badges, title, sub }: { badges: ReactNode; title: string; sub: string }) {
  return (
    <div style={{ padding: "22px 22px 16px", borderBottom: "1px solid var(--mb-rule)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 10 }}>{badges}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.65 }}>{sub}</div>
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: 22 }}>{children}</div>;
}

/* ── Emotion Strip ── */
export function EmotionStrip({ bgColor, borderColor, icon, textColor, message }: { bgColor: string; borderColor: string; icon: string; textColor: string; message: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", borderRadius: 12, marginBottom: 20, background: bgColor, border: `1px solid ${borderColor}` }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: textColor }}>{message}</span>
    </div>
  );
}

/* ── Section Label ── */
export function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mb-ink4)" }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--mb-rule)", marginLeft: 8 }} />
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
    <div style={{ borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: c.bg, border: `1px solid ${c.border}` }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: c.titleColor, marginBottom: 5 }}>{title}</div>
      {body && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.7 }}>{body}</div>}
      {children}
    </div>
  );
}

/* ── Card Nav ── */
export function CardNav({ onBack, onNext, nextLabel = "Next →", backLabel = "← Back" }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; backLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: onBack ? "space-between" : "flex-end", marginTop: 18 }}>
      {onBack && (
        <button onClick={onBack} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-ink3)", background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
          {backLabel}
        </button>
      )}
      {onNext && (
        <button onClick={onNext} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-navy)", background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
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
