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
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: "var(--mb-ink)" }}>{band.role}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 800, color: variantColor(band.color) }}>{band.range}</span>
            </div>
            <div style={{ height: 6, background: "var(--mb-rule)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: 6, borderRadius: 3, width: `${band.bar_pct}%`, background: variantColor(band.color), transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <InfoBox variant="green" title="The insight specific to your numbers" body={c2.key_insight || ""} />
        </div>

        {/* Quote box */}
        <div style={{ borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0", padding: "14px 18px", background: "var(--mb-navy-tint)", marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 6, fontWeight: 500 }}>{c2.market_quote}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", fontWeight: 700, letterSpacing: "0.02em" }}>{c2.market_quote_source}</div>
        </div>

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}