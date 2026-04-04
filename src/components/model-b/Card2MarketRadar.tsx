import { CardShell, CardHead, CardBody, Badge, LivePill, EmotionStrip, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";

interface Props {
  cardData: any;
  onBack: () => void;
  onNext: () => void;
}

export default function Card2MarketRadar({ cardData, onBack, onNext }: Props) {
  const c2 = cardData.card2_market;
  if (!c2) return null;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="02 · Context" variant="amber" /><LivePill /></>}
        title={c2.headline || "Market Radar"}
        sub={c2.subline || ""}
      />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-amber-tint)" borderColor="rgba(139,90,0,0.15)" icon="🌏" textColor="var(--mb-amber)" message={c2.emotion_message || ""} />

        <SectionLabel label="India salary benchmarks · Your role tier · 2025–26" />

        {(c2.salary_bands || []).map((band: any, i: number) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: "var(--mb-ink2)" }}>{band.role}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", color: variantColor(band.color) }}>{band.range}</span>
            </div>
            <div style={{ height: 4, background: "var(--mb-rule)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: 4, borderRadius: 2, width: `${band.bar_pct}%`, background: variantColor(band.color) }} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <InfoBox variant="green" title="The insight specific to your numbers" body={c2.key_insight || ""} />
        </div>

        {/* Quote box */}
        <div style={{ borderLeft: "2px solid var(--mb-rule2)", borderRadius: "0 8px 8px 0", padding: "12px 16px", background: "var(--mb-navy-tint)", marginBottom: 14 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 5 }}>{c2.market_quote}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink3)", fontWeight: 600 }}>{c2.market_quote_source}</div>
        </div>

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}
