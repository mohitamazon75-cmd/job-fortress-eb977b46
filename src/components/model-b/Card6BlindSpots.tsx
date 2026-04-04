import { useState } from "react";
import { CardShell, CardHead, CardBody, EmotionStrip, SectionLabel, CardNav, Badge } from "./SharedUI";

export default function Card6BlindSpots({ cardData, onBack, onNext }: { cardData: any; onBack: () => void; onNext: () => void }) {
  const d = cardData.card6_blindspots;
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const starColors = [
    { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
    { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
    { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
    { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
  ];

  return (
    <CardShell>
      <CardHead badges={<><Badge label="06 · Blind spots" variant="red" /><Badge label="Specific to your resume" variant="red" /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-red-tint)" borderColor="rgba(174,40,40,0.15)" icon="🔍" textColor="var(--mb-red)" message={d?.emotion_message || ""} />

        {/* Blind spots */}
        {(d?.blind_spots || []).map((bs: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "15px 0", borderBottom: i < (d.blind_spots.length - 1) ? "1.5px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: "var(--mb-red)" }}>{bs.number || i + 1}</span>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-red)", marginBottom: 6, letterSpacing: "-0.01em" }}>{bs.title || bs.gap}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500 }}>{bs.body || bs.fix}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1.5px solid rgba(26,107,60,0.25)" }}>{bs.fix}</span>
                {bs.resource_url && (
                  <a
                    href={bs.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 20, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, letterSpacing: "0.02em" }}
                  >📚 Learn this ↗</a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Interview prep */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel label="Interview prep · Top 5 questions · Built from your resume" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", marginBottom: 14, fontWeight: 500 }}>Tap any question to see an answer built from your actual resume evidence.</div>

          {(d?.interview_prep || []).slice(0, 5).map((q: any, i: number) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
              <div onClick={() => toggle(i)} style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, cursor: "pointer", background: "white" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink)", flex: 1, marginRight: 8, lineHeight: 1.55 }}>{q.question}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--mb-ink3)", transition: "transform 200ms", flexShrink: 0 }}>{expanded[i] ? "−" : "+"}</span>
              </div>
              {expanded[i] && (
                <div style={{ padding: "14px 16px 16px", borderTop: "1.5px solid var(--mb-rule)" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 10 }}>{q.framework}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.8, fontWeight: 500 }}>{q.answer}</div>
                  {q.star_labels?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                      {q.star_labels.map((l: string, j: number) => {
                        const sc = starColors[j % starColors.length];
                        return <span key={j} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: sc.bg, color: sc.color }}>{l}</span>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See human advantage →" />
      </CardBody>
    </CardShell>
  );
}