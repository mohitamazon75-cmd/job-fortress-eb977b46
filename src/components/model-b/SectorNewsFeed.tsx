import { SectionLabel } from "./SharedUI";
import { freshnessLabel } from "@/lib/market-copy-sanitizer";

interface NewsItem {
  headline: string;
  impact?: "positive" | "negative" | "neutral";
  why_it_matters?: string;
  source_domain?: string;
  url?: string;
  published_at?: string | null;
}

const IMPACT_COLOR: Record<string, { bg: string; color: string; border: string; chip: string }> = {
  positive: { bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)", chip: "Tailwind" },
  negative: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.2)", chip: "Headwind" },
  neutral: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "rgba(26,58,107,0.18)", chip: "Watch" },
};

export default function SectorNewsFeed({ items, industry }: { items: NewsItem[]; industry?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel label={`SECTOR NEWS — ${(industry || "your industry").toUpperCase()} · LAST 21 DAYS`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.slice(0, 5).map((n, i) => {
          const style = IMPACT_COLOR[n.impact || "neutral"];
          const Wrapper: any = n.url ? "a" : "div";
          const wrapperProps = n.url ? { href: n.url, target: "_blank", rel: "noopener noreferrer" } : {};
          return (
            <Wrapper
              key={i}
              {...wrapperProps}
              style={{
                background: "white",
                border: `1.5px solid ${style.border}`,
                borderRadius: 12,
                padding: "12px 14px",
                textDecoration: "none",
                display: "block",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: style.bg,
                  color: style.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>{style.chip}</span>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.45, flex: 1 }}>
                  {n.headline}
                </div>
              </div>
              {n.why_it_matters && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.55, marginLeft: 0 }}>
                  → {n.why_it_matters}
                </div>
              )}
              {n.source_domain && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--mb-ink3)", marginTop: 6, fontWeight: 700, letterSpacing: "0.04em" }}>
                  {n.source_domain}
                </div>
              )}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
