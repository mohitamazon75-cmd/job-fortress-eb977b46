import { useState } from "react";
import { CardShell, CardHead, CardBody, EmotionStrip, SectionLabel, CardNav, Badge } from "./SharedUI";

export default function Card6BlindSpots({ cardData, onBack, onNext }: { cardData: any; onBack: () => void; onNext: () => void }) {
  const d = cardData.card6_blindspots;
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const severityConfig: Record<string, { bg: string; color: string; border: string; icon: string }> = {
    CRITICAL: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.25)", icon: "🔴" },
    SERIOUS: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.25)", icon: "🟡" },
    MODERATE: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "var(--mb-navy-tint2)", icon: "🔵" },
  };

  return (
    <CardShell>
      <CardHead badges={<><Badge label="06 · Tough love" variant="red" /><Badge label="Specific to your resume" variant="red" /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        {/* Emotional arc — Tough love first */}
        {d?.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0 }}>🔍 {d.fear_hook}</p>
          </div>
        )}
        {d?.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-red)", background: "linear-gradient(90deg, var(--mb-red-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-red)", marginBottom: 6 }}>⚔️ NO SUGARCOATING</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>{d.confrontation}</p>
          </div>
        )}
        {d?.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0 }}>✅ {d.hope_bridge}</p>
          </div>
        )}

        {/* Blind spots with severity */}
        {(d?.blind_spots || []).map((bs: any, i: number) => {
          const sev = severityConfig[bs.severity] || severityConfig.MODERATE;
          return (
            <div key={i} style={{ display: "flex", gap: 14, padding: "15px 0", borderBottom: i < (d.blind_spots.length - 1) ? "1.5px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: sev.bg, border: `2px solid ${sev.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>{sev.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: sev.color, letterSpacing: "-0.01em" }}>{bs.title || bs.gap}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, letterSpacing: "0.08em" }}>{bs.severity || "MODERATE"}</span>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500, marginBottom: 6 }}>{bs.body || bs.fix}</div>
                {/* Peer benchmark — tough love */}
                {bs.peer_benchmark && (
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-red)", marginBottom: 8, padding: "6px 10px", background: "var(--mb-red-tint)", borderRadius: 8, border: "1px solid rgba(174,40,40,0.15)" }}>
                    📊 {bs.peer_benchmark}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1.5px solid rgba(26,107,60,0.25)" }}>✅ {bs.fix}</span>
                  {bs.resource_url && (
                    <a href={bs.resource_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 20, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                    >📚 Learn this ↗</a>
                  )}
                </div>
              </div>
            </div>
          );
        })}

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
                  {/* Psychological hook */}
                  {q.psychological_hook && (
                    <div style={{ background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-navy)", margin: 0 }}>🧠 <em>Why they ask this:</em> {q.psychological_hook}</p>
                    </div>
                  )}
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 10 }}>{q.framework}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.8, fontWeight: 500 }}>{q.answer || q.star_answer}</div>
                  {q.star_labels?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                      {q.star_labels.map((l: string, j: number) => {
                        const colors = [
                          { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
                          { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
                          { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
                          { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
                        ];
                        const sc = colors[j % colors.length];
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
