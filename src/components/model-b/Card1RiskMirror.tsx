import { CardShell, CardHead, CardBody, Badge, LivePill, EmotionStrip, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";

interface Props {
  cardData: any;
  onNext: () => void;
}

export default function Card1RiskMirror({ cardData, onNext }: Props) {
  const c1 = cardData.card1_risk;
  if (!c1) return null;

  const r = 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (c1.risk_score || 0) / 100);

  const avatars = [
    { initials: "PK", bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
    { initials: "SR", bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
    { initials: "AM", bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
    { initials: "NK", bg: "var(--mb-red-tint)", color: "var(--mb-red)" },
    { initials: "VR", bg: "var(--mb-teal-tint)", color: "var(--mb-teal)" },
  ];

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="01 · Awareness" variant="amber" /><Badge label="Resume analysed" variant="navy" /><LivePill /></>}
        title={c1.headline || "Risk Mirror"}
        sub={c1.subline || ""}
      />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-amber-tint)" borderColor="rgba(139,90,0,0.15)" icon="⚡" textColor="var(--mb-amber)" message={c1.emotion_message || ""} />

        {/* Gauge row */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 15, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, marginBottom: 16 }}>
          <svg width={88} height={88} viewBox="0 0 88 88">
            <circle cx={44} cy={44} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={9} />
            <circle cx={44} cy={44} r={r} fill="none" stroke="var(--mb-amber)" strokeWidth={9} strokeLinecap="round" transform="rotate(-90 44 44)" strokeDasharray={circumference} strokeDashoffset={offset} />
            <text x={44} y={40} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fill: "var(--mb-amber)" }}>{c1.risk_score}</text>
            <text x={44} y={57} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fill: "var(--mb-ink4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>RISK</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink)", marginBottom: 5 }}>Moderate — but your framing costs you</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.6 }}>Your automation risk is calibrated against {c1.india_average || 61}% India average for this role tier.</div>
          </div>
        </div>

        {/* ATS Section */}
        <SectionLabel label="ATS resume match · 3 target India JDs right now" />
        <div style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "11px 16px", background: "white", borderBottom: "1px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-ink)" }}>ATS resume match · 3 target India JDs</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}% avg</span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            {(c1.ats_scores || []).map((s: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 9 : 0 }}>
                <span style={{ flex: 1, fontSize: 11, color: "var(--mb-ink2)", fontWeight: 500, lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif" }}>{s.company} · {s.role}</span>
                <div style={{ width: 72, height: 3, background: "var(--mb-paper)", borderRadius: 1.5, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: 3, background: variantColor(s.color), width: `${s.score}%` }} />
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, minWidth: 28, textAlign: "right", color: variantColor(s.color) }}>{s.score}%</span>
              </div>
            ))}
            {c1.ats_missing_keywords?.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--mb-rule)", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                Missing keywords:{" "}
                {c1.ats_missing_keywords.map((kw: string, i: number) => (
                  <span key={i}><strong style={{ color: "var(--mb-red)" }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks at risk / safe */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
          {(c1.tasks_at_risk || []).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 11, fontWeight: 500, padding: "4px 11px", borderRadius: 20, border: "1px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
          {(c1.tasks_safe || []).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 11, fontWeight: 500, padding: "4px 11px", borderRadius: 20, border: "1px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { value: `${c1.risk_score}%`, label: "Automation risk", color: "var(--mb-amber)" },
            { value: c1.disruption_year, label: "Disruption window", color: "var(--mb-amber)" },
            { value: c1.protective_skills_count, label: "Protective skills", color: "var(--mb-green)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ display: "flex" }}>
            {avatars.map((a, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, border: "1.5px solid white", marginLeft: i > 0 ? -5 : 0 }}>{a.initials}</div>
            ))}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)" }}>2,340 B2B marketing managers checked this month · India average: 61%</span>
        </div>

        <InfoBox variant="amber" title="What India's live data says — April 2026" body={c1.india_data_insight || ""} />
        <CardNav onNext={onNext} nextLabel="See India market →" />
      </CardBody>
    </CardShell>
  );
}
