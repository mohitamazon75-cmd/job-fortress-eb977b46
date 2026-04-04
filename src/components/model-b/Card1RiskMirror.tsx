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
        <div style={{ display: "flex", gap: 20, alignItems: "center", padding: 20, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 16, marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={9} />
            <circle cx={50} cy={50} r={r} fill="none" stroke={gaugeColor} strokeWidth={9} strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={50} y={46} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 30, fontWeight: 800, fill: gaugeColor }}>{c1.risk_score}</text>
            <text x={50} y={66} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, fill: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>RISK</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
              {c1.risk_score >= 70 ? "High risk — act now" : c1.risk_score >= 40 ? "Moderate — your framing costs you" : "Low risk — strong position"}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500 }}>Your automation risk is calibrated against <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{c1.india_average || 61}%</strong> India average for this role tier.</div>
          </div>
        </div>

        {/* ATS Section */}
        <SectionLabel label="ATS resume match · 3 target India JDs right now" />
        <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, overflow: "hidden", marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", letterSpacing: "-0.01em" }}>ATS Resume Match · 3 Target India JDs</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 800, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}%<span style={{ fontSize: 13, fontWeight: 600, color: "var(--mb-ink3)", marginLeft: 4 }}>avg</span></span>
          </div>
          <div style={{ padding: "18px 20px" }}>
            {(c1.ats_scores || []).map((s: any, i: number) => {
              const city = (s.city || "all-india").toLowerCase().replace(/\s+/g, "-"); const searchUrl = s.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(`${s.role} ${s.company}`).replace(/%20/g, "+")}`;
              return (
                <div key={i} style={{ marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <a
                      href={searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1, fontSize: 14, color: "var(--mb-navy)", fontWeight: 700, lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif", textDecoration: "none", borderBottom: "1.5px dashed var(--mb-navy-tint2)" }}
                      title={`Search ${s.company} · ${s.role} on Naukri`}
                    >
                      {s.company} · {s.role} ↗
                    </a>
                    <div style={{ width: 90, height: 5, background: "var(--mb-rule)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ height: 5, background: variantColor(s.color), width: `${s.score}%`, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, minWidth: 40, textAlign: "right", color: variantColor(s.color) }}>{s.score}%</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, paddingLeft: 2 }}>
                    <a
                      href={searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, letterSpacing: "0.02em" }}
                    >🔍 Naukri</a>
                    <a
                      href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${s.role} ${s.company}`)}&f_TPR=r604800`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, letterSpacing: "0.02em" }}
                    >💼 LinkedIn</a>
                  </div>
                </div>
              );
            })}
            {c1.ats_missing_keywords?.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px solid var(--mb-rule)", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                <span style={{ fontWeight: 800, color: "var(--mb-ink)" }}>Missing keywords: </span>
                {c1.ats_missing_keywords.map((kw: string, i: number) => (
                  <span key={i}><strong style={{ color: "var(--mb-red)", fontWeight: 800 }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks at risk / safe */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
          {(c1.tasks_at_risk || []).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
          {(c1.tasks_safe || []).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
          ))}
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          {[
            { value: `${c1.risk_score}%`, label: "Automation risk", color: "var(--mb-amber)" },
            { value: c1.disruption_year, label: "Disruption window", color: "var(--mb-amber)" },
            { value: c1.protective_skills_count, label: "Protective skills", color: "var(--mb-green)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 6 }}>{s.value}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-ink3)", letterSpacing: "0.01em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 18 }}>
          <div style={{ display: "flex" }}>
            {avatars.map((a, i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 800, border: "2px solid white", marginLeft: i > 0 ? -6 : 0 }}>{a.initials}</div>
            ))}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600 }}><strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>2,340</strong> B2B marketing managers checked this month · India average: <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>61%</strong></span>
        </div>

        <InfoBox variant="amber" title="What India's live data says — April 2026" body={c1.india_data_insight || ""} />
        <CardNav onNext={onNext} nextLabel="See India market →" />
      </CardBody>
    </CardShell>
  );
}