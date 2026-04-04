import { CardShell, CardHead, CardBody, Badge, LivePill, EmotionStrip, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";

interface Props {
  cardData: any;
  onNext: () => void;
}

export default function Card1RiskMirror({ cardData, onNext }: Props) {
  const c1 = cardData.card1_risk;
  if (!c1) return null;

  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (c1.risk_score || 0) / 100);

  const gaugeColor = (c1.risk_score || 0) >= 70 ? "var(--mb-red)" : (c1.risk_score || 0) >= 40 ? "var(--mb-amber)" : "var(--mb-green)";

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
        <div style={{ display: "flex", gap: 18, alignItems: "center", padding: 18, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 14, marginBottom: 20, boxShadow: "var(--mb-shadow-sm)" }}>
          <svg width={92} height={92} viewBox="0 0 92 92">
            <circle cx={46} cy={46} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={8} />
            <circle cx={46} cy={46} r={r} fill="none" stroke={gaugeColor} strokeWidth={8} strokeLinecap="round" transform="rotate(-90 46 46)" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={46} y={42} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 700, fill: gaugeColor }}>{c1.risk_score}</text>
            <text x={46} y={60} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, fill: "var(--mb-ink4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>RISK</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 6, lineHeight: 1.3 }}>
              {c1.risk_score >= 70 ? "High risk — act now" : c1.risk_score >= 40 ? "Moderate — but your framing costs you" : "Low risk — strong position"}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.65 }}>Your automation risk is calibrated against {c1.india_average || 61}% India average for this role tier.</div>
          </div>
        </div>

        {/* ATS Section */}
        <SectionLabel label="ATS resume match · 3 target India JDs right now" />
        <div style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 14, overflow: "hidden", marginBottom: 20, boxShadow: "var(--mb-shadow-sm)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink)" }}>ATS resume match · 3 target India JDs</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}%<span style={{ fontSize: 12, fontWeight: 500, color: "var(--mb-ink4)", marginLeft: 4 }}>avg</span></span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {(c1.ats_scores || []).map((s: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 12 : 0 }}>
                <span style={{ flex: 1, fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600, lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif" }}>{s.company} · {s.role}</span>
                <div style={{ width: 80, height: 4, background: "var(--mb-rule)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: 4, background: variantColor(s.color), width: `${s.score}%`, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, minWidth: 36, textAlign: "right", color: variantColor(s.color) }}>{s.score}%</span>
              </div>
            ))}
            {c1.ats_missing_keywords?.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--mb-rule)", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ fontWeight: 600 }}>Missing keywords: </span>
                {c1.ats_missing_keywords.map((kw: string, i: number) => (
                  <span key={i}><strong style={{ color: "var(--mb-red)", fontWeight: 700 }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks at risk / safe */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {(c1.tasks_at_risk || []).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
          {(c1.tasks_safe || []).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { value: `${c1.risk_score}%`, label: "Automation risk", color: "var(--mb-amber)" },
            { value: c1.disruption_year, label: "Disruption window", color: "var(--mb-amber)" },
            { value: c1.protective_skills_count, label: "Protective skills", color: "var(--mb-green)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, padding: 14, boxShadow: "var(--mb-shadow-sm)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "var(--mb-ink3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: "flex" }}>
            {avatars.map((a, i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, border: "2px solid white", marginLeft: i > 0 ? -6 : 0 }}>{a.initials}</div>
            ))}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", fontWeight: 500 }}>2,340 B2B marketing managers checked this month · India average: 61%</span>
        </div>

        <InfoBox variant="amber" title="What India's live data says — April 2026" body={c1.india_data_insight || ""} />
        <CardNav onNext={onNext} nextLabel="See India market →" />
      </CardBody>
    </CardShell>
  );
}
