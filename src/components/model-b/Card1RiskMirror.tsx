// useState and useEffect removed — scan count is now a prop from ResultsModelB
import { CardShell, CardHead, CardBody, Badge, EmotionStrip, SectionLabel, InfoBox, CardNav, variantColor } from "./SharedUI";
import BossPerceptionSimulator from "./BossPerceptionSimulator";

interface Props {
  cardData: any;
  onNext: () => void;
  /** Optional. Currently unused (Card1 is first content card after Verdict);
   *  added for nav consistency with Card2+ in case the deck order changes. */
  onBack?: () => void;
  /** Monthly scan count for social proof. Fetched once by ResultsModelB and passed down. */
  monthlyScanCount?: number | null;
}

export default function Card1RiskMirror({ cardData, onNext, onBack, monthlyScanCount }: Props) {
  const c1 = cardData.card1_risk;
  const u = cardData.user || {};
  const disruptionYear = c1?.disruption_year || "2027";

  // P-3-B: scan count is now fetched once by ResultsModelB and passed as a prop,
  // avoiding a redundant DB query every time this card renders.
  const scanCount = monthlyScanCount ?? null;

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

  const cost = c1.cost_of_inaction;

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="01 · Awareness" variant="amber" /><Badge label="Resume analysed" variant="navy" /></>}
        title={c1.headline || "Risk Mirror"}
        sub={c1.subline || ""}
      />
      <CardBody>
        {/* Fear hook — "WHAT'S ALREADY HAPPENING" */}
        {c1.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-red)" }}>
                {`THE ${disruptionYear} PROBLEM`}
              </span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{c1.fear_hook}</p>
          </div>
        )}
        {/* Tough love — italic warning */}
        {c1.tough_love && (
          <div style={{ background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "var(--mb-amber)", lineHeight: 1.6, margin: 0, fontStyle: "italic", whiteSpace: "pre-line" }}>💡 {c1.tough_love}</p>
          </div>
        )}
        {/* Hope bridge — green advantage */}
        {c1.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>✅ {c1.hope_bridge}</p>
          </div>
        )}

        {/* Confrontation banner */}
        {c1.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-red)", background: "linear-gradient(90deg, var(--mb-red-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-red)", marginBottom: 6 }}>⚔️ DIRECT CHALLENGE</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{c1.confrontation}</p>
          </div>
        )}

        {/* Gauge row — clearly labelled as AI Exposure (not the overall JobBachao score) */}
        <div style={{ padding: "10px 14px 6px", marginBottom: 6 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mb-ink3)" }}>
            AI Exposure for this role
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginTop: 2 }}>
            Different from your overall JobBachao score (top of page) — this measures only automation risk.
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", padding: 20, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 16, marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--mb-rule)" strokeWidth={9} />
            <circle cx={50} cy={50} r={r} fill="none" stroke={gaugeColor} strokeWidth={9} strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            <text x={50} y={44} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 800, fill: gaugeColor }}>{c1.risk_score}<tspan style={{ fontSize: 13, fontWeight: 700 }}>%</tspan></text>
            <text x={50} y={66} textAnchor="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800, fill: "var(--mb-ink3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>AI EXPOSURE</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8, lineHeight: 1.3 }}>
              {c1.risk_score >= 70 ? "🔴 High exposure — act now" : c1.risk_score >= 40 ? "🟡 Moderate exposure — your framing costs you" : "🟢 Low exposure — strong position"}
            </div>
            {c1.india_average != null && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500 }}>
                India average for this role: <strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{c1.india_average}%</strong>. You're {(c1.risk_score || 0) > c1.india_average ? "above" : "below"} it.
              </div>
            )}
          </div>
        </div>

        {/* Boss Perception Simulator — psychological deep-cut, hyper-personalised */}
        <BossPerceptionSimulator
          role={u.current_title || u.role || c1.role || "your role"}
          years={u.years_experience || u.years || u.experience}
          riskScore={c1.risk_score || 0}
          tasksAtRisk={c1.tasks_at_risk}
          industry={u.industry}
        />

        {/* Cost of Inaction */}
        {cost && (
          <>
            <SectionLabel label="💸 What doing nothing costs you" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.25)", borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 800, color: "var(--mb-red)", marginBottom: 4 }}>{cost.annual_gap_pct || cost.monthly_loss_lpa}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mb-red)", fontFamily: "'DM Sans', sans-serif" }}>Left on table annually</div>
              </div>
              <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.25)", borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 800, color: "var(--mb-red)", marginBottom: 4 }}>{cost.six_month_gap_pct || cost.six_month_loss}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mb-red)", fontFamily: "'DM Sans', sans-serif" }}>6-month earning power lost</div>
              </div>
            </div>
            {cost.decay_narrative && (
              <div style={{ borderLeft: "3px solid var(--mb-red)", padding: "10px 16px", marginBottom: 20, borderRadius: "0 10px 10px 0", background: "rgba(174,40,40,0.03)" }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink2)", lineHeight: 1.7, margin: 0 }}>{cost.decay_narrative}</p>
              </div>
            )}
          </>
        )}

        {/* ATS Section — hidden until Day 3 JD-matching pipeline populates real scores */}
        {c1.ats_scores != null && c1.ats_scores.length > 0 && (
        <>
        <SectionLabel label="ATS resume match · 3 target India JDs right now" />
        <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, overflow: "hidden", marginBottom: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--mb-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)" }}>ATS Resume Match · 3 Target India JDs</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 800, color: "var(--mb-amber)" }}>{cardData.ats_avg || c1.ats_scores?.[0]?.score || 60}%<span style={{ fontSize: 13, fontWeight: 600, color: "var(--mb-ink3)", marginLeft: 4 }}>avg</span></span>
          </div>
          <div style={{ padding: "18px 20px" }}>
            {(c1.ats_scores || []).map((s: any, i: number) => {
              const city = (s.city || "all-india").toLowerCase().replace(/\s+/g, "-");
              const searchUrl = s.search_url || `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(`${s.role} ${s.company}`).replace(/%20/g, "+")}`;
              return (
                <div key={i} style={{ marginBottom: i < (c1.ats_scores?.length || 0) - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <a href={searchUrl} target="_blank" rel="noopener noreferrer"
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
                    <a href={searchUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                    >🔍 Naukri</a>
                    <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${s.role} ${s.company}`)}&f_TPR=r604800`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 800, padding: "5px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}
                    >💼 LinkedIn</a>
                  </div>
                </div>
              );
            })}
            {c1.ats_missing_keywords?.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1.5px solid var(--mb-rule)", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                <span style={{ fontWeight: 800, color: "var(--mb-ink)" }}>⚠️ Missing keywords: </span>
                {c1.ats_missing_keywords.map((kw: string, i: number) => (
                  <span key={i}><strong style={{ color: "var(--mb-red)", fontWeight: 800 }}>{kw}</strong>{i < c1.ats_missing_keywords.length - 1 ? " · " : ""}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {/* Tasks at risk / safe */}
        <SectionLabel label="What AI is replacing in your role right now" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
          {(c1.tasks_at_risk || []).map((t: string, i: number) => (
            <span key={`r${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(174,40,40,0.25)", color: "var(--mb-red)", background: "var(--mb-red-tint)", fontFamily: "'DM Sans', sans-serif" }}>❌ {t}</span>
          ))}
          {(c1.tasks_safe || []).map((t: string, i: number) => (
            <span key={`s${i}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 20, border: "1.5px solid rgba(26,107,60,0.25)", color: "var(--mb-green)", background: "var(--mb-green-tint)", fontFamily: "'DM Sans', sans-serif" }}>✅ {t}</span>
          ))}
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          {[
            { value: `${c1.risk_score}%`, label: "Automation risk", color: "var(--mb-amber)" },
            { value: disruptionYear, label: "Hits your salary by", color: "var(--mb-amber)" },
            { value: c1.protective_skills_count, label: "Skills protecting you", color: "var(--mb-green)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 6 }}>{s.value}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-ink3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        {scanCount && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, marginBottom: 18 }}>
          <div style={{ display: "flex" }}>
            {avatars.map((a, i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 800, border: "2px solid white", marginLeft: i > 0 ? -6 : 0 }}>{a.initials}</div>
            ))}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", fontWeight: 600 }}><strong style={{ fontWeight: 800, color: "var(--mb-ink)" }}>{scanCount}+</strong> professionals checked this month{c1.india_average != null && <> · India avg: <strong style={{ fontWeight: 800, color: "var(--mb-red)" }}>{c1.india_average}%</strong></>}</span>
        </div>
        )}

        <InfoBox variant="amber" title={`India market signal — ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} body={c1.india_data_insight || ""} />

        {/* Methodology stamp — trust footer */}
        <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--mb-paper)", border: "1px dashed var(--mb-rule)", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", lineHeight: 1.6, fontWeight: 500 }}>
          <strong style={{ color: "var(--mb-ink2)", fontWeight: 800, letterSpacing: "0.04em" }}>HOW WE CALCULATED THIS:</strong> AI Exposure derived from O*NET task-automation indices, McKinsey & Goldman Sachs occupational AI-impact studies, and your resume's task profile. Disruption year is a directional estimate based on current adoption velocity in your sector — not a guarantee.
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See your live market →" />
      </CardBody>
    </CardShell>
  );
}