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
          <div key={i} style={{ display: "flex", gap: 13, padding: "13px 0", borderBottom: i < (d.blind_spots.length - 1) ? "1px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "var(--mb-red)" }}>{bs.number || i + 1}</span>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-red)", marginBottom: 4 }}>{bs.title || bs.gap}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.65 }}>{bs.body || bs.fix}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.2)" }}>{bs.fix}</span>
                {bs.resource_url && (
                  <a
                    href={bs.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
                  >📚 Learn this ↗</a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Interview prep */}
        <div style={{ marginTop: 16 }}>
          <SectionLabel label="Interview prep · Top 5 questions · Built from your resume" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 12 }}>Tap any question to see an answer built from your actual resume evidence.</div>

          {(d?.interview_prep || []).slice(0, 5).map((q: any, i: number) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
              <div onClick={() => toggle(i)} style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, cursor: "pointer", background: "white" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "var(--mb-ink)", flex: 1, marginRight: 7, lineHeight: 1.55 }}>{q.question}</span>
                <span style={{ fontSize: 18, color: "var(--mb-ink4)", transition: "transform 200ms" }}>{expanded[i] ? "−" : "+"}</span>
              </div>
              {expanded[i] && (
                <div style={{ padding: "12px 14px 13px", borderTop: "1px solid var(--mb-rule)" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 8 }}>{q.framework}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.78 }}>{q.answer}</div>
                  {q.star_labels?.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                      {q.star_labels.map((l: string, j: number) => {
                        const sc = starColors[j % starColors.length];
                        return <span key={j} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.color }}>{l}</span>;
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
